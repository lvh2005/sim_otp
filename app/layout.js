import "./globals.css";
import ThemeProvider from "@/app/components/ThemeProvider";
import AnnouncementPopup from "@/app/components/AnnouncementPopup";
import RequireNamePopup from "@/app/components/RequireNamePopup";
import DepositSuccessPopup from "@/app/components/DepositSuccessPopup";

export const metadata = {
	title: "SIM OTP - Thuê số điện thoại nhận mã OTP tự động",
	description: "Hệ thống phân phối số điện thoại nhận mã OTP tức thì, tự động 24/7, bảo vệ số dư 100%.",
	icons: {
		icon: "/favicon.ico",
		shortcut: "/favicon.ico",
		apple: "/logo.png",
	},
};

export default function RootLayout({ children }) {
	return (
		<html lang="vi" data-theme="dark" suppressHydrationWarning>
			<head>
				<link rel="icon" href="/favicon.ico" sizes="any" />
				<link rel="apple-touch-icon" href="/logo.png" />
				<script
					dangerouslySetInnerHTML={{
						__html: `(function(){try{var t=localStorage.getItem("sim-otp-theme");if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t);}else{document.documentElement.setAttribute("data-theme","dark");}}catch(e){}})();`,
					}}
				/>
			</head>
			<body>
				<ThemeProvider>
					{children}
					<AnnouncementPopup />
					<RequireNamePopup />
					<DepositSuccessPopup />
				</ThemeProvider>
			</body>
		</html>
	);
}


