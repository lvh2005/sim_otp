import { randomUUID } from "node:crypto";
import { getAnnouncementConfig, getEffectiveApiConfig, getProviderBalances, getRedis, getServicePrices, jsonError, safeEqual, saveAnnouncementConfig, saveEffectiveApiConfig, SIM_SERVICES, getDisabledServices, setDisabledServices, cleanupExpiredOrders } from "@/lib/sim-store";


const BALANCE_ADJUSTMENT_SCRIPT = `
local current = tonumber(redis.call('HGET', KEYS[1], 'balance') or '0')
local amount = tonumber(ARGV[1])
local direction = ARGV[2]
if not current or not amount or amount <= 0 then return -2 end
if direction == 'debit' and current < amount then return -1 end
local delta = amount
if direction == 'debit' then delta = -amount end
local balance = redis.call('HINCRBY', KEYS[1], 'balance', delta)
redis.call('HSET', KEYS[2], 'id', ARGV[3], 'user_id', ARGV[4], 'username', ARGV[5], 'type', ARGV[6], 'amount', delta, 'balance', balance, 'reason', ARGV[7], 'createdAt', ARGV[8], 'operator', 'admin')
redis.call('ZADD', KEYS[3], ARGV[8], ARGV[3])
redis.call('ZADD', KEYS[4], ARGV[8], ARGV[3])
redis.call('ZADD', KEYS[5], ARGV[8], ARGV[3])
return balance
`;

function isAdmin(request) {
	const adminToken = process.env.ADMIN_API_TOKEN;
	return Boolean(adminToken && safeEqual(request.headers.get("x-admin-token"), adminToken));
}

function pagination(url) {
	const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
	const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 25));
	return { page, limit, offset: (page - 1) * limit };
}

async function readUser(redis, username, id) {
	const user = await redis.hgetall(`user:${id}`);
	return {
		id: String(user?.id || id),
		username: String(user?.username || username),
		fullName: String(user?.fullName || ""),
		depositCode: String(user?.depositCode || ""),
		balance: Number(user?.balance || 0),
		disabled: user?.disabled === "1" || user?.disabled === 1,
		createdAt: Number(user?.createdAt || 0),
		orderCount: Number(await redis.zcard(`user:${id}:orders`)),
	};
}

async function listUsers(redis, url) {
	const { page, limit, offset } = pagination(url);
	const query = String(url.searchParams.get("q") || "").trim().toLowerCase();
	const usernameIndex = await redis.hgetall("users:by-username") || {};
	const entries = Object.entries(usernameIndex)
		.filter(([username]) => !query || username.toLowerCase().includes(query))
		.sort(([left], [right]) => left.localeCompare(right));
	const users = await Promise.all(entries.slice(offset, offset + limit).map(([username, id]) => readUser(redis, username, id)));
	return { users, total: entries.length, page, limit };
}

async function listOrders(redis, url) {
	await cleanupExpiredOrders(redis);
	const { page, limit, offset } = pagination(url);
	const filter = String(url.searchParams.get("status") || "").toUpperCase();
	const query = String(url.searchParams.get("q") || "").trim().toLowerCase();
	const indexedIds = await redis.zrange("orders:all", 0, -1, { rev: true });
	const usernameIndex = await redis.hgetall("users:by-username") || {};
	const existingIds = await Promise.all(Object.values(usernameIndex).map((id) =>
		redis.zrange(`user:${id}:orders`, 0, -1, { rev: true }),
	));
	const ids = [...new Set([...indexedIds, ...existingIds.flat()])];
	const usernameById = Object.fromEntries(Object.entries(usernameIndex).map(([username, id]) => [String(id), username]));
	const orders = await Promise.all(ids.map(async (id) => {
		const order = await redis.hgetall(`order:${id}`);
		if (!order?.id) return null;
		return {
			id: String(order.id),
			username: usernameById[String(order.user_id)] || String(order.user_id || ""),
			phone: String(order.phone || ""),
			service: String(order.service || ""),
			carrier: String(order.carrier || ""),
			cost: Number(order.cost || 0),
			status: String(order.status || "UNKNOWN"),
			createdAt: Number(order.createdAt || 0),
			expiresAt: Number(order.expiresAt || 0),
		};
	}));
	const filtered = orders.filter((order) => order
		&& (!filter || order.status === filter)
		&& (!query || order.username.toLowerCase().includes(query) || order.phone.includes(query) || order.id.toLowerCase().includes(query)))
		.sort((left, right) => right.createdAt - left.createdAt);
	return { orders: filtered.slice(offset, offset + limit), total: filtered.length, page, limit };
}

