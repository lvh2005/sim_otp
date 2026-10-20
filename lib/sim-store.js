import { Redis } from "@upstash/redis";
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { SIM_SERVICE_CATALOG, SIM_SERVICES } from "@/lib/sim-catalog";

const scrypt = promisify(scryptCallback);
let redisInstance;

export function getRedis() {
  if (!redisInstance) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) throw new Error("Upstash Redis environment is not configured");
    redisInstance = new Redis({ url, token });
  }
  return redisInstance;
}

export function jsonError(message, status) {
  return Response.json({ error: message }, { status });
}

export { SIM_SERVICES };

export async function getEffectiveApiConfig(redis = getRedis()) {
  try {
    const raw = await redis.hgetall("config:api:settings");
    const depositEnabled = raw?.deposit_enabled !== undefined
      ? (raw.deposit_enabled === "true" || raw.deposit_enabled === true || raw.deposit_enabled === "1" || raw.deposit_enabled === 1)
      : (process.env.DEPOSIT_ENABLED !== undefined ? process.env.DEPOSIT_ENABLED !== "false" && process.env.DEPOSIT_ENABLED !== "0" : true);

    return {
      deposit_enabled: depositEnabled,
      deposit_support_telegram: raw?.deposit_support_telegram || process.env.DEPOSIT_SUPPORT_TELEGRAM || "Vuha_cute_dapxe_trenpho",
      deposit_disabled_notice: raw?.deposit_disabled_notice || "Cổng nạp tiền tự động VietQR đang tạm dừng để bảo trì. Quý khách vui lòng liên hệ Telegram hỗ trợ để nạp tiền trực tiếp!",
      otphub_base_url: raw?.otphub_base_url || process.env.OTPHUB_BASE_URL || "https://otphubtl.vercel.app",
      otphub_token: raw?.otphub_token || process.env.OTPHUB_TOKEN || "f6c8cb1a9f0b6a082760e8643fbe7992",
      otphub_shopee_service_id: raw?.otphub_shopee_service_id || process.env.OTPHUB_SHOPEE_SERVICE_ID || "shopee",
      gsmotp5s_base_url: raw?.gsmotp5s_base_url || process.env.GSMOTP5S_BASE_URL || "https://gsmotp5s.site",
      gsmotp5s_token: raw?.gsmotp5s_token || process.env.GSMOTP5S_TOKEN || raw?.otphub_token || process.env.OTPHUB_TOKEN || "f6c8cb1a9f0b6a082760e8643fbe7992",
      viotp_token: raw?.viotp_token || process.env.VIOTP_TOKEN || "",
      viotp_shopee_service_id: raw?.viotp_shopee_service_id || process.env.VIOTP_SHOPEE_SERVICE_ID || "4",
      viotp_tiktok_service_id: raw?.viotp_tiktok_service_id || process.env.VIOTP_TIKTOK_SERVICE_ID || "29",
      otistx_api_key: raw?.otistx_api_key || process.env.OTISTX_API_KEY || "",
      sim_provider: raw?.sim_provider || process.env.SIM_PROVIDER || "otistx",
      sim_service: raw?.sim_service || process.env.SIM_SERVICE || "otissim_v8",
      sim_carrier: raw?.sim_carrier || process.env.SIM_CARRIER || "random",
      sepay_bank_name: raw?.sepay_bank_name || process.env.SEPAY_BANK_NAME || "TPBank",
      sepay_account_number: raw?.sepay_account_number || process.env.SEPAY_ACCOUNT_NUMBER || "10005790882",
      sepay_account_name: raw?.sepay_account_name || process.env.SEPAY_ACCOUNT_NAME || "LE VU HA",
      sepay_min_deposit_vnd: Number(raw?.sepay_min_deposit_vnd || process.env.SEPAY_MIN_DEPOSIT_VND || 10000),
      sepay_webhook_api_key: raw?.sepay_webhook_api_key || process.env.SEPAY_WEBHOOK_API_KEY || "",
    };
  } catch {
    const depositEnabled = process.env.DEPOSIT_ENABLED !== undefined ? process.env.DEPOSIT_ENABLED !== "false" && process.env.DEPOSIT_ENABLED !== "0" : true;
    return {
      deposit_enabled: depositEnabled,
      deposit_support_telegram: process.env.DEPOSIT_SUPPORT_TELEGRAM || "Vuha_cute_dapxe_trenpho",
      deposit_disabled_notice: "Cổng nạp tiền tự động VietQR đang tạm dừng để bảo trì. Quý khách vui lòng liên hệ Telegram hỗ trợ để nạp tiền trực tiếp!",
      otphub_base_url: process.env.OTPHUB_BASE_URL || "https://otphubtl.vercel.app",
      otphub_token: process.env.OTPHUB_TOKEN || "f6c8cb1a9f0b6a082760e8643fbe7992",
      otphub_shopee_service_id: process.env.OTPHUB_SHOPEE_SERVICE_ID || "shopee",
      gsmotp5s_base_url: process.env.GSMOTP5S_BASE_URL || "https://gsmotp5s.site",
      gsmotp5s_token: process.env.GSMOTP5S_TOKEN || process.env.OTPHUB_TOKEN || "f6c8cb1a9f0b6a082760e8643fbe7992",
      viotp_token: process.env.VIOTP_TOKEN || "",
      viotp_shopee_service_id: process.env.VIOTP_SHOPEE_SERVICE_ID || "4",
      viotp_tiktok_service_id: process.env.VIOTP_TIKTOK_SERVICE_ID || "29",
      otistx_api_key: process.env.OTISTX_API_KEY || "",
      sim_provider: process.env.SIM_PROVIDER || "otistx",
      sim_service: process.env.SIM_SERVICE || "otissim_v8",
      sim_carrier: process.env.SIM_CARRIER || "random",
      sepay_bank_name: process.env.SEPAY_BANK_NAME || "TPBank",
      sepay_account_number: process.env.SEPAY_ACCOUNT_NUMBER || "10005790882",
      sepay_account_name: process.env.SEPAY_ACCOUNT_NAME || "LE VU HA",
      sepay_min_deposit_vnd: Number(process.env.SEPAY_MIN_DEPOSIT_VND || 10000),
      sepay_webhook_api_key: process.env.SEPAY_WEBHOOK_API_KEY || "",
    };
  }
}

