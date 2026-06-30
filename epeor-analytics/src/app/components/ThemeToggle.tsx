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
      aria-label={isDark ? "Désactiver le thème sombre" : "Activer le thème sombre"}
      onClick={handleClick}
      title={isDark ? "Sombre" : "Clair"}
      className="flex items-center gap-3 px-4 py-3 rounded-2xl w-full group transition-all duration-200"
      style={{
        background: isDark
          ? "var(--sidebar-active-bg)"
          : "transparent",
        color: "rgb(var(--color-text-primary))",
      }}
      onMouseEnter={e => {
        if (!isDark) {
          (e.currentTarget as HTMLElement).style.background = "var(--gradient-accent-soft)";
          (e.currentTarget as HTMLElement).style.transform = "translateX(3px)";
        }
      }}
      onMouseLeave={e => {
        if (!isDark) {
          (e.currentTarget as HTMLElement).style.background = "transparent";
          (e.currentTarget as HTMLElement).style.transform = "translateX(0)";
        }
      }}
    >
      {/* Icon with animated wrapper */}
      <span
        className="inline-flex items-center justify-center w-[18px] h-[18px] transition-transform duration-500"
        style={{
          transform: isDark ? "rotate(0deg)" : "rotate(-20deg)",
          color: isDark ? "var(--sidebar-active-border, #389be6)" : "rgb(var(--color-text-secondary))",
        }}
      >
        {isDark ? <Sun size={16} /> : <Moon size={16} />}
      </span>

      <span
        className="font-semibold text-sm"
        style={{ color: isDark ? "var(--sidebar-active-border, #389be6)" : "rgb(var(--color-text-primary))" }}
      >
        {isDark ? "Sombre" : "Clair"}
      </span>

      {/* Toggle pill */}
      <div
        aria-hidden
        className="ml-auto flex items-center"
        style={{ marginLeft: "auto" }}
      >
        <div
          className="relative w-8 h-4 rounded-full transition-all duration-300"
          style={{
            background: isDark
              ? "var(--gradient-accent)"
              : "rgba(var(--color-border), 1)",
          }}
        >
          <div
            className="absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all duration-300"
            style={{ left: isDark ? "calc(100% - 14px)" : "2px" }}
          />
        </div>
      </div>
    </button>
  );
}
