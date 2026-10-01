"use client";

import { useState } from "react";

const services = [
	["otissim_v1", "OtisSim v1", "No-check"],
	["otissim_v2", "OtisSim v2", ""],
	["otissim_v3", "OtisSim v3", ""],
	["otissim_v4", "OtisSim v4", ""],
	["otissim_v5", "OtisSim v5", "No-check"],
	["otissim_v6", "OtisSim v6", ""],
];

const currency = new Intl.NumberFormat("vi-VN");

export default function AdminServicesPage() {
	const [adminToken, setAdminToken] = useState("");
	const [prices, setPrices] = useState({});
	const [connected, setConnected] = useState(false);
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState("");
	const [error, setError] = useState("");

	async function connect(event) {
		event.preventDefault();
		setBusy(true);
		setError("");
		setMessage("");
		try {
			const response = await fetch("/api/admin", { headers: { "X-Admin-Token": adminToken }, cache: "no-store" });
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || "Không xác thực được quản trị viên");
			setPrices(Object.fromEntries(Object.entries(result.prices).map(([service, price]) => [service, String(price || "")])));
			setConnected(true);
		} catch (connectError) {
			setError(connectError.message);
		} finally {
			setBusy(false);
		}
	}

	async function savePrices(event) {
		event.preventDefault();
		setBusy(true);
		setError("");
		setMessage("");
		try {
			const response = await fetch("/api/admin", {
				method: "PATCH",
				headers: { "Content-Type": "application/json", "X-Admin-Token": adminToken },
				body: JSON.stringify({ prices: Object.fromEntries(Object.entries(prices).map(([service, price]) => [service, Number(price)])) }),
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || "Không lưu được bảng giá");
			setPrices(Object.fromEntries(Object.entries(result.prices).map(([service, price]) => [service, String(price)])));
			setMessage("Đã lưu bảng giá. Giá mới áp dụng cho các lượt thuê tiếp theo.");
		} catch (saveError) {
			setError(saveError.message);
		} finally {
			setBusy(false);
		}
	}

	function disconnect() {
		setAdminToken("");
		setPrices({});
		setConnected(false);
		setMessage("");
		setError("");
	}

	return (
		<main className="page-shell">
			<header className="topbar">
				<a className="brand-mark" href="/dashboard">SIM<span>OTP</span></a>
				<div className="account-tools">
					<span className="account-name">Quản trị dịch vụ</span>
					<a className="quiet-button admin-back-link" href="/dashboard">Về dashboard</a>
				</div>
			</header>

			<div className="workspace admin-workspace">
				<section className="page-heading">
					<div><p className="eyebrow">QUẢN TRỊ · BẢNG GIÁ</p><h1>Giá thuê SIM</h1></div>
					{connected && <button className="quiet-button" onClick={disconnect}>Khóa trang quản trị</button>}
				</section>

				{!connected ? (
					<section className="admin-panel admin-auth-panel">
						<div className="section-heading"><span className="step-index">A</span><div><h2>Xác thực quản trị</h2><p>Nhập ADMIN_API_TOKEN đã cấu hình trên server.</p></div></div>
						<form className="admin-auth-form" onSubmit={connect}>
							<label>Admin API token<input type="password" autoComplete="current-password" value={adminToken} onChange={(event) => setAdminToken(event.target.value)} required /></label>
							<button className="primary-button" disabled={busy}>{busy ? "Đang kiểm tra..." : "Mở quản lý giá"}</button>
						</form>
					</section>
				) : (
					<form className="admin-panel" onSubmit={savePrices}>
						<div className="section-heading"><span className="step-index">01</span><div><h2>Giá bán theo loại SIM</h2><p>Giá user bị trừ khi tạo đơn mới, đơn cũ không đổi.</p></div></div>
						<div className="price-table" role="table" aria-label="Giá bán SIM">
							<div className="price-table-head" role="row"><span>Loại SIM</span><span>Giá bán (VND)</span></div>
							{services.map(([id, label, note]) => (
								<label className="price-table-row" key={id}>
									<span className="service-label">{label}{note && <small>{note}</small>}</span>
									<span className="price-input-wrap"><input type="number" min="1" max="100000000" step="1" inputMode="numeric" value={prices[id] ?? ""} onChange={(event) => setPrices((current) => ({ ...current, [id]: event.target.value }))} required /><span>đ</span></span>
								</label>
							))}
						</div>
						<div className="margin-note"><strong>Thiết lập lợi nhuận</strong><p>Đây là giá bán. Hãy đặt cao hơn giá vốn Otistx và phần lợi nhuận mong muốn. Provider không có API báo giá trước khi thuê, nên cần đối chiếu giá vốn trong tài khoản provider.</p></div>
						<div className="admin-form-footer">
							{error && <p className="inline-message error-message" role="alert">{error}</p>}
							{message && <p className="inline-message success-message" role="status">{message}</p>}
							<button className="primary-button" disabled={busy}>{busy ? "Đang lưu..." : "Lưu bảng giá"}</button>
						</div>
					</form>
				)}
				{!connected && error && <p className="admin-alert error-message" role="alert">{error}</p>}
			</div>
		</main>
	);
}