export async function saveEffectiveApiConfig(data, redis = getRedis()) {
  const current = await getEffectiveApiConfig(redis);
  const updated = {
    ...current,
    ...data,
  };
  if (data.deposit_enabled !== undefined) {
    updated.deposit_enabled = (data.deposit_enabled === true || data.deposit_enabled === "true" || data.deposit_enabled === 1 || data.deposit_enabled === "1") ? "true" : "false";
  }
  await redis.hset("config:api:settings", updated);
  return {
    ...updated,
    deposit_enabled: updated.deposit_enabled === "true" || updated.deposit_enabled === true,
  };
}

export function getViotpServiceId(service, config = null) {
  if (service === "otissim_v7" && config?.viotp_shopee_service_id) return config.viotp_shopee_service_id;
  if (service === "simotp_tiktok_v1" && config?.viotp_tiktok_service_id) return config.viotp_tiktok_service_id;
  const configuredId = process.env[`VIOTP_SERVICE_ID_${service.toUpperCase()}`];
  if (configuredId) return configuredId;
  if (service === "otissim_v7") return process.env.VIOTP_SHOPEE_SERVICE_ID || "4";
  if (service === "simotp_tiktok_v1") return process.env.VIOTP_TIKTOK_SERVICE_ID || "29";
  const defaultService = process.env.SIM_SERVICE || "otissim_v3";
  return service === defaultService ? (process.env.VIOTP_SHOPEE_SERVICE_ID || "4") : undefined;
}

export function getOtphubServiceId(service, config = null) {
  if (config?.otphub_shopee_service_id) return config.otphub_shopee_service_id;
  const configuredId = process.env[`OTPHUB_SERVICE_ID_${service.toUpperCase()}`];
  if (configuredId) return configuredId;
  if (service === "otissim_v8") return process.env.OTPHUB_SHOPEE_SERVICE_ID || "shopee";
  return "shopee";
}

export function getProviderForService(service, defaultProvider = process.env.SIM_PROVIDER || "otistx") {
  if (service === "zalo" || service === "zalo_create" || service === "shopee_f02" || service === "sms_combo") return "gsmotp5s";
  if (service === "otissim_v8" || service === "simotp_v8_vip") return "otphub";
  if (service === "otissim_v7" || service === "simotp_tiktok_v1") return "viotp";
  return defaultProvider;
}

export function getProviderServiceIds(provider) {
  const gsmServices = ["otissim_v8", "shopee_f02", "sms_combo", "zalo"];
  if (provider === "otistx") {
    const list = process.env.OTISTX_API_KEY ? SIM_SERVICES.filter(id => id !== "otissim_v7" && id !== "simotp_tiktok_v1" && id !== "otissim_v8" && id !== "shopee_f02" && id !== "sms_combo" && id !== "zalo") : [];
    if (process.env.VIOTP_TOKEN) {
      list.push("otissim_v7", "simotp_tiktok_v1");
    }
    list.push(...gsmServices);
    return list;
  }
  if (provider === "viotp") {
    if (!process.env.VIOTP_TOKEN) return [];
    const list = SIM_SERVICE_CATALOG
      .filter(({ id }) => getViotpServiceId(id))
      .map(({ id }) => id);
    list.push(...gsmServices);
    return list;
  }
  if (provider === "otphub" || provider === "gsmotp5s") {
    return gsmServices;
  }
  return [];
}

