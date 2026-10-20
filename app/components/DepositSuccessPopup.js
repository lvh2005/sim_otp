"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });

// Web Audio API chime synthesis for instant, reliable sound without external assets
function playDepositChime() {
	try {
		const AudioContext = window.AudioContext || window.webkitAudioContext;
		if (!AudioContext) return;
		const ctx = new AudioContext();

		// Play two cheerful ascending tones
		const playTone = (freq, startTime, duration) => {
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			osc.type = "sine";
			osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);
			gain.gain.setValueAtTime(0.01, ctx.currentTime + startTime);
			gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + startTime + 0.05);
			gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration);
			osc.connect(gain);
			gain.connect(ctx.destination);
			osc.start(ctx.currentTime + startTime);
			osc.stop(ctx.currentTime + startTime + duration);
		};

		playTone(587.33, 0, 0.4); // D5
		playTone(880.00, 0.12, 0.7); // A5
	} catch {}
}

export default function DepositSuccessPopup() {
	const pathname = usePathname();
	const [depositData, setDepositData] = useState(null); // { amount, newBalance }
	const lastBalanceRef = useRef(null);
	const initialLoadedRef = useRef(false);

	useEffect(() => {
		// Don't poll in admin or login pages
		if (pathname?.startsWith("/admin") || pathname?.startsWith("/login")) return;

		let mounted = true;

		async function checkBalance() {
			try {
				const res = await fetch("/api/auth", { cache: "no-store" });
				if (!res.ok) return;
				const data = await res.json();
				if (!mounted || !data?.user?.id) return;

				const currentBalance = Number(data.user.balance || 0);

				if (!initialLoadedRef.current) {
					// First load: store baseline balance
					lastBalanceRef.current = currentBalance;
					initialLoadedRef.current = true;
					return;
				}

				if (lastBalanceRef.current !== null && currentBalance > lastBalanceRef.current) {
					const diff = currentBalance - lastBalanceRef.current;
					setDepositData({
						amount: diff,
						newBalance: currentBalance,
					});
					playDepositChime();
				}

				lastBalanceRef.current = currentBalance;
			} catch {}
		}

		// Initial check
		checkBalance();

		// Poll every 3.5 seconds
		const interval = setInterval(() => {
			if (typeof document !== "undefined" && document.visibilityState === "visible") {
				checkBalance();
			}
		}, 3500);

		return () => {
			mounted = false;
			clearInterval(interval);
		};
	}, [pathname]);

	if (!depositData) return null;

	return (
		<div className="deposit-success-modal-overlay">
			<div className="deposit-success-modal-card glass-panel" role="dialog" aria-modal="true">
				<div className="deposit-success-glow-halo"></div>

				<div className="deposit-success-icon-wrap">
					<div className="deposit-success-icon">🎉</div>
					<div className="deposit-confetti-sparkles">✨</div>
				</div>

				<div className="deposit-success-header">
					<span className="deposit-success-badge">TỰ ĐỘNG CỘNG TIỀN 24/7</span>
					<h2>Nạp Tiền Thành Công!</h2>
					<p>Hệ thống đã nhận được chuyển khoản và cộng tiền vào tài khoản của bạn.</p>
				</div>

				<div className="deposit-success-amount-box">
					<small>SỐ TIỀN VỪA CỘNG</small>
					<strong className="deposit-amount-highlight">+{money.format(depositData.amount)}</strong>
					<div className="deposit-new-balance-row">
						<span>Số dư mới:</span>
						<strong>{money.format(depositData.newBalance)}</strong>
					</div>
				</div>

				<div className="deposit-success-actions">
					<Link
						href="/dashboard"
						className="primary-button deposit-action-btn"
						onClick={() => setDepositData(null)}
					>
						⚡ Đi thuê SIM ngay →
					</Link>
					<button
						type="button"
						className="secondary-button deposit-close-btn"
						onClick={() => setDepositData(null)}
					>
						Đóng thông báo
					</button>
				</div>
			</div>
		</div>
	);
}
