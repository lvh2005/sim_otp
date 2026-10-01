import "./globals.css";

export const metadata = {
	title: "SIM OTP",
	description: "Thuê số điện thoại nhận mã OTP",
};

export default function RootLayout({ children }) {
	return (
		<html lang="vi">
			<body>{children}</body>
		</html>
	);
}
