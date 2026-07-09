'use client';

import React, { useState, useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import {
  LayoutDashboard, Users, CreditCard, Building2, Calendar,
  Bell, HelpCircle, Settings, LogOut, X, Menu,
  TrendingUp, User
} from 'lucide-react';

interface NavItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  description?: string;
  views?: string[];
  action?: () => void;
}

interface FloatingExpandableSidebarProps {
  currentView: string;
  setCurrentView: Dispatch<SetStateAction<any>>;
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
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [localUser, setLocalUser] = useState<any>(null);

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
      views: ['details', 'evolution', 'resigned', 'stopped', 'no_meter'],
    },
    {
      id: 'financials',
      icon: <TrendingUp size={24} />,
      label: t('nav.financials'),
      description: 'Analyses financières',
      views: ['creance', 'repartition', 'commune', 'ventilation'],
    },
    {
      id: 'subscriberDebts',
      icon: <CreditCard size={24} />,
      label: t('nav.subscriberDebts'),
      description: 'Créances abonnés',
      views: ['creances_abonnes'],
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
      id: 'notifications',
      icon: <Bell size={24} />,
      label: t('nav.notifications'),
      description: 'Notifications',
    },
    {
      id: 'help',
      icon: <HelpCircle size={24} />,
      label: t('nav.helpCenter'),
      description: 'Centre d\'aide',
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
    if (item.action) {
      item.action();
    }
  };

  const isItemActive = (item: NavItem) => {
    return item.views?.includes(currentView) ?? false;
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-8 right-8 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-[#0D83DE] to-[#0066BB] text-white shadow-2xl transition-all duration-300 flex items-center justify-center hover:scale-110 active:scale-95 no-print ${
          isOpen ? 'rotate-90' : ''
        }`}
        aria-label="Toggle menu"
      >
        {isOpen ? <X size={28} /> : <Menu size={28} />}
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30 no-print"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Expandable Sidebar */}
      <div
        className={`fixed bottom-24 right-8 z-40 transition-all duration-300 ease-out transform no-print ${
          isOpen
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-4 flex flex-col gap-3 max-h-[calc(100vh-200px)] overflow-hidden">
          {/* Header with User Profile */}
          <div className="px-4 py-3 border-b border-[#E4E7EC]">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#0D83DE] to-[#0066BB] rounded-full flex items-center justify-center text-white font-bold">
                <User size={20} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-[#101828]">
                  {(() => {
                    const dn = (localUser?.display_name || '').trim();
                    const un = (localUser?.username || '').trim();
                    // If display_name is missing or generic like 'Administrateur'/'Admin', prefer username (capitalized)
                    if (!dn || /^(admin|administrateur)$/i.test(dn)) {
                      if (un) return un.charAt(0).toUpperCase() + un.slice(1);
                      return 'Utilisateur';
                    }
                    return dn;
                  })()}
                </p>
                <p className="text-xs text-[#667085]">
                  {localUser?.is_admin ? '👑 Admin' : '👤 User'}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="flex flex-col gap-2 max-h-[400px] overflow-y-auto scrollbar-hide">
            {navItems.map((item) => (
              <button
                key={item.id}
                onMouseEnter={() => setHoveredItem(item.id)}
                onMouseLeave={() => setHoveredItem(null)}
                onClick={() => handleNavClick(item)}
                className={`relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group cursor-pointer ${
                  isItemActive(item)
                    ? 'bg-[#0D83DE]/10 text-[#0D83DE] font-semibold'
                    : 'text-[#475467] hover:bg-[#F9FAFB]'
                }`}
              >
                {/* Icon Container */}
                <div
                  className={`flex-shrink-0 transition-all duration-200 ${
                    hoveredItem === item.id ? 'scale-125' : 'scale-100'
                  }`}
                >
                  {item.icon}
                </div>

                {/* Label & Description */}
                <div
                  className={`flex-1 text-left transition-all duration-200 ${
                    hoveredItem === item.id ? 'opacity-100' : 'opacity-75'
                  }`}
                >
                  <p className="text-sm font-semibold leading-tight">
                    {item.label}
                  </p>
                  {item.description && (
                    <p className="text-xs text-[#667085] leading-tight">
                      {item.description}
                    </p>
                  )}
                </div>

                {/* Active Indicator */}
                {isItemActive(item) && (
                  <span className="absolute left-0 top-2 bottom-2 w-1 rounded-full bg-[#0D83DE]" />
                )}
              </button>
            ))}
          </nav>

          {/* Divider */}
          <div className="h-px bg-[#E4E7EC]" />

          {/* Footer Actions */}
          <div className="flex flex-col gap-2 px-4 py-3">
            <button
              onClick={onLogout}
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold text-[#DC2626] hover:bg-red-50 transition-all duration-200"
            >
              <LogOut size={18} />
              <span>{t('nav.logout')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Hide scrollbar style */}
      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </>
  );
}