export async function getDisabledServices(redis = getRedis()) {
  try {
    const raw = await redis.get("config:sim:disabled_services");
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  } catch {
    return [];
  }
}

export async function setDisabledServices(disabledList, redis = getRedis()) {
  const normalized = Array.isArray(disabledList) ? disabledList.filter((id) => typeof id === "string") : [];
  await redis.set("config:sim:disabled_services", JSON.stringify(normalized));
  return normalized;
}

export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function cleanupExpiredOrders(redis = getRedis(), userId = null) {
  try {
    const cutoff = Date.now() - SEVEN_DAYS_MS;
    if (userId) {
      const oldUserOrderIds = await redis.zrangebyscore(`user:${userId}:orders`, "-inf", cutoff);
      if (oldUserOrderIds && oldUserOrderIds.length > 0) {
        await Promise.all(oldUserOrderIds.map((id) => redis.del(`order:${id}`)));
        await redis.zremrangebyscore(`user:${userId}:orders`, "-inf", cutoff);
      }
    }
    const oldAllOrderIds = await redis.zrangebyscore("orders:all", "-inf", cutoff);
    if (oldAllOrderIds && oldAllOrderIds.length > 0) {
      await Promise.all(oldAllOrderIds.map((id) => redis.del(`order:${id}`)));
      await redis.zremrangebyscore("orders:all", "-inf", cutoff);
    }
  } catch (err) {
    console.warn("Auto cleanup of 7-day orders encountered error:", err.message);
  }
}

export async function getServicePrices(redis = getRedis()) {
  const storedPrices = await redis.hgetall("config:sim:prices") || {};
  return Object.fromEntries(SIM_SERVICES.map((service) => {
    const configured = storedPrices[service]
      ?? process.env[`SIM_PRICE_${service.toUpperCase()}`]
      ?? (service === "otissim_v7" ? "8000" : null)
      ?? (service === "otissim_v8" ? "8000" : null)
      ?? (service === "shopee_f02" ? "6000" : null)
      ?? (service === "sms_combo" ? "6000" : null)
      ?? (service === "zalo" ? "5000" : null)
      ?? (service === "simotp_tiktok_v1" ? "5000" : null)
      ?? process.env.SIM_PRICE_VND;
    const price = Number(configured);
    return [service, Number.isSafeInteger(price) && price > 0 ? price : 5000];
  }));
}

export async function getServicePrice(service, redis = getRedis()) {
  const prices = await getServicePrices(redis);
  return prices[service] ?? 8000;
}

export function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function safeEqual(left, right) {
  const leftHash = createHash("sha256").update(String(left || "")).digest();
  const rightHash = createHash("sha256").update(String(right || "")).digest();
  return timingSafeEqual(leftHash, rightHash);
}

export async function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const key = await scrypt(password, salt, 64);
  return { salt, hash: Buffer.from(key).toString("hex") };
}

export async function verifyPassword(password, salt, expectedHash) {
  const { hash } = await hashPassword(password, salt);
  return safeEqual(hash, expectedHash);
}

export async function getSessionUser(request) {
  const redis = getRedis();
  const token = request.cookies?.get("sim_session")?.value;
  let userId = null;

  if (token) {
    userId = await redis.get(`session:${digest(token)}`);
  }

  if (!userId) {
    const rawApiKey = request.headers.get("x-api-key")
      || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
      || "";
    const apiKey = rawApiKey.trim();
    if (apiKey && apiKey.startsWith("sotp_")) {
      userId = await redis.hget("users:by-api-key", apiKey);
    }
  }

  if (typeof userId !== "string" || !userId) return null;
  const user = await redis.hgetall(`user:${userId}`);
  if (!user?.id || user.disabled === "1" || user.disabled === 1) return null;
  return {
    id: String(user.id),
    username: String(user.username),
    fullName: user.fullName ? String(user.fullName) : "",
    depositCode: user.depositCode ? String(user.depositCode) : "",
    balance: Number(user.balance || 0),
  };
}

