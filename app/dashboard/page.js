"use client";

import { useEffect, useState } from "react";
import { getSupportedCarriers, SIM_CARRIER_LABELS, SIM_SERVICE_CATALOG } from "@/lib/sim-catalog";

const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });

export default function DashboardPage() {
	const [user, setUser] = useState(null);
	const [prices, setPrices] = useState({});
	const [provider, setProvider] = useState("otistx");
	const [availableServiceIds, setAvailableServiceIds] = useState(SIM_SERVICE_CATALOG.map(({ id }) => id));
	const [providerReady, setProviderReady] = useState(true);
	const [providerMessage, setProviderMessage] = useState("");
	const [loading, setLoading] = useState(true);
	const [authMode, setAuthMode] = useState("login");
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [service, setService] = useState("otissim_v3");
	const [carrier, setCarrier] = useState("viettel");
	const [activeOrder, setActiveOrder] = useState(null);
	const [polling, setPolling] = useState(false);
	const [remaining, setRemaining] = useState(0);
	const [busy, setBusy] = useState(false);
	const [notice, setNotice] = useState("");
	const [error, setError] = useState("");
	const availableServices = SIM_SERVICE_CATALOG.filter(({ id }) => availableServiceIds.includes(id));
	const availableCarriers = getSupportedCarriers(service, provider);
	const serviceInfo = SIM_SERVICE_CATALOG.find((item) => item.id === service);
	const price = prices[service] || 0;

	function applyProviderConfig(config) {
		const serviceIds = Array.isArray(config.services) ? config.services : [];
		setProvider(config.provider || "otistx");
		setAvailableServiceIds(serviceIds);
		setProviderReady(Boolean(config.providerReady));
		setProviderMessage(config.providerMessage || "");
		setService((current) => serviceIds.includes(current) ? current : serviceIds[0] || "");
	}

	useEffect(() => {
		let mounted = true;
		fetch("/api/auth", { cache: "no-store" })
			.then(async (response) => {
				if (!response.ok) return null;
				return response.json();
			})
			.then(async (data) => {
				if (!mounted || !data?.user) return;
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
				if (mounted) setError("Không kết nối được máy chủ. Kiểm tra cấu hình Redis rồi thử lại.");
			})
			.finally(() => {
				if (mounted) setLoading(false);
			});
		return () => {
			mounted = false;
		};
	}, []);

	useEffect(() => {
		if (!availableCarriers.length) {
			setCarrier("");
			return;
		}
		setCarrier((current) => availableCarriers.includes(current) ? current : availableCarriers[0]);
	}, [service, provider]);

	useEffect(() => {
		if (!activeOrder?.expiresAt) return undefined;
		const update = () => setRemaining(Math.max(0, Math.ceil((activeOrder.expiresAt - Date.now()) / 1000)));
		update();
		const timer = setInterval(update, 1000);
		return () => clearInterval(timer);
	}, [activeOrder?.expiresAt]);

	useEffect(() => {
		if (!activeOrder?.orderId || !polling) return undefined;
		let stopped = false;
		let timer;
		let attempts = 0;

		const checkStatus = async () => {
			if (stopped) return;
			attempts += 1;
			try {
				const response = await fetch(`/api/sim/status?orderId=${encodeURIComponent(activeOrder.orderId)}`, { cache: "no-store" });
				const result = await response.json();
				if (!response.ok) throw new Error(result.error || "Không kiểm tra được OTP");
				if (stopped) return;
				if (result.balance !== undefined) setUser((current) => current ? { ...current, balance: result.balance } : current);
				if (["COMPLETED", "EXPIRED", "FAILED"].includes(result.status)) {
					setActiveOrder((current) => current ? { ...current, status: result.status, otp: result.otp || "" } : current);
					setPolling(false);
					setNotice(result.status === "COMPLETED" ? "Đã nhận OTP thành công." : "Phiên thuê đã kết thúc; số dư được hoàn nếu provider báo hết hạn.");
					return;
				}
			} catch (pollError) {
				if (!stopped) setError(pollError.message);
			}
			if (attempts >= 60) {
				setPolling(false);
				setNotice("Đã dừng sau 180 giây. Đơn vẫn còn; bạn có thể tiếp tục kiểm tra OTP.");
				return;
			}
			timer = setTimeout(checkStatus, 3000);
		};

		timer = setTimeout(checkStatus, 3000);
		return () => {
			stopped = true;
			clearTimeout(timer);
		};
	}, [activeOrder?.orderId, polling]);

	async function submitAuth(event) {
		event.preventDefault();
		setBusy(true);
		setError("");
		setNotice("");
		try {
			const response = await fetch("/api/auth", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ action: authMode, username, password }),
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || "Không thể đăng nhập");
			setUser(result.user);
			setPassword("");
			const configResponse = await fetch("/api/sim/request", { cache: "no-store" });
			if (configResponse.ok) {
				const config = await configResponse.json();
				setPrices(config.prices || {});
				applyProviderConfig(config);
			}
		} catch (authError) {
			setError(authError.message);
		} finally {
			setBusy(false);
		}
	}

	async function rentNumber(event) {
		event.preventDefault();
		setBusy(true);
		setError("");
		setNotice("");
		try {
			const response = await fetch("/api/sim/request", {
				method: "POST",
				headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
				body: JSON.stringify({ service, carrier }),
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || "Không thuê được số");
			setActiveOrder({ ...result, status: result.status || "PENDING", otp: "" });
			setRemaining(Math.max(0, Math.ceil((result.expiresAt - Date.now()) / 1000)));
			setPolling(true);
			setUser((current) => current ? { ...current, balance: result.balance } : current);
			setNotice("Đã giữ số. Đang chờ OTP...");
		} catch (rentError) {
			setError(rentError.message);
		} finally {
			setBusy(false);
		}
	}

	async function signOut() {
		await fetch("/api/auth", { method: "DELETE" });
		setUser(null);
		setActiveOrder(null);
		setPolling(false);
	}

	async function copyPhone() {
		if (!activeOrder?.phone) return;
		await navigator.clipboard.writeText(activeOrder.phone);
		setNotice("Đã copy số điện thoại.");
	}

	if (loading) return <main className="page-shell"><div className="loading-line">Đang kết nối...</div></main>;

	if (!user) {
		return (
			<main className="page-shell auth-shell">
				<section className="auth-panel">
					<div className="brand-mark">SIM<span>OTP</span></div>
					<p className="eyebrow">THUÊ SỐ NHẬN MÃ</p>
					<h1>{authMode === "login" ? "Đăng nhập" : "Tạo tài khoản"}</h1>
					<p className="muted">Quản lý phiên thuê và số dư trong một nơi.</p>
					<form className="stack-form" onSubmit={submitAuth}>
						<label>Tên tài khoản<input autoComplete="username" minLength={3} maxLength={24} value={username} onChange={(event) => setUsername(event.target.value)} required /></label>
						<label>Mật khẩu<input type="password" autoComplete={authMode === "login" ? "current-password" : "new-password"} minLength={8} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
						{error && <p className="inline-message error-message">{error}</p>}
						<button className="primary-button" disabled={busy}>{busy ? "Đang xử lý..." : authMode === "login" ? "Đăng nhập" : "Tạo tài khoản"}</button>
					</form>
					<button className="text-button" onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setError(""); }}>
						{authMode === "login" ? "Chưa có tài khoản? Đăng ký" : "Đã có tài khoản? Đăng nhập"}
					</button>
					<p className="auth-footnote">Tài khoản mới bắt đầu với số dư 0đ.</p>
				</section>
			</main>
		);
	}

	const minutes = String(Math.floor(remaining / 60)).padStart(2, "0");
	const seconds = String(remaining % 60).padStart(2, "0");
	const isTerminal = ["COMPLETED", "EXPIRED", "FAILED"].includes(activeOrder?.status);

	return (
		<main className="page-shell">
			<header className="topbar">
				<a className="brand-mark" href="/dashboard">SIM<span>OTP</span></a>
				<div className="account-tools">
					<span className="account-name">{user.username}</span>
					<span className="balance-value">{money.format(user.balance || 0)}</span>
					<button className="quiet-button" onClick={signOut}>Đăng xuất</button>
				</div>
			</header>

			<div className="workspace">
				<section className="page-heading">
					<div><p className="eyebrow">SHOPEE · VIỆT NAM</p><h1>Thuê số nhận OTP</h1></div>
					<div className="price-tag"><span>Giá mỗi lượt</span><strong>{price ? money.format(price) : "Chưa cấu hình"}</strong></div>
				</section>

				<div className="work-grid">
					<section className="rental-section">
						<div className="section-heading"><span className="step-index">01</span><div><h2>Chọn cấu hình</h2><p>Chọn phiên thuê và nhà mạng nhận số.</p></div></div>
						<form className="rental-form" onSubmit={rentNumber}>
							<label>Dịch vụ
								<select value={service} onChange={(event) => setService(event.target.value)} disabled={!availableServices.length}>
									{availableServices.length ? availableServices.map((item) => <option key={item.id} value={item.id}>{item.label} ({item.mode})</option>) : <option value="">Không có dịch vụ khả dụng</option>}
								</select>
							</label>
							{serviceInfo && <p className="field-hint">{serviceInfo.description}</p>}
							<label>Nhà mạng
								<select value={carrier} onChange={(event) => setCarrier(event.target.value)} disabled={!availableCarriers.length}>
									{availableCarriers.map((value) => <option key={value} value={value}>{SIM_CARRIER_LABELS[value]}</option>)}
								</select>
							</label>
							{providerMessage && <p className="field-hint">{providerMessage}</p>}
							<div className="charge-row"><span>Số dư sau khi giữ tiền</span><strong>{money.format(Math.max(0, (user.balance || 0) - price))}</strong></div>
							<button className="primary-button rent-button" disabled={busy || !providerReady || !service || !availableCarriers.includes(carrier) || !price || user.balance < price || (activeOrder && !isTerminal)}>
								{busy ? "Đang lấy số..." : activeOrder && !isTerminal ? "Đang có phiên hoạt động" : "Thuê số"}
								<span aria-hidden="true">↗</span>
							</button>
							{user.balance < price && <p className="field-hint">Số dư chưa đủ. Liên hệ quản trị viên để nạp tiền.</p>}
						</form>
					</section>

					<section className="order-section">
						<div className="section-heading"><span className="step-index">02</span><div><h2>Phiên hiện tại</h2><p>Trạng thái được cập nhật tự động.</p></div></div>
						{activeOrder ? (
							<div className="session-view">
								<div className="session-meta"><span className={`status-dot ${activeOrder.status.toLowerCase()}`}></span><span>{activeOrder.status === "COMPLETED" ? "Đã nhận OTP" : activeOrder.status === "EXPIRED" ? "Đã hết hạn" : activeOrder.status === "FAILED" ? "Không tạo được phiên" : polling ? "Đang chờ tin nhắn" : "Đang tạm dừng kiểm tra"}</span><span className="session-cost">{money.format(activeOrder.cost || price)}</span></div>
								<div className="phone-line"><strong>{activeOrder.phone || "Đang kết nối provider..."}</strong><button className="icon-button" onClick={copyPhone} disabled={!activeOrder.phone} aria-label="Copy số điện thoại" title="Copy số điện thoại">▢</button></div>
								{activeOrder.status === "COMPLETED" ? <div className="otp-result"><span>MÃ OTP</span><strong>{activeOrder.otp || "Không có mã"}</strong></div> : <div className="timer-row"><span>Thời gian phiên</span><strong>{minutes}:{seconds}</strong></div>}
								{!isTerminal && <div className="session-actions">
									{polling ? <button className="quiet-button" onClick={() => { setPolling(false); setNotice("Đã dừng polling trên trình duyệt. Phiên provider vẫn còn hiệu lực."); }}>Dừng kiểm tra</button> : <button className="quiet-button" onClick={() => { setError(""); setPolling(true); }}>Tiếp tục kiểm tra OTP</button>}
								</div>}
								<p className="session-note">Dừng kiểm tra không hủy số thuê. Tiền chỉ được hoàn khi provider xác nhận phiên hết hạn.</p>
							</div>
						) : <div className="empty-state"><span className="empty-symbol">—</span><p>Chưa có phiên thuê nào.</p></div>}
					</section>
				</div>

				{(error || notice) && <div className={`toast-message ${error ? "error-message" : ""}`} role="status">{error || notice}<button onClick={() => { setError(""); setNotice(""); }} aria-label="Đóng thông báo">×</button></div>}
				<footer className="page-footer"><span>Phiên thuê không chặn kết nối máy chủ.</span><span>Polling tối đa 60 lần · mỗi 3 giây</span></footer>
			</div>
		</main>
	);
}