async function listTransactions(redis, url) {
	const { page, limit, offset } = pagination(url);
	const requestedType = String(url.searchParams.get("type") || "");
	const allowedTypes = new Set(["RENTAL", "REFUND", "SEPAY_DEPOSIT", "ADMIN_CREDIT", "ADMIN_DEBIT"]);
	const index = allowedTypes.has(requestedType) ? `transactions:type:${requestedType}` : "transactions:all";
	const ids = await redis.zrange(index, offset, offset + limit - 1, { rev: true });
	const count = Number(await redis.zcard(index));
	const transactions = await Promise.all(ids.map(async (id) => {
		const transaction = await redis.hgetall(`transaction:${id}`);
		if (!transaction?.id) return null;
		return {
			id: String(transaction.id),
			username: String(transaction.username || ""),
			type: String(transaction.type || ""),
			amount: Number(transaction.amount || 0),
			balance: Number(transaction.balance || 0),
			reason: String(transaction.reason || ""),
			orderId: String(transaction.order_id || ""),
			createdAt: Number(transaction.createdAt || 0),
		};
	}));
	return { transactions: transactions.filter(Boolean), total: count, page, limit };
}

export async function GET(request) {
	if (!isAdmin(request)) return jsonError("Không có quyền thực hiện", 401);
	const url = new URL(request.url);
	const view = url.searchParams.get("view") || "prices";
	if (view === "health") {
		return Response.json({
			authorized: true,
			provider: process.env.SIM_PROVIDER || "otistx",
			providerReady: !process.env.SIM_PROVIDER || process.env.SIM_PROVIDER === "otistx"
				? Boolean(process.env.OTISTX_API_KEY)
				: process.env.SIM_PROVIDER === "viotp" ? Boolean(process.env.VIOTP_TOKEN)
				: Boolean(process.env.OTPHUB_TOKEN),
		});
	}
	try {
		const redis = getRedis();
		if (view === "api_config") return Response.json(await getEffectiveApiConfig(redis));
		if (view === "announcement") return Response.json(await getAnnouncementConfig(redis));
		if (view === "prices") return Response.json({ prices: await getServicePrices(redis), disabledServices: await getDisabledServices(redis) });
		if (view === "users") return Response.json(await listUsers(redis, url));
		if (view === "orders") return Response.json(await listOrders(redis, url));
		if (view === "transactions") return Response.json(await listTransactions(redis, url));
		if (view === "overview") {
			const usernameIndex = await redis.hgetall("users:by-username") || {};
			const users = await Promise.all(Object.entries(usernameIndex).map(([username, id]) => readUser(redis, username, id)));
			const totalOrders = users.reduce((total, user) => total + user.orderCount, 0);
			const totalUserBalance = users.reduce((total, user) => total + user.balance, 0);

			// Provider balances (OtisTx + ViOTP + OtpHub)
			const providerBalances = await getProviderBalances();
			const otistxBal = Number(providerBalances.otistx.balance || 0);
			const viotpBal = Number(providerBalances.viotp.balance || 0);
			const otphubBal = Number(providerBalances.otphub.balance || 0);
			const totalProviderBalance = otistxBal + viotpBal + otphubBal;

			// Deposits calculation
			const depositIds = await redis.zrange("transactions:type:SEPAY_DEPOSIT", 0, -1);
			const adminCreditIds = await redis.zrange("transactions:type:ADMIN_CREDIT", 0, -1);
			const allDepositIds = [...new Set([...depositIds, ...adminCreditIds])];
			let totalDeposited = 0;
			await Promise.all(allDepositIds.map(async (id) => {
				const tx = await redis.hgetall(`transaction:${id}`);
				if (tx?.amount) {
					totalDeposited += Math.abs(Number(tx.amount));
				}
			}));

			// Orders & Profit calculation
			const allOrderIds = await redis.zrange("orders:all", 0, -1);
			let totalRentalCharged = 0;
			let totalRefunded = 0;
			let completedOrdersCount = 0;
			let completedOrdersRevenue = 0;
			let expiredOrdersCount = 0;
			let pendingOrdersCount = 0;

			await Promise.all(allOrderIds.map(async (id) => {
				const ord = await redis.hgetall(`order:${id}`);
				if (!ord?.id) return;
				const cost = Number(ord.cost || 0);
				totalRentalCharged += cost;
				if (ord.status === "COMPLETED") {
					completedOrdersCount++;
					completedOrdersRevenue += cost;
				} else if (ord.status === "EXPIRED" || ord.status === "FAILED") {
					expiredOrdersCount++;
					totalRefunded += cost;
				} else if (ord.status === "PENDING" || ord.status === "REQUESTING") {
					pendingOrdersCount++;
				}
			}));

			// Approximate wholesale cost: OtisTx average ~3.000đ/SIM, ViOTP average ~2.500đ/SIM
			const estimatedWholesaleCost = Math.round(completedOrdersRevenue * 0.45);
			const estimatedProfit = Math.max(0, completedOrdersRevenue - estimatedWholesaleCost);
			const netSystemRevenue = Math.max(0, totalDeposited - totalUserBalance);

			return Response.json({
				userCount: users.length,
				activeUserCount: users.filter((user) => !user.disabled).length,
				disabledUserCount: users.filter((user) => user.disabled).length,
				totalBalance: totalUserBalance,
				orderCount: totalOrders,
				provider: process.env.SIM_PROVIDER || "otistx",
				providerReady: Boolean(process.env.OTISTX_API_KEY) || Boolean(process.env.VIOTP_TOKEN) || Boolean(process.env.OTPHUB_TOKEN),
				providerBalances: {
					otistx: providerBalances.otistx,
					viotp: providerBalances.viotp,
					otphub: providerBalances.otphub,
					total: totalProviderBalance,
				},
				financials: {
					totalDeposited,
					depositCount: allDepositIds.length,
					totalUserBalance,
					totalRentalCharged,
					totalRefunded,
					completedOrdersCount,
					completedOrdersRevenue,
					expiredOrdersCount,
					pendingOrdersCount,
					estimatedWholesaleCost,
					estimatedProfit,
					netSystemRevenue,
					solvencyRatio: totalUserBalance > 0 ? ((totalProviderBalance / totalUserBalance) * 100).toFixed(1) : "100.0",
				},
				recentOrders: (await listOrders(redis, new URL(`${url.origin}/api/admin?view=orders&limit=8`))).orders,
			});
		}
		return jsonError("Mục quản trị không hợp lệ", 400);
	} catch (error) {
		return jsonError(error.message || "Không thể đọc dữ liệu quản trị", 503);
	}
}

