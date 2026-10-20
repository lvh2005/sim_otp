"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdmin } from "../admin-shell";
import { AdminNotice, EmptyRows, formatDate, money, PageHeading, Pagination, StatusPill } from "../admin-ui";

const PAGE_SIZE = 25;

export default function AdminTransactionsPage() {
	const { request } = useAdmin();
	const [transactions, setTransactions] = useState([]);
	const [type, setType] = useState("");
	const [page, setPage] = useState(1);
	const [total, setTotal] = useState(0);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(true);

	const loadTransactions = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			const params = new URLSearchParams({ view: "transactions", type, page: String(page), limit: String(PAGE_SIZE) });
			const result = await request(`?${params}`);
			setTransactions(result.transactions);
			setTotal(result.total);
		} catch (loadError) {
			setError(loadError.message);
		} finally {
			setLoading(false);
		}
	}, [request, type, page]);

	useEffect(() => { loadTransactions(); }, [loadTransactions]);

	return <>
		<PageHeading eyebrow="SỔ CÁI" title="Giao dịch" description="Lịch sử điều chỉnh số dư, thu tiền thuê và hoàn tiền." action={<button className="quiet-button" onClick={loadTransactions} disabled={loading}>{loading ? "Đang tải..." : "Làm mới"}</button>} />
		<AdminNotice error={error} />
		<div className="admin-ledger-note">
			<span className="ledger-info-icon">ℹ️</span>
			<span>Giao dịch được ghi tự động cho các đơn và điều chỉnh số dư phát sinh từ khi bật sổ cái.</span>
		</div>
		<div className="admin-toolbar">
			<label className="admin-filter-label">
				<span>Loại giao dịch:</span>
				<select value={type} onChange={(event) => { setType(event.target.value); setPage(1); }}>
					<option value="">Tất cả giao dịch</option>
					<option value="SEPAY_DEPOSIT">Nạp tự động (SePay)</option>
					<option value="ADMIN_CREDIT">Admin cộng tiền</option>
					<option value="ADMIN_DEBIT">Admin trừ tiền</option>
					<option value="RENTAL">Thu tiền thuê SIM</option>
					<option value="REFUND">Hoàn tiền</option>
				</select>
			</label>
			<span className="admin-result-count">{total.toLocaleString("vi-VN")} giao dịch</span>
		</div>
		<div className="admin-table-wrap">
			<table className="admin-table">
				<thead>
					<tr>
						<th>Thời gian</th>
						<th>Người dùng</th>
						<th>Loại GD</th>
						<th>Biến động</th>
						<th>Số dư sau</th>
						<th>Lý do</th>
						<th>Mã đơn</th>
					</tr>
				</thead>
				<tbody>
					{transactions.length ? transactions.map((transaction) => (
						<tr key={transaction.id}>
							<td><small className="admin-cell-subtitle">{formatDate(transaction.createdAt)}</small></td>
							<td><strong>{transaction.username}</strong></td>
							<td><StatusPill value={transaction.type} /></td>
							<td className={transaction.amount < 0 ? "admin-negative-amount" : "admin-positive-amount"}>
								<strong>{transaction.amount > 0 ? "+" : "−"}{money.format(Math.abs(transaction.amount))}</strong>
							</td>
							<td><strong className="user-table-balance">{money.format(transaction.balance)}</strong></td>
							<td><span className="transaction-reason-cell">{transaction.reason || "—"}</span></td>
							<td className="admin-id-value">{transaction.orderId || "—"}</td>
						</tr>
					)) : (
						<EmptyRows columns={7}>{loading ? "Đang tải sổ cái..." : "Chưa có giao dịch"}</EmptyRows>
					)}
				</tbody>
			</table>
		</div>
		<Pagination page={page} limit={PAGE_SIZE} total={total} onChange={setPage} />
	</>;
}
