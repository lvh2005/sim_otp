import { randomUUID } from "node:crypto";
import { getRedis, getSessionUser, jsonError, cancelProviderSession, REFUND_ORDER_SCRIPT } from "@/lib/sim-store";

export async function POST(request) {
  try {
    const user = await getSessionUser(request);
    if (!user) return jsonError("Vui lòng đăng nhập", 401);

    const body = await request.json().catch(() => ({}));
    const url = new URL(request.url);
    const orderId = body.orderId || url.searchParams.get("orderId");
    if (!orderId || !/^[a-f0-9-]{36}$/i.test(orderId)) return jsonError("orderId không hợp lệ", 400);

    const redis = getRedis();
    const order = await redis.hgetall(`order:${orderId}`);
    if (!order?.id || String(order.user_id) !== user.id) return jsonError("Không tìm thấy đơn hàng", 404);

    if (order.status !== "PENDING" && order.status !== "REQUESTING") {
      return jsonError("Đơn hàng không ở trạng thái có thể hủy hoặc đã hoàn tất", 400);
    }

    const isNonRefundable = order.service === "sms_combo" || (order.service === "zalo" && (order.zaloStep === "waiting_otp" || order.gateway));
    if (isNonRefundable) {
      return jsonError("Dịch vụ này không hỗ trợ hủy và hoàn tiền vì SIM đã gửi tin nhắn đi.", 400);
    }

    // Call provider cancel API if available (e.g. OtpHub)
    await cancelProviderSession(order);

    // Refund immediately back to user's balance
    const refundedAt = Date.now();
    const transactionId = randomUUID();
    const refunded = await redis.eval(
      REFUND_ORDER_SCRIPT,
      [`order:${orderId}`, `user:${user.id}`, `transaction:${transactionId}`, "transactions:all", `user:${user.id}:transactions`, "transactions:type:REFUND"],
      ["EXPIRED", refundedAt, transactionId],
    );

    const balance = await redis.hget(`user:${user.id}`, "balance");
    return Response.json({
      success: true,
      message: refunded ? "Hủy số thành công, tiền đã được hoàn lại vào ví." : "Đã hủy phiên thuê.",
      status: "EXPIRED",
      balance: Number(balance),
    });
  } catch (error) {
    return jsonError(error.message || "Không thể hủy đơn hàng lúc này.", 500);
  }
}

export async function GET() {
  return jsonError("Phương thức không được hỗ trợ. Vui lòng sử dụng POST.", 405);
}
