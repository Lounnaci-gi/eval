"use client";

import { Moon, Sun } from "lucide-react";
import useTheme from "../hooks/useTheme";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const handleClick = () => setTheme(theme === "dark" ? "light" : "dark");

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Désactiver le thème sombre' : 'Activer le thème sombre'}
      onClick={handleClick}
      title={isDark ? 'Sombre' : 'Clair'}
      className="flex items-center gap-3 px-4 py-3.5 rounded-2xl w-full"
      style={{
        backgroundColor: isDark ? "rgba(13,131,222,0.07)" : "transparent",
        color: "rgb(var(--color-text-primary))",
      }}
    >
      <span style={{ filter: "var(--icon-filter)", display: 'inline-flex' }}>
        {isDark ? <Sun size={18} /> : <Moon size={18} />}
      </span>

      <span className="font-semibold text-sm" style={{ color: "rgb(var(--color-text-primary))" }}>
        {isDark ? 'Sombre' : 'Clair'}
      </span>

      <div style={{ marginLeft: 'auto', width: 8, height: 8, borderRadius: 8, backgroundColor: 'rgb(var(--color-accent))' , opacity: isDark ? 1 : 0.0 }} />
    </button>
  );
}