export async function providerRequest(path, options = {}, specificProvider, timeoutMs = 6500) {
  let config = {};
  try {
    config = await getEffectiveApiConfig();
  } catch (_) {}
  const provider = specificProvider || config.sim_provider || process.env.SIM_PROVIDER || "otistx";
  const timeout = AbortSignal.timeout(timeoutMs);

  if (provider === "otistx") {
    const apiKey = config.otistx_api_key || process.env.OTISTX_API_KEY;
    if (!apiKey) throw new Error("OTISTX_API_KEY is not configured");
    const response = await fetch(`https://otistx.com/api/phone-rental/${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", "X-API-Key": apiKey, ...options.headers },
      signal: timeout,
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || data.error || "Không thể kết nối dịch vụ thuê SIM.");
    return { provider, data };
  }

  if (provider === "viotp") {
    const token = config.viotp_token || process.env.VIOTP_TOKEN || "5abec70115c70ebb685169fe7dd985e7";
    if (!token) throw new Error("VIOTP_TOKEN is not configured");
    const url = new URL(`https://api.viotp.com/${path}`);
    url.searchParams.set("token", token);
    for (const [key, value] of Object.entries(options.params || {})) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, value);
      }
    }
    const response = await fetch(url, { signal: timeout, cache: "no-store" });
    const data = await response.json();
    if (!response.ok || (data.status_code !== 200 && data.status_code !== undefined && data.status_code !== 0)) {
      let errMsg = data.message || "Không thể kết nối dịch vụ thuê SIM ViOTP.";
      if (data.status_code === -2 || errMsg.toLowerCase().includes("số dư")) {
        errMsg = "kho số đang tạm hết.";
      } else if (data.status_code === -3 || errMsg.toLowerCase().includes("hết")) {
        errMsg = "Kho số cho dịch vụ này đang tạm hết, vui lòng thử lại sau ít phút.";
      }
      throw new Error(errMsg);
    }
    return { provider, data };
  }

  if (provider === "otphub") {
    const token = config.otphub_token || process.env.OTPHUB_TOKEN || "f6c8cb1a9f0b6a082760e8643fbe7992";
    if (!token) throw new Error("OTPHUB_TOKEN is not configured");
    const baseUrl = (config.otphub_base_url || process.env.OTPHUB_BASE_URL || "https://otphubtl.vercel.app").replace(/\/$/, "");
    const cleanPath = path.replace(/^\//, "");
    const url = new URL(`${baseUrl}/${cleanPath}`);
    url.searchParams.set("token", token);
    for (const [key, value] of Object.entries(options.params || {})) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, value);
      }
    }
    const response = await fetch(url, {
      method: options.method || "GET",
      signal: timeout,
      cache: "no-store",
      headers: options.headers,
      body: options.body,
    });
    const data = await response.json();
    if (!response.ok || (data.status_code !== 200 && data.status_code !== undefined && data.status_code !== 0)) {
      let errMsg = data.message || "Không thể kết nối dịch vụ thuê SIM OtpHub VIP.";
      if (data.status_code === -2 || errMsg.toLowerCase().includes("số dư")) {
        errMsg = "Kho số hoặc số dư nhà cung cấp đang tạm hết.";
      } else if (data.status_code === -3 || errMsg.toLowerCase().includes("hết")) {
        errMsg = "Kho số cho dịch vụ này đang tạm hết, vui lòng thử lại sau.";
      }
      throw new Error(errMsg);
    }
    return { provider, data };
  }

  throw new Error("SIM_PROVIDER must be valid");
}

export async function getProviderBalances() {
  let config = {};
  try {
    config = await getEffectiveApiConfig();
  } catch (_) {}

  const result = {
    otistx: { configured: false, balance: null, error: null },
    viotp: { configured: false, balance: null, error: null },
    otphub: { configured: false, balance: null, error: null },
  };

  const otistxKey = config.otistx_api_key || process.env.OTISTX_API_KEY;
  if (otistxKey) {
    result.otistx.configured = true;
    try {
      const timeout = AbortSignal.timeout(6000);
      const res = await fetch("https://otistx.com/api/user/balance", {
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": otistxKey,
        },
        signal: timeout,
        cache: "no-store",
      });
      const data = await res.json();
      if (typeof data === "number") {
        result.otistx.balance = data;
      } else if (data && typeof data.balance === "number") {
        result.otistx.balance = data.balance;
      } else if (typeof data === "string" && !isNaN(Number(data))) {
        result.otistx.balance = Number(data);
      } else {
        result.otistx.error = data?.message || "Không đọc được số dư";
      }
    } catch (err) {
      result.otistx.error = err.message || "Lỗi kết nối Ox";
    }
  }

  const viotpToken = config.viotp_token || process.env.VIOTP_TOKEN;
  if (viotpToken) {
    result.viotp.configured = true;
    try {
      const timeout = AbortSignal.timeout(6000);
      const res = await fetch(`https://api.viotp.com/users/balance?token=${viotpToken}`, {
        signal: timeout,
        cache: "no-store",
      });
      const data = await res.json();
      if (data?.status_code === 200 && data?.data?.balance !== undefined) {
        result.viotp.balance = Number(data.data.balance);
      } else {
        result.viotp.error = data?.message || "Không đọc được số dư";
      }
    } catch (err) {
      result.viotp.error = err.message || "Lỗi kết nối VP";
    }
  }

  const otphubToken = config.otphub_token || process.env.OTPHUB_TOKEN || "f6c8cb1a9f0b6a082760e8643fbe7992";
  if (otphubToken) {
    result.otphub.configured = true;
    try {
      const timeout = AbortSignal.timeout(6000);
      const baseUrl = (config.otphub_base_url || process.env.OTPHUB_BASE_URL || "https://otphubtl.vercel.app").replace(/\/$/, "");
      const res = await fetch(`${baseUrl}/users/balance?token=${otphubToken}`, {
        signal: timeout,
        cache: "no-store",
      });
      const data = await res.json();
      if (data?.status_code === 200 && data?.data?.balance !== undefined) {
        result.otphub.balance = Number(data.data.balance);
      } else {
        result.otphub.error = data?.message || "Không đọc được số dư";
      }
    } catch (err) {
      result.otphub.error = err.message || "Lỗi kết nối OtpHub VIP";
    }
  }

  return result;
}

