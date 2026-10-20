"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { removeVietnameseAccents, normalizeVietnameseName, isValidVietnameseName } from "@/lib/vietnamese-name";

export default function RequireNamePopup() {
	const pathname = usePathname();
	const [user, setUser] = useState(null);
	const [fullName, setFullName] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState(false);

	useEffect(() => {
		// Do not show on auth pages or admin panel
		if (pathname?.startsWith("/admin") || pathname?.startsWith("/login") || pathname?.startsWith("/register")) {
			return;
		}

		let active = true;

		async function checkUser() {
			try {
				const res = await fetch("/api/auth", { cache: "no-store" });
				if (!res.ok) return;
				const data = await res.json();
				if (!active || !data?.user?.id) return;

				// If user does not have a fullName, trigger the mandatory popup
				if (!data.user.fullName || String(data.user.fullName).trim() === "") {
					setUser(data.user);
				}
			} catch {
				// Silently fail if network issue
			}
		}

		checkUser();

		return () => {
			active = false;
		};
	}, [pathname]);

	if (!user) return null;

	const normalizedPreview = normalizeVietnameseName(fullName);

	async function handleSubmit(e) {
		e.preventDefault();
		setError("");

		const normalized = normalizeVietnameseName(fullName);
		if (!isValidVietnameseName(normalized)) {
			setError("Họ và tên không hợp lệ. Vui lòng nhập họ và tên thật tiếng Việt không dấu (tối thiểu 2 từ, VD: LE VU HA).");
			return;
		}

		setBusy(true);
		try {
			const res = await fetch("/api/user/update-name", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ fullName: normalized }),
			});
			const data = await res.json();
			if (!res.ok) {
				throw new Error(data.error || "Không thể cập nhật họ tên. Vui lòng thử lại.");
			}

			setSuccess(true);
			// Refresh page to load updated session and deposit code
			setTimeout(() => {
				window.location.reload();
			}, 900);
		} catch (err) {
			setError(err.message || "Có lỗi xảy ra, vui lòng thử lại.");
		} finally {
			setBusy(false);
		}
	}

	async function handleLogout() {
		try {
			await fetch("/api/auth", { method: "DELETE" });
			window.location.href = "/login";
		} catch {
			window.location.href = "/login";
		}
	}

	return (
		<div className="require-name-modal-overlay">
			<div className="require-name-modal-card glass-panel" role="dialog" aria-modal="true" aria-labelledby="require-name-title">
				<div className="require-name-badge-row">
					<span className="require-name-pill">
						<span className="pulse-dot"></span>
						THÔNG BÁO BẮT BUỘC
					</span>
				</div>

				<div className="require-name-header">
					<div className="require-name-icon">🪪</div>
					<h2 id="require-name-title">Cập nhật Họ và Tên thật</h2>
					<p className="require-name-desc">
						Hệ thống SIM OTP vừa nâng cấp định dạng chuyển khoản nạp tiền tự động mới theo tên khách hàng:{" "}
						<strong style={{ color: "#10b981" }}>[Tên của bạn] chuyen tien</strong>.
						<br />
						Quý khách vui lòng cập nhật Họ và Tên thật (viết hoa không dấu, như trên thẻ ngân hàng/CCCD) để tiếp tục sử dụng website.
					</p>
				</div>

				{success ? (
					<div className="require-name-success-box">
						<span className="success-icon">✓</span>
						<strong>Cập nhật thành công!</strong>
						<p>Đang làm mới trang để áp dụng cú pháp nạp tiền mới...</p>
					</div>
				) : (
					<form className="require-name-form" onSubmit={handleSubmit}>
						<div className="form-group-field">
							<label htmlFor="modal-fullname">
								<span>Họ và tên thật (không dấu)</span>
								<span className="field-hint">(Ví dụ: LE VU HA)</span>
							</label>
							<div className="input-with-icon-wrap">
								<span className="field-prefix-icon">👤</span>
								<input
									id="modal-fullname"
									type="text"
									placeholder="VD: LE VU HA"
									autoComplete="name"
									value={fullName}
									onChange={(e) => {
										const cleaned = removeVietnameseAccents(e.target.value)
											.toUpperCase()
											.replace(/[^A-Z\s]/g, "")
											.replace(/\s+/g, " ");
										setFullName(cleaned);
									}}
									required
									autoFocus
									className="auth-text-input uppercase-input"
									maxLength={50}
								/>
							</div>

							{normalizedPreview.length >= 3 && (
								<div className="require-name-preview">
									<span>💬 Cú pháp nạp tiền của bạn sẽ là: </span>
									<strong>{normalizedPreview} chuyen tien</strong>
								</div>
							)}
						</div>

						{error && (
							<div className="auth-error-banner" role="alert" style={{ marginTop: 12 }}>
								<span className="error-icon">⚠️</span>
								<span className="error-text">{error}</span>
							</div>
						)}

						<div className="require-name-note">
							<span>📌</span>
							<p>
								Tên này phải là tên người bình thường (tối thiểu 2 từ, gồm họ và tên). Khi nạp tiền ngân hàng, nội dung chuyển khoản chỉ cần ghi đúng cú pháp trên để được cộng tiền tự động 24/7.
							</p>
						</div>

						<button
							type="submit"
							className="primary-button require-name-submit-btn"
							disabled={busy}
						>
							{busy ? "Đang lưu thông tin..." : "Xác nhận & Tiếp tục sử dụng →"}
						</button>

						<div className="require-name-logout-row">
							<button type="button" onClick={handleLogout} className="logout-text-btn">
								Đăng xuất tài khoản
							</button>
						</div>
					</form>
				)}
			</div>
		</div>
	);
}
