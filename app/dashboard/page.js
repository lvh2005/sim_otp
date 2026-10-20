"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupportedCarriers, SIM_CARRIER_LABELS, SIM_SERVICE_CATALOG } from "@/lib/sim-catalog";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import TelegramBotWidget from "@/app/components/TelegramBotWidget";

const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const ACTIVE_ORDER_STATUSES = ["PENDING", "REQUESTING"];
const TERMINAL_ORDER_STATUSES = ["COMPLETED", "EXPIRED", "FAILED"];

export default function DashboardPage({
	rentalMode = false,
	serviceFilter = null,
	defaultService = "otissim_v8",
} = {}) {
	const router = useRouter();
	const initialService = serviceFilter === "tiktok"
		? "simotp_tiktok_v1"
		: serviceFilter === "other"
		? "zalo"
		: (defaultService || "otissim_v8");
	const [user, setUser] = useState(null);
	const [prices, setPrices] = useState({});
	const [provider, setProvider] = useState("otistx");
	const [availableServiceIds, setAvailableServiceIds] = useState(SIM_SERVICE_CATALOG.map(({ id }) => id));
	const [providerReady, setProviderReady] = useState(true);
	const [providerMessage, setProviderMessage] = useState("");
	const [loading, setLoading] = useState(true);
	const [service, setService] = useState(initialService);
	const [carrier, setCarrier] = useState("random");
	const [smsRecipient, setSmsRecipient] = useState("19001221");
	const [smsText, setSmsText] = useState("DK");
	const [activeOrders, setActiveOrders] = useState([]);
	const [activeOrder, setActiveOrder] = useState(null);
	const [zaloOrder, setZaloOrder] = useState(null);
	const [zaloConfirmed, setZaloConfirmed] = useState(false);
	const [copiedField, setCopiedField] = useState("");
	const [cancellingId, setCancellingId] = useState("");
	const [polling, setPolling] = useState(false);
	const [remaining, setRemaining] = useState(0);
	const [clockNow, setClockNow] = useState(Date.now());
	const [busy, setBusy] = useState(false);
	const isRentingRef = useRef(false);
	const isConfirmingZaloRef = useRef(false);
	const [notice, setNotice] = useState("");
	const [error, setError] = useState("");

	const [ordersTotal, setOrdersTotal] = useState(0);
	const [userOrders, setUserOrders] = useState([]);
	const [ordersLoading, setOrdersLoading] = useState(false);
	const [orderFilter, setOrderFilter] = useState("ALL");
	const [orderSearch, setOrderSearch] = useState("");

	const availableServices = SIM_SERVICE_CATALOG
		.filter(({ id }) => availableServiceIds.includes(id))
		.filter((item) => {
			if (!serviceFilter) return true;
			if (serviceFilter === "tiktok") return item.category === "tiktok" || item.id === "simotp_tiktok_v1";
			if (serviceFilter === "shopee") return item.category === "shopee" || (!item.category && item.id !== "simotp_tiktok_v1" && item.category !== "other");
			if (serviceFilter === "other") return item.category === "other" || item.id === "zalo" || item.id === "sms_combo";
			return true;
		});
	const availableCarriers = getSupportedCarriers(service, provider);
	const serviceInfo = SIM_SERVICE_CATALOG.find((item) => item.id === service);
	const price = prices[service] || 0;
	const getServiceLabel = (serviceId) => SIM_SERVICE_CATALOG.find((item) => item.id === serviceId)?.label || serviceId;
	const getCarrierLabel = (carrierId) => SIM_CARRIER_LABELS[carrierId] || carrierId || "Tự động";
	const formatDateTime = (timestamp) => timestamp ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "medium" }).format(new Date(timestamp)) : "—";

	const loadUserOrders = useCallback(async () => {
		if (!user?.id) return;
		setOrdersLoading(true);
		try {
			const res = await fetch(`/api/orders?status=${orderFilter}&q=${encodeURIComponent(orderSearch)}`, { cache: "no-store" });
			if (res.ok) {
				const data = await res.json();
				setUserOrders(data.orders || []);
				setOrdersTotal(data.total || 0);
				const pendingOrders = (data.orders || [])
					.filter((order) => ACTIVE_ORDER_STATUSES.includes(order.status))
					.map((order) => ({ orderId: order.id, phone: order.phone, expiresAt: order.expiresAt, cost: order.cost, status: order.status, otp: order.otp || "" }));
				const serverOrdersById = new Map((data.orders || []).map((order) => [order.id, order]));
				setActiveOrders((current) => {
					const mergedOrders = new Map();
					current.forEach((order) => {
						const serverOrder = serverOrdersById.get(order.orderId);
						if (TERMINAL_ORDER_STATUSES.includes(order.status) || !serverOrder) {
							mergedOrders.set(order.orderId, order);
							return;
						}
						mergedOrders.set(order.orderId, {
							...order,
							phone: serverOrder.phone || order.phone,
							expiresAt: serverOrder.expiresAt || order.expiresAt,
							cost: serverOrder.cost ?? order.cost,
							status: serverOrder.status,
							otp: serverOrder.otp || order.otp,
						});
					});
				pendingOrders.forEach((order) => {
					if (!mergedOrders.has(order.orderId)) mergedOrders.set(order.orderId, order);
				});
				return [...mergedOrders.values()];
				});
				if (pendingOrders.length) setPolling(true);
				if (data.balance !== undefined) {
					setUser((prev) => (prev ? { ...prev, balance: data.balance } : prev));
				}
			}
		} catch (err) {
			console.error("Failed to load orders:", err);
		} finally {
			setOrdersLoading(false);
		}
	}, [user?.id, orderFilter, orderSearch]);

	function applyProviderConfig(config) {
		const serviceIds = Array.isArray(config.services) ? config.services : [];
		setProvider(config.provider || "otistx");
		setAvailableServiceIds(serviceIds);
		setProviderReady(Boolean(config.providerReady));
		setProviderMessage(config.providerMessage || "");
		const targetDefault = serviceFilter === "tiktok"
			? "simotp_tiktok_v1"
			: serviceFilter === "other"
			? "zalo"
			: (defaultService || "otissim_v8");
		setService((current) => {
			if (serviceIds.includes(targetDefault)) return targetDefault;
			return serviceIds.includes(current) ? current : serviceIds[0] || "";
		});
	}

	useEffect(() => {
		let mounted = true;
		fetch("/api/auth", { cache: "no-store" })
			.then(async (response) => {
				if (!response.ok) return null;
				return response.json();
			})
			.then(async (data) => {
				if (!mounted) return;
				if (!data?.user) {
					router.replace("/login");
					return;
				}
				setUser(data.user);
				const configResponse = await fetch("/api/sim/request", { cache: "no-store" });
				if (configResponse.ok) {
					const config = await configResponse.json();
					if (mounted) {
						setPrices(config.prices || {});
						applyProviderConfig(config);
					}
				}
			})
			.catch(() => {
				if (mounted) setError("Không kết nối được máy chủ. Vui lòng kiểm tra lại mạng.");
			})
			.finally(() => {
				if (mounted) setLoading(false);
			});
		return () => {
			mounted = false;
		};
	}, [router]);

	useEffect(() => {
		if (!user?.id) return;
		loadUserOrders();
	}, [user?.id, loadUserOrders]);

	useEffect(() => {
		if (zaloOrder) return;
		const activeZalo = activeOrders.find((o) => (o.service === "zalo" || service === "zalo") && ACTIVE_ORDER_STATUSES.includes(o.status));
		if (activeZalo) {
			setZaloOrder({
				orderId: activeZalo.orderId,
				phone: activeZalo.phone,
				expiresAt: activeZalo.expiresAt,
				cost: activeZalo.cost,
				status: activeZalo.status,
				gateway: activeZalo.gateway || "8500",
				otp: activeZalo.otp || "",
			});
		}
	}, [activeOrders, zaloOrder, service]);

	useEffect(() => {
		if (!availableCarriers.length) {
			setCarrier("");
			return;
		}
		if (!availableCarriers.includes(carrier)) {
			setCarrier(availableCarriers.includes("random") ? "random" : availableCarriers[0]);
		}
	}, [service, provider, availableCarriers, carrier]);

	useEffect(() => {
		if (!activeOrder?.expiresAt) return undefined;
		const update = () => setRemaining(Math.max(0, Math.ceil((activeOrder.expiresAt - Date.now()) / 1000)));
		update();
		const timer = setInterval(update, 1000);
		return () => clearInterval(timer);
	}, [activeOrder?.expiresAt]);

	useEffect(() => {
		if (!rentalMode || !polling || !activeOrders.some((order) => ACTIVE_ORDER_STATUSES.includes(order.status))) return undefined;
		let stopped = false;
		let timer;

		const checkStatuses = async () => {
			if (stopped) return;
			const pendingOrders = activeOrders.filter((order) => ACTIVE_ORDER_STATUSES.includes(order.status));
			const updates = await Promise.all(pendingOrders.map(async (order) => {
				try {
					const response = await fetch(`/api/sim/status?orderId=${encodeURIComponent(order.orderId)}`, { cache: "no-store" });
					const result = await response.json();
					if (!response.ok) throw new Error(result.error || "Không kiểm tra được OTP");
					if (result.balance !== undefined) setUser((current) => current ? { ...current, balance: result.balance } : current);
					return {
						orderId: order.orderId,
						status: result.status,
						phone: result.phone || order.phone,
						expiresAt: result.expiresAt || order.expiresAt,
						otp: result.otp || "",
					};
				} catch (pollError) {
					if (!stopped) setError(pollError.message);
				}
				return null;
			}));
			if (stopped) return;
			const orderUpdates = updates.filter(Boolean);
			const terminalUpdates = orderUpdates.filter((order) => TERMINAL_ORDER_STATUSES.includes(order.status));
			if (orderUpdates.length) {
				setActiveOrders((current) => {
					let changed = false;
					const next = current.map((order) => {
						const update = orderUpdates.find((item) => item.orderId === order.orderId);
						if (!update || (
							order.status === update.status &&
							order.phone === update.phone &&
							order.expiresAt === update.expiresAt &&
							order.otp === update.otp
						)) return order;
						changed = true;
						return { ...order, ...update };
					});
					return changed ? next : current;
				});
				setActiveOrder((current) => {
					const update = orderUpdates.find((item) => item.orderId === current?.orderId);
					if (!update || (
						current.status === update.status &&
						current.phone === update.phone &&
						current.expiresAt === update.expiresAt &&
						current.otp === update.otp
					)) return current;
					return { ...current, ...update };
				});
				setZaloOrder((current) => {
					if (!current?.orderId) return current;
					const update = orderUpdates.find((item) => item.orderId === current.orderId);
					if (!update || (
						current.status === update.status &&
						current.phone === update.phone &&
						current.expiresAt === update.expiresAt &&
						current.otp === update.otp
					)) return current;
					return { ...current, ...update };
				});
			}
			if (terminalUpdates.length) {
				const terminalIds = new Set(terminalUpdates.map((order) => order.orderId));
				setNotice(terminalUpdates.some((order) => order.status === "COMPLETED") ? "Đã nhận OTP cho một phiên thuê." : "Một phiên thuê kết thúc; số dư đã được hoàn tự động.");
				if (!activeOrders.some((order) => ACTIVE_ORDER_STATUSES.includes(order.status) && !terminalIds.has(order.orderId))) setPolling(false);
				loadUserOrders();
			}
			timer = setTimeout(checkStatuses, 3000);
		};

		timer = setTimeout(checkStatuses, 3000);
		return () => {
			stopped = true;
			clearTimeout(timer);
		};
	}, [rentalMode, activeOrders, polling, loadUserOrders]);

	useEffect(() => {
		if (!activeOrders.some((order) => ACTIVE_ORDER_STATUSES.includes(order.status))) return undefined;
		const timer = setInterval(() => setClockNow(Date.now()), 1000);
		return () => clearInterval(timer);
	}, [activeOrders]);

	const rentNumber = async (event) => {
		if (event?.preventDefault) event.preventDefault();
		if (isRentingRef.current || busy) return;

		const currentPrice = price || prices[service] || 0;
		const currentBalance = Number(user?.balance ?? 0);
		if (!user || currentBalance < currentPrice) {
			setError(`Số dư tài khoản chưa đủ để thực hiện thuê số (${money.format(currentBalance)} < ${money.format(currentPrice)}). Vui lòng nạp thêm tiền.`);
			return;
		}

		isRentingRef.current = true;
		setBusy(true);
		setError("");
		setNotice("");
		try {
			const targetCarrier = service === "zalo" ? "8500" : carrier;
			const response = await fetch("/api/sim/request", {
				method: "POST",
				headers: { "Content-Type": "application/json", "idempotency-key": crypto.randomUUID() },
				body: JSON.stringify({
					service,
					carrier: targetCarrier,
					recipient: service === "sms_combo" ? (smsRecipient || "19001221") : undefined,
					text: service === "sms_combo" ? (smsText || "DK") : undefined,
				}),
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || "Không thể thuê số lúc này.");
			const newOrder = {
				orderId: result.orderId,
				requestId: result.requestId || "",
				phone: result.phone || "",
				expiresAt: result.expiresAt,
				cost: result.cost,
				status: result.status || "PENDING",
				gateway: targetCarrier,
				zaloStep: result.zaloStep || "waiting_send",
				otp: "",
			};
			if (service === "zalo") {
				setZaloOrder(newOrder);
				setZaloConfirmed(false);
			}
			setActiveOrder(newOrder);
			setActiveOrders((current) => [newOrder, ...current.filter((order) => order.orderId !== newOrder.orderId)]);
			setPolling(true);
			if (result.balance !== undefined) setUser((current) => current ? { ...current, balance: result.balance } : current);
			setNotice(service === "zalo"
				? "Đã cấp số Zalo! Vui lòng nhập số vào app Zalo để kiểm tra trước khi bấm Tạo."
				: result.status === "REQUESTING"
				? "Đang tìm số. Số điện thoại sẽ tự hiển thị ngay khi sẵn sàng."
				: "Đã thuê số thành công. Hệ thống đang kiểm tra OTP.");
			loadUserOrders();
		} catch (rentError) {
			setError(rentError.message || "Không thể thuê số lúc này.");
			loadUserOrders();
		} finally {
			isRentingRef.current = false;
			setBusy(false);
		}
	};

	const handleZaloConfirm = async (targetGateway) => {
		if (isConfirmingZaloRef.current || busy || !zaloOrder?.orderId) return;
		isConfirmingZaloRef.current = true;
		setBusy(true);
		setError("");
		setNotice("");

		try {
			const response = await fetch("/api/sim/request", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action: "zalo_send",
					orderId: zaloOrder.orderId,
					requestId: zaloOrder.requestId,
					gateway: targetGateway,
				}),
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || result.message || "Không thể kích hoạt gửi SMS.");

			setZaloConfirmed(true);
			setZaloOrder((prev) => prev ? { ...prev, gateway: targetGateway, zaloStep: "waiting_otp" } : prev);
			setActiveOrder((prev) => prev ? { ...prev, gateway: targetGateway, carrier: targetGateway } : prev);
			setActiveOrders((current) => current.map((o) =>
				o.orderId === zaloOrder.orderId ? { ...o, gateway: targetGateway, carrier: targetGateway } : o
			));
			setPolling(true);
			setNotice(`🟢 Đã gửi SMS kích hoạt tới tổng đài ${targetGateway}! Hệ thống đang chờ mã OTP từ Zalo...`);
		} catch (err) {
			setError(err.message || "Lỗi kích hoạt tổng đài Zalo.");
		} finally {
			isConfirmingZaloRef.current = false;
			setBusy(false);
		}
	};

	const handleZaloCancel = async (orderId) => {
		if (cancellingId || !orderId) return;
		await cancelOrder(orderId);
		setZaloOrder(null);
		setZaloConfirmed(false);
	};

	const cancelOrder = async (orderId) => {
		if (cancellingId || !orderId) return;
		setCancellingId(orderId);
		setError("");
		setNotice("");
		try {
			const response = await fetch("/api/sim/cancel", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ orderId }),
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || "Không thể hủy phiên thuê.");
			if (result.balance !== undefined) {
				setUser((current) => current ? { ...current, balance: result.balance } : current);
			}
			setActiveOrders((current) => current.map((order) =>
				order.orderId === orderId ? { ...order, status: "EXPIRED" } : order
			));
			setActiveOrder((current) =>
				current?.orderId === orderId ? { ...current, status: "EXPIRED" } : current
			);
			setZaloOrder((current) =>
				current?.orderId === orderId ? { ...current, status: "EXPIRED" } : current
			);
			setNotice("Đã hủy số thành công; số tiền đã được hoàn trả ngay vào ví.");
			loadUserOrders();
		} catch (err) {
			setError(err.message || "Không thể hủy phiên lúc này.");
		} finally {
			setCancellingId("");
		}
	};

	const copyText = async (text, id, message = "Đã sao chép!") => {
		if (!text) return;
		try {
			await navigator.clipboard.writeText(String(text));
			setCopiedField(id);
			setNotice(message);
			setTimeout(() => setCopiedField(""), 2000);
		} catch {
			setError("Không thể sao chép. Vui lòng kiểm tra quyền truy cập clipboard.");
		}
	};

	const renderStatusBadge = (status, orderItem = null) => {
		const isNoRefund = orderItem?.service === "sms_combo" || (orderItem?.service === "zalo" && (orderItem?.carrier === "8500" || orderItem?.carrier === "7539" || orderItem?.gateway || orderItem?.zaloStep === "waiting_otp"));
		switch (status) {
			case "COMPLETED": return <span className="history-status-badge success">✓ Đã nhận OTP</span>;
			case "PENDING":
			case "REQUESTING": return <span className="history-status-badge pending">⏳ Đang chờ OTP</span>;
			case "EXPIRED": return <span className="history-status-badge expired">{isNoRefund ? "Hết hạn (Đã gửi SMS)" : "Hoàn tiền (Hết hạn)"}</span>;
			case "FAILED": return <span className="history-status-badge failed">{isNoRefund ? "Thất bại (Đã gửi SMS)" : "Thất bại (Đã hoàn)"}</span>;
			default: return <span className="history-status-badge default">{status}</span>;
		}
	};

	if (loading || !user) {
		return (
			<main className="page-shell modern-dark-shell">
				<div className="loading-state-wrapper"><div className="app-loader-spinner"></div><p>Đang kết nối hệ thống <strong>SIM OTP</strong>...</p></div>
			</main>
		);
	}

	const minutes = String(Math.floor(remaining / 60)).padStart(2, "0");
	const seconds = String(remaining % 60).padStart(2, "0");
	const isTerminal = ["COMPLETED", "EXPIRED", "FAILED"].includes(activeOrder?.status);
	const orderStatusLabel = activeOrder?.status === "COMPLETED" ? "Đã nhận mã OTP thành công"
		: activeOrder?.status === "EXPIRED" ? "Phiên đã hết hạn (Đã hoàn tiền)"
			: activeOrder?.status === "FAILED" ? "Không tạo được phiên"
				: activeOrder ? polling ? "Đang chờ tin nhắn OTP..." : "Đang tạm dừng kiểm tra"
					: "Chưa có phiên hoạt động";
	const activeSessionCount = activeOrders.filter((order) => ACTIVE_ORDER_STATUSES.includes(order.status)).length;

	if (!rentalMode) {
		const recentOrders = userOrders.slice(0, 6);
		return (
			<main className="page-shell modern-dark-shell dashboard-intro-shell">
				<Header user={user} />
				<div className="dashboard-content-container">
					{/* Top Hero Section */}
					<section className="dashboard-hero-split-grid">
						{/* Left Column: Brand Intro & Features */}
						<div className="hero-intro-left-panel">
							<div className="hero-badge-row">
								<span className="hero-badge-pill highlight">
									<span className="live-dot-pulse"></span>
									⚡ Nền tảng dịch vụ tự động hóa
								</span>
								<span className="hero-badge-pill">
									Số liệu realtime
								</span>
							</div>

							<h1 className="hero-brand-heading">
								SIM OTP<br />
								<span className="text-gradient">Giao diện mới, nhanh hơn, rõ hơn.</span>
							</h1>

							<p className="hero-brand-desc">
								Một trung tâm thao tác cho dịch vụ thuê SIM OTP, nhận mã tự động, API và các công cụ hỗ trợ được sắp xếp lại theo hướng hiện đại, dễ tìm và dễ dùng ngay từ màn hình đầu tiên.
							</p>

							<div className="hero-cta-button-row">
								<Link className="primary-action-btn hero-cta-btn" href="/dashboard/tiktok">
									<span>🎵 Thuê SIM TikTok V1</span>
									<span aria-hidden="true">→</span>
								</Link>
								<Link className="secondary-glass-btn hero-sub-btn" href="/dashboard/shopee">
									<span>⚡ Thuê SIM Shopee</span>
								</Link>
								<Link className="secondary-glass-btn hero-sub-btn" href="/dashboard/other">
									<span>✨ Dịch vụ khác</span>
								</Link>
								<Link className="secondary-glass-btn hero-sub-btn" href="/history">
									<span>⏱ Lịch sử thuê</span>
								</Link>
								<a
									className="secondary-glass-btn hero-sub-btn"
									href="https://t.me/Vuha_cute_dapxe_trenpho"
									target="_blank"
									rel="noopener noreferrer"
								>
									<span>💬 Hỗ trợ Telegram</span>
								</a>
							</div>

							{/* 4 Feature Cards */}
							<div className="hero-feature-cards-grid">
								<div className="feature-mini-card glass-panel">
									<div className="feature-mini-icon emerald">🔒</div>
									<div className="feature-mini-copy">
										<strong>Bảo mật cao</strong>
										<p>Mã hóa an toàn, kiểm soát truy cập chặt</p>
									</div>
								</div>
								<div className="feature-mini-card glass-panel">
									<div className="feature-mini-icon amber">⚡</div>
									<div className="feature-mini-copy">
										<strong>Tốc độ nhanh</strong>
										<p>Luồng xử lý tối ưu, giảm thao tác thừa</p>
									</div>
								</div>
								<div className="feature-mini-card glass-panel">
									<div className="feature-mini-icon cyan">🕒</div>
									<div className="feature-mini-copy">
										<strong>Hoạt động 24/7</strong>
										<p>Dịch vụ luôn sẵn sàng theo thời gian thực</p>
									</div>
								</div>
								<div className="feature-mini-card glass-panel">
									<div className="feature-mini-icon violet">💳</div>
									<div className="feature-mini-copy">
										<strong>Hoàn tiền tự động</strong>
										<p>Hoàn tiền nếu dịch vụ không thành công</p>
									</div>
								</div>
							</div>
						</div>

						{/* Right Column: Live Overview & Quick Shortcuts */}
						<div className="hero-overview-right-panel glass-panel">
							<div className="overview-header-row">
								<div>
									<span className="overview-eyebrow">LIVE OVERVIEW</span>
									<h2 className="overview-title">Một cái nhìn nhanh trước khi thao tác</h2>
								</div>
								<span className="overview-globe-badge">🌐</span>
							</div>

							{/* 4 Stats Pills */}
							<div className="overview-stats-grid">
								<div className="overview-stat-cell">
									<div className="stat-cell-meta">
										<small>DỊCH VỤ</small>
										<strong>{availableServices.length || 7}+ Gói</strong>
									</div>
									<span className="stat-cell-icon-badge amber">📦</span>
								</div>
								<div className="overview-stat-cell">
									<div className="stat-cell-meta">
										<small>TỐC ĐỘ</small>
										<strong>Realtime</strong>
									</div>
									<span className="stat-cell-icon-badge cyan">⚡</span>
								</div>
								<div className="overview-stat-cell">
									<div className="stat-cell-meta">
										<small>BẢO VỆ</small>
										<strong>24/7</strong>
									</div>
									<span className="stat-cell-icon-badge emerald">🛡️</span>
								</div>
								<div className="overview-stat-cell">
									<div className="stat-cell-meta">
										<small>HỖ TRỢ</small>
										<strong>Nhanh</strong>
									</div>
									<span className="stat-cell-icon-badge violet">💬</span>
								</div>
							</div>

							{/* Quick Shortcuts List */}
							<div className="overview-shortcuts-container">
								<div className="shortcuts-list-label">
									<span className="shortcuts-bullet">✓</span>
									<span>Lối vào nhanh</span>
								</div>

								<div className="shortcuts-menu-list">
									<Link href="/dashboard/tiktok" className="shortcut-action-item">
										<div className="shortcut-item-left">
											<span className="shortcut-item-icon">🎵</span>
											<span className="shortcut-item-label">Thuê SIM TikTok (SIM OTP TikTok V1)</span>
										</div>
										<span className="shortcut-item-arrow">›</span>
									</Link>

									<Link href="/dashboard/shopee" className="shortcut-action-item">
										<div className="shortcut-item-left">
											<span className="shortcut-item-icon">🛍️</span>
											<span className="shortcut-item-label">Thuê SIM Shopee</span>
										</div>
										<span className="shortcut-item-arrow">›</span>
									</Link>

									<Link href="/dashboard/other" className="shortcut-action-item">
										<div className="shortcut-item-left">
											<span className="shortcut-item-icon">✨</span>
											<span className="shortcut-item-label">Dịch vụ khác (Zalo, Gửi SMS)</span>
										</div>
										<span className="shortcut-item-arrow">›</span>
									</Link>

									<Link href="/history" className="shortcut-action-item">
										<div className="shortcut-item-left">
											<span className="shortcut-item-icon">⏱</span>
											<span className="shortcut-item-label">Lịch sử thuê số</span>
										</div>
										<span className="shortcut-item-arrow">›</span>
									</Link>

									<Link href="/deposit" className="shortcut-action-item">
										<div className="shortcut-item-left">
											<span className="shortcut-item-icon">💳</span>
											<span className="shortcut-item-label">Nạp tiền VietQR</span>
										</div>
										<span className="shortcut-item-arrow">›</span>
									</Link>

									<Link href="/settings" className="shortcut-action-item">
										<div className="shortcut-item-left">
											<span className="shortcut-item-icon">🔑</span>
											<span className="shortcut-item-label">Developer API Key & Cài đặt</span>
										</div>
										<span className="shortcut-item-arrow">›</span>
									</Link>

									<a
										href="https://t.me/spx_tracker_lvh205_bot"
										target="_blank"
										rel="noopener noreferrer"
										className="shortcut-action-item"
									>
										<div className="shortcut-item-left">
											<span className="shortcut-item-icon">🤖</span>
											<span className="shortcut-item-label">SPX Tracker Bot Telegram</span>
										</div>
										<span className="shortcut-item-arrow">↗</span>
									</a>
								</div>
							</div>
						</div>
					</section>

					{/* Section 2: Services Catalog */}
					<section className="dashboard-section-block" id="services-catalog">
						<div className="section-block-header">
							<div>
								<span className="section-eyebrow">DỊCH VỤ SẴN SÀNG</span>
								<h2 className="section-block-title">Dịch vụ thuê SIM & Tiện ích tự động</h2>
							</div>
							<p className="section-block-desc">
								Cổng phân phối số nhận mã OTP tức thì, hỗ trợ tất cả nhà mạng lớn với chính sách hoàn tiền 100% tự động.
							</p>
						</div>

						<div className="services-showcase-grid">
							{/* Card 1: TikTok SIM Rental */}
							<div className="service-feature-card glass-panel featured-service">
								<div className="service-card-top">
									<div className="service-card-icon-wrap">🎵</div>
									<span className="service-status-chip open">● ĐANG MỞ · HOT</span>
								</div>
								<div className="service-card-body">
									<h3 className="service-card-title">SIM OTP TikTok V1</h3>
									<p className="service-card-desc">
										Thuê số Việt Nam đăng ký và xác thực tài khoản TikTok tốc độ cao từ cổng ViOTP. Nhận mã OTP tự động tức thì, hỗ trợ đầy đủ 7 nhà mạng lớn.
									</p>
									<div className="service-card-meta-row">
										<span className="price-tag-pill">Chỉ từ <strong>{prices["simotp_tiktok_v1"] ? money.format(prices["simotp_tiktok_v1"]) : "5.000 ₫"}</strong> / số</span>
										<span className="carriers-tag-pill">⚡ 7 Nhà mạng</span>
									</div>
								</div>
								<div className="service-card-footer">
									<Link href="/dashboard/tiktok" className="primary-action-btn full-width-btn">
										<span>Thuê SIM TikTok V1 ngay</span>
										<span aria-hidden="true">→</span>
									</Link>
								</div>
							</div>

							{/* Card 2: Shopee SIM Rental */}
							<div className="service-feature-card glass-panel">
								<div className="service-card-top">
									<div className="service-card-icon-wrap">🛍️</div>
									<span className="service-status-chip open">● ĐANG MỞ</span>
								</div>
								<div className="service-card-body">
									<h3 className="service-card-title">Thuê SIM Shopee</h3>
									<p className="service-card-desc">
										Nhận mã OTP tạo và đăng nhập tài khoản Shopee siêu tốc. Hỗ trợ đầy đủ gói No-check và Check số với đa dạng nhà mạng (Viettel, VinaPhone, MobiFone, Vietnamobile, iTel, Wintel).
									</p>
									<div className="service-card-meta-row">
										<span className="price-tag-pill">Chỉ từ <strong>{prices["otissim_v8"] ? money.format(prices["otissim_v8"]) : prices["otissim_v7"] ? money.format(prices["otissim_v7"]) : "8.000 ₫"}</strong> / lượt</span>
										<span className="carriers-tag-pill">⚡ 7 Nhà mạng · SIM V8 VIP</span>
									</div>
								</div>
								<div className="service-card-footer">
									<Link href="/dashboard/shopee" className="primary-action-btn full-width-btn">
										<span>Thuê SIM Shopee ngay</span>
										<span aria-hidden="true">→</span>
									</Link>
								</div>
							</div>

							{/* Card: Shopee F02 SIM Rental */}
							<div className="service-feature-card glass-panel">
								<div className="service-card-top">
									<div className="service-card-icon-wrap">⚡</div>
									<span className="service-status-chip open">● ĐANG MỞ</span>
								</div>
								<div className="service-card-body">
									<h3 className="service-card-title">Shopee Đá Số (Chỉ F02)</h3>
									<p className="service-card-desc">
										Cổng cấp số chuyên biệt nhận mã OTP Shopee Đá Số (Chỉ F02) tốc độ cao, hỗ trợ kiểm tra và hủy số hoàn tiền tự động.
									</p>
									<div className="service-card-meta-row">
										<span className="price-tag-pill">Chỉ từ <strong>{prices["shopee_f02"] ? money.format(prices["shopee_f02"]) : "6.000 ₫"}</strong> / lượt</span>
										<span className="carriers-tag-pill">⚡ 7 Nhà mạng · Đá số F02</span>
									</div>
								</div>
								<div className="service-card-footer">
									<a
										href="#rental"
										className="secondary-glass-btn full-width-btn"
										onClick={() => {
											setService("shopee_f02");
											setCarrier("random");
										}}
									>
										<span>Chọn Shopee F02 ngay ↓</span>
									</a>
								</div>
							</div>

							{/* Card: SMS Combo Rental */}
							<div className="service-feature-card glass-panel">
								<div className="service-card-top">
									<div className="service-card-icon-wrap">📩</div>
									<span className="service-status-chip open">● ĐANG MỞ · MỚI</span>
								</div>
								<div className="service-card-body">
									<h3 className="service-card-title">Gửi SMS & Nhận OTP</h3>
									<p className="service-card-desc">
										Gửi tin nhắn SMS trực tiếp từ SIM đến số nhận chỉ định và tự động nhận mã OTP phản hồi, không cần thao tác thủ công.
									</p>
									<div className="service-card-meta-row">
										<span className="price-tag-pill">Chỉ từ <strong>{prices["sms_combo"] ? money.format(prices["sms_combo"]) : "6.000 ₫"}</strong> / lượt</span>
										<span className="carriers-tag-pill">📩 Gửi SMS + OTP</span>
									</div>
								</div>
								<div className="service-card-footer">
									<a
										href="#rental"
										className="secondary-glass-btn full-width-btn"
										onClick={() => {
											setService("sms_combo");
											setCarrier("random");
										}}
									>
										<span>Chọn Gửi SMS ngay ↓</span>
									</a>
								</div>
							</div>

							{/* Card: Zalo SIM Rental */}
							<div className="service-feature-card glass-panel">
								<div className="service-card-top">
									<div className="service-card-icon-wrap">💬</div>
									<span className="service-status-chip open">● ĐANG MỞ · MỚI</span>
								</div>
								<div className="service-card-body">
									<h3 className="service-card-title">Tạo Acc Zalo (8500 / 7539)</h3>
									<p className="service-card-desc">
										Tạo tài khoản Zalo qua 2 đầu số Gateway 8500 và 7539. Cấp số siêu tốc và tự động bắt mã OTP trả về ngay tức thì.
									</p>
									<div className="service-card-meta-row">
										<span className="price-tag-pill">Chỉ từ <strong>{prices["zalo"] ? money.format(prices["zalo"]) : "5.000 ₫"}</strong> / lượt</span>
										<span className="carriers-tag-pill">⚡ Gateway 8500 / 7539</span>
									</div>
								</div>
								<div className="service-card-footer">
									<a
										href="#rental"
										className="secondary-glass-btn full-width-btn"
										onClick={() => {
											setService("zalo");
											setCarrier("8500");
										}}
									>
										<span>Chọn SIM Zalo ngay ↓</span>
									</a>
								</div>
							</div>

							{/* Card 2: VietQR Deposit */}
							<div className="service-feature-card glass-panel">
								<div className="service-card-top">
									<div className="service-card-icon-wrap">💳</div>
									<span className="service-status-chip auto">⚡ TỰ ĐỘNG 24/7</span>
								</div>
								<div className="service-card-body">
									<h3 className="service-card-title">Nạp tiền VietQR</h3>
									<p className="service-card-desc">
										Quét mã QR thanh toán nhanh qua hơn 40+ ngân hàng Việt Nam và ví điện tử. Hệ thống tự động kiểm tra giao dịch và cộng số dư trong 3 - 5 giây.
									</p>
									<div className="service-card-meta-row">
										<span className="price-tag-pill">Hạn mức từ <strong>10.000 ₫</strong></span>
										<span className="carriers-tag-pill">🟢 Tức thì</span>
									</div>
								</div>
								<div className="service-card-footer">
									<Link href="/deposit" className="secondary-glass-btn full-width-btn">
										<span>Nạp tiền tài khoản ↗</span>
									</Link>
								</div>
							</div>

							{/* Card 3: SPX Telegram Bot */}
							<div className="service-feature-card glass-panel">
								<div className="service-card-top">
									<div className="service-card-icon-wrap">🤖</div>
									<span className="service-status-chip free">🎁 MIỄN PHÍ</span>
								</div>
								<div className="service-card-body">
									<h3 className="service-card-title">Bot SPX Tracking</h3>
									<p className="service-card-desc">
										Trợ lý Telegram check tình trạng vận đơn Shopee Express tự động 24/7. Nhận thông báo hành trình kiện hàng nhanh và chính xác nhất.
									</p>
									<div className="service-card-meta-row">
										<span className="price-tag-pill">@spx_tracker_lvh205_bot</span>
										<span className="carriers-tag-pill">🤖 Bot Telegram</span>
									</div>
								</div>
								<div className="service-card-footer">
									<a
										href="https://t.me/spx_tracker_lvh205_bot"
										target="_blank"
										rel="noopener noreferrer"
										className="secondary-glass-btn full-width-btn"
									>
										<span>Mở Bot Telegram ↗</span>
									</a>
								</div>
							</div>
						</div>
					</section>

					{/* Section 3: Recent Rental History */}
					<section className="dashboard-section-block" id="recent-history">
						<div className="section-block-header-split">
							<div>
								<span className="section-eyebrow">LỊCH SỬ THAO TÁC</span>
								<h2 className="section-block-title">⏱ Lịch sử thuê SIM gần đây</h2>
							</div>
							<Link href="/history" className="view-all-link-btn">
								<span>Xem tất cả ({ordersTotal})</span>
								<span aria-hidden="true">→</span>
							</Link>
						</div>

						<div className="recent-history-container glass-panel">
							{ordersLoading && !recentOrders.length ? (
								<div className="history-empty-placeholder">
									<div className="app-loader-spinner mini"></div>
									<p>Đang tải danh sách lịch sử thuê...</p>
								</div>
							) : recentOrders.length > 0 ? (
								<div className="table-responsive-wrapper">
									<table className="modern-data-table">
										<thead>
											<tr>
												<th>SỐ ĐIỆN THOẠI</th>
												<th>GÓI DỊCH VỤ</th>
												<th>NHÀ MẠNG</th>
												<th>GIÁ TIỀN</th>
												<th>MÃ OTP</th>
												<th>TRẠNG THÁI</th>
												<th>THỜI GIAN</th>
											</tr>
										</thead>
										<tbody>
											{recentOrders.map((ord) => (
												<tr key={ord.id} className="table-row-item">
													<td>
														<div className="phone-cell-wrapper">
															<strong className="mono-text phone-val">{ord.phone || "Đang cấp số..."}</strong>
															{ord.phone && (
																<button
																	type="button"
																	className="tiny-copy-btn"
																	onClick={() => copyText(ord.phone, `p_${ord.id}`, "Đã sao chép SĐT!")}
																	title="Sao chép số điện thoại"
																>
																	{copiedField === `p_${ord.id}` ? "✓" : "📋"}
																</button>
															)}
														</div>
													</td>
													<td>
														<span className="service-tag">{getServiceLabel(ord.service)}</span>
													</td>
													<td>
														<span className="carrier-tag">{getCarrierLabel(ord.carrier)}</span>
													</td>
													<td>
														<span className="cost-val mono-text">{ord.cost ? money.format(ord.cost) : "—"}</span>
													</td>
													<td>
														{ord.otp ? (
															<div className="otp-cell-wrapper">
																<strong className="mono-text otp-code-highlight">{ord.otp}</strong>
																<button
																	type="button"
																	className="tiny-copy-btn primary"
																	onClick={() => copyText(ord.otp, `o_${ord.id}`, "Đã sao chép mã OTP!")}
																	title="Sao chép mã OTP"
																>
																	{copiedField === `o_${ord.id}` ? "✓ Đã chép" : "Sao chép"}
																</button>
															</div>
														) : ord.status === "COMPLETED" ? (
															<span className="text-muted">—</span>
														) : ord.status === "PENDING" || ord.status === "REQUESTING" ? (
															<span className="waiting-otp-chip">
																<span className="live-dot-pulse"></span>
																Đang chờ...
															</span>
														) : (
															<span className="text-dim">Không có OTP</span>
														)}
													</td>
													<td>
														{renderStatusBadge(ord.status, ord)}
													</td>
													<td>
														<span className="time-val text-muted">{formatDateTime(ord.createdAt)}</span>
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							) : (
								<div className="history-empty-placeholder">
									<span className="empty-icon">📱</span>
									<h3>Chưa có lượt thuê SIM nào</h3>
									<p>Bạn chưa thực hiện phiên thuê số nào. Hãy bấm bắt đầu để thuê số nhận OTP ngay.</p>
									<Link href="/dashboard/shopee" className="primary-action-btn">
										<span>Thuê SIM Shopee đầu tiên</span>
										<span aria-hidden="true">→</span>
									</Link>
								</div>
							)}
						</div>
					</section>
				</div>
				<Footer />
				<TelegramBotWidget />
			</main>
		);
	}

	const isTikTok = serviceFilter === "tiktok";
	const isShopee = serviceFilter === "shopee";
	const isOther = serviceFilter === "other";
	const workspaceTitle = isTikTok
		? "Thuê SIM TikTok (SIM OTP TikTok V1)"
		: isShopee
		? "Thuê SIM Shopee"
		: isOther
		? "Dịch vụ khác (Tạo Acc Zalo, Gửi SMS)"
		: "Thuê SIM OTP";
	const serviceSelectLabel = isTikTok
		? "Chọn gói SIM TikTok:"
		: isShopee
		? "Chọn gói SIM Shopee:"
		: isOther
		? "Chọn dịch vụ khác:"
		: "Chọn gói dịch vụ:";

	return (
		<main className="page-shell modern-dark-shell rental-workspace-shell">
			<Header user={user} />
			<div className="dashboard-content-wrapper">
				<section className="dashboard-hero-banner glass-panel">
					<div className="banner-left-copy">
						<div className="banner-tag">
							<span className="live-dot-pulse"></span>
							{isTikTok
								? "NỀN TẢNG THUÊ SIM TIKTOK V1 TỰ ĐỘNG"
								: isOther
								? "CỔNG DỊCH VỤ KHÁC (ZALO, GỬI SMS & OTP)"
								: "NỀN TẢNG THUÊ SIM OTP TỰ ĐỘNG & CHECK ĐƠN SPX"}
						</div>
						<h1 className="banner-heading">
							{isTikTok ? (
								<>SIM OTP TikTok V1.<br /><span className="text-gradient">Thuê số & Nhận OTP TikTok tức thì.</span></>
							) : isOther ? (
								<>Dịch vụ khác.<br /><span className="text-gradient">Tạo Acc Zalo & Gửi SMS nhận OTP.</span></>
							) : (
								<>SIM OTP & SPX Bot.<br /><span className="text-gradient">Thuê số & Check đơn tức thì.</span></>
							)}
						</h1>
						<p className="banner-desc">
							{isTikTok
								? "Hệ thống phân phối số TikTok tự động 24/7 từ cổng ViOTP. Hỗ trợ đa nhà mạng Việt Nam, nhận mã OTP tức thì và hoàn tiền 100% tự động nếu không nhận được OTP."
								: isOther
								? "Cung cấp các cổng dịch vụ đặc biệt: Tạo tài khoản Zalo qua Gateway 8500 / 7539 và Gửi SMS trực tiếp từ SIM kèm bắt mã OTP tự động."
								: "Hệ thống phân phối số tự động 24/7. Hỗ trợ đa nhà mạng, bảo vệ số dư với chính sách hoàn tiền 100% tự động nếu không nhận được OTP."}
						</p>
						<div className="banner-action-buttons">
							<a className="primary-action-btn hero-cta" href="#rental">🚀 Thuê số ngay</a>
							<Link href="/deposit" className="secondary-glass-btn">💳 Nạp tiền VietQR ↗</Link>
							<Link href="/history" className="secondary-glass-btn">⏱ Lịch sử thuê ({ordersTotal})</Link>
							<Link href="/settings" className="secondary-glass-btn">⚙️ Cài đặt & API Key ↗</Link>
						</div>
					</div>
					<div className="banner-metrics-grid">
						<div className="metric-box"><div className="metric-box-top"><span>CỔNG KẾT NỐI</span><span className="metric-icon-badge emerald">⚡</span></div><strong>{isTikTok ? "SIM OTP TIKTOK V1" : "SIM OTP PRO"}</strong><small>{providerReady ? "🟢 Hoạt động ổn định" : "⚠️ Cần kiểm tra"}</small></div>
						<div className="metric-box"><div className="metric-box-top"><span>DỊCH VỤ SIM</span><span className="metric-icon-badge cyan">📦</span></div><strong>{availableServices.length} Gói SIM</strong><small>Sẵn sàng cho tài khoản</small></div>
						<div className="metric-box"><div className="metric-box-top"><span>NHÀ MẠNG</span><span className="metric-icon-badge violet">📡</span></div><strong>{availableCarriers.length} Lựa chọn</strong><small>{serviceInfo?.label || "Đang chọn dịch vụ"}</small></div>
						<div className="metric-box"><div className="metric-box-top"><span>ĐÃ THUÊ</span><span className="metric-icon-badge gold">📱</span></div><strong>{ordersTotal} Số đã thuê</strong><small>{activeOrder ? activeOrder.status : "Sẵn sàng thuê mới"}</small></div>
					</div>
				</section>

				{/* Section Heading */}
				<div className="workspace-section-header">
					<div>
						<span className="section-eyebrow">KHÔNG GIAN LÀM VIỆC</span>
						<h2>{workspaceTitle}</h2>
					</div>
					<div className="auto-refresh-indicator">
						<span className="live-dot-pulse"></span>
						<span>Real-time Polling 3s</span>
					</div>
				</div>

				{/* Main 2-Column Grid */}
				<div className="dashboard-main-grid">
					<section className="rental-main-card glass-panel" id="rental">
						<div className="card-header-row">
							<div className="header-title-group">
								<span className="header-step-num">01</span>
								<div>
									<h3>Chọn loại SIM & Nhà mạng</h3>
									<p>Lựa chọn gói dịch vụ phù hợp với nhu cầu nhận OTP.</p>
								</div>
							</div>
							<span className="status-live-chip">SẴN SÀNG</span>
						</div>

						<form className="rental-action-form" onSubmit={rentNumber}>
							<div className="service-cards-container">
								<label className="field-group-label">{serviceSelectLabel}</label>
								<div className="service-cards-grid">
									{availableServices.map((item) => {
										const itemCarriers = getSupportedCarriers(item.id, provider);
										const isSelected = service === item.id;
										return (
											<button
												type="button"
												key={item.id}
												className={`service-select-card ${isSelected ? "selected" : ""}`}
												onClick={() => {
													setService(item.id);
													const supported = getSupportedCarriers(item.id, provider);
													setCarrier(supported.includes("random") ? "random" : supported[0] || "");
												}}
											>
												<div className="card-top-line">
													<strong className="service-name">{item.label}</strong>
													<span className="service-price">{prices[item.id] ? money.format(prices[item.id]) : "—"}</span>
												</div>
												<div className="card-bottom-line">
													<span className={`mode-badge ${item.mode === "Check số" ? "mode-check" : "mode-nocheck"}`}>{item.mode}</span>
													<span className="carrier-count">{itemCarriers.length} nhà mạng</span>
												</div>
												{isSelected && <span className="card-check-marker">✓</span>}
											</button>
										);
									})}
									{!availableServices.length && (
										<div className="service-empty-notice">{providerMessage || "Chưa có dịch vụ nào khả dụng."}</div>
									)}
								</div>
							</div>

							{serviceInfo && (
								<div className="service-info-snippet">
									<span className="info-icon">💡</span>
									<span>{serviceInfo.description}</span>
								</div>
							)}

							{service === "zalo" ? (
								<div className="zalo-workflow-container">
									{(!zaloOrder || TERMINAL_ORDER_STATUSES.includes(zaloOrder.status)) ? (
										<div className="zalo-pre-request-card" style={{ padding: "18px 20px", borderRadius: "var(--radius-lg)", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", marginTop: 14 }}>
											<div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
												<span style={{ fontSize: 26, lineHeight: 1 }}>💬</span>
												<div>
													<h4 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "var(--text-main)" }}>Quy trình tạo Nick Zalo chuẩn 2 bước:</h4>
													<p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
														Hệ thống cấp số trước → Bạn nhập vào Zalo kiểm tra → Bấm nút <strong>Tạo 8500</strong> hoặc <strong>Tạo 7539</strong> tương ứng theo app Zalo yêu cầu.
													</p>
												</div>
											</div>
											<div className="checkout-summary-bar" style={{ marginBottom: 16 }}>
												<div className="summary-col">
													<small>GIÁ LƯỢT TẠO</small>
													<strong>{price ? money.format(price) : "Chưa có giá"}</strong>
												</div>
												<div className="summary-sep"></div>
												<div className="summary-col">
													<small>QUY ĐỊNH TRỪ TIỀN</small>
													<strong className="text-emerald">Hoàn 100% nếu ấn Hủy Số</strong>
												</div>
											</div>
											<button
												type="button"
												className="primary-action-btn rent-submit-btn"
												style={{ pointerEvents: busy ? "none" : "auto" }}
												disabled={busy || !providerReady || !price || (Number(user?.balance ?? 0) < price)}
												onClick={rentNumber}
											>
												{busy ? <><span className="mini-spinner"></span><span>Đang kết nối lấy số...</span></> : "📲 Lấy số Zalo kiểm tra ngay"}
											</button>
										</div>
									) : !zaloConfirmed ? (
										<div className="zalo-verify-workflow-card">
											<div className="zalo-phone-banner">
												<span className="zalo-banner-emojis">👉👉👉</span>
												<span className="zalo-banner-sep">---</span>
												<span className="zalo-banner-label">SĐT:</span>
												<span className="zalo-banner-phone mono-text">{zaloOrder.phone || "Đang lấy..."}</span>
												<span className="zalo-banner-sep">---</span>
												<span className="zalo-banner-emojis">👈👈👈</span>
												{zaloOrder.phone && (
													<button
														type="button"
														className="copy-action-btn primary-copy-btn"
														onClick={() => copyText(zaloOrder.phone, `zalo_p_${zaloOrder.orderId}`, "Đã chép số điện thoại Zalo!")}
													>
														{copiedField === `zalo_p_${zaloOrder.orderId}` ? "✓ Đã chép" : "📋 Sao chép SĐT"}
													</button>
												)}
											</div>

											<div className="zalo-instructions-list">
												<div className="zalo-instruction-item">
													<span className="zalo-item-icon">👉</span>
													<span><strong>Số có hạn 5p</strong> kể từ khi lấy số (còn lại: <strong className="text-emerald">{Math.floor(Math.max(0, (zaloOrder.expiresAt - clockNow) / 1000) / 60)}:{(Math.max(0, Math.ceil((zaloOrder.expiresAt - clockNow) / 1000)) % 60).toString().padStart(2, '0')}</strong>)</span>
												</div>
												<div className="zalo-instruction-item warning-highlight">
													<span className="zalo-item-icon">👉</span>
													<span><strong>Lưu ý:</strong> Phải vào Zalo nhập số trước rồi mới ấn Tạo bên dưới và nhập mã ngay khi có mã, tránh trường hợp hết hạn mã.</span>
												</div>
												<div className="zalo-instruction-item">
													<span className="zalo-item-icon">👉</span>
													<span>Bot chỉ soạn hộ, mã hiện như thế nào là do thao tác người sử dụng trên app ZALO.</span>
												</div>
												<div className="zalo-instruction-item price-highlight">
													<span className="zalo-item-icon">👉</span>
													<span>💰 <strong>Cước phí: {money.format(zaloOrder.cost || price)}</strong> <em className="text-muted">(Tạm giữ cước, hoàn 100% về ví nếu bạn bấm Hủy Số)</em></span>
												</div>
											</div>

											<div className="zalo-action-buttons-grid">
												<button
													type="button"
													className="zalo-action-btn btn-tao-8500"
													onClick={() => handleZaloConfirm("8500")}
													disabled={busy}
												>
													<span>📲 Tạo 8500</span>
												</button>

												<button
													type="button"
													className="zalo-action-btn btn-tao-7539"
													onClick={() => handleZaloConfirm("7539")}
													disabled={busy}
												>
													<span>📲 Tạo 7539</span>
												</button>

												<button
													type="button"
													className="zalo-action-btn btn-cancel-zalo"
													onClick={() => handleZaloCancel(zaloOrder.orderId)}
													disabled={busy || cancellingId === zaloOrder.orderId}
												>
													<span>{cancellingId === zaloOrder.orderId ? "Đang huỷ..." : "📱 Huỷ Số"}</span>
												</button>
											</div>
										</div>
									) : (
										<div className="zalo-confirmed-active-card" style={{ padding: "18px 20px", borderRadius: "var(--radius-lg)", background: "rgba(16, 185, 129, 0.05)", border: "1.5px solid rgba(16, 185, 129, 0.4)", marginTop: 14 }}>
											<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
												<div>
													<span style={{ fontSize: 11, fontWeight: 800, color: "var(--emerald)", textTransform: "uppercase", letterSpacing: 1 }}>
														🟢 ĐÃ XÁC NHẬN CỔNG {zaloOrder.gateway || "8500"}
													</span>
													<h4 style={{ margin: "2px 0 0", fontSize: 16, fontWeight: 800, color: "var(--text-main)" }}>
														{zaloOrder.otp ? "Đã nhận mã OTP thành công!" : "Đang chờ mã OTP từ Zalo..."}
													</h4>
												</div>
												<span className="mono-text" style={{ fontSize: 13, fontWeight: 700, color: "var(--emerald)" }}>
													{Math.floor(Math.max(0, (zaloOrder.expiresAt - clockNow) / 1000) / 60)}:{(Math.max(0, Math.ceil((zaloOrder.expiresAt - clockNow) / 1000)) % 60).toString().padStart(2, '0')}
												</span>
											</div>

											<div className="phone-number-box" style={{ marginBottom: 14 }}>
												<div className="phone-number-value">{zaloOrder.phone}</div>
												<button
													type="button"
													className="copy-action-btn"
													onClick={() => copyText(zaloOrder.phone, `zalo_cf_${zaloOrder.orderId}`, "Đã chép SĐT!")}
												>
													{copiedField === `zalo_cf_${zaloOrder.orderId}` ? "✓ Đã chép" : "📋 Sao chép SĐT"}
												</button>
											</div>

											{zaloOrder.otp ? (
												<div className="otp-result-container" style={{ marginBottom: 14 }}>
													<span className="otp-title">MÃ XÁC THỰC ZALO (OTP)</span>
													<div className="otp-display-row">
														<strong className="otp-number">{zaloOrder.otp}</strong>
														<button
															type="button"
															className="copy-action-btn primary-copy-btn"
															onClick={() => copyText(zaloOrder.otp, `otp_${zaloOrder.orderId}`, "Đã chép mã OTP Zalo!")}
														>
															{copiedField === `otp_${zaloOrder.orderId}` ? "✓ Đã chép" : "Sao chép OTP"}
														</button>
													</div>
												</div>
											) : (
												<div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 14px", background: "rgba(0,0,0,0.25)", borderRadius: 8, marginBottom: 14 }}>
													<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
														<div className="timer-radar-pulse" style={{ margin: 0 }}>
															<span className="radar-circle"></span>
															<span>Đang lắng nghe mã kích hoạt Zalo...</span>
														</div>
														<span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>Tự động bắt OTP</span>
													</div>
													<div style={{ fontSize: 11.5, color: "#f59e0b", background: "rgba(245, 158, 11, 0.08)", padding: "6px 10px", borderRadius: 6, display: "flex", alignItems: "center", gap: 6 }}>
														<span>⚠️</span>
														<span>SIM đã phát sinh cước gửi SMS tới tổng đài {zaloOrder.gateway || "8500"} (Không hỗ trợ hủy/hoàn tiền).</span>
													</div>
												</div>
											)}

											<div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
												<button
													type="button"
													className="secondary-glass-btn"
													style={{ padding: "8px 16px", fontSize: 13 }}
													onClick={() => {
														setZaloOrder(null);
														setZaloConfirmed(false);
													}}
												>
													+ Thuê số Zalo mới
												</button>
											</div>
										</div>
									)}
								</div>
							) : (
								<>
									<div className="carrier-selection-group">
										<label className="field-group-label" htmlFor="carrier-picker-mobile">
											Chọn nhà mạng: <span className="text-muted">({availableCarriers.length} khả dụng)</span>
										</label>
										<select
											id="carrier-picker-mobile"
											className="carrier-picker-mobile"
											value={carrier}
											onChange={(event) => setCarrier(event.target.value)}
										>
											{availableCarriers.map((value) => <option key={value} value={value}>{SIM_CARRIER_LABELS[value] || value}</option>)}
										</select>
										<div className="carrier-pills-row">
											{availableCarriers.map((value) => (
												<button
													type="button"
													key={value}
													className={`carrier-pill-btn ${carrier === value ? "active" : ""}`}
													onClick={() => setCarrier(value)}
												>
													<span className="carrier-bullet"></span>
													<span>{SIM_CARRIER_LABELS[value] || value}</span>
												</button>
											))}
										</div>
									</div>

									{service === "sms_combo" && (
										<div className="sms-inputs-group" style={{ marginBottom: 16, padding: 14, borderRadius: 10, background: "rgba(255, 255, 255, 0.04)", border: "1px solid var(--border)" }}>
											<label className="field-group-label" style={{ marginBottom: 8, display: "block" }}>
												📩 Cấu hình gửi SMS & Nhận OTP:
											</label>
											<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
												<div>
													<span style={{ fontSize: 11.5, color: "var(--text-muted)", display: "block", marginBottom: 4, fontWeight: 600 }}>SĐT NGƯỜI NHẬN</span>
													<input
														type="text"
														className="admin-input-field mono-text"
														placeholder="VD: 19001221 hoặc SĐT nhận"
														value={smsRecipient}
														onChange={(e) => setSmsRecipient(e.target.value)}
														style={{ width: "100%", padding: "8px 12px", borderRadius: 8 }}
													/>
												</div>
												<div>
													<span style={{ fontSize: 11.5, color: "var(--text-muted)", display: "block", marginBottom: 4, fontWeight: 600 }}>NỘI DUNG TIN NHẮN (SMS)</span>
													<input
														type="text"
														className="admin-input-field mono-text"
														placeholder="VD: DK hoặc cú pháp dịch vụ"
														value={smsText}
														onChange={(e) => setSmsText(e.target.value)}
														style={{ width: "100%", padding: "8px 12px", borderRadius: 8 }}
													/>
												</div>
											</div>
											<div style={{ fontSize: 11.5, color: "#f59e0b", marginTop: 8, background: "rgba(245, 158, 11, 0.08)", padding: "8px 12px", borderRadius: 6, display: "flex", alignItems: "center", gap: 6 }}>
												<span>⚠️</span>
												<span><strong>Lưu ý:</strong> Cổng sẽ gửi SMS trực tiếp từ SIM tới số người nhận. Dịch vụ này <strong>không hỗ trợ hủy hay hoàn tiền</strong> vì SIM đã gửi tin nhắn đi.</span>
											</div>
										</div>
									)}

									<div className="checkout-summary-bar">
										<div className="summary-col">
											<small>GIÁ LƯỢT THUÊ</small>
											<strong>{price ? money.format(price) : "Chưa có giá"}</strong>
										</div>
										<div className="summary-sep"></div>
										<div className="summary-col">
											<small>SỐ DƯ SAU GIỮ TIỀN</small>
											<strong className="text-emerald">{money.format(Math.max(0, (user.balance || 0) - price))}</strong>
										</div>
									</div>

									<button
										type="submit"
										className="primary-action-btn rent-submit-btn"
										style={{ pointerEvents: busy ? "none" : "auto" }}
										disabled={busy || !providerReady || !service || !availableCarriers.includes(carrier) || !price || (Number(user?.balance ?? 0) < price)}
									>
										{busy ? <><span className="mini-spinner"></span><span>Đang kết nối lấy số...</span></> : "🚀 Thuê số ngay"}
									</button>
								</>
							)}

							{(Number(user?.balance ?? 0) < price) && (
								<div className="low-balance-warning-box">
									<div className="warning-left"><span className="warning-icon">⚠️</span><span>Số dư tài khoản chưa đủ để thực hiện thuê số.</span></div>
									<Link href="/deposit" className="quick-deposit-accent-btn">💳 Nạp tiền ngay ↗</Link>
								</div>
							)}
						</form>
					</section>

					<aside className="dashboard-sidebar-column">
						{/* Box 02: Active Sessions & Multi-rent */}
						<section className="multi-session-card glass-panel">
							<div className="card-header-row">
								<div className="header-title-group">
									<span className="header-step-num coral">02</span>
									<div>
										<h3>Phiên thuê ({activeSessionCount} đang chạy)</h3>
										<p>Mỗi số được theo dõi và hoàn tiền riêng.</p>
									</div>
								</div>
								{activeSessionCount > 0 && (
									<button type="button" className="control-quiet-btn session-poll-toggle" onClick={() => setPolling((current) => !current)}>
										{polling ? "⏸ Dừng kiểm tra" : "▶ Tiếp tục"}
									</button>
								)}
							</div>

							<div className="session-multi-rent-hint">
								<span className="hint-icon">💡</span>
								<span>Thuê thêm số bất cứ lúc nào nếu số dư còn đủ.</span>
							</div>

							{activeOrders.length ? (
								<div className="session-order-list">
									{activeOrders.map((order) => {
										const isOrderTerminal = TERMINAL_ORDER_STATUSES.includes(order.status);
										const orderSeconds = Math.max(0, Math.ceil((Number(order.expiresAt || 0) - clockNow) / 1000));
										const orderMinutesLabel = String(Math.floor(orderSeconds / 60)).padStart(2, "0");
										const orderSecondsLabel = String(orderSeconds % 60).padStart(2, "0");
										const statusText = order.status === "COMPLETED" ? "Đã nhận mã OTP thành công"
											: order.status === "EXPIRED" ? "Phiên đã hết hạn (đã hoàn tiền)"
												: order.status === "FAILED" ? "Không tạo được phiên"
													: order.status === "REQUESTING" ? "Đang khởi tạo phiên..."
														: "Đang chờ tin nhắn OTP...";
										return (
											<article className="session-order-entry" key={order.orderId}>
												<div className="session-status-row">
													<span className={`status-indicator-dot ${order.status.toLowerCase()}`}></span>
													<strong>{statusText}</strong>
													<span className="session-price-tag">{money.format(order.cost || price)}</span>
												</div>
												<div className="phone-number-box">
													<div className="phone-number-value">{order.phone || "Đang lấy số..."}</div>
													<button type="button" className="copy-action-btn" onClick={() => copyText(order.phone, `phone-${order.orderId}`, "Đã chép số điện thoại!")} disabled={!order.phone}>
														{copiedField === `phone-${order.orderId}` ? "✓ Đã chép" : "📋 Sao chép"}
													</button>
												</div>
												{order.status === "COMPLETED" ? (
													<div className="otp-result-container">
														<span className="otp-title">MÃ XÁC THỰC (OTP)</span>
														<div className="otp-display-row">
															<strong className="otp-number">{order.otp || "Không có mã"}</strong>
															<button type="button" className="copy-action-btn primary-copy-btn" onClick={() => copyText(order.otp, `otp-${order.orderId}`, "Đã chép mã OTP!")}>{copiedField === `otp-${order.orderId}` ? "✓ Đã chép" : "Sao chép OTP"}</button>
														</div>
													</div>
												) : isOrderTerminal ? (
													<p className="session-footer-note">{statusText}</p>
												) : (
													<>
														<div className="session-timer-row">
															<div className="timer-text"><span>Thời gian giữ số:</span><strong>{orderMinutesLabel}:{orderSecondsLabel}</strong></div>
															<div className="timer-radar-pulse"><span className="radar-circle"></span><span>{polling ? "Đang lắng nghe OTP" : "Tạm dừng kiểm tra"}</span></div>
														</div>
														<div style={{ display: "flex", justifyContent: "flex-end", marginTop: "4px" }}>
															{(order.service === "sms_combo" || (order.service === "zalo" && (order.zaloStep === "waiting_otp" || order.gateway))) ? (
																<span style={{ fontSize: 11, color: "var(--text-dim)", fontStyle: "italic" }}>
																	(Không hoàn tiền do đã gửi tin nhắn)
																</span>
															) : (
																<button
																	type="button"
																	className="cancel-order-action-btn"
																	disabled={cancellingId === order.orderId}
																	onClick={() => cancelOrder(order.orderId)}
																	title="Hủy phiên thuê và hoàn tiền vào ví ngay lập tức"
																>
																	{cancellingId === order.orderId ? "Đang hủy..." : "✕ Hủy số & hoàn tiền"}
																</button>
															)}
														</div>
													</>
												)}
											</article>
										);
									})}
								</div>
							) : (
								<div className="empty-session-state">
									<div className="empty-radar-circle">📶</div>
									<h4>Chưa có phiên thuê nào</h4>
									<p>Chọn dịch vụ và bấm <strong>Thuê số ngay</strong> để nhận mã OTP tức thì.</p>
								</div>
							)}
						</section>

						{/* Bottom Right: Recent Rental History Widget */}
						<section className="sidebar-recent-history-card glass-panel">
							<div className="card-header-row">
								<div className="header-title-group">
									<span className="header-step-num emerald">⏱</span>
									<div>
										<h3>Lịch sử thuê gần đây</h3>
										<p>Các số vừa thuê gần nhất</p>
									</div>
								</div>
								<Link href="/history" className="view-all-link">Xem tất cả ↗</Link>
							</div>

							{userOrders.length > 0 ? (
								<div className="sidebar-history-list">
									{userOrders.slice(0, 5).map((ord) => (
										<div className="sidebar-history-item" key={ord.id}>
											<div className="sidebar-item-top">
												<strong className="mono-text phone-val">{ord.phone || "—"}</strong>
												{renderStatusBadge(ord.status, ord)}
											</div>
											<div className="sidebar-item-meta">
												<span className="service-info-text">{getServiceLabel(ord.service)} · {getCarrierLabel(ord.carrier)}</span>
												<span className="cost-info-text">{ord.cost ? money.format(ord.cost) : "—"}</span>
											</div>
											{ord.otp && (
												<div className="sidebar-otp-highlight-row">
													<div className="otp-left">
														<span className="otp-label">OTP:</span>
														<strong className="mono-text otp-code">{ord.otp}</strong>
													</div>
													<button
														type="button"
														className="tiny-copy-btn primary"
														onClick={() => copyText(ord.otp, `side_otp_${ord.id}`, "Đã sao chép mã OTP!")}
													>
														{copiedField === `side_otp_${ord.id}` ? "✓ Đã chép" : "Sao chép"}
													</button>
												</div>
											)}
										</div>
									))}
								</div>
							) : (
								<div className="sidebar-history-empty">
									<p>Chưa có lịch sử thuê số nào.</p>
								</div>
							)}
						</section>

						{/* Compact Quick Deposit Card */}
						<section className="compact-quick-deposit-card glass-panel">
							<div className="quick-deposit-copy">
								<span className="quick-deposit-icon">💳</span>
								<div>
									<h4>Nạp tiền tự động VietQR</h4>
									<p>Quét mã 24/7, cộng tiền ngay sau 1-5s.</p>
								</div>
							</div>
							<Link
								href="/deposit"
								className="primary-action-btn quick-deposit-cta"
							>
								Nạp tiền ngay ↗
							</Link>
						</section>

						{/* Pricing Table Card */}
						<section className="pricing-card glass-panel" id="pricing">
							<div className="card-header-row">
								<div className="header-title-group">
									<span className="header-step-num emerald">03</span>
									<div>
										<h3>Bảng giá dịch vụ</h3>
										<p>Giá niêm yết tự động theo phiên.</p>
									</div>
								</div>
								<span className="currency-tag">VNĐ</span>
							</div>

							<div className="pricing-table-list">
								{availableServices.map((item) => (
									<div
										key={item.id}
										className={`pricing-table-row ${service === item.id ? "highlight-row" : ""}`}
									>
										<div className="price-service-name">
											<span>{item.label}</span>
											<small>({item.mode})</small>
										</div>
										<strong className="price-val">
											{prices[item.id] ? money.format(prices[item.id]) : "Chưa có giá"}
										</strong>
									</div>
								))}
							</div>
							<div className="pricing-card-footer">
								<span>Giá đã bao gồm toàn bộ thuế & phí dịch vụ</span>
							</div>
						</section>
					</aside>
				</div>

				{/* Full Customer Rental History Section */}
				<section className="rental-history-section glass-panel" id="history">
					<div className="card-header-row history-section-header">
						<div className="header-title-group">
							<span className="header-step-num violet">04</span>
							<div>
								<h3>Lịch sử thuê số của tài khoản @{user.username}</h3>
								<p>Danh sách các số điện thoại đã thuê, mã OTP và trạng thái hoàn tiền.</p>
							</div>
						</div>
						<div className="history-header-ctrls">
							<button
								type="button"
								className="refresh-mini-btn"
								onClick={loadUserOrders}
								disabled={ordersLoading}
							>
								{ordersLoading ? "..." : "🔄 Làm mới"}
							</button>
							<Link href="/history" className="view-all-link">
								Xem trang toàn màn hình ↗
							</Link>
						</div>
					</div>

					{/* Filter and Search Bar */}
					<div className="history-filter-bar in-dashboard">
						<div className="filter-pills-group">
							<button
								type="button"
								className={`filter-pill ${orderFilter === "ALL" ? "active" : ""}`}
								onClick={() => setOrderFilter("ALL")}
							>
								Tất cả ({ordersTotal})
							</button>
							<button
								type="button"
								className={`filter-pill ${orderFilter === "COMPLETED" ? "active" : ""}`}
								onClick={() => setOrderFilter("COMPLETED")}
							>
								🟢 Đã có OTP
							</button>
							<button
								type="button"
								className={`filter-pill ${orderFilter === "PENDING" ? "active" : ""}`}
								onClick={() => setOrderFilter("PENDING")}
							>
								⏳ Đang chờ
							</button>
							<button
								type="button"
								className={`filter-pill ${orderFilter === "EXPIRED" ? "active" : ""}`}
								onClick={() => setOrderFilter("EXPIRED")}
							>
								🔄 Đã hoàn tiền
							</button>
						</div>

						<div className="filter-search-box">
							<span className="search-icon">🔍</span>
							<input
								type="text"
								placeholder="Tìm kiếm số, dịch vụ, OTP..."
								value={orderSearch}
								onChange={(e) => setOrderSearch(e.target.value)}
								className="history-search-input"
							/>
							{orderSearch && (
								<button
									type="button"
									className="clear-search-btn"
									onClick={() => setOrderSearch("")}
								>
									✕
								</button>
							)}
						</div>
					</div>

					{/* History Content */}
					{ordersLoading ? (
						<div className="history-loading-inline">
							<div className="mini-spinner"></div>
							<span>Đang cập nhật lịch sử thuê...</span>
						</div>
					) : userOrders.length > 0 ? (
						<>
							{/* Desktop Table View */}
							<div className="history-table-wrapper hide-on-mobile">
								<table className="custom-data-table">
									<thead>
										<tr>
											<th>Thời gian</th>
											<th>Số điện thoại</th>
											<th>Dịch vụ</th>
											<th>Nhà mạng</th>
											<th>Mã OTP</th>
											<th>Giá</th>
											<th>Trạng thái</th>
										</tr>
									</thead>
									<tbody>
										{userOrders.map((ord) => (
											<tr key={ord.id}>
												<td className="time-cell">{formatDateTime(ord.createdAt)}</td>
												<td className="phone-cell">
													<div className="phone-with-copy">
														<strong className="mono-text">{ord.phone || "—"}</strong>
														{ord.phone && (
															<button
																type="button"
																className="table-copy-btn"
																onClick={() => copyText(ord.phone, `dash-p-${ord.id}`, "Đã sao chép số!")}
																title="Sao chép số"
															>
																{copiedField === `dash-p-${ord.id}` ? "✓" : "📋"}
															</button>
														)}
													</div>
												</td>
												<td>
													<span className="service-name-tag">{getServiceLabel(ord.service)}</span>
												</td>
												<td>
													<span className="carrier-tag">{getCarrierLabel(ord.carrier)}</span>
												</td>
												<td className="otp-cell">
													{ord.otp ? (
														<div className="otp-badge-wrap">
															<strong className="otp-code-highlight">{ord.otp}</strong>
															<button
																type="button"
																className="otp-copy-btn"
																onClick={() => copyText(ord.otp, `dash-o-${ord.id}`, "Đã sao chép OTP!")}
																title="Sao chép OTP"
															>
																{copiedField === `dash-o-${ord.id}` ? "✓" : "Sao chép"}
															</button>
														</div>
													) : (
														<span className="text-dim">—</span>
													)}
												</td>
												<td>
													<strong className="cost-tag">{money.format(ord.cost)}</strong>
												</td>
												<td>{renderStatusBadge(ord.status)}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>

							{/* Mobile Cards View */}
							<div className="history-mobile-cards-list show-on-mobile">
								{userOrders.map((ord) => (
									<div className="history-mobile-card" key={ord.id}>
										<div className="mobile-card-top">
											<div className="mobile-card-service">
												<strong>{getServiceLabel(ord.service)}</strong>
												<span className="carrier-chip">{getCarrierLabel(ord.carrier)}</span>
											</div>
											{renderStatusBadge(ord.status)}
										</div>

										<div className="mobile-card-phone-row">
											<div className="phone-label-group">
												<small>SỐ ĐIỆN THOẠI</small>
												<strong className="mobile-phone-num">{ord.phone || "Đang lấy..."}</strong>
											</div>
											{ord.phone && (
												<button
													type="button"
													className="mobile-copy-btn"
													onClick={() => copyText(ord.phone, `mp-${ord.id}`, "Đã chép số!")}
												>
													{copiedField === `mp-${ord.id}` ? "✓ Đã chép" : "📋 Sao chép"}
												</button>
											)}
										</div>

										{ord.otp && (
											<div className="mobile-otp-result-box">
												<div className="otp-text-group">
													<span className="otp-badge-title">MÃ XÁC THỰC OTP</span>
													<strong className="mobile-otp-code">{ord.otp}</strong>
												</div>
												<button
													type="button"
													className="mobile-otp-copy-action"
													onClick={() => copyText(ord.otp, `mo-${ord.id}`, "Đã chép OTP!")}
												>
													{copiedField === `mo-${ord.id}` ? "✓ Đã chép" : "Sao chép OTP"}
												</button>
											</div>
										)}

										<div className="mobile-card-footer">
											<span className="mobile-card-time">🕒 {formatDateTime(ord.createdAt)}</span>
											<strong className="mobile-card-cost">{money.format(ord.cost)}</strong>
										</div>
									</div>
								))}
							</div>
						</>
					) : (
						<div className="history-empty-inline">
							<span className="empty-icon-sm">📱</span>
							<p>Chưa có phiên thuê số nào trong lịch sử.</p>
						</div>
					)}
				</section>

				{/* Floating Toast Notification */}
				{(error || notice) && (
					<div className={`toast-message-floating ${error ? "error-mode" : "success-mode"}`} role="status">
						<span className="toast-icon">{error ? "⚠️" : "✓"}</span>
						<span className="toast-text">{error || notice}</span>
						<button
							type="button"
							className="toast-close-btn"
							onClick={() => { setError(""); setNotice(""); }}
							aria-label="Đóng thông báo"
						>
							×
						</button>
					</div>
				)}
			</div>

			<Footer />
			<TelegramBotWidget />
		</main>
	);
}
