"use client";

import type { ReactNode } from "react";

/** Onglets horizontaux défilables — mobile / tablette. */
export function ScrollableTabs({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex overflow-x-auto scroll-tabs scroll-tabs-hint gap-1.5 p-1.5 rounded-xl border border-[#DDE5E8] bg-[#F3F6F6] max-w-full ${className}`}
      role="tablist"
      aria-orientation="horizontal"
    >
      {children}
    </div>
  );
}

export function ScrollableTab({
  active,
  onClick,
  children,
  className = "",
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 ${
        active
          ? "bg-brand-700 text-white shadow-sm border-brand-700"
          : "text-[#52616B] border-transparent hover:bg-white/80 hover:text-[#173B32]"
      } ${className}`}
    >
      {children}
    </button>
  );
}
