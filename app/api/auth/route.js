import { randomBytes, randomUUID } from "node:crypto";
import { getRedis, digest, getSessionUser, hashPassword, jsonError, verifyPassword } from "@/lib/sim-store";

const SESSION_SECONDS = 60 * 60 * 24 * 30;

export async function GET(request) {
  try {
    const user = await getSessionUser(request);
    if (!user) return Response.json({ user: null });
    return Response.json({ user });
  } catch (error) {
    return jsonError(error.message || "Không thể kết nối cơ sở dữ liệu", 503);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const action = body.action;
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!/^[a-z0-9_]{3,24}$/.test(username) || password.length < 8 || password.length > 128) {
      return jsonError("Tên tài khoản 3-24 ký tự (a-z, 0-9, _) và mật khẩu 8-128 ký tự", 400);
    }

    const redis = getRedis();
    let userId = await redis.hget("users:by-username", username);
    let user;

    if (action === "register") {
      const id = randomUUID();
      const { salt, hash } = await hashPassword(password);
      const created = await redis.eval(
        `if redis.call('HEXISTS', KEYS[1], ARGV[1]) == 1 then return 0 end
         redis.call('HSET', KEYS[1], ARGV[1], ARGV[2])
         redis.call('HSET', KEYS[2], 'id', ARGV[2], 'username', ARGV[1], 'balance', '0', 'passwordSalt', ARGV[3], 'passwordHash', ARGV[4])
         return 1`,
        ["users:by-username", `user:${id}`],
        [username, id, salt, hash],
      );
      if (Number(created) !== 1) return jsonError("Tên tài khoản đã được sử dụng", 409);
      userId = id;
    } else if (action === "login") {
      if (!userId) return jsonError("Sai tên tài khoản hoặc mật khẩu", 401);
      user = await redis.hgetall(`user:${userId}`);
      if (!user?.passwordHash || !(await verifyPassword(password, String(user.passwordSalt), String(user.passwordHash)))) {
        return jsonError("Sai tên tài khoản hoặc mật khẩu", 401);
      }
    } else {
      return jsonError("Action không hợp lệ", 400);
    }

    const userData = await redis.hgetall(`user:${userId}`);
    const token = randomBytes(32).toString("base64url");
    await redis.set(`session:${digest(token)}`, String(userId), { ex: SESSION_SECONDS });
    const response = Response.json({ user: { id: userId, username, balance: Number(userData.balance || 0) } });
    response.headers.append("Set-Cookie", `sim_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_SECONDS}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
    return response;
  } catch (error) {
    return jsonError(error.message || "Không thể đăng nhập", 503);
  }
}

export async function DELETE() {
  return new Response(null, {
    status: 204,
    headers: { "Set-Cookie": "sim_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0" },
  });
}