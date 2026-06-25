"use client";

if (typeof window !== "undefined") {
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    if (
      args[0] &&
      typeof args[0] === "string" &&
      args[0].includes("width(-1) and height(-1) of chart should be greater than 0")
    ) {
      return;
    }
    originalWarn(...args);
  };
}


import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  Users, UserX, TimerOff, Ban, CreditCard, TrendingUp, Settings, LogOut, User, Lock, ArrowRight,
  LayoutDashboard, Database, BarChart3, Calendar, ChevronRight, Bell, HelpCircle, Building2, Percent,
} from "lucide-react";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList,
} from "recharts";
import { apiUrl } from "../lib/api";
import {
  sanitizeUserFacingMessage,
  isBackendConnectionError,
  isDataPathConfigurationRequired,
  formatPeriodLabel,
  ChartContainer,
  type DataPathInfo,
} from "./utils";
import { SecteurDropdown } from "./ui";
import { StatsCard, NavItem } from "./dashboard-ui";
import { SettingsView } from "./SettingsView";
import { MobileNav, MobileTopBar, type AppView } from "./MobileNav";
import { ScrollableTabs, ScrollableTab } from "./ScrollableTabs";

const viewLoader = (
  <div className="p-12 flex justify-center">
    <div className="w-8 h-8 border-4 border-brand-100 border-t-brand-600 rounded-full animate-spin" />
  </div>
);


const GestionAbonnesShell = dynamic(
  () => import("./SubscriberViews").then((m) => ({ default: m.GestionAbonnesShell })),
  { loading: () => viewLoader }
);
const CreancesAbonnesView = dynamic(
  () => import("./CreancesAbonnesView").then((m) => ({ default: m.CreancesAbonnesView })),
  { loading: () => viewLoader }
);
const CreancesInstitutionsView = dynamic(
  () => import("./InstitutionsView").then((m) => ({ default: m.CreancesInstitutionsView })),
  { loading: () => viewLoader }
);
const CreanceDetailView = dynamic(
  () => import("./CreanceViews").then((m) => ({ default: m.CreanceDetailView })),
  { loading: () => viewLoader }
);
const CreanceVentilationView = dynamic(
  () => import("./ReportsViews").then((m) => ({ default: m.CreanceVentilationView })),
  { loading: () => viewLoader }
);
const CreanceRepartitionView = dynamic(
  () => import("./ReportsViews").then((m) => ({ default: m.CreanceRepartitionView })),
  { loading: () => viewLoader }
);
const CreanceCommuneView = dynamic(
  () => import("./ReportsViews").then((m) => ({ default: m.CreanceCommuneView })),
  { loading: () => viewLoader }
);
const BilanActiviteView = dynamic(
  () => import("./ReportsViews").then((m) => ({ default: m.BilanActiviteView })),
  { loading: () => viewLoader }
);

