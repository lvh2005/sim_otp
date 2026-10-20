"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdmin } from "../admin-shell";
import { AdminNotice, EmptyRows, formatDate, money, PageHeading, Pagination, StatusPill } from "../admin-ui";

const PAGE_SIZE = 25;

export default function AdminOrdersPage() {
	const { request } = useAdmin();
	const [orders, setOrders] = useState([]);
	const [query, setQuery] = useState("");
	const [search, setSearch] = useState("");
	const [status, setStatus] = useState("");
	const [page, setPage] = useState(1);
	const [total, setTotal] = useState(0);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(true);

	const loadOrders = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			const params = new URLSearchParams({ view: "orders", q: search, status, page: String(page), limit: String(PAGE_SIZE) });
			const result = await request(`?${params}`);
			setOrders(result.orders);
			setTotal(result.total);
		} catch (loadError) {
			setError(loadError.message);
		} finally {
			setLoading(false);
		}
	}, [request, search, status, page]);

	useEffect(() => { loadOrders(); }, [loadOrders]);

	function submitSearch(event) {
		event.preventDefault();
		setPage(1);
		setSearch(query.trim().toLowerCase());
	}

	return <>
		<PageHeading eyebrow="HOẠT ĐỘNG THUÊ" title="Đơn thuê" description="Tra cứu phiên thuê, trạng thái và chi phí. Mã OTP không hiển thị trong khu vực này." action={<button className="quiet-button" onClick={loadOrders} disabled={loading}>{loading ? "Đang tải..." : "Làm mới"}</button>} />
		<AdminNotice error={error} />
		<div className="admin-toolbar">
			<form className="admin-search-form" onSubmit={submitSearch}>
				<label className="sr-only" htmlFor="order-search">Tìm đơn thuê</label>
				<input id="order-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Username, SĐT hoặc mã đơn..." />
				<button className="quiet-button">Tìm</button>
			</form>
			<div className="admin-toolbar-right">
				<label className="admin-filter-label">
					<span>Lọc trạng thái:</span>
					<select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
						<option value="">Tất cả trạng thái</option>
						<option value="PENDING">Đang chờ</option>
						<option value="REQUESTING">Đang tạo</option>
						<option value="COMPLETED">Hoàn tất</option>
						<option value="EXPIRED">Hết hạn</option>
						<option value="FAILED">Thất bại</option>
					</select>
				</label>
				<span className="admin-result-count">{total.toLocaleString("vi-VN")} đơn</span>
			</div>
		</div>
		<div className="admin-table-wrap">
			<table className="admin-table">
				<thead>
					<tr>
						<th>Thời gian</th>
						<th>Mã đơn</th>
						<th>User</th>
						<th>Số điện thoại</th>
						<th>Dịch vụ / mạng</th>
						<th>Chi phí</th>
						<th>Trạng thái</th>
					</tr>
				</thead>
				<tbody>
					{orders.length ? orders.map((order) => (
						<tr key={order.id}>
							<td><small className="admin-cell-subtitle">{formatDate(order.createdAt)}</small></td>
							<td className="admin-id-value">{order.id}</td>
							<td><strong>{order.username}</strong></td>
							<td><span className="mono-text phone-highlight">{order.phone || "—"}</span></td>
							<td>
								<div className="order-service-cell">
									<span>{order.service}</span>
									<small className="admin-cell-subtitle">{order.carrier}</small>
								</div>
							</td>
							<td><strong>{money.format(order.cost)}</strong></td>
							<td><StatusPill value={order.status} /></td>
						</tr>
					)) : (
						<EmptyRows columns={7}>{loading ? "Đang tải danh sách đơn..." : "Chưa có đơn phù hợp"}</EmptyRows>
					)}
				</tbody>
			</table>
		</div>
		<Pagination page={page} limit={PAGE_SIZE} total={total} onChange={setPage} />
	</>;
}
