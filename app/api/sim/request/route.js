import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { getSupportedCarriers } from "@/lib/sim-catalog";
import { getProviderForService, getProviderServiceIds, getRedis, getServicePrice, getServicePrices, getSessionUser, jsonError, RESERVE_ORDER_SCRIPT, REFUND_ORDER_SCRIPT, startProviderSession, getDisabledServices, sendZaloActivation } from "@/lib/sim-store";

export const maxDuration = 60;

export async function GET(request) {
  try {
    const user = await getSessionUser(request);
    if (!user) return jsonError("Vui lòng đăng nhập", 401);
    const redis = getRedis();
    const prices = await getServicePrices(redis);
    const disabledServices = await getDisabledServices(redis);
    const provider = process.env.SIM_PROVIDER || "otistx";
    const providerReady = Boolean(process.env.OTISTX_API_KEY) || Boolean(process.env.VIOTP_TOKEN) || Boolean(process.env.OTPHUB_TOKEN);
    const allServices = getProviderServiceIds(provider);
    const services = allServices.filter((id) => !disabledServices.includes(id));
    let providerMessage = "";
    if (!providerReady) {
      providerMessage = "Kết nối dịch vụ chưa sẵn sàng. Vui lòng thử lại sau.";
    } else if (services.length === 0) {
      providerMessage = "Chưa có gói SIM khả dụng. Vui lòng thử lại sau.";
    }
    return Response.json({ prices, provider, services, disabledServices, providerReady, providerMessage });
  } catch (error) {
    return jsonError("Không thể tải cấu hình dịch vụ lúc này. Vui lòng thử lại sau.", 503);
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

    if (body.action === "zalo_send") {
      const targetOrderId = String(body.orderId || body.requestId || "").trim();
      if (!targetOrderId) return jsonError("Thiếu mã phiên thuê hoặc requestId", 400);
      const validGateway = body.gateway === "7539" ? "7539" : "8500";
      redis = getRedis();

      const zaloSendLockKey = `lock:zalo_send:${targetOrderId}`;
      const acquiredZaloLock = await redis.set(zaloSendLockKey, "1", { nx: true, ex: 10 });
      if (!acquiredZaloLock) {
        return jsonError("Lệnh gửi tin nhắn Zalo cho số này đang được xử lý, vui lòng chờ.", 429);
      }

      let order = await redis.hgetall(`order:${targetOrderId}`);
      if (!order?.id) {
        const mappedId = await redis.get(`session:order:${targetOrderId}`);
        if (mappedId) {
          order = await redis.hgetall(`order:${mappedId}`);
        }
      }

      if (order?.id && String(order.user_id || order.userId) !== user.id) {
        return jsonError("Không tìm thấy phiên thuê", 404);
      }

      const requestId = order?.providerSessionId || (targetOrderId.startsWith("ZAL") ? targetOrderId : null);
      if (!requestId) return jsonError("Không tìm thấy mã phiên nhà cung cấp", 404);

      const sendResult = await sendZaloActivation({ requestId, gateway: validGateway });
      if (order?.id) {
        await redis.hset(`order:${order.id}`, {
          gateway: validGateway,
          carrier: validGateway,
          zaloStep: "waiting_otp",
        });
      }

      return Response.json({
        success: true,
        status_code: 200,
        orderId: order?.id || targetOrderId,
        requestId,
        gateway: validGateway,
        step: "waiting_otp",
        message: sendResult?.message || `Đã gửi tin nhắn ZALO tới tổng đài ${validGateway} thành công! Đang chờ mã OTP...`,
        data: sendResult?.data || null,
      });
    }

    const service = String(body.service || process.env.SIM_SERVICE || "otissim_v7");
    const carrier = String(body.carrier || process.env.SIM_CARRIER || "random").toLowerCase();
    const recipient = String(body.recipient || "").trim();
    const text = String(body.text || "").trim();
    const provider = process.env.SIM_PROVIDER || "otistx";

    redis = getRedis();
    const disabledServices = await getDisabledServices(redis);
    if (disabledServices.includes(service)) {
      return jsonError("Dịch vụ này hiện đang tạm ngưng trên hệ thống", 400);
    }

    const supportedServices = getProviderServiceIds(provider);
    if (!supportedServices.includes(service)) return jsonError("Dịch vụ chưa được cấu hình cho provider hiện tại", 400);
    if (!getSupportedCarriers(service, provider).includes(carrier)) return jsonError("Nhà mạng/Cổng không được hỗ trợ cho dịch vụ này", 400);

    const cost = await getServicePrice(service, redis);
    if (cost === null || cost <= 0) return jsonError(`SIM_PRICE_${service.toUpperCase()} hoặc SIM_PRICE_VND chưa được cấu hình hợp lệ`, 503);

    const userBalance = Number(user.balance || 0);
    if (userBalance < cost) {
      return jsonError(`Số dư tài khoản không đủ để thực hiện thuê số (${userBalance.toLocaleString("vi-VN")} đ < ${cost.toLocaleString("vi-VN")} đ). Vui lòng nạp thêm tiền.`, 402);
    }

    const idempotencyKey = request.headers.get("idempotency-key")?.slice(0, 128) || "";
    if (idempotencyKey) {
      const previousId = await redis.get(`idem:${user.id}:${idempotencyKey}`);
      if (typeof previousId === "string") {
        const previous = await redis.hgetall(`order:${previousId}`);
        if (previous?.id) return Response.json({ orderId: previousId, phone: previous.phone, expiresAt: Number(previous.expiresAt), cost: Number(previous.cost), status: previous.status });
      }
    }

    const userLockKey = `lock:rent:${user.id}`;
    const acquiredLock = await redis.set(userLockKey, "1", { nx: true, ex: 4 });
    if (!acquiredLock) {
      return jsonError("Yêu cầu thuê số đang được xử lý, vui lòng chờ trong giây lát.", 429);
    }

    orderId = randomUUID();
    const now = Date.now();
    const targetProvider = getProviderForService(service, provider);
    const reserve = await redis.eval(
      RESERVE_ORDER_SCRIPT,
      [
        `user:${user.id}`,
        `order:${orderId}`,
        `user:${user.id}:orders`,
        "orders:all",
        `transaction:${orderId}:charge`,
        "transactions:all",
        `user:${user.id}:transactions`,
        "transactions:type:RENTAL",
      ],
      [cost, orderId, user.id, targetProvider, service, carrier, now, `${orderId}:charge`],
    );
    if (reserve === null || reserve === undefined || Number(reserve) < 0) {
      await redis.del(userLockKey).catch(() => null);
      return jsonError("Số dư không đủ", 402);
    }

    if (idempotencyKey) await redis.set(`idem:${user.id}:${idempotencyKey}`, orderId, { ex: 60 * 60 * 24 });
    const balance = await redis.hget(`user:${user.id}`, "balance");

    const orderKey = `order:${orderId}`;
    await redis.expire(orderKey, 7 * 24 * 60 * 60);

    const userId = user.id;
    if (targetProvider === "gsmotp5s") {
      try {
        const session = await startProviderSession({ service, carrier, idempotencyKey, recipient, text });
        await redis.hset(orderKey, {
          provider: session.provider,
          providerSessionId: session.sessionId,
          phone: session.phone,
          status: "PENDING",
          expiresAt: session.expiresAt,
          zaloStep: session.zaloStep || "waiting_send",
        });
        await redis.set(`session:order:${session.sessionId}`, orderId, { ex: 7 * 24 * 60 * 60 });
        await redis.expire(orderKey, 7 * 24 * 60 * 60);
        return Response.json({
          success: true,
          orderId,
          requestId: session.sessionId,
          phone: session.phone,
          expiresAt: session.expiresAt,
          cost,
          balance: Number(balance),
          status: "PENDING",
          zaloStep: session.zaloStep || "waiting_send",
        });
      } catch (err) {
        console.error("Failed to initialize gsmotp5s rental session:", err);
        const refundedAt = Date.now();
        const transactionId = randomUUID();
        try {
          await redis.eval(
            REFUND_ORDER_SCRIPT,
            [`order:${orderId}`, `user:${userId}`, `transaction:${transactionId}`, "transactions:all", `user:${userId}:transactions`, "transactions:type:REFUND"],
            ["FAILED", refundedAt, transactionId],
          );
        } catch (refundError) {
          console.error("Failed to refund rental after provider error:", refundError);
        }
        return jsonError(err.message || "Không thể khởi tạo phiên thuê số. Vui lòng thử lại sau.", 502);
      }
    }

    after(async () => {
      try {
        const session = await startProviderSession({ service, carrier, idempotencyKey, recipient, text });
        await redis.hset(orderKey, {
          provider: session.provider,
          providerSessionId: session.sessionId,
          phone: session.phone,
          status: "PENDING",
          expiresAt: session.expiresAt,
        });
        await redis.expire(orderKey, 7 * 24 * 60 * 60);
      } catch (error) {
        console.error("Failed to initialize rental session:", error);
        const refundedAt = Date.now();
        const transactionId = randomUUID();
        try {
          await redis.eval(
            REFUND_ORDER_SCRIPT,
            [`order:${orderId}`, `user:${userId}`, `transaction:${transactionId}`, "transactions:all", `user:${userId}:transactions`, "transactions:type:REFUND"],
            ["FAILED", refundedAt, transactionId],
          );
        } catch (refundError) {
          console.error("Failed to refund rental after provider error:", refundError);
        }
      }
    });

    return Response.json({ success: true, orderId, phone: "", expiresAt: 0, cost, balance: Number(balance), status: "REQUESTING" }, { status: 202 });
  } catch (error) {
    if (user && redis) {
      await redis.del(`lock:rent:${user.id}`).catch(() => null);
    }
    if (orderId && user && redis) {
      const refundedAt = Date.now();
      const transactionId = randomUUID();
      await redis.eval(
        REFUND_ORDER_SCRIPT,
        [`order:${orderId}`, `user:${user.id}`, `transaction:${transactionId}`, "transactions:all", `user:${user.id}:transactions`, "transactions:type:REFUND"],
        ["FAILED", refundedAt, transactionId],
      ).catch(() => null);
    }
    return jsonError(error.message || "Không thể tạo phiên thuê lúc này. Vui lòng thử lại sau.", 502);
  }
}