export default function Dashboard() {
  const [currentView, setCurrentView] = useState<'dashboard' | 'details' | 'evolution' | 'resigned' | 'stopped' | 'no_meter' | 'creance' | 'repartition' | 'commune' | 'ventilation' | 'bilan_activite' | 'creances_abonnes' | 'creances_institutions' | 'settings'>('dashboard');
  const [showChartGuide, setShowChartGuide] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [creanceData, setCreanceData] = useState<any>(null);
  const [ventilationData, setVentilationData] = useState<any[]>([]);
  const [lastVentDate, setLastVentDate] = useState('');
  const [ventilationFilter, setVentilationFilter] = useState<'ALL' | 'EAU' | 'PRESTATIONS'>('ALL');
  const [repartitionFilter, setRepartitionFilter] = useState<'ALL' | 'EAU' | 'PRESTATIONS'>('ALL');
  const [calcDateRange, setCalcDateRange] = useState<{start: string, end: string}>({start: '', end: ''});
  const [reloadPending, setReloadPending] = useState(false);
  // Secteur/centre filter
  const [selectedSecteur, setSelectedSecteur] = useState('');
  const [sectors, setSectors] = useState<{ code: string; libelle: string }[]>([]);
  const [uniteLabel, setUniteLabel] = useState('');
  const [sectorsLoading, setSectorsLoading] = useState(false);
  const [dataPathInfo, setDataPathInfo] = useState<DataPathInfo | null>(null);
  const [backendReachable, setBackendReachable] = useState(false);
  const [showDataPathSetup, setShowDataPathSetup] = useState(false);
  const [user, setUser] = useState<{
    username: string;
    display_name: string;
    is_admin: boolean;
    auth_enabled: boolean;
  } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginPending, setLoginPending] = useState(false);
  const [loginRemainingAttempts, setLoginRemainingAttempts] = useState<number | null>(null);
  const [loginRetryAfter, setLoginRetryAfter] = useState<number | null>(null);
  const [loginCountdown, setLoginCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (loginCountdown === null || loginCountdown <= 0) {
      return;
    }
    const interval = setInterval(() => {
      setLoginCountdown((prev) => {
        if (prev === null) return null;
        const newVal = prev > 0 ? prev - 1 : 0;
        return newVal;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [loginCountdown]);

  useEffect(() => {
    if (loginCountdown === 0 && loginCountdown !== null) {
      const timer = setTimeout(() => {
        setLoginError(null);
        setLoginRemainingAttempts(null);
        setLoginRetryAfter(null);
        setLoginCountdown(null);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [loginCountdown]);

  const loadSectors = async () => {
    setSectorsLoading(true);
    try {
      const res = await fetch(apiUrl('/api/unites_settings'), { credentials: 'include' });
      const data = await res.json();
      if (data?.error) return;
      if (!Array.isArray(data) || data.length === 0) return;
      const unite = data.find((u: any) => (u.sectors?.length ?? 0) > 0) ?? data[0];
      setUniteLabel(String(unite.denom || '').trim());
      const list = (unite.sectors || [])
        .map((s: any) => ({
          code: String(s.code ?? '').trim(),
          libelle: String(s.libelle ?? '').trim(),
        }))
        .filter((s: { code: string }) => s.code);
      setSectors(list);
    } catch {
      /* backend indisponible */
    } finally {
      setSectorsLoading(false);
    }
  };

  // Les centres viennent de TABCODE : disponibles seulement après chargement DBF (pas au 1er fetch)
  useEffect(() => {
    if (stats?.ready) {
      loadSectors();
    }
  }, [stats?.ready]);

  const requestDataReload = async () => {
    setReloadPending(true);
    setStats({ status: 'loading', message: 'Rechargement des données en cours…', ready: false });
    try {
      await fetch(apiUrl('/api/reload_data'), { method: 'POST', credentials: 'include' });
    } catch {
      setStats({ status: 'error', message: 'Impossible de joindre le backend pour le rechargement.', ready: false });
    } finally {
      setReloadPending(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(apiUrl('/api/auth/logout'), { method: 'POST', credentials: 'include' });
    } catch (err) {
      console.error('Erreur logout', err);
    } finally {
      setUser(null);
      setAuthChecked(true);
      setLoginPassword('');
    }
  };

  useEffect(() => {
    let cancelled = false;

    const checkAuth = async () => {
      try {
        const res = await fetch(apiUrl('/api/auth/me'), { credentials: 'include' });
        if (cancelled) return;
        if (res.status === 401) {
          setBackendReachable(true);
          setUser(null);
          setAuthChecked(true);
          return;
        }
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        setUser({
          username: data.username,
          display_name: data.display_name || data.username,
          is_admin: !!data.is_admin,
          auth_enabled: !!data.auth_enabled,
        });
        setBackendReachable(true);
        setAuthChecked(true);
      } catch (err) {
        if (cancelled) return;
        setBackendReachable(false);
        setAuthChecked(true);
        setUser(null);
        console.error('Erreur d’authentification :', err);
      }
    };

    checkAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!authChecked || user === null) {
      return;
    }

    let intervalId: ReturnType<typeof setInterval> | null = null;
    let pollDelayMs = 2000;
    let cancelled = false;

    const checkDataPath = () => {
      fetch(apiUrl("/api/data_dir"), { credentials: 'include' })
        .then((res) => {
          if (!res.ok) throw new Error("Erreur réseau");
          return res.json();
        })
        .then((data) => {
          if (cancelled) return;
          setBackendReachable(true);
          setDataPathInfo(data);
        })
        .catch(() => {
          /* backend indisponible */
        });
    };

    const schedulePoll = () => {
      if (intervalId) clearInterval(intervalId);
      intervalId = setInterval(checkStats, pollDelayMs);
      pollDelayMs = Math.min(pollDelayMs + 1000, 5000);
    };

    const checkStats = () => {
      checkDataPath();
      fetch(apiUrl("/stats"), { credentials: 'include' })
        .then((res) => {
          // 401 = backend joignable mais authentification requise
          if (res.status === 401) {
            if (!cancelled) setBackendReachable(true);
            return null;
          }
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
          }
          return res.json();
        })
        .then((data) => {
          if (cancelled || data === null) return;
          setBackendReachable(true);
          if (data?.error || data?.status === 'error') {
            setStats({
              ...data,
              error: data.error || data.message || "Données indisponibles",
              ready: false,
            });
          } else {
            setStats(data);
          }
          if (data?.ready === true && !data?.error) {
            if (intervalId) {
              clearInterval(intervalId);
              intervalId = null;
            }
          } else if (data && (data.status === 'loading' || data.ready === false)) {
            if (!intervalId) schedulePoll();
          }
        })
        .catch((err) => {
          if (cancelled) return;
          console.error("Erreur de chargement des stats:", err);
          setStats({ error: "Impossible de contacter le serveur backend (Port 8000)" });
          if (!intervalId) schedulePoll();
        });
    };

    checkStats();

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [authChecked, user]);

  const needsDataPathConfig = isDataPathConfigurationRequired(
    stats,
    dataPathInfo,
    backendReachable
  );

  const totalSubs = stats?.total_subscribers || 0;
  const targetSubs = (stats?.stopped_subscribers || 0) + (stats?.no_meter_subscribers || 0);
  const pctCpt2030 = totalSubs > 0 ? (targetSubs / totalSubs) * 100 : 0;

  if (stats?.error && isBackendConnectionError(stats)) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center p-8">
        <div className="bg-white border border-rose-100 shadow-2xl rounded-2xl sm:rounded-[3rem] p-6 sm:p-16 flex flex-col items-center gap-6 max-w-md w-full text-center mx-4">
          <Ban size={48} className="text-rose-500" />
          <h1 className="text-2xl font-black text-[#101828]">Connexion impossible</h1>
          <p className="text-sm text-[#475467] font-medium">{stats.error}</p>
          <p className="text-xs text-[#98A2B3]">Démarrez le backend : port 8000 (voir start.bat ou README)</p>
        </div>
      </div>
    );
  }

  if (authChecked && user === null && backendReachable) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center p-8">
        <div className="w-full max-w-md bg-white border border-[#E4E7EC] shadow-2xl rounded-[2rem] p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-[#0D83DE] text-white flex items-center justify-center">
              <Lock size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-[#101828]">Connexion requise</h1>
              <p className="text-sm text-[#475467] mt-1">Veuillez vous connecter pour accéder au tableau de bord EPEOR.</p>
            </div>
          </div>

          {(loginError || loginRemainingAttempts !== null || loginRetryAfter !== null) && (
            <div className="mb-6 rounded-[1.5rem] bg-gradient-to-br from-rose-50 to-red-50 border-2 border-rose-200 p-6 space-y-4">
              {loginError && (
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-200">
                      <span className="text-rose-700 font-black">!</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-rose-900">{loginError}</p>
                  </div>
                </div>
              )}

              {loginRemainingAttempts !== null && loginRemainingAttempts > 0 && (
                <div className="space-y-3 pt-2 border-t border-rose-200">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-black uppercase tracking-wider text-rose-800">Tentatives restantes</p>
                    <p className="text-xl font-black text-rose-700">{loginRemainingAttempts} / 3</p>
                  </div>
                  <div className="flex gap-2">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`flex-1 h-2 rounded-full transition-all ${
                          i <= loginRemainingAttempts
                            ? 'bg-emerald-400'
                            : 'bg-rose-300'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}

              {loginCountdown !== null && loginCountdown > 0 && (
                <div className="space-y-3 pt-2 border-t border-rose-200">
                  <div className="flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-xs font-black uppercase tracking-wider text-rose-800 mb-2">Compte à rebours</p>
                      <div className="text-4xl font-black text-rose-700 font-mono tracking-tighter">
                        {String(Math.floor(loginCountdown / 60)).padStart(2, '0')}:{String(loginCountdown % 60).padStart(2, '0')}
                      </div>
                    </div>
                  </div>
                  <div className="w-full bg-rose-200 rounded-full h-1 overflow-hidden">
                    <div
                      className="bg-rose-600 h-full transition-all duration-1000 ease-linear"
                      style={{ width: `${((600 - loginCountdown) / 600) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-rose-700 text-center font-medium">Veuillez attendre avant de réessayer</p>
                </div>
              )}
            </div>
          )}

          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setLoginPending(true);
              setLoginError(null);
              setLoginRemainingAttempts(null);
              setLoginRetryAfter(null);
              setLoginCountdown(null);
              try {
                const res = await fetch(apiUrl('/api/auth/login'), {
                  method: 'POST',
                  credentials: 'include',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ username: loginUsername.trim(), password: loginPassword }),
                });
                if (!res.ok) {
                  const errorJson = await res.json().catch(() => null);
                  const errorMsg = errorJson?.detail || 'Erreur inconnue';
                  
                  if (res.status === 401) {
                    setLoginError(errorMsg);
                    const remainingMatch = String(errorMsg).match(/Tentatives restantes:\s*(\d+)/i);
                    if (remainingMatch) {
                      setLoginRemainingAttempts(Number(remainingMatch[1]));
                    }
                  } else if (res.status === 429) {
                    setLoginError(errorMsg);
                    const retryAfterMatch = String(errorMsg).match(/Retry-After:\s*(\d+)/i);
                    if (retryAfterMatch) {
                      const retryAfter = Number(retryAfterMatch[1]);
                      setLoginRetryAfter(retryAfter);
                      setLoginCountdown(retryAfter);
                    }
                  } else {
                    setLoginError('Échec de la connexion. Vérifiez le backend et réessayez.');
                  }
                  return;
                }
                const loginData = await res.json();
                const meRes = await fetch(apiUrl('/api/auth/me'), { credentials: 'include' });
                if (!meRes.ok) {
                  throw new Error('Impossible de récupérer les informations de session');
                }
                const userData = await meRes.json();
                setUser({
                  username: userData.username,
                  display_name: userData.display_name || userData.username,
                  is_admin: !!userData.is_admin,
                  auth_enabled: !!userData.auth_enabled,
                });
                setLoginPassword('');
                setLoginError(null);
                setLoginRemainingAttempts(null);
                setLoginRetryAfter(null);
                setLoginCountdown(null);
                setAuthChecked(true);
            } catch (err) {
                setLoginError('Impossible de contacter le serveur backend.');
              } finally {
                setLoginPending(false);
              }
            }}
            className="space-y-4"
          >
            <label className="block text-sm font-bold text-[#344054]">
              <span className="text-xs uppercase tracking-[0.18em] text-[#98A2B3]">Nom d'utilisateur</span>
              <input
                type="text"
                value={loginUsername}
                onChange={(event) => setLoginUsername(event.target.value)}
                disabled={loginCountdown !== null && loginCountdown > 0}
                className="mt-2 w-full rounded-2xl border border-[#D0D5DD] bg-[#F9FAFB] px-4 py-3 text-sm font-bold text-[#101828] outline-none focus:border-[#0D83DE] focus:ring-4 focus:ring-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
                autoComplete="username"
                required
              />
            </label>
            <label className="block text-sm font-bold text-[#344054]">
              <span className="text-xs uppercase tracking-[0.18em] text-[#98A2B3]">Mot de passe</span>
              <input
                type="password"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                disabled={loginCountdown !== null && loginCountdown > 0}
                className="mt-2 w-full rounded-2xl border border-[#D0D5DD] bg-[#F9FAFB] px-4 py-3 text-sm font-bold text-[#101828] outline-none focus:border-[#0D83DE] focus:ring-4 focus:ring-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
                autoComplete="current-password"
                required
              />
            </label>
            <button
              type="submit"
              disabled={loginPending || (loginCountdown !== null && loginCountdown > 0)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 px-5 py-3 text-sm font-black text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loginPending ? 'Connexion…' : loginCountdown !== null && loginCountdown > 0 ? 'Compte à rebours en cours…' : 'Se connecter'}
              {loginPending || (loginCountdown !== null && loginCountdown > 0) ? null : <ArrowRight size={16} />}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (needsDataPathConfig || showDataPathSetup) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] text-[#101828]">
        <div className="border-b border-[#E4E7EC] bg-white shadow-sm">
          <div className="max-w-4xl mx-auto px-6 py-5 flex items-center gap-4">
            <div className="w-11 h-11 bg-[#0D83DE] rounded-2xl flex items-center justify-center text-white font-black text-sm">
              E
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight">EPEOR Analytics</h1>
              <p className="text-xs text-[#667085] font-medium">Configuration du dossier de données requise</p>
            </div>
          </div>
        </div>
        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
          <div className="mb-8 p-6 bg-amber-50 border border-amber-200 rounded-[2rem] text-sm text-amber-950">
            <p className="font-black mb-1">Dossier de données introuvable ou incomplet</p>
            <p className="font-medium text-amber-900/90">
              {sanitizeUserFacingMessage(dataPathInfo?.diagnostic || stats?.message || stats?.error) ||
                "Indiquez le chemin du dossier contenant les fichiers de données EPEOR, puis appliquez le changement."}
            </p>
            {dataPathInfo?.data_dir && (
              <p className="mt-3 text-xs font-mono text-amber-800/80 bg-white/60 px-3 py-2 rounded-lg border border-amber-100">
                Chemin actuel : {dataPathInfo.data_dir}
              </p>
            )}
          </div>
          <SettingsView
            setupMode
            showBack={showDataPathSetup}
            onBack={() => setShowDataPathSetup(false)}
            onConfigured={() => window.location.reload()}
          />
        </main>
      </div>
    );
  }

  const isInitBlocked =
    !stats ||
    stats.status === 'loading' ||
    stats.ready === false ||
    (stats.ready === true && stats.total_subscribers === 0 && !stats.subscriber_types?.length);

  if (isInitBlocked) {
    const isLoadError =
      stats?.status === 'error' ||
      (typeof stats?.message === 'string' && stats.message.includes('Aucune donnée chargée'));

    return (
      <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center p-8">
        <div className="bg-white border border-[#E4E7EC] shadow-2xl rounded-2xl sm:rounded-[3rem] p-6 sm:p-16 flex flex-col items-center gap-8 max-w-lg w-full text-center mx-4">
          {!isLoadError && (
            <div className="relative">
              <div className="animate-spin rounded-full h-24 w-24 border-4 border-brand-100 border-t-brand-600"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] font-black text-brand-600 uppercase tracking-widest animate-pulse">EPEOR</span>
              </div>
            </div>
          )}
          {isLoadError && <Ban size={48} className="text-amber-500" />}
          <div className="space-y-4">
            <h1 className="text-2xl font-black text-[#101828] tracking-tight">
              {isLoadError ? 'Chargement des données impossible' : 'Initialisation du Système'}
            </h1>
            <p className="text-sm text-[#475467] font-medium min-h-[40px] flex items-center justify-center text-left w-full">
              {sanitizeUserFacingMessage(stats?.message || stats?.error) || 'Connexion au serveur backend...'}
            </p>
            {stats?.data_dir && (
              <p className="text-xs text-[#98A2B3] font-mono bg-[#F9FAFB] px-3 py-2 rounded-lg border border-[#E4E7EC]">
                Dossier : {stats.data_dir}
              </p>
            )}
          </div>
          {!isLoadError && (
            <>
              <div className="w-full bg-[#F2F4F7] rounded-full h-1.5 overflow-hidden">
                <div className="bg-brand-600 h-full animate-pulse w-full rounded-full"></div>
              </div>
              <p className="text-[10px] font-bold text-[#98A2B3] uppercase tracking-wider">
                Reconstitution du cache (1 à 2 minutes la première fois, ~30 s ensuite)
              </p>
            </>
          )}
          <div className="flex flex-col gap-3 w-full">
            <button
              type="button"
              onClick={requestDataReload}
              disabled={reloadPending}
              className="w-full px-6 py-3 bg-brand-600 text-white rounded-2xl text-sm font-black hover:bg-brand-700 disabled:opacity-50 transition-all"
            >
              {reloadPending ? 'Rechargement…' : 'Relancer le chargement des données'}
            </button>
            {backendReachable && (
              <button
                type="button"
                onClick={() => setShowDataPathSetup(true)}
                className="w-full px-6 py-3 bg-white border border-[#D0D5DD] text-[#344054] rounded-2xl text-sm font-black hover:bg-[#F9FAFB] transition-all"
              >
                Configurer le dossier de données
              </button>
            )}
            <p className="text-[10px] text-[#98A2B3]">
              Ou fermez « EPEOR Backend » et relancez start.bat — vérifiez le dossier de données (variable EPEOR_DATA_DIR)
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen min-h-[100dvh] bg-[#F9FAFB] text-[#101828] relative">
      {/* Sidebar — desktop / large tablet landscape */}
      <aside className="w-72 bg-white border-r border-[#E4E7EC] p-6 flex flex-col gap-10 hidden lg:flex shrink-0 no-print no-print-charts-only">
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 bg-[#0D83DE] rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
            <Database className="text-white" size={24} />
          </div>
          <div>
            <span className="text-xl font-extrabold tracking-tight text-[#101828]">EPEOR</span>
            <span className="block text-[10px] uppercase tracking-widest font-bold text-[#0D83DE]">Analytics Pro</span>
          </div>
        </div>

        <nav className="flex flex-col gap-1">
          <NavItem
            icon={<LayoutDashboard size={20} />}
            label="Tableau de bord"
            active={currentView === 'dashboard'}
            onClick={() => setCurrentView('dashboard')}
          />
          <NavItem
            icon={<Users size={20} />}
            label="Gestion Abonnés"
            active={['details', 'evolution', 'resigned', 'stopped', 'no_meter'].includes(currentView)}
            onClick={() => setCurrentView('details')}
          />
          <NavItem
            icon={<BarChart3 size={20} />}
            label="Analyses Financières"
            active={currentView === 'creance' || currentView === 'repartition' || currentView === 'commune' || currentView === 'ventilation'}
            onClick={() => setCurrentView('creance')}
          />
          <NavItem
            icon={<CreditCard size={20} />}
            label="Créances Abonnés"
            active={currentView === 'creances_abonnes'}
            onClick={() => setCurrentView('creances_abonnes')}
          />
          <NavItem
            icon={<Building2 size={20} />}
            label="Créance institutions"
            active={currentView === 'creances_institutions'}
            onClick={() => setCurrentView('creances_institutions')}
          />
          <NavItem
            icon={<Calendar size={20} />}
            label="Périodes de Facturation"
          />
        </nav>

        <div className="mt-auto flex flex-col gap-1 pt-6 border-t border-[#F2F4F7]">
          <NavItem icon={<Bell size={20} />} label="Notifications" />
          <NavItem icon={<HelpCircle size={20} />} label="Centre d'aide" />
          <NavItem
            icon={<Settings size={20} />}
            label="Paramètres"
            active={currentView === 'settings'}
            onClick={() => setCurrentView('settings')}
          />
          <NavItem icon={<LogOut size={20} />} label="Déconnexion" onClick={handleLogout} />
        </div>

        <div className="bg-[#F9FAFB] p-4 rounded-2xl flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center font-bold text-slate-600">{user?.username?.[0]?.toUpperCase() || 'A'}</div>
          <div>
            <p className="text-sm font-bold">{user?.username || 'Administrateur'}</p>
            <p className="text-xs text-[#475467]">{user?.username ? `${user.username}@epeor.dz` : 'admin@epeor.dz'}</p>
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col min-w-0">
        <MobileTopBar />

      {/* Main Content */}
      <main className="flex-1 app-main overflow-y-auto overflow-x-hidden print:p-0">
        <header className="flex justify-between items-start mb-6 sm:mb-8 lg:mb-12 no-print no-print-charts-only">
          <div className="min-w-0">
            <h1 className="page-title text-[#101828]">Bonjour, {user?.username || 'Admin'} !</h1>
            <p className="text-[#475467] mt-1 text-sm sm:text-base lg:text-lg">Retrouvez la situation globale de votre réseau aujourd&apos;hui.</p>
          </div>
        </header>

        {/* Main Content */}
        {currentView === 'dashboard' ? (
          <div className="space-y-10">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7 gap-4 sm:gap-6">
              <StatsCard
                title="Total Abonnés"
                value={stats?.total_subscribers?.toLocaleString() || "..."}
                icon={<Users className="text-[#0D83DE]" size={24} />}
                trend="+2.5%📈"
                color="blue"
                onClick={() => setCurrentView('details')}
              />
              <StatsCard
                title="Abonnés Résiliés"
                value={stats?.resigned_subscribers?.toLocaleString() || "..."}
                icon={<UserX className="text-rose-500" size={24} />}
                trend="Code 40"
                color="rose"
                onClick={() => setCurrentView('resigned')}
              />
              <StatsCard
                title="A l'Arrêt"
                value={stats?.stopped_subscribers?.toLocaleString() || "..."}
                icon={<TimerOff className="text-amber-500" size={24} />}
                trend="Code 20"
                color="amber"
                onClick={() => setCurrentView('stopped')}
              />
              <StatsCard
                title="Sans Compteur"
                value={stats?.no_meter_subscribers?.toLocaleString() || "..."}
                icon={<Ban className="text-cyan-500" size={24} />}
                trend="Code 30"
                color="cyan"
                onClick={() => setCurrentView('no_meter')}
              />
              <StatsCard
                title="Taux Forfait"
                value={`${pctCpt2030.toFixed(2)}%`}
                icon={<Percent className="text-slate-500" size={24} />}
                trend={`${targetSubs.toLocaleString()} abonnés`}
                color="slate"
              />
              <StatsCard
                title="Chiffre d'Affaire"
                value={`${stats?.total_revenue?.toLocaleString() || "..."} DA`}
                icon={<CreditCard className="text-brand-500" size={24} />}
                trend={stats?.revenue_period || "Période en cours"}
                color="brand"
                onClick={() => setCurrentView('creance')}
              />
              <StatsCard
                title="Recouvrement"
                value={`${stats?.recovery_rate || "..."}%`}
                icon={<TrendingUp className="text-emerald-500" size={24} />}
                trend="Objectif 90%"
                color="emerald"
              />
            </div>

            {/* Charts & Analytics — rendus seulement quand les stats sont prêtes (évite width/height -1 Recharts) */}
            {stats?.ready && (stats?.total_subscribers ?? 0) > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-7 gap-4 sm:gap-8">
              <div className="lg:col-span-4 bg-white border border-[#E4E7EC] shadow-sm rounded-[1.25rem] sm:rounded-[2rem] p-4 sm:p-6 lg:p-8 min-w-0">
                <div className="flex justify-between items-center mb-8">
                  <div
                    className="flex items-center gap-2 cursor-help"
                    onMouseEnter={() => setShowChartGuide(true)}
                    onMouseLeave={() => setShowChartGuide(false)}
                  >
                    <h3 className="text-xl font-black tracking-tight text-[#101828] hover:text-[#0D83DE] transition-colors">
                      Répartition par Secteur (centre) & Résiliations
                    </h3>
                  </div>
                </div>
                <ChartContainer className="h-[260px] sm:h-[320px] lg:h-[350px] w-full min-w-0">
                    <BarChart data={stats?.subscriber_sectors || []} margin={{ top: 30, right: 10, left: -20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F2F4F7" vertical={false} />
                      <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#667085', fontSize: 10, fontWeight: 500 }}
                        interval={0}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis hide />
                      <Tooltip
                        cursor={{ fill: '#F9FAFB' }}
                        contentStyle={{
                          backgroundColor: "#101828",
                          border: "none",
                          borderRadius: "12px",
                          color: "#fff",
                          fontSize: '12px'
                        }}
                        itemStyle={{ color: "#fff" }}
                        formatter={(value: any, name: any) => [
                          `${value.toLocaleString()} Abonnés`,
                          name === "value" ? "Actifs" : "Résiliés"
                        ]}
                      />
                      <Legend
                        verticalAlign="top"
                        align="right"
                        iconType="circle"
                        wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', paddingBottom: '20px' }}
                      />
                      <Bar
                        dataKey="value"
                        name="Actifs"
                        fill="#0D83DE"
                        radius={[4, 4, 0, 0]}
                        barSize={40}
                      >
                        {showChartGuide && (
                          <LabelList
                            dataKey="value"
                            position="top"
                            content={(props: any) => {
                              const { x, y, width, value } = props;
                              return (
                                <g>
                                  <path d={`M${x + width / 2} ${y - 5} L${x + width / 2 - 5} ${y - 15} L${x + width / 2 + 5} ${y - 15} Z`} fill="#0D83DE" />
                                  <text x={x + width / 2} y={y - 20} fill="#0D83DE" fontSize={10} fontWeight="bold" textAnchor="middle">
                                    {value.toLocaleString()}
                                  </text>
                                </g>
                              );
                            }}
                          />
                        )}
                      </Bar>
                      <Bar
                        dataKey="resigned"
                        name="Résiliés"
                        fill="#E11D48"
                        radius={[4, 4, 0, 0]}
                        barSize={40}
                      >
                        {showChartGuide && (
                          <LabelList
                            dataKey="resigned"
                            position="top"
                            content={(props: any) => {
                              const { x, y, width, value } = props;
                              return (
                                <g>
                                  <path d={`M${x + width / 2} ${y - 5} L${x + width / 2 - 5} ${y - 15} L${x + width / 2 + 5} ${y - 15} Z`} fill="#E11D48" />
                                  <text x={x + width / 2} y={y - 20} fill="#E11D48" fontSize={10} fontWeight="bold" textAnchor="middle">
                                    {value.toLocaleString()}
                                  </text>
                                </g>
                              );
                            }}
                          />
                        )}
                      </Bar>
                    </BarChart>
                </ChartContainer>
              </div>

              <div
                onClick={() => setCurrentView('details')}
                className="lg:col-span-3 bg-white border border-[#E4E7EC] shadow-sm rounded-[1.25rem] sm:rounded-[2rem] p-4 sm:p-6 lg:p-8 text-obat-gray cursor-pointer hover:shadow-md hover:border-[#D0D5DD] transition-all group min-w-0"
              >
                <h3 className="text-xl font-black tracking-tight mb-8 text-[#101828] group-hover:text-[#0D83DE] transition-colors">Secteurs (centres)</h3>
                <ChartContainer className="h-[260px] sm:h-[320px] lg:h-[350px] w-full min-w-0">
                    <PieChart>
                      <Pie
                        data={stats?.subscriber_sectors?.slice(0, 5) || []}
                        cx="50%"
                        cy="50%"
                        outerRadius={120}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="#fff"
                        strokeWidth={2}
                        label={({ name, percent }) => percent !== undefined ? `${name} ${(percent * 100).toFixed(0)}%` : name}
                      >
                        {(stats?.subscriber_sectors || []).map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={[
                            '#0D83DE', // Blue
                            '#00D1FF', // Cyan
                            '#0891B2', // Teal
                            '#10B981', // Emerald
                            '#F59E0B', // Amber
                            '#E11D48', // Rose
                          ][index % 6]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#101828",
                          border: "none",
                          borderRadius: "12px",
                          color: "#fff",
                          fontSize: '12px'
                        }}
                        itemStyle={{ color: "#fff" }}
                        formatter={(value: any, name: any, props: any) => [
                          `${value.toLocaleString()} (${props.payload.percentage}%)`,
                          name
                        ]}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        iconType="circle"
                        wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', paddingTop: '20px' }}
                      />
                    </PieChart>
                </ChartContainer>
              </div>
            </div>
            ) : (
            <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[1.25rem] sm:rounded-[2rem] p-8 page-card flex flex-col items-center justify-center gap-3 min-h-[200px]">
                <div className="w-10 h-10 border-4 border-blue-100 border-t-[#0D83DE] rounded-full animate-spin" />
                <p className="text-sm font-bold text-[#667085]">Chargement des graphiques du tableau de bord…</p>
              </div>
            )}


          </div>
        ) : ['details', 'evolution', 'resigned', 'stopped', 'no_meter'].includes(currentView) ? (
          <GestionAbonnesShell
            currentView={currentView as 'details' | 'evolution' | 'resigned' | 'stopped' | 'no_meter'}
            setCurrentView={setCurrentView}
            baseStats={stats}
            selectedSecteur={selectedSecteur}
            sectors={sectors}
            uniteLabel={uniteLabel}
            onSecteurChange={setSelectedSecteur}
            sectorsLoading={sectorsLoading || !stats?.ready}
            onBack={() => setCurrentView('dashboard')}
          />
        ) : currentView === 'creances_abonnes' ? (
          <CreancesAbonnesView
            onBack={() => setCurrentView('dashboard')}
            selectedSecteur={selectedSecteur}
            sectors={sectors}
            uniteLabel={uniteLabel}
            onSecteurChange={setSelectedSecteur}
            sectorsLoading={sectorsLoading || !stats?.ready}
          />
        ) : currentView === 'creances_institutions' ? (
          <CreancesInstitutionsView
            onBack={() => setCurrentView('dashboard')}
            selectedSecteur={selectedSecteur}
            sectors={sectors}
            uniteLabel={uniteLabel}
            onSecteurChange={setSelectedSecteur}
            sectorsLoading={sectorsLoading || !stats?.ready}
          />
        ) : currentView === 'settings' ? (
          <SettingsView onBack={() => setCurrentView('dashboard')} />
        ) : ['creance', 'repartition', 'commune', 'ventilation', 'bilan_activite'].includes(currentView) ? (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Unified Financial Suite Header */}
            <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[1.25rem] sm:rounded-[2rem] page-card no-print no-print-charts-only">
              <button
                onClick={() => setCurrentView('dashboard')}
                className="flex items-center gap-2 text-sm font-bold text-[#667085] hover:text-[#101828] mb-4 transition-colors animate-in fade-in duration-200"
              >
                <ChevronRight className="rotate-180" size={16} /> Retour au tableau de bord
              </button>
              
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6">
                <div className="min-w-0">
                  <h2 className="page-title text-[#101828]">Analyses Financières</h2>
                  <p className="text-sm text-[#667085] mt-1 font-medium">
                    {selectedSecteur
                      ? `Calculs limités au centre : ${sectors.find(s => s.code === selectedSecteur)?.libelle ?? selectedSecteur}`
                      : 'Facturation, recouvrement et ventilation — toute l\'unité'}
                  </p>
                  {formatPeriodLabel(calcDateRange.start, calcDateRange.end) && (
                    <p className="text-sm text-[#334155] mt-2 font-medium">{formatPeriodLabel(calcDateRange.start, calcDateRange.end)}</p>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 w-full lg:w-auto">
                  <SecteurDropdown
                    sectors={sectors}
                    selectedSecteur={selectedSecteur}
                    onSelect={(code) => { setSelectedSecteur(code); setCreanceData(null); setVentilationData([]); setLastVentDate(''); }}
                    uniteLabel={uniteLabel}
                    loading={sectorsLoading || !stats?.ready}
                  />
                  <ScrollableTabs className="w-full sm:w-auto sm:max-w-full">
                    {[
                      { id: 'creance', label: 'Synthèse Globale' },
                        { id: 'ventilation', label: 'Ventilation Créances' },
                        { id: 'repartition', label: "Répartition par Type" },
                        { id: 'commune', label: 'Répartition par Commune' },
                        { id: 'bilan_activite', label: "Bilan d'activité" }
                    ].map(tab => (
                      <ScrollableTab
                        key={tab.id}
                        active={currentView === tab.id}
                        onClick={() => setCurrentView(tab.id as AppView)}
                      >
                        {tab.label}
                      </ScrollableTab>
                    ))}
                  </ScrollableTabs>
                </div>
              </div>
            </div>

            {/* Render Active View */}
            {currentView === 'creance' ? (
              <CreanceDetailView
                creanceData={creanceData}
                setCreanceData={setCreanceData}
                ventilationData={ventilationData}
                setVentilationData={setVentilationData}
                lastVentDate={lastVentDate}
                setLastVentDate={setLastVentDate}
                ventilationFilter={ventilationFilter}
                setVentilationFilter={setVentilationFilter}
                onNavigateToRepartition={(filter: 'ALL' | 'EAU' | 'PRESTATIONS') => {
                  setRepartitionFilter(filter);
                  setCurrentView('repartition');
                }}
                onNavigateToVentilation={() => setCurrentView('ventilation')}
                onCalcDateChange={(s: string, e: string) => setCalcDateRange({start: s, end: e})}
                selectedSecteur={selectedSecteur}
                sectors={sectors}
                uniteLabel={uniteLabel}
              />
            ) : currentView === 'ventilation' ? (
              <CreanceVentilationView
                ventilationData={ventilationData}
                setVentilationData={setVentilationData}
                lastVentDate={lastVentDate}
                setLastVentDate={setLastVentDate}
                ventilationFilter={ventilationFilter}
                setVentilationFilter={setVentilationFilter}
                onGoToCalculation={() => setCurrentView('creance')}
                selectedSecteur={selectedSecteur}
                sectors={sectors}
                uniteLabel={uniteLabel}
                endDate={calcDateRange.end}
              />
            ) : currentView === 'repartition' ? (
              <CreanceRepartitionView
                data={creanceData}
                typeSectionFilter={repartitionFilter}
                setTypeSectionFilter={setRepartitionFilter}
                onGoToCalculation={() => setCurrentView('creance')}
                startDate={calcDateRange.start}
                endDate={calcDateRange.end}
                selectedSecteur={selectedSecteur}
                sectors={sectors}
              />
            ) : currentView === 'commune' ? (
              <CreanceCommuneView
                data={creanceData}
                onGoToCalculation={() => setCurrentView('creance')}
                selectedSecteur={selectedSecteur}
                sectors={sectors}
                startDate={calcDateRange.start}
                endDate={calcDateRange.end}
              />
            ) : currentView === 'bilan_activite' ? (
              <BilanActiviteView
                data={creanceData}
                startDate={calcDateRange.start}
                endDate={calcDateRange.end}
                selectedSecteur={selectedSecteur}
                sectors={sectors}
              />
            ) : null}
          </div>
        ) : null}
      </main>
        <MobileNav currentView={currentView as AppView} onNavigate={setCurrentView} onLogout={handleLogout} />
      </div>
    </div>
  );
}


