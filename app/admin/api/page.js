"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdmin } from "../admin-shell";
import { AdminNotice, PageHeading } from "../admin-ui";

export default function AdminApiConfigPage() {
	const { request } = useAdmin();
	const [form, setForm] = useState({
		otphub_base_url: "https://otphubtl.vercel.app",
		otphub_token: "",
		otphub_shopee_service_id: "shopee",
		viotp_token: "",
		viotp_shopee_service_id: "4",
		viotp_tiktok_service_id: "29",
		otistx_api_key: "",
		sim_provider: "otistx",
		sim_service: "otissim_v8",
		sim_carrier: "random",
		deposit_enabled: true,
		deposit_support_telegram: "Vuha_cute_dapxe_trenpho",
		deposit_disabled_notice: "Cổng nạp tiền tự động VietQR đang tạm dừng để bảo trì. Quý khách vui lòng liên hệ Telegram hỗ trợ để nạp tiền trực tiếp!",
		sepay_bank_name: "TPBank",
		sepay_account_number: "10005790882",
		sepay_account_name: "LE VU HA",
		sepay_min_deposit_vnd: 10000,
		sepay_webhook_api_key: "",
	});
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState(false);
	const [testingProvider, setTestingProvider] = useState("");
	const [testResults, setTestResults] = useState({});
	const [error, setError] = useState("");
	const [message, setMessage] = useState("");

	const loadConfig = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			const data = await request("?view=api_config");
			if (data) {
				setForm((prev) => ({
					...prev,
					...data,
					deposit_enabled: data.deposit_enabled !== undefined ? (data.deposit_enabled === true || data.deposit_enabled === "true" || data.deposit_enabled === 1 || data.deposit_enabled === "1") : true,
					deposit_support_telegram: data.deposit_support_telegram || "Vuha_cute_dapxe_trenpho",
					deposit_disabled_notice: data.deposit_disabled_notice || "Cổng nạp tiền tự động VietQR đang tạm dừng để bảo trì. Quý khách vui lòng liên hệ Telegram hỗ trợ để nạp tiền trực tiếp!",
					sepay_min_deposit_vnd: Number(data.sepay_min_deposit_vnd || 10000),
				}));
			}
		} catch (err) {
			setError(err.message || "Không thể tải cấu hình API");
		} finally {
			setLoading(false);
		}
	}, [request]);

	useEffect(() => {
		loadConfig();
	}, [loadConfig]);

	async function saveConfig(event) {
		event.preventDefault();
		setBusy(true);
		setError("");
		setMessage("");
		try {
			await request("", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ api_config: form }),
			});
			setMessage("Đã lưu cấu hình API thành công! Các thay đổi đã có hiệu lực ngay lập tức.");
		} catch (saveError) {
			setError(saveError.message || "Không thể lưu cấu hình");
		} finally {
			setBusy(false);
		}
	}

	async function toggleDepositDirectly() {
		const nextState = !form.deposit_enabled;
		setForm((prev) => ({ ...prev, deposit_enabled: nextState }));
		setBusy(true);
		setError("");
		setMessage("");
		try {
			await request("", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ api_config: { ...form, deposit_enabled: nextState } }),
			});
			setMessage(nextState ? "🟢 Đã BẬT cổng nạp tiền tự động (VietQR) thành công!" : "⏸️ Đã TẮT cổng nạp tiền (Trang nạp tiền sẽ chuyển sang hướng dẫn ib Telegram)!");
		} catch (err) {
			setError(err.message || "Không thể cập nhật trạng thái nạp tiền");
			setForm((prev) => ({ ...prev, deposit_enabled: !nextState }));
		} finally {
			setBusy(false);
		}
	}

	async function testConnection(provider) {
		setTestingProvider(provider);
		setTestResults((prev) => ({ ...prev, [provider]: { testing: true, message: "" } }));
		try {
			const payload = {
				action: "test_provider",
				provider,
				token: provider === "otphub" ? form.otphub_token : provider === "viotp" ? form.viotp_token : provider === "sepay" ? form.sepay_webhook_api_key : "",
				baseUrl: form.otphub_base_url,
				apiKey: provider === "otistx" ? form.otistx_api_key : "",
			};
			const res = await request("", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
			setTestResults((prev) => ({
				...prev,
				[provider]: {
					testing: false,
					success: true,
					message: res.message || `Kết nối thành công! Số dư ví: ${Number(res.balance || 0).toLocaleString("vi-VN")} ₫`,
				},
			}));
		} catch (err) {
			setTestResults((prev) => ({
				...prev,
				[provider]: { testing: false, success: false, message: err.message || "Kiểm tra thất bại" },
			}));
		} finally {
			setTestingProvider("");
		}
	}

	return (
		<>
			<PageHeading
				eyebrow="CẤU HÌNH HỆ THỐNG"
				title="Cấu hình API & Nhà cung cấp"
				description="Thiết lập API Key, Token và cổng thanh toán. Cấu hình được lưu trực tiếp vào cơ sở dữ liệu và áp dụng tức thì."
				action={
					<button className="quiet-button" onClick={loadConfig} disabled={loading || busy}>
						{loading ? "Đang tải..." : "Làm mới"}
					</button>
				}
			/>

			<AdminNotice error={error} message={message} />

			{/* Quick Banner Top: Bật / Tắt Nạp Tiền 1-Chạm */}
			<div className="admin-panel glass-panel" style={{
				marginBottom: 24,
				padding: "18px 22px",
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				flexWrap: "wrap",
				gap: 16,
				borderLeft: `5px solid ${form.deposit_enabled ? "#10b981" : "#f59e0b"}`
			}}>
				<div style={{ display: "flex", alignItems: "center", gap: 14 }}>
					<span style={{ fontSize: 28, lineHeight: 1 }}>{form.deposit_enabled ? "💳" : "⏸️"}</span>
					<div>
						<div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
							<strong style={{ fontSize: 16, color: "#ffffff" }}>Cổng Nạp Tiền Web:</strong>
							<span style={{
								fontSize: 12.5,
								fontWeight: 800,
								padding: "3px 12px",
								borderRadius: 999,
								background: form.deposit_enabled ? "rgba(16, 185, 129, 0.2)" : "rgba(245, 158, 11, 0.2)",
								color: form.deposit_enabled ? "#34d399" : "#fbbf24",
								border: `1px solid ${form.deposit_enabled ? "#10b981" : "#f59e0b"}`
							}}>
								{form.deposit_enabled ? "🟢 ĐANG BẬT (TỰ ĐỘNG VIETQR)" : "⏸️ ĐANG TẮT (HIỆN IB TELEGRAM)"}
							</span>
						</div>
						<p style={{ margin: "5px 0 0 0", fontSize: 13, color: "var(--text-muted)" }}>
							{form.deposit_enabled
								? "Khách hàng vào trang /deposit quét mã QR nạp tiền tự động 24/7."
								: "Trang /deposit sẽ ẩn mã QR và hiện thông báo yêu cầu nhắn tin Telegram để Admin nạp thủ công."}
						</p>
					</div>
				</div>

				<button
					type="button"
					onClick={toggleDepositDirectly}
					disabled={busy}
					style={{
						display: "inline-flex",
						alignItems: "center",
						gap: 8,
						padding: "10px 22px",
						borderRadius: 8,
						fontWeight: 800,
						fontSize: 14,
						cursor: "pointer",
						border: "1px solid",
						background: form.deposit_enabled ? "#f59e0b" : "#10b981",
						borderColor: form.deposit_enabled ? "#d97706" : "#059669",
						color: "#0f172a",
						boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
						transition: "all 0.15s ease",
					}}
				>
					{busy ? "Đang cập nhật..." : form.deposit_enabled ? "⏸️ Bấm vào đây để TẮT nạp tiền" : "🟢 Bấm vào đây để BẬT nạp tiền"}
				</button>
			</div>

			<form className="admin-api-config-container" onSubmit={saveConfig}>
				{/* Block 1: OtpHub VIP */}
				<div className="admin-panel glass-panel" style={{ marginBottom: 24 }}>
					<div className="admin-section-heading">
						<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
							<div className="provider-logo-badge otphub">V8</div>
							<div>
								<h2>OtpHub VIP (SIM OTP V8 VIP)</h2>
								<p>Cổng cấp số siêu tốc hỗ trợ Shopee, TikTok, Google,... và hoàn tiền lập tức khi hủy.</p>
							</div>
						</div>
						<button
							type="button"
							className="quiet-button"
							disabled={testingProvider === "otphub" || !form.otphub_token}
							onClick={() => testConnection("otphub")}
						>
							{testingProvider === "otphub" ? "Đang kiểm tra..." : "⚡ Test kết nối & Số dư"}
						</button>
					</div>

					{testResults.otphub && (
						<div className={`admin-notice ${testResults.otphub.success ? "success-message" : "error-message"}`} style={{ marginTop: 8, marginBottom: 16 }}>
							{testResults.otphub.message}
						</div>
					)}

					<div className="admin-form-grid-2">
						<label className="input-group-label">
							<span>Domain API / Base URL</span>
							<input
								type="text"
								value={form.otphub_base_url}
								onChange={(e) => setForm((prev) => ({ ...prev, otphub_base_url: e.target.value }))}
								required
								placeholder="https://otphubtl.vercel.app"
								className="admin-input-field mono-text"
							/>
							<span className="field-hint">Mặc định: https://otphubtl.vercel.app</span>
						</label>

						<label className="input-group-label">
							<span>API Key / Token OtpHub</span>
							<input
								type="text"
								value={form.otphub_token}
								onChange={(e) => setForm((prev) => ({ ...prev, otphub_token: e.target.value }))}
								required
								placeholder="Nhập API Key được cấp"
								className="admin-input-field mono-text"
							/>
							<span className="field-hint">Token xác thực tài khoản thuê SIM trên OtpHub</span>
						</label>
					</div>

					<div style={{ marginTop: 16 }}>
						<label className="input-group-label" style={{ maxWidth: 360 }}>
							<span>Shopee Service ID trên OtpHub</span>
							<input
								type="text"
								value={form.otphub_shopee_service_id}
								onChange={(e) => setForm((prev) => ({ ...prev, otphub_shopee_service_id: e.target.value }))}
								placeholder="shopee"
								className="admin-input-field mono-text"
							/>
							<span className="field-hint">Mã dịch vụ Shopee (mặc định: shopee)</span>
						</label>
					</div>
				</div>

				{/* Block 2: ViOTP */}
				<div className="admin-panel glass-panel" style={{ marginBottom: 24 }}>
					<div className="admin-section-heading">
						<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
							<div className="provider-logo-badge viotp">VI</div>
							<div>
								<h2>ViOTP API (Shopee V7 & TikTok V1)</h2>
								<p>Cổng cấp số ViOTP đa nhà mạng hỗ trợ SIM Shopee V7 và TikTok V1.</p>
							</div>
						</div>
						<button
							type="button"
							className="quiet-button"
							disabled={testingProvider === "viotp" || !form.viotp_token}
							onClick={() => testConnection("viotp")}
						>
							{testingProvider === "viotp" ? "Đang kiểm tra..." : "⚡ Test kết nối & Số dư"}
						</button>
					</div>

					{testResults.viotp && (
						<div className={`admin-notice ${testResults.viotp.success ? "success-message" : "error-message"}`} style={{ marginTop: 8, marginBottom: 16 }}>
							{testResults.viotp.message}
						</div>
					)}

					<div className="admin-form-grid-3">
						<label className="input-group-label">
							<span>Token ViOTP</span>
							<input
								type="text"
								value={form.viotp_token}
								onChange={(e) => setForm((prev) => ({ ...prev, viotp_token: e.target.value }))}
								placeholder="Token ViOTP"
								className="admin-input-field mono-text"
							/>
							<span className="field-hint">Token lấy tại viotp.com</span>
						</label>

						<label className="input-group-label">
							<span>Service ID Shopee (Gói V7)</span>
							<input
								type="text"
								value={form.viotp_shopee_service_id}
								onChange={(e) => setForm((prev) => ({ ...prev, viotp_shopee_service_id: e.target.value }))}
								placeholder="4"
								className="admin-input-field mono-text"
							/>
							<span className="field-hint">ID dịch vụ Shopee tại ViOTP (mặc định: 4)</span>
						</label>

						<label className="input-group-label">
							<span>Service ID TikTok (Gói TikTok V1)</span>
							<input
								type="text"
								value={form.viotp_tiktok_service_id}
								onChange={(e) => setForm((prev) => ({ ...prev, viotp_tiktok_service_id: e.target.value }))}
								placeholder="29"
								className="admin-input-field mono-text"
							/>
							<span className="field-hint">ID dịch vụ TikTok tại ViOTP (mặc định: 29)</span>
						</label>
					</div>
				</div>

				{/* Block 3: OtisTx */}
				<div className="admin-panel glass-panel" style={{ marginBottom: 24 }}>
					<div className="admin-section-heading">
						<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
							<div className="provider-logo-badge otistx">OT</div>
							<div>
								<h2>OtisTx API (Shopee & Gói 01-06)</h2>
								<p>Hệ thống cổng cấp số OtisTx.</p>
							</div>
						</div>
						<button
							type="button"
							className="quiet-button"
							disabled={testingProvider === "otistx" || !form.otistx_api_key}
							onClick={() => testConnection("otistx")}
						>
							{testingProvider === "otistx" ? "Đang kiểm tra..." : "⚡ Test kết nối & Số dư"}
						</button>
					</div>

					{testResults.otistx && (
						<div className={`admin-notice ${testResults.otistx.success ? "success-message" : "error-message"}`} style={{ marginTop: 8, marginBottom: 16 }}>
							{testResults.otistx.message}
						</div>
					)}

					<label className="input-group-label" style={{ maxWidth: 500 }}>
						<span>OtisTx API Key</span>
						<input
							type="text"
							value={form.otistx_api_key}
							onChange={(e) => setForm((prev) => ({ ...prev, otistx_api_key: e.target.value }))}
							placeholder="otx_..."
							className="admin-input-field mono-text"
						/>
						<span className="field-hint">X-API-Key trên otistx.com</span>
					</label>
				</div>

				{/* Block 4: SePay Auto Topup */}
				<div className="admin-panel glass-panel" style={{ marginBottom: 24 }}>
					<div className="admin-section-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
						<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
							<div className="finance-icon-wrap emerald" style={{ width: 36, height: 36, fontSize: 16 }}>💳</div>
							<div>
								<h2>Cổng Nạp Tiền & Ngân hàng VietQR (SePay)</h2>
								<p>Bật/tắt nạp tiền tự động và thiết lập tài khoản nhận tiền hoặc thông tin hỗ trợ Telegram.</p>
							</div>
						</div>

						{/* Quick Toggle Button */}
						<button
							type="button"
							onClick={() => setForm((prev) => ({ ...prev, deposit_enabled: !prev.deposit_enabled }))}
							style={{
								display: "inline-flex",
								alignItems: "center",
								gap: 10,
								padding: "8px 18px",
								borderRadius: "999px",
								fontSize: 13,
								fontWeight: 700,
								cursor: "pointer",
								border: "1px solid",
								borderColor: form.deposit_enabled ? "rgba(16, 185, 129, 0.6)" : "rgba(245, 158, 11, 0.6)",
								background: form.deposit_enabled ? "rgba(16, 185, 129, 0.18)" : "rgba(245, 158, 11, 0.18)",
								color: form.deposit_enabled ? "#34d399" : "#fbbf24",
								transition: "all 0.2s ease",
							}}
							title="Bấm để bật hoặc tắt giao dịch nạp tiền"
						>
							<span style={{
								width: 10,
								height: 10,
								borderRadius: "50%",
								background: form.deposit_enabled ? "#10b981" : "#f59e0b",
								boxShadow: form.deposit_enabled ? "0 0 10px #10b981" : "0 0 10px #f59e0b",
							}}></span>
							{form.deposit_enabled ? "Đang BẬT nạp tiền tự động (VietQR)" : "Đang TẮT (Chuyển sang ib Telegram)"}
						</button>
					</div>

					{/* Status Notice Card */}
					<div style={{
						padding: "14px 18px",
						borderRadius: 12,
						marginBottom: 20,
						border: "1px solid",
						borderColor: form.deposit_enabled ? "rgba(16, 185, 129, 0.3)" : "rgba(245, 158, 11, 0.35)",
						background: form.deposit_enabled ? "rgba(16, 185, 129, 0.08)" : "rgba(245, 158, 11, 0.1)",
						display: "flex",
						alignItems: "flex-start",
						gap: 14,
					}}>
						<span style={{ fontSize: 24, lineHeight: 1 }}>{form.deposit_enabled ? "🟢" : "⏸️"}</span>
						<div style={{ flex: 1, fontSize: 13, lineHeight: 1.5 }}>
							<strong style={{ color: form.deposit_enabled ? "#34d399" : "#fbbf24", display: "block", marginBottom: 3, fontSize: 14 }}>
								{form.deposit_enabled
									? "Trạng thái: BẬT — Cổng nạp tiền tự động VietQR đang hoạt động"
									: "Trạng thái: TẮT — Đang hiển thị hướng dẫn nhắn Telegram để nạp"}
							</strong>
							<span style={{ color: "var(--text-muted)" }}>
								{form.deposit_enabled
									? "Người dùng vào trang Nạp tiền sẽ thấy mã QR VietQR, thông tin tài khoản ngân hàng và hệ thống tự động cộng tiền sau khi chuyển khoản."
									: "Người dùng vào trang Nạp tiền sẽ thấy thông báo tạm đóng nạp tự động, nút nhắn tin Telegram hỗ trợ kèm Tên đăng nhập và Mã nạp tiền để Admin nạp tiền thủ công."}
							</span>
						</div>
					</div>

					<div className="admin-form-grid-2" style={{ marginBottom: 18 }}>
						<label className="input-group-label">
							<span>Username / Link Telegram hỗ trợ (khi tắt)</span>
							<input
								type="text"
								value={form.deposit_support_telegram}
								onChange={(e) => setForm((prev) => ({ ...prev, deposit_support_telegram: e.target.value }))}
								placeholder="VD: Vuha_cute_dapxe_trenpho"
								className="admin-input-field mono-text"
							/>
							<span className="field-hint">Username hoặc Link Telegram để người dùng bấm vào nhắn tin</span>
						</label>

						<label className="input-group-label">
							<span>Lời nhắn thông báo cho khách khi tắt</span>
							<input
								type="text"
								value={form.deposit_disabled_notice}
								onChange={(e) => setForm((prev) => ({ ...prev, deposit_disabled_notice: e.target.value }))}
								placeholder="VD: Cổng nạp tiền tự động đang tạm dừng. Vui lòng liên hệ Telegram hỗ trợ!"
								className="admin-input-field"
							/>
							<span className="field-hint">Nội dung hiển thị trên trang /deposit khi nạp tiền tự động bị tắt</span>
						</label>
					</div>

					<div className="admin-form-grid-3">
						<label className="input-group-label">
							<span>Ngân hàng nhận tiền</span>
							<input
								type="text"
								value={form.sepay_bank_name}
								onChange={(e) => setForm((prev) => ({ ...prev, sepay_bank_name: e.target.value }))}
								placeholder="VD: TPBank, Vietcombank, MB"
								className="admin-input-field"
							/>
							<span className="field-hint">Tên viết tắt ngân hàng VietQR</span>
						</label>

						<label className="input-group-label">
							<span>Số tài khoản</span>
							<input
								type="text"
								value={form.sepay_account_number}
								onChange={(e) => setForm((prev) => ({ ...prev, sepay_account_number: e.target.value }))}
								placeholder="VD: 10005790882"
								className="admin-input-field mono-text"
							/>
							<span className="field-hint">Số tài khoản thụ hưởng</span>
						</label>

						<label className="input-group-label">
							<span>Tên chủ tài khoản</span>
							<input
								type="text"
								value={form.sepay_account_name}
								onChange={(e) => setForm((prev) => ({ ...prev, sepay_account_name: e.target.value }))}
								placeholder="VD: LE VU HA"
								className="admin-input-field"
							/>
							<span className="field-hint">Tên in trên thẻ (không dấu)</span>
						</label>
					</div>

					<div className="admin-form-grid-2" style={{ marginTop: 16 }}>
						<label className="input-group-label">
							<span>Mức nạp tối thiểu (VND)</span>
							<input
								type="number"
								min="1000"
								step="1000"
								value={form.sepay_min_deposit_vnd}
								onChange={(e) => setForm((prev) => ({ ...prev, sepay_min_deposit_vnd: Number(e.target.value) }))}
								className="admin-input-field mono-text"
							/>
							<span className="field-hint">Khách không thể nạp dưới số tiền này (mặc định: 10.000 ₫)</span>
						</label>

						<label className="input-group-label">
							<span>SePay Webhook API Key (Tùy chọn)</span>
							<input
								type="text"
								value={form.sepay_webhook_api_key}
								onChange={(e) => setForm((prev) => ({ ...prev, sepay_webhook_api_key: e.target.value }))}
								placeholder="Để trống nếu không bảo mật webhook"
								className="admin-input-field mono-text"
							/>
							<span className="field-hint">Key bảo mật xác thực request từ SePay</span>
						</label>
					</div>
				</div>

				{/* Block 5: System Defaults */}
				<div className="admin-panel glass-panel" style={{ marginBottom: 24 }}>
					<div className="admin-section-heading">
						<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
							<div className="finance-icon-wrap violet" style={{ width: 36, height: 36, fontSize: 16 }}>⚙️</div>
							<div>
								<h2>Cấu hình mặc định hệ thống</h2>
								<p>Thiết lập nhà cung cấp và gói SIM mặc định khi người dùng mở trang thuê.</p>
							</div>
						</div>
					</div>

					<div className="admin-form-grid-3">
						<label className="input-group-label">
							<span>Nhà cung cấp mặc định</span>
							<select
								value={form.sim_provider}
								onChange={(e) => setForm((prev) => ({ ...prev, sim_provider: e.target.value }))}
								className="admin-input-field"
							>
								<option value="otphub">OtpHub VIP (SIM OTP V8 VIP)</option>
								<option value="viotp">ViOTP</option>
								<option value="otistx">OtisTx</option>
							</select>
							<span className="field-hint">Cổng thuê ưu tiên xử lý</span>
						</label>

						<label className="input-group-label">
							<span>Gói SIM mặc định</span>
							<select
								value={form.sim_service}
								onChange={(e) => setForm((prev) => ({ ...prev, sim_service: e.target.value }))}
								className="admin-input-field"
							>
								<option value="otissim_v8">SIM OTP V8 VIP (Khuyên dùng)</option>
								<option value="otissim_v7">SIM OTP 07 (ViOTP)</option>
								<option value="otissim_v1">SIM OTP 01 (OtisTx No-check)</option>
								<option value="otissim_v2">SIM OTP 02 (OtisTx Check)</option>
								<option value="otissim_v3">SIM OTP 03 (OtisTx Realtime)</option>
								<option value="simotp_tiktok_v1">SIM OTP TikTok V1</option>
							</select>
							<span className="field-hint">Gói tự động chọn khi vào Dashboard</span>
						</label>

						<label className="input-group-label">
							<span>Nhà mạng mặc định</span>
							<select
								value={form.sim_carrier}
								onChange={(e) => setForm((prev) => ({ ...prev, sim_carrier: e.target.value }))}
								className="admin-input-field"
							>
								<option value="random">Ngẫu nhiên (Tất cả mạng)</option>
								<option value="viettel">Viettel</option>
								<option value="vinaphone">VinaPhone</option>
								<option value="mobifone">MobiFone</option>
								<option value="vnmb">Vietnamobile</option>
								<option value="itel">iTel</option>
								<option value="wintel">Wintel</option>
							</select>
							<span className="field-hint">Mạng mặc định khi tạo yêu cầu</span>
						</label>
					</div>
				</div>

				<div className="admin-form-footer">
					<span className="admin-price-footnote">✓ Dữ liệu lưu an toàn trên cơ sở dữ liệu phân tán Redis.</span>
					<button type="submit" className="primary-button admin-save-price-btn" disabled={busy}>
						{busy ? "Đang lưu cấu hình..." : "💾 Lưu cấu hình API"}
					</button>
				</div>
			</form>
		</>
	);
}
