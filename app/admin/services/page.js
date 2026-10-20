"use client";

import { useCallback, useEffect, useState } from "react";
import { SIM_SERVICE_CATALOG } from "@/lib/sim-catalog";
import { useAdmin } from "../admin-shell";
import { AdminNotice, money, PageHeading } from "../admin-ui";

export default function AdminServicesPage() {
	const { request } = useAdmin();
	const [prices, setPrices] = useState({});
	const [disabledServices, setDisabledServices] = useState([]);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [message, setMessage] = useState("");

	const loadPrices = useCallback(async () => {
		setError("");
		try {
			const result = await request("?view=prices");
			setPrices(Object.fromEntries(Object.entries(result.prices || {}).map(([service, price]) => [service, String(price || "")])));
			setDisabledServices(Array.isArray(result.disabledServices) ? result.disabledServices : []);
		} catch (loadError) {
			setError(loadError.message);
		}
	}, [request]);

	useEffect(() => { loadPrices(); }, [loadPrices]);

	function toggleService(serviceId) {
		setDisabledServices((current) =>
			current.includes(serviceId)
				? current.filter((id) => id !== serviceId)
				: [...current, serviceId]
		);
	}

	async function savePrices(event) {
		event.preventDefault();
		setBusy(true);
		setError("");
		setMessage("");
		try {
			const result = await request("", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					prices: Object.fromEntries(Object.entries(prices).map(([service, price]) => [service, Number(price)])),
					disabledServices,
				}),
			});
			setPrices(Object.fromEntries(Object.entries(result.prices || {}).map(([service, price]) => [service, String(price || "")])));
			setDisabledServices(Array.isArray(result.disabledServices) ? result.disabledServices : []);
			setMessage("Đã lưu bảng giá và trạng thái bật/tắt dịch vụ thành công.");
		} catch (saveError) {
			setError(saveError.message);
		} finally {
			setBusy(false);
		}
	}

	return <>
		<PageHeading eyebrow="CẤU HÌNH CỬA HÀNG" title="Bảng giá & Bật/Tắt Dịch Vụ" description="Giá bán và bật/tắt dịch vụ áp dụng tức thì trên giao diện người dùng; dịch vụ bị tắt sẽ ẩn khỏi trang thuê." action={<button className="quiet-button" onClick={loadPrices}>Làm mới</button>} />
		<AdminNotice error={error} message={message} />
		<form className="admin-panel admin-price-panel glass-panel" onSubmit={savePrices}>
			<div className="admin-section-heading">
				<div>
					<h2>Giá theo dịch vụ & Trạng thái hoạt động</h2>
					<p>Bật/tắt để cho phép hoặc ẩn dịch vụ khỏi trang người dùng; thiết lập giá bán VND tương ứng.</p>
				</div>
				<span className="admin-price-count">{SIM_SERVICE_CATALOG.length} dịch vụ ({SIM_SERVICE_CATALOG.length - disabledServices.length} đang bật)</span>
			</div>
			<div className="price-table" role="table" aria-label="Giá bán SIM">
				<div className="price-table-head" role="row">
					<span style={{ flex: 1 }}>Dịch vụ</span>
					<span style={{ width: 140, textAlign: "center" }}>Trạng thái</span>
					<span style={{ width: 170, textAlign: "right" }}>Giá bán (VND)</span>
				</div>
				{SIM_SERVICE_CATALOG.map((service) => {
					const isDisabled = disabledServices.includes(service.id);
					return (
						<div className={`price-table-row ${isDisabled ? "service-row-disabled" : ""}`} key={service.id}>
							<div className="service-label">
								<span className="service-name-text">{service.label}</span>
								<span className="service-mode-tag">{service.mode}</span>
								{service.category && (
									<span className="service-mode-tag" style={{ background: "rgba(16, 185, 129, 0.12)", color: "#10b981" }}>
										{service.category.toUpperCase()}
									</span>
								)}
							</div>
							<div className="service-toggle-wrap" style={{ width: 140 }}>
								<button
									type="button"
									className={`service-status-toggle ${isDisabled ? "disabled" : "enabled"}`}
									onClick={() => toggleService(service.id)}
									title={isDisabled ? "Nhấn để BẬT dịch vụ (Hiển thị lại trên web)" : "Nhấn để TẮT dịch vụ (Ẩn khỏi web người dùng)"}
								>
									<span className="toggle-dot" />
									<span className="toggle-text">{isDisabled ? "Đã tắt (Ẩn)" : "Đang bật"}</span>
								</button>
							</div>
							<div className="price-input-wrap">
								<input
									type="number"
									min="100"
									max="100000000"
									step="100"
									inputMode="numeric"
									value={prices[service.id] ?? ""}
									onChange={(event) => setPrices((current) => ({ ...current, [service.id]: event.target.value }))}
									required
									className="admin-input-field mono-text"
								/>
								<span className="price-currency-suffix">₫</span>
							</div>
						</div>
					);
				})}
			</div>
			<div className="margin-note">
				<strong>💡 Quản lý hiển thị và biên lợi nhuận</strong>
				<p>Khi bạn tắt một dịch vụ, dịch vụ đó sẽ lập tức ẩn khỏi trang khách hàng và không thể tạo đơn mới. Hãy nhấn <strong>💾 Lưu bảng giá</strong> để áp dụng các thay đổi.</p>
			</div>
			<div className="admin-form-footer">
				<span className="admin-price-footnote">✓ Đã đồng bộ cấu hình Redis phân tán.</span>
				<button className="primary-button admin-save-price-btn" disabled={busy}>
					{busy ? "Đang lưu..." : "💾 Lưu bảng giá & Trạng thái"}
				</button>
			</div>
		</form>
	</>;
}
