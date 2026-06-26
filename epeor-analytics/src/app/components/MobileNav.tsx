"use client";

import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  BarChart3,
  CreditCard,
  Building2,
  Settings,
  Menu,
  X,
  Calendar,
  LogOut,
} from "lucide-react";
import Logo from "./Logo";

export type AppView =
  | "dashboard"
  | "details"
  | "evolution"
  | "resigned"
  | "stopped"
  | "no_meter"
  | "creance"
  | "repartition"
  | "commune"
  | "ventilation"
  | "bilan_activite"
  | "creances_abonnes"
  | "creances_institutions"
  | "settings";

type NavItem = {
  id: AppView;
  label: string;
  icon: typeof LayoutDashboard;
  match?: AppView[];
};

const BOTTOM_NAV: NavItem[] = [
  { id: "dashboard", label: "Accueil", icon: LayoutDashboard },
  {
    id: "details",
    label: "Abonnés",
    icon: Users,
    match: ["details", "evolution", "resigned", "stopped", "no_meter"],
  },
  {
    id: "creance",
    label: "Finances",
    icon: BarChart3,
    match: ["creance", "repartition", "commune", "ventilation", "bilan_activite"],
  },
  { id: "creances_abonnes", label: "Créances", icon: CreditCard },
];

const MORE_ITEMS: NavItem[] = [
  { id: "creances_institutions", label: "Créance institutions", icon: Building2 },
  { id: "settings", label: "Paramètres", icon: Settings },
];

function isActive(view: AppView, item: NavItem): boolean {
  if (item.match) return item.match.includes(view);
  return view === item.id;
}

export function MobileTopBar() {
  return (
    <header className="lg:hidden sticky top-0 z-40 flex items-center gap-3 border-b border-[#E4E7EC] bg-white/95 backdrop-blur-md px-4 py-3 safe-top no-print">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 p-1">
          <Logo variant="mobile" alt="EPEOR" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-black text-[#101828] truncate">EPEOR Analytics</p>
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#0D83DE]">Tableau de bord</p>
      </div>
    </header>
  );
}

export function MobileNav({
  currentView,
  onNavigate,
  onLogout,
  isAdmin = false,
}: {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  onLogout?: () => void;
  isAdmin?: boolean;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const visibleMoreItems = MORE_ITEMS.filter((item) => {
    if (item.id === "settings") return isAdmin;
    return true;
  });
  const moreActive = visibleMoreItems.some((item) => isActive(currentView, item));

  return (
    <>
      {moreOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] no-print"
          onClick={() => setMoreOpen(false)}
          aria-hidden
        />
      )}

      {moreOpen && (
        <div className="lg:hidden fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-4 right-4 z-50 bg-white border border-[#E4E7EC] rounded-2xl shadow-2xl p-2 animate-in fade-in slide-in-from-bottom-2 duration-200 no-print">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#F2F4F7] mb-1">
            <span className="text-xs font-black text-[#101828]">Autres sections</span>
            <button
              type="button"
              onClick={() => setMoreOpen(false)}
              className="p-1.5 rounded-lg hover:bg-[#F9FAFB] text-[#667085]"
              aria-label="Fermer"
            >
              <X size={16} />
            </button>
          </div>
          {visibleMoreItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(currentView, item);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onNavigate(item.id);
                  setMoreOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold transition-colors ${
                  active ? "bg-blue-50 text-[#0D83DE]" : "text-[#344054] hover:bg-[#F9FAFB]"
                }`}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
          <div className="px-3 py-2 mt-1 border-t border-[#F2F4F7]">
            <p className="text-[10px] text-[#98A2B3] font-medium flex items-center gap-1.5">
              <Calendar size={12} />
              Périodes de facturation — bientôt
            </p>
          </div>
          {onLogout && (
            <div className="px-2 pt-1 mt-1 border-t border-[#F2F4F7]">
              <button
                type="button"
                onClick={() => { onLogout(); setMoreOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold text-rose-600 hover:bg-rose-50 transition-colors"
              >
                <LogOut size={18} />
                Déconnexion
              </button>
            </div>
          )}
        </div>
      )}

      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-[#E4E7EC] bg-white/95 backdrop-blur-md safe-bottom no-print"
        aria-label="Navigation principale"
      >
        <div className="flex items-stretch justify-around px-1 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
          {BOTTOM_NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(currentView, item);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 px-1 min-w-0 rounded-xl transition-colors ${
                  active ? "text-[#0D83DE]" : "text-[#667085]"
                }`}
              >
                <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                <span className="text-[10px] font-black truncate max-w-full">{item.label}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen((o) => !o)}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 px-1 min-w-0 rounded-xl transition-colors ${
              moreActive || moreOpen ? "text-[#0D83DE]" : "text-[#667085]"
            }`}
          >
            <Menu size={20} strokeWidth={moreActive || moreOpen ? 2.5 : 2} />
            <span className="text-[10px] font-black">Plus</span>
          </button>
        </div>
      </nav>
    </>
  );
}
