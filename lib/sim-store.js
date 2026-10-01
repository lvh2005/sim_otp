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

export function getViotpServiceId(service) {
  const configuredId = process.env[`VIOTP_SERVICE_ID_${service.toUpperCase()}`];
  if (configuredId) return configuredId;
  const defaultService = process.env.SIM_SERVICE || "otissim_v3";
  return service === defaultService ? process.env.VIOTP_SHOPEE_SERVICE_ID : undefined;
}

export function getProviderServiceIds(provider) {
  if (provider === "otistx") {
    return process.env.OTISTX_API_KEY ? SIM_SERVICES : [];
  }
  if (provider === "viotp") {
    if (!process.env.VIOTP_TOKEN) return [];
    return SIM_SERVICE_CATALOG
      .filter(({ id }) => getViotpServiceId(id))
      .map(({ id }) => id);
  }
  return [];
}

export async function getServicePrices(redis = getRedis()) {
  const storedPrices = await redis.hgetall("config:sim:prices") || {};
  return Object.fromEntries(SIM_SERVICES.map((service) => {
    const configured = storedPrices[service]
      ?? process.env[`SIM_PRICE_${service.toUpperCase()}`]
      ?? process.env.SIM_PRICE_VND;
    const price = Number(configured);
    return [service, Number.isSafeInteger(price) && price > 0 ? price : null];
  }));
}

export async function getServicePrice(service, redis = getRedis()) {
  const prices = await getServicePrices(redis);
  return prices[service] ?? null;
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
  const token = request.cookies?.get("sim_session")?.value;
  if (!token) return null;
  const redis = getRedis();
  const userId = await redis.get(`session:${digest(token)}`);
  if (typeof userId !== "string") return null;
  const user = await redis.hgetall(`user:${userId}`);
  if (!user?.id) return null;
  return { id: String(user.id), username: String(user.username), balance: Number(user.balance || 0) };
}

export async function providerRequest(path, options = {}) {
  const provider = process.env.SIM_PROVIDER || "otistx";
  const timeout = AbortSignal.timeout(5000);

  if (provider === "otistx") {
    const apiKey = process.env.OTISTX_API_KEY;
    if (!apiKey) throw new Error("OTISTX_API_KEY is not configured");
    const response = await fetch(`https://otistx.com/api/phone-rental/${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", "X-API-Key": apiKey, ...options.headers },
      signal: timeout,
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "SIM provider request failed");
    return { provider, data };
  }

  if (provider === "viotp") {
    const token = process.env.VIOTP_TOKEN;
    if (!token) throw new Error("VIOTP_TOKEN is not configured");
    const url = new URL(`https://api.viotp.com/${path}`);
    url.searchParams.set("token", token);
    for (const [key, value] of Object.entries(options.params || {})) url.searchParams.set(key, value);
    const response = await fetch(url, { signal: timeout, cache: "no-store" });
    const data = await response.json();
    if (!response.ok || data.success !== true) throw new Error(data.message || "SIM provider request failed");
    return { provider, data };
  }

  throw new Error("SIM_PROVIDER must be otistx or viotp");
}

export async function startProviderSession({ service, carrier, idempotencyKey }) {
  const provider = process.env.SIM_PROVIDER || "otistx";
  if (provider === "otistx") {
    const { data } = await providerRequest("start", {
      method: "POST",
      headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {},
      body: JSON.stringify({ service, carrier }),
    });
    if (!data.sessionId || !data.phoneNumber) throw new Error(data.message || "Provider did not return a phone number");
    return {
      provider,
      sessionId: String(data.sessionId),
      phone: String(data.phoneNumber),
      expiresAt: data.expiresAt ? new Date(data.expiresAt).getTime() : Date.now() + 180000,
    };
  }

  const serviceId = getViotpServiceId(service);
  if (!serviceId) throw new Error(`VIOTP_SERVICE_ID_${service.toUpperCase()} is not configured`);
  const network = { viettel: "VIETTEL", vinaphone: "VINAPHONE", mobifone: "MOBIFONE", vnmb: "VIETNAMOBILE", itel: "ITELECOM" }[carrier];
  const { data } = await providerRequest("request/getv2", {
    params: network ? { serviceId, network } : { serviceId },
  });
  if (!data.data?.request_id || !data.data?.phone_number) throw new Error(data.message || "Provider did not return a phone number");
  return {
    provider,
    sessionId: String(data.data.request_id),
    phone: String(data.data.phone_number),
    expiresAt: Date.now() + 180000,
  };
}

export async function readProviderStatus(order) {
  if (order.provider === "otistx") {
    const { data } = await providerRequest(`get-otp?sessionId=${encodeURIComponent(order.providerSessionId)}`);
    if (data.status === "completed") return { status: "COMPLETED", otp: String(data.otp || "") };
    if (data.status === "expired") return { status: "EXPIRED" };
    if (data.status === "waiting") return { status: "PENDING" };
    throw new Error(data.message || "Provider returned an unknown session status");
  }

  const { data } = await providerRequest("session/getv2", { params: { requestId: order.providerSessionId } });
  const status = Number(data.data?.Status);
  if (status === 1 && data.data?.Code) return { status: "COMPLETED", otp: String(data.data.Code) };
  if (status === 2) return { status: "EXPIRED" };
  if (status === 0) return { status: "PENDING" };
  throw new Error(data.message || "Provider returned an unknown session status");
}

export const RESERVE_ORDER_SCRIPT = `
local balance = tonumber(redis.call('HGET', KEYS[1], 'balance') or '0')
local cost = tonumber(ARGV[1])
if not balance or balance < cost then return -1 end
redis.call('HINCRBY', KEYS[1], 'balance', -cost)
redis.call('HSET', KEYS[2], 'id', ARGV[2], 'user_id', ARGV[3], 'provider', ARGV[4], 'providerSessionId', '', 'phone', '', 'service', ARGV[5], 'carrier', ARGV[6], 'cost', cost, 'status', 'REQUESTING', 'createdAt', ARGV[7], 'expiresAt', '0', 'otp', '')
redis.call('ZADD', KEYS[3], ARGV[7], ARGV[2])
return balance - cost
`;

export const REFUND_ORDER_SCRIPT = `
local status = redis.call('HGET', KEYS[1], 'status')
if status ~= 'PENDING' and status ~= 'REQUESTING' then return 0 end
local cost = tonumber(redis.call('HGET', KEYS[1], 'cost') or '0')
redis.call('HINCRBY', KEYS[2], 'balance', cost)
redis.call('HSET', KEYS[1], 'status', ARGV[1], 'updatedAt', ARGV[2])
return 1
`;

export const COMPLETE_ORDER_SCRIPT = `
local status = redis.call('HGET', KEYS[1], 'status')
if status ~= 'PENDING' then return 0 end
redis.call('HSET', KEYS[1], 'status', 'COMPLETED', 'otp', ARGV[1], 'updatedAt', ARGV[2])
return 1
`;