"use client";

export function StatsCard({ title, value, icon, trend, color, onClick }: any) {
  const colorMap: any = {
    blue: "bg-blue-50 text-[#0D83DE]",
    rose: "bg-rose-50 text-rose-600",
    amber: "bg-amber-50 text-amber-600",
    cyan: "bg-cyan-50 text-cyan-600",
    brand: "bg-brand-50 text-brand-600",
    emerald: "bg-emerald-50 text-emerald-600",
    indigo: "bg-slate-50 text-slate-600",
  };

  return (
    <div
      onClick={onClick}
      className={`bg-white border border-[#E4E7EC] p-4 sm:p-6 rounded-[1.25rem] sm:rounded-[2rem] shadow-sm hover:shadow-md hover:border-[#D0D5DD] transition-all group min-w-0 ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="flex justify-between items-start mb-6">
        <div className={`p-4 rounded-2xl transition-transform group-hover:scale-110 ${colorMap[color] || "bg-slate-50"}`}>
          {icon}
        </div>
        <span className="text-[11px] font-black uppercase tracking-widest text-[#98A2B3]">{trend}</span>
      </div>
      <div>
        <p className="text-[#475467] text-sm font-bold mb-1">{title}</p>
        <p className="text-xl sm:text-2xl font-black text-[#101828] tracking-tight break-words">{value}</p>
      </div>
    </div>
  );
}

export function NavItem({ icon, label, active = false, onClick }: any) {
  return (
    <div
      onClick={onClick}
      className={`
      flex items-center gap-3 px-4 py-3.5 rounded-2xl cursor-pointer transition-all
      ${active ? 'bg-blue-50 text-[#0D83DE] shadow-sm' : 'text-[#475467] hover:bg-[#F9FAFB] hover:text-[#101828]'}
    `}>
      <span className={active ? "text-[#0D83DE]" : ""}>{icon}</span>
      <span className={`font-bold text-sm ${active ? 'text-[#101828]' : ''}`}>{label}</span>
      {active && <div className="ml-auto w-1.5 h-1.5 bg-[#0D83DE] rounded-full"></div>}
    </div>
  );
}
