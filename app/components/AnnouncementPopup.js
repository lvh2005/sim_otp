"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function AnnouncementPopup() {
	const pathname = usePathname();
	const router = useRouter();
	const [announcement, setAnnouncement] = useState(null);
	const [visible, setVisible] = useState(false);
	const [closing, setClosing] = useState(false);

	useEffect(() => {
		// Don't auto-pop in admin panel or login/register pages
		if (pathname?.startsWith("/admin") || pathname?.startsWith("/login") || pathname?.startsWith("/register")) {
			return;
		}

		let mounted = true;

		async function checkAnnouncement() {
			try {
				// Only show popup if user is logged in
				const authRes = await fetch("/api/auth", { cache: "no-store" });
				if (!authRes.ok) return;
				const authData = await authRes.json();
				if (!mounted || !authData?.user?.id) return;

				const res = await fetch("/api/announcement", { cache: "no-store" });
				if (!res.ok) return;
				const data = await res.json();
				if (!mounted) return;

				if (!data || !data.enabled) return;

				const now = Date.now();
				const isSessionDismissed = sessionStorage.getItem("sim_announcement_session_dismissed") === "true";
				const storedDismissedUntil = Number(localStorage.getItem("sim_announcement_dismissed_until") || 0);
				const storedUpdatedAt = Number(localStorage.getItem("sim_announcement_updated_at") || 0);
				const serverUpdatedAt = Number(data.updatedAt || 0);

				// If admin modified the announcement after dismissal was recorded, show the fresh update!
				const isFreshUpdate = serverUpdatedAt > storedUpdatedAt && storedUpdatedAt > 0;

				if (!isFreshUpdate) {
					// Don't show if user closed it in this session or snoozed it for X hours
					if (isSessionDismissed || storedDismissedUntil > now) {
						return;
					}
				}

				setAnnouncement(data);
				// Slight delay for smooth entrance animation after page load
				const timer = setTimeout(() => {
					if (mounted) setVisible(true);
				}, 400);

				return () => clearTimeout(timer);
			} catch {
				// Silently fail if network error
			}
		}

		checkAnnouncement();

		return () => {
			mounted = false;
		};
	}, [pathname]);

	function handleClose(e) {
		if (e) e.stopPropagation();
		try {
			sessionStorage.setItem("sim_announcement_session_dismissed", "true");
			if (announcement?.updatedAt) {
				localStorage.setItem("sim_announcement_updated_at", String(announcement.updatedAt));
			}
		} catch {}
		setClosing(true);
		setTimeout(() => {
			setVisible(false);
			setClosing(false);
		}, 250);
	}

	function handleSnooze(e) {
		if (e) e.stopPropagation();
		if (!announcement) return;
		const hours = announcement.hideDurationHours || 2;
		const until = Date.now() + hours * 3600 * 1000;
		try {
			localStorage.setItem("sim_announcement_dismissed_until", String(until));
			localStorage.setItem("sim_announcement_updated_at", String(announcement.updatedAt || Date.now()));
			sessionStorage.setItem("sim_announcement_session_dismissed", "true");
		} catch {}
		handleClose();
	}

	function handleActionClick(e) {
		if (e) e.stopPropagation();
		if (!announcement?.actionUrl) return;
		const url = announcement.actionUrl.trim();
		handleClose();
		if (url.startsWith("http://") || url.startsWith("https://")) {
			window.open(url, "_blank", "noopener,noreferrer");
		} else {
			router.push(url);
		}
	}

	// Keyboard ESC listener
	useEffect(() => {
		if (!visible) return;
		function onKeyDown(e) {
			if (e.key === "Escape") handleClose();
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [visible]);

	if (!visible || !announcement) return null;

	return (
		<div
			className={`announcement-modal-backdrop ${closing ? "backdrop-closing" : ""}`}
			onClick={handleClose}
			role="presentation"
		>
			<div
				className={`announcement-modal-card ${closing ? "card-closing" : ""}`}
				onClick={(e) => e.stopPropagation()}
				role="dialog"
				aria-modal="true"
				aria-labelledby="announcement-modal-title"
			>
				{/* Modal Top Header */}
				<div className="announcement-header">
					<div className="announcement-icon-wrap" aria-hidden="true">
						<svg
							width="24"
							height="24"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2.2"
							strokeLinecap="round"
							strokeLinejoin="round"
							className="announcement-bell-svg"
						>
							<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
							<path d="M13.73 21a2 2 0 0 1-3.46 0" />
						</svg>
					</div>

					<div className="announcement-title-box">
						<span className="announcement-eyebrow">
							{announcement.tag || "THÔNG BÁO HỆ THỐNG"}
						</span>
						<h2 id="announcement-modal-title" className="announcement-main-title">
							{announcement.title || "Thông báo hệ thống"}
						</h2>
					</div>

					<button
						type="button"
						className="announcement-close-btn"
						onClick={handleClose}
						aria-label="Đóng thông báo"
					>
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
							<line x1="18" y1="6" x2="6" y2="18" />
							<line x1="6" y1="6" x2="18" y2="18" />
						</svg>
					</button>
				</div>

				{/* Modal Body Content */}
				<div className="announcement-body">
					<FormattedContent text={announcement.content} />
				</div>

				{/* Modal Footer Controls */}
				<div className="announcement-footer">
					{announcement.actionText && announcement.actionUrl && (
						<button
							type="button"
							className="announcement-btn-action"
							onClick={handleActionClick}
						>
							{announcement.actionText}
						</button>
					)}
					<button
						type="button"
						className="announcement-btn-snooze"
						onClick={handleSnooze}
					>
						Tắt trong {announcement.hideDurationHours || 2}h
					</button>
					<button
						type="button"
						className="announcement-btn-close"
						onClick={handleClose}
					>
						Đóng thông báo
					</button>
				</div>
			</div>
		</div>
	);
}

function FormattedContent({ text }) {
	if (!text) return null;

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