export async function startProviderSession({ service, carrier, idempotencyKey, recipient, text }) {
  let config = {};
  try {
    config = await getEffectiveApiConfig();
  } catch (_) {}

  const defaultProvider = config.sim_provider || process.env.SIM_PROVIDER || "otistx";
  const provider = getProviderForService(service, defaultProvider);

  if (provider === "gsmotp5s" || service === "zalo" || service === "shopee_f02" || service === "sms_combo") {
    const token = config.gsmotp5s_token || config.otphub_token || process.env.GSMOTP5S_TOKEN || process.env.OTPHUB_TOKEN || "f6c8cb1a9f0b6a082760e8643fbe7992";
    const baseUrl = (config.gsmotp5s_base_url || "https://gsmotp5s.site").replace(/\/$/, "");
    const timeout = AbortSignal.timeout(service === "sms_combo" ? 50000 : 30000);

    try {
      if (service === "zalo" || service === "zalo_create") {
        const url = new URL(`${baseUrl}/zalo/create`);
        url.searchParams.set("token", token);

        const response = await fetch(url, { signal: timeout, cache: "no-store" });
        const data = await response.json();
        if (!response.ok || data.status_code !== 200 || !data.data?.request_id) {
          throw new Error(data.message || "Không thể khởi tạo phiên thuê số Zalo.");
        }
        return {
          provider: "gsmotp5s",
          sessionId: String(data.data.request_id),
          phone: String(data.data.phone_number),
          expiresAt: Date.now() + 300000,
          zaloStep: "waiting_send",
        };
      }

      if (service === "shopee_f02") {
        const url = new URL(`${baseUrl}/request/getv2`);
        url.searchParams.set("serviceId", "shopee_f02");
        url.searchParams.set("token", token);
        if (carrier && carrier !== "random") {
          const networkMap = {
            viettel: "VIETTEL",
            vinaphone: "VINAPHONE",
            mobifone: "MOBIFONE",
            vnmb: "VIETNAMOBILE",
            itel: "ITELECOM",
            wintel: "WINTEL",
          };
          if (networkMap[carrier]) {
            url.searchParams.set("network", networkMap[carrier]);
          }
        }

        const response = await fetch(url, { signal: timeout, cache: "no-store" });
        const data = await response.json();
        if (!response.ok || data.status_code !== 200 || !data.data?.request_id) {
          throw new Error(data.message || "Không thể khởi tạo phiên Shopee Đá Số (Chỉ F02).");
        }
        return {
          provider: "gsmotp5s",
          sessionId: String(data.data.request_id),
          phone: String(data.data.phone_number),
          expiresAt: Date.now() + 360000,
        };
      }

      if (service === "sms_combo") {
        const targetRecipient = (recipient || "").trim() || "19001221";
        const targetText = (text || "").trim() || "DK";
        const url = new URL(`${baseUrl}/sms/send`);
        url.searchParams.set("recipient", targetRecipient);
        url.searchParams.set("text", targetText);
        url.searchParams.set("token", token);

        const response = await fetch(url, { signal: timeout, cache: "no-store" });
        const data = await response.json();
        if (!response.ok || data.status_code !== 200 || !data.data?.request_id) {
          throw new Error(data.message || "Không thể khởi tạo phiên Gửi SMS & Nhận OTP.");
        }
        return {
          provider: "gsmotp5s",
          sessionId: String(data.data.request_id),
          phone: String(data.data.phone_number),
          expiresAt: Date.now() + 360000,
        };
      }
    } catch (err) {
      if (err.name === "AbortError" || err.message?.includes("timeout") || err.message?.includes("aborted")) {
        throw new Error("Modem gửi tin nhắn SMS bị quá thời gian chờ (timeout). Cổng modem đang bận hoặc tín hiệu mạng yếu, vui lòng thử lại!");
      }
      throw err;
    }
  }

  if (provider === "otistx") {
    const { data } = await providerRequest("start", {
      method: "POST",
      headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {},
      body: JSON.stringify({ service, carrier }),
    }, "otistx");
    if (!data.sessionId || !data.phoneNumber) throw new Error("Không thể tạo phiên thuê. Vui lòng chọn gói khác.");
    return {
      provider,
      sessionId: String(data.sessionId),
      phone: String(data.phoneNumber),
      expiresAt: data.expiresAt ? new Date(data.expiresAt).getTime() : Date.now() + 360000,
    };
  }

  if (provider === "viotp") {
    const serviceId = getViotpServiceId(service, config) || "2";
    const networkMap = {
      viettel: "VIETTEL",
      vinaphone: "VINAPHONE",
      mobifone: "MOBIFONE",
      vnmb: "VIETNAMOBILE",
      itel: "ITELECOM",
      wintel: "WINTEL",
    };
    const network = networkMap[carrier];
    const params = {
      serviceId,
      country: "vn",
    };
    if (network) {
      params.network = network;
    }
    const { data } = await providerRequest("request/getv2", {
      params,
    }, "viotp");

    if (!data.data?.request_id || (!data.data?.phone_number && !data.data?.re_phone_number)) {
      const errMsg = data.message || (data.status_code === -2 ? "Kho số đang tạm hết" : data.status_code === -3 ? "Kho số tạm hết, vui lòng thử lại sau" : "Không thể tạo phiên thuê số.");
      throw new Error(errMsg);
    }

    let phone = String(data.data.phone_number || data.data.re_phone_number);
    if (!phone.startsWith("0") && !phone.startsWith("84") && phone.length === 9) {
      phone = `0${phone}`;
    } else if (phone.startsWith("84") && phone.length === 11) {
      phone = `0${phone.slice(2)}`;
    }

    return {
      provider: "viotp",
      sessionId: String(data.data.request_id),
      phone,
      expiresAt: Date.now() + 360000,
    };
  }

  if (provider === "otphub") {
    const serviceId = getOtphubServiceId(service, config) || "shopee";
    const networkMap = {
      viettel: "VIETTEL",
      vinaphone: "VINAPHONE",
      mobifone: "MOBIFONE",
      vnmb: "VIETNAMOBILE",
      itel: "ITELECOM",
      wintel: "WINTEL",
    };
    const network = networkMap[carrier];
    const params = {
      serviceId,
    };
    if (network) {
      params.network = network;
    }
    const { data } = await providerRequest("request/getv2", {
      params,
    }, "otphub", 25000);

    const resData = data.data || {};
    const requestId = resData.request_id || resData.ID;
    const rawPhone = resData.phone_number || resData.Phone || resData.re_phone_number;

    if (!requestId || !rawPhone) {
      const errMsg = data.message || (data.status_code === -2 ? "Kho số đang tạm hết" : data.status_code === -3 ? "Kho số tạm hết, vui lòng thử lại sau" : "Không thể tạo phiên thuê số OtpHub VIP.");
      throw new Error(errMsg);
    }

    let phone = String(rawPhone);
    if (!phone.startsWith("0") && !phone.startsWith("84") && phone.length === 9) {
      phone = `0${phone}`;
    } else if (phone.startsWith("84") && phone.length === 11) {
      phone = `0${phone.slice(2)}`;
    }

    return {
      provider: "otphub",
      sessionId: String(requestId),
      phone,
      expiresAt: Date.now() + 360000,
    };
  }

  throw new Error("Provider không hợp lệ");
}

