"use client";

const iconBgMap: Record<string, string> = {
  blue:    "bg-brand-50 text-brand-700",
  rose:    "bg-rose-50   text-rose-500",
  amber:   "bg-amber-50  text-amber-500",
  cyan:    "bg-mineral-50 text-mineral-600",
  brand:   "bg-brand-50  text-brand-500",
  emerald: "bg-emerald-50 text-success-600",
  indigo:  "bg-brand-50 text-brand-700",
  slate:   "bg-slate-100 text-[#475467]",
};

// ── StatsCard ────────────────────────────────────────────────────────────────

export function StatsCard({ title, value, icon, trend, color, onClick }: any) {
  const iconCls = iconBgMap[color] || "bg-slate-50 text-slate-500";

  return (
    <div
      onClick={onClick}
      onKeyDown={onClick ? (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      } : undefined}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? `${title}: ${value}` : undefined}
      className={`stats-card-animate group relative min-w-0 overflow-hidden rounded-xl border border-[#DDE5E8] bg-white p-4 shadow-[var(--shadow-panel)] transition-colors duration-200 sm:p-5 ${onClick ? "cursor-pointer hover:border-brand-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500" : ""}`}
    >
      <div className="relative mb-4 flex items-start justify-between gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconCls}`}>
          {icon}
        </div>
        {trend && (
          <span className="max-w-[60%] truncate rounded-md border border-[#E4E7EC] bg-[#F8FAFB] px-2 py-1 text-[10px] font-semibold text-[#667085]">
            {trend}
          </span>
        )}
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold text-[#667085] sm:text-[13px]">{title}</p>
        <p className="break-words text-[1.35rem] font-bold text-[#26313A] tabular-nums sm:text-[1.6rem]">
          {value}
        </p>
      </div>
    </div>
  );
}
