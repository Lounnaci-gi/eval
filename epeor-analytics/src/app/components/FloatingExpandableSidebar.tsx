'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import {
  LayoutDashboard, Users, CreditCard, Building2, Calendar, ListChecks,
  Settings, LogOut, X, Menu,
  TrendingUp, User, ShieldCheck
} from 'lucide-react';
import type { AppView } from './app-view';
import ThemeToggle from './ThemeToggle';
import Logo from './Logo';

interface NavItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  description?: string;
  views?: AppView[];
}

interface FloatingExpandableSidebarProps {
  currentView: AppView;
  setCurrentView: Dispatch<SetStateAction<AppView>>;
  user: any;
  onLogout: () => void;
  t: (key: string) => string;
}

export function FloatingExpandableSidebar({
  currentView,
  setCurrentView,
  user,
  onLogout,
  t
}: FloatingExpandableSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localUser, setLocalUser] = useState<any>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    // If parent didn't provide user prop (or it's null), try fetching current user.
    if (user) {
      setLocalUser(user);
      return;
    }
    let cancelled = false;
    import('../lib/api').then(({ apiUrl }) => {
      fetch(apiUrl('/api/auth/me'), { credentials: 'include' })
        .then((r) => {
          if (!r.ok) throw new Error('not auth');
          return r.json();
        })
        .then((data) => {
          if (cancelled) return;
          setLocalUser({
            username: data.username,
            display_name: data.display_name,
            is_admin: !!data.is_admin,
          });
        })
        .catch(() => {})
        .finally(() => {});
    });
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        requestAnimationFrame(() => toggleRef.current?.focus());
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const navItems: NavItem[] = [
    {
      id: 'dashboard',
      icon: <LayoutDashboard size={24} />,
      label: t('nav.dashboard'),
      description: 'Vue d\'ensemble',
      views: ['dashboard'],
    },
    {
      id: 'subscribers',
      icon: <Users size={24} />,
      label: t('nav.subscribers'),
      description: 'Gestion abonnés',
      views: ['details', 'evolution', 'resigned', 'stopped', 'no_meter', 'unconnected', 'terrain', 'institutions'],
    },
    {
      id: 'financials',
      icon: <TrendingUp size={24} />,
      label: t('nav.financials'),
      description: 'Analyses financières',
      views: ['creance', 'repartition', 'commune', 'ventilation', 'bilan_activite', 'bilan_activite_commercial'],
    },
    {
      id: 'subscriberDebts',
      icon: <CreditCard size={24} />,
      label: t('nav.subscriberDebts'),
      description: 'Créances abonnés',
      views: ['creances_abonnes'],
    },
    {
      id: 'recoveryQueue',
      icon: <ListChecks size={24} />,
      label: t('nav.recoveryQueue'),
      description: 'Priorités de recouvrement',
      views: ['recovery_queue'],
    },
    {
      id: 'institutionDebts',
      icon: <Building2 size={24} />,
      label: t('nav.institutionDebts'),
      description: 'Créances institutions',
      views: ['creances_institutions'],
    },
    {
      id: 'billingPeriods',
      icon: <Calendar size={24} />,
      label: t('nav.billingPeriods'),
      description: 'Service contentieux',
      views: ['service_contentieux'],
    },
    {
      id: 'settings',
      icon: <Settings size={24} />,
      label: t('nav.settings'),
      description: 'Paramètres',
      views: ['settings'],
    },
  ];

  const handleNavClick = (item: NavItem) => {
    if (item.views && item.views.length > 0) {
      setCurrentView(item.views[0]);
      setIsOpen(false);
    }
  };

  const isItemActive = (item: NavItem) => {
    return item.views?.includes(currentView) ?? false;
  };

  return (
    <div className="no-print hidden lg:block">
      <button
        ref={toggleRef}
        type="button"
        aria-label={isOpen ? t('nav.close') : t('nav.mainNav')}
        aria-expanded={isOpen}
        aria-controls="desktop-navigation"
        onClick={() => setIsOpen((open) => !open)}
        className="fixed bottom-6 end-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-white shadow-[var(--shadow-feature)] transition-colors hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
      >
        {isOpen ? <X size={21} /> : <Menu size={21} />}
      </button>

      {isOpen && (
        <>
          <button
            type="button"
            aria-label={t('nav.close')}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 z-30 cursor-default bg-[#26313A]/25 backdrop-blur-[1px]"
          />
          <aside
            id="desktop-navigation"
            data-testid="desktop-navigation"
            className="sidebar-premium floating-sidebar fixed bottom-24 end-6 z-40 flex max-h-[calc(100dvh-7rem)] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl shadow-[var(--shadow-feature)]"
          >
            <div className="sidebar-header border-b px-5 py-4">
              <Logo variant="sidebar" alt="Logo de l'Algérienne des Eaux" />
              <div className="mt-2">
                <p className="truncate text-sm font-bold text-[#26313A] dark:text-slate-100">EPEOR Analytics</p>
                <p className="text-xs text-[#66757C] dark:text-slate-400">Lecture de données</p>
              </div>
            </div>

            <div className="border-b border-[#E4E7EC] px-4 py-4 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-slate-700 dark:text-slate-100">
                  {localUser?.is_admin ? <ShieldCheck size={18} /> : <User size={18} />}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#26313A] dark:text-slate-100">
                    {(() => {
                      const displayName = (localUser?.display_name || '').trim();
                      const username = (localUser?.username || '').trim();
                      if (!displayName || /^(admin|administrateur)$/i.test(displayName)) {
                        return username ? username.charAt(0).toUpperCase() + username.slice(1) : 'Utilisateur';
                      }
                      return displayName;
                    })()}
                  </p>
                  <p className="text-xs text-[#66757C] dark:text-slate-400">
                    {localUser?.is_admin ? 'Administrateur' : 'Agent'}
                  </p>
                </div>
              </div>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label={t('nav.mainNav')}>
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item)}
                  aria-current={isItemActive(item) ? 'page' : undefined}
                  className={`relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-start transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${
                    isItemActive(item)
                      ? 'bg-[var(--sidebar-active-bg)] font-semibold text-brand-700 dark:text-slate-100'
                      : 'text-[#56636D] hover:bg-black/[0.035] dark:text-slate-300 dark:hover:bg-white/[0.06]'
                  }`}
                >
                  <span className="shrink-0">{item.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] leading-5">{item.label}</span>
                    {item.description && <span className="block truncate text-[11px] font-normal opacity-70">{item.description}</span>}
                  </span>
                  {isItemActive(item) && <span className="absolute inset-y-2 start-0 w-1 rounded-e-full bg-[var(--sidebar-active-border)]" />}
                </button>
              ))}
            </nav>

            <div className="space-y-2 border-t border-[#E4E7EC] px-3 py-3 dark:border-slate-700">
              <ThemeToggle />
              <button
                type="button"
                onClick={onLogout}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-[#B42318] transition-colors hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 dark:text-rose-300 dark:hover:bg-rose-950/30"
              >
                <LogOut size={18} />
                <span>{t('nav.logout')}</span>
              </button>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
