"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import Swal from "sweetalert2";
import "../../lib/i18n";
import {
  LayoutDashboard,
  Users,
  BarChart3,
  CreditCard,
  ListChecks,
  Building2,
  Settings,
  Menu,
  X,
  Calendar,
  LogOut,
  Search,
} from "lucide-react";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";
import LanguageSwitcher from "./LanguageSwitcher";
import type { AppView } from "./app-view";

export type { AppView };

type NavItem = {
  id: AppView;
  labelKey: string;
  icon: typeof LayoutDashboard;
  match?: AppView[];
};

const BOTTOM_NAV: NavItem[] = [
  { id: "dashboard",         labelKey: "nav.dashboard",        icon: LayoutDashboard },
  { id: "details",           labelKey: "nav.subscribers",      icon: Users,     match: ["details", "evolution", "resigned", "stopped", "no_meter", "unconnected", "terrain", "institutions"] },
  { id: "creance",           labelKey: "nav.financials",       icon: BarChart3, match: ["creance", "repartition", "commune", "ventilation", "bilan_activite", "bilan_activite_commercial"] },
  { id: "creances_abonnes",  labelKey: "nav.subscriberDebts",  icon: CreditCard },
];

const MORE_ITEMS: NavItem[] = [
  { id: "recovery_queue", labelKey: "nav.recoveryQueue", icon: ListChecks },
  { id: "creances_institutions", labelKey: "nav.institutionDebts", icon: Building2 },
  { id: "service_contentieux",  labelKey: "nav.billingPeriods",    icon: Calendar },
  { id: "settings",             labelKey: "nav.settings",          icon: Settings },
];

function isActive(view: AppView, item: NavItem): boolean {
  if (item.match) return item.match.includes(view);
  return view === item.id;
}

export function MobileTopBar() {
  const { t } = useTranslation();
  return (
    <header className="mobile-topbar lg:hidden sticky top-0 z-40 flex items-center gap-3 border-b border-[#E4E7EC] bg-white/95 backdrop-blur-md px-4 py-3 safe-top no-print">
        <Logo variant="mobile" alt="Logo de l'Algérienne des Eaux" className="shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black text-[#101828] truncate">EPEOR Analytics</p>
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#245A83]">{t('nav.dashboard')}</p>
      </div>
        <button
          type="button"
          aria-label={t('command.open')}
          title={t('command.open')}
          onClick={() => window.dispatchEvent(new Event('epeor:open-command-palette'))}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#DDE5E8] text-[#56636D] transition-colors hover:bg-[#F3F6F7] focus-visible:outline-2 focus-visible:outline-brand-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Search size={18} />
        </button>
    </header>
  );
}

export function MobileNav({
  currentView,
  onNavigate,
  onLogout,
}: {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  onLogout?: () => void;
}) {
  const { t } = useTranslation();
  const [moreOpen, setMoreOpen] = useState(false);
  const visibleMoreItems = MORE_ITEMS;
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
        <div id="mobile-more-menu" className="mobile-more-menu lg:hidden fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] inset-x-4 z-50 bg-white border border-[#E4E7EC] rounded-xl shadow-2xl p-2 animate-in fade-in slide-in-from-bottom-2 duration-200 no-print">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#F2F4F7] mb-1">
            <span className="text-xs font-black text-[#101828]">{t('nav.more', 'Autres sections')}</span>
            <button
              type="button"
              onClick={() => setMoreOpen(false)}
              className="p-1.5 rounded-lg hover:bg-[#F9FAFB] text-[#667085]"
              aria-label={t('nav.close', 'Fermer')}
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
                  active ? "bg-brand-50 text-brand-700" : "text-[#344054] hover:bg-[#F9FAFB]"
                }`}
              >
                <Icon size={18} />
                {t(item.labelKey)}
              </button>
            );
          })}
          <div className="px-2 py-1">
            <ThemeToggle />
          </div>
          <div className="px-2 py-1">
            <LanguageSwitcher />
          </div>

          {onLogout && (
            <div className="px-2 pt-1 mt-1 border-t border-[#F2F4F7]">
              <button
                type="button"
                onClick={async () => {
                  const result = await Swal.fire({
                    title: t('nav.logout'),
                    text: t('logout.confirm', 'Êtes-vous sûr de vouloir vous déconnecter ?'),
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#245A83',
                    cancelButtonColor: '#6B7280',
                    confirmButtonText: t('common.yes', 'Oui'),
                    cancelButtonText: t('common.no', 'Non'),
                    allowOutsideClick: false,
                    allowEscapeKey: false,
                  });
                  if (result.isConfirmed) {
                    onLogout();
                    setMoreOpen(false);
                  }
                }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold text-rose-600 hover:bg-rose-50 transition-colors"
              >
                <LogOut size={18} />
                {t('nav.logout')}
              </button>
            </div>
          )}
        </div>
      )}

      <nav
        className="mobile-bottom-nav lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-[#E4E7EC] bg-white/95 backdrop-blur-md safe-bottom no-print"
        aria-label={t('nav.mainNav', 'Navigation principale')}
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
                  active ? "text-[#245A83]" : "text-[#667085]"
                }`}
              >
                <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                <span className="text-[10px] font-black truncate max-w-full">{t(item.labelKey)}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen((o) => !o)}
              aria-expanded={moreOpen}
              aria-controls="mobile-more-menu"
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 px-1 min-w-0 rounded-xl transition-colors ${
              moreActive || moreOpen ? "text-[#245A83]" : "text-[#667085]"
            }`}
          >
            <Menu size={20} strokeWidth={moreActive || moreOpen ? 2.5 : 2} />
            <span className="text-[10px] font-black">{t('nav.more', 'Plus')}</span>
          </button>
        </div>
      </nav>
    </>
  );
}
