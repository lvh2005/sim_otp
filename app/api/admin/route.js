import { getRedis, getServicePrices, jsonError, safeEqual, SIM_SERVICES } from "@/lib/sim-store";

function isAdmin(request) {
	const adminToken = process.env.ADMIN_API_TOKEN;
	return Boolean(adminToken && safeEqual(request.headers.get("x-admin-token"), adminToken));
}

export async function GET(request) {
	if (!isAdmin(request)) return jsonError("Không có quyền thực hiện", 401);
	try {
		const redis = getRedis();
		return Response.json({ prices: await getServicePrices(redis) });
	} catch (error) {
		return jsonError(error.message || "Không thể đọc bảng giá", 503);
	}
}

export async function PATCH(request) {
	if (!isAdmin(request)) return jsonError("Không có quyền thực hiện", 401);
	try {
		const { prices } = await request.json();
		if (!prices || typeof prices !== "object" || Array.isArray(prices)) {
			return jsonError("Bảng giá không hợp lệ", 400);
		}
		const normalized = {};
		for (const service of SIM_SERVICES) {
			const price = Number(prices[service]);
			if (!Number.isSafeInteger(price) || price <= 0 || price > 100000000) {
				return jsonError(`Giá ${service} phải là số nguyên dương`, 400);
			}
			normalized[service] = price;
		}
		const redis = getRedis();
		await redis.hset("config:sim:prices", normalized);
		return Response.json({ success: true, prices: await getServicePrices(redis) });
	} catch (error) {
		return jsonError(error.message || "Không thể lưu bảng giá", 503);
	}
}

export async function POST(request) {
	if (!isAdmin(request)) return jsonError("Không có quyền thực hiện", 401);
	try {
		const { username, amount } = await request.json();
		const normalized = String(username || "").trim().toLowerCase();
		const credit = Number(amount);
		if (!normalized || !Number.isSafeInteger(credit) || credit <= 0 || credit > 100000000) {
			return jsonError("username hoặc amount không hợp lệ", 400);
		}
		const redis = getRedis();
		const userId = await redis.hget("users:by-username", normalized);
		if (typeof userId !== "string") return jsonError("Không tìm thấy user", 404);
		const balance = await redis.hincrby(`user:${userId}`, "balance", credit);
		return Response.json({ success: true, username: normalized, balance });
	} catch (error) {
		return jsonError(error.message || "Không thể cộng số dư", 503);
	}
}
