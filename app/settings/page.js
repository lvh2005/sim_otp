"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import TelegramBotWidget from "@/app/components/TelegramBotWidget";
import { useTheme } from "@/app/components/ThemeProvider";

const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });

export default function SettingsPage() {
	const { theme, setTheme } = useTheme();
	const [user, setUser] = useState(null);
	const [userData, setUserData] = useState(null);
	const [loading, setLoading] = useState(true);
	const [activeTab, setActiveTab] = useState("account"); // 'account' | 'security' | 'api' | 'preferences'
	
	// Password form
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [passwordBusy, setPasswordBusy] = useState(false);

	// API key & preferences
	const [showApiKey, setShowApiKey] = useState(false);
	const [apiBusy, setApiBusy] = useState(false);
	const [soundNotification, setSoundNotification] = useState(true);
	const [autoCopyOtp, setAutoCopyOtp] = useState(true);

	const [copiedField, setCopiedField] = useState("");
	const [notice, setNotice] = useState("");
	const [error, setError] = useState("");

	const loadSettings = useCallback(async () => {
		try {
			const res = await fetch("/api/user/settings", { cache: "no-store" });
			if (!res.ok) {
				if (res.status === 401) {
					window.location.href = "/login";
					return;
				}
				throw new Error("Không thể tải cài đặt tài khoản");
			}
			const data = await res.json();
			setUserData(data.user);
			setUser(data.user);
		} catch (err) {
			setError(err.message);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		loadSettings();
		// Load stored preferences
		const storedSound = localStorage.getItem("sotp_sound");
		if (storedSound !== null) setSoundNotification(storedSound === "true");
		const storedAutoCopy = localStorage.getItem("sotp_autocopy");
		if (storedAutoCopy !== null) setAutoCopyOtp(storedAutoCopy === "true");
	}, [loadSettings]);

	const copyText = async (text, fieldName, msg = "Đã sao chép!") => {
		if (!text) return;
		try {
			await navigator.clipboard.writeText(text);
			setCopiedField(fieldName);
			setNotice(msg);
			setTimeout(() => setCopiedField(""), 2000);
		} catch {
			// fallback
		}
	};

	const handleChangePassword = async (e) => {
		e.preventDefault();
		setError("");
		setNotice("");

		if (newPassword !== confirmPassword) {
			setError("Mật khẩu mới và xác nhận mật khẩu không khớp.");
			return;
		}

		if (newPassword.length < 8) {
			setError("Mật khẩu mới phải có tối thiểu 8 ký tự.");
			return;
		}

		setPasswordBusy(true);
		try {
			const res = await fetch("/api/user/settings", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action: "change_password",
					currentPassword,
					newPassword,
				}),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Không thể đổi mật khẩu");

			setNotice("🎉 Đổi mật khẩu thành công!");
			setCurrentPassword("");
			setNewPassword("");
			setConfirmPassword("");
		} catch (err) {
			setError(err.message);
		} finally {
			setPasswordBusy(false);
		}
	};

	const handleRegenerateApiKey = async () => {
		if (!confirm("Bạn có chắc chắn muốn tạo API Key mới? API Key cũ sẽ lập tức bị vô hiệu hóa!")) {
			return;
		}

		setApiBusy(true);
		setError("");
		setNotice("");
		try {
			const res = await fetch("/api/user/settings", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ action: "regenerate_api_key" }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Không thể tạo API Key");

			setUserData((prev) => ({ ...prev, apiKey: data.apiKey }));
			setNotice("🎉 Đã tạo API Key mới thành công!");
		} catch (err) {
			setError(err.message);
		} finally {
			setApiBusy(false);
		}
	};

	const togglePreference = (type) => {
		if (type === "sound") {
			const next = !soundNotification;
			setSoundNotification(next);
			localStorage.setItem("sotp_sound", String(next));
			setNotice(next ? "Đã bật âm thanh khi nhận OTP." : "Đã tắt âm thanh.");
		} else if (type === "autocopy") {
			const next = !autoCopyOtp;
			setAutoCopyOtp(next);
			localStorage.setItem("sotp_autocopy", String(next));
			setNotice(next ? "Đã bật tự động sao chép OTP." : "Đã tắt tự động sao chép.");
		}
	};

	const handleSignOut = async () => {
		await fetch("/api/auth", { method: "DELETE" });
		window.location.href = "/dashboard";
	};

	const formatDateTime = (timestamp) => {
		if (!timestamp) return "—";
		return new Intl.DateTimeFormat("vi-VN", {
			dateStyle: "medium",
			timeStyle: "short",
		}).format(new Date(timestamp));
	};

	if (loading) {
		return (
			<main className="page-shell modern-dark-shell">
				<div className="loading-state-wrapper">
					<div className="app-loader-spinner"></div>
					<p>Đang tải thông tin cài đặt tài khoản...</p>
				</div>
			</main>
		);
	}

	return (
		<main className="page-shell modern-dark-shell settings-page-shell">
			<Header user={user} onSignOut={handleSignOut} />

			<div className="settings-main-container">
				{/* Top Hero Banner */}
				<div className="settings-hero-card glass-panel">
					<div className="settings-hero-left">
						<div className="user-avatar-large">
							{userData?.username?.charAt(0).toUpperCase()}
						</div>
						<div className="user-hero-meta">
							<span className="section-eyebrow">QUẢN TRỊ TÀI KHOẢN CÁ NHÂN</span>
							<h1 className="user-hero-name">@{userData?.username}</h1>
							<p className="user-hero-sub">
								ID tài khoản: <code className="mono-text">{userData?.id}</code> · Tham gia: {formatDateTime(userData?.createdAt)}
							</p>
						</div>
					</div>

					<div className="settings-hero-stats">
						<div className="hero-stat-pill">
							<small>SỐ DƯ HIỆN TẠI</small>
							<strong className="text-emerald">{money.format(userData?.balance || 0)}</strong>
						</div>
						<div className="hero-stat-pill">
							<small>TỔNG ĐƠN THUÊ</small>
							<strong>{userData?.orderCount || 0} số</strong>
						</div>
						<div className="hero-stat-pill">
							<small>TỔNG TIỀN ĐÃ NẠP</small>
							<strong>{money.format(userData?.totalDeposited || 0)}</strong>
						</div>
					</div>
				</div>

				{/* 2-Column Settings Layout */}
				<div className="settings-layout-grid">
					{/* Left Sidebar Menu */}
					<aside className="settings-sidebar glass-panel">
						<button
							type="button"
							className={`settings-nav-btn ${activeTab === "account" ? "active" : ""}`}
							onClick={() => setActiveTab("account")}
						>
							<span className="nav-icon">👤</span>
							<div className="nav-text-col">
								<strong>Hồ sơ & Định danh</strong>
								<small>Mã nạp VietQR, ID tài khoản</small>
							</div>
						</button>

						<button
							type="button"
							className={`settings-nav-btn ${activeTab === "security" ? "active" : ""}`}
							onClick={() => setActiveTab("security")}
						>
							<span className="nav-icon">🔒</span>
							<div className="nav-text-col">
								<strong>Bảo mật & Mật khẩu</strong>
								<small>Đổi mật khẩu, bảo vệ phiên</small>
							</div>
						</button>

						<button
							type="button"
							className={`settings-nav-btn ${activeTab === "api" ? "active" : ""}`}
							onClick={() => setActiveTab("api")}
						>
							<span className="nav-icon">🔑</span>
							<div className="nav-text-col">
								<strong>Developer API Key</strong>
								<small>Mã tích hợp API thuê SIM</small>
							</div>
						</button>

						<button
							type="button"
							className={`settings-nav-btn ${activeTab === "preferences" ? "active" : ""}`}
							onClick={() => setActiveTab("preferences")}
						>
							<span className="nav-icon">⚙️</span>
							<div className="nav-text-col">
								<strong>Tùy chọn trải nghiệm</strong>
								<small>Âm thanh OTP, tự sao chép</small>
							</div>
						</button>

						<div className="settings-nav-divider"></div>

						<button
							type="button"
							className="settings-nav-btn logout-danger-btn"
							onClick={handleSignOut}
						>
							<span className="nav-icon">🚪</span>
							<div className="nav-text-col">
								<strong>Đăng xuất tài khoản</strong>
								<small>Thoát phiên đăng nhập hiện tại</small>
							</div>
						</button>
					</aside>

					{/* Right Content Panel */}
					<section className="settings-content-panel">
						{/* Tab 1: Account Profile & Deposit Info */}
						{activeTab === "account" && (
							<div className="settings-card glass-panel">
								<div className="card-heading-group">
									<h3>Hồ sơ tài khoản</h3>
									<p>Thông tin định danh và thông số ví số dư của bạn.</p>
								</div>

								<div className="settings-details-grid">
									<div className="detail-item-box">
										<label>Họ và tên thật</label>
										<strong className="detail-val" style={{ color: "#10b981", letterSpacing: "0.5px" }}>
											{userData?.fullName || "Chưa cập nhật"}
										</strong>
									</div>

									<div className="detail-item-box">
										<label>Tên đăng nhập (Username)</label>
										<strong className="detail-val">@{userData?.username}</strong>
									</div>

									<div className="detail-item-box">
										<label>Mã tài khoản (User ID)</label>
										<div className="detail-val-with-copy">
											<span className="mono-text">{userData?.id}</span>
											<button
												type="button"
												className="copy-chip"
												onClick={() => copyText(userData?.id, "uid", "Đã sao chép User ID")}
											>
												{copiedField === "uid" ? "✓ Đã chép" : "Sao chép"}
											</button>
										</div>
									</div>

									<div className="detail-item-box highlight-box">
										<label>Cú pháp nạp tiền cố định (Deposit Code)</label>
										<div className="detail-val-with-copy">
											<strong className="mono-text deposit-code-highlight">{userData?.depositCode}</strong>
											<button
												type="button"
												className="copy-chip primary-chip"
												onClick={() => copyText(userData?.depositCode, "dcode", "Đã sao chép mã nạp tiền")}
											>
												{copiedField === "dcode" ? "✓ Đã chép" : "Sao chép mã"}
											</button>
										</div>
										<small className="field-hint">
											Mỗi khi chuyển khoản ngân hàng ghi nội dung này, hệ thống sẽ tự động cộng tiền cho tài khoản của bạn.
										</small>
									</div>

									<div className="detail-item-box">
										<label>Số dư tài khoản</label>
										<div className="balance-action-row">
											<strong className="balance-large text-emerald">
												{money.format(userData?.balance || 0)}
											</strong>
											<Link href="/deposit" className="quick-deposit-accent-btn">
												💳 Đến trang Nạp tiền ↗
											</Link>
										</div>
									</div>
								</div>

								<div className="settings-quick-links-bar">
									<Link href="/history" className="secondary-glass-btn">
										⏱ Xem lịch sử thuê số ({userData?.orderCount}) ↗
									</Link>
									<Link href="/deposit" className="primary-action-btn">
										💳 Nạp tiền VietQR ↗
									</Link>
								</div>
							</div>
						)}

						{/* Tab 2: Security & Password */}
						{activeTab === "security" && (
							<div className="settings-card glass-panel">
								<div className="card-heading-group">
									<h3>Bảo mật & Đổi mật khẩu</h3>
									<p>Cập nhật mật khẩu định kỳ để đảm bảo an toàn cho tài khoản và số dư.</p>
								</div>

								<form className="settings-form" onSubmit={handleChangePassword}>
									<div className="form-group">
										<label>Mật khẩu hiện tại</label>
										<input
											type="password"
											placeholder="Nhập mật khẩu bạn đang sử dụng..."
											value={currentPassword}
											onChange={(e) => setCurrentPassword(e.target.value)}
											required
										/>
									</div>

									<div className="form-group">
										<label>Mật khẩu mới</label>
										<input
											type="password"
											placeholder="Tối thiểu 8 ký tự..."
											minLength={8}
											maxLength={128}
											value={newPassword}
											onChange={(e) => setNewPassword(e.target.value)}
											required
										/>
									</div>

									<div className="form-group">
										<label>Xác nhận mật khẩu mới</label>
										<input
											type="password"
											placeholder="Nhập lại mật khẩu mới..."
											minLength={8}
											maxLength={128}
											value={confirmPassword}
											onChange={(e) => setConfirmPassword(e.target.value)}
											required
										/>
									</div>

									<div className="form-submit-row">
										<button
											type="submit"
											className="primary-action-btn"
											disabled={passwordBusy || !currentPassword || !newPassword || !confirmPassword}
										>
											{passwordBusy ? "Đang xử lý..." : "Cập nhật mật khẩu mới"}
										</button>
									</div>
								</form>

								<div className="security-notice-box">
									<span className="notice-icon">🛡️</span>
									<div>
										<strong>Mẹo bảo mật:</strong>
										<p>Nên sử dụng mật khẩu có kết hợp chữ hoa, chữ thường, chữ số và không chia sẻ tài khoản cho người khác.</p>
									</div>
								</div>
							</div>
						)}

						{/* Tab 3: Developer API Key */}
						{activeTab === "api" && (
							<div className="settings-card glass-panel">
								<div className="card-heading-group">
									<h3>Developer API Key</h3>
									<p>Sử dụng API Key để tự động hóa thuê SIM và nhận OTP từ phần mềm, tool hoặc bot của bạn.</p>
								</div>

								<div className="api-key-box">
									<label>API Key cá nhân của bạn:</label>
									<div className="api-key-display-row">
										<div className="api-key-input-wrapper">
											<input
												type={showApiKey ? "text" : "password"}
												value={userData?.apiKey || "Chưa tạo API Key"}
												readOnly
												className="api-key-input mono-text"
											/>
											<button
												type="button"
												className="api-eye-toggle"
												onClick={() => setShowApiKey(!showApiKey)}
											>
												{showApiKey ? "Ẩn" : "Hiện"}
											</button>
										</div>
										<button
											type="button"
											className="primary-action-btn copy-api-btn"
											onClick={() => copyText(userData?.apiKey, "apikey", "Đã sao chép API Key!")}
											disabled={!userData?.apiKey}
										>
											{copiedField === "apikey" ? "✓ Đã sao chép" : "📋 Sao chép API Key"}
										</button>
									</div>
								</div>

								<div className="api-actions-row">
									<button
										type="button"
										className="secondary-glass-btn danger-rekey-btn"
										onClick={handleRegenerateApiKey}
										disabled={apiBusy}
									>
										{apiBusy ? "Đang tạo mới..." : "🔄 Tạo lại API Key mới"}
									</button>
									<span className="api-warn-text">
										⚠️ Cẩn thận: Tạo mới sẽ làm vô hiệu hóa key cũ ngay lập tức.
									</span>
								</div>

								<div className="api-docs-snippet">
									<h4>Ví dụ gọi API thuê SIM (cURL):</h4>
									<pre className="code-block mono-text">
{`curl -X POST "https://${typeof window !== 'undefined' ? window.location.host : 'simotp.site'}/api/sim/request" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${userData?.apiKey || 'YOUR_API_KEY'}" \\
  -d '{"service": "otissim_v7", "carrier": "random"}'`}
									</pre>
								</div>
							</div>
						)}

						{/* Tab 4: Preferences */}
						{activeTab === "preferences" && (
							<div className="settings-card glass-panel">
								<div className="card-heading-group">
									<h3>Tùy chọn trải nghiệm web</h3>
									<p>Tùy chỉnh các tính năng hỗ trợ khi thao tác trên trình duyệt.</p>
								</div>

								<div className="preferences-list">
									<div className="preference-item">
										<div className="pref-info">
											<strong>🎨 Chế độ giao diện (Nền Sáng / Tối)</strong>
											<p>Chuyển đổi giữa chế độ Dark Mode huyền bí và Light Mode tươi sáng.</p>
										</div>
										<div className="theme-options-segmented">
											<button
												type="button"
												className={`theme-segment-btn ${theme === "dark" ? "active" : ""}`}
												onClick={() => {
													setTheme("dark");
													setNotice("Đã chuyển sang giao diện Tối (Dark Mode)");
												}}
											>
												<span>🌙 Nền Tối</span>
											</button>
											<button
												type="button"
												className={`theme-segment-btn ${theme === "light" ? "active" : ""}`}
												onClick={() => {
													setTheme("light");
													setNotice("Đã chuyển sang giao diện Sáng (Light Mode)");
												}}
											>
												<span>☀️ Nền Sáng</span>
											</button>
										</div>
									</div>

									<div className="preference-item">
										<div className="pref-info">
											<strong>🔔 Âm thanh thông báo khi nhận mã OTP</strong>
											<p>Phát chuông thông báo ngay khi có mã OTP trả về.</p>
										</div>
										<button
											type="button"
											className={`toggle-switch-btn ${soundNotification ? "active" : ""}`}
											onClick={() => togglePreference("sound")}
										>
											<span className="toggle-slider"></span>
										</button>
									</div>

									<div className="preference-item">
										<div className="pref-info">
											<strong>📋 Tự động sao chép mã OTP khi có mã</strong>
											<p>Tự động lưu mã OTP vào bộ nhớ tạm (Clipboard) để dán nhanh.</p>
										</div>
										<button
											type="button"
											className={`toggle-switch-btn ${autoCopyOtp ? "active" : ""}`}
											onClick={() => togglePreference("autocopy")}
										>
											<span className="toggle-slider"></span>
										</button>
									</div>

									<div className="preference-item">
										<div className="pref-info">
											<strong>🤖 Trợ lý tra cứu Shopee Express (SPX Tracker Bot)</strong>
											<p>Tích hợp sẵn tiện ích Telegram Bot hỗ trợ check tiến trình đơn tự động 24/7.</p>
										</div>
										<a
											href="https://t.me/spx_tracker_lvh205_bot"
											target="_blank"
											rel="noopener noreferrer"
											className="secondary-glass-btn"
										>
											Mở Bot @spx_tracker_lvh205_bot ↗
										</a>
									</div>
								</div>
							</div>
						)}
					</section>
				</div>
			</div>

			{/* Floating Toast Notification */}
			{(notice || error) && (
				<div className={`toast-message-floating ${error ? "error-mode" : "success-mode"}`} role="status">
					<span className="toast-icon">{error ? "⚠️" : "✓"}</span>
					<span className="toast-text">{error || notice}</span>
					<button
						type="button"
						className="toast-close-btn"
						onClick={() => { setError(""); setNotice(""); }}
						aria-label="Đóng"
					>
						×
					</button>
				</div>
			)}

			<Footer />
			<TelegramBotWidget />
		</main>
	);
}
