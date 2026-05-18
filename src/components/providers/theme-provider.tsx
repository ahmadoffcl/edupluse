"use client";

import { useEffect } from "react";

export const themeStorageKey = "edupulse.theme";
export const themeChangeEvent = "edupulse-theme-change";
export type ThemeMode = "dark" | "light";

export function isThemeMode(value: string | null): value is ThemeMode {
  return value === "dark" || value === "light";
}

export function applyTheme(theme: ThemeMode) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const storedTheme = window.localStorage.getItem(themeStorageKey);
    applyTheme(isThemeMode(storedTheme) ? storedTheme : "dark");
  }, []);

  return <>{children}</>;
}
