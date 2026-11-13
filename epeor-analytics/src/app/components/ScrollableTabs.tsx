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
      className={`flex overflow-x-auto scroll-tabs gap-1 p-1 rounded-lg border border-[#DDE5E8] bg-[#E9EFF1] max-w-full ${className}`}
      role="tablist"
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
      className={`shrink-0 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-[11px] sm:text-xs font-black transition-all border whitespace-nowrap ${
        active
          ? "bg-white text-brand-700 shadow-sm border-[#DDE5E8]"
            : "text-[#667085] border-transparent hover:text-[#26313A]"
      } ${className}`}
    >
      {children}
    </button>
  );
}
