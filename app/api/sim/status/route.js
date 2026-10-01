import { getRedis, getSessionUser, jsonError, readProviderStatus, REFUND_ORDER_SCRIPT, COMPLETE_ORDER_SCRIPT } from "@/lib/sim-store";

export async function GET(request) {
  try {
    const user = await getSessionUser(request);
    if (!user) return jsonError("Vui lòng đăng nhập", 401);
    const orderId = new URL(request.url).searchParams.get("orderId");
    if (!orderId || !/^[a-f0-9-]{36}$/i.test(orderId)) return jsonError("orderId không hợp lệ", 400);

    const redis = getRedis();
    const order = await redis.hgetall(`order:${orderId}`);
    if (!order?.id || String(order.user_id) !== user.id) return jsonError("Không tìm thấy đơn hàng", 404);
    if (["COMPLETED", "EXPIRED", "FAILED"].includes(String(order.status))) {
      const balance = await redis.hget(`user:${user.id}`, "balance");
      return Response.json({ status: order.status, otp: order.otp || undefined, balance: Number(balance) });
    }
    if (order.status !== "PENDING") return Response.json({ status: String(order.status) });

    let result = await readProviderStatus(order);
    if (result.status === "PENDING" && Number(order.expiresAt) > 0 && Date.now() >= Number(order.expiresAt)) {
      result = { status: "EXPIRED" };
    }
    if (result.status === "COMPLETED" && result.otp) {
      await redis.eval(COMPLETE_ORDER_SCRIPT, [`order:${orderId}`], [result.otp, Date.now()]);
    } else if (result.status === "EXPIRED") {
      await redis.eval(REFUND_ORDER_SCRIPT, [`order:${orderId}`, `user:${user.id}`], ["EXPIRED", Date.now()]);
    }
    const updated = await redis.hgetall(`order:${orderId}`);
    const balance = await redis.hget(`user:${user.id}`, "balance");
    return Response.json({ status: String(updated.status), otp: updated.otp || undefined, balance: Number(balance) });
  } catch (error) {
    return jsonError(error.message || "Không thể kiểm tra OTP", 502);
  }
}