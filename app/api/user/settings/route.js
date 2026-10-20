import { randomBytes } from "node:crypto";
import { getRedis, getSessionUser, hashPassword, jsonError, verifyPassword } from "@/lib/sim-store";

export async function GET(request) {
  try {
    const sessionUser = await getSessionUser(request);
    if (!sessionUser) return jsonError("Vui lòng đăng nhập", 401);

    const redis = getRedis();
    const user = await redis.hgetall(`user:${sessionUser.id}`);
    if (!user?.id) return jsonError("Không tìm thấy thông tin tài khoản", 404);

    let apiKey = user.apiKey || "";
    if (!apiKey) {
      apiKey = `sotp_${randomBytes(18).toString("hex")}`;
      await redis.hset(`user:${sessionUser.id}`, "apiKey", apiKey);
      await redis.hset("users:by-api-key", apiKey, sessionUser.id);
    }

    const orderCount = Number(await redis.zcard(`user:${sessionUser.id}:orders`)) || 0;
    const depositTransactions = await redis.zrange(`user:${sessionUser.id}:transactions:type:SEPAY_DEPOSIT`, 0, -1);
    
    let totalDeposited = 0;
    if (depositTransactions && depositTransactions.length > 0) {
      const deposits = await Promise.all(
        depositTransactions.map((id) => redis.hget(`transaction:${id}`, "amount"))
      );
      totalDeposited = deposits.reduce((sum, amt) => sum + (Number(amt) || 0), 0);
    }

    return Response.json({
      user: {
        id: String(user.id),
        username: String(user.username),
        fullName: user.fullName ? String(user.fullName) : "",
        balance: Number(user.balance || 0),
        depositCode: String(user.depositCode || ""),
        apiKey: String(apiKey),
        createdAt: Number(user.createdAt || 0),
        orderCount,
        totalDeposited,
      },
    });
  } catch (error) {
    console.error("User settings API GET error:", error);
    return jsonError("Không thể tải cài đặt tài khoản lúc này", 500);
  }
}

export async function POST(request) {
  try {
    const sessionUser = await getSessionUser(request);
    if (!sessionUser) return jsonError("Vui lòng đăng nhập", 401);

    const redis = getRedis();
    const body = await request.json();
    const action = body.action;

    if (action === "change_password") {
      const currentPassword = String(body.currentPassword || "");
      const newPassword = String(body.newPassword || "");

      if (!currentPassword || !newPassword) {
        return jsonError("Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới", 400);
      }

      if (newPassword.length < 8 || newPassword.length > 128) {
        return jsonError("Mật khẩu mới phải từ 8 đến 128 ký tự", 400);
      }

      const user = await redis.hgetall(`user:${sessionUser.id}`);
      if (!user?.id) return jsonError("Tài khoản không tồn tại", 404);

      const isValid = await verifyPassword(
        currentPassword,
        String(user.passwordSalt),
        String(user.passwordHash)
      );

      if (!isValid) {
        return jsonError("Mật khẩu hiện tại không chính xác", 400);
      }

      const { salt, hash } = await hashPassword(newPassword);
      await redis.hset(`user:${sessionUser.id}`, {
        passwordSalt: salt,
        passwordHash: hash,
        updatedAt: Date.now(),
      });

      return Response.json({ success: true, message: "Đổi mật khẩu thành công!" });
    }

    if (action === "regenerate_api_key") {
      const user = await redis.hgetall(`user:${sessionUser.id}`);
      const oldKey = user.apiKey;
      if (oldKey) {
        await redis.hdel("users:by-api-key", oldKey);
      }

      const newKey = `sotp_${randomBytes(18).toString("hex")}`;
      await redis.hset(`user:${sessionUser.id}`, "apiKey", newKey);
      await redis.hset("users:by-api-key", newKey, sessionUser.id);

      return Response.json({ success: true, apiKey: newKey, message: "Đã tạo API Key mới!" });
    }

    return jsonError("Hành động không hợp lệ", 400);
  } catch (error) {
    console.error("User settings API POST error:", error);
    return jsonError(error.message || "Không thể cập nhật cài đặt", 500);
  }
}
