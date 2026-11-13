"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import useTheme from "../hooks/useTheme";

export default function ThemeToggle() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();

  const handleClick = () => setTheme(theme === "dark" ? "light" : "dark");
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={t(isDark ? "theme.switchToLight" : "theme.switchToDark")}
      onClick={handleClick}
      title={t(isDark ? "theme.switchToLight" : "theme.switchToDark")}
      className="group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-start transition-colors duration-200 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-slate-800"
      style={{
        background: isDark ? "var(--sidebar-active-bg)" : undefined,
        color: "rgb(var(--color-text-primary))",
      }}
    >
      {/* Icon with animated wrapper */}
      <span
        className="inline-flex h-[18px] w-[18px] items-center justify-center transition-transform duration-300"
        style={{
          transform: isDark ? "rotate(0deg)" : "rotate(-20deg)",
          color: isDark ? "var(--sidebar-active-border, #60a5fa)" : "rgb(var(--color-text-secondary))",
        }}
      >
        {isDark ? <Sun size={16} /> : <Moon size={16} />}
      </span>

      <span
        className="text-sm font-semibold"
        style={{ color: isDark ? "var(--sidebar-active-border)" : "rgb(var(--color-text-primary))" }}
      >
        {t(isDark ? "theme.dark" : "theme.light")}
      </span>

      {/* Toggle pill */}
      <div
        aria-hidden
        className="ms-auto flex items-center"
      >
        <div
          className="relative h-4 w-8 rounded-full transition-colors duration-200"
          style={{
            background: isDark
              ? "var(--gradient-accent)"
              : "rgba(var(--color-border), 1)",
          }}
        >
          <div
            className="absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all duration-300"
            style={{ insetInlineStart: isDark ? "calc(100% - 14px)" : "2px" }}
          />
        </div>
      </div>
    </button>
  );
}