export async function sendZaloActivation({ requestId, gateway = "8500" }) {
  let config = {};
  try { config = await getEffectiveApiConfig(); } catch (_) {}
  const token = config.gsmotp5s_token || config.otphub_token || process.env.GSMOTP5S_TOKEN || process.env.OTPHUB_TOKEN || "f6c8cb1a9f0b6a082760e8643fbe7992";
  const baseUrl = (config.gsmotp5s_base_url || "https://gsmotp5s.site").replace(/\/$/, "");
  const timeout = AbortSignal.timeout(50000);

  const url = new URL(`${baseUrl}/zalo/send`);
  url.searchParams.set("requestId", requestId);
  url.searchParams.set("gateway", gateway === "7539" ? "7539" : "8500");
  url.searchParams.set("token", token);

  try {
    const response = await fetch(url, { signal: timeout, cache: "no-store" });
    const data = await response.json();
    if (!response.ok || data.status_code !== 200) {
      throw new Error(data.message || "Không thể gửi tin nhắn ZALO tới tổng đài.");
    }
    return data;
  } catch (err) {
    if (err.name === "AbortError" || err.message?.includes("timeout") || err.message?.includes("aborted")) {
      throw new Error("Modem gửi tin nhắn SMS kích hoạt bị quá thời gian chờ (timeout). Cổng modem đang bận hoặc tín hiệu mạng yếu, vui lòng thử lại hoặc chọn cổng khác.");
    }
    throw err;
  }
}

