"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function BottomNav() {
	const pathname = usePathname();

	return (
		<nav className="mobile-bottom-nav">
			<Link
				href="/dashboard"
				className={`mobile-nav-item ${pathname === "/dashboard" ? "active" : ""}`}
			>
				<span className="nav-icon">🏠</span>
				<span className="nav-label">Trang chủ</span>
			</Link>
			<Link
				href="/dashboard/shopee"
				className={`mobile-nav-item ${pathname === "/dashboard/shopee" ? "active" : ""}`}
			>
				<span className="nav-icon">⚡</span>
				<span className="nav-label">Shopee</span>
			</Link>
			<Link
				href="/dashboard/tiktok"
				className={`mobile-nav-item ${pathname === "/dashboard/tiktok" ? "active" : ""}`}
			>
				<span className="nav-icon">🎵</span>
				<span className="nav-label">TikTok</span>
			</Link>
			<Link
				href="/history"
				className={`mobile-nav-item ${pathname === "/history" ? "active" : ""}`}
			>
				<span className="nav-icon">⏱</span>
				<span className="nav-label">Lịch sử</span>
			</Link>
			<Link
				href="/deposit"
				className={`mobile-nav-item ${pathname === "/deposit" ? "active" : ""}`}
			>
				<span className="nav-icon">💳</span>
				<span className="nav-label">Nạp tiền</span>
			</Link>
		</nav>
	);
}
