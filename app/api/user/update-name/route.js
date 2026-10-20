import { getRedis, getSessionUser, jsonError } from "@/lib/sim-store";
import { isValidVietnameseName, normalizeVietnameseName, generateDepositCode, generateCompactDepositCode } from "@/lib/vietnamese-name";

export async function POST(request) {
	try {
		const sessionUser = await getSessionUser(request);
		if (!sessionUser) {
			return jsonError("Vui lòng đăng nhập để thực hiện cập nhật", 401);
		}

		let body;
		try {
			body = await request.json();
		} catch {
			return jsonError("Dữ liệu gửi lên không hợp lệ", 400);
		}

		const rawFullName = String(body.fullName || "").trim();
		const fullName = normalizeVietnameseName(rawFullName);

		if (!isValidVietnameseName(fullName)) {
			return jsonError("Họ và tên không hợp lệ. Vui lòng nhập họ và tên tiếng Việt không dấu (tối thiểu 2 từ, VD: LE VU HA)", 400);
		}

		const redis = getRedis();

		// Check if this full name is already claimed by another user
		const existingOwner = await redis.hget("users:by-fullname", fullName);
		if (existingOwner && String(existingOwner) !== String(sessionUser.id)) {
			return jsonError("Họ và tên này đã được sử dụng trên hệ thống. Vui lòng thêm tên đệm hoặc số phân biệt (VD: LE VU HA 2)", 409);
		}

		const oldUser = await redis.hgetall(`user:${sessionUser.id}`);
		const oldFullName = oldUser?.fullName ? String(oldUser.fullName).trim() : "";
		if (oldFullName && oldFullName !== fullName) {
			await redis.hdel("users:by-fullname", oldFullName).catch(() => null);
		}

		const depositCode = generateDepositCode(fullName);
		const compactCode = generateCompactDepositCode(fullName);

		await redis.hset(`user:${sessionUser.id}`, {
			fullName: fullName,
			depositCode: depositCode,
			updatedAt: Date.now(),
		});

		await redis.hset("users:by-fullname", fullName, sessionUser.id);
		await redis.hset("users:by-deposit-code", depositCode, sessionUser.id);
		await redis.hset("users:by-deposit-code", compactCode, sessionUser.id);
		await redis.hset("users:by-deposit-code", depositCode.toUpperCase(), sessionUser.id);
		await redis.hset("users:by-deposit-code", fullName, sessionUser.id);

		return Response.json({
			success: true,
			fullName,
			depositCode,
			message: "Cập nhật họ và tên thật thành công!",
		});
	} catch (error) {
		console.error("Update name error:", error);
		return jsonError(error.message || "Không thể cập nhật họ tên lúc này", 500);
	}
}
