"use client";

import Link from "next/link";

export const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });

export function formatDate(value) {
	if (!value) return "Chưa có dữ liệu";
	return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(Number(value)));
}

export function PageHeading({ eyebrow, title, description, action }) {
	return <div className="admin-page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}

export function AdminNotice({ error, message }) {
	if (!error && !message) return null;
	return <p className={`admin-notice ${error ? "error-message" : "success-message"}`} role={error ? "alert" : "status"}>{error || message}</p>;
}

export function StatusPill({ value }) {
	const normalized = String(value || "").toUpperCase();
	const tone = ["COMPLETED", "ACTIVE", "SUCCESS", "ENABLED", "SEPAY_DEPOSIT"].includes(normalized) ? "positive"
		: ["PENDING", "REQUESTING"].includes(normalized) ? "warning"
			: ["FAILED", "EXPIRED", "DISABLED", "LOCKED"].includes(normalized) ? "negative" : "neutral";
	const labels = {
		PENDING: "Đang chờ", REQUESTING: "Đang tạo", COMPLETED: "Hoàn tất", EXPIRED: "Hết hạn", FAILED: "Thất bại",
		ENABLED: "Đang hoạt động", DISABLED: "Đã khóa", RENTAL: "Thuê SIM", REFUND: "Hoàn tiền", SEPAY_DEPOSIT: "Nạp tự động", ADMIN_CREDIT: "Admin cộng", ADMIN_DEBIT: "Admin trừ",
	};
	return <span className={`status-pill ${tone}`}>{labels[normalized] || value}</span>;
}

export function Pagination({ page, limit, total, onChange }) {
	const pages = Math.max(1, Math.ceil(total / limit));
	return <div className="admin-pagination"><span>{total.toLocaleString("vi-VN")} kết quả · trang {page}/{pages}</span><div><button className="quiet-button" onClick={() => onChange(Math.max(1, page - 1))} disabled={page <= 1}>Trước</button><button className="quiet-button" onClick={() => onChange(Math.min(pages, page + 1))} disabled={page >= pages}>Tiếp</button></div></div>;
}

export function EmptyRows({ columns, children = "Chưa có dữ liệu" }) {
	return <tr><td className="admin-empty-row" colSpan={columns}>{children}</td></tr>;
}

export function LinkButton({ href, children }) {
	return <Link className="quiet-button admin-link-button" href={href}>{children}</Link>;
}