export async function readProviderStatus(order) {
  if (order.provider === "gsmotp5s") {
    let config = {};
    try { config = await getEffectiveApiConfig(); } catch (_) {}
    const token = config.gsmotp5s_token || config.otphub_token || process.env.GSMOTP5S_TOKEN || process.env.OTPHUB_TOKEN || "f6c8cb1a9f0b6a082760e8643fbe7992";
    const baseUrl = (config.gsmotp5s_base_url || "https://gsmotp5s.site").replace(/\/$/, "");
    const timeout = AbortSignal.timeout(15000);
    const url = new URL(`${baseUrl}/session/getv2`);
    url.searchParams.set("requestId", order.providerSessionId);
    url.searchParams.set("token", token);
    try {
      const res = await fetch(url, { signal: timeout, cache: "no-store" });
      const data = await res.json();
      const status = Number(data.data?.Status ?? data.data?.status);
      const code = data.data?.Code || data.data?.code || data.data?.SmsContent;
      if (status === 1 && code) return { status: "COMPLETED", otp: String(code) };
      if (status === 2) return { status: "EXPIRED" };
      if (status === 0) return { status: "PENDING" };
      throw new Error("Phiên thuê trả về trạng thái không hợp lệ.");
    } catch (err) {
      if (err.name === "AbortError" || err.message?.includes("timeout") || err.message?.includes("aborted")) {
        return { status: "PENDING" };
      }
      throw err;
    }
  }

  if (order.provider === "otistx") {
    const { data } = await providerRequest(`get-otp?sessionId=${encodeURIComponent(order.providerSessionId)}`, {}, "otistx");
    if (data.status === "completed") return { status: "COMPLETED", otp: String(data.otp || "") };
    if (data.status === "expired") return { status: "EXPIRED" };
    if (data.status === "waiting") return { status: "PENDING" };
    throw new Error("Phiên thuê trả về trạng thái không hợp lệ.");
  }

  if (order.provider === "viotp") {
    const { data } = await providerRequest("session/getv2", { params: { requestId: order.providerSessionId } }, "viotp");
    const status = Number(data.data?.Status);
    if (status === 1 && data.data?.Code) return { status: "COMPLETED", otp: String(data.data.Code) };
    if (status === 2) return { status: "EXPIRED" };
    if (status === 0) return { status: "PENDING" };
    throw new Error("Phiên thuê trả về trạng thái không hợp lệ.");
  }

  if (order.provider === "otphub") {
    const { data } = await providerRequest("session/getv2", { params: { requestId: order.providerSessionId } }, "otphub");
    const status = Number(data.data?.Status ?? data.data?.status);
    const code = data.data?.Code || data.data?.code;
    if (status === 1 && code) return { status: "COMPLETED", otp: String(code) };
    if (status === 2) return { status: "EXPIRED" };
    if (status === 0) return { status: "PENDING" };
    throw new Error("Phiên thuê trả về trạng thái không hợp lệ.");
  }

  throw new Error("Provider không hợp lệ");
}

export async function cancelProviderSession(order) {
  if (order.provider === "gsmotp5s") {
    try {
      let config = {};
      try { config = await getEffectiveApiConfig(); } catch (_) {}
      const token = config.gsmotp5s_token || config.otphub_token || process.env.GSMOTP5S_TOKEN || process.env.OTPHUB_TOKEN || "f6c8cb1a9f0b6a082760e8643fbe7992";
      const baseUrl = (config.gsmotp5s_base_url || "https://gsmotp5s.site").replace(/\/$/, "");
      const timeout = AbortSignal.timeout(6000);
      const url = new URL(`${baseUrl}/session/cancel`);
      url.searchParams.set("requestId", order.providerSessionId);
      url.searchParams.set("token", token);
      await fetch(url, { signal: timeout, cache: "no-store" });
      return true;
    } catch (err) {
      console.warn("Cancel gsmotp5s session failed:", err.message);
      return false;
    }
  }
  if (order.provider === "otphub") {
    try {
      await providerRequest("session/cancel", { params: { requestId: order.providerSessionId } }, "otphub");
      return true;
    } catch (err) {
      console.warn("Cancel OtpHub session failed:", err.message);
      return false;
    }
  }
  return false;
}

export const RESERVE_ORDER_SCRIPT = `
local balance = tonumber(redis.call('HGET', KEYS[1], 'balance') or '0')
local cost = tonumber(ARGV[1])
if not balance or balance < cost then return -1 end
local remaining = balance - cost
redis.call('HINCRBY', KEYS[1], 'balance', -cost)
redis.call('HSET', KEYS[2], 'id', ARGV[2], 'user_id', ARGV[3], 'provider', ARGV[4], 'providerSessionId', '', 'phone', '', 'service', ARGV[5], 'carrier', ARGV[6], 'cost', cost, 'status', 'REQUESTING', 'createdAt', ARGV[7], 'expiresAt', '0', 'otp', '')
redis.call('ZADD', KEYS[3], ARGV[7], ARGV[2])
redis.call('ZADD', KEYS[4], ARGV[7], ARGV[2])
redis.call('HSET', KEYS[5], 'id', ARGV[8], 'user_id', ARGV[3], 'username', redis.call('HGET', KEYS[1], 'username') or '', 'type', 'RENTAL', 'amount', -cost, 'balance', remaining, 'order_id', ARGV[2], 'reason', 'Thuê SIM ' .. ARGV[5], 'createdAt', ARGV[7])
redis.call('ZADD', KEYS[6], ARGV[7], ARGV[8])
redis.call('ZADD', KEYS[7], ARGV[7], ARGV[8])
redis.call('ZADD', KEYS[8], ARGV[7], ARGV[8])
return remaining
`;

