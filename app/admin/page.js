"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAdmin } from "./admin-shell";
import { AdminNotice, EmptyRows, formatDate, money, PageHeading, StatusPill } from "./admin-ui";

export default function AdminOverviewPage() {
	const { request } = useAdmin();
	const [data, setData] = useState(null);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(true);

	async function refresh() {
		setLoading(true);
		setError("");
		try {
			setData(await request("?view=overview"));
		} catch (loadError) {
			setError(loadError.message);
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => { refresh(); }, []);

	return <>
		<PageHeading eyebrow="TRUNG TÂM VẬN HÀNH" title="Tổng quan" description="Theo dõi tài khoản, số dư và hoạt động thuê SIM." action={<button className="quiet-button" onClick={refresh} disabled={loading}>{loading ? "Đang tải..." : "Làm mới"}</button>} />
		<AdminNotice error={error} />
		{loading && !data ? (
			<div className="admin-loading-inline">
				<div className="app-loader-spinner" />
				<p>Đang tổng hợp số liệu vận hành...</p>
			</div>
		) : data && <>
			<div className="admin-stat-grid">
				<div className="admin-stat-card glass-panel">
					<div className="stat-card-top">
						<span className="stat-label">TỔNG NGƯỜI DÙNG</span>
						<span className="stat-icon-badge">👥</span>
					</div>
					<strong className="stat-number">{data.userCount.toLocaleString("vi-VN")}</strong>
					<div className="stat-footer-text">
						<span className="text-emerald">{data.activeUserCount} hoạt động</span> · <span>{data.disabledUserCount} bị khóa</span>
					</div>
				</div>

				<div className="admin-stat-card glass-panel">
					<div className="stat-card-top">
						<span className="stat-label">SỐ DƯ NGƯỜI DÙNG (NỢ VÍ)</span>
						<span className="stat-icon-badge">💰</span>
					</div>
					<strong className="stat-number text-cyan">{money.format(data.totalBalance)}</strong>
					<div className="stat-footer-text">
						<span>Tổng tiền trong ví của khách hàng</span>
					</div>
				</div>

				<div className="admin-stat-card glass-panel">
					<div className="stat-card-top">
						<span className="stat-label">TỔNG QUỸ API GỐC (VỐN)</span>
						<span className="stat-icon-badge">🏦</span>
					</div>
					<strong className="stat-number text-emerald">{money.format(data.providerBalances?.total || 0)}</strong>
					<div className="stat-footer-text">
						<span>OtisTx + ViOTP + OtpHub V8 khả dụng</span>
					</div>
				</div>

				<div className="admin-stat-card glass-panel">
					<div className="stat-card-top">
						<span className="stat-label">LỢI NHUẬN ƯỚC TÍNH (LÃI)</span>
						<span className="stat-icon-badge">📈</span>
					</div>
					<strong className="stat-number text-gold">{money.format(data.financials?.estimatedProfit || 0)}</strong>
					<div className="stat-footer-text">
						<span className="text-emerald">Biên lãi ~55% trên đơn thành công</span>
					</div>
				</div>
			</div>

			{/* 2-Column Financial & Provider Dashboard Section */}
			<div className="admin-financial-split-grid">
				{/* Column 1: Provider Balances Breakdown */}
				<section className="admin-finance-card glass-panel">
					<div className="finance-card-header">
						<div className="finance-header-title">
							<span className="finance-icon-wrap emerald">📡</span>
							<div>
								<h3>Quỹ API Nhà Cung Cấp (Vốn Gốc)</h3>
								<p>Số dư tài khoản API tại OtisTx, ViOTP và OtpHub VIP theo thời gian thực.</p>
							</div>
						</div>
						<span className="finance-status-chip live">● REALTIME</span>
					</div>

					<div className="provider-balance-list">
						{/* OtisTx Item */}
						<div className="provider-balance-item">
							<div className="provider-item-brand">
								<div className="provider-logo-badge otistx">OT</div>
								<div>
									<strong>OtisTx API (Shopee & Gói 01-06)</strong>
									<small>https://otistx.com</small>
								</div>
							</div>
							<div className="provider-item-value">
								{data.providerBalances?.otistx?.configured ? (
									data.providerBalances.otistx.balance !== null ? (
										<strong className="provider-money-val mono-text">{money.format(data.providerBalances.otistx.balance)}</strong>
									) : (
										<span className="provider-err-text">{data.providerBalances.otistx.error || "Lỗi kiểm tra"}</span>
									)
								) : (
									<span className="provider-unconfigured">Chưa cấu hình API Key</span>
								)}
								<span className={`provider-state-tag ${data.providerBalances?.otistx?.balance > 0 ? "active" : "warn"}`}>
									{data.providerBalances?.otistx?.balance > 0 ? "🟢 Sẵn sàng" : "⚠️ Cần nạp vốn"}
								</span>
							</div>
						</div>

						{/* ViOTP Item */}
						<div className="provider-balance-item">
							<div className="provider-item-brand">
								<div className="provider-logo-badge viotp">VI</div>
								<div>
									<strong>ViOTP API (Shopee V7 & TikTok V1)</strong>
									<small>https://viotp.com</small>
								</div>
							</div>
							<div className="provider-item-value">
								{data.providerBalances?.viotp?.configured ? (
									data.providerBalances.viotp.balance !== null ? (
										<strong className="provider-money-val mono-text">{money.format(data.providerBalances.viotp.balance)}</strong>
									) : (
										<span className="provider-err-text">{data.providerBalances.viotp.error || "Lỗi kiểm tra"}</span>
									)
								) : (
									<span className="provider-unconfigured">Chưa cấu hình Token</span>
								)}
								<span className={`provider-state-tag ${data.providerBalances?.viotp?.balance > 0 ? "active" : "warn"}`}>
									{data.providerBalances?.viotp?.balance > 0 ? "🟢 Sẵn sàng" : "⚠️ Cần nạp vốn"}
								</span>
							</div>
						</div>

						{/* OtpHub Item */}
						<div className="provider-balance-item">
							<div className="provider-item-brand">
								<div className="provider-logo-badge otphub">V8</div>
								<div>
									<strong>OtpHub VIP (SIM OTP V8 VIP)</strong>
									<small>https://otphubtl.vercel.app</small>
								</div>
							</div>
							<div className="provider-item-value">
								{data.providerBalances?.otphub?.configured ? (
									data.providerBalances.otphub.balance !== null ? (
										<strong className="provider-money-val mono-text">{money.format(data.providerBalances.otphub.balance)}</strong>
									) : (
										<span className="provider-err-text">{data.providerBalances.otphub.error || "Lỗi kiểm tra"}</span>
									)
								) : (
									<span className="provider-unconfigured">Chưa cấu hình Token</span>
								)}
								<span className={`provider-state-tag ${data.providerBalances?.otphub?.balance > 0 ? "active" : "warn"}`}>
									{data.providerBalances?.otphub?.balance > 0 ? "🟢 Sẵn sàng" : "⚠️ Cần nạp vốn"}
								</span>
							</div>
						</div>
					</div>

					<div className="finance-card-footer-summary">
						<div className="footer-metric-col">
							<small>TỔNG VỐN KHẢ DỤNG</small>
							<strong className="text-emerald mono-text">{money.format(data.providerBalances?.total || 0)}</strong>
						</div>
						<div className="footer-metric-sep"></div>
						<div className="footer-metric-col">
							<small>TỶ LỆ BẢO CHỨNG SỐ DƯ</small>
							<strong className="mono-text">{data.financials?.solvencyRatio || "100"}%</strong>
						</div>
					</div>
				</section>

				{/* Column 2: System Cashflow & Profit Report */}
				<section className="admin-finance-card glass-panel">
					<div className="finance-card-header">
						<div className="finance-header-title">
							<span className="finance-icon-wrap violet">📊</span>
							<div>
								<h3>Dòng Tiền & Báo Cáo Lợi Nhuận</h3>
								<p>Phân tích tổng nạp, doanh thu đơn hoàn thành và tiền lãi.</p>
							</div>
						</div>
						<span className="finance-status-chip auto">⚡ TỰ ĐỘNG</span>
					</div>

					<div className="finance-breakdown-table">
						<div className="breakdown-row">
							<span className="breakdown-label">💳 Tổng tiền nạp thành công (SePay + Admin):</span>
							<strong className="breakdown-val text-cyan mono-text">{money.format(data.financials?.totalDeposited || 0)}</strong>
						</div>
						<div className="breakdown-row">
							<span className="breakdown-label">🛍️ Doanh thu đơn thuê thành công ({data.financials?.completedOrdersCount || 0} số):</span>
							<strong className="breakdown-val text-emerald mono-text">{money.format(data.financials?.completedOrdersRevenue || 0)}</strong>
						</div>
						<div className="breakdown-row">
							<span className="breakdown-label">🔄 Hoàn tiền đơn hết hạn / lỗi ({data.financials?.expiredOrdersCount || 0} số):</span>
							<strong className="breakdown-val text-muted mono-text">{money.format(data.financials?.totalRefunded || 0)}</strong>
						</div>
						<div className="breakdown-row highlight-profit-row">
							<span className="breakdown-label">📈 Lợi nhuận gộp ước tính (LÃI):</span>
							<strong className="breakdown-val text-gold mono-text large-stat">+{money.format(data.financials?.estimatedProfit || 0)}</strong>
						</div>
						<div className="breakdown-row">
							<span className="breakdown-label">🏦 Tiền khách đã tiêu thụ (Tổng nạp - Dư ví):</span>
							<strong className="breakdown-val mono-text">{money.format(data.financials?.netSystemRevenue || 0)}</strong>
						</div>
					</div>

					<div className="finance-card-footer-summary">
						<div className="footer-metric-col">
							<small>TỔNG ĐƠN ĐÃ THUÊ</small>
							<strong className="mono-text">{data.orderCount} số</strong>
						</div>
						<div className="footer-metric-sep"></div>
						<div className="footer-metric-col">
							<small>ĐƠN ĐANG CHẠY</small>
							<strong className="text-cyan mono-text">{data.financials?.pendingOrdersCount || 0} phiên</strong>
						</div>
					</div>
				</section>
			</div>

			<section className="admin-section admin-overview-orders-section glass-panel">
				<div className="admin-section-heading">
					<div>
						<h2>Đơn thuê gần đây</h2>
						<p>Các phiên thuê SIM mới nhất phát sinh từ người dùng.</p>
					</div>
					<Link className="admin-text-link" href="/admin/orders">Xem tất cả đơn →</Link>
				</div>
				<div className="admin-table-wrap">
					<table className="admin-table">
						<thead>
							<tr>
								<th>Thời gian</th>
								<th>User</th>
								<th>Dịch vụ</th>
								<th>Nhà mạng</th>
								<th>Chi phí</th>
								<th>Trạng thái</th>
							</tr>
						</thead>
						<tbody>
							{data.recentOrders.length ? data.recentOrders.map((order) => (
								<tr key={order.id}>
									<td><small className="admin-cell-subtitle">{formatDate(order.createdAt)}</small></td>
									<td><strong>{order.username}</strong></td>
									<td>{order.service}</td>
									<td><span className="admin-carrier-pill">{order.carrier}</span></td>
									<td><strong>{money.format(order.cost)}</strong></td>
									<td><StatusPill value={order.status} /></td>
								</tr>
							)) : (
								<EmptyRows columns={6}>{loading ? "Đang tải..." : "Chưa có đơn thuê"}</EmptyRows>
							)}
						</tbody>
					</table>
				</div>
			</section>

			<div className="admin-quick-links-grid">
				<Link href="/admin/users" className="admin-quick-card glass-panel">
					<div className="quick-card-icon">👥</div>
					<div className="quick-card-info">
						<strong>Quản lý Người dùng</strong>
						<p>Tra cứu tài khoản, cộng trừ số dư ví &amp; khóa tài khoản</p>
					</div>
					<span className="quick-card-arrow">→</span>
				</Link>
				<Link href="/admin/transactions" className="admin-quick-card glass-panel">
					<div className="quick-card-icon">📑</div>
					<div className="quick-card-info">
						<strong>Sổ cái Giao dịch</strong>
						<p>Kiểm tra lịch sử nạp tiền tự động SePay &amp; hoàn tiền</p>
					</div>
					<span className="quick-card-arrow">→</span>
				</Link>
				<Link href="/admin/services" className="admin-quick-card glass-panel">
					<div className="quick-card-icon">🏷️</div>
					<div className="quick-card-info">
						<strong>Bảng giá Dịch vụ</strong>
						<p>Cập nhật đơn giá bán SIM OTP cho từng dịch vụ</p>
					</div>
					<span className="quick-card-arrow">→</span>
				</Link>
			</div>
		</>}
	</>;
}
