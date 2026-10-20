"use client";

import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext({
	theme: "dark",
	toggleTheme: () => {},
	setTheme: () => {},
});

export function useTheme() {
	return useContext(ThemeContext);
}

export default function ThemeProvider({ children }) {
	const [theme, setThemeState] = useState("dark");
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		try {
			const saved = localStorage.getItem("sim-otp-theme");
			if (saved === "light" || saved === "dark") {
				setThemeState(saved);
				document.documentElement.setAttribute("data-theme", saved);
			} else {
				document.documentElement.setAttribute("data-theme", "dark");
			}
		} catch {
			// localStorage error safe
		}
		setMounted(true);
	}, []);

	const setTheme = (newTheme) => {
		setThemeState(newTheme);
		try {
			localStorage.setItem("sim-otp-theme", newTheme);
			document.documentElement.setAttribute("data-theme", newTheme);
		} catch {
			// ignore
		}
	};

	const toggleTheme = () => {
		const next = theme === "dark" ? "light" : "dark";
		setTheme(next);
	};

	return (
		<ThemeContext.Provider value={{ theme, toggleTheme, setTheme, mounted }}>
			{children}
		</ThemeContext.Provider>
	);
}