export const REFUND_ORDER_SCRIPT = `
local status = redis.call('HGET', KEYS[1], 'status')
if status ~= 'PENDING' and status ~= 'REQUESTING' then return 0 end
local cost = tonumber(redis.call('HGET', KEYS[1], 'cost') or '0')
local balance = redis.call('HINCRBY', KEYS[2], 'balance', cost)
redis.call('HSET', KEYS[1], 'status', ARGV[1], 'updatedAt', ARGV[2])
redis.call('HSET', KEYS[3], 'id', ARGV[3], 'user_id', redis.call('HGET', KEYS[1], 'user_id') or '', 'username', redis.call('HGET', KEYS[2], 'username') or '', 'type', 'REFUND', 'amount', cost, 'balance', balance, 'order_id', redis.call('HGET', KEYS[1], 'id') or '', 'reason', 'Hoàn tiền đơn thuê SIM', 'createdAt', ARGV[2])
redis.call('ZADD', KEYS[4], ARGV[2], ARGV[3])
redis.call('ZADD', KEYS[5], ARGV[2], ARGV[3])
redis.call('ZADD', KEYS[6], ARGV[2], ARGV[3])
return 1
`;

export const COMPLETE_ORDER_SCRIPT = `
local status = redis.call('HGET', KEYS[1], 'status')
if status ~= 'PENDING' then return 0 end
redis.call('HSET', KEYS[1], 'status', 'COMPLETED', 'otp', ARGV[1], 'updatedAt', ARGV[2])
return 1
`;

export const DEFAULT_ANNOUNCEMENT = {
	enabled: true,
	tag: "THÔNG BÁO HỆ THỐNG",
	title: "Cập nhật mới từ SIM OTP",
	content: `📢 THÔNG BÁO CẬP NHẬT CHỨC NĂNG MỚI

Kính gửi Quý khách hàng,

Nhằm nâng cao trải nghiệm sử dụng và hỗ trợ Quý khách thao tác thuận tiện, nhanh chóng hơn, hệ thống SIM OTP chính thức cập nhật thêm các chức năng mới như sau:

📍 CHỨC NĂNG THÊM ĐỊA CHỈ
• Bổ sung chức năng **thêm địa chỉ trực tiếp trên hệ thống thông qua API cũ**.
• Quý khách **không cần thay đổi hoặc cập nhật API**, có thể tiếp tục sử dụng API hiện tại.
• Giúp quá trình thêm và xử lý thông tin địa chỉ nhanh chóng, thuận tiện hơn.

🚚 CHỨC NĂNG CHECK MÃ VẬN ĐƠN AUTO QUA SHEET
• Tự động tra cứu và đối soát mã vận đơn đơn hàng.
• Hỗ trợ tối ưu quy trình xử lý đơn hàng và nhận mã OTP nhanh chóng.`,
	actionText: "Xem chi tiết →",
	actionUrl: "/dashboard",
	hideDurationHours: 2,
	updatedAt: 1728000000000,
};

export async function getAnnouncementConfig(redis = getRedis()) {
	try {
		const raw = await redis.get("config:announcement");
		if (!raw) return DEFAULT_ANNOUNCEMENT;
		if (typeof raw === "string") {
			return { ...DEFAULT_ANNOUNCEMENT, ...JSON.parse(raw) };
		}
		if (typeof raw === "object") {
			return { ...DEFAULT_ANNOUNCEMENT, ...raw };
		}
		return DEFAULT_ANNOUNCEMENT;
	} catch (e) {
		return DEFAULT_ANNOUNCEMENT;
	}
}

export async function saveAnnouncementConfig(data, redis = getRedis()) {
	const current = await getAnnouncementConfig(redis);
	const updated = {
		...current,
		enabled: typeof data.enabled === "boolean" ? data.enabled : current.enabled,
		tag: String(data.tag || "").trim() || "THÔNG BÁO HỆ THỐNG",
		title: String(data.title || "").trim() || "Thông báo",
		content: String(data.content || "").trim(),
		actionText: String(data.actionText || "").trim(),
		actionUrl: String(data.actionUrl || "").trim(),
		hideDurationHours: Math.max(1, Number(data.hideDurationHours) || 2),
		updatedAt: Date.now(),
	};
	await redis.set("config:announcement", JSON.stringify(updated));
	return updated;
}