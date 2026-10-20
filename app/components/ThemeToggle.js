"use client";

import { useTheme } from "./ThemeProvider";

export default function ThemeToggle({ className = "" }) {
	const { theme, toggleTheme, mounted } = useTheme();

	if (!mounted) {
		return (
			<button
				type="button"
				className={`theme-toggle-btn ${className}`}
				aria-label="Chuyển chế độ sáng/tối"
				title="Chuyển chế độ sáng/tối"
			>
				<span className="theme-toggle-icon">🌙</span>
			</button>
		);
	}

	const isDark = theme === "dark";

	return (
		<button
			type="button"
			className={`theme-toggle-btn ${className} ${isDark ? "is-dark" : "is-light"}`}
			onClick={toggleTheme}
			aria-label={isDark ? "Chuyển sang nền sáng" : "Chuyển sang nền tối"}
			title={isDark ? "Chuyển sang nền sáng (Light Mode)" : "Chuyển sang nền tối (Dark Mode)"}
		>
			<span className="theme-toggle-icon">{isDark ? "☀️" : "🌙"}</span>
			<span className="theme-toggle-text">{isDark ? "Sáng" : "Tối"}</span>
		</button>
	);
}
