"use client";

// ── Glow colors per card variant ──────────────────────────────────────────────
const glowMap: Record<string, string> = {
  blue:    "var(--glow-blue,    rgba(13,131,222,0.18))",
  rose:    "var(--glow-rose,    rgba(244,63,94,0.18))",
  amber:   "var(--glow-amber,   rgba(245,158,11,0.18))",
  cyan:    "var(--glow-cyan,    rgba(6,182,212,0.18))",
  brand:   "var(--glow-blue,    rgba(13,131,222,0.18))",
  emerald: "var(--glow-emerald, rgba(16,185,129,0.18))",
  indigo:  "var(--glow-indigo,  rgba(99,102,241,0.18))",
  slate:   "rgba(100,116,139,0.16)",
};

const iconBgMap: Record<string, string> = {
  blue:    "bg-blue-50   text-[#0D83DE]",
  rose:    "bg-rose-50   text-rose-500",
  amber:   "bg-amber-50  text-amber-500",
  cyan:    "bg-cyan-50   text-cyan-500",
  brand:   "bg-brand-50  text-brand-500",
  emerald: "bg-emerald-50 text-emerald-500",
  indigo:  "bg-indigo-50 text-indigo-500",
  slate:   "bg-slate-100 text-[#475467]",
};

// ── StatsCard ────────────────────────────────────────────────────────────────

export function StatsCard({ title, value, icon, trend, color, onClick }: any) {
  const glow = glowMap[color] || glowMap.blue;
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
      className={`
        stats-card-animate
        obat-card
        relative overflow-hidden
        bg-white border border-[#E4E7EC]
        p-4 sm:p-5
        rounded-[1.35rem]
        shadow-sm
        transition-all duration-300 ease-out
        group
        min-w-0
        ${onClick ? "cursor-pointer hover:-translate-y-1 hover:shadow-lg active:translate-y-0 active:scale-[0.99]" : ""}
      `}
    >
      {/* Subtle top-left gradient blob */}
      <div
        aria-hidden
        className="absolute -top-6 -left-6 w-24 h-24 rounded-full opacity-40 pointer-events-none"
        style={{ background: glow, filter: "blur(20px)" }}
      />

      <div className="relative flex justify-between items-start mb-5">
        {/* Icon with glow halo */}
        <div className="relative">
          <div
            className={`p-3 rounded-[1.1rem] transition-transform duration-300 group-hover:scale-105 ${iconCls}`}
            style={{ boxShadow: `0 4px 16px ${glow}` }}
          >
            {icon}
          </div>
        </div>

        {/* Trend badge */}
        {trend && (
          <span className="max-w-[55%] truncate text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.12em] text-[#667085] bg-[#F9FAFB] px-2.5 py-1.5 rounded-full border border-[#F2F4F7]">
            {trend}
          </span>
        )}
      </div>

      <div className="relative">
        <p className="text-[#667085] text-xs sm:text-[13px] font-semibold mb-1.5 tracking-wide">{title}</p>
        <p className="text-[1.35rem] sm:text-[1.6rem] font-extrabold text-[#101828] tracking-tight break-words tabular-nums">
          {value}
        </p>
      </div>

      {/* Bottom gradient line (active indicator) */}
      <div
        aria-hidden
        className="absolute bottom-0 left-6 right-6 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: "var(--gradient-accent)" }}
      />
    </div>
  );
}
