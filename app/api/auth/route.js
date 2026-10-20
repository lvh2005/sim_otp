import { randomBytes, randomUUID } from "node:crypto";
import { getRedis, digest, getSessionUser, hashPassword, jsonError, verifyPassword } from "@/lib/sim-store";
import { isValidVietnameseName, normalizeVietnameseName, generateDepositCode, generateCompactDepositCode } from "@/lib/vietnamese-name";

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
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

    if (action === "login") {
      const rateLimitKey = `rate:login:${ip}:${username}`;
      const attempts = await redis.incr(rateLimitKey);
      if (attempts === 1) await redis.expire(rateLimitKey, 300);
      if (attempts > 15) {
        return jsonError("Bạn đã thử đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 5 phút.", 429);
      }
    } else if (action === "register") {
      const regLimitKey = `rate:reg:${ip}`;
      const count = await redis.incr(regLimitKey);
      if (count === 1) await redis.expire(regLimitKey, 300);
      if (count > 8) {
        return jsonError("Bạn đã tạo tài khoản quá nhiều lần trong thời gian ngắn. Vui lòng thử lại sau 5 phút.", 429);
      }
    }

    let userId = await redis.hget("users:by-username", username);
    let user;

    if (action === "register") {
      const rawFullName = String(body.fullName || "").trim();
      const fullName = normalizeVietnameseName(rawFullName);
      if (!isValidVietnameseName(fullName)) {
        return jsonError("Vui lòng nhập họ và tên thật tiếng Việt không dấu (tối thiểu 2 từ, VD: LE VU HA)", 400);
      }

      const id = randomUUID();
      const depositCode = generateDepositCode(fullName);
      const compactCode = generateCompactDepositCode(fullName);
      const { salt, hash } = await hashPassword(password);

      const created = await redis.eval(
        `if redis.call('HEXISTS', KEYS[1], ARGV[1]) == 1 then return 0 end
         if redis.call('HEXISTS', KEYS[4], ARGV[7]) == 1 then return -2 end
         redis.call('HSET', KEYS[1], ARGV[1], ARGV[2])
         redis.call('HSET', KEYS[2], 'id', ARGV[2], 'username', ARGV[1], 'fullName', ARGV[7], 'balance', '0', 'passwordSalt', ARGV[3], 'passwordHash', ARGV[4], 'createdAt', ARGV[5], 'disabled', '0', 'depositCode', ARGV[6])
         redis.call('HSET', KEYS[3], ARGV[6], ARGV[2])
         redis.call('HSET', KEYS[3], ARGV[8], ARGV[2])
         redis.call('HSET', KEYS[3], ARGV[7], ARGV[2])
         redis.call('HSET', KEYS[4], ARGV[7], ARGV[2])
         return 1`,
        ["users:by-username", `user:${id}`, "users:by-deposit-code", "users:by-fullname"],
        [username, id, salt, hash, Date.now(), depositCode, fullName, compactCode],
      );
      if (Number(created) === 0) return jsonError("Tên tài khoản đã được sử dụng", 409);
      if (Number(created) === -2) return jsonError("Họ và tên này đã được sử dụng trên hệ thống. Vui lòng thêm tên đệm hoặc số phân biệt (VD: LE VU HA 2)", 409);
      if (Number(created) !== 1) return jsonError("Không thể tạo tài khoản lúc này", 503);
      userId = id;
    } else if (action === "login") {
      if (!userId) return jsonError("Sai tên tài khoản hoặc mật khẩu", 401);
      user = await redis.hgetall(`user:${userId}`);
      if (user?.disabled === "1" || user?.disabled === 1) return jsonError("Tài khoản đã bị khóa", 403);
      if (!user?.passwordHash || !(await verifyPassword(password, String(user.passwordSalt), String(user.passwordHash)))) {
        return jsonError("Sai tên tài khoản hoặc mật khẩu", 401);
      }
      await redis.del(`rate:login:${ip}:${username}`).catch(() => null);
    } else {
      return jsonError("Action không hợp lệ", 400);
    }

    const userData = await redis.hgetall(`user:${userId}`);
    const token = randomBytes(32).toString("base64url");
    await redis.set(`session:${digest(token)}`, String(userId), { ex: SESSION_SECONDS });
    const response = Response.json({
      user: {
        id: userId,
        username,
        fullName: userData?.fullName ? String(userData.fullName) : "",
        depositCode: userData?.depositCode ? String(userData.depositCode) : "",
        balance: Number(userData?.balance || 0),
      },
    });
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