import { getEffectiveApiConfig, getRedis, jsonError, safeEqual } from "@/lib/sim-store";
import { extractDepositCode, getMinimumDeposit, resolveDepositUserId, SEPAY_DEPOSIT_SCRIPT } from "@/lib/sepay";

function accepted() {
	return Response.json({ success: true });
}

export async function POST(request) {
	let redis;
	try {
		redis = getRedis();
	} catch {
		return jsonError("Không thể kết nối cơ sở dữ liệu", 500);
	}

	let config = {};
	try {
		config = await getEffectiveApiConfig(redis);
	} catch (_) {}

	const apiKey = String(config.sepay_webhook_api_key || process.env.SEPAY_WEBHOOK_API_KEY || "").trim();
	if (apiKey) {
		const authHeader = request.headers.get("authorization") || request.headers.get("x-api-key") || "";
		const cleanAuth = authHeader.replace(/^(Apikey|Bearer)\s+/i, "").trim();
		if (!safeEqual(cleanAuth, apiKey) && !safeEqual(authHeader, `Apikey ${apiKey}`) && !safeEqual(authHeader, apiKey)) {
			return jsonError("Không có quyền thực hiện (Sai API Key)", 401);
		}
	}

	let payload;
	try {
		payload = await request.json();
	} catch {
		return jsonError("Payload không hợp lệ", 400);
	}

	// Handle SePay test webhook / ping
	if (!payload || payload.isTest || payload.test) {
		return Response.json({ success: true, message: "SePay webhook connected successfully" });
	}

	if (String(payload.transferType || "").toLowerCase() !== "in") return accepted();
	const eventId = String(payload.id ?? payload.transactionId ?? "").trim();
	if (!eventId || !/^[a-z0-9_-]{1,80}$/i.test(eventId)) return jsonError("Mã giao dịch không hợp lệ", 400);

	const amount = Number(payload.transferAmount);
	if (!Number.isSafeInteger(amount) || amount < getMinimumDeposit()) return accepted();

	try {
		let userId = null;
		const legacyCode = extractDepositCode(payload);
		if (legacyCode) {
			userId = await redis.hget("users:by-deposit-code", legacyCode);
		}
		if (!userId) {
			userId = await resolveDepositUserId(payload, redis);
		}
		if (typeof userId !== "string" || !userId) return accepted();

		const user = await redis.hgetall(`user:${userId}`);
		if (!user?.id) return accepted();

		const transactionId = `sepay:${eventId}`;
		await redis.eval(
			SEPAY_DEPOSIT_SCRIPT,
			[
				`user:${userId}`,
				`sepay:event:${eventId}`,
				`transaction:${transactionId}`,
				"transactions:all",
				`user:${userId}:transactions`,
				"transactions:type:SEPAY_DEPOSIT",
				`user:${userId}:transactions:type:SEPAY_DEPOSIT`,
			],
			[amount, transactionId, userId, String(user.username || ""), Date.now(), String(payload.referenceCode || "")],
		);
		return accepted();
	} catch {
		return Response.json({ success: false, message: "Temporary processing failure" }, { status: 503 });
	}
}
