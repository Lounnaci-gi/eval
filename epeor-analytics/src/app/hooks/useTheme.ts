"use client";

import { useEffect, useState, useCallback } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "theme";

export function useTheme(): { theme: Theme; setTheme: (t: Theme) => void } {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "light";
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (saved === "light" || saved === "dark") return saved;
    // Default to system preference on first visit but do not expose a 'system' state
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  const apply = useCallback((t: Theme) => {
    const root = document.documentElement;
    if (t === "dark") {
      root.setAttribute("data-theme", "dark");
    } else if (t === "light") {
      root.removeAttribute("data-theme");
    }
  }, []);

  useEffect(() => {
    apply(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
      // also write cookie so SSR can read it for deterministic renders
      const expires = new Date();
      expires.setFullYear(expires.getFullYear() + 1);
      document.cookie = `${STORAGE_KEY}=${encodeURIComponent(theme)}; path=/; expires=${expires.toUTCString()}; SameSite=Lax`;
    } catch {
      /* localStorage/cookie indisponible */
    }
  }, [theme, apply]);

  // No system listener: we do not track OS changes once user selected light/dark

  return { theme, setTheme: setThemeState };
}

export default useTheme;