export async function PATCH(request) {
	if (!isAdmin(request)) return jsonError("Không có quyền thực hiện", 401);
	try {
		const body = await request.json();
		if (body.action === "user_status") {
			const username = String(body.username || "").trim().toLowerCase();
			if (!/^[a-z0-9_]{3,24}$/.test(username) || typeof body.disabled !== "boolean") {
				return jsonError("Tài khoản hoặc trạng thái không hợp lệ", 400);
			}
			const redis = getRedis();
			const userId = await redis.hget("users:by-username", username);
			if (typeof userId !== "string") return jsonError("Không tìm thấy user", 404);
			await redis.hset(`user:${userId}`, { disabled: body.disabled ? "1" : "0", updatedAt: Date.now() });
			return Response.json({ success: true, username, disabled: body.disabled });
		}

		if (body.announcement && typeof body.announcement === "object") {
			const redis = getRedis();
			const updated = await saveAnnouncementConfig(body.announcement, redis);
			return Response.json({ success: true, announcement: updated });
		}

		if (body.api_config && typeof body.api_config === "object") {
			const redis = getRedis();
			const updated = await saveEffectiveApiConfig(body.api_config, redis);
			return Response.json({ success: true, api_config: updated });
		}

		const { prices, disabledServices } = body;
		const redis = getRedis();
		if (Array.isArray(disabledServices)) {
			await setDisabledServices(disabledServices, redis);
		}
		if (prices && typeof prices === "object" && !Array.isArray(prices)) {
			const normalized = {};
			for (const service of SIM_SERVICES) {
				if (prices[service] !== undefined) {
					const price = Number(prices[service]);
					if (!Number.isSafeInteger(price) || price <= 0 || price > 100000000) {
						return jsonError(`Giá ${service} phải là số nguyên dương`, 400);
					}
					normalized[service] = price;
				}
			}
			await redis.hset("config:sim:prices", normalized);
		}
		return Response.json({
			success: true,
			prices: await getServicePrices(redis),
			disabledServices: await getDisabledServices(redis),
		});
	} catch (error) {
		return jsonError(error.message || "Không thể cập nhật dữ liệu quản trị", 503);
	}
}

