"use client";

import { useEffect, useState } from "react";

const SUPPORT_MESSAGES = [
	{
		badge: "💬 HỖ TRỢ TRỰC TUYẾN",
		text: "Chat hỗ trợ Telegram @Vuha_cute_dapxe_trenpho",
		highlight: "🟢 Online 24/7",
	},
	{
		badge: "⚡ HỖ TRỢ THUÊ SIM & NẠP TIỀN",
		text: "Giải đáp thắc mắc và hỗ trợ số dư tức thì",
		highlight: "🚀 Phản hồi nhanh",
	},
	{
		badge: "🛡️ TƯ VẤN KỸ THUẬT",
		text: "Hỗ trợ tích hợp API Developer và đối soát",
		highlight: "24/7",
	},
];

export default function TelegramBotWidget() {
	const [activeMsgIndex, setActiveMsgIndex] = useState(0);
	const [isOpen, setIsOpen] = useState(false);
	const [dismissed, setDismissed] = useState(false);

	const supportUsername = "Vuha_cute_dapxe_trenpho";
	const supportUrl = `https://t.me/${supportUsername}`;

	// Auto rotate speech bubble messages every 3.5 seconds
	useEffect(() => {
		const interval = setInterval(() => {
			setActiveMsgIndex((prev) => (prev + 1) % SUPPORT_MESSAGES.length);
		}, 3500);
		return () => clearInterval(interval);
	}, []);

	const currentMsg = SUPPORT_MESSAGES[activeMsgIndex];

	return (
		<div className="tele-floating-widget-wrapper">
			{/* Speech bubble with auto transitions */}
			{!isOpen && !dismissed && (
				<div
					className="tele-speech-bubble"
					onClick={() => setIsOpen(true)}
					title="Bấm để mở khung hỗ trợ Telegram"
				>
					<button
						type="button"
						className="tele-bubble-close-btn"
						onClick={(e) => {
							e.stopPropagation();
							setDismissed(true);
						}}
						aria-label="Đóng bong bóng hỗ trợ"
						title="Đóng thông báo"
					>
						✕
					</button>
					<div className="tele-bubble-content keyframe-fade-in" key={activeMsgIndex}>
						<div className="tele-bubble-header">
							<span className="tele-bubble-badge">{currentMsg.badge}</span>
							<span className="tele-bubble-tag">{currentMsg.highlight}</span>
						</div>
						<p className="tele-bubble-text">{currentMsg.text}</p>
					</div>
					<div className="tele-bubble-arrow"></div>
				</div>
			)}

			{/* Floating Telegram Action Button */}
			<button
				type="button"
				className={`tele-floating-btn ${isOpen ? "active" : ""}`}
				onClick={() => setIsOpen(!isOpen)}
				aria-label="Hỗ trợ Telegram trực tuyến"
				title="Chat hỗ trợ Telegram @Vuha_cute_dapxe_trenpho"
			>
				<div className="tele-btn-glow"></div>
				<div className="tele-btn-pulse-ring"></div>
				<div className="tele-icon-box">
					{/* Genuine Telegram Paper Plane SVG */}
					<svg
						className="tele-svg-icon"
						viewBox="0 0 24 24"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							d="M21.6 3.6a1.2 1.2 0 0 0-1.25-.26L2.8 10.38a1.2 1.2 0 0 0 .08 2.25l4.87 1.83 1.9 5.86a1.2 1.2 0 0 0 2.07.38l2.92-3.15 4.9 3.65a1.2 1.2 0 0 0 1.9-.76l3-15.5a1.2 1.2 0 0 0-.94-1.34z"
							fill="currentColor"
						/>
					</svg>
				</div>
				<span className="tele-online-dot"></span>
			</button>

			{/* Expandable Quick Support Popup Card */}
			{isOpen && (
				<div className="tele-popup-card glass-panel" role="dialog">
					<div className="tele-popup-header">
						<div className="tele-header-info">
							<div className="tele-avatar">
								<svg viewBox="0 0 24 24" fill="none" className="tele-avatar-icon">
									<path
										d="M21.6 3.6a1.2 1.2 0 0 0-1.25-.26L2.8 10.38a1.2 1.2 0 0 0 .08 2.25l4.87 1.83 1.9 5.86a1.2 1.2 0 0 0 2.07.38l2.92-3.15 4.9 3.65a1.2 1.2 0 0 0 1.9-.76l3-15.5a1.2 1.2 0 0 0-.94-1.34z"
										fill="currentColor"
									/>
								</svg>
								<span className="live-status-dot"></span>
							</div>
							<div>
								<div className="tele-title-row">
									<h4>Hỗ trợ SIM OTP</h4>
									<span className="tele-verified-badge">✓ Support</span>
								</div>
								<a
									href={supportUrl}
									target="_blank"
									rel="noopener noreferrer"
									className="tele-username-link"
								>
									@{supportUsername}
								</a>
							</div>
						</div>
						<button
							type="button"
							className="tele-close-btn"
							onClick={() => setIsOpen(false)}
							aria-label="Đóng"
						>
							✕
						</button>
					</div>

					<div className="tele-popup-body">
						<div className="tele-intro-box">
							<span className="tele-intro-icon">💬</span>
							<p>
								Hỗ trợ trực tiếp 24/7 về <strong>thuê SIM OTP</strong>, xử lý nạp tiền và tích hợp API.
							</p>
						</div>

						{/* Quick Action Button */}
						<div className="tele-quick-actions">
							<a
								href={supportUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="tele-primary-action-btn"
							>
								<span>💬 Chat ngay @{supportUsername}</span>
								<span className="action-arrow">↗</span>
							</a>
						</div>

						<div className="tele-features-mini-list">
							<div className="feature-item">
								<span className="item-dot"></span>
								<span>Hỗ trợ xử lý sự cố nạp tiền & số dư tức thì</span>
							</div>
							<div className="feature-item">
								<span className="item-dot"></span>
								<span>Hướng dẫn thuê SIM và nhận mã OTP</span>
							</div>
							<div className="feature-item">
								<span className="item-dot"></span>
								<span>Tư vấn kỹ thuật và tài liệu tích hợp API</span>
							</div>
						</div>
					</div>

					<div className="tele-popup-footer">
						<span>Hỗ trợ viên trực tuyến 24/7 qua Telegram</span>
					</div>
				</div>
			)}
		</div>
	);
}
