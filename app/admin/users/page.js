"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdmin } from "../admin-shell";
import { AdminNotice, EmptyRows, formatDate, money, PageHeading, Pagination, StatusPill } from "../admin-ui";

const PAGE_SIZE = 25;

export default function AdminUsersPage() {
	const { request } = useAdmin();
	const [users, setUsers] = useState([]);
	const [selectedUser, setSelectedUser] = useState(null);
	const [query, setQuery] = useState("");
	const [search, setSearch] = useState("");
	const [page, setPage] = useState(1);
	const [total, setTotal] = useState(0);
	const [direction, setDirection] = useState("credit");
	const [amount, setAmount] = useState("");
	const [reason, setReason] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [message, setMessage] = useState("");

	const loadUsers = useCallback(async () => {
		setError("");
		try {
			const result = await request(`?view=users&q=${encodeURIComponent(search)}&page=${page}&limit=${PAGE_SIZE}`);
			setUsers(result.users);
			setTotal(result.total);
			setSelectedUser((current) => current ? result.users.find((user) => user.id === current.id) || current : null);
		} catch (loadError) {
			setError(loadError.message);
		}
	}, [request, search, page]);

	useEffect(() => { loadUsers(); }, [loadUsers]);

	function submitSearch(event) {
		event.preventDefault();
		setPage(1);
		setSearch(query.trim().toLowerCase());
	}

	async function adjustBalance(event) {
		event.preventDefault();
		if (!selectedUser) return;
		setBusy(true);
		setError("");
		setMessage("");
		try {
			const result = await request("", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ username: selectedUser.username, direction, amount: Number(amount), reason }),
			});
			setMessage(`${direction === "credit" ? "Đã cộng" : "Đã trừ"} ${money.format(Number(amount))}; số dư mới ${money.format(result.balance)}.`);
			setAmount("");
			await loadUsers();
		} catch (adjustError) {
			setError(adjustError.message);
		} finally {
			setBusy(false);
		}
	}

	async function toggleUserStatus() {
		if (!selectedUser) return;
		const disabled = !selectedUser.disabled;
		const confirmed = window.confirm(disabled
			? `Khóa tài khoản ${selectedUser.username}? User sẽ bị đăng xuất và không thể đăng nhập.`
			: `Mở khóa tài khoản ${selectedUser.username}?`);
		if (!confirmed) return;
		setBusy(true);
		setError("");
		setMessage("");
		try {
			await request("", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ action: "user_status", username: selectedUser.username, disabled }),
			});
			setMessage(disabled ? "Đã khóa tài khoản." : "Đã mở khóa tài khoản.");
			await loadUsers();
		} catch (statusError) {
			setError(statusError.message);
		} finally {
			setBusy(false);
		}
	}

	function selectUserAndScroll(user) {
		setSelectedUser(user);
		setMessage("");
		// If on small screen, smoothly scroll to detail panel
		if (typeof window !== "undefined" && window.innerWidth <= 1024) {
			setTimeout(() => {
				document.getElementById("user-detail-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
			}, 50);
		}
	}

	return <>
		<PageHeading eyebrow="TÀI KHOẢN" title="Người dùng" description="Tra cứu tài khoản, điều chỉnh số dư và kiểm soát truy cập." />
		<AdminNotice error={error} message={message} />
		<div className="admin-toolbar">
			<form className="admin-search-form" onSubmit={submitSearch}>
				<label className="sr-only" htmlFor="user-search">Tìm user</label>
				<input id="user-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo username..." />
				<button className="quiet-button">Tìm kiếm</button>
			</form>
			<span className="admin-result-count">{total.toLocaleString("vi-VN")} tài khoản</span>
		</div>
		<div className="admin-data-layout">
			<section className="admin-section admin-table-section">
				<div className="admin-table-wrap">
					<table className="admin-table">
						<thead>
							<tr>
								<th>Người dùng</th>
								<th>Số dư</th>
								<th>Đơn thuê</th>
								<th>Ngày tạo</th>
								<th>Trạng thái</th>
								<th>Thao tác</th>
							</tr>
						</thead>
						<tbody>
							{users.length ? users.map((user) => (
								<tr className={selectedUser?.id === user.id ? "selected-row" : ""} key={user.id}>
									<td>
										<strong className="user-table-name">{user.username}</strong>
										{user.fullName && <div style={{ fontSize: 12, color: "#10b981", fontWeight: 600 }}>{user.fullName}</div>}
									</td>
									<td><strong className="user-table-balance">{money.format(user.balance)}</strong></td>
									<td>{user.orderCount}</td>
									<td><small className="admin-cell-subtitle">{formatDate(user.createdAt)}</small></td>
									<td><StatusPill value={user.disabled ? "DISABLED" : "ENABLED"} /></td>
									<td>
										<button className="table-action primary-tag-btn" onClick={() => selectUserAndScroll(user)}>
											Quản lý →
										</button>
									</td>
								</tr>
							)) : (
								<EmptyRows columns={6}>Không tìm thấy người dùng</EmptyRows>
							)}
						</tbody>
					</table>
				</div>
				<Pagination page={page} limit={PAGE_SIZE} total={total} onChange={setPage} />
			</section>

			<aside className="admin-detail-panel" id="user-detail-panel">
				{selectedUser ? <>
					<div className="admin-section-heading">
						<div>
							<p className="eyebrow">HỒ SƠ USER</p>
							<h2>{selectedUser.username}</h2>
						</div>
						<div className="admin-detail-heading-actions">
							<StatusPill value={selectedUser.disabled ? "DISABLED" : "ENABLED"} />
						</div>
					</div>
					<dl className="admin-detail-list">
						<div><dt>Họ và tên thật</dt><dd style={{ color: "#10b981", fontWeight: 700 }}>{selectedUser.fullName || "Chưa cập nhật"}</dd></div>
						<div><dt>Cú pháp nạp tiền</dt><dd className="admin-id-value">{selectedUser.depositCode || "Chưa có"}</dd></div>
						<div><dt>Số dư hiện tại</dt><dd className="accent-balance">{money.format(selectedUser.balance)}</dd></div>
						<div><dt>Tổng đơn thuê</dt><dd>{selectedUser.orderCount} đơn</dd></div>
						<div><dt>User ID</dt><dd className="admin-id-value">{selectedUser.id}</dd></div>
					</dl>
					<form className="admin-adjust-form" onSubmit={adjustBalance}>
						<h3>Điều chỉnh số dư</h3>
						<div className="admin-segmented" role="group" aria-label="Loại điều chỉnh">
							<button type="button" className={direction === "credit" ? "active credit-btn" : ""} onClick={() => setDirection("credit")}>
								+ Cộng tiền
							</button>
							<button type="button" className={direction === "debit" ? "active debit-btn" : ""} onClick={() => setDirection("debit")}>
								− Trừ tiền
							</button>
						</div>
						<label className="admin-form-label">
							<span>Số tiền điều chỉnh (VND)</span>
							<input
								type="number"
								min="1"
								max="100000000"
								step="1"
								inputMode="numeric"
								placeholder="VD: 50000"
								value={amount}
								onChange={(event) => setAmount(event.target.value)}
								required
								className="admin-input-field"
							/>
						</label>
						<label className="admin-form-label">
							<span>Lý do ghi sổ cái</span>
							<input
								value={reason}
								onChange={(event) => setReason(event.target.value)}
								minLength="3"
								maxLength="160"
								placeholder="Ví dụ: Nạp tiền theo yêu cầu Zalo"
								required
								className="admin-input-field"
							/>
						</label>
						<button className="primary-button admin-submit-adjust-btn" disabled={busy}>
							{busy ? "Đang cập nhật..." : direction === "credit" ? "Xác nhận cộng tiền" : "Xác nhận trừ tiền"}
						</button>
					</form>
					<div className="admin-detail-footer-actions">
						<button
							type="button"
							className={selectedUser.disabled ? "quiet-button admin-unlock-button" : "quiet-button admin-lock-button"}
							onClick={toggleUserStatus}
							disabled={busy}
						>
							{selectedUser.disabled ? "🔓 Mở khóa tài khoản" : "🔒 Khóa tài khoản"}
						</button>
					</div>
				</> : (
					<div className="admin-detail-empty">
						<div className="admin-empty-icon">👤</div>
						<strong>Chọn một tài khoản</strong>
						<p>Nhấp vào nút &ldquo;Quản lý&rdquo; ở danh sách bên cạnh để xem hồ sơ và chỉnh sửa số dư.</p>
					</div>
				)}
			</aside>
		</div>
	</>;
}
