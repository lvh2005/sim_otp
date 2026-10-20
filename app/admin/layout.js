import { AdminProvider, AdminShell } from "./admin-shell";

export default function AdminLayout({ children }) {
	return <AdminProvider><AdminShell>{children}</AdminShell></AdminProvider>;
}
