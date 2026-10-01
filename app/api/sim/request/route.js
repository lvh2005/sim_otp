import { randomUUID } from "node:crypto";
import { getSupportedCarriers } from "@/lib/sim-catalog";
import { getProviderServiceIds, getRedis, getServicePrice, getServicePrices, getSessionUser, jsonError, RESERVE_ORDER_SCRIPT, REFUND_ORDER_SCRIPT, startProviderSession } from "@/lib/sim-store";

export async function GET(request) {
  try {
    const user = await getSessionUser(request);
    if (!user) return jsonError("Vui lòng đăng nhập", 401);
    const prices = await getServicePrices(getRedis());
    const provider = process.env.SIM_PROVIDER || "otistx";
    const providerReady = provider === "otistx"
      ? Boolean(process.env.OTISTX_API_KEY)
      : provider === "viotp" && Boolean(process.env.VIOTP_TOKEN);
    const services = getProviderServiceIds(provider);
    let providerMessage = "";
    if (!providerReady) {
      providerMessage = provider === "otistx"
        ? "Chưa cấu hình OTISTX_API_KEY."
        : provider === "viotp"
          ? "Chưa cấu hình VIOTP_TOKEN."
          : "SIM_PROVIDER phải là otistx hoặc viotp.";
    } else if (provider === "viotp" && services.length === 0) {
      providerMessage = "Chưa cấu hình serviceId ViOTP cho dịch vụ nào.";
    }
    return Response.json({ prices, provider, services, providerReady, providerMessage });
  } catch (error) {
    return jsonError(error.message || "Không thể đọc cấu hình thuê SIM", 503);
  }
}

export async function POST(request) {
  let redis;
  let orderId;
  let user;
  try {
    user = await getSessionUser(request);
    if (!user) return jsonError("Vui lòng đăng nhập", 401);
    const body = await request.json();
    const service = String(body.service || process.env.SIM_SERVICE || "otissim_v3");
    const carrier = String(body.carrier || process.env.SIM_CARRIER || "viettel").toLowerCase();
    const provider = process.env.SIM_PROVIDER || "otistx";
    const supportedServices = getProviderServiceIds(provider);
    if (!supportedServices.includes(service)) return jsonError("Dịch vụ chưa được cấu hình cho provider hiện tại", 400);
    if (!getSupportedCarriers(service, provider).includes(carrier)) return jsonError("Nhà mạng không được hỗ trợ cho dịch vụ/provider này", 400);

    redis = getRedis();
    const cost = await getServicePrice(service, redis);
    if (cost === null) return jsonError(`SIM_PRICE_${service.toUpperCase()} hoặc SIM_PRICE_VND chưa được cấu hình hợp lệ`, 503);
    const idempotencyKey = request.headers.get("idempotency-key")?.slice(0, 128) || "";
    if (idempotencyKey) {
      const previousId = await redis.get(`idem:${user.id}:${idempotencyKey}`);
      if (typeof previousId === "string") {
        const previous = await redis.hgetall(`order:${previousId}`);
        if (previous?.id) return Response.json({ orderId: previousId, phone: previous.phone, expiresAt: Number(previous.expiresAt), cost: Number(previous.cost), status: previous.status });
      }
    }

    orderId = randomUUID();
    const now = Date.now();
    const reserve = await redis.eval(
      RESERVE_ORDER_SCRIPT,
      [`user:${user.id}`, `order:${orderId}`, `user:${user.id}:orders`],
      [cost, orderId, user.id, provider, service, carrier, now],
    );
    if (Number(reserve) < 0) return jsonError("Số dư không đủ", 402);

    const session = await startProviderSession({ service, carrier, idempotencyKey });
    await redis.hset(`order:${orderId}`, {
      provider: session.provider,
      providerSessionId: session.sessionId,
      phone: session.phone,
      status: "PENDING",
      expiresAt: session.expiresAt,
    });
    if (idempotencyKey) await redis.set(`idem:${user.id}:${idempotencyKey}`, orderId, { ex: 60 * 60 * 24 });
    const balance = await redis.hget(`user:${user.id}`, "balance");
    return Response.json({ success: true, orderId, phone: session.phone, expiresAt: session.expiresAt, cost, balance: Number(balance), status: "PENDING" });
  } catch (error) {
    if (orderId && user && redis) {
      await redis.eval(REFUND_ORDER_SCRIPT, [`order:${orderId}`, `user:${user.id}`], ["FAILED", Date.now()]).catch(() => null);
    }
    return jsonError(error.message || "Không thể thuê số lúc này", 502);
  }
}