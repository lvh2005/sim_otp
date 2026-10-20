"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getVietQRUrl } from "@/lib/sepay";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import TelegramBotWidget from "@/app/components/TelegramBotWidget";

const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const PRESET_AMOUNTS = [10000, 20000, 50000, 100000, 200000, 500000];

export default function DepositPage() {
	const [user, setUser] = useState(null);
	const [depositInfo, setDepositInfo] = useState(null);
	const [loading, setLoading] = useState(true);
	const [depositRefreshing, setDepositRefreshing] = useState(false);
	const [selectedAmount, setSelectedAmount] = useState(50000);
	const [customAmount, setCustomAmount] = useState("");
	const [copiedField, setCopiedField] = useState("");
	const [lastSuccessNotice, setLastSuccessNotice] = useState("");
	const [error, setError] = useState("");

	const loadDepositInfo = useCallback(async (manual = false) => {
		if (manual) setDepositRefreshing(true);
		try {
			const response = await fetch("/api/deposit", { cache: "no-store" });
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || "Không thể tải thông tin nạp tiền");

			setDepositInfo((prev) => {
				if (prev && result.balance > prev.balance) {
					const diff = result.balance - prev.balance;
					setLastSuccessNotice(`🎉 Nạp tiền thành công! Đã cộng +${money.format(diff)} vào tài khoản.`);
				}
				return result;
			});
			setUser((current) => current ? { ...current, balance: result.balance } : current);
			setError("");
		} catch (err) {
			setError(err.message);
		} finally {
			if (manual) setDepositRefreshing(false);
		}
	}, []);

	useEffect(() => {
		let mounted = true;
		fetch("/api/auth", { cache: "no-store" })
			.then((res) => (res.ok ? res.json() : null))
			.then((data) => {
				if (!mounted) return;
				if (!data?.user) {
					window.location.href = "/login";
					return;
				}
				setUser(data.user);
			})
			.catch(() => {
				if (mounted) setError("Không thể kết nối đến máy chủ.");
			})
			.finally(() => {
				if (mounted) setLoading(false);
			});

		return () => {
			mounted = false;
		};
	}, []);

	useEffect(() => {
		if (!user?.id) return undefined;
		loadDepositInfo();
		const interval = setInterval(() => {
			if (document.visibilityState === "visible") {
				loadDepositInfo();
			}
		}, 4000);
		return () => clearInterval(interval);
	}, [user?.id, loadDepositInfo]);

	const copyToClipboard = async (text, fieldName) => {
		if (text === null || text === undefined || text === "") return;
		try {
			await navigator.clipboard.writeText(String(text));
			setCopiedField(fieldName);
			setTimeout(() => setCopiedField(""), 2000);
		} catch {
			// fallback
		}
	};

	const isDepositEnabled = depositInfo?.depositEnabled !== false;
	const supportTelegram = String(depositInfo?.supportTelegram || "Vuha_cute_dapxe_trenpho").trim();
	const teleUrl = supportTelegram.startsWith("http") ? supportTelegram : `https://t.me/${supportTelegram.replace(/^@/, "")}`;
	const disabledNotice = depositInfo?.disabledNotice || "Cổng nạp tiền tự động đang tạm đóng. Vui lòng liên hệ Telegram để nạp tiền!";

	const effectiveAmount = customAmount ? Number(customAmount) || 0 : selectedAmount;
	const bank = String(depositInfo?.destination?.bankName || "TPBank");
	const accNumber = String(depositInfo?.destination?.accountNumber || "10005790882");
	const accName = String(depositInfo?.destination?.accountName || "LE VU HA");
	const depositCode = String(depositInfo?.depositCode || "");

	const qrUrl = getVietQRUrl({
		bankName: bank,
		accountNumber: accNumber,
		accountName: accName,
		amount: effectiveAmount,
		depositCode: depositCode,
	});

	if (loading) {
		return (
			<main className="page-shell modern-dark-shell">
				<div className="loading-state-wrapper">
					<div className="app-loader-spinner"></div>
					<p>Đang tải thông tin nạp tiền VietQR...</p>
				</div>
			</main>
		);
	}

	return (
		<main className="page-shell modern-dark-shell deposit-page-shell">
			<Header user={user} />

			<div className="deposit-layout">
				<div className="deposit-hero glass-panel">
					<p className="eyebrow"><span className="eyebrow-mark"></span> CỔNG NẠP TỰ ĐỘNG 24/7</p>
					<h1>Nạp tiền tài khoản <span>SIM OTP</span></h1>
					<p className="deposit-hero-desc">
						Quét mã VietQR bằng bất kỳ App Ngân hàng hoặc Ví điện tử (Momo, ZaloPay). Hệ thống nhận webhook và cộng tiền tự động sau 1-5 giây.
					</p>
				</div>

				{lastSuccessNotice && (
					<div className="deposit-success-banner" role="status">
						<span className="banner-icon">✓</span>
						<div>
							<strong>Thành công!</strong>
							<p>{lastSuccessNotice}</p>
						</div>
						<button onClick={() => setLastSuccessNotice("")} aria-label="Đóng">×</button>
					</div>
				)}

				{error && <div className="deposit-error-banner" role="alert">{error}</div>}

				{!isDepositEnabled ? (
					<div className="deposit-qr-card glass-panel" style={{ textAlign: "center", padding: "40px 20px" }}>
						<h3 style={{ fontSize: 20, color: "#f59e0b", marginBottom: 12 }}>
							⚠️ Cổng nạp tiền tự động đang tạm đóng
						</h3>
						<p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 20, maxWidth: 500, margin: "0 auto 20px auto" }}>
							{disabledNotice}
						</p>
						<a
							href={teleUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="primary-button"
							style={{
								display: "inline-flex",
								alignItems: "center",
								gap: 8,
								padding: "12px 24px",
								fontSize: 15,
								fontWeight: 700,
								textDecoration: "none",
								borderRadius: "var(--radius-md)",
							}}
						>
							💬 Nhắn tin Telegram hỗ trợ nạp tiền ↗
						</a>
					</div>
				) : (
					<div className="deposit-grid-container">
						{/* Left: QR Code & Bank Info Card */}
						<div className="deposit-qr-card glass-panel">
							<div className="qr-card-header">
								<span className="live-status-pulse">
									<span className="pulse-dot"></span>
									Tự động cộng tiền 24/7
								</span>
								<button
									type="button"
									className="refresh-mini-btn"
									onClick={() => loadDepositInfo(true)}
									disabled={depositRefreshing}
								>
									{depositRefreshing ? "..." : "🔄 Làm mới"}
								</button>
							</div>

							<div className="qr-frame">
								{depositCode ? (
									<img
										src={qrUrl}
										alt="Mã QR Chuyển khoản VietQR"
										className="vietqr-image"
										loading="eager"
									/>
								) : (
									<div className="qr-skeleton">Đang tạo mã QR...</div>
								)}
							</div>

							<div className="qr-scan-instruction">
								<span className="scan-icon">📱</span>
								<span>Mở app ngân hàng quét mã QR để điền tự động STK, Số tiền và Nội dung</span>
							</div>

							<div className="bank-meta-details">
								<div className="bank-meta-row">
									<span className="meta-label">Ngân hàng</span>
									<div className="meta-value-group">
										<strong className="meta-value highlight-bank">{bank}</strong>
										<button
											type="button"
											className="copy-chip"
											onClick={() => copyToClipboard(bank, "bank")}
										>
											{copiedField === "bank" ? "✓ Đã chép" : "Sao chép"}
										</button>
									</div>
								</div>

								<div className="bank-meta-row">
									<span className="meta-label">Số tài khoản</span>
									<div className="meta-value-group">
										<strong className="meta-value mono-text">{accNumber}</strong>
										<button
											type="button"
											className="copy-chip"
											onClick={() => copyToClipboard(accNumber, "accNumber")}
										>
											{copiedField === "accNumber" ? "✓ Đã chép" : "Sao chép"}
										</button>
									</div>
								</div>

								<div className="bank-meta-row">
									<span className="meta-label">Chủ tài khoản</span>
									<div className="meta-value-group">
										<strong className="meta-value">{accName}</strong>
									</div>
								</div>

								<div className="bank-meta-row highlight-row">
									<span className="meta-label">Nội dung CK (Bắt buộc)</span>
									<div className="meta-value-group">
										<strong className="meta-value deposit-code-badge">{depositCode || "Đang tạo..."}</strong>
										<button
											type="button"
											className="copy-chip primary-chip"
											onClick={() => copyToClipboard(depositCode, "code")}
										>
											{copiedField === "code" ? "✓ Đã chép" : "Sao chép mã"}
										</button>
									</div>
								</div>

								<div className="bank-meta-row">
									<span className="meta-label">Số tiền</span>
									<div className="meta-value-group">
										<strong className="meta-value">{money.format(effectiveAmount)}</strong>
										<button
											type="button"
											className="copy-chip"
											onClick={() => copyToClipboard(String(effectiveAmount), "amount")}
										>
											{copiedField === "amount" ? "✓ Đã chép" : "Sao chép"}
										</button>
									</div>
								</div>
							</div>
						</div>

						{/* Right: Amount selection & instructions */}
						<div className="deposit-options-panel">
							<div className="options-card glass-panel">
								<h3>1. Chọn số tiền nạp</h3>
								<p className="options-sub">Chọn nhanh mức tiền hoặc nhập số tiền tùy ý:</p>

								<div className="preset-grid">
									{PRESET_AMOUNTS.map((amt) => (
										<button
											key={amt}
											type="button"
											className={`preset-btn ${selectedAmount === amt && !customAmount ? "active" : ""}`}
											onClick={() => {
												setSelectedAmount(amt);
												setCustomAmount("");
											}}
										>
											<strong>{money.format(amt)}</strong>
										</button>
									))}
								</div>

								<div className="custom-amount-field">
									<label htmlFor="custom-amount-input">Hoặc nhập số tiền khác (VNĐ):</label>
									<div className="custom-input-wrap">
										<input
											id="custom-amount-input"
											type="number"
											min={depositInfo?.minimumAmount || 10000}
											step="1000"
											placeholder="Ví dụ: 30000"
											value={customAmount}
											onChange={(e) => setCustomAmount(e.target.value)}
										/>
										<span className="input-currency">₫</span>
									</div>
									<small className="amount-helper">
										Nạp tối thiểu: {money.format(depositInfo?.minimumAmount || 10000)}
									</small>
								</div>
							</div>

							<div className="options-card help-card glass-panel">
								<h3>2. Hướng dẫn nạp tiền</h3>
								<ol className="step-guide">
									<li>
										<span className="step-num">1</span>
										<span>Mở ứng dụng Ngân hàng (TPBank, Vietcombank, Techcombank, MB,...) hoặc Ví điện tử.</span>
									</li>
									<li>
										<span className="step-num">2</span>
										<span>Chọn tính năng <strong>Quét mã QR</strong> và quét mã ở bên trái.</span>
									</li>
									<li>
										<span className="step-num">3</span>
										<span>
											Nếu chuyển thủ công, nhớ <strong>nhập chính xác Nội dung chuyển khoản</strong> là <code>{depositCode}</code>.
										</span>
									</li>
									<li>
										<span className="step-num">4</span>
										<span>Sau khi chuyển khoản, giữ trang này 1-5 giây để số dư được tự động cập nhật.</span>
									</li>
								</ol>
							</div>

							{/* Recent History */}
							<div className="options-card history-card glass-panel">
								<div className="history-card-header">
									<h3>Lịch sử nạp gần đây</h3>
									<Link href="/history" className="view-all-link">Xem tất cả ↗</Link>
								</div>
								<div className="history-list">
									{depositInfo?.history?.length ? (
										depositInfo.history.map((tx) => (
											<div className="history-item" key={tx.id}>
												<div className="history-left">
													<span className="history-type">Nạp tiền VietQR</span>
													<small className="history-time">
														{new Intl.DateTimeFormat("vi-VN", {
															dateStyle: "short",
															timeStyle: "medium",
														}).format(new Date(tx.createdAt))}
													</small>
												</div>
												<strong className="history-amount">+{money.format(tx.amount)}</strong>
											</div>
										))
									) : (
										<p className="empty-history">Chưa có giao dịch nạp tiền nào.</p>
									)}
								</div>
							</div>
						</div>
					</div>
				)}
			</div>

			<Footer />
			<TelegramBotWidget />
		</main>
	);
}
