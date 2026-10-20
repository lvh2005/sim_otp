import { randomBytes } from "node:crypto";
import { getEffectiveApiConfig, getRedis, getSessionUser, jsonError } from "@/lib/sim-store";
import { getMinimumDeposit } from "@/lib/sepay";

import { generateDepositCode, generateCompactDepositCode, normalizeVietnameseName } from "@/lib/vietnamese-name";

async function ensureDepositCode(redis, user) {
	const userRecord = await redis.hgetall(`user:${user.id}`);
	const rawFullName = userRecord?.fullName ? String(userRecord.fullName).trim() : "";
	const fullName = normalizeVietnameseName(rawFullName);

	if (fullName) {
		const expectedCode = generateDepositCode(fullName);
		const compactCode = generateCompactDepositCode(fullName);
		await redis.hset(`user:${user.id}`, "depositCode", expectedCode, "fullName", fullName);
		await redis.hset("users:by-deposit-code", expectedCode, user.id);
		await redis.hset("users:by-deposit-code", compactCode, user.id);
		await redis.hset("users:by-deposit-code", expectedCode.toUpperCase(), user.id);
		await redis.hset("users:by-deposit-code", fullName, user.id);
		await redis.hset("users:by-fullname", fullName, user.id);
		return expectedCode;
	}

	const storedCode = userRecord?.depositCode;
	if (typeof storedCode === "string" && storedCode) return storedCode;

	for (let attempt = 0; attempt < 5; attempt += 1) {
		const code = `SOTP${randomBytes(6).toString("hex").toUpperCase()}`;
		const result = await redis.eval(
			`local current = redis.call('HGET', KEYS[1], 'depositCode')
			 if current then return current end
			 local existing = redis.call('HGET', KEYS[2], ARGV[1])
			 if existing and existing ~= ARGV[2] then return '' end
			 redis.call('HSET', KEYS[1], 'depositCode', ARGV[1])
			 redis.call('HSET', KEYS[2], ARGV[1], ARGV[2])
			 return ARGV[1]`,
			[`user:${user.id}`, "users:by-deposit-code"],
			[code, user.id],
		);
		if (typeof result === "string" && result) return result;
	}
	throw new Error("Không thể tạo mã nạp tiền");
}

export async function GET(request) {
	try {
		const user = await getSessionUser(request);
		if (!user) return jsonError("Vui lòng đăng nhập", 401);
		const redis = getRedis();
		const config = await getEffectiveApiConfig(redis);
		const depositCode = await ensureDepositCode(redis, user);
		const ids = await redis.zrange(`user:${user.id}:transactions:type:SEPAY_DEPOSIT`, 0, 9, { rev: true });
		const history = await Promise.all(ids.map(async (id) => {
			const transaction = await redis.hgetall(`transaction:${id}`);
			return transaction?.id ? {
				id: String(transaction.id),
				amount: Number(transaction.amount || 0),
				createdAt: Number(transaction.createdAt || 0),
			} : null;
		}));
		return Response.json({
			depositCode,
			balance: Number(await redis.hget(`user:${user.id}`, "balance") || 0),
			depositEnabled: config.deposit_enabled !== false,
			supportTelegram: config.deposit_support_telegram || "Vuha_cute_dapxe_trenpho",
			disabledNotice: config.deposit_disabled_notice || "Cổng nạp tiền tự động VietQR đang tạm dừng để bảo trì. Quý khách vui lòng liên hệ Telegram hỗ trợ để nạp tiền trực tiếp!",
			minimumAmount: Number(config.sepay_min_deposit_vnd) || getMinimumDeposit(),
			destination: {
				bankName: config.sepay_bank_name || process.env.SEPAY_BANK_NAME || "TPBank",
				accountNumber: config.sepay_account_number || process.env.SEPAY_ACCOUNT_NUMBER || "10005790882",
				accountName: config.sepay_account_name || process.env.SEPAY_ACCOUNT_NAME || "LE VU HA",
			},
			history: history.filter(Boolean),
		});
	} catch (error) {
		console.error("Deposit API error:", error);
		return jsonError("Không thể tải thông tin nạp tiền lúc này", 503);
	}
}