export async function POST(request) {
	if (!isAdmin(request)) return jsonError("Không có quyền thực hiện", 401);
	try {
		const body = await request.json();

		if (body.action === "test_provider") {
			const { provider, token, baseUrl, apiKey } = body;
			const timeout = AbortSignal.timeout(6000);
			try {
				if (provider === "otphub") {
					const targetUrl = (baseUrl || "https://otphubtl.vercel.app").replace(/\/$/, "");
					const res = await fetch(`${targetUrl}/users/balance?token=${encodeURIComponent(token || "")}`, { signal: timeout, cache: "no-store" });
					const data = await res.json();
					if (data?.status_code === 200 && data?.data?.balance !== undefined) {
						return Response.json({ success: true, balance: Number(data.data.balance), message: `Kết nối OtpHub VIP thành công! Số dư ví: ${Number(data.data.balance).toLocaleString("vi-VN")} ₫` });
					}
					return jsonError(data?.message || "Không thể xác thực API Key OtpHub VIP", 400);
				}
				if (provider === "viotp") {
					const res = await fetch(`https://api.viotp.com/users/balance?token=${encodeURIComponent(token || "")}`, { signal: timeout, cache: "no-store" });
					const data = await res.json();
					if (data?.status_code === 200 && data?.data?.balance !== undefined) {
						return Response.json({ success: true, balance: Number(data.data.balance), message: `Kết nối ViOTP thành công! Số dư ví: ${Number(data.data.balance).toLocaleString("vi-VN")} ₫` });
					}
					return jsonError(data?.message || "Không thể xác thực Token ViOTP", 400);
				}
				if (provider === "otistx") {
					const res = await fetch("https://otistx.com/api/user/balance", {
						headers: { "Content-Type": "application/json", "X-API-Key": apiKey || "" },
						signal: timeout,
						cache: "no-store",
					});
					const data = await res.json();
					if (typeof data === "number" || typeof data?.balance === "number") {
						const bal = typeof data === "number" ? data : data.balance;
						return Response.json({ success: true, balance: Number(bal), message: `Kết nối OtisTx thành công! Số dư ví: ${Number(bal).toLocaleString("vi-VN")} ₫` });
					}
					return jsonError(data?.message || "Không thể xác thực API Key OtisTx", 400);
				}
			} catch (testErr) {
				return jsonError(`Lỗi kết nối tới nhà cung cấp: ${testErr.message}`, 502);
			}
			return jsonError("Provider không hỗ trợ kiểm tra", 400);
		}

		const username = String(body.username || "").trim().toLowerCase();
		const direction = body.direction === "debit" ? "debit" : "credit";
		const amount = Number(body.amount);
		const reason = String(body.reason || (direction === "credit" ? "Nạp tiền quản trị" : "Điều chỉnh số dư quản trị")).trim();
		if (!/^[a-z0-9_]{3,24}$/.test(username) || !Number.isSafeInteger(amount) || amount <= 0 || amount > 100000000 || reason.length < 3 || reason.length > 160) {
			return jsonError("User, số tiền hoặc lý do không hợp lệ", 400);
		}
		const redis = getRedis();
		const userId = await redis.hget("users:by-username", username);
		if (typeof userId !== "string") return jsonError("Không tìm thấy user", 404);
		const transactionId = randomUUID();
		const result = Number(await redis.eval(
			BALANCE_ADJUSTMENT_SCRIPT,
			[`user:${userId}`, `transaction:${transactionId}`, "transactions:all", `user:${userId}:transactions`, `transactions:type:${direction === "credit" ? "ADMIN_CREDIT" : "ADMIN_DEBIT"}`],
			[amount, direction, transactionId, userId, username, direction === "credit" ? "ADMIN_CREDIT" : "ADMIN_DEBIT", reason, Date.now()],
		));
		if (result === -1) return jsonError("Số dư user không đủ để trừ", 409);
		if (result < 0) return jsonError("Không thể cập nhật số dư", 400);
		return Response.json({ success: true, username, balance: result, transactionId });
	} catch (error) {
		return jsonError(error.message || "Không thể điều chỉnh số dư", 503);
	}
}