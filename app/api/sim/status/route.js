import { randomUUID } from "node:crypto";
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
      return Response.json({ status: order.status, phone: order.phone || "", expiresAt: Number(order.expiresAt || 0), otp: order.otp || undefined, balance: Number(balance) });
    }
    if (order.status !== "PENDING") {
      return Response.json({ status: String(order.status), phone: order.phone || "", expiresAt: Number(order.expiresAt || 0) });
    }

    let result = await readProviderStatus(order);
    if (result.status === "PENDING" && Number(order.expiresAt) > 0 && Date.now() >= Number(order.expiresAt)) {
      result = { status: "EXPIRED" };
    }
    if (result.status === "COMPLETED" && result.otp) {
      await redis.eval(COMPLETE_ORDER_SCRIPT, [`order:${orderId}`], [result.otp, Date.now()]);
    } else if (result.status === "EXPIRED") {
      const isNonRefundable = order.service === "sms_combo" || (order.service === "zalo" && (order.zaloStep === "waiting_otp" || order.gateway));
      if (!isNonRefundable) {
        const refundedAt = Date.now();
        const transactionId = randomUUID();
        await redis.eval(
          REFUND_ORDER_SCRIPT,
          [`order:${orderId}`, `user:${user.id}`, `transaction:${transactionId}`, "transactions:all", `user:${user.id}:transactions`, "transactions:type:REFUND"],
          ["EXPIRED", refundedAt, transactionId],
        );
      } else {
        await redis.hset(`order:${orderId}`, {
          status: "EXPIRED",
          updatedAt: Date.now(),
        });
      }
    }
    const updated = await redis.hgetall(`order:${orderId}`);
    const balance = await redis.hget(`user:${user.id}`, "balance");
    return Response.json({
      status: String(updated.status),
      phone: updated.phone || "",
      expiresAt: Number(updated.expiresAt || 0),
      otp: updated.otp || undefined,
      balance: Number(balance),
    });
  } catch (error) {
    return jsonError("Không thể cập nhật phiên thuê lúc này. Vui lòng thử lại sau.", 502);
  }
}