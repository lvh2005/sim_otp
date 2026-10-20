"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdmin } from "../admin-shell";
import { AdminNotice, PageHeading } from "../admin-ui";

const QUICK_TEMPLATES = [
	{
		label: "Cập nhật tính năng",
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
	},
	{
		label: "Bảo trì định kỳ",
		tag: "BẢO TRÌ HỆ THỐNG",
		title: "Thông báo nâng cấp máy chủ & API",
		content: `⚠️ THÔNG BÁO NÂNG CẤP HẠ TẦNG MÁY CHỦ

Kính gửi Quý khách hàng,

Hệ thống SIM OTP sẽ tiến hành bảo trì và nâng cấp định kỳ nhằm tối ưu hóa đường truyền mạng và tốc độ tạo số thuê OTP.

⏰ Thời gian: Từ 01:00 đến 02:00 ngày mai
⚡ Trong thời gian này, các yêu cầu tạo đơn có thể tạm thời bị gián đoạn trong vài phút.
💰 Số dư và lịch sử giao dịch của Quý khách hoàn toàn an toàn và được bảo lưu 100%.

Trân trọng cảm ơn sự đồng hành của Quý khách!`,
		actionText: "Tham gia nhóm hỗ trợ",
		actionUrl: "https://t.me/simotp_support",
		hideDurationHours: 6,
	},
	{
		label: "Khuyến mãi nạp tiền",
		tag: "KHUYẾN MÃI ĐẶC BIỆT",
		title: "Ưu đãi tặng +10% giá trị nạp",
		content: `🎁 CHƯƠNG TRÌNH TRI ÂN KHÁCH HÀNG

Tặng ngay **+10% giá trị nạp** cho tất cả các giao dịch chuyển khoản từ 100.000đ trở lên trong tuần này!

• Áp dụng tự động khi quét mã QR nạp tiền SePay 24/7.
• Tiền thưởng được cộng trực tiếp vào tài khoản ngay sau khi giao dịch thành công.
• Không giới hạn số lần nạp trong thời gian khuyến mãi.`,
		actionText: "Nạp tiền ngay →",
		actionUrl: "/deposit",
		hideDurationHours: 12,
	},
];

export default function AdminAnnouncementPage() {
	const { request } = useAdmin();
	const [form, setForm] = useState({
		enabled: true,
		tag: "THÔNG BÁO HỆ THỐNG",
		title: "Cập nhật mới từ SIM OTP",
		content: "",
		actionText: "Xem chi tiết →",
		actionUrl: "/dashboard",
		hideDurationHours: 2,
	});
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [message, setMessage] = useState("");
	const [previewOpen, setPreviewOpen] = useState(false);

	const loadData = useCallback(async () => {
		setError("");
		try {
			const data = await request("?view=announcement");
			if (data) {
				setForm({
					enabled: typeof data.enabled === "boolean" ? data.enabled : true,
					tag: data.tag || "THÔNG BÁO HỆ THỐNG",
					title: data.title || "",
					content: data.content || "",
					actionText: data.actionText || "",
					actionUrl: data.actionUrl || "",
					hideDurationHours: data.hideDurationHours || 2,
				});
			}
		} catch (err) {
			setError(err.message || "Không thể tải cấu hình thông báo");
		}
	}, [request]);

	useEffect(() => {
		loadData();
	}, [loadData]);

	async function handleSubmit(e) {
		e.preventDefault();
		setBusy(true);
		setError("");
		setMessage("");
		try {
			await request("", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ announcement: form }),
			});
			setMessage("✅ Đã lưu cấu hình thông báo thành công! Khách hàng sẽ thấy popup mới ngay khi mở trang.");
		} catch (err) {
			setError(err.message || "Lỗi khi lưu thông báo");
		} finally {
			setBusy(false);
		}
	}

	function applyTemplate(tpl) {
		setForm((prev) => ({
			...prev,
			tag: tpl.tag,
			title: tpl.title,
			content: tpl.content,
			actionText: tpl.actionText,
			actionUrl: tpl.actionUrl,
			hideDurationHours: tpl.hideDurationHours,
		}));
		setMessage(`Đã áp dụng mẫu "${tpl.label}". Đừng quên bấm "Lưu thông báo" để áp dụng.`);
	}

	function insertFormatting(prefix, suffix = "") {
		const textarea = document.getElementById("announcement-content-input");
		if (!textarea) return;
		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		const text = textarea.value;
		const selected = text.substring(start, end) || "nội dung";
		const replacement = `${prefix}${selected}${suffix}`;
		const nextVal = text.substring(0, start) + replacement + text.substring(end);
		setForm((prev) => ({ ...prev, content: nextVal }));
		setTimeout(() => {
			textarea.focus();
			textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
		}, 0);
	}

	return (
		<>
			<PageHeading
				eyebrow="TRẢI NGHIỆM NGƯỜI DÙNG"
				title="Thông báo Popup"
				description="Tạo và quản lý cửa sổ thông báo nổi bật (modal popup) tự động xuất hiện khi người dùng truy cập website."
				action={
					<div style={{ display: "flex", gap: "8px" }}>
						<button
							type="button"
							className="quiet-button"
							onClick={() => setPreviewOpen(true)}
							style={{ background: "rgba(6, 182, 212, 0.12)", color: "var(--cyan)", borderColor: "rgba(6, 182, 212, 0.3)" }}
						>
							👁️ Xem trước giao diện
						</button>
						<button type="button" className="quiet-button" onClick={loadData}>
							Làm mới
						</button>
					</div>
				}
			/>

			<AdminNotice error={error} message={message} />

			<div className="admin-announcement-grid">
				<form className="admin-panel glass-panel" onSubmit={handleSubmit}>
					{/* Status switch banner */}
					<div className="admin-status-toggle-card">
						<div className="admin-toggle-info">
							<div className="admin-toggle-icon">🔔</div>
							<div>
								<strong>Trạng thái hiển thị Popup</strong>
								<p className="muted">
									{form.enabled
										? "Đang BẬT: Popup sẽ hiển thị tự động khi khách mở web."
										: "Đang TẮT: Không có popup nào hiển thị khi khách vào web."}
								</p>
							</div>
						</div>
						<label className="switch-container" title="Bật/Tắt thông báo">
							<input
								type="checkbox"
								checked={form.enabled}
								onChange={(e) => setForm((prev) => ({ ...prev, enabled: e.target.checked }))}
							/>
							<span className="switch-slider" />
						</label>
					</div>

					{/* Quick Templates */}
					<div className="admin-field-group">
						<label className="input-group-label">
							<span>Mẫu thông báo có sẵn:</span>
						</label>
						<div className="quick-template-chips">
							{QUICK_TEMPLATES.map((tpl) => (
								<button
									key={tpl.label}
									type="button"
									className="template-chip"
									onClick={() => applyTemplate(tpl)}
								>
									✨ {tpl.label}
								</button>
							))}
						</div>
					</div>

					<div className="admin-form-grid-2">
						{/* Tag / Eyebrow */}
						<label className="input-group-label">
							<span>Nhãn phụ / Tag (Eyebrow)</span>
							<input
								type="text"
								placeholder="VD: THÔNG BÁO HỆ THỐNG"
								value={form.tag}
								onChange={(e) => setForm((prev) => ({ ...prev, tag: e.target.value }))}
								required
								className="admin-input-field"
							/>
							<span className="field-hint">Chữ in hoa màu cam nổi bật ở đầu popup.</span>
						</label>

						{/* Title */}
						<label className="input-group-label">
							<span>Tiêu đề chính thông báo</span>
							<input
								type="text"
								placeholder="VD: Cập nhật mới từ OtisTX"
								value={form.title}
								onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
								required
								className="admin-input-field"
							/>
							<span className="field-hint">Dòng tiêu đề lớn bên dưới nhãn phụ.</span>
						</label>
					</div>

					{/* Content */}
					<label className="input-group-label" style={{ marginTop: "12px" }}>
						<div className="field-header-row">
							<span>Nội dung chi tiết thông báo</span>
							<div className="formatting-tools">
								<button type="button" onClick={() => insertFormatting("**", "**")} title="In đậm">
									<b>B</b>
								</button>
								<button type="button" onClick={() => insertFormatting("• ")} title="Gạch đầu dòng">
									• List
								</button>
								<button type="button" onClick={() => insertFormatting("📢 ")} title="Chèn loa">
									📢
								</button>
								<button type="button" onClick={() => insertFormatting("📍 ")} title="Chèn vị trí">
									📍
								</button>
								<button type="button" onClick={() => insertFormatting("🚚 ")} title="Chèn xe tải">
									🚚
								</button>
								<button type="button" onClick={() => insertFormatting("⚡ ")} title="Chèn tia chớp">
									⚡
								</button>
								<button type="button" onClick={() => insertFormatting("💰 ")} title="Chèn tiền">
									💰
								</button>
							</div>
						</div>
						<textarea
							id="announcement-content-input"
							rows={10}
							placeholder="Nhập nội dung thông báo, hỗ trợ xuống dòng, in đậm **text**, danh sách bullet •..."
							value={form.content}
							onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
							required
							className="admin-textarea-field"
							style={{ fontFamily: "inherit", fontSize: "14px", lineHeight: "1.6" }}
						/>
						<span className="field-hint">Hỗ trợ Markdown: <code>**chữ đậm**</code>, gạch đầu dòng <code>•</code> hoặc <code>-</code>.</span>
					</label>

					<div className="admin-form-grid-3" style={{ marginTop: "16px" }}>
						{/* Action Text */}
						<label className="input-group-label">
							<span>Nút hành động (Tùy chọn)</span>
							<input
								type="text"
								placeholder="VD: Xem chi tiết →"
								value={form.actionText}
								onChange={(e) => setForm((prev) => ({ ...prev, actionText: e.target.value }))}
								className="admin-input-field"
							/>
							<span className="field-hint">Để trống nếu không cần nút này.</span>
						</label>

						{/* Action URL */}
						<label className="input-group-label">
							<span>Link nút hành động</span>
							<input
								type="text"
								placeholder="VD: /dashboard hoặc https://..."
								value={form.actionUrl}
								onChange={(e) => setForm((prev) => ({ ...prev, actionUrl: e.target.value }))}
								className="admin-input-field"
							/>
							<span className="field-hint">Đường dẫn khi khách bấm nút hành động.</span>
						</label>

						{/* Hide Duration */}
						<label className="input-group-label">
							<span>Thời gian nút "Tắt trong Xh"</span>
							<select
								value={form.hideDurationHours}
								onChange={(e) => setForm((prev) => ({ ...prev, hideDurationHours: Number(e.target.value) }))}
								className="admin-input-field"
							>
								<option value={1}>1 giờ</option>
								<option value={2}>2 giờ (Mặc định)</option>
								<option value={4}>4 giờ</option>
								<option value={8}>8 giờ</option>
								<option value={12}>12 giờ</option>
								<option value={24}>24 giờ (1 ngày)</option>
								<option value={48}>48 giờ (2 ngày)</option>
							</select>
							<span className="field-hint">Thời gian ẩn tạm thời khi khách bấm tắt.</span>
						</label>
					</div>

					<div className="admin-form-footer" style={{ marginTop: "24px" }}>
						<button
							type="button"
							className="quiet-button"
							onClick={() => setPreviewOpen(true)}
							style={{ marginRight: "auto" }}
						>
							👁️ Xem trước giao diện thực tế
						</button>
						<button type="submit" className="primary-button" disabled={busy}>
							{busy ? "Đang lưu..." : "💾 Lưu thông báo"}
						</button>
					</div>
				</form>
			</div>

			{/* LIVE PREVIEW MODAL */}
			{previewOpen && (
				<div className="announcement-modal-backdrop preview-mode" onClick={() => setPreviewOpen(false)}>
					<div
						className="announcement-modal-card"
						onClick={(e) => e.stopPropagation()}
						role="dialog"
						aria-modal="true"
					>
						{/* Header */}
						<div className="announcement-header">
							<div className="announcement-icon-wrap">
								<svg
									width="24"
									height="24"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
									className="announcement-bell-svg"
								>
									<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
									<path d="M13.73 21a2 2 0 0 1-3.46 0" />
								</svg>
							</div>
							<div className="announcement-title-box">
								<span className="announcement-eyebrow">{form.tag || "THÔNG BÁO HỆ THỐNG"}</span>
								<h3 className="announcement-main-title">{form.title || "Tiêu đề thông báo"}</h3>
							</div>
							<button
								type="button"
								className="announcement-close-btn"
								onClick={() => setPreviewOpen(false)}
								aria-label="Đóng"
							>
								✕
							</button>
						</div>

						{/* Body Content */}
						<div className="announcement-body">
							<FormattedContent text={form.content} />
						</div>

						{/* Footer Actions */}
						<div className="announcement-footer">
							{form.actionText && (
								<button
									type="button"
									className="announcement-btn-action"
									onClick={() => alert(`Sẽ chuyển hướng tới: ${form.actionUrl || "#"}`)}
								>
									{form.actionText}
								</button>
							)}
							<button
								type="button"
								className="announcement-btn-snooze"
								onClick={() => setPreviewOpen(false)}
							>
								Tắt trong {form.hideDurationHours || 2}h
							</button>
							<button
								type="button"
								className="announcement-btn-close"
								onClick={() => setPreviewOpen(false)}
							>
								Đóng thông báo
							</button>
						</div>
					</div>
				</div>
			)}
		</>
	);
}

function FormattedContent({ text }) {
	if (!text) {
		return <p className="muted" style={{ fontStyle: "italic" }}>Chưa có nội dung thông báo...</p>;
	}

	const lines = text.split("\n");

	return (
		<div className="announcement-content-flow">
			{lines.map((line, idx) => {
				if (!line.trim()) {
					return <div key={idx} className="announcement-spacer" />;
				}

				return (
					<div key={idx} className="announcement-text-line">
						{renderBoldSpans(line)}
					</div>
				);
			})}
		</div>
	);
}

function renderBoldSpans(text) {
	if (!text) return null;
	const parts = text.split(/(\*\*.*?\*\*)/g);
	return parts.map((part, i) => {
		if (part.startsWith("**") && part.endsWith("**")) {
			return <strong key={i} className="highlight-text">{part.slice(2, -2)}</strong>;
		}
		return part;
	});
}
