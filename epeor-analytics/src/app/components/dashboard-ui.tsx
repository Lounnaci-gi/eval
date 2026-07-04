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
};

const iconBgMap: Record<string, string> = {
  blue:    "bg-blue-50   text-[#0D83DE]",
  rose:    "bg-rose-50   text-rose-500",
  amber:   "bg-amber-50  text-amber-500",
  cyan:    "bg-cyan-50   text-cyan-500",
  brand:   "bg-brand-50  text-brand-500",
  emerald: "bg-emerald-50 text-emerald-500",
  indigo:  "bg-indigo-50 text-indigo-500",
};

// ── StatsCard ────────────────────────────────────────────────────────────────

export function StatsCard({ title, value, icon, trend, color, onClick }: any) {
  const glow = glowMap[color] || glowMap.blue;
  const iconCls = iconBgMap[color] || "bg-slate-50 text-slate-500";

  return (
    <div
      onClick={onClick}
      className={`
        stats-card-animate
        relative overflow-hidden
        bg-white border border-[#E4E7EC]
        p-4 sm:p-6
        rounded-[1.25rem] sm:rounded-[2rem]
        shadow-sm
        transition-all duration-300 ease-out
        group
        min-w-0
        ${onClick ? "cursor-pointer" : ""}
      `}
      style={{
        background: "var(--glass-bg, #fff)",
        borderColor: "var(--glass-border, #E4E7EC)",
        boxShadow: "var(--glass-shadow)",
      }}
      onMouseEnter={e => {
        const el = e.currentTarget;
        el.style.boxShadow = `var(--glass-shadow-hover), 0 0 0 1px rgba(13,131,222,0.10)`;
        el.style.transform = "translateY(-3px)";
        el.style.borderColor = "rgba(13,131,222,0.20)";
      }}
      onMouseLeave={e => {
        const el = e.currentTarget;
        el.style.boxShadow = "var(--glass-shadow)";
        el.style.transform = "translateY(0)";
        el.style.borderColor = "var(--glass-border, #E4E7EC)";
      }}
    >
      {/* Subtle top-left gradient blob */}
      <div
        aria-hidden
        className="absolute -top-6 -left-6 w-24 h-24 rounded-full opacity-40 pointer-events-none"
        style={{ background: glow, filter: "blur(20px)" }}
      />

      <div className="relative flex justify-between items-start mb-6">
        {/* Icon with glow halo */}
        <div className="relative">
          <div
            className={`p-3.5 sm:p-4 rounded-2xl transition-transform duration-300 group-hover:scale-110 ${iconCls}`}
            style={{ boxShadow: `0 4px 16px ${glow}` }}
          >
            {icon}
          </div>
        </div>

        {/* Trend badge */}
        {trend && (
          <span className="text-[10px] font-black uppercase tracking-widest text-[#98A2B3] bg-[#F9FAFB] px-2 py-1 rounded-lg border border-[#F2F4F7]">
            {trend}
          </span>
        )}
      </div>

      <div className="relative">
        <p className="text-[#475467] text-xs sm:text-sm font-semibold mb-1 tracking-wide">{title}</p>
        <p className="text-xl sm:text-2xl font-black text-[#101828] tracking-tight break-words tabular-nums">
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

// ── NavItem ──────────────────────────────────────────────────────────────────

export function NavItem({ icon, label, active = false, onClick }: any) {
  return (
    <div
      onClick={onClick}
      className="relative flex h-12 min-h-12 flex-none items-center gap-3 px-4 py-0 rounded-2xl cursor-pointer transition-[background-color,box-shadow,color] duration-200 ease-out group overflow-hidden will-change-transform"
      style={{
        height: 48,
        minHeight: 48,
        ...(active ? {
          background: "linear-gradient(135deg, rgba(13,131,222,0.16) 0%, rgba(99,102,241,0.12) 100%)",
          color: "var(--sidebar-active-border)",
          boxShadow: "inset 0 0 0 1px rgba(13,131,222,0.16), 0 6px 18px rgba(13,131,222,0.08)",
        } : {}),
      }}
      onMouseEnter={e => {
        if (!active) {
          const target = e.currentTarget as HTMLElement;
          target.style.background = "var(--gradient-accent-soft)";
          target.style.transform = "translateX(0)";
          target.style.boxShadow = "none";
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          const target = e.currentTarget as HTMLElement;
          target.style.background = "transparent";
          target.style.transform = "translateX(0)";
          target.style.boxShadow = "none";
        }
      }}
    >
      {/* Active indicator: vertical bar on left */}
      {active && (
        <span
          aria-hidden
          className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full"
          style={{ background: "var(--gradient-accent)" }}
        />
      )}

      <span
        className="flex-none transition-colors duration-200 leading-none"
        style={{ color: active ? "var(--sidebar-active-border)" : "rgb(var(--color-text-secondary))" }}
      >
        {icon}
      </span>

      <span
        className={`min-w-0 flex-1 truncate text-sm leading-none transition-colors duration-200 tracking-[0.01em] ${active ? "font-bold" : "font-semibold"}`}
        style={{ color: active ? "rgb(var(--color-text-primary))" : "rgb(var(--color-text-secondary))" }}
      >
        {label}
      </span>

      {/* Active dot (right) */}
      {active && (
        <div
          className="ml-auto h-2 w-2 shrink-0 rounded-full"
          style={{ background: "var(--gradient-accent)", boxShadow: "0 0 6px var(--glow-blue)" }}
        />
      )}
    </div>
  );
}
