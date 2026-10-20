import { getRedis, getSessionUser, jsonError, REFUND_ORDER_SCRIPT, readProviderStatus, COMPLETE_ORDER_SCRIPT, cleanupExpiredOrders } from "@/lib/sim-store";

export async function GET(request) {
  try {
    const user = await getSessionUser(request);
    if (!user) return jsonError("Vui lòng đăng nhập", 401);

    const redis = getRedis();
    await cleanupExpiredOrders(redis, user.id);
    const url = new URL(request.url);
    const filterStatus = String(url.searchParams.get("status") || "").toUpperCase();
    const query = String(url.searchParams.get("q") || "").trim().toLowerCase();
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 30)));
    const offset = (page - 1) * limit;

    // Get order IDs for this specific user
    const orderIds = await redis.zrange(`user:${user.id}:orders`, 0, -1, { rev: true });

    if (!orderIds || orderIds.length === 0) {
      const balance = Number(await redis.hget(`user:${user.id}`, "balance") || 0);
      return Response.json({ orders: [], total: 0, page, limit, balance });
    }

    const rawOrders = await Promise.all(
      orderIds.map(async (id) => {
        const order = await redis.hgetall(`order:${id}`);
        if (!order?.id) return null;

        let status = String(order.status || "UNKNOWN");
        let otp = String(order.otp || "");
        const expiresAt = Number(order.expiresAt || 0);

        // Auto-check or expire pending orders if needed
        if (status === "PENDING" && expiresAt > 0 && Date.now() >= expiresAt) {
          const isNonRefundable = order.service === "sms_combo" || (order.service === "zalo" && (order.zaloStep === "waiting_otp" || order.gateway));
          try {
            if (!isNonRefundable) {
              await redis.eval(
                REFUND_ORDER_SCRIPT,
                [
                  `order:${id}`,
                  `user:${user.id}`,
                  `transaction:${id}:refund`,
                  "transactions:all",
                  `user:${user.id}:transactions`,
                  "transactions:type:REFUND",
                ],
                ["EXPIRED", Date.now(), `${id}:refund`],
              );
            } else {
              await redis.hset(`order:${id}`, { status: "EXPIRED", updatedAt: Date.now() });
            }
            status = "EXPIRED";
          } catch {
            // Ignore error
          }
        }

        return {
          id: String(order.id),
          phone: String(order.phone || ""),
          service: String(order.service || ""),
          carrier: String(order.carrier || ""),
          cost: Number(order.cost || 0),
          status,
          otp,
          createdAt: Number(order.createdAt || 0),
          expiresAt,
        };
      })
    );

    const validOrders = rawOrders.filter(Boolean);

    const filtered = validOrders.filter((order) => {
      if (filterStatus && filterStatus !== "ALL" && order.status !== filterStatus) {
        return false;
      }
      if (query) {
        const matchPhone = order.phone.toLowerCase().includes(query);
        const matchService = order.service.toLowerCase().includes(query);
        const matchCarrier = order.carrier.toLowerCase().includes(query);
        const matchOtp = order.otp.toLowerCase().includes(query);
        const matchId = order.id.toLowerCase().includes(query);
        if (!matchPhone && !matchService && !matchCarrier && !matchOtp && !matchId) {
          return false;
        }
      }
      return true;
    });

    const paginatedOrders = filtered.slice(offset, offset + limit);
    const balance = Number(await redis.hget(`user:${user.id}`, "balance") || 0);

    return Response.json({
      orders: paginatedOrders,
      total: filtered.length,
      page,
      limit,
      balance,
    });
  } catch (error) {
    console.error("Orders API Error:", error);
    return jsonError("Không thể tải lịch sử thuê số lúc này", 500);
  }
}
