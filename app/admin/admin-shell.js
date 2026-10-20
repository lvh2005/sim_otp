"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/app/components/ThemeToggle";

const AdminContext = createContext(null);

const navigation = [
	["/admin", "Tổng quan"],
	["/admin/api", "Cấu hình API"],
	["/admin/users", "Người dùng"],
	["/admin/orders", "Đơn thuê"],
	["/admin/transactions", "Giao dịch"],
	["/admin/services", "Bảng giá"],
	["/admin/announcement", "Thông báo"],
];

export function useAdmin() {
	const context = useContext(AdminContext);
	if (!context) throw new Error("useAdmin must be used inside AdminProvider");
	return context;
}

export function AdminProvider({ children }) {
	const [token, setToken] = useState("");
	const [authorized, setAuthorized] = useState(false);
	const [ready, setReady] = useState(false);

	useEffect(() => {
		let active = true;
		const savedToken = sessionStorage.getItem("sim-admin-token");
		if (!savedToken) {
			setReady(true);
			return () => { active = false; };
		}
		fetch("/api/admin?view=health", { headers: { "X-Admin-Token": savedToken }, cache: "no-store" })
			.then((response) => {
				if (!active) return;
				if (response.ok) {
					setToken(savedToken);
					setAuthorized(true);
				} else {
					sessionStorage.removeItem("sim-admin-token");
				}
			})
			.catch(() => sessionStorage.removeItem("sim-admin-token"))
			.finally(() => { if (active) setReady(true); });
		return () => { active = false; };
	}, []);

	const login = useCallback(async (candidate) => {
		const response = await fetch("/api/admin?view=health", {
			headers: { "X-Admin-Token": candidate },
			cache: "no-store",
		});
		const result = await response.json();
		if (!response.ok) throw new Error(result.error || "Token quản trị không hợp lệ");
		sessionStorage.setItem("sim-admin-token", candidate);
		setToken(candidate);
		setAuthorized(true);
	}, []);

	const logout = useCallback(() => {
		sessionStorage.removeItem("sim-admin-token");
		setToken("");
		setAuthorized(false);
	}, []);

	const request = useCallback(async (path, options = {}) => {
		const response = await fetch(`/api/admin${path}`, {
			...options,
			headers: { "X-Admin-Token": token, ...options.headers },
			cache: "no-store",
		});
		const result = await response.json();
		if (!response.ok) throw new Error(result.error || "Không thể tải dữ liệu quản trị");
		return result;
	}, [token]);
	const value = useMemo(() => ({ token, authorized, ready, login, logout, request }), [token, authorized, ready, login, logout, request]);

	return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function AdminShell({ children }) {
	const pathname = usePathname();
	const { ready, authorized, login, logout } = useAdmin();
	const [candidate, setCandidate] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

	// Close mobile menu on navigation
	useEffect(() => {
		setMobileMenuOpen(false);
	}, [pathname]);

	async function submit(event) {
		event.preventDefault();
		setBusy(true);
		setError("");
		try {
			await login(candidate);
			setCandidate("");
		} catch (loginError) {
			setError(loginError.message);
		} finally {
			setBusy(false);
		}
	}

	if (!ready) {
		return (
			<main className="admin-loading-screen">
				<div className="app-loader-spinner" />
				<p>Đang kiểm tra quyền quản trị...</p>
			</main>
		);
	}

	if (!authorized) {
		return (
			<main className="admin-login-shell">
				<div className="admin-login-backdrop" />
				<form className="admin-login-panel glass-panel" onSubmit={submit}>
					<div className="admin-login-header">
						<Link className="brand-mark" href="/dashboard">
							<div className="brand-logo-icon">⚡</div>
							<span className="brand-text">SIM<span className="brand-accent">OTP</span></span>
							<span className="brand-badge admin-badge">ADMIN</span>
						</Link>
						<p className="eyebrow" style={{ marginTop: 12 }}>BẢO MẬT HỆ THỐNG</p>
						<h1>Đăng nhập Quản trị</h1>
						<p className="muted">Nhập mã bí mật <code>ADMIN_API_TOKEN</code> để truy cập bảng điều khiển vận hành.</p>
					</div>

					<div className="admin-login-body">
						<label className="input-group-label">
							<span>Admin Token bí mật</span>
							<input
								type="password"
								autoComplete="current-password"
								placeholder="••••••••••••••••"
								value={candidate}
								onChange={(event) => setCandidate(event.target.value)}
								required
								className="admin-input-field mono-text"
							/>
						</label>

						{error && (
							<div className="admin-inline-error" role="alert">
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
								<span>{error}</span>
							</div>
						)}

						<button className="primary-button admin-login-btn" disabled={busy}>
							{busy ? (
								<>
									<span className="mini-spinner" />
									Đang xác thực...
								</>
							) : (
								<>
									<span>Mở Bảng Điều Khiển</span>
									<span>→</span>
								</>
							)}
						</button>

						<div className="admin-login-footer-links">
							<Link href="/dashboard" className="admin-back-link">
								← Trở về Cửa hàng
							</Link>
						</div>
					</div>
				</form>
			</main>
		);
	}

	const currentPageName = navigation.find(([href]) => href === pathname)?.[1] || "Quản trị";

	return (
		<div className="admin-console">
			{/* Desktop Sidebar */}
			<aside className="admin-sidebar hide-on-tablet-mobile">
				<div className="admin-sidebar-header">
					<Link className="brand-mark" href="/admin">
						<div className="brand-logo-icon">⚡</div>
						<span className="brand-text">SIM<span className="brand-accent">OTP</span></span>
						<span className="brand-badge admin-badge">ADMIN</span>
					</Link>
				</div>

				<div className="admin-sidebar-nav-wrap">
					<p className="admin-sidebar-label">VẬN HÀNH HỆ THỐNG</p>
					<nav className="admin-nav" aria-label="Điều hướng quản trị">
						{navigation.map(([href, label]) => {
							const isActive = pathname === href;
							return (
								<Link
									className={`admin-nav-link ${isActive ? "active" : ""}`}
									href={href}
									key={href}
								>
									<span className="nav-link-dot" />
									<span className="nav-link-title">{label}</span>
								</Link>
							);
						})}
					</nav>
				</div>

				<div className="admin-sidebar-footer">
					<div className="admin-system-indicator">
						<span className="admin-online-dot"></span>
						<span className="admin-security-text">Quản trị bảo mật (SSL)</span>
					</div>
					<div className="admin-sidebar-actions">
						<Link href="/dashboard" className="quiet-button sidebar-store-btn">
							Cửa hàng
						</Link>
						<button className="quiet-button sidebar-logout-btn" onClick={logout} title="Đăng xuất">
							Khóa
						</button>
					</div>
					<div style={{ marginTop: 8 }}>
						<ThemeToggle className="admin-sidebar-theme-toggle" />
					</div>
				</div>
			</aside>

			{/* Mobile Sliding Drawer & Backdrop */}
			{mobileMenuOpen && (
				<div className="admin-mobile-backdrop show-on-tablet-mobile" onClick={() => setMobileMenuOpen(false)}>
					<div className="admin-mobile-drawer glass-panel" onClick={(e) => e.stopPropagation()}>
						<div className="admin-mobile-drawer-header">
							<Link className="brand-mark" href="/admin" onClick={() => setMobileMenuOpen(false)}>
								<div className="brand-logo-icon mini">⚡</div>
								<span className="brand-text">SIM<span className="brand-accent">OTP</span></span>
								<span className="brand-badge admin-badge">ADMIN</span>
							</Link>
							<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
								<ThemeToggle className="admin-theme-toggle-btn" />
								<button className="admin-drawer-close-btn" onClick={() => setMobileMenuOpen(false)} aria-label="Đóng menu">
									✕
								</button>
							</div>
						</div>

						<nav className="admin-mobile-drawer-nav">
							<p className="admin-sidebar-label">DANH MỤC QUẢN TRỊ</p>
							{navigation.map(([href, label]) => {
								const isActive = pathname === href;
								return (
									<Link
										className={`admin-mobile-drawer-link ${isActive ? "active" : ""}`}
										href={href}
										key={href}
										onClick={() => setMobileMenuOpen(false)}
									>
										<span>{label}</span>
										{isActive && <span className="active-tag">Đang mở</span>}
									</Link>
								);
							})}
						</nav>

						<div className="admin-mobile-drawer-footer">
							<Link href="/dashboard" className="primary-button store-btn-mobile" onClick={() => setMobileMenuOpen(false)}>
								<span>Về giao diện Cửa hàng</span>
							</Link>
							<button className="quiet-button logout-btn-mobile" onClick={logout}>
								Khóa phiên quản trị
							</button>
						</div>
					</div>
				</div>
			)}

			<div className="admin-main">
				{/* Modern Sticky Admin Topbar */}
				<header className="admin-topbar">
					<div className="admin-topbar-left">
						<button
							className="admin-menu-toggle-btn show-on-tablet-mobile"
							onClick={() => setMobileMenuOpen(true)}
							aria-label="Mở menu quản trị"
						>
							<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
								<line x1="3" y1="6" x2="21" y2="6"/>
								<line x1="3" y1="12" x2="21" y2="12"/>
								<line x1="3" y1="18" x2="21" y2="18"/>
							</svg>
						</button>

						<div className="admin-topbar-title-box">
							<span className="admin-topbar-kicker">SIM OTP / ADMIN</span>
							<strong className="admin-topbar-current-page">{currentPageName}</strong>
						</div>
					</div>

					<div className="admin-topbar-actions">
						<ThemeToggle className="admin-theme-toggle-btn" />
						<Link href="/dashboard" className="admin-store-link">
							<span className="hide-on-mobile">Mở cửa hàng</span>
							<span className="show-on-mobile">Shop ↗</span>
						</Link>
						<button className="quiet-button admin-logout-btn" onClick={logout} title="Khóa phiên làm việc">
							<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
								<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
								<polyline points="16 17 21 12 16 7"/>
								<line x1="21" y1="12" x2="9" y2="12"/>
							</svg>
							<span className="hide-on-mobile">Khóa phiên</span>
						</button>
					</div>
				</header>

				{/* Mobile Horizontal Quick Navigation Bar (Horizontal Scrollable Tabs) */}
				<div className="admin-mobile-tabbar show-on-tablet-mobile">
					<div className="admin-tabbar-scroll">
						{navigation.map(([href, label]) => {
							const isActive = pathname === href;
							return (
								<Link
									key={href}
									href={href}
									className={`admin-mobile-tab-item ${isActive ? "active" : ""}`}
								>
									{label}
								</Link>
							);
						})}
					</div>
				</div>

				<main className="admin-content">{children}</main>
			</div>
		</div>
	);
}
