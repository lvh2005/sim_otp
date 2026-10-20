"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import TelegramBotWidget from "@/app/components/TelegramBotWidget";
import { SIM_SERVICE_CATALOG, SIM_CARRIER_LABELS } from "@/lib/sim-catalog";

const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });

export default function HistoryPage() {
	const [user, setUser] = useState(null);
	const [orders, setOrders] = useState([]);
	const [totalOrders, setTotalOrders] = useState(0);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [statusFilter, setStatusFilter] = useState("ALL");
	const [searchQuery, setSearchQuery] = useState("");
	const [copiedField, setCopiedField] = useState("");
	const [activeTab, setActiveTab] = useState("rentals"); // 'rentals' | 'deposits'
	const [depositHistory, setDepositHistory] = useState([]);
	const [notice, setNotice] = useState("");
	const [error, setError] = useState("");

	const getServiceLabel = (serviceId) => {
		const found = SIM_SERVICE_CATALOG.find((s) => s.id === serviceId);
		return found ? found.label : serviceId;
	};

	const getCarrierLabel = (carrierId) => {
		return SIM_CARRIER_LABELS[carrierId] || carrierId || "Tự động";
	};

	const copyText = async (text, id, msg = "Đã sao chép!") => {
		if (!text) return;
		try {
			await navigator.clipboard.writeText(text);
			setCopiedField(id);
			setNotice(msg);
			setTimeout(() => setCopiedField(""), 2000);
		} catch {
			// fallback
		}
	};

	const loadHistory = useCallback(async (isManual = false) => {
		if (isManual) setRefreshing(true);
		try {
			const [ordersRes, depositRes] = await Promise.all([
				fetch(`/api/orders?status=${statusFilter}&q=${encodeURIComponent(searchQuery)}`, { cache: "no-store" }),
				fetch("/api/deposit", { cache: "no-store" }),
			]);

			if (ordersRes.ok) {
				const ordersData = await ordersRes.json();
				setOrders(ordersData.orders || []);
				setTotalOrders(ordersData.total || 0);
				if (ordersData.balance !== undefined) {
					setUser((prev) => (prev ? { ...prev, balance: ordersData.balance } : prev));
				}
			}

			if (depositRes.ok) {
				const depData = await depositRes.json();
				setDepositHistory(depData.history || []);
			}
		} catch (err) {
			setError(err.message || "Không thể tải lịch sử");
		} finally {
			if (isManual) setRefreshing(false);
			setLoading(false);
		}
	}, [statusFilter, searchQuery]);

	useEffect(() => {
		let mounted = true;
		fetch("/api/auth", { cache: "no-store" })
			.then((res) => (res.ok ? res.json() : null))
			.then((data) => {
				if (!mounted) return;
				if (!data?.user) {
					window.location.href = "/login";
					return;
				}
				setUser(data.user);
			})
			.catch(() => {
				if (mounted) setError("Không thể kết nối máy chủ");
			});

		return () => {
			mounted = false;
		};
	}, []);

	useEffect(() => {
		if (!user?.id) return;
		loadHistory();
	}, [user?.id, loadHistory]);

	const formatDateTime = (timestamp) => {
		if (!timestamp) return "—";
		try {
			const d = new Date(timestamp);
			const time = d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
			const date = d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
			return `${time} · ${date}`;
		} catch {
			return "—";
		}
	};

	const renderStatusBadge = (status, orderItem = null) => {
		const isNoRefund = orderItem?.service === "sms_combo" || (orderItem?.service === "zalo" && (orderItem?.carrier === "8500" || orderItem?.carrier === "7539" || orderItem?.gateway));
		switch (status) {
			case "COMPLETED":
				return <span className="history-status-badge success">✓ Đã nhận OTP</span>;
			case "PENDING":
			case "REQUESTING":
				return <span className="history-status-badge pending">⏳ Đang chờ OTP</span>;
			case "EXPIRED":
				return <span className="history-status-badge expired">{isNoRefund ? "Hết hạn (Đã gửi SMS)" : "Hoàn tiền (Hết hạn)"}</span>;
			case "FAILED":
				return <span className="history-status-badge failed">{isNoRefund ? "Thất bại (Đã gửi SMS)" : "Thất bại (Đã hoàn)"}</span>;
			default:
				return <span className="history-status-badge default">{status}</span>;
		}
	};

	return (
		<main className="page-shell modern-dark-shell history-page-shell">
			<Header user={user} />

			<div className="history-container">
				{/* Page Header */}
				<div className="history-header-card glass-panel">
					<div className="history-header-left">
						<span className="section-eyebrow">QUẢN LÝ TÀI KHOẢN @{user?.username}</span>
						<h1 className="history-page-title">
							Lịch sử thuê số & Giao dịch
						</h1>
						<p className="history-page-desc">
							Tra cứu toàn bộ các số điện thoại đã thuê, mã xác thực OTP nhận được và biến động số dư.
						</p>
					</div>
					<div className="history-header-actions">
						<button
							type="button"
							className="secondary-glass-btn"
							onClick={() => loadHistory(true)}
							disabled={refreshing}
						>
							{refreshing ? "🔄 Đang cập nhật..." : "🔄 Làm mới dữ liệu"}
						</button>
						<Link href="/dashboard" className="primary-action-btn">
							🚀 Thuê số mới
						</Link>
					</div>
				</div>

				{/* Tab Selector */}
				<div className="history-tabs-bar">
					<button
						type="button"
						className={`history-tab-btn ${activeTab === "rentals" ? "active" : ""}`}
						onClick={() => setActiveTab("rentals")}
					>
						<span className="tab-icon">📱</span>
						<span>Lịch sử thuê SIM</span>
						<span className="tab-count-badge">{totalOrders}</span>
					</button>
					<button
						type="button"
						className={`history-tab-btn ${activeTab === "deposits" ? "active" : ""}`}
						onClick={() => setActiveTab("deposits")}
					>
						<span className="tab-icon">💳</span>
						<span>Lịch sử nạp tiền (VietQR)</span>
						<span className="tab-count-badge">{depositHistory.length}</span>
					</button>
				</div>

				{activeTab === "rentals" && (
					<div className="history-main-content">
						{/* Search & Filter Controls */}
						<div className="history-filter-bar glass-panel">
							<div className="filter-pills-group">
								<button
									type="button"
									className={`filter-pill ${statusFilter === "ALL" ? "active" : ""}`}
									onClick={() => setStatusFilter("ALL")}
								>
									Tất cả
								</button>
								<button
									type="button"
									className={`filter-pill ${statusFilter === "COMPLETED" ? "active" : ""}`}
									onClick={() => setStatusFilter("COMPLETED")}
								>
									🟢 Nhận OTP thành công
								</button>
								<button
									type="button"
									className={`filter-pill ${statusFilter === "PENDING" ? "active" : ""}`}
									onClick={() => setStatusFilter("PENDING")}
								>
									⏳ Đang chờ
								</button>
								<button
									type="button"
									className={`filter-pill ${statusFilter === "EXPIRED" ? "active" : ""}`}
									onClick={() => setStatusFilter("EXPIRED")}
								>
									🔄 Đã hoàn tiền
								</button>
							</div>

							<div className="filter-search-box">
								<span className="search-icon">🔍</span>
								<input
									type="text"
									placeholder="Tìm theo SĐT, dịch vụ, OTP..."
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									className="history-search-input"
								/>
								{searchQuery && (
									<button
										type="button"
										className="clear-search-btn"
										onClick={() => setSearchQuery("")}
									>
										✕
									</button>
								)}
							</div>
						</div>

						{/* Rentals List / Table */}
						{loading ? (
							<div className="history-loading-box">
								<div className="app-loader-spinner"></div>
								<p>Đang tải danh sách đơn thuê của bạn...</p>
							</div>
						) : orders.length > 0 ? (
							<>
								{/* Desktop Table View */}
								<div className="history-table-wrapper glass-panel hide-on-mobile">
									<table className="custom-data-table">
										<thead>
											<tr>
												<th>Thời gian</th>
												<th>Số điện thoại</th>
												<th>Gói dịch vụ</th>
												<th>Nhà mạng</th>
												<th>Mã OTP</th>
												<th>Chi phí</th>
												<th>Trạng thái</th>
											</tr>
										</thead>
										<tbody>
											{orders.map((order) => (
												<tr key={order.id}>
													<td className="time-cell">
														{formatDateTime(order.createdAt)}
													</td>
													<td className="phone-cell">
														<div className="phone-with-copy">
															<strong className="mono-text">{order.phone || "—"}</strong>
															{order.phone && (
																<button
																	type="button"
																	className="table-copy-btn"
																	onClick={() => copyText(order.phone, `phone-${order.id}`, "Đã sao chép số điện thoại")}
																	title="Sao chép số"
																>
																	{copiedField === `phone-${order.id}` ? "✓" : "📋"}
																</button>
															)}
														</div>
													</td>
													<td>
														<span className="service-name-tag">
															{getServiceLabel(order.service)}
														</span>
													</td>
													<td>
														<span className="carrier-tag">
															{getCarrierLabel(order.carrier)}
														</span>
													</td>
													<td className="otp-cell">
														{order.otp ? (
															<div className="otp-badge-wrap">
																<strong className="otp-code-highlight">{order.otp}</strong>
																<button
																	type="button"
																	className="otp-copy-btn"
																	onClick={() => copyText(order.otp, `otp-${order.id}`, "Đã sao chép mã OTP")}
																	title="Sao chép OTP"
																>
																	{copiedField === `otp-${order.id}` ? "✓" : "Sao chép"}
																</button>
															</div>
														) : (
															<span className="text-dim">—</span>
														)}
													</td>
													<td>
														<strong className="cost-tag">{money.format(order.cost)}</strong>
													</td>
													<td>
														{renderStatusBadge(order.status, order)}
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>

								{/* Mobile Card View (Optimized for phones) */}
								<div className="history-mobile-cards-list show-on-mobile">
									{orders.map((order) => (
										<div className="history-mobile-card glass-panel" key={order.id}>
											<div className="mobile-card-top">
												<div className="mobile-card-service">
													<strong>{getServiceLabel(order.service)}</strong>
													<span className="carrier-chip">{getCarrierLabel(order.carrier)}</span>
												</div>
												{renderStatusBadge(order.status, order)}
											</div>

											<div className="mobile-card-phone-row">
												<div className="phone-label-group">
													<small>SỐ ĐIỆN THOẠI</small>
													<strong className="mobile-phone-num">{order.phone || "Đang lấy..."}</strong>
												</div>
												{order.phone && (
													<button
														type="button"
														className="mobile-copy-btn"
														onClick={() => copyText(order.phone, `m-phone-${order.id}`, "Đã chép số!")}
													>
														{copiedField === `m-phone-${order.id}` ? "✓ Đã chép" : "📋 Sao chép"}
													</button>
												)}
											</div>

											{/* OTP highlight box on mobile */}
											{order.otp && (
												<div className="mobile-otp-result-box">
													<div className="otp-text-group">
														<span className="otp-badge-title">MÃ XÁC THỰC OTP</span>
														<strong className="mobile-otp-code">{order.otp}</strong>
													</div>
													<button
														type="button"
														className="mobile-otp-copy-action"
														onClick={() => copyText(order.otp, `m-otp-${order.id}`, "Đã chép OTP!")}
													>
														{copiedField === `m-otp-${order.id}` ? "✓ Đã chép" : "Sao chép OTP"}
													</button>
												</div>
											)}

											<div className="mobile-card-footer">
												<span className="mobile-card-time">
													🕒 {formatDateTime(order.createdAt)}
												</span>
												<strong className="mobile-card-cost">
													{money.format(order.cost)}
												</strong>
											</div>
										</div>
									))}
								</div>
							</>
						) : (
							<div className="history-empty-state glass-panel">
								<div className="empty-icon">📱</div>
								<h3>Chưa có đơn thuê nào phù hợp</h3>
								<p>
									{searchQuery || statusFilter !== "ALL"
										? "Không tìm thấy phiên thuê theo bộ lọc hiện tại. Hãy thử thay đổi từ khóa."
										: "Bạn chưa thực hiện phiên thuê số nào. Hãy bấm 'Thuê số ngay' để bắt đầu nhận mã OTP!"}
								</p>
								<Link href="/dashboard" className="primary-action-btn">
									🚀 Thuê số ngay
								</Link>
							</div>
						)}
					</div>
				)}

				{activeTab === "deposits" && (
					<div className="history-main-content">
						<div className="deposit-history-list glass-panel">
							<div className="deposit-history-head">
								<h3>Lịch sử nạp tiền tự động (VietQR)</h3>
								<Link href="/deposit" className="quick-deposit-accent-btn">
									+ Nạp thêm tiền ↗
								</Link>
							</div>

							{depositHistory.length > 0 ? (
								<div className="deposit-items-grid">
									{depositHistory.map((tx) => (
										<div className="deposit-item-card" key={tx.id}>
											<div className="deposit-card-left">
												<span className="deposit-bank-badge">Auto Bank</span>
												<div>
													<strong className="deposit-title">Nạp tiền thành công</strong>
													<small className="deposit-time">{formatDateTime(tx.createdAt)}</small>
												</div>
											</div>
											<strong className="deposit-amount-green">
												+{money.format(tx.amount)}
											</strong>
										</div>
									))}
								</div>
							) : (
								<div className="history-empty-state">
									<div className="empty-icon">💳</div>
									<h3>Chưa có giao dịch nạp tiền</h3>
									<p>Mỗi khi bạn chuyển khoản qua VietQR, giao dịch sẽ được cập nhật tức thì tại đây.</p>
									<Link href="/deposit" className="primary-action-btn">
										💳 Nạp tiền ngay
									</Link>
								</div>
							)}
						</div>
					</div>
				)}
			</div>

			{/* Floating Toast */}
			{(notice || error) && (
				<div className={`toast-message-floating ${error ? "error-mode" : "success-mode"}`}>
					<span>{notice || error}</span>
					<button type="button" onClick={() => { setNotice(""); setError(""); }}>×</button>
				</div>
			)}

			<Footer />
			<TelegramBotWidget />
		</main>
	);
}
