"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ThemeToggle from "@/app/components/ThemeToggle";
import { removeVietnameseAccents, normalizeVietnameseName, isValidVietnameseName } from "@/lib/vietnamese-name";

export default function LoginPage() {
	const router = useRouter();
	const [authMode, setAuthMode] = useState("login");
	const [username, setUsername] = useState("");
	const [fullName, setFullName] = useState("");
	const [password, setPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [checking, setChecking] = useState(true);

	// Check if already logged in
	useEffect(() => {
		let active = true;
		fetch("/api/auth", { cache: "no-store" })
			.then((res) => (res.ok ? res.json() : null))
			.then((data) => {
				if (active && data?.user) {
					router.replace("/dashboard");
				}
			})
			.catch(() => {})
			.finally(() => {
				if (active) setChecking(false);
			});

		return () => {
			active = false;
		};
	}, [router]);

	async function handleSubmit(event) {
		event.preventDefault();
		setBusy(true);
		setError("");

		if (authMode === "register") {
			const normalizedName = normalizeVietnameseName(fullName);
			if (!isValidVietnameseName(normalizedName)) {
				setError("Vui lòng nhập họ và tên thật tiếng Việt không dấu (tối thiểu 2 từ, VD: LE VU HA).");
				setBusy(false);
				return;
			}
		}

		try {
			const res = await fetch("/api/auth", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action: authMode,
					username: username.trim(),
					password,
					fullName: fullName.trim(),
				}),
			});

			const result = await res.json();
			if (!res.ok) {
				throw new Error(result.error || "Không thể thực hiện yêu cầu.");
			}

			// Login success, redirect to dashboard
			router.push("/dashboard");
		} catch (err) {
			setError(err.message || "Đã xảy ra lỗi, vui lòng thử lại.");
		} finally {
			setBusy(false);
		}
	}

	if (checking) {
		return (
			<main className="page-shell modern-dark-shell">
				<div className="loading-state-wrapper">
					<div className="app-loader-spinner"></div>
					<p>Đang kiểm tra phiên đăng nhập...</p>
				</div>
			</main>
		);
	}

	return (
		<main className="page-shell modern-dark-shell auth-standalone-page">
			{/* Top Navbar */}
			<header className="site-topbar glass-topbar auth-header">
				<div className="topbar-left">
					<Link className="brand-mark" href="/login">
						<img src="/logo.png" alt="SIM OTP" className="brand-logo-img" />
						<span className="brand-text">SIM<span className="brand-accent">OTP</span></span>
						<span className="brand-badge">PRO</span>
					</Link>
				</div>

				<div className="account-tools">
					<ThemeToggle />
					<a
						className="nav-item nav-tele-link hide-on-mobile"
						href="https://t.me/spx_tracker_lvh205_bot"
						target="_blank"
						rel="noopener noreferrer"
						title="Bot Telegram SPX"
					>
						<span className="tele-nav-dot"></span>
						<span>🤖 Bot SPX</span>
					</a>
				</div>
			</header>

			{/* Main Auth Container */}
			<div className="auth-layout-container">
				{/* Left Hero Column */}
				<div className="auth-left-hero">
					<div className="auth-pill-badge">
						<span className="live-dot-pulse"></span>
						<span>NỀN TẢNG THUÊ SIM OTP 24/7</span>
					</div>

					<h1 className="auth-hero-title">
						Nhận mã OTP tức thì.<br />
						<span className="text-gradient">Tự động & Bảo mật 100%.</span>
					</h1>

					<p className="auth-hero-desc">
						Hệ thống phân phối số điện thoại nhận mã xác thực đa nền tảng (Shopee, TikTok, Telegram, Zalo, Momo...). Hoàn tiền tự động 100% nếu không có mã OTP.
					</p>

					{/* 3 Core Value Cards */}
					<div className="auth-value-props-grid">
						<div className="value-prop-card glass-panel">
							<div className="value-prop-icon">⚡</div>
							<div className="value-prop-text">
								<strong>Tốc độ tức thì</strong>
								<p>Nhận mã SMS chỉ sau 3–10 giây</p>
							</div>
						</div>

						<div className="value-prop-card glass-panel">
							<div className="value-prop-icon">🛡️</div>
							<div className="value-prop-text">
								<strong>Bảo vệ số dư 100%</strong>
								<p>Tự động hoàn tiền về ví nếu hết hạn</p>
							</div>
						</div>

						<div className="value-prop-card glass-panel">
							<div className="value-prop-icon">💳</div>
							<div className="value-prop-text">
								<strong>Auto VietQR 24/7</strong>
								<p>Quét mã QR cộng tiền tự động 30s</p>
							</div>
						</div>
					</div>
				</div>

				{/* Right Auth Form Card */}
				<div className="auth-right-form-wrapper">
					<div className="auth-card-main glass-panel">
						{/* Mode Switch Tabs */}
						<div className="auth-tab-header">
							<button
								type="button"
								className={`auth-tab-btn ${authMode === "login" ? "active" : ""}`}
								onClick={() => {
									setAuthMode("login");
									setError("");
								}}
							>
								<span>Đăng nhập</span>
							</button>
							<button
								type="button"
								className={`auth-tab-btn ${authMode === "register" ? "active" : ""}`}
								onClick={() => {
									setAuthMode("register");
									setError("");
								}}
							>
								<span>Đăng ký mới</span>
							</button>
						</div>

						<div className="auth-card-body">
							<div className="auth-form-intro">
								<h2>{authMode === "login" ? "Chào mừng trở lại!" : "Tạo tài khoản mới"}</h2>
								<p>
									{authMode === "login"
										? "Nhập thông tin tài khoản để truy cập bàn thuê số SIM."
										: "Đăng ký nhanh chỉ với tên đăng nhập và mật khẩu."}
								</p>
							</div>

							<form className="auth-form" onSubmit={handleSubmit}>
								<div className="form-group-field">
									<label htmlFor="auth-username">
										<span>Tên đăng nhập</span>
										<span className="field-hint">(3–24 ký tự)</span>
									</label>
									<div className="input-with-icon-wrap">
										<span className="field-prefix-icon">👤</span>
										<input
											id="auth-username"
											type="text"
											placeholder="Nhập username..."
											autoComplete="username"
											minLength={3}
											maxLength={24}
											value={username}
											onChange={(e) => setUsername(e.target.value)}
											required
											className="auth-text-input"
										/>
									</div>
								</div>

								{authMode === "register" && (
									<div className="form-group-field">
										<label htmlFor="auth-fullname">
											<span>Họ và tên thật (không dấu)</span>
											<span className="field-hint">(Viết hoa, VD: LE VU HA)</span>
										</label>
										<div className="input-with-icon-wrap">
											<span className="field-prefix-icon">🪪</span>
											<input
												id="auth-fullname"
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
												required={authMode === "register"}
												className="auth-text-input uppercase-input"
												maxLength={50}
											/>
										</div>
										{fullName.trim().length >= 3 && (
											<div className="auth-memo-preview" style={{ marginTop: 6, fontSize: 13, color: "#94a3b8" }}>
												<span>💬 Cú pháp nạp tiền VietQR: </span>
												<strong style={{ color: "#10b981" }}>{fullName.trim()} chuyen tien</strong>
											</div>
										)}
									</div>
								)}

								<div className="form-group-field">
									<label htmlFor="auth-password">
										<span>Mật khẩu</span>
										<span className="field-hint">(tối thiểu 8 ký tự)</span>
									</label>
									<div className="input-with-icon-wrap">
										<span className="field-prefix-icon">🔒</span>
										<input
											id="auth-password"
											type={showPassword ? "text" : "password"}
											placeholder="Nhập mật khẩu..."
											autoComplete={authMode === "login" ? "current-password" : "new-password"}
											minLength={8}
											maxLength={128}
											value={password}
											onChange={(e) => setPassword(e.target.value)}
											required
											className="auth-text-input"
										/>
										<button
											type="button"
											className="password-toggle-eye"
											onClick={() => setShowPassword(!showPassword)}
											tabIndex={-1}
											aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
										>
											{showPassword ? "👁️" : "🙈"}
										</button>
									</div>
								</div>

								{error && (
									<div className="auth-error-banner" role="alert">
										<span className="error-icon">⚠️</span>
										<span className="error-text">{error}</span>
									</div>
								)}

								<button
									type="submit"
									className="primary-button auth-submit-btn"
									disabled={busy}
								>
									{busy ? (
										<>
											<span className="mini-spinner"></span>
											<span>{authMode === "login" ? "Đang đăng nhập..." : "Đang tạo tài khoản..."}</span>
										</>
									) : (
										<>
											<span>{authMode === "login" ? "Đăng nhập ngay" : "Tạo tài khoản & Bắt đầu"}</span>
											<span className="btn-arrow">→</span>
										</>
									)}
								</button>
							</form>

							<div className="auth-card-footer-info">
								<div className="footer-feature-item">
									<span className="check-icon">✓</span>
									<span>Tài khoản mới kích hoạt ngay</span>
								</div>
								<div className="footer-feature-item">
									<span className="check-icon">✓</span>
									<span>Bảo mật 100% không lộ thông tin</span>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Standalone Auth Footer */}
			<footer className="auth-standalone-footer">
				<p>© {new Date().getFullYear()} SIM OTP Service. Nền tảng phân phối số nhận OTP bảo mật và tự động.</p>
			</footer>
		</main>
	);
}
