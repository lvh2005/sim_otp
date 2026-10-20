"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import ThemeToggle from "./ThemeToggle";

const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });

export default function Header({ user, onSignOut }) {
	const pathname = usePathname();
	const [showUserMenu, setShowUserMenu] = useState(false);

	const handleSignOut = async () => {
		if (onSignOut) {
			await onSignOut();
		} else {
			await fetch("/api/auth", { method: "DELETE" });
			window.location.href = "/login";
		}
	};

	return (
		<header className="site-topbar glass-topbar">
			<div className="topbar-left">
				<Link className="brand-mark" href="/dashboard">
					<img src="/logo.png" alt="SIM OTP" className="brand-logo-img" />
					<span className="brand-text">SIM<span className="brand-accent">OTP</span></span>
					<span className="brand-badge">PRO</span>
				</Link>

				<nav className="site-nav-pill" aria-label="Điều hướng chính">
					<Link
						className={`nav-item ${pathname === "/dashboard" ? "active" : ""}`}
						href="/dashboard"
					>
						<span>Trang chủ</span>
					</Link>
					<Link
						className={`nav-item ${pathname === "/dashboard/shopee" ? "active" : ""}`}
						href="/dashboard/shopee"
					>
						<span>⚡ Shopee</span>
					</Link>
					<Link
						className={`nav-item ${pathname === "/dashboard/tiktok" ? "active" : ""}`}
						href="/dashboard/tiktok"
					>
						<span>🎵 TikTok</span>
					</Link>
					<Link
						className={`nav-item ${pathname === "/dashboard/other" ? "active" : ""}`}
						href="/dashboard/other"
					>
						<span>✨ Dịch vụ khác</span>
					</Link>
					<Link
						className={`nav-item ${pathname === "/history" ? "active" : ""}`}
						href="/history"
					>
						<span>⏱ Lịch sử</span>
					</Link>
					<Link
						className={`nav-item ${pathname === "/deposit" ? "active" : ""}`}
						href="/deposit"
					>
						<span>💳 Nạp tiền</span>
					</Link>
					<a
						className="nav-item nav-tele-link"
						href="https://t.me/spx_tracker_lvh205_bot"
						target="_blank"
						rel="noopener noreferrer"
						title="Bot Telegram check đơn @spx_tracker_lvh205_bot"
					>
						<span className="tele-nav-dot"></span>
						<span>🤖 Bot SPX</span>
					</a>
				</nav>
			</div>

			<div className="account-tools">
				<ThemeToggle />

				{user && (
					<Link
						href="/deposit"
						className="wallet-balance-card"
						title="Bấm để đến trang Nạp tiền VietQR"
					>
						<span className="wallet-icon">₫</span>
						<div className="wallet-info">
							<small>SỐ DƯ</small>
							<strong>{money.format(user.balance || 0)}</strong>
						</div>
						<span className="wallet-plus-btn">+</span>
					</Link>
				)}

				{user && (
					<div className="user-dropdown-container">
						<button
							type="button"
							className="user-profile-trigger-btn"
							onClick={() => setShowUserMenu(!showUserMenu)}
							aria-expanded={showUserMenu}
						>
							<span className="avatar-letter">{user.username.charAt(0).toUpperCase()}</span>
							<span className="username-display">{user.username}</span>
							<span className="dropdown-caret">▾</span>
						</button>

						{showUserMenu && (
							<>
								<div className="user-dropdown-backdrop" onClick={() => setShowUserMenu(false)}></div>
								<div className="user-dropdown-card">
									<div className="user-card-header">
										<div className="user-card-names">
											<strong className="user-card-fullname">{user.fullName || user.username}</strong>
											<span className="user-card-username">@{user.username}</span>
										</div>
										<span className="user-card-badge">Tài khoản</span>
									</div>
									<div className="user-card-divider"></div>
									<div className="user-card-menu">
										<Link
											href="/deposit"
											className="user-card-item"
											onClick={() => setShowUserMenu(false)}
										>
											<span className="item-icon">💳</span>
											<span className="item-label">Nạp tiền VietQR</span>
										</Link>
										<Link
											href="/history"
											className="user-card-item"
											onClick={() => setShowUserMenu(false)}
										>
											<span className="item-icon">⏱</span>
											<span className="item-label">Lịch sử thuê số</span>
										</Link>
										<Link
											href="/settings"
											className="user-card-item"
											onClick={() => setShowUserMenu(false)}
										>
											<span className="item-icon">⚙️</span>
											<span className="item-label">Cài đặt tài khoản</span>
										</Link>
										<a
											href="https://t.me/spx_tracker_lvh205_bot"
											target="_blank"
											rel="noopener noreferrer"
											className="user-card-item tele-card-item"
											onClick={() => setShowUserMenu(false)}
										>
											<span className="item-icon">🤖</span>
											<span className="item-label">Bot @spx_tracker_lvh205_bot</span>
										</a>
										<div className="user-card-divider"></div>
										<button
											type="button"
											className="user-card-item logout-action"
											onClick={handleSignOut}
										>
											<span className="item-icon">🚪</span>
											<span className="item-label">Đăng xuất</span>
										</button>
									</div>
								</div>
							</>
						)}
					</div>
				)}
			</div>
		</header>
	);
}
