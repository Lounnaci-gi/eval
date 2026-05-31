"use client";

if (typeof window !== "undefined") {
  const originalWarn = console.warn;
  console.warn = (...args: any[]) => {
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

import { useEffect, useState, Fragment, useRef, useMemo, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Users,
  UserX,
  TimerOff,
  Ban,
  CreditCard,
  TrendingUp,
  Search,
  Settings,
  LogOut,
  LayoutDashboard,
  Database,
  BarChart3,
  Calendar,
  ChevronRight,
  ChevronDown,
  Bell,
  HelpCircle,
  Printer,
  FileText,
  FileSpreadsheet,
  Percent,
  MapPin,
  Building2,
  RefreshCw,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  LabelList,
} from "recharts";

/** Masque les noms de fichiers / tables techniques dans les messages UI. */
function sanitizeUserFacingMessage(message: string | undefined): string {
  if (!message) return "";
  return message
    .replace(/\b[A-Z][A-Z0-9_]*\.DBF\b/gi, "données")
    .replace(/\.dbf\b/gi, "")
    .trim();
}

/** Évite les avertissements Recharts quand le conteneur n'a pas encore de taille (flex / onglets). */
function ChartContainer({ children, className = "h-[350px] w-full min-h-[200px]" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setReady(el.clientWidth > 0 && el.clientHeight > 0);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} className={className} style={{ minWidth: 0, minHeight: 0 }}>
      {ready ? (
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          {children}
        </ResponsiveContainer>
      ) : null}
    </div>
  );
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
};

function MultiSelectDropdown({
    label,
    options,
    selected,
    onChange,
    placeholder,
  }: {
    label: string;
    options: string[];
    selected: string[];
    onChange: (next: string[]) => void;
    placeholder?: string;
  }) {
    const [open, setOpen] = useState(false);
    const buttonRef = useRef<HTMLButtonElement | null>(null);
    const menuRef = useRef<HTMLDivElement | null>(null);
    const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

    const updatePos = () => {
      const btn = buttonRef.current;
      if (!btn) return setPos(null);
      const rect = btn.getBoundingClientRect();
      setPos({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX, width: rect.width });
    };

    useEffect(() => {
      if (!open) return;
      updatePos();
      const onPointer = (e: PointerEvent) => {
        const menu = menuRef.current;
        const btn = buttonRef.current;
        if (menu && btn && !menu.contains(e.target as Node) && !btn.contains(e.target as Node)) setOpen(false);
      };
      const onScroll = () => updatePos();
      window.addEventListener('pointerdown', onPointer);
      window.addEventListener('resize', onScroll);
      window.addEventListener('scroll', onScroll, true);
      return () => {
        window.removeEventListener('pointerdown', onPointer);
        window.removeEventListener('resize', onScroll);
        window.removeEventListener('scroll', onScroll, true);
      };
    }, [open]);

    useEffect(() => {
      if (!open) return;
      const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
    }, [open]);

    const toggle = (v: string) => {
      if (selected.includes(v)) onChange(selected.filter(x => x !== v));
      else onChange([...selected, v]);
    };

    const labelText = selected.length === 0 ? (placeholder || 'Toutes') : selected.length === 1 ? selected[0] : `${selected.length} sélectionnés`;

    const menu = pos ? (
      <div
        ref={menuRef}
        style={{ position: 'absolute', top: pos.top - 4, left: pos.left, width: pos.width, zIndex: 9999 }}
      >
        <div className="max-h-44 overflow-y-auto rounded-2xl border border-[#E4E7EC] bg-white p-3 shadow-lg">
          {options.map(o => (
            <label key={o} className="flex items-center gap-2 text-xs text-[#101828] py-1" onClick={e => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={selected.includes(o)}
                onChange={(e) => { e.stopPropagation(); toggle(o); }}
                className="h-4 w-4 rounded border-[#D0D5DD] text-brand-600 focus:ring-brand-500"
              />
              <span>{o}</span>
            </label>
          ))}
          <div className="mt-2 flex gap-2 justify-end">
            <button onClick={() => { onChange([]); }} className="text-[10px] font-bold text-brand-600 hover:text-brand-800" type="button">Effacer</button>
            <button onClick={() => setOpen(false)} className="text-[10px] text-[#475467]" type="button">Fermer</button>
          </div>
        </div>
      </div>
    ) : null;

    return (
      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => { setOpen(o => !o); if (!open) setTimeout(updatePos, 0); }}
          onFocus={() => { setOpen(true); setTimeout(updatePos, 0); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true); setTimeout(updatePos, 0); }
          }}
          className="w-full flex justify-between items-center py-2 px-4 bg-[#F9FAFB] border border-[#E4E7EC] rounded-xl text-xs font-bold"
        >
          <span className="text-left">
            <span className="font-black">{label}</span>
            <span className="ml-2 font-normal text-[#475467]">{labelText}</span>
          </span>
          <ChevronDown size={14} className="text-[#98A2B3]" />
        </button>
        {open && pos && createPortal(menu, document.body)}
      </div>
    );
  }

  function FrenchDateInput({ label, value, onChange, className }: { label?: string; value: string; onChange: (v: string) => void; className?: string }) {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const formatDisplay = (raw: string) => {
      if (!raw) return '—';
      // raw is YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        return raw.replace(/(\d{4})-(\d{2})-(\d{2})/, '$3/$2/$1');
      }
      return raw;
    };

    return (
      <div>
        {label && <div className="text-[11px] font-black text-[#475467] mb-1">{label}</div>}
        <div className="relative">
          <div
            onClick={() => inputRef.current?.showPicker && inputRef.current.showPicker()}
            className={`${className ?? ''} cursor-pointer`}
          >
            {formatDisplay(value)}
          </div>
          <input
            type="date"
            ref={inputRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 opacity-0 pointer-events-auto"
            tabIndex={-1}
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#98A2B3]">
            <Calendar size={14} />
          </div>
        </div>
      </div>
    );
}



// ─── Secteur (centre) dropdown ────────────────────────────────────────────────
function SecteurDropdown({
  sectors,
  selectedSecteur,
  onSelect,
  uniteLabel,
}: {
  sectors: { code: string; libelle: string }[];
  selectedSecteur: string;
  onSelect: (code: string) => void;
  uniteLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const currentLabel = selectedSecteur
    ? (sectors.find(s => s.code === selectedSecteur)?.libelle ?? selectedSecteur)
    : `Toute l'Unité${uniteLabel ? ` (${uniteLabel})` : ''}`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 pl-4 pr-3 py-2.5 bg-white border border-[#E4E7EC] rounded-2xl text-xs font-bold text-[#344054] hover:border-[#0D83DE] hover:text-[#0D83DE] transition-all shadow-sm min-w-[200px] justify-between"
      >
        <span className="flex items-center gap-2">
          <MapPin size={14} className={selectedSecteur ? 'text-[#0D83DE]' : 'text-[#98A2B3]'} />
          <span className={selectedSecteur ? 'text-[#0D83DE] font-black' : ''}>{currentLabel}</span>
        </span>
        <ChevronDown size={14} className="text-[#98A2B3] shrink-0" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-[#E4E7EC] rounded-2xl shadow-xl z-50 overflow-hidden">
          {/* All unit option */}
          <button
            type="button"
            onClick={() => { onSelect(''); setOpen(false); }}
            className={`w-full text-left px-4 py-3 text-xs font-bold flex items-center gap-2 transition-colors ${
              !selectedSecteur
                ? 'bg-blue-50 text-[#0D83DE]'
                : 'text-[#344054] hover:bg-[#F9FAFB]'
            }`}
          >
            <span className="w-5 h-5 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center text-[9px] font-black shrink-0">
              ✦
            </span>
            Toute l'Unité{uniteLabel ? ` — ${uniteLabel}` : ''}
          </button>
          <div className="border-t border-[#F2F4F7]" />
          {/* Individual sectors */}
          {sectors.map(s => (
            <button
              key={s.code}
              type="button"
              onClick={() => { onSelect(s.code); setOpen(false); }}
              className={`w-full text-left px-4 py-3 text-xs font-bold flex items-center gap-2 transition-colors ${
                selectedSecteur === s.code
                  ? 'bg-blue-50 text-[#0D83DE]'
                  : 'text-[#344054] hover:bg-[#F9FAFB]'
              }`}
            >
              <span className="w-5 h-5 rounded-lg bg-blue-50 text-[#0D83DE] flex items-center justify-center text-[9px] font-black shrink-0">
                {s.code}
              </span>
              {s.libelle}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [currentView, setCurrentView] = useState<'dashboard' | 'details' | 'resigned' | 'stopped' | 'no_meter' | 'creance' | 'repartition' | 'commune' | 'creances_abonnes' | 'creances_institutions' | 'settings'>('dashboard');
  const [showChartGuide, setShowChartGuide] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [filteredResults, setFilteredResults] = useState<any[]>([]);
  const [filterQuery, setFilterQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [hoveredAbonne, setHoveredAbonne] = useState<any>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [creanceData, setCreanceData] = useState<any>(null);
  const [repartitionFilter, setRepartitionFilter] = useState<'ALL' | 'EAU' | 'PRESTATIONS'>('ALL');
  const [calcDateRange, setCalcDateRange] = useState<{start: string, end: string}>({start: '', end: ''});
  const [reloadPending, setReloadPending] = useState(false);
  const itemsPerPage = 20;
  // Secteur/centre filter
  const [selectedSecteur, setSelectedSecteur] = useState('');
  const [sectors, setSectors] = useState<{ code: string; libelle: string }[]>([]);
  const [uniteLabel, setUniteLabel] = useState('');

  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/unites_settings')
      .then(r => r.json())
      .then((data: any[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setUniteLabel(data[0].denom || '');
          setSectors((data[0].sectors || []).map((s: any) => ({ code: s.code, libelle: s.libelle })));
        }
      })
      .catch(() => {});
  }, []);

  const requestDataReload = async () => {
    setReloadPending(true);
    setStats({ status: 'loading', message: 'Rechargement des données en cours…', ready: false });
    try {
      await fetch('http://127.0.0.1:8000/api/reload_data', { method: 'POST' });
    } catch {
      setStats({ status: 'error', message: 'Impossible de joindre le backend pour le rechargement.', ready: false });
    } finally {
      setReloadPending(false);
    }
  };

  useEffect(() => {
    let intervalId: any;

    const checkStats = () => {
      fetch("http://127.0.0.1:8000/stats")
        .then((res) => {
          if (!res.ok) throw new Error("Erreur réseau");
          return res.json();
        })
        .then((data) => {
          if (data?.error || data?.status === 'error') {
            setStats({
              error: data.error || data.message || "Données indisponibles",
              ready: false,
            });
          } else {
            setStats(data);
          }
          if (data && (data.status === 'loading' || data.ready === false)) {
            if (!intervalId) {
              intervalId = setInterval(checkStats, 2000);
            }
          } else if (data?.ready !== false && !data?.error) {
            if (intervalId) {
              clearInterval(intervalId);
              intervalId = null;
            }
          }
        })
        .catch((err) => {
          console.error("Erreur de chargement des stats:", err);
          setStats({ error: "Impossible de contacter le serveur backend (Port 8000)" });
          if (!intervalId) {
            intervalId = setInterval(checkStats, 3000);
          }
        });
    };

    checkStats();

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  const getEtatBadge = (etat: string) => {
    switch (etat) {
      case '10': return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">En marche</span>;
      case '20': return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-100">À l'arrêt</span>;
      case '30': return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-50 text-cyan-600 border border-cyan-100">Sans compteur</span>;
      case '40': return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-100">Résilié</span>;
      default: return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-50 text-slate-600 border border-slate-100">Code: {etat}</span>;
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;
    const res = await fetch(`http://127.0.0.1:8000/search?query=${searchQuery}`);
    const data = await res.json();
    setSearchResults(data);
    setFilteredResults(data);
    setCurrentPage(1);
  };

  const handleFilter = (query: string) => {
    setFilterQuery(query);
    const lowQuery = query.toLowerCase();
    const filtered = searchResults.filter(r =>
      r.NOM?.toLowerCase().includes(lowQuery) ||
      r.ADRESSE?.toLowerCase().includes(lowQuery) ||
      r.TOURNEE?.toLowerCase().includes(lowQuery) ||
      r.TYPE_LABEL?.toLowerCase().includes(lowQuery) ||
      r.NUMSER?.toLowerCase().includes(lowQuery) ||
      r.NUMAB?.toLowerCase().includes(lowQuery) ||
      r.NUMORDRE?.toLowerCase().includes(lowQuery) ||
      r.BLOC?.toLowerCase().includes(lowQuery) ||
      r.NDOM?.toLowerCase().includes(lowQuery)
    );
    setFilteredResults(filtered);
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(filteredResults.length / itemsPerPage);
  const currentItems = filteredResults.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalSubs = stats?.total_subscribers || 0;
  const targetSubs = (stats?.stopped_subscribers || 0) + (stats?.no_meter_subscribers || 0);
  const pctCpt2030 = totalSubs > 0 ? (targetSubs / totalSubs) * 100 : 0;

  if (stats?.error) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center p-8">
        <div className="bg-white border border-rose-100 shadow-2xl rounded-[3rem] p-16 flex flex-col items-center gap-6 max-w-md w-full text-center">
          <Ban size={48} className="text-rose-500" />
          <h1 className="text-2xl font-black text-[#101828]">Connexion impossible</h1>
          <p className="text-sm text-[#475467] font-medium">{stats.error}</p>
          <p className="text-xs text-[#98A2B3]">Démarrez le backend : port 8000 (voir start.bat ou README)</p>
        </div>
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
        <div className="bg-white border border-[#E4E7EC] shadow-2xl rounded-[3rem] p-16 flex flex-col items-center gap-8 max-w-lg w-full text-center">
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
            <p className="text-[10px] text-[#98A2B3]">
              Ou fermez « EPEOR Backend » et relancez start.bat — vérifiez le dossier de données (variable EPEOR_DATA_DIR)
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F9FAFB] text-[#101828] relative" onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}>

      {/* Floating Hover Card - Obat Style */}
      {hoveredAbonne && (
        <div
          className="fixed z-50 w-80 bg-white border border-[#E4E7EC] shadow-2xl rounded-[2rem] p-6 pointer-events-none animate-in fade-in zoom-in duration-200 no-print"
          style={{
            left: `${Math.min(mousePos.x + 20, window.innerWidth - 340)}px`,
            top: `${Math.min(mousePos.y + 20, window.innerHeight - 400)}px`
          }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-[#0D83DE]">
              <Users size={24} />
            </div>
            <div>
              <h4 className="text-sm font-black uppercase text-[#101828] leading-tight">{hoveredAbonne.NOM}</h4>
              <p className="text-xs text-[#475467] font-mono">{hoveredAbonne.NUMAB}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="p-3 bg-[#F9FAFB] rounded-xl">
              <p className="text-[10px] font-black text-[#98A2B3] uppercase mb-1">Adresse complète</p>
              <p className="text-xs font-bold">{hoveredAbonne.ADRESSE}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-[#F9FAFB] rounded-xl">
                <p className="text-[10px] font-black text-[#98A2B3] uppercase mb-1">Tournée</p>
                <p className="text-xs font-bold text-[#0D83DE]">Zone {hoveredAbonne.TOURNEE}</p>
              </div>
              <div className="p-3 bg-[#F9FAFB] rounded-xl">
                <p className="text-[10px] font-black text-[#98A2B3] uppercase mb-1">N° Ordre</p>
                <p className="text-xs font-bold">{hoveredAbonne.NUMORDRE}</p>
              </div>
            </div>

            <div className="p-3 bg-[#F9FAFB] rounded-xl">
              <p className="text-[10px] font-black text-[#98A2B3] uppercase mb-1">Compteur Série</p>
              <p className="text-xs font-mono font-bold text-slate-600">{hoveredAbonne.NUMSER || "---"}</p>
            </div>

            <div className="pt-2 border-t border-[#F2F4F7]">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-600 border border-emerald-100 uppercase">
                {hoveredAbonne.TYPE_LABEL}
              </span>
            </div>
          </div>
        </div>
      )}
      {/* Sidebar - Obat Style */}
      <aside className="w-72 bg-white border-r border-[#E4E7EC] p-6 flex flex-col gap-10 hidden md:flex no-print no-print-charts-only">
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
            active={currentView === 'details' || currentView === 'resigned' || currentView === 'stopped'}
            onClick={() => setCurrentView('details')}
          />
          <NavItem
            icon={<BarChart3 size={20} />}
            label="Analyses Financières"
            active={currentView === 'creance' || currentView === 'repartition' || currentView === 'commune'}
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
          <NavItem icon={<LogOut size={20} />} label="Déconnexion" />
        </div>

        <div className="bg-[#F9FAFB] p-4 rounded-2xl flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center font-bold text-slate-600">A</div>
          <div>
            <p className="text-sm font-bold">Administrateur</p>
            <p className="text-xs text-[#475467]">admin@epeor.dz</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-10 overflow-y-auto print:p-0">
        <header className="flex justify-between items-start mb-12 no-print no-print-charts-only">
          <div>
            <h1 className="text-4xl font-black text-[#101828] tracking-tight">Bonjour, Admin !</h1>
            <p className="text-[#475467] mt-1 text-lg">Retrouvez la situation globale de votre réseau aujourd'hui.</p>
          </div>
        </header>

        {/* Main Content */}
        {currentView === 'dashboard' ? (
          <div className="space-y-10">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7 gap-6">
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
            <div className="grid grid-cols-1 lg:grid-cols-7 gap-8">
              <div className="lg:col-span-4 bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] p-8">
                <div className="flex justify-between items-center mb-8">
                  <div
                    className="flex items-center gap-2 cursor-help"
                    onMouseEnter={() => setShowChartGuide(true)}
                    onMouseLeave={() => setShowChartGuide(false)}
                  >
                    <h3 className="text-xl font-black tracking-tight text-[#101828] hover:text-[#0D83DE] transition-colors">
                      Répartition par Commune & Résiliations
                    </h3>
                  </div>
                </div>
                <ChartContainer className="h-[350px] w-full">
                    <BarChart data={stats?.subscriber_communes || []} margin={{ top: 30, right: 10, left: -20, bottom: 20 }}>
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
                className="lg:col-span-3 bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] p-8 text-obat-gray cursor-pointer hover:shadow-md hover:border-[#D0D5DD] transition-all group"
              >
                <h3 className="text-xl font-black tracking-tight mb-8 text-[#101828] group-hover:text-[#0D83DE] transition-colors">Types d'Abonnés</h3>
                <ChartContainer className="h-[350px] w-full">
                    <PieChart>
                      <Pie
                        data={stats?.subscriber_types?.slice(0, 5) || []}
                        cx="50%"
                        cy="50%"
                        outerRadius={120}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="#fff"
                        strokeWidth={2}
                        label={({ name, percent }) => percent !== undefined ? `${name} ${(percent * 100).toFixed(0)}%` : name}
                      >
                        {(stats?.subscriber_types || []).map((entry: any, index: number) => (
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
              <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] p-12 flex flex-col items-center justify-center gap-3 min-h-[200px]">
                <div className="w-10 h-10 border-4 border-blue-100 border-t-[#0D83DE] rounded-full animate-spin" />
                <p className="text-sm font-bold text-[#667085]">Chargement des graphiques du tableau de bord…</p>
              </div>
            )}

            {/* Search Results - Obat List Style */}
            {searchResults.length > 0 && (
              <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] overflow-hidden">
                <div className="p-8 border-b border-[#F2F4F7] flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                  <div>
                    <h3 className="text-xl font-black tracking-tight">Résultats de la Recherche</h3>
                    <p className="text-xs text-[#667085] mt-1">{filteredResults.length} résultats / Page {currentPage} sur {totalPages || 1}</p>
                  </div>

                  {/* Advanced Filters */}
                  <div className="flex gap-4 items-center">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#98A2B3]" size={14} />
                      <input
                        type="text"
                        placeholder="Nom, Adresse, Série, Tournée..."
                        className="text-xs border-[#D0D5DD] border rounded-xl pl-9 pr-4 py-2 bg-[#F9FAFB] focus:outline-none focus:ring-2 focus:ring-blue-100 w-64"
                        value={filterQuery}
                        onChange={(e) => handleFilter(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-[#F9FAFB] text-[#475467] text-[11px] uppercase tracking-wider font-bold">
                        <th className="px-8 py-5">Identifiant</th>
                        <th className="px-6 py-5">Nom & Prénom</th>
                        <th className="px-6 py-5">Adresse / Emplacement</th>
                        <th className="px-6 py-5">Zone / Tournée</th>
                        <th className="px-6 py-5">Compteur (Série & État)</th>
                        <th className="px-6 py-5">Catégorie</th>
                        <th className="px-8 py-5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F2F4F7]">
                      {currentItems.map((row, i) => (
                        <tr
                          key={i}
                          className="hover:bg-[#F9FAFB] transition-colors group cursor-help"
                          onMouseEnter={() => setHoveredAbonne(row)}
                          onMouseLeave={() => setHoveredAbonne(null)}
                        >
                          <td className="px-8 py-6">
                            <span className="text-xs font-bold text-[#101828] block">{row.NUMAB}</span>
                            <span className="text-[10px] text-[#667085]">Ordre: {row.NUMORDRE}</span>
                          </td>
                          <td className="px-6 py-6 font-black text-sm text-[#101828] uppercase">{row.NOM}</td>
                          <td className="px-6 py-6 text-sm text-[#475467]">{row.ADRESSE}</td>
                          <td className="px-6 py-6 text-xs text-[#101828]">
                            T- <span className="font-bold">{row.TOURNEE}</span>
                          </td>
                          <td className="px-6 py-6 flex flex-col gap-1 items-start">
                            <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{row.NUMSER}</span>
                            {getEtatBadge(row.ETATCPT)}
                          </td>
                          <td className="px-6 py-6">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black bg-blue-50 text-[#0D83DE] border border-blue-100 uppercase">
                              {row.TYPE_LABEL}
                            </span>
                          </td>
                          <td className="px-8 py-6 text-right">
                            <button className="w-10 h-10 rounded-xl bg-white border border-[#D0D5DD] flex items-center justify-center text-[#667085] group-hover:bg-[#0D83DE] group-hover:text-white group-hover:border-[#0D83DE] transition-all shadow-sm">
                              <ChevronRight size={20} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Pagination Controls */}
                <div className="p-6 bg-[#F9FAFB] border-t border-[#F2F4F7] flex justify-between items-center">
                  <p className="text-xs font-bold text-[#667085]">Affichage de {currentItems.length} résultats sur {filteredResults.length}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 border border-[#D0D5DD] rounded-xl text-xs font-bold bg-white disabled:opacity-50 hover:bg-[#F2F4F7] transition-colors"
                    >
                      Précédent
                    </button>
                    <div className="flex items-center px-4 text-xs font-bold">
                      Page {currentPage} / {totalPages || 1}
                    </div>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages || totalPages === 0}
                      className="px-4 py-2 border border-[#D0D5DD] rounded-xl text-xs font-bold bg-white disabled:opacity-50 hover:bg-[#F2F4F7] transition-colors"
                    >
                      Suivant
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : currentView === 'details' ? (
          <DetailedStatsView stats={stats} onBack={() => setCurrentView('dashboard')} selectedSecteur={selectedSecteur} sectors={sectors} uniteLabel={uniteLabel} onSecteurChange={setSelectedSecteur} />
        ) : currentView === 'resigned' ? (
          <ResignedDetailView stats={stats} onBack={() => setCurrentView('dashboard')} selectedSecteur={selectedSecteur} sectors={sectors} uniteLabel={uniteLabel} onSecteurChange={setSelectedSecteur} />
        ) : currentView === 'stopped' ? (
          <StoppedDetailView stats={stats} onBack={() => setCurrentView('dashboard')} selectedSecteur={selectedSecteur} sectors={sectors} uniteLabel={uniteLabel} onSecteurChange={setSelectedSecteur} />
        ) : currentView === 'no_meter' ? (
          <NoMeterDetailView stats={stats} onBack={() => setCurrentView('dashboard')} selectedSecteur={selectedSecteur} sectors={sectors} uniteLabel={uniteLabel} onSecteurChange={setSelectedSecteur} />
        ) : currentView === 'creances_abonnes' ? (
          <CreancesAbonnesView onBack={() => setCurrentView('dashboard')} selectedSecteur={selectedSecteur} sectors={sectors} uniteLabel={uniteLabel} onSecteurChange={setSelectedSecteur} />
        ) : currentView === 'creances_institutions' ? (
          <CreancesInstitutionsView onBack={() => setCurrentView('dashboard')} selectedSecteur={selectedSecteur} sectors={sectors} uniteLabel={uniteLabel} onSecteurChange={setSelectedSecteur} />
        ) : currentView === 'settings' ? (
          <SettingsView onBack={() => setCurrentView('dashboard')} />
        ) : ['creance', 'repartition', 'commune'].includes(currentView) ? (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Unified Financial Suite Header */}
            <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] p-8 no-print no-print-charts-only">
              <button
                onClick={() => setCurrentView('dashboard')}
                className="flex items-center gap-2 text-sm font-bold text-[#667085] hover:text-[#101828] mb-4 transition-colors animate-in fade-in duration-200"
              >
                <ChevronRight className="rotate-180" size={16} /> Retour au tableau de bord
              </button>
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h2 className="text-3xl font-black tracking-tight text-[#101828]">Analyses Financières</h2>
                  <p className="text-sm text-[#667085] mt-1 font-medium">Facturation, recouvrement et ventilation granulaire du réseau</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Secteur dropdown */}
                  {sectors.length > 0 && (
                    <SecteurDropdown
                      sectors={sectors}
                      selectedSecteur={selectedSecteur}
                      onSelect={(code) => { setSelectedSecteur(code); setCreanceData(null); }}
                      uniteLabel={uniteLabel}
                    />
                  )}
                  {/* Modern Segmented Navigation Tabs */}
                  <div className="flex bg-[#F2F4F7] p-1.5 rounded-2xl gap-1 border border-[#E4E7EC] shadow-sm">
                    {[
                      { id: 'creance', label: 'Synthèse Globale' },
                      { id: 'repartition', label: "Répartition par Type" },
                      { id: 'commune', label: 'Répartition par Commune' }
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setCurrentView(tab.id as any)}
                        className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all duration-200 active:scale-95 border ${
                          currentView === tab.id
                            ? 'bg-white text-brand-600 shadow-sm border-[#E4E7EC]/40'
                            : 'text-[#667085] border-transparent hover:text-[#101828]'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Render Active View */}
            {currentView === 'creance' ? (
              <CreanceDetailView
                creanceData={creanceData}
                setCreanceData={setCreanceData}
                onNavigateToRepartition={(filter: 'ALL' | 'EAU' | 'PRESTATIONS') => {
                  setRepartitionFilter(filter);
                  setCurrentView('repartition');
                }}
                onCalcDateChange={(s: string, e: string) => setCalcDateRange({start: s, end: e})}
                selectedSecteur={selectedSecteur}
              />
            ) : currentView === 'repartition' ? (
              <CreanceRepartitionView
                data={creanceData}
                typeSectionFilter={repartitionFilter}
                setTypeSectionFilter={setRepartitionFilter}
                onGoToCalculation={() => setCurrentView('creance')}
                startDate={calcDateRange.start}
                endDate={calcDateRange.end}
              />
            ) : currentView === 'commune' ? (
              <CreanceCommuneView
                data={creanceData}
                onGoToCalculation={() => setCurrentView('creance')}
              />
            ) : null}
          </div>
        ) : null}
      </main>
    </div>
  );
}

function StatsCard({ title, value, icon, trend, color, onClick }: any) {
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
      className={`bg-white border border-[#E4E7EC] p-6 rounded-[2rem] shadow-sm hover:shadow-md hover:border-[#D0D5DD] transition-all group ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="flex justify-between items-start mb-6">
        <div className={`p-4 rounded-2xl transition-transform group-hover:scale-110 ${colorMap[color] || "bg-slate-50"}`}>
          {icon}
        </div>
        <span className="text-[11px] font-black uppercase tracking-widest text-[#98A2B3]">{trend}</span>
      </div>
      <div>
        <p className="text-[#475467] text-sm font-bold mb-1">{title}</p>
        <p className="text-2xl font-black text-[#101828] tracking-tight">{value}</p>
      </div>
    </div>
  );
}

function NavItem({ icon, label, active = false, onClick }: any) {
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

function DetailedStatsView({ stats, onBack }: any) {
  const [selectedCommune, setSelectedCommune] = useState<any>(null);
  const [selectedQuartier, setSelectedQuartier] = useState<any>(null);
  const [quartierSubscribers, setQuartierSubscribers] = useState<any[]>([]);
  const [loadingSubscribers, setLoadingSubscribers] = useState(false);

  const handleQuartierClick = async (q: any) => {
    setSelectedQuartier(q);
    setLoadingSubscribers(true);
    try {
      const res = await fetch(`http://127.0.0.1:8000/subscribers?quartier=${q.id}`);
      const data = await res.json();
      setQuartierSubscribers(data);
    } catch (e) {
      console.error(e);
      setQuartierSubscribers([]);
    }
    setLoadingSubscribers(false);
  };

  const communes = stats?.subscriber_communes || [];
  const types = stats?.subscriber_types || [];

  if (selectedQuartier) {
    return (
      <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] overflow-hidden">
        <div className="p-8 border-b border-[#F2F4F7] flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <button
              onClick={() => setSelectedQuartier(null)}
              className="flex items-center gap-2 text-sm font-bold text-[#667085] hover:text-[#101828] mb-4 transition-colors"
            >
              <ChevronRight className="rotate-180" size={16} /> Retour aux quartiers
            </button>
            <h3 className="text-2xl font-black tracking-tight text-[#101828]">Tous les Abonnés - {selectedQuartier.name}</h3>
            <p className="text-sm text-[#667085] mt-1">Liste nominative de tous les abonnés du quartier</p>
          </div>
        </div>
        <NominativeTable subscribers={quartierSubscribers} loading={loadingSubscribers} accentColor="blue" />
      </div>
    );
  }

  if (selectedCommune) {
    const quartiers = selectedCommune.quartiers || [];
    return (
      <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] overflow-hidden">
        <div className="p-8 border-b border-[#F2F4F7] flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <button
              onClick={() => setSelectedCommune(null)}
              className="flex items-center gap-2 text-sm font-bold text-[#667085] hover:text-[#101828] mb-4 transition-colors"
            >
              <ChevronRight className="rotate-180" size={16} /> Retour aux communes
            </button>
            <h3 className="text-2xl font-black tracking-tight text-[#101828]">Quartiers de {selectedCommune.name}</h3>
            <p className="text-sm text-[#667085] mt-1">Détail des abonnés pour chaque quartier de cette commune</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#F9FAFB] text-[#475467] text-[11px] uppercase tracking-wider font-bold">
                <th className="px-8 py-5">Quartier</th>
                <th className="px-6 py-5 text-right">Total Abonnés</th>
                <th className="px-6 py-5 text-right">Abonnés Actifs</th>
                <th className="px-6 py-5 text-right">Abonnés Résiliés</th>
                <th className="px-8 py-5 text-right">Part (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2F4F7]">
              {quartiers.length > 0 ? quartiers.map((q: any, i: number) => {
                const actifs = q.value - (q.resigned || 0);
                return (
                  <tr
                    key={i}
                    onClick={() => handleQuartierClick(q)}
                    className="hover:bg-[#F9FAFB] transition-colors group cursor-pointer"
                  >
                    <td className="px-8 py-5 font-black text-sm text-[#101828]">{q.name}</td>
                    <td className="px-6 py-5 text-right font-bold text-[#0D83DE]">{q.value.toLocaleString()}</td>
                    <td className="px-6 py-5 text-right font-medium text-emerald-600">{actifs.toLocaleString()}</td>
                    <td className="px-6 py-5 text-right font-medium text-rose-600">{q.resigned?.toLocaleString() || 0}</td>
                    <td className="px-8 py-5 text-right font-bold text-[#475467]">{q.percentage}%</td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={5} className="px-8 py-8 text-center text-[#667085] font-medium">Aucun abonné trouvé dans cette commune.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] overflow-hidden">
        <div className="p-8 border-b border-[#F2F4F7] flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-sm font-bold text-[#667085] hover:text-[#101828] mb-4 transition-colors"
            >
              <ChevronRight className="rotate-180" size={16} /> Retour au tableau de bord
            </button>
            <h3 className="text-2xl font-black tracking-tight text-[#101828]">Répartition Détaillée par Commune</h3>
            <p className="text-sm text-[#667085] mt-1">Analyse complète des abonnés par zone géographique</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#F9FAFB] text-[#475467] text-[11px] uppercase tracking-wider font-bold">
                <th className="px-8 py-5">Commune</th>
                <th className="px-6 py-5 text-right">Total Abonnés</th>
                <th className="px-6 py-5 text-right">Abonnés Actifs</th>
                <th className="px-6 py-5 text-right">Abonnés Résiliés</th>
                <th className="px-8 py-5 text-right">Part (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2F4F7]">
              {communes.map((c: any, i: number) => {
                const actifs = c.value - (c.resigned || 0);
                return (
                  <tr
                    key={i}
                    onClick={() => setSelectedCommune(c)}
                    className="hover:bg-[#F9FAFB] transition-colors group cursor-pointer"
                  >
                    <td className="px-8 py-5 font-black text-sm text-[#101828]">{c.name}</td>
                    <td className="px-6 py-5 text-right font-bold text-[#0D83DE]">{c.value.toLocaleString()}</td>
                    <td className="px-6 py-5 text-right font-medium text-emerald-600">{actifs.toLocaleString()}</td>
                    <td className="px-6 py-5 text-right font-medium text-rose-600">{c.resigned?.toLocaleString() || 0}</td>
                    <td className="px-8 py-5 text-right font-bold text-[#475467]">{c.percentage}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] overflow-hidden">
        <div className="p-8 border-b border-[#F2F4F7]">
          <h3 className="text-2xl font-black tracking-tight text-[#101828]">Répartition Détaillée par Type d'Abonné</h3>
          <p className="text-sm text-[#667085] mt-1">Analyse des abonnés classés par catégorie (Ménage, Administration, etc.)</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#F9FAFB] text-[#475467] text-[11px] uppercase tracking-wider font-bold">
                <th className="px-8 py-5">Catégorie / Type</th>
                <th className="px-6 py-5 text-right">Total Abonnés</th>
                <th className="px-6 py-5 text-right">Abonnés Actifs</th>
                <th className="px-6 py-5 text-right">Abonnés Résiliés</th>
                <th className="px-8 py-5 text-right">Part (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2F4F7]">
              {types.map((t: any, i: number) => {
                const actifs = t.value - (t.resigned || 0);
                return (
                  <tr key={i} className="hover:bg-[#F9FAFB] transition-colors group">
                    <td className="px-8 py-5 font-black text-sm text-[#101828]">{t.name}</td>
                    <td className="px-6 py-5 text-right font-bold text-[#0D83DE]">{t.value.toLocaleString()}</td>
                    <td className="px-6 py-5 text-right font-medium text-emerald-600">{actifs.toLocaleString()}</td>
                    <td className="px-6 py-5 text-right font-medium text-rose-600">{t.resigned?.toLocaleString() || 0}</td>
                    <td className="px-8 py-5 text-right font-bold text-[#475467]">{t.percentage}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ResignedDetailView({ stats, onBack }: any) {
  const [selectedCommune, setSelectedCommune] = useState<any>(null);
  const [selectedQuartier, setSelectedQuartier] = useState<any>(null);
  const [quartierSubscribers, setQuartierSubscribers] = useState<any[]>([]);
  const [loadingSubscribers, setLoadingSubscribers] = useState(false);

  const handleQuartierClick = async (q: any) => {
    setSelectedQuartier(q);
    setLoadingSubscribers(true);
    try {
      const res = await fetch(`http://127.0.0.1:8000/subscribers?quartier=${q.id}&etat=40`);
      const data = await res.json();
      setQuartierSubscribers(data);
    } catch (e) {
      console.error(e);
      setQuartierSubscribers([]);
    }
    setLoadingSubscribers(false);
  };

  // Sort by resigned descending
  const communes = [...(stats?.subscriber_communes || [])].sort((a, b) => (b.resigned || 0) - (a.resigned || 0));
  const types = [...(stats?.subscriber_types || [])].sort((a, b) => (b.resigned || 0) - (a.resigned || 0));

  if (selectedQuartier) {
    return (
      <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] overflow-hidden">
        <div className="p-8 border-b border-[#F2F4F7] flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <button
              onClick={() => setSelectedQuartier(null)}
              className="flex items-center gap-2 text-sm font-bold text-[#667085] hover:text-[#101828] mb-4 transition-colors"
            >
              <ChevronRight className="rotate-180" size={16} /> Retour aux quartiers
            </button>
            <h3 className="text-2xl font-black tracking-tight text-[#101828]">Abonnés Résiliés - {selectedQuartier.name}</h3>
            <p className="text-sm text-[#667085] mt-1">Liste nominative des compteurs résiliés (Code 40)</p>
          </div>
        </div>
        <NominativeTable subscribers={quartierSubscribers} loading={loadingSubscribers} accentColor="rose" />
      </div>
    );
  }

  if (selectedCommune) {
    const quartiers = [...(selectedCommune.quartiers || [])].sort((a, b) => (b.resigned || 0) - (a.resigned || 0));
    return (
      <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] overflow-hidden">
        <div className="p-8 border-b border-[#F2F4F7] flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <button
              onClick={() => setSelectedCommune(null)}
              className="flex items-center gap-2 text-sm font-bold text-[#667085] hover:text-[#101828] mb-4 transition-colors"
            >
              <ChevronRight className="rotate-180" size={16} /> Retour aux communes
            </button>
            <h3 className="text-2xl font-black tracking-tight text-[#101828]">Quartiers de {selectedCommune.name} (Résiliés)</h3>
            <p className="text-sm text-[#667085] mt-1">Détail des compteurs résiliés (Code 40) pour chaque quartier</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#F9FAFB] text-[#475467] text-[11px] uppercase tracking-wider font-bold">
                <th className="px-8 py-5">Quartier</th>
                <th className="px-6 py-5 text-right">Abonnés Résiliés</th>
                <th className="px-6 py-5 text-right">Total Abonnés</th>
                <th className="px-8 py-5 text-right">Taux de Résiliation (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2F4F7]">
              {quartiers.length > 0 ? quartiers.map((q: any, i: number) => {
                const taux = q.value > 0 ? ((q.resigned || 0) / q.value) * 100 : 0;
                return (
                  <tr
                    key={i}
                    onClick={() => handleQuartierClick(q)}
                    className="hover:bg-[#F9FAFB] transition-colors group cursor-pointer"
                  >
                    <td className="px-8 py-5 font-black text-sm text-[#101828]">{q.name}</td>
                    <td className="px-6 py-5 text-right font-bold text-rose-600">{q.resigned?.toLocaleString() || 0}</td>
                    <td className="px-6 py-5 text-right font-medium text-[#475467]">{q.value.toLocaleString()}</td>
                    <td className="px-8 py-5 text-right font-bold text-[#475467]">{taux.toFixed(2)}%</td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={4} className="px-8 py-8 text-center text-[#667085] font-medium">Aucun quartier trouvé.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] overflow-hidden">
        <div className="p-8 border-b border-[#F2F4F7] flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-sm font-bold text-[#667085] hover:text-[#101828] mb-4 transition-colors"
            >
              <ChevronRight className="rotate-180" size={16} /> Retour au tableau de bord
            </button>
            <h3 className="text-2xl font-black tracking-tight text-[#101828]">Répartition des Abonnés Résiliés par Commune</h3>
            <p className="text-sm text-[#667085] mt-1">Analyse détaillée des compteurs résiliés (Code 40) par zone géographique</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#F9FAFB] text-[#475467] text-[11px] uppercase tracking-wider font-bold">
                <th className="px-8 py-5">Commune</th>
                <th className="px-6 py-5 text-right">Abonnés Résiliés</th>
                <th className="px-6 py-5 text-right">Total Abonnés</th>
                <th className="px-8 py-5 text-right">Taux de Résiliation (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2F4F7]">
              {communes.map((c: any, i: number) => {
                const taux = c.value > 0 ? ((c.resigned || 0) / c.value) * 100 : 0;
                return (
                  <tr
                    key={i}
                    onClick={() => setSelectedCommune(c)}
                    className="hover:bg-[#F9FAFB] transition-colors group cursor-pointer"
                  >
                    <td className="px-8 py-5 font-black text-sm text-[#101828]">{c.name}</td>
                    <td className="px-6 py-5 text-right font-bold text-rose-600">{c.resigned?.toLocaleString() || 0}</td>
                    <td className="px-6 py-5 text-right font-medium text-[#475467]">{c.value.toLocaleString()}</td>
                    <td className="px-8 py-5 text-right font-bold text-[#475467]">{taux.toFixed(2)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] overflow-hidden">
        <div className="p-8 border-b border-[#F2F4F7]">
          <h3 className="text-2xl font-black tracking-tight text-[#101828]">Répartition des Abonnés Résiliés par Type d'Abonné</h3>
          <p className="text-sm text-[#667085] mt-1">Analyse des résiliations classées par catégorie (Ménage, Administration, etc.)</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#F9FAFB] text-[#475467] text-[11px] uppercase tracking-wider font-bold">
                <th className="px-8 py-5">Catégorie / Type</th>
                <th className="px-6 py-5 text-right">Abonnés Résiliés</th>
                <th className="px-6 py-5 text-right">Total Abonnés</th>
                <th className="px-8 py-5 text-right">Taux de Résiliation (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2F4F7]">
              {types.map((t: any, i: number) => {
                const taux = t.value > 0 ? ((t.resigned || 0) / t.value) * 100 : 0;
                return (
                  <tr key={i} className="hover:bg-[#F9FAFB] transition-colors group">
                    <td className="px-8 py-5 font-black text-sm text-[#101828]">{t.name}</td>
                    <td className="px-6 py-5 text-right font-bold text-rose-600">{t.resigned?.toLocaleString() || 0}</td>
                    <td className="px-6 py-5 text-right font-medium text-[#475467]">{t.value.toLocaleString()}</td>
                    <td className="px-8 py-5 text-right font-bold text-[#475467]">{taux.toFixed(2)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StoppedDetailView({ stats, onBack }: any) {
  const [selectedCommune, setSelectedCommune] = useState<any>(null);
  const [selectedQuartier, setSelectedQuartier] = useState<any>(null);
  const [quartierSubscribers, setQuartierSubscribers] = useState<any[]>([]);
  const [loadingSubscribers, setLoadingSubscribers] = useState(false);

  const handleQuartierClick = async (q: any) => {
    setSelectedQuartier(q);
    setLoadingSubscribers(true);
    try {
      const res = await fetch(`http://127.0.0.1:8000/subscribers?quartier=${q.id}&etat=20`);
      const data = await res.json();
      setQuartierSubscribers(data);
    } catch (e) {
      console.error(e);
      setQuartierSubscribers([]);
    }
    setLoadingSubscribers(false);
  };

  const handlePrint = () => {
    if (!selectedQuartier || !quartierSubscribers || quartierSubscribers.length === 0) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Veuillez autoriser les fenêtres pop-up pour pouvoir imprimer.");
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Liste nominative des abonnés à l'arrêt - ${selectedQuartier.name}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap');
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              color: #101828;
              margin: 40px;
              font-size: 11px;
              line-height: 1.5;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #F2F4F7;
              padding-bottom: 20px;
              margin-bottom: 25px;
            }
            .logo-section {
              display: flex;
              align-items: center;
              gap: 12px;
            }
            .logo-text {
              font-size: 14px;
              font-weight: 900;
              color: #0D83DE;
              letter-spacing: -0.5px;
              margin-bottom: 2px;
            }
            .company-name {
              font-size: 9px;
              font-weight: 700;
              color: #667085;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .title-section {
              text-align: right;
            }
            .title {
              font-size: 18px;
              font-weight: 900;
              color: #101828;
              margin: 0;
              letter-spacing: -0.5px;
            }
            .subtitle {
              font-size: 11px;
              color: #667085;
              margin: 4px 0 0 0;
              font-weight: 500;
            }
            .meta-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 15px;
              background-color: #F9FAFB;
              border: 1px solid #E4E7EC;
              border-radius: 12px;
              padding: 12px 20px;
              margin-bottom: 30px;
            }
            .meta-item {
              display: flex;
              flex-direction: column;
            }
            .meta-label {
              font-size: 9px;
              font-weight: 700;
              color: #98A2B3;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 3px;
            }
            .meta-value {
              font-size: 11px;
              font-weight: 700;
              color: #344054;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
            }
            thead {
              display: table-header-group;
            }
            tr {
              page-break-inside: avoid;
            }
            th {
              background-color: #F9FAFB;
              color: #475467;
              font-size: 9px;
              text-transform: uppercase;
              font-weight: 700;
              letter-spacing: 0.5px;
              border-bottom: 2px solid #EAECF0;
              padding: 10px 12px;
              text-align: left;
            }
            td {
              border-bottom: 1px solid #EAECF0;
              padding: 10px 12px;
              text-align: left;
              color: #475467;
            }
            .font-bold-black {
              font-weight: 700;
              color: #101828;
            }
            .tournee-badge {
              font-weight: 700;
              color: #D97706;
            }
            @media print {
              body {
                margin: 20px;
              }
              .no-print {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo-section">
              <img src="${window.location.origin}/ade.png" alt="ADE Logo" style="height: 40px; width: auto;" />
              <div style="display: flex; flex-direction: column;">
                <span class="logo-text">EPEOR Analytics</span>
                <span class="company-name">Algérienne Des Eaux</span>
              </div>
            </div>
            <div class="title-section">
              <h1 class="title">Abonnés À l'Arrêt (Code 20)</h1>
              <p class="subtitle">Liste nominative des compteurs à l'arrêt</p>
            </div>
          </div>

          <div class="meta-grid">
            <div class="meta-item">
              <span class="meta-label">Commune</span>
              <span class="meta-value">${selectedCommune?.name || '—'}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Quartier</span>
              <span class="meta-value">${selectedQuartier.name}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Date d'édition</span>
              <span class="meta-value">${new Date().toLocaleDateString('fr-FR')}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Total Abonnés</span>
              <span class="meta-value">${quartierSubscribers.length}</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 12%">N° Abonné</th>
                <th style="width: 24%">Nom / Raison Sociale</th>
                <th style="width: 24%">Adresse</th>
                <th style="width: 8%">Tournée</th>
                <th style="width: 10%">N° Série</th>
                <th style="width: 10%; text-align: right;">Nouvel Index</th>
                <th style="width: 8%">Type</th>
                <th style="width: 6%; text-align: right;">Factures à l'arrêt</th>
              </tr>
            </thead>
            <tbody>
              ${quartierSubscribers.map(sub => `
                <tr>
                  <td class="font-bold-black">${sub.numab || '—'}</td>
                  <td class="font-bold-black">${sub.name || '—'}</td>
                  <td>${[sub.adresse, sub.bloc ? `Bl. ${sub.bloc}` : '', sub.ndom ? `N°${sub.ndom}` : ''].filter(Boolean).join(' · ') || '—'}</td>
                  <td class="tournee-badge">${sub.tournee ? `T-${sub.tournee}` : '—'}</td>
                  <td>${sub.numser || '—'}</td>
                  <td style="font-weight: 700; text-align: right; color: #101828;">${sub.nouvelx !== undefined ? sub.nouvelx.toLocaleString() : '—'}</td>
                  <td>${sub.type || '—'}</td>
                  <td style="font-weight: 700; text-align: right; color: #D97706;">${sub.consecutive_etat20 ?? 0}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                setTimeout(function() { window.close(); }, 500);
              }, 300);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Sort by stopped descending
  const communes = [...(stats?.subscriber_communes || [])].sort((a, b) => (b.stopped || 0) - (a.stopped || 0));
  const types = [...(stats?.subscriber_types || [])].sort((a, b) => (b.stopped || 0) - (a.stopped || 0));

  if (selectedQuartier) {
    return (
      <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] overflow-hidden">
        <div className="p-8 border-b border-[#F2F4F7] flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <button
              onClick={() => setSelectedQuartier(null)}
              className="flex items-center gap-2 text-sm font-bold text-[#667085] hover:text-[#101828] mb-4 transition-colors"
            >
              <ChevronRight className="rotate-180" size={16} /> Retour aux quartiers
            </button>
            <h3 className="text-2xl font-black tracking-tight text-[#101828]">Abonnés À l'arrêt - {selectedQuartier.name}</h3>
            <p className="text-sm text-[#667085] mt-1">Liste nominative des compteurs à l'arrêt (Code 20)</p>
          </div>
          {!loadingSubscribers && quartierSubscribers && quartierSubscribers.length > 0 && (
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 text-amber-700 border border-amber-100 rounded-xl text-xs font-black hover:bg-amber-100 transition-all shadow-sm self-start md:self-center"
            >
              <Printer size={14} />
              Imprimer la liste
            </button>
          )}
        </div>
        <NominativeTable
          subscribers={quartierSubscribers}
          loading={loadingSubscribers}
          accentColor="amber"
          consecutiveEtatColumn={{ field: 'consecutive_etat20', label: "Factures à l'arrêt", activeClass: 'bg-amber-50 text-amber-700 border-amber-100', hoverClass: 'text-amber-700' }}
        />
      </div>
    );
  }

  if (selectedCommune) {
    const quartiers = [...(selectedCommune.quartiers || [])].sort((a, b) => (b.stopped || 0) - (a.stopped || 0));
    return (
      <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] overflow-hidden">
        <div className="p-8 border-b border-[#F2F4F7] flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <button
              onClick={() => setSelectedCommune(null)}
              className="flex items-center gap-2 text-sm font-bold text-[#667085] hover:text-[#101828] mb-4 transition-colors"
            >
              <ChevronRight className="rotate-180" size={16} /> Retour aux communes
            </button>
            <h3 className="text-2xl font-black tracking-tight text-[#101828]">Quartiers de {selectedCommune.name} (À l'arrêt)</h3>
            <p className="text-sm text-[#667085] mt-1">Détail des compteurs à l'arrêt (Code 20) pour chaque quartier</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#F9FAFB] text-[#475467] text-[11px] uppercase tracking-wider font-bold">
                <th className="px-8 py-5">Quartier</th>
                <th className="px-6 py-5 text-right">Abonnés À l'arrêt</th>
                <th className="px-6 py-5 text-right">Total Abonnés</th>
                <th className="px-8 py-5 text-right">Taux d'Arrêt (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2F4F7]">
              {quartiers.length > 0 ? quartiers.map((q: any, i: number) => {
                const taux = q.value > 0 ? ((q.stopped || 0) / q.value) * 100 : 0;
                return (
                  <tr
                    key={i}
                    onClick={() => handleQuartierClick(q)}
                    className="hover:bg-[#F9FAFB] transition-colors group cursor-pointer"
                  >
                    <td className="px-8 py-5 font-black text-sm text-[#101828]">{q.name}</td>
                    <td className="px-6 py-5 text-right font-bold text-amber-600">{q.stopped?.toLocaleString() || 0}</td>
                    <td className="px-6 py-5 text-right font-medium text-[#475467]">{q.value.toLocaleString()}</td>
                    <td className="px-8 py-5 text-right font-bold text-[#475467]">{taux.toFixed(2)}%</td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={4} className="px-8 py-8 text-center text-[#667085] font-medium">Aucun quartier trouvé.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] overflow-hidden">
        <div className="p-8 border-b border-[#F2F4F7] flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-sm font-bold text-[#667085] hover:text-[#101828] mb-4 transition-colors"
            >
              <ChevronRight className="rotate-180" size={16} /> Retour au tableau de bord
            </button>
            <h3 className="text-2xl font-black tracking-tight text-[#101828]">Répartition des Abonnés À l'Arrêt par Commune</h3>
            <p className="text-sm text-[#667085] mt-1">Analyse détaillée des compteurs à l'arrêt (Code 20) par zone géographique</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#F9FAFB] text-[#475467] text-[11px] uppercase tracking-wider font-bold">
                <th className="px-8 py-5">Commune</th>
                <th className="px-6 py-5 text-right">Abonnés À l'arrêt</th>
                <th className="px-6 py-5 text-right">Total Abonnés</th>
                <th className="px-8 py-5 text-right">Taux d'Arrêt (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2F4F7]">
              {communes.map((c: any, i: number) => {
                const taux = c.value > 0 ? ((c.stopped || 0) / c.value) * 100 : 0;
                return (
                  <tr
                    key={i}
                    onClick={() => setSelectedCommune(c)}
                    className="hover:bg-[#F9FAFB] transition-colors group cursor-pointer"
                  >
                    <td className="px-8 py-5 font-black text-sm text-[#101828]">{c.name}</td>
                    <td className="px-6 py-5 text-right font-bold text-amber-600">{c.stopped?.toLocaleString() || 0}</td>
                    <td className="px-6 py-5 text-right font-medium text-[#475467]">{c.value.toLocaleString()}</td>
                    <td className="px-8 py-5 text-right font-bold text-[#475467]">{taux.toFixed(2)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] overflow-hidden">
        <div className="p-8 border-b border-[#F2F4F7]">
          <h3 className="text-2xl font-black tracking-tight text-[#101828]">Répartition des Abonnés À l'Arrêt par Type d'Abonné</h3>
          <p className="text-sm text-[#667085] mt-1">Analyse des compteurs à l'arrêt classés par catégorie</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#F9FAFB] text-[#475467] text-[11px] uppercase tracking-wider font-bold">
                <th className="px-8 py-5">Catégorie / Type</th>
                <th className="px-6 py-5 text-right">Abonnés À l'arrêt</th>
                <th className="px-6 py-5 text-right">Total Abonnés</th>
                <th className="px-8 py-5 text-right">Taux d'Arrêt (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2F4F7]">
              {types.map((t: any, i: number) => {
                const taux = t.value > 0 ? ((t.stopped || 0) / t.value) * 100 : 0;
                return (
                  <tr key={i} className="hover:bg-[#F9FAFB] transition-colors group">
                    <td className="px-8 py-5 font-black text-sm text-[#101828]">{t.name}</td>
                    <td className="px-6 py-5 text-right font-bold text-amber-600">{t.stopped?.toLocaleString() || 0}</td>
                    <td className="px-6 py-5 text-right font-medium text-[#475467]">{t.value.toLocaleString()}</td>
                    <td className="px-8 py-5 text-right font-bold text-[#475467]">{taux.toFixed(2)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function NoMeterDetailView({ stats, onBack }: any) {
  const [selectedCommune, setSelectedCommune] = useState<any>(null);
  const [selectedQuartier, setSelectedQuartier] = useState<any>(null);
  const [quartierSubscribers, setQuartierSubscribers] = useState<any[]>([]);
  const [loadingSubscribers, setLoadingSubscribers] = useState(false);

  const handleQuartierClick = async (q: any) => {
    setSelectedQuartier(q);
    setLoadingSubscribers(true);
    try {
      const res = await fetch(`http://127.0.0.1:8000/subscribers?quartier=${q.id}&etat=30`);
      const data = await res.json();
      setQuartierSubscribers(data);
    } catch (e) {
      console.error(e);
      setQuartierSubscribers([]);
    }
    setLoadingSubscribers(false);
  };

  const handlePrint = () => {
    if (!selectedQuartier || !quartierSubscribers || quartierSubscribers.length === 0) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Veuillez autoriser les fenêtres pop-up pour pouvoir imprimer.");
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Liste nominative des abonnés sans compteur - ${selectedQuartier.name}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap');
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              color: #101828;
              margin: 40px;
              font-size: 11px;
              line-height: 1.5;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #F2F4F7;
              padding-bottom: 20px;
              margin-bottom: 25px;
            }
            .logo-section {
              display: flex;
              align-items: center;
              gap: 12px;
            }
            .logo-text {
              font-size: 14px;
              font-weight: 900;
              color: #0D83DE;
              letter-spacing: -0.5px;
              margin-bottom: 2px;
            }
            .company-name {
              font-size: 9px;
              font-weight: 700;
              color: #667085;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .title-section {
              text-align: right;
            }
            .title {
              font-size: 18px;
              font-weight: 900;
              color: #101828;
              margin: 0;
              letter-spacing: -0.5px;
            }
            .subtitle {
              font-size: 11px;
              color: #667085;
              margin: 4px 0 0 0;
              font-weight: 500;
            }
            .meta-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 15px;
              background-color: #F9FAFB;
              border: 1px solid #E4E7EC;
              border-radius: 12px;
              padding: 12px 20px;
              margin-bottom: 30px;
            }
            .meta-item {
              display: flex;
              flex-direction: column;
            }
            .meta-label {
              font-size: 9px;
              font-weight: 700;
              color: #98A2B3;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 3px;
            }
            .meta-value {
              font-size: 11px;
              font-weight: 700;
              color: #344054;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
            }
            thead {
              display: table-header-group;
            }
            tr {
              page-break-inside: avoid;
            }
            th {
              background-color: #F9FAFB;
              color: #475467;
              font-size: 9px;
              text-transform: uppercase;
              font-weight: 700;
              letter-spacing: 0.5px;
              border-bottom: 2px solid #EAECF0;
              padding: 10px 12px;
              text-align: left;
            }
            td {
              border-bottom: 1px solid #EAECF0;
              padding: 10px 12px;
              text-align: left;
              color: #475467;
            }
            .font-bold-black {
              font-weight: 700;
              color: #101828;
            }
            .tournee-badge {
              font-weight: 700;
              color: #0d9488;
            }
            @media print {
              body {
                margin: 20px;
              }
              .no-print {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo-section">
              <img src="${window.location.origin}/ade.png" alt="ADE Logo" style="height: 40px; width: auto;" />
              <div style="display: flex; flex-direction: column;">
                <span class="logo-text">EPEOR Analytics</span>
                <span class="company-name">Algérienne Des Eaux</span>
              </div>
            </div>
            <div class="title-section">
              <h1 class="title">Abonnés Sans Compteur (Code 30)</h1>
              <p class="subtitle">Liste nominative des branchements sans appareil de mesure</p>
            </div>
          </div>

          <div class="meta-grid">
            <div class="meta-item">
              <span class="meta-label">Commune</span>
              <span class="meta-value">${selectedCommune?.name || '—'}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Quartier</span>
              <span class="meta-value">${selectedQuartier.name}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Date d'édition</span>
              <span class="meta-value">${new Date().toLocaleDateString('fr-FR')}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Total Abonnés</span>
              <span class="meta-value">${quartierSubscribers.length}</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 12%">N° Abonné</th>
                <th style="width: 24%">Nom / Raison Sociale</th>
                <th style="width: 24%">Adresse</th>
                <th style="width: 8%">Tournée</th>
                <th style="width: 10%">N° Série</th>
                <th style="width: 10%; text-align: right;">Nouvel Index</th>
                <th style="width: 8%">Type</th>
                <th style="width: 6%; text-align: right;">Factures sans compteur</th>
              </tr>
            </thead>
            <tbody>
              ${quartierSubscribers.map(sub => `
                <tr>
                  <td class="font-bold-black">${sub.numab || '—'}</td>
                  <td class="font-bold-black">${sub.name || '—'}</td>
                  <td>${[sub.adresse, sub.bloc ? `Bl. ${sub.bloc}` : '', sub.ndom ? `N°${sub.ndom}` : ''].filter(Boolean).join(' · ') || '—'}</td>
                  <td class="tournee-badge">${sub.tournee ? `T-${sub.tournee}` : '—'}</td>
                  <td>${sub.numser || '—'}</td>
                  <td style="font-weight: 700; text-align: right; color: #101828;">${sub.nouvelx !== undefined ? sub.nouvelx.toLocaleString() : '—'}</td>
                  <td>${sub.type || '—'}</td>
                  <td style="font-weight: 700; text-align: right; color: #0d9488;">${sub.consecutive_etat30 ?? 0}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                setTimeout(function() { window.close(); }, 500);
              }, 300);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Sort by no_meter descending
  const communes = [...(stats?.subscriber_communes || [])].sort((a, b) => (b.no_meter || 0) - (a.no_meter || 0));
  const types = [...(stats?.subscriber_types || [])].sort((a, b) => (b.no_meter || 0) - (a.no_meter || 0));

  if (selectedQuartier) {
    return (
      <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] overflow-hidden">
        <div className="p-8 border-b border-[#F2F4F7] flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <button
              onClick={() => setSelectedQuartier(null)}
              className="flex items-center gap-2 text-sm font-bold text-[#667085] hover:text-[#101828] mb-4 transition-colors"
            >
              <ChevronRight className="rotate-180" size={16} /> Retour aux quartiers
            </button>
            <h3 className="text-2xl font-black tracking-tight text-[#101828]">Abonnés Sans Compteur - {selectedQuartier.name}</h3>
            <p className="text-sm text-[#667085] mt-1">Liste nominative des abonnés sans compteur (Code 30)</p>
          </div>
          {!loadingSubscribers && quartierSubscribers && quartierSubscribers.length > 0 && (
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2.5 bg-cyan-50 text-cyan-700 border border-cyan-100 rounded-xl text-xs font-black hover:bg-cyan-100 transition-all shadow-sm self-start md:self-center"
            >
              <Printer size={14} />
              Imprimer la liste
            </button>
          )}
        </div>
        <NominativeTable
          subscribers={quartierSubscribers}
          loading={loadingSubscribers}
          accentColor="cyan"
          consecutiveEtatColumn={{ field: 'consecutive_etat30', label: 'Factures sans compteur', activeClass: 'bg-cyan-50 text-cyan-700 border-cyan-100', hoverClass: 'text-cyan-700' }}
        />
      </div>
    );
  }

  if (selectedCommune) {
    const quartiers = [...(selectedCommune.quartiers || [])].sort((a, b) => (b.no_meter || 0) - (a.no_meter || 0));
    return (
      <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] overflow-hidden">
        <div className="p-8 border-b border-[#F2F4F7] flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <button
              onClick={() => setSelectedCommune(null)}
              className="flex items-center gap-2 text-sm font-bold text-[#667085] hover:text-[#101828] mb-4 transition-colors"
            >
              <ChevronRight className="rotate-180" size={16} /> Retour aux communes
            </button>
            <h3 className="text-2xl font-black tracking-tight text-[#101828]">Quartiers de {selectedCommune.name} (Sans Compteur)</h3>
            <p className="text-sm text-[#667085] mt-1">Détail des abonnés sans compteur (Code 30) pour chaque quartier</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#F9FAFB] text-[#475467] text-[11px] uppercase tracking-wider font-bold">
                <th className="px-8 py-5">Quartier</th>
                <th className="px-6 py-5 text-right">Abonnés Sans Compteur</th>
                <th className="px-6 py-5 text-right">Total Abonnés</th>
                <th className="px-8 py-5 text-right">Taux (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2F4F7]">
              {quartiers.length > 0 ? quartiers.map((q: any, i: number) => {
                const taux = q.value > 0 ? ((q.no_meter || 0) / q.value) * 100 : 0;
                return (
                  <tr
                    key={i}
                    onClick={() => handleQuartierClick(q)}
                    className="hover:bg-[#F9FAFB] transition-colors group cursor-pointer"
                  >
                    <td className="px-8 py-5 font-black text-sm text-[#101828]">{q.name}</td>
                    <td className="px-6 py-5 text-right font-bold text-cyan-600">{q.no_meter?.toLocaleString() || 0}</td>
                    <td className="px-6 py-5 text-right font-medium text-[#475467]">{q.value.toLocaleString()}</td>
                    <td className="px-8 py-5 text-right font-bold text-[#475467]">{taux.toFixed(2)}%</td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={4} className="px-8 py-8 text-center text-[#667085] font-medium">Aucun quartier trouvé.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] overflow-hidden">
        <div className="p-8 border-b border-[#F2F4F7] flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-sm font-bold text-[#667085] hover:text-[#101828] mb-4 transition-colors"
            >
              <ChevronRight className="rotate-180" size={16} /> Retour au tableau de bord
            </button>
            <h3 className="text-2xl font-black tracking-tight text-[#101828]">Répartition des Abonnés Sans Compteur par Commune</h3>
            <p className="text-sm text-[#667085] mt-1">Analyse détaillée des abonnés sans compteur (Code 30) par zone géographique</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#F9FAFB] text-[#475467] text-[11px] uppercase tracking-wider font-bold">
                <th className="px-8 py-5">Commune</th>
                <th className="px-6 py-5 text-right">Abonnés Sans Compteur</th>
                <th className="px-6 py-5 text-right">Total Abonnés</th>
                <th className="px-8 py-5 text-right">Taux (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2F4F7]">
              {communes.map((c: any, i: number) => {
                const taux = c.value > 0 ? ((c.no_meter || 0) / c.value) * 100 : 0;
                return (
                  <tr
                    key={i}
                    onClick={() => setSelectedCommune(c)}
                    className="hover:bg-[#F9FAFB] transition-colors group cursor-pointer"
                  >
                    <td className="px-8 py-5 font-black text-sm text-[#101828]">{c.name}</td>
                    <td className="px-6 py-5 text-right font-bold text-cyan-600">{c.no_meter?.toLocaleString() || 0}</td>
                    <td className="px-6 py-5 text-right font-medium text-[#475467]">{c.value.toLocaleString()}</td>
                    <td className="px-8 py-5 text-right font-bold text-[#475467]">{taux.toFixed(2)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] overflow-hidden">
        <div className="p-8 border-b border-[#F2F4F7]">
          <h3 className="text-2xl font-black tracking-tight text-[#101828]">Répartition des Abonnés Sans Compteur par Type</h3>
          <p className="text-sm text-[#667085] mt-1">Analyse des abonnés sans compteur classés par catégorie</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#F9FAFB] text-[#475467] text-[11px] uppercase tracking-wider font-bold">
                <th className="px-8 py-5">Catégorie / Type</th>
                <th className="px-6 py-5 text-right">Abonnés Sans Compteur</th>
                <th className="px-6 py-5 text-right">Total Abonnés</th>
                <th className="px-8 py-5 text-right">Taux (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2F4F7]">
              {types.map((t: any, i: number) => {
                const taux = t.value > 0 ? ((t.no_meter || 0) / t.value) * 100 : 0;
                return (
                  <tr key={i} className="hover:bg-[#F9FAFB] transition-colors group">
                    <td className="px-8 py-5 font-black text-sm text-[#101828]">{t.name}</td>
                    <td className="px-6 py-5 text-right font-bold text-cyan-600">{t.no_meter?.toLocaleString() || 0}</td>
                    <td className="px-6 py-5 text-right font-medium text-[#475467]">{t.value.toLocaleString()}</td>
                    <td className="px-8 py-5 text-right font-bold text-[#475467]">{taux.toFixed(2)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function etatBadge(etatcpt: string, etatLabel?: string) {
  const label = etatLabel || etatcpt || '—';
  const leading = (etatcpt || '').charAt(0);
  switch (leading) {
    case '1': // 10-19: active states
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">{label}</span>;
    case '2': // 20-29: stopped states
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">{label}</span>;
    case '3': // 30-39: no meter
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200 whitespace-nowrap">{label}</span>;
    case '4': // 40-49: cancelled
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap">{label}</span>;
    default:
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-50 text-slate-500 border border-slate-200 whitespace-nowrap">{label}</span>;
  }
}

function NominativeTable({ subscribers, loading, accentColor = "blue", consecutiveEtatColumn }: { subscribers: any[]; loading: boolean; accentColor?: string; consecutiveEtatColumn?: { field: string; label: string; activeClass: string; hoverClass: string } }) {
  const [hoveredSub, setHoveredSub] = useState<any>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const accentMap: any = {
    blue: { spinner: "border-[#0D83DE]", badge: "bg-blue-50 text-[#0D83DE] border-blue-200", dot: "bg-[#0D83DE]" },
    rose: { spinner: "border-rose-500", badge: "bg-rose-50 text-rose-600 border-rose-200", dot: "bg-rose-500" },
    amber: { spinner: "border-amber-500", badge: "bg-amber-50 text-amber-600 border-amber-200", dot: "bg-amber-500" },
    cyan: { spinner: "border-cyan-500", badge: "bg-cyan-50 text-cyan-600 border-cyan-200", dot: "bg-cyan-500" },
  };
  const style = accentMap[accentColor] || accentMap.blue;

  return (
    <div className="overflow-x-auto relative">
      {/* Hover Tooltip Card */}
      {hoveredSub && (
        <div
          className="fixed z-[9999] pointer-events-none transition-opacity duration-150"
          style={{ top: mousePos.y + 18, left: Math.min(mousePos.x + 18, window.innerWidth - 340) }}
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-[#E4E7EC] p-5 w-80">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-[#F2F4F7]">
              <div className={`p-2.5 rounded-xl border ${style.badge}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-[#101828] text-sm truncate">{hoveredSub.name}</p>
                <p className="text-[11px] font-bold text-[#667085] mt-0.5">N° {hoveredSub.numab}</p>
              </div>
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${style.dot}`}></div>
            </div>
            {/* Info rows */}
            <div className="space-y-2.5">
              <div className="flex justify-between items-start gap-3">
                <span className="text-[10px] font-bold text-[#98A2B3] uppercase tracking-wider whitespace-nowrap">Adresse</span>
                <span className="text-[12px] font-medium text-[#475467] text-right leading-tight">
                  {[hoveredSub.adresse, hoveredSub.bloc ? `Bl. ${hoveredSub.bloc}` : '', hoveredSub.ndom ? `N°${hoveredSub.ndom}` : ''].filter(Boolean).join(' · ') || '—'}
                </span>
              </div>
              <div className="flex justify-between items-center gap-3">
                <span className="text-[10px] font-bold text-[#98A2B3] uppercase tracking-wider">Tournée</span>
                <span className="text-[12px] font-bold text-[#0D83DE]">{hoveredSub.tournee ? `T-${hoveredSub.tournee}` : '—'}</span>
              </div>
              <div className="flex justify-between items-center gap-3">
                <span className="text-[10px] font-bold text-[#98A2B3] uppercase tracking-wider">N° Série</span>
                <span className="text-[12px] font-medium text-[#475467]">{hoveredSub.numser || '—'}</span>
              </div>
              {hoveredSub.nouvelx !== undefined && (
                <div className="flex justify-between items-center gap-3">
                  <span className="text-[10px] font-bold text-[#98A2B3] uppercase tracking-wider">Nouvel Index</span>
                  <span className="text-[12px] font-bold text-[#101828]">{hoveredSub.nouvelx.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between items-center gap-3">
                <span className="text-[10px] font-bold text-[#98A2B3] uppercase tracking-wider">Type</span>
                <span className="text-[12px] font-medium text-[#475467] text-right">{hoveredSub.type || '—'}</span>
              </div>
              <div className="flex justify-between items-center gap-3">
                <span className="text-[10px] font-bold text-[#98A2B3] uppercase tracking-wider">État</span>
                <span className="text-[12px]">{etatBadge(hoveredSub.etatcpt, hoveredSub.etat_label)}</span>
              </div>
              {consecutiveEtatColumn && (
                <div className="flex justify-between items-center gap-3">
                  <span className="text-[10px] font-bold text-[#98A2B3] uppercase tracking-wider">{consecutiveEtatColumn.label}</span>
                  <span className={`text-[12px] font-black ${consecutiveEtatColumn.hoverClass}`}>{hoveredSub[consecutiveEtatColumn.field] ?? 0}</span>
                </div>
              )}
              <div className="flex justify-between items-center gap-3">
                <span className="text-[10px] font-bold text-[#98A2B3] uppercase tracking-wider">N° Ordre</span>
                <span className="text-[12px] font-medium text-[#475467]">{hoveredSub.numordre || '—'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="p-12 flex justify-center items-center">
          <div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${style.spinner}`}></div>
        </div>
      ) : (
        <PaginatedNominativeTable subscribers={subscribers} style={style} setHoveredSub={setHoveredSub} setMousePos={setMousePos} consecutiveEtatColumn={consecutiveEtatColumn} />
      )}
    </div>
  );
}

function PaginatedNominativeTable({ subscribers, style, setHoveredSub, setMousePos, consecutiveEtatColumn }: any) {
  const ITEMS_PER_PAGE = 20;
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<string>('numab');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [filterText, setFilterText] = useState('');
  const [selectedSubForInvoices, setSelectedSubForInvoices] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [invoicePage, setInvoicePage] = useState(1);
  const [invoiceFilter, setInvoiceFilter] = useState<'ALL' | 'PAID' | 'UNPAID'>('ALL');
  const INVOICES_PER_PAGE = 20;

  const handleRowClick = async (sub: any) => {
    setSelectedSubForInvoices(sub);
    setLoadingInvoices(true);
    setInvoicePage(1);
    try {
      const res = await fetch(`http://127.0.0.1:8000/abonne_factures?numab=${sub.numab}`);
      const data = await res.json();
      setInvoices(data || []);
    } catch (e) {
      console.error(e);
      setInvoices([]);
    }
    setLoadingInvoices(false);
  };

  if (selectedSubForInvoices) {
    const formatYMD = (d: string) => {
      if (!d || d.length !== 8) return d;
      return `${d.substring(6, 8)}-${d.substring(4, 6)}-${d.substring(0, 4)}`;
    };

    const formatDatFact = (d: string, p: string) => {
      if (!d || d.length !== 8) return d;
      const year = d.substring(0, 4);
      const month = d.substring(4, 6);

      const numP = Number(p);
      if (numP === 3) {
        if (month === '03') return `1er Trim ${year}`;
        if (month === '06') return `2ème Trim ${year}`;
        if (month === '09') return `3ème Trim ${year}`;
        if (month === '12') return `4ème Trim ${year}`;
      }

      return `${month}-${year}`;
    };

    const formatInvoiceRef = (d: string, type: string) => {
      if (!d || d.length !== 8) return `---/${type || ''}`;
      const year = d.substring(0, 4);
      const month = d.substring(4, 6);
      return `${month}-${year}/${type || ''}`;
    };

    const formatModalite = (m: string) => {
      if (!m) return '---';
      const mod = m.trim().toUpperCase();
      const map: Record<string, string> = {
        'ES': 'Espèce',
        'VB': 'Virement bancaire',
        'VP': 'Virement Postal',
        'CB': 'Chèque bancaire',
        'CP': 'Chèque Postal',
        'PT': 'Paiement par TPE',
        'EP': 'Paiement en ligne',
        'MP': 'Paiement mobile'
      };
      return map[mod] || mod;
    };

    const filteredInvoices = invoices
      .filter((inv: any) => {
        const isPaid = inv.DATREG && inv.DATREG.trim() !== '' && inv.DATREG !== '00000000' && inv.DATREG !== '19000101';
        if (invoiceFilter === 'PAID') return isPaid;
        if (invoiceFilter === 'UNPAID') return !isPaid;
        return true;
      })
      .sort((a: any, b: any) => {
        const da = a.DATFACT || '';
        const db = b.DATFACT || '';
        return da.localeCompare(db);
      });

    const totals = filteredInvoices.reduce((acc: any, inv: any) => {
      const isPaid = inv.DATREG && inv.DATREG.trim() !== '' && inv.DATREG !== '00000000' && inv.DATREG !== '19000101';
      const amount = parseFloat(inv.MONTTC) || 0;
      if (isPaid) {
        acc.paidAmount += amount;
        acc.paidCount += 1;
      } else {
        acc.unpaidAmount += amount;
        acc.unpaidCount += 1;
      }
      return acc;
    }, { paidAmount: 0, paidCount: 0, unpaidAmount: 0, unpaidCount: 0 });

    const handlePrintInvoices = async () => {
      const doc = new jsPDF("p", "pt", "a4");
      const pageWidth = doc.internal.pageSize.width;

      // HEADER
      const loadImage = (url: string): Promise<HTMLImageElement> => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.src = url;
          img.onload = () => resolve(img);
          img.onerror = (e) => reject(e);
        });
      };

      try {
        const logoImg = await loadImage("/ade.png");
        doc.addImage(logoImg, "PNG", 40, 25, 150, 45);
      } catch (e) {
        console.error("Failed to load logo, falling back to text:", e);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.setTextColor(13, 131, 222);
        doc.text("Algérienne Des Eaux", 40, 40);
      }

      // TITLE
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(16, 24, 40);
      doc.text("HISTORIQUE DES FACTURES", pageWidth / 2, 45, { align: 'center' });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(71, 84, 103);
      doc.text("Unité : 26 - MEDEA", pageWidth - 40, 35, { align: 'right' });
      doc.text("Centre : S02 - BERROUAGHIA", pageWidth - 40, 47, { align: 'right' });

      // SUBSCRIBER INFO BOX
      doc.setDrawColor(228, 231, 236);
      doc.setFillColor(249, 250, 251);
      doc.roundedRect(40, 105, pageWidth - 80, 75, 5, 5, 'FD');

      doc.setFontSize(9);
      doc.setTextColor(102, 112, 133);
      doc.text("Abonné :", 50, 125);
      doc.text("Réf :", 50, 140);
      doc.text("Adresse :", 50, 155);
      doc.text("Type :", 50, 170);

      doc.text("Tournée :", pageWidth / 2 + 20, 125);
      doc.text("État :", pageWidth / 2 + 20, 140);
      doc.text("Compteur :", pageWidth / 2 + 20, 155);

      doc.setTextColor(16, 24, 40);
      doc.setFont("helvetica", "normal");
      doc.text(selectedSubForInvoices.name || '---', 105, 125);
      doc.text(selectedSubForInvoices.numab || '---', 105, 140);
      const addr = [selectedSubForInvoices.adresse, selectedSubForInvoices.bloc ? `Bl. ${selectedSubForInvoices.bloc}` : '', selectedSubForInvoices.ndom ? `N°${selectedSubForInvoices.ndom}` : ''].filter(Boolean).join(' · ') || '---';
      doc.text(addr, 105, 155);
      doc.text(selectedSubForInvoices.type || '---', 105, 170);

      doc.text(selectedSubForInvoices.tournee ? `T-${selectedSubForInvoices.tournee}` : '---', pageWidth / 2 + 80, 125);
      const etatLabel = selectedSubForInvoices.etat_label || selectedSubForInvoices.etatcpt || '---';
      doc.text(etatLabel, pageWidth / 2 + 80, 140);
      doc.text(selectedSubForInvoices.numser || '---', pageWidth / 2 + 80, 155);

      // FILTER & SUMMARY INFO
      doc.setFont("helvetica", "bold");
      doc.setTextColor(102, 112, 133);
      doc.text(`Filtre : ${invoiceFilter === 'ALL' ? 'Toutes les factures' : invoiceFilter === 'PAID' ? 'Factures payées' : 'Factures impayées'}`, 40, 205);

      const formatPDFNumber = (num: number) => num.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\u202F/g, ' ').replace(/\s/g, ' ');

      const totalTtc = filteredInvoices.reduce((acc: number, inv: any) => acc + (parseFloat(inv.MONTTC) || 0), 0);
      doc.text(`Total : ${formatPDFNumber(totalTtc)} DA (${filteredInvoices.length} factures)`, pageWidth - 40, 205, { align: 'right' });

      // TABLE
      const tableColumn = ["Date", "Référence", "Type", "Montant (DA)", "Date Regl.", "Modalité", "Statut", "Reçu/Chèque"];
      const tableRows: any[] = [];

      filteredInvoices.forEach((inv: any) => {
        const isPaid = inv.DATREG && inv.DATREG.trim() !== '' && inv.DATREG !== '00000000' && inv.DATREG !== '19000101';
        tableRows.push([
          formatDatFact(inv.DATFACT, inv.PERIODE),
          formatInvoiceRef(inv.DATFACT, inv.TYPE),
          inv.TYPE || '---',
          formatPDFNumber(parseFloat(inv.MONTTC)),
          isPaid ? formatYMD(inv.DATREG) : '---',
          formatModalite(inv.MODALITE),
          isPaid ? 'Payé' : 'Impayé',
          (inv.NUMREC || inv.CHEQUE) ? `${inv.NUMREC || ''} ${inv.CHEQUE || ''}`.trim() : '---'
        ]);
      });

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        foot: [
          ["Total Payé", "", "", `${formatPDFNumber(totals.paidAmount)} DA`, "", "", `${totals.paidCount} fact.`, ""],
          ["Total Impayé", "", "", `${formatPDFNumber(totals.unpaidAmount)} DA`, "", "", `${totals.unpaidCount} fact.`, ""]
        ],
        showFoot: 'lastPage',
        startY: 215,
        theme: 'grid',
        styles: { fontSize: 8, font: 'helvetica' },
        headStyles: { fillColor: [13, 131, 222], textColor: 255, fontStyle: 'bold' },
        footStyles: { fillColor: [245, 247, 250], textColor: [16, 24, 40], fontStyle: 'bold' },
        columnStyles: {
          2: { halign: 'right' },
          3: { halign: 'center' },
          5: { halign: 'center' }
        },
        alternateRowStyles: { fillColor: [249, 250, 251] },
      });

      doc.autoPrint();
      const blob = doc.output('blob');
      const blobUrl = URL.createObjectURL(blob);
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.src = blobUrl;
      document.body.appendChild(iframe);
      iframe.onload = () => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
          URL.revokeObjectURL(blobUrl);
        }, 2000);
      };
    };

    return (
      <div className="bg-white flex flex-col animate-in fade-in duration-300">
        <div className="p-6 border-b border-[#F2F4F7] flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#F9FAFB]">
          <button onClick={() => setSelectedSubForInvoices(null)} className="self-start flex items-center gap-2 text-sm font-bold text-[#667085] hover:text-[#101828] transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="rotate-180"><path d="m9 18 6-6-6-6" /></svg> Retour à la liste
          </button>

          <div className="flex items-center gap-2">
            <label htmlFor="invoice-filter" className="text-[11px] font-bold text-[#667085] uppercase tracking-wider">Filtrer :</label>
            <div className="relative">
              <select
                id="invoice-filter"
                value={invoiceFilter}
                onChange={(e) => { setInvoiceFilter(e.target.value as any); setInvoicePage(1); }}
                className="pl-3 pr-9 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs font-bold text-[#101828] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0D83DE]/20 focus:border-[#0D83DE] transition-all cursor-pointer appearance-none"
              >
                <option value="ALL">Toutes les factures</option>
                <option value="PAID">Factures payées</option>
                <option value="UNPAID">Factures impayées</option>
              </select>
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#667085]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
              </div>
            </div>

            <div className="h-6 w-px bg-[#E4E7EC] mx-1"></div>

            <button
              onClick={handlePrintInvoices}
              disabled={filteredInvoices.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs font-bold text-[#475467] hover:bg-gray-50 hover:text-[#101828] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              title="Imprimer cette liste"
            >
              <Printer size={14} /> Imprimer
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-x-auto p-0">
          {loadingInvoices ? (
            <div className="flex justify-center items-center py-20">
              <div className={`animate-spin rounded-full h-10 w-10 border-b-2 ${style.spinner}`}></div>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F9FAFB] text-[#475467] text-[11px] uppercase tracking-wider font-bold">
                  <th className="px-6 py-5 border-b border-[#F2F4F7]">Période</th>
                  <th className="px-6 py-5 border-b border-[#F2F4F7]">Référence</th>
                  <th className="px-6 py-5 border-b border-[#F2F4F7]">Type</th>
                  <th className="px-6 py-5 border-b border-[#F2F4F7] text-right">Montant TTC</th>
                  <th className="px-6 py-5 border-b border-[#F2F4F7] text-right">Date Règlement</th>
                  <th className="px-6 py-5 border-b border-[#F2F4F7] text-right">Modalité</th>
                  <th className="px-6 py-5 border-b border-[#F2F4F7] text-center">Statut</th>
                  <th className="px-6 py-5 border-b border-[#F2F4F7] text-right">N° Reçu</th>
                  <th className="px-6 py-5 border-b border-[#F2F4F7] text-right">N° Chèque / Versement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2F4F7]">
                {filteredInvoices.length > 0 ? filteredInvoices.slice((invoicePage - 1) * INVOICES_PER_PAGE, invoicePage * INVOICES_PER_PAGE).map((inv: any, i: number) => {
                  const isPaid = inv.DATREG && inv.DATREG.trim() !== '' && inv.DATREG !== '00000000' && inv.DATREG !== '19000101';
                  return (
                    <tr key={i} className="hover:bg-[#F9FAFB] transition-colors">
                      <td className="px-6 py-4 font-bold text-[13px] text-[#101828]">{formatDatFact(inv.DATFACT, inv.PERIODE)}</td>
                      <td className="px-6 py-4 font-medium text-[13px] text-[#0D83DE] font-mono">{formatInvoiceRef(inv.DATFACT, inv.TYPE)}</td>
                      <td className="px-6 py-4 font-medium text-[13px] text-[#667085]">{inv.TYPE || '---'}</td>
                      <td className="px-6 py-4 font-black text-[13px] text-[#101828] text-right">{inv.MONTTC.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DA</td>
                      <td className="px-6 py-4 font-medium text-[13px] text-[#475467] text-right">{isPaid ? formatYMD(inv.DATREG) : '---'}</td>
                      <td className="px-6 py-4 font-medium text-[13px] text-[#667085] text-right">{formatModalite(inv.MODALITE)}</td>
                      <td className="px-6 py-4 text-center">
                        {isPaid ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100 uppercase">Payé</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-100 uppercase">Impayé</span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-mono text-[12px] text-[#667085] text-right">{inv.NUMREC || '---'}</td>
                      <td className="px-6 py-4 font-mono text-[12px] text-[#667085] text-right">{inv.CHEQUE || '---'}</td>
                    </tr>
                  )
                }) : (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-[#667085] font-medium">Aucune facture trouvée avec ce filtre.</td>
                  </tr>
                )}
              </tbody>
              {filteredInvoices.length > 0 && (
                <tfoot>
                  <tr className="bg-emerald-50/40 font-bold border-t border-[#E4E7EC]">
                    <td colSpan={3} className="px-6 py-4 text-xs font-bold text-emerald-800 uppercase tracking-wider">Total Factures Payées</td>
                    <td className="px-6 py-4 text-right text-[13px] font-black text-emerald-700 font-mono">
                      {totals.paidAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DA
                    </td>
                    <td colSpan={5} className="px-6 py-4 text-left text-xs text-emerald-600 font-medium">
                      ({totals.paidCount} facture{totals.paidCount > 1 ? 's' : ''})
                    </td>
                  </tr>
                  <tr className="bg-rose-50/40 font-bold border-t border-[#E4E7EC]">
                    <td colSpan={3} className="px-6 py-4 text-xs font-bold text-rose-800 uppercase tracking-wider">Total Factures Impayées</td>
                    <td className="px-6 py-4 text-right text-[13px] font-black text-rose-700 font-mono">
                      {totals.unpaidAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DA
                    </td>
                    <td colSpan={5} className="px-6 py-4 text-left text-xs text-rose-600 font-medium">
                      ({totals.unpaidCount} facture{totals.unpaidCount > 1 ? 's' : ''})
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>

        {/* Invoice Pagination Footer */}
        {filteredInvoices.length > 0 && !loadingInvoices && (
          <div className="px-6 py-4 bg-[#F9FAFB] border-t border-[#F2F4F7] flex items-center justify-between rounded-b-2xl">
            <p className="text-xs font-bold text-[#667085]">
              Affichage {(invoicePage - 1) * INVOICES_PER_PAGE + 1}–{Math.min(invoicePage * INVOICES_PER_PAGE, filteredInvoices.length)} sur{" "}
              <span className="text-[#101828]">{filteredInvoices.length}</span> factures
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setInvoicePage(p => Math.max(1, p - 1))}
                disabled={invoicePage === 1}
                className="px-4 py-2 border border-[#D0D5DD] rounded-xl text-xs font-bold bg-white disabled:opacity-40 hover:bg-[#F2F4F7] transition-colors"
              >
                ← Précédent
              </button>
              <span className="px-4 py-2 text-xs font-bold text-[#475467]">
                Page {invoicePage} / {Math.max(1, Math.ceil(filteredInvoices.length / INVOICES_PER_PAGE))}
              </span>
              <button
                onClick={() => setInvoicePage(p => Math.min(Math.ceil(filteredInvoices.length / INVOICES_PER_PAGE), p + 1))}
                disabled={invoicePage === Math.max(1, Math.ceil(filteredInvoices.length / INVOICES_PER_PAGE))}
                className="px-4 py-2 border border-[#D0D5DD] rounded-xl text-xs font-bold bg-white disabled:opacity-40 hover:bg-[#F2F4F7] transition-colors"
              >
                Suivant →
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  };

  // Filter subscribers
  const filtered = subscribers.filter((sub: any) => {
    if (!filterText) return true;
    const q = filterText.toLowerCase();
    return (
      (sub.numab || '').toLowerCase().includes(q) ||
      (sub.name || '').toLowerCase().includes(q) ||
      (sub.adresse || '').toLowerCase().includes(q) ||
      (sub.numser || '').toLowerCase().includes(q) ||
      (sub.type || '').toLowerCase().includes(q) ||
      (sub.etat_label || '').toLowerCase().includes(q) ||
      (sub.tournee || '').toLowerCase().includes(q)
    );
  });

  // Sort subscribers
  const sorted = [...filtered].sort((a: any, b: any) => {
    if (consecutiveEtatColumn && sortKey === consecutiveEtatColumn.field) {
      const na = Number(a[consecutiveEtatColumn.field]) || 0;
      const nb = Number(b[consecutiveEtatColumn.field]) || 0;
      const cmp = na - nb;
      return sortDir === 'asc' ? cmp : -cmp;
    }
    const va = (a[sortKey] ?? '').toString().toLowerCase();
    const vb = (b[sortKey] ?? '').toString().toLowerCase();
    const cmp = va.localeCompare(vb, 'fr', { numeric: true });
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * ITEMS_PER_PAGE;
  const pageItems = sorted.slice(start, start + ITEMS_PER_PAGE);

  // Sortable header cell
  const Th = ({ label, field, align = 'left', px = 'px-6' }: { label: string; field: string; align?: string; px?: string }) => {
    const active = sortKey === field;
    return (
      <th
        className={`${px} py-5 ${align === 'right' ? 'text-right' : ''} cursor-pointer select-none group`}
        onClick={() => handleSort(field)}
      >
        <span className="inline-flex items-center gap-1.5">
          {align === 'right' && (
            <span className={`text-[10px] transition-colors ${active ? 'text-[#0D83DE]' : 'text-[#D0D5DD] group-hover:text-[#98A2B3]'}`}>
              {active ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
            </span>
          )}
          <span className={`transition-colors ${active ? 'text-[#0D83DE]' : 'group-hover:text-[#101828]'}`}>{label}</span>
          {align !== 'right' && (
            <span className={`text-[10px] transition-colors ${active ? 'text-[#0D83DE]' : 'text-[#D0D5DD] group-hover:text-[#98A2B3]'}`}>
              {active ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
            </span>
          )}
        </span>
      </th>
    );
  };

  return (
    <>
      <div className="p-4 border-b border-[#F2F4F7] bg-white">
        <div className="relative max-w-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#98A2B3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>
          <input
            type="text"
            className="block w-full pl-9 pr-3 py-2 border border-[#E4E7EC] rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#0D83DE]/20 focus:border-[#0D83DE] outline-none transition-all placeholder-[#98A2B3]"
            placeholder="Rechercher un abonné (Nom, N° série...)"
            value={filterText}
            onChange={(e) => {
              setFilterText(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>
      <table className="w-full text-left">
        <thead>
          <tr className="bg-[#F9FAFB] text-[#475467] text-[11px] uppercase tracking-wider font-bold">
            <Th label="N° Abonné" field="numab" />
            <Th label="Nom / Raison Sociale" field="name" />
            <Th label="Adresse" field="adresse" />
            <Th label="Tournée" field="tournee" />
            <Th label="Bloc" field="bloc" px="px-4" />
            <Th label="N° Dom" field="ndom" px="px-4" />
            <Th label="N° Série" field="numser" />
            <Th label="Nouvel Index" field="nouvelx" align="right" />
            <Th label="Type d'Abonnement" field="type" />
            <Th label="État" field="etat_label" />
            {consecutiveEtatColumn && (
              <Th label={consecutiveEtatColumn.label} field={consecutiveEtatColumn.field} align="right" />
            )}
            <Th label="N° Ordre" field="numordre" align="right" />
          </tr>
        </thead>
        <tbody className="divide-y divide-[#F2F4F7]">
          {pageItems.length > 0 ? pageItems.map((sub: any, i: number) => (
            <tr
              key={i}
              className="hover:bg-[#F9FAFB] transition-colors cursor-pointer"
              onClick={() => handleRowClick(sub)}
              onMouseEnter={(e) => { setHoveredSub(sub); setMousePos({ x: e.clientX, y: e.clientY }); }}
              onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
              onMouseLeave={() => setHoveredSub(null)}
            >
              <td className="px-6 py-4 font-black text-[13px] text-[#101828] whitespace-nowrap">{sub.numab}</td>
              <td className="px-6 py-4 font-medium text-[13px] text-[#101828] min-w-[200px]">{sub.name}</td>
              <td className="px-6 py-4 font-medium text-[13px] text-[#667085] min-w-[200px]">{sub.adresse}</td>
              <td className="px-6 py-4 font-bold text-[13px] text-[#0D83DE] whitespace-nowrap">T-{sub.tournee}</td>
              <td className="px-4 py-4 font-medium text-[13px] text-[#667085]">{sub.bloc}</td>
              <td className="px-4 py-4 font-medium text-[13px] text-[#667085]">{sub.ndom}</td>
              <td className="px-6 py-4 font-medium text-[13px] text-[#475467] whitespace-nowrap">{sub.numser}</td>
              <td className="px-6 py-4 font-bold text-[13px] text-[#101828] text-right">{sub.nouvelx !== undefined ? sub.nouvelx.toLocaleString() : '—'}</td>
              <td className="px-6 py-4 font-medium text-[13px] text-[#667085]">{sub.type}</td>
              <td className="px-6 py-4">{etatBadge(sub.etatcpt, sub.etat_label)}</td>
              {consecutiveEtatColumn && (
                <td className="px-6 py-4 text-right">
                  <span className={`inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-lg text-[12px] font-black border ${
                    (sub[consecutiveEtatColumn.field] ?? 0) > 0
                      ? consecutiveEtatColumn.activeClass
                      : 'text-[#98A2B3] border-transparent'
                  }`}>
                    {sub[consecutiveEtatColumn.field] ?? 0}
                  </span>
                </td>
              )}
              <td className="px-6 py-4 text-right font-medium text-[13px] text-[#475467]">{sub.numordre}</td>
            </tr>
          )) : (
            <tr>
              <td colSpan={consecutiveEtatColumn ? 12 : 11} className="px-8 py-8 text-center text-[#667085] font-medium">Aucun abonné trouvé.</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Pagination footer */}
      {total > 0 && (
        <div className="px-6 py-4 bg-[#F9FAFB] border-t border-[#F2F4F7] flex items-center justify-between">
          <p className="text-xs font-bold text-[#667085]">
            Affichage {start + 1}–{Math.min(start + ITEMS_PER_PAGE, total)} sur{" "}
            <span className="text-[#101828]">{total}</span> abonnés
            {sortKey && <span className="ml-2 text-[#0D83DE]">· Trié par {sortKey} ({sortDir === 'asc' ? '↑ ASC' : '↓ DESC'})</span>}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="px-4 py-2 border border-[#D0D5DD] rounded-xl text-xs font-bold bg-white disabled:opacity-40 hover:bg-[#F2F4F7] transition-colors"
            >
              ← Précédent
            </button>
            <span className="px-4 py-2 text-xs font-bold text-[#475467]">
              Page {safePage} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="px-4 py-2 border border-[#D0D5DD] rounded-xl text-xs font-bold bg-white disabled:opacity-40 hover:bg-[#F2F4F7] transition-colors"
            >
              Suivant →
            </button>
          </div>
        </div>
      )}

    </>
  );
}

function CreanceDetailView({ creanceData, setCreanceData, onNavigateToRepartition, onCalcDateChange }: any) {

  const data = creanceData;
  const setData = setCreanceData;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [ventilationData, setVentilationData] = useState<any[]>([]);
  const [ventilationLoading, setVentilationLoading] = useState(false);
  const [ventilationFilter, setVentilationFilter] = useState<'ALL' | 'EAU' | 'PRESTATIONS' | null>(null);
  const [calcProgress, setCalcProgress] = useState(0);
  const [calcStep, setCalcStep] = useState("");
  const [expandedSections, setExpandedSections] = useState<string[]>(['EAU', 'PRESTATIONS']);
  const [expandedTypes, setExpandedTypes] = useState<string[]>(['EAU', 'PRESTATIONS']);
  const [lastVentDate, setLastVentDate] = useState("");
  const [activeHistoryMetric, setActiveHistoryMetric] = useState<'creance' | 'ca' | 'encaissement' | 'ca_recouvre'>('creance');

  const [histType, setHistType] = useState<'monthly_12' | 'years' | 'months'>('monthly_12');
  const [histStartYear, setHistStartYear] = useState('2015');
  const [histEndYear, setHistEndYear] = useState(new Date().getFullYear().toString());
  const [histStartMonth, setHistStartMonth] = useState('01');
  const [histEndMonth, setHistEndMonth] = useState('12');
  const [loadingHistory, setLoadingHistory] = useState(false);

  const formatMonthFr = (m: string) => {
    const months: Record<string, string> = {
      '01': 'Janvier', '02': 'Février', '03': 'Mars', '04': 'Avril', '05': 'Mai', '06': 'Juin',
      '07': 'Juillet', '08': 'Août', '09': 'Septembre', '10': 'Octobre', '11': 'Novembre', '12': 'Décembre'
    };
    return months[m] || m;
  };

  const recoveryRate = data ? (data.total_ca > 0 ? ((data.total_ca_recouvre || 0) / data.total_ca) * 100 : 0) : 0;


  const toggleSection = (section: string) => {
    setExpandedSections(prev =>
      prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
    );
  };

  const toggleTypeSection = (section: string) => {
    setExpandedTypes(prev =>
      prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
    );
  };

  // exportToJson has been removed to disable exporting JSON files at the end of calculations

  const exportToExcel = async () => {
    console.log("Starting Excel export...");
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Ventilation");

      const formattedDate = lastVentDate.replace(/(\d{4})(\d{2})(\d{2})/, '$3/$2/$1').replace(/(\d{4})-(\d{2})-(\d{2})/, '$3/$2/$1');
      const today = new Date();
      const printDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;

      // Add 4 empty rows first for the header
      worksheet.addRow([]);
      worksheet.addRow([]);
      worksheet.addRow([]);
      worksheet.addRow([]);

      // Load Image
      try {
        const response = await fetch('/ade.png');
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const imageId = workbook.addImage({
            buffer: arrayBuffer,
            extension: 'png',
          });
          // Add image top-left
          worksheet.addImage(imageId, {
            tl: { col: 0, row: 0 },
            ext: { width: 100, height: 60 }
          });
        }
      } catch (e) {
        console.warn("Failed to load logo for Excel:", e);
      }

      // Title Row
      worksheet.mergeCells('C2:E2');
      const titleCell = worksheet.getCell('C2');
      titleCell.value = `Détail Ventilation des Créances  -  Arrêtées au : ${formattedDate}`;
      titleCell.font = { bold: true, size: 12 };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

      // Unit & Print Date
      worksheet.getCell('E1').value = `Unité : 26 - MEDEA`;
      worksheet.getCell('E1').alignment = { horizontal: 'right' };

      worksheet.getCell('E3').value = `Centre : S02 - BERROUAGHIA`;
      worksheet.getCell('E3').alignment = { horizontal: 'right' };

      worksheet.getCell('E4').value = `Edité le : ${printDate}`;
      worksheet.getCell('E4').alignment = { horizontal: 'right' };

      // Row 5 spacing
      worksheet.addRow([]);

      // Table Headers (Row 6)
      const headerRow = worksheet.addRow(['Section', 'Type', 'Désignation', 'Volume', 'Créance Nette (DA)']);
      headerRow.font = { bold: true };

      worksheet.getColumn(1).width = 25;
      worksheet.getColumn(2).width = 15;
      worksheet.getColumn(3).width = 40;
      worksheet.getColumn(4).width = 15;
      worksheet.getColumn(5).width = 25;

      const sections = ventilationFilter === 'ALL' ? ['EAU', 'PRESTATIONS'] : [ventilationFilter];
      let globalTotalVolume = 0;
      let globalTotalCreance = 0;

      let currentRow = 7;

      sections.forEach(section => {
        if (!section) return;
        const rows = ventilationData.filter(r => r.SECTION === section);
        if (rows.length === 0) return;

        const subTotalCreance = rows.reduce((acc, r) => acc + r.CREANCE, 0);
        const subTotalVolume = rows.reduce((acc, r) => acc + r.NBR_FACTURES, 0);
        globalTotalVolume += subTotalVolume;
        globalTotalCreance += subTotalCreance;

        rows.forEach((row, i) => {
          worksheet.addRow([
            i === 0 ? section : "",
            row.TYPE_CODE,
            row.CATEGORIE,
            row.NBR_FACTURES,
            row.CREANCE
          ]);
        });

        if (rows.length > 1) {
          worksheet.mergeCells(`A${currentRow}:A${currentRow + rows.length - 1}`);
          worksheet.getCell(`A${currentRow}`).alignment = { vertical: 'middle', horizontal: 'center' };
          worksheet.getCell(`A${currentRow}`).font = { bold: true };
        }
        currentRow += rows.length;

        const subTotalRow = worksheet.addRow([
          `Sous-total ${section}`,
          '',
          '',
          subTotalVolume,
          subTotalCreance
        ]);
        subTotalRow.font = { bold: true };
        worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
        currentRow++;
      });

      // Add Global Total Row
      const globalTotalRow = worksheet.addRow([
        'TOTAL GÉNÉRAL',
        '',
        '',
        globalTotalVolume,
        globalTotalCreance
      ]);
      globalTotalRow.font = { bold: true };
      worksheet.mergeCells(`A${currentRow}:C${currentRow}`);

      // Generate Excel file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      saveAs(blob, `ventilation_${lastVentDate || 'export'}.xlsx`);
      console.log("Excel export successful");
    } catch (error) {
      console.error("Excel export error:", error);
      alert("Une erreur est survenue lors de l'exportation Excel. Veuillez vérifier la console.");
    }
  };

  const exportToPDF = async () => {
    console.log("Starting PDF export...");
    try {
      const doc = new jsPDF();
      const formattedDate = lastVentDate.replace(/(\d{4})(\d{2})(\d{2})/, '$3/$2/$1').replace(/(\d{4})-(\d{2})-(\d{2})/, '$3/$2/$1');

      const pageWidth = doc.internal.pageSize.width;
      let imgHeightOut = 0;

      // Load and add image with timeout to prevent hanging
      try {
        const img = new window.Image();
        img.src = '/ade.png';
        await Promise.race([
          new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Image timeout")), 3000))
        ]);

        if (img.width) {
          const imgWidth = 35;
          imgHeightOut = (img.height * imgWidth) / img.width;
          // Draw image on the left, aligned roughly with the title
          doc.addImage(img, 'PNG', 14, 12, imgWidth, imgHeightOut);
        }
      } catch (e) {
        console.warn("Failed to load logo for PDF:", e);
      }

      // Header Title (Centered)
      const fullTitle = `Détail Ventilation des Créances  -  Arrêtées au : ${formattedDate}`;
      doc.setFontSize(9.5);
      doc.setTextColor(16, 24, 40); // text-[#101828]
      doc.text(fullTitle, pageWidth / 2, 20, { align: 'center' });

      const today = new Date();
      const printDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;

      // Unit & Center (Top Right)
      doc.setFontSize(9);
      doc.setTextColor(71, 84, 103);
      doc.text("Unité : 26 - MEDEA", pageWidth - 14, 15, { align: 'right' });
      doc.text("Centre : S02 - BERROUAGHIA", pageWidth - 14, 19, { align: 'right' });
      doc.setFontSize(8);
      doc.text(`Edité le : ${printDate}`, pageWidth - 14, 23, { align: 'right' });

      // Set starting Y for the table, ensuring it's below the image and text
      let currentY = Math.max(32, 12 + imgHeightOut + 8);

      const bodyData: any[] = [];
      const sections = ventilationFilter === 'ALL' ? ['EAU', 'PRESTATIONS'] : [ventilationFilter];

      let globalTotalVolume = 0;
      let globalTotalCreance = 0;

      sections.forEach(section => {
        if (!section) return;
        const rows = ventilationData.filter(r => r.SECTION === section);
        if (rows.length === 0) return;

        const subTotalCreance = rows.reduce((acc, r) => acc + r.CREANCE, 0);
        const subTotalVolume = rows.reduce((acc, r) => acc + r.NBR_FACTURES, 0);
        globalTotalVolume += subTotalVolume;
        globalTotalCreance += subTotalCreance;

        rows.forEach((row, i) => {
          const rowData: any[] = [];
          if (i === 0) {
            rowData.push({
              content: section.split('').join('\n'),
              rowSpan: rows.length,
              styles: {
                halign: 'center',
                valign: 'middle',
                fontStyle: 'bold',
                fontSize: rows.length < 5 ? 5 : 8,
                textColor: section === 'EAU' ? [13, 131, 222] : [147, 51, 234]
              }
            });
          }
          rowData.push(
            { content: row.TYPE_CODE, styles: { halign: 'center', fontStyle: 'bold', textColor: [102, 112, 133] } },
            { content: row.CATEGORIE, styles: { textColor: [16, 24, 40] } },
            { content: fmtNum(row.NBR_FACTURES), styles: { halign: 'right', textColor: [71, 84, 103] } },
            { content: fmt(row.CREANCE), styles: { halign: 'right', fontStyle: 'bold', textColor: [16, 24, 40] } }
          );
          bodyData.push(rowData);
        });

        const fillColor: [number, number, number] = section === 'EAU' ? [239, 246, 255] : [250, 245, 255];
        bodyData.push([
          { content: `Sous-total ${section}`, colSpan: 3, styles: { fontStyle: 'bold', fillColor, textColor: [16, 24, 40] } },
          { content: fmtNum(subTotalVolume), styles: { fontStyle: 'bold', halign: 'right', fillColor, textColor: [71, 84, 103] } },
          { content: fmt(subTotalCreance), styles: { fontStyle: 'bold', halign: 'right', fillColor, textColor: [16, 24, 40] } }
        ]);
      });

      // Global Total Row
      bodyData.push([
        { content: 'TOTAL GÉNÉRAL', colSpan: 3, styles: { fontStyle: 'bold', fillColor: [15, 23, 42], textColor: [255, 255, 255] } },
        { content: fmtNum(globalTotalVolume), styles: { fontStyle: 'bold', halign: 'right', fillColor: [15, 23, 42], textColor: [255, 255, 255] } },
        { content: fmt(globalTotalCreance), styles: { fontStyle: 'bold', halign: 'right', fillColor: [15, 23, 42], textColor: [255, 255, 255] } }
      ]);

      autoTable(doc, {
        startY: currentY,
        margin: { bottom: 12 },
        head: [['Section', 'Type', 'Désignation', 'Volume', 'Créance Nette']],
        body: bodyData,
        theme: 'grid',
        headStyles: { fillColor: [249, 250, 251], textColor: [71, 84, 103], fontStyle: 'bold', lineWidth: 0.1, lineColor: [228, 231, 236] },
        styles: { fontSize: 8.5, cellPadding: 3, lineColor: [242, 244, 247], lineWidth: 0.1 },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 15 },
          2: { cellWidth: 'auto' },
          3: { cellWidth: 25 },
          4: { cellWidth: 35 }
        }
      });

      doc.save(`ventilation_${lastVentDate || 'export'}.pdf`);
      console.log("PDF export successful");
    } catch (error) {
      console.error("PDF export error:", error);
      alert("Une erreur est survenue lors de l'exportation PDF. Veuillez vérifier la console.");
    }
  };



  const fetchData = async (start = '', end = '') => {
    setData(null);
    setLoading(true);
    setCalcProgress(0);

    const targetFilter = ventilationFilter || 'ALL';
    setVentilationFilter(targetFilter);
    const ventDate = end || new Date().toISOString().split('T')[0];
    setLastVentDate(ventDate);

    try {
      // Step 1: Start Global KPIs
      setCalcStep("Calcul des indicateurs financiers globaux...");
      setCalcProgress(10);

      const url = new URL("http://127.0.0.1:8000/creance");
      if (start) url.searchParams.append("start_date", start.replace(/-/g, ''));
      if (end) url.searchParams.append("end_date", end.replace(/-/g, ''));
      url.searchParams.append("hist_type", histType);
      if (histType === 'years') {
        url.searchParams.append("hist_start", histStartYear);
        url.searchParams.append("hist_end", histEndYear);
      } else if (histType === 'months') {
        url.searchParams.append("hist_start", `${histStartYear}${histStartMonth}`);
        url.searchParams.append("hist_end", `${histEndYear}${histEndMonth}`);
      }

      // We run them in sequence to show "real" progress as requested
      // though parallel is faster, the user wants to see the steps
      const res1 = await fetch(url.toString());
      const d1 = await res1.json();
      setData(d1);
      setCalcProgress(50);

      // Step 2: Start Ventilation
      setCalcStep("Calcul de la ventilation par type d'abonné...");
      setCalcProgress(60);

      const res2 = await fetch(`http://127.0.0.1:8000/creance_detaillee?date_arrete=${ventDate.replace(/-/g, '')}`);
      setCalcStep("Répartition des créances par commune...");
      setCalcProgress(80);

      const d2 = await res2.json();
      setVentilationData(d2);

      setCalcStep("Finalisation des calculs...");
      setCalcProgress(100);
      onCalcDateChange?.(start, end);

      // Automatic JSON export is disabled as requested by the user (ne pas exporter de json en fin de traitement)

      // Small delay to show 100%
      await new Promise(r => setTimeout(r, 500));

    } catch {
      setError("Erreur de connexion au serveur.");
    }
    setLoading(false);
  };


  const handleUpdateHistory = async () => {
    setLoadingHistory(true);
    try {
      let start = '';
      let end = '';

      if (filterYear !== 'all') {
        const year = parseInt(filterYear);
        if (filterPeriod === 'all') {
          start = `${year}0101`;
          end = `${year}1231`;
        } else if (filterPeriod.startsWith('q')) {
          const q = parseInt(filterPeriod[1]);
          const startMonth = (q - 1) * 3 + 1;
          const endMonth = q * 3;
          const lastDay = new Date(year, endMonth, 0).getDate();
          start = `${year}${startMonth.toString().padStart(2, '0')}01`;
          end = `${year}${endMonth.toString().padStart(2, '0')}${lastDay}`;
        } else {
          const month = parseInt(filterPeriod);
          const lastDay = new Date(year, month, 0).getDate();
          start = `${year}${month.toString().padStart(2, '0')}01`;
          end = `${year}${month.toString().padStart(2, '0')}${lastDay}`;
        }
      } else {
        start = dateRange.start.replace(/-/g, '');
        end = dateRange.end.replace(/-/g, '');
      }

      const url = new URL("http://127.0.0.1:8000/creance");
      if (start) url.searchParams.append("start_date", start);
      if (end) url.searchParams.append("end_date", end);
      
      url.searchParams.append("hist_type", histType);
      if (histType === 'years') {
        url.searchParams.append("hist_start", histStartYear);
        url.searchParams.append("hist_end", histEndYear);
      } else if (histType === 'months') {
        url.searchParams.append("hist_start", `${histStartYear}${histStartMonth}`);
        url.searchParams.append("hist_end", `${histEndYear}${histEndMonth}`);
      }

      const res = await fetch(url.toString());
      const d = await res.json();
      if (d.history) {
        setData((prev: any) => ({ ...prev, history: d.history }));
      }
    } catch (e) {
      console.error("Error updating history:", e);
    }
    setLoadingHistory(false);
  };

  useEffect(() => {
    // Initial fetch removed as requested. 
    // Calculations only run on user action.
  }, []);

  const handleApplyFilter = () => {
    let start = '';
    let end = '';

    if (filterYear === 'all') {
      start = '';
      end = '';
    } else {
      const year = parseInt(filterYear);
      if (filterPeriod === 'all') {
        start = `${year}0101`;
        end = `${year}1231`;
      } else if (filterPeriod.startsWith('q')) {
        const q = parseInt(filterPeriod[1]);
        const startMonth = (q - 1) * 3 + 1;
        const endMonth = q * 3;
        const lastDay = new Date(year, endMonth, 0).getDate();
        start = `${year}${startMonth.toString().padStart(2, '0')}01`;
        end = `${year}${endMonth.toString().padStart(2, '0')}${lastDay}`;
      } else {
        // Month
        const month = parseInt(filterPeriod);
        const lastDay = new Date(year, month, 0).getDate();
        start = `${year}${month.toString().padStart(2, '0')}01`;
        end = `${year}${month.toString().padStart(2, '0')}${lastDay}`;
      }
    }

    fetchData(start, end);
  };

  const handleCustomFilter = () => {
    fetchData(dateRange.start.replace(/-/g, ''), dateRange.end.replace(/-/g, ''));
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("fr-DZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      .format(n)
      .replace(/[\u202F\u00A0]/g, ' ') + " DA";

  const fmtNum = (n: number) =>
    new Intl.NumberFormat("fr-DZ", { maximumFractionDigits: 0 })
      .format(n)
      .replace(/[\u202F\u00A0]/g, ' ');

  const handlePrintAllCharts = () => {
    if (!data?.history || data.history.length === 0) {
      alert("Aucune donnée historique disponible. Veuillez d'abord lancer un calcul.");
      return;
    }

    const history = data.history;

    const fmtV = (n: number) => {
      if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + ' Mrd';
      if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + ' M';
      if (n >= 1_000) return (n / 1_000).toFixed(0) + ' K';
      return n.toFixed(0);
    };

    const buildSvgChart = (
      title: string,
      colorPrest: string,
      keyEau: string,
      keyPrest: string,
      keyTotal: string
    ) => {
      const W = 490, H = 230;
      const PAD = { top: 24, right: 18, bottom: 46, left: 68 };
      const chartW = W - PAD.left - PAD.right;
      const chartH = H - PAD.top - PAD.bottom;
      const n = history.length;

      const vals: number[] = history.flatMap((d: any) => [
        Number(d[keyEau] ?? 0), Number(d[keyPrest] ?? 0), Number(d[keyTotal] ?? 0)
      ]);
      const maxV = Math.max(...vals, 1);

      const xOf = (i: number) => PAD.left + (n <= 1 ? chartW / 2 : (i / (n - 1)) * chartW);
      const yOf = (v: number) => PAD.top + chartH - (v / maxV) * chartH;

      const mkPolyline = (key: string, stroke: string, dash = '') => {
        const pts = history.map((d: any, i: number) =>
          `${xOf(i).toFixed(1)},${yOf(Number(d[key] ?? 0)).toFixed(1)}`
        ).join(' ');
        return `<polyline points="${pts}" fill="none" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"${dash ? ` stroke-dasharray="${dash}"` : ''} />`;
      };

      const mkDots = (key: string, stroke: string) =>
        history.map((d: any, i: number) => {
          const cx = xOf(i).toFixed(1);
          const cy = yOf(Number(d[key] ?? 0)).toFixed(1);
          return `<circle cx="${cx}" cy="${cy}" r="3.2" fill="white" stroke="${stroke}" stroke-width="2" />`;
        }).join('');

      // Y-axis: 5 evenly spaced ticks
      const yTicksSvg = Array.from({ length: 5 }, (_, i) => {
        const v = (maxV / 4) * i;
        const y = yOf(v).toFixed(1);
        return `
          <line x1="${PAD.left}" y1="${y}" x2="${W - PAD.right}" y2="${y}" stroke="#F2F4F7" stroke-width="1"/>
          <text x="${PAD.left - 6}" y="${Number(y) + 3.5}" text-anchor="end" font-size="8" fill="#98A2B3" font-family="Inter,sans-serif">${fmtV(v)}</text>`;
      }).join('');

      // X-axis: show labels every step ticks
      const step = n <= 14 ? 1 : n <= 30 ? 2 : n <= 60 ? 4 : Math.ceil(n / 14);
      const xTicksSvg = history.map((d: any, i: number) => {
        if (i % step !== 0 && i !== n - 1) return '';
        return `<text x="${xOf(i).toFixed(1)}" y="${H - PAD.bottom + 12}" text-anchor="middle" font-size="8" fill="#667085" font-family="Inter,sans-serif" font-weight="600">${d.month}</text>`;
      }).join('');

      return `
        <div style="background:#fff;border:1.2px solid #E4E7EC;border-radius:14px;padding:14px 18px 10px;break-inside:avoid;">
          <div style="font-family:Inter,sans-serif;font-size:10.5px;font-weight:900;color:#101828;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
            <span>${title}</span>
            <span style="display:flex;gap:10px;font-size:8.5px;font-weight:700;color:#667085;align-items:center;">
              <span style="display:flex;align-items:center;gap:3px;"><span style="display:inline-block;width:16px;height:2.5px;background:#0D83DE;border-radius:2px;"></span>Eau</span>
              <span style="display:flex;align-items:center;gap:3px;"><span style="display:inline-block;width:16px;height:2.5px;background:${colorPrest};border-radius:2px;"></span>Prestations</span>
              <span style="display:flex;align-items:center;gap:3px;"><span style="display:inline-block;width:16px;height:0;border-top:2.5px dashed #10B981;"></span>Total</span>
            </span>
          </div>
          <svg width="100%" viewBox="0 0 ${W} ${H}" style="overflow:visible;display:block;">
            ${yTicksSvg}
            ${xTicksSvg}
            <line x1="${PAD.left}" y1="${PAD.top}" x2="${PAD.left}" y2="${PAD.top + chartH}" stroke="#E4E7EC" stroke-width="1"/>
            ${mkPolyline(keyEau, '#0D83DE')}
            ${mkPolyline(keyPrest, colorPrest)}
            ${mkPolyline(keyTotal, '#10B981', '5 4')}
            ${mkDots(keyEau, '#0D83DE')}
            ${mkDots(keyPrest, colorPrest)}
          </svg>
        </div>`;
    };

    const periodLabel = histType === 'monthly_12'
      ? `12 derniers mois (arrêtés au ${lastVentDate ? lastVentDate.replace(/(\d{4})(\d{2})(\d{2})/, '$3/$2/$1') : '...'})`
      : histType === 'years'
        ? `${histStartYear} → ${histEndYear}`
        : `${formatMonthFr(histStartMonth)} ${histStartYear} → ${formatMonthFr(histEndMonth)} ${histEndYear}`;

    const today = new Date();
    const dateStr = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;

    const chartCA      = buildSvgChart("Chiffre d'Affaires", '#F59E0B', 'ca_eau', 'ca_prest', 'ca_total');
    const chartCreance = buildSvgChart("Créances", '#E11D48', 'creance_eau', 'creance_prest', 'creance_total');
    const chartEnc     = buildSvgChart("Encaissements", '#10B981', 'encaissement_eau', 'encaissement_prest', 'encaissement_total');
    const chartCARec   = buildSvgChart("CA Recouvré", '#8B5CF6', 'ca_recouvre_eau', 'ca_recouvre_prest', 'ca_recouvre_total');

    const printWindow = window.open('', '_blank');
    if (!printWindow) { alert("Veuillez autoriser les fenêtres pop-up pour imprimer."); return; }

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Analyse Rétrospective — ${periodLabel}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    @page{size:A4 landscape;margin:1cm;}
    body{font-family:'Inter',sans-serif;background:white;color:#101828;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
    .page-header{display:flex;justify-content:space-between;align-items:flex-end;padding-bottom:10px;border-bottom:2px solid #F2F4F7;margin-bottom:14px;}
    .page-title{font-size:14px;font-weight:900;color:#101828;letter-spacing:-0.02em;}
    .page-subtitle{font-size:9.5px;color:#667085;font-weight:600;margin-top:3px;}
    .page-meta{text-align:right;font-size:8.5px;color:#98A2B3;font-weight:600;line-height:1.6;}
    .charts-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
  </style>
</head>
<body>
  <div class="page-header">
    <div>
      <div class="page-title">Analyse Rétrospective des Indicateurs Financiers</div>
      <div class="page-subtitle">Période : ${periodLabel}</div>
    </div>
    <div class="page-meta">
      <div>Édité le : ${dateStr}</div>
      <div>Unité : 26 — MEDEA &nbsp;|&nbsp; EPEOR Analytics</div>
    </div>
  </div>
  <div class="charts-grid">
    ${chartCA}
    ${chartCreance}
    ${chartEnc}
    ${chartCARec}
  </div>
  <script>window.onload=function(){setTimeout(function(){window.print();},700);};<\/script>
</body>
</html>`);
    printWindow.document.close();
  };

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] p-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="flex flex-col md:flex-row md:items-end gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-[#98A2B3] uppercase px-1">Année</label>
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                className="block w-full md:w-32 bg-[#F9FAFB] border border-[#E4E7EC] rounded-xl px-4 py-2.5 text-xs font-bold text-[#101828] outline-none hover:border-[#D0D5DD] transition-all"
              >
                <option value="all">Toutes</option>
                {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-[#98A2B3] uppercase px-1">Période</label>
              <select
                value={filterPeriod}
                onChange={(e) => setFilterPeriod(e.target.value)}
                className="block w-full md:w-56 bg-[#F9FAFB] border border-[#E4E7EC] rounded-xl px-4 py-2.5 text-xs font-bold text-[#101828] outline-none hover:border-[#D0D5DD] transition-all"
              >
                <option value="all">Année {filterYear === 'all' ? 'complète' : filterYear}</option>
                <optgroup label="Trimestres">
                  <option value="q1">1er Trim {filterYear !== 'all' ? filterYear : ''} </option>
                  <option value="q2">2ème Trim {filterYear !== 'all' ? filterYear : ''}</option>
                  <option value="q3">3ème Trim {filterYear !== 'all' ? filterYear : ''}</option>
                  <option value="q4">4ème Trim {filterYear !== 'all' ? filterYear : ''}</option>
                </optgroup>
                <optgroup label="Mois">
                  {[
                    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
                    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
                  ].map((month, idx) => (
                    <option key={idx} value={(idx + 1).toString().padStart(2, '0')}>
                      {month} {filterYear !== 'all' ? filterYear : ''}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            <button
              onClick={handleApplyFilter}
              className="px-6 py-2.5 bg-brand-600 text-white rounded-xl text-xs font-black shadow-lg shadow-brand-100 hover:bg-brand-700 transition-all flex items-center gap-2 h-[42px]"
            >
              <Search size={14} />
              Calculer
            </button>

          </div>

          <div className="flex items-end gap-3 p-4 bg-[#F9FAFB] rounded-2xl border border-[#F2F4F7] border-dashed">
            <FrenchDateInput
              label="Du"
              value={dateRange.start}
              onChange={(val: string) => setDateRange({ ...dateRange, start: val })}
              className="block bg-white border border-[#E4E7EC] rounded-xl px-4 py-2.5 text-xs font-bold text-[#101828] focus:ring-2 focus:ring-brand-500 outline-none w-32"
            />
            <FrenchDateInput
              label="Au"
              value={dateRange.end}
              onChange={(val: string) => setDateRange({ ...dateRange, end: val })}
              className="block bg-white border border-[#E4E7EC] rounded-xl px-4 py-2.5 text-xs font-bold text-[#101828] focus:ring-2 focus:ring-brand-500 outline-none w-32"
            />
            <div className="pb-1">
              <button
                onClick={handleCustomFilter}
                className="p-3 bg-white border border-[#E4E7EC] rounded-xl text-brand-600 hover:bg-brand-50 transition-colors shadow-sm"
              >
                <Search size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] p-16 flex flex-col items-center gap-8 animate-in fade-in zoom-in duration-300">
          <div className="relative">
            <div className="animate-spin rounded-full h-20 w-20 border-b-2 border-brand-500"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[10px] font-black text-brand-600">{Math.round(calcProgress)}%</span>
            </div>
          </div>

          <div className="text-center w-full max-w-md space-y-6">
            <div>
              <p className="font-black text-[#101828] text-2xl tracking-tight">Analyse Financière en cours…</p>
              <p className="text-sm text-[#667085] mt-2 font-medium">{calcStep}</p>
            </div>

            <div className="space-y-2">
              <div className="w-full bg-[#F2F4F7] rounded-full h-2 overflow-hidden p-0.5">
                <div
                  className="h-full bg-brand-600 rounded-full transition-all duration-300 shadow-sm shadow-brand-200"
                  style={{ width: `${calcProgress}%` }}
                ></div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-black text-[#98A2B3] uppercase tracking-widest">Traitement Big Data</span>
                <span className="text-[9px] font-black text-brand-600 uppercase tracking-widest">Calcul Optimisé</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-[2rem] p-8 text-rose-600 font-bold">{error}</div>
      )}

      {!data && !loading && !error && (
        <div className="bg-[#F9FAFB] border-2 border-dashed border-[#E4E7EC] rounded-[2rem] p-16 flex flex-col items-center text-center gap-6">
          <div className="p-5 bg-white rounded-full shadow-sm">
            <Search className="text-brand-500" size={32} />
          </div>
          <div>
            <p className="text-lg font-black text-[#101828]">Prêt pour l'analyse</p>
            <p className="text-sm text-[#667085] mt-1 max-w-md">Sélectionnez une année et une période ci-dessus, puis cliquez sur le bouton <span className="text-brand-600 font-bold text-xs uppercase">Calculer</span> pour traiter les données de facturation.</p>
          </div>
        </div>
      )}

      {data && !loading && (
        <>
          {data.from_cache && (
            <div className="bg-blue-50 border border-blue-100 rounded-2xl px-6 py-3 flex items-center justify-between mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="flex items-center gap-3">
                <div className="bg-blue-500 p-1.5 rounded-lg shadow-sm shadow-blue-200">
                  <Database size={14} className="text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-blue-800 uppercase tracking-[0.15em]">Analyse Instantanée</p>
                  <p className="text-[11px] font-bold text-blue-600/80">Données récupérées depuis l'archive locale (Calculée le {data.date_calcul})</p>
                </div>
              </div>
              <div className="hidden md:block">
                <span className="text-[9px] font-black text-blue-400 uppercase border border-blue-200 px-2 py-1 rounded-md bg-white">Mode Cache Activé</span>
              </div>
            </div>
          )}

          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-6">
            {[
              { label: "CA Eau", value: fmt(data.total_ca_eau), color: "bg-blue-50 text-blue-600", dot: "bg-blue-500" },
              { label: "CA Prestation", value: fmt(data.total_ca_prestation), color: "bg-cyan-50 text-cyan-600", dot: "bg-cyan-500" },
              { label: "CA Total", value: fmt(data.total_ca), color: "bg-brand-50 text-brand-600", dot: "bg-brand-500" },
              { label: "CA Recouvré", value: fmt(data.total_ca_recouvre || 0), color: "bg-teal-50 text-teal-600", dot: "bg-teal-500" },
              { label: "Encaissement", value: fmt(data.total_recouvre), color: "bg-emerald-50 text-emerald-600", dot: "bg-emerald-500" },
              { label: "Créance", value: fmt(data.total_creance), color: "bg-rose-50 text-rose-600", dot: "bg-rose-500" },
              { label: "Taux Recov.", value: `${data.total_ca > 0 ? (((data.total_ca_recouvre || 0) / data.total_ca) * 100).toFixed(2) : "0.00"}%`, color: "bg-amber-50 text-amber-600", dot: "bg-amber-500" },
            ].map((kpi, i) => {
              const isClickable = ["CA Eau", "CA Prestation", "CA Total"].includes(kpi.label);
              return (
                <div
                  key={i}
                  onClick={() => {
                    if (isClickable) {
                      if (kpi.label === "CA Eau") onNavigateToRepartition('EAU');
                      else if (kpi.label === "CA Prestation") onNavigateToRepartition('PRESTATIONS');
                      else if (kpi.label === "CA Total") onNavigateToRepartition('ALL');
                    }
                  }}
                  className={`bg-white border border-[#E4E7EC] rounded-[2.5rem] p-5 shadow-sm hover:shadow-md transition-all ${isClickable ? "cursor-pointer hover:border-brand-300 hover:bg-brand-50/20" : ""}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-2 h-2 rounded-full ${kpi.dot}`}></div>
                    <p className="text-[10px] font-black text-[#667085] uppercase tracking-widest">{kpi.label}</p>
                  </div>
                  <p className={`text-base font-black tracking-tighter ${kpi.color.split(' ')[1]}`}>{kpi.value}</p>
                </div>
              );
            })}
          </div>

          {/* Detailed Ventilation Table - Integrated */}
          {ventilationFilter && (
            <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] overflow-hidden">
              <div className="p-8 border-b border-[#F2F4F7] flex justify-between items-center bg-slate-50/50">
                <div>
                  <h4 className="text-xl font-black tracking-tight text-[#101828]">Détail Ventilation des Créance Arrêtées au : {lastVentDate.replace(/(\d{4})(\d{2})(\d{2})/, '$3/$2/$1').replace(/(\d{4})-(\d{2})-(\d{2})/, '$3/$2/$1')}</h4>
                  <p className="text-sm text-[#667085] mt-1">Analyse granulaire de la section {ventilationFilter === 'ALL' ? 'Eau & Prestations' : ventilationFilter}</p>
                </div>
                {ventilationLoading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={exportToExcel}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl text-xs font-black hover:bg-emerald-100 transition-all shadow-sm"
                    >
                      <FileSpreadsheet size={14} /> Excel
                    </button>
                    <button
                      onClick={exportToPDF}
                      className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl text-xs font-black hover:bg-rose-100 transition-all shadow-sm"
                    >
                      <FileText size={14} /> PDF
                    </button>
                  </div>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-separate border-spacing-0">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-[#F9FAFB] text-[#475467] text-[10px] uppercase tracking-[0.15em] font-black border-b border-[#E4E7EC]">
                      <th className="px-8 py-5 border-b border-[#E4E7EC]">Section</th>
                      <th className="px-6 py-5 border-b border-[#E4E7EC]">Type</th>
                      <th className="px-6 py-5 border-b border-[#E4E7EC]">Désignation</th>
                      <th className="px-6 py-5 text-right border-b border-[#E4E7EC]">Volume</th>
                      <th className="px-8 py-5 text-right border-b border-[#E4E7EC]">Créance Nette</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F2F4F7]">
                    {ventilationLoading ? (
                      <tr><td colSpan={5} className="px-8 py-12 text-center text-sm font-bold text-[#667085]">Chargement du détail...</td></tr>
                    ) : ventilationData.length > 0 ? (
                      <>
                        {(ventilationFilter === 'ALL' ? ['EAU', 'PRESTATIONS'] : [ventilationFilter]).map(section => {
                          const rows = ventilationData.filter(r => r.SECTION === section);
                          if (rows.length === 0) return null;
                          const isExpanded = expandedSections.includes(section);
                          const subTotal = rows.reduce((acc, r) => acc + r.CREANCE, 0);
                          return (
                            <Fragment key={section}>
                              {/* Group Header Toggle */}
                              <tr
                                onClick={() => toggleSection(section)}
                                className={`${section === 'EAU' ? 'bg-blue-50/10' : 'bg-teal-50/10'} cursor-pointer hover:bg-slate-50 transition-colors border-y border-[#F2F4F7]`}
                              >
                                <td colSpan={5} className="px-8 py-3">
                                  <div className="flex items-center gap-3">
                                    <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
                                      <ChevronRight size={16} className="text-[#98A2B3]" />
                                    </div>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border ${section === 'EAU' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-teal-50 text-teal-600 border-teal-100'}`}>
                                      {section}
                                    </span>
                                    <span className="text-[11px] font-bold text-[#667085]">
                                      {isExpanded ? 'Masquer le détail' : `Afficher le détail (${rows.length} lignes)`}
                                    </span>
                                  </div>
                                </td>
                              </tr>

                              {isExpanded && rows.map((row, i) => (
                                <tr key={i} className="hover:bg-blue-50/20 transition-colors group">
                                  {i === 0 ? (
                                    <td rowSpan={rows.length} className={`px-5 py-8 text-center border-r border-[#F2F4F7] ${section === 'EAU' ? 'bg-blue-50/10' : 'bg-teal-50/10'}`}>
                                      <div className="flex flex-col items-center justify-center h-full">
                                        <span className={`[writing-mode:vertical-lr] rotate-180 text-[13px] font-black uppercase tracking-[0.4em] ${section === 'EAU' ? 'text-blue-500' : 'text-teal-500'}`}>
                                          {section}
                                        </span>
                                      </div>
                                    </td>
                                  ) : null}
                                  <td className="px-6 py-4">
                                    <span className="font-mono text-[11px] font-bold text-[#667085] bg-[#F2F4F7] px-1.5 py-0.5 rounded">
                                      {row.TYPE_CODE}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="font-bold text-[13px] text-[#101828] uppercase tracking-tight">{row.CATEGORIE}</div>
                                    <div className="text-[9px] text-[#98A2B3] font-medium uppercase mt-0.5">Code: {row.ORDRE}</div>
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                    <div className="font-bold text-[13px] text-[#475467] font-mono tabular-nums">{fmtNum(row.NBR_FACTURES)}</div>
                                  </td>
                                  <td className="px-8 py-4 text-right">
                                    <div className="font-black text-[13px] text-[#101828] font-mono tracking-tighter">{fmt(row.CREANCE)}</div>
                                  </td>
                                </tr>
                              ))}
                              <tr className={`${section === 'EAU' ? 'bg-blue-50/40' : 'bg-teal-50/40'} border-y border-[#F2F4F7]/50`}>
                                <td colSpan={3} className="px-8 py-4">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-1 h-4 rounded-full ${section === 'EAU' ? 'bg-blue-400' : 'bg-teal-400'} opacity-50`}></div>
                                    <span className="font-black text-[12px] text-[#101828] uppercase tracking-wider">Sous-total {section}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <span className="font-black text-[13px] text-[#475467] font-mono">{fmtNum(rows.reduce((acc, r) => acc + r.NBR_FACTURES, 0))}</span>
                                </td>
                                <td className="px-8 py-4 text-right">
                                  <span className={`font-black text-[15px] ${section === 'EAU' ? 'text-blue-700' : 'text-teal-700'} font-mono tracking-tighter`}>{fmt(subTotal)}</span>
                                </td>
                              </tr>
                            </Fragment>
                          );
                        })}
                        {ventilationFilter === 'ALL' && (
                          <tr className="bg-slate-950 text-white relative z-20">
                            <td colSpan={3} className="px-8 py-7">
                              <div className="flex flex-col">
                                <span className="font-black uppercase tracking-[0.3em] text-[10px] text-slate-400 mb-1">Analyse Consolidée</span>
                                <span className="font-black text-lg text-white">Total Créance Ventilation</span>
                              </div>
                            </td>
                            <td className="px-6 py-7 text-right align-bottom">
                              <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Volume Global</div>
                              <div className="font-black text-lg text-slate-200 font-mono">{fmtNum(ventilationData.reduce((acc, r) => acc + r.NBR_FACTURES, 0))}</div>
                            </td>
                            <td className="px-8 py-7 text-right align-bottom bg-white/5 border-l border-white/10">
                              <div className="text-[10px] font-bold text-blue-400 uppercase mb-1">Créance Totale Arretée</div>
                              <div className="font-black text-2xl tracking-tighter text-white font-mono">{fmt(ventilationData.reduce((acc, r) => acc + r.CREANCE, 0))}</div>
                            </td>
                          </tr>
                        )}
                      </>
                    ) : (
                      <tr><td colSpan={5} className="px-8 py-12 text-center text-sm font-bold text-[#667085]">Cliquez sur Calculer pour voir le détail</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Graphique de Recouvrement Interactif */}
          <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] p-6">
            <div className="flex flex-col lg:flex-row items-center gap-8">
              <div className="w-full lg:w-[22%] min-h-[220px] h-[220px] relative flex items-center justify-center">
                <ChartContainer className="absolute inset-0 w-full h-full">
                  <RadialBarChart
                    innerRadius="75%"
                    outerRadius="100%"
                    barSize={24}
                    data={[{
                      name: 'Taux',
                      value: recoveryRate,
                      fill: recoveryRate >= 90 ? '#10B981' : '#F59E0B'
                    }]}
                    startAngle={225}
                    endAngle={-45}
                  >
                    <PolarAngleAxis
                      type="number"
                      domain={[0, 100]}
                      angleAxisId={0}
                      tick={false}
                    />
                    <RadialBar
                      background={{ fill: '#F2F4F7' }}
                      dataKey="value"
                      cornerRadius={12}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-xl border border-white/10">
                              Taux: {(payload[0].value as number ?? 0).toFixed(2)}%
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </RadialBarChart>
                </ChartContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pt-2 pointer-events-none">
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-4xl font-black text-[#101828] tracking-tighter">
                      {recoveryRate.toFixed(1)}
                    </span>
                    <span className="text-xl font-black text-[#98A2B3]">%</span>
                  </div>
                  <p className="text-[10px] font-black text-[#98A2B3] uppercase tracking-[0.2em] mt-1">Recouvrement</p>
                </div>
              </div>

              <div className="flex-1 w-full space-y-5">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-xl font-black tracking-tight text-[#101828]">Performance du Recouvrement</h4>
                    <p className="text-xs text-[#667085] mt-0.5 font-medium">Analyse comparative entre les factures émises et les encaissements réels.</p>
                  </div>
                  <div className={`px-4 py-2 rounded-2xl border font-black text-xs uppercase tracking-widest ${recoveryRate >= 90 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                    {recoveryRate >= 90 ? 'Objectif Atteint' : 'Sous Objectif (90%)'}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 bg-[#F9FAFB] rounded-[2rem] border border-[#F2F4F7] group hover:border-brand-200 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-brand-500"></div>
                      <p className="text-[10px] font-black text-[#98A2B3] uppercase tracking-widest">CA Total Émis</p>
                    </div>
                    <p className="text-lg font-black text-[#101828] font-mono tracking-tighter">{fmt(data.total_ca)}</p>
                  </div>
                  <div className="p-4 bg-teal-50/50 rounded-[2rem] border border-teal-100 group hover:border-teal-200 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-teal-500"></div>
                      <p className="text-[10px] font-black text-teal-600 uppercase tracking-widest">CA Recouvré</p>
                    </div>
                    <p className="text-lg font-black text-teal-700 font-mono tracking-tighter">{fmt(data.total_ca_recouvre || 0)}</p>
                  </div>
                  <div className="p-4 bg-emerald-50/50 rounded-[2rem] border border-emerald-100 group hover:border-emerald-200 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Encaissement Réel</p>
                    </div>
                    <p className="text-lg font-black text-emerald-700 font-mono tracking-tighter">{fmt(data.total_recouvre)}</p>
                  </div>
                  <div className="p-4 bg-rose-50/50 rounded-[2rem] border border-rose-100 group hover:border-rose-200 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div>
                      <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest">Créance Restante</p>
                    </div>
                    <p className="text-lg font-black text-rose-700 font-mono tracking-tighter">{fmt(data.total_creance)}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-[#98A2B3]">
                    <span>Niveau de Progression</span>
                    <span className="text-emerald-600">Seuil de performance : 90%</span>
                  </div>
                  <div className="w-full bg-[#F2F4F7] rounded-full h-3 overflow-hidden p-0.5">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 shadow-sm ${recoveryRate >= 90 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                      style={{ width: `${Math.min(recoveryRate, 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Graphique d'Analyse Rétrospective des 12 Derniers Mois */}
          <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] p-8 mt-8 animate-in fade-in duration-500">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-6">
              <div>
                <h4 className="text-xl font-black tracking-tight text-[#101828]">
                  {histType === 'monthly_12' ? "Analyse Rétrospective des 12 Derniers Mois" : 
                   histType === 'years' ? `Analyse Rétrospective (${histStartYear} → ${histEndYear})` : 
                   `Analyse Rétrospective (${formatMonthFr(histStartMonth)} ${histStartYear} → ${formatMonthFr(histEndMonth)} ${histEndYear})`}
                </h4>
                <p className="text-xs text-[#667085] mt-0.5 font-medium">
                  {histType === 'monthly_12' 
                    ? `Évolution mensuelle des indicateurs sur les 12 mois précédant la date d'arrêt (${lastVentDate ? formatDate(lastVentDate) : '...'})`
                    : `Évolution des indicateurs financiers sur la période sélectionnée.`}
                </p>
              </div>

              {/* Toggles interactifs de métrique */}
              <div className="flex bg-[#F2F4F7] p-1.5 rounded-2xl gap-1 border border-[#E4E7EC] self-start lg:self-auto shadow-sm">
                {[
                  { id: 'creance', label: 'Créances' },
                  { id: 'ca', label: "Chiffre d'Affaires" },
                  { id: 'encaissement', label: 'Encaissements' },
                  { id: 'ca_recouvre', label: 'CA Recouvré' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveHistoryMetric(tab.id as any)}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all active:scale-95 border ${
                      activeHistoryMetric === tab.id
                        ? 'bg-white text-brand-600 shadow-sm border-[#E4E7EC]/40'
                        : 'text-[#667085] border-transparent hover:text-[#101828]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Filtres d'Intervalle Historique */}
            <div className="flex flex-wrap items-end gap-4 p-4 mb-6 bg-[#F9FAFB] rounded-2xl border border-[#F2F4F7] border-dashed">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-[#98A2B3] uppercase px-1">Type d'Évolution</label>
                <select
                  value={histType}
                  onChange={(e) => setHistType(e.target.value as any)}
                  className="block bg-white border border-[#E4E7EC] rounded-xl px-4 py-2 text-xs font-bold text-[#101828] focus:ring-2 focus:ring-brand-500 outline-none w-48 shadow-sm cursor-pointer"
                >
                  <option value="monthly_12">12 Derniers Mois</option>
                  <option value="years">Par Intervalle d'Années</option>
                  <option value="months">Par Intervalle de Mois</option>
                </select>
              </div>

              {histType !== 'monthly_12' && (
                <div className="flex items-center gap-2">
                  {/* Début */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-[#98A2B3] uppercase px-1">Du</label>
                    <div className="flex gap-2">
                      {histType === 'months' && (
                        <select
                          value={histStartMonth}
                          onChange={(e) => setHistStartMonth(e.target.value)}
                          className="block bg-white border border-[#E4E7EC] rounded-xl px-3 py-2 text-xs font-bold text-[#101828] focus:ring-2 focus:ring-brand-500 outline-none w-28 shadow-sm cursor-pointer"
                        >
                          {[
                            {v: '01', l: 'Janvier'}, {v: '02', l: 'Février'}, {v: '03', l: 'Mars'},
                            {v: '04', l: 'Avril'}, {v: '05', l: 'Mai'}, {v: '06', l: 'Juin'},
                            {v: '07', l: 'Juillet'}, {v: '08', l: 'Août'}, {v: '09', l: 'Septembre'},
                            {v: '10', l: 'Octobre'}, {v: '11', l: 'Novembre'}, {v: '12', l: 'Décembre'}
                          ].map(m => (
                            <option key={m.v} value={m.v}>{m.l}</option>
                          ))}
                        </select>
                      )}
                      <select
                        value={histStartYear}
                        onChange={(e) => setHistStartYear(e.target.value)}
                        className="block bg-white border border-[#E4E7EC] rounded-xl px-3 py-2 text-xs font-bold text-[#101828] focus:ring-2 focus:ring-brand-500 outline-none w-24 shadow-sm cursor-pointer"
                      >
                        {Array.from({ length: new Date().getFullYear() - 2000 + 1 }, (_, i) => new Date().getFullYear() - i).map(year => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <span className="text-xs font-bold text-[#98A2B3] pt-4">→</span>

                  {/* Fin */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-[#98A2B3] uppercase px-1">Au</label>
                    <div className="flex gap-2">
                      {histType === 'months' && (
                        <select
                          value={histEndMonth}
                          onChange={(e) => setHistEndMonth(e.target.value)}
                          className="block bg-white border border-[#E4E7EC] rounded-xl px-3 py-2 text-xs font-bold text-[#101828] focus:ring-2 focus:ring-brand-500 outline-none w-28 shadow-sm cursor-pointer"
                        >
                          {[
                            {v: '01', l: 'Janvier'}, {v: '02', l: 'Février'}, {v: '03', l: 'Mars'},
                            {v: '04', l: 'Avril'}, {v: '05', l: 'Mai'}, {v: '06', l: 'Juin'},
                            {v: '07', l: 'Juillet'}, {v: '08', l: 'Août'}, {v: '09', l: 'Septembre'},
                            {v: '10', l: 'Octobre'}, {v: '11', l: 'Novembre'}, {v: '12', l: 'Décembre'}
                          ].map(m => (
                            <option key={m.v} value={m.v}>{m.l}</option>
                          ))}
                        </select>
                      )}
                      <select
                        value={histEndYear}
                        onChange={(e) => setHistEndYear(e.target.value)}
                        className="block bg-white border border-[#E4E7EC] rounded-xl px-3 py-2 text-xs font-bold text-[#101828] focus:ring-2 focus:ring-brand-500 outline-none w-24 shadow-sm cursor-pointer"
                      >
                        {Array.from({ length: new Date().getFullYear() - 2000 + 1 }, (_, i) => new Date().getFullYear() - i).map(year => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={handleUpdateHistory}
                disabled={loadingHistory}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50 rounded-xl text-xs font-black transition-all shadow-sm h-[38px] active:scale-95 cursor-pointer"
              >
                {loadingHistory ? (
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Search size={12} />
                )}
                Actualiser
              </button>

              <button
                onClick={handlePrintAllCharts}
                disabled={!data?.history || data.history.length === 0}
                title="Imprimer les 4 graphiques en une seule page A4 paysage"
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-xs font-black transition-all shadow-sm h-[38px] active:scale-95 cursor-pointer border border-slate-700"
              >
                <Printer size={12} />
                Imprimer tout
              </button>
            </div>

            <div className="relative">
              {loadingHistory && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70 backdrop-blur-[2px] rounded-3xl transition-all">
                  <div className="flex flex-col items-center gap-2 animate-in fade-in zoom-in duration-200">
                    <div className="w-8 h-8 border-4 border-brand-100 border-t-brand-600 rounded-full animate-spin" />
                    <p className="text-[10px] font-black text-brand-600 uppercase tracking-widest">Calcul de l'Évolution...</p>
                  </div>
                </div>
              )}

              {data.history && data.history.length > 0 ? (
                <ChartContainer className="h-[380px] w-full">
                  <LineChart
                    data={data.history}
                    margin={{ top: 20, right: 30, left: 20, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#F2F4F7" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: '#667085', fontSize: 11, fontWeight: 600 }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: '#667085', fontSize: 11 }}
                      tickFormatter={(val) => fmtNum(val) + " DA"}
                      width={100}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#101828",
                        border: "none",
                        borderRadius: "16px",
                        color: "#fff",
                        fontSize: '12px',
                        padding: '12px'
                      }}
                      itemStyle={{ color: "#fff" }}
                      labelStyle={{ color: "#98A2B3", fontWeight: 'bold', marginBottom: '4px' }}
                      formatter={(value: any, name: any) => [fmt(value), name]}
                    />
                    <Legend
                      verticalAlign="top"
                      align="right"
                      iconType="circle"
                      wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', paddingBottom: '16px' }}
                    />
                    <Line
                      type="monotone"
                      dataKey={
                        activeHistoryMetric === 'creance' ? 'creance_eau' :
                        activeHistoryMetric === 'ca' ? 'ca_eau' :
                        activeHistoryMetric === 'encaissement' ? 'encaissement_eau' :
                        'ca_recouvre_eau'
                      }
                      name="Eau"
                      stroke="#0D83DE"
                      strokeWidth={3}
                      dot={{ r: 4, stroke: "#0D83DE", strokeWidth: 2, fill: "#fff" }}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                    <Line
                      type="monotone"
                      dataKey={
                        activeHistoryMetric === 'creance' ? 'creance_prest' :
                        activeHistoryMetric === 'ca' ? 'ca_prest' :
                        activeHistoryMetric === 'encaissement' ? 'encaissement_prest' :
                        'ca_recouvre_prest'
                      }
                      name="Prestations"
                      stroke="#9333EA"
                      strokeWidth={3}
                      dot={{ r: 4, stroke: "#9333EA", strokeWidth: 2, fill: "#fff" }}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                    <Line
                      type="monotone"
                      dataKey={
                        activeHistoryMetric === 'creance' ? 'creance_total' :
                        activeHistoryMetric === 'ca' ? 'ca_total' :
                        activeHistoryMetric === 'encaissement' ? 'encaissement_total' :
                        'ca_recouvre_total'
                      }
                      name="Total"
                      stroke="#10B981"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                    />
                  </LineChart>
                </ChartContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-60 gap-2 border-2 border-dashed border-[#E4E7EC] rounded-3xl bg-[#F9FAFB]">
                  <p className="text-sm font-bold text-[#667085]">Aucune donnée historique disponible.</p>
                  <p className="text-xs text-[#98A2B3]">Veuillez relancer le calcul pour charger l'historique.</p>
                </div>
              )}
            </div>
          </div>

        </>
      )}
    </div>
  );
}

function SubscriberDrillDownView({ targetName, column, startDate, endDate, onClose }: any) {
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const COLUMN_LABELS: Record<string, string> = {
    ca_eau: 'CA Eau',
    ca_prestation: 'CA Prestation',
    ca: 'Total CA',
    ca_recouvre: 'CA Recouvré',
    recouvre: 'Encaissement',
    creance: 'Créance',
  };

  useEffect(() => {
    setLoading(true);
    setError(null);
    setSubscribers([]);
    const url = new URL('http://127.0.0.1:8000/creance_subscribers');
    if (startDate) url.searchParams.append('start_date', startDate);
    if (endDate) url.searchParams.append('end_date', endDate);
    if (targetName) url.searchParams.append('target_name', targetName);
    if (column) url.searchParams.append('column', column);
    fetch(url.toString())
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); } else { setSubscribers(data.subscribers || []); }
        setLoading(false);
      })
      .catch(() => { setError('Erreur de connexion au serveur.'); setLoading(false); });
  }, [targetName, column, startDate, endDate]);

  const fmt = (n: number) =>
    new Intl.NumberFormat('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      .format(n)
      .replace(/[\u202F\u00A0]/g, ' ') + ' DA';

  const filtered = subscribers.filter(s =>
    !search ||
    s.numab?.toLowerCase().includes(search.toLowerCase()) ||
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.commune?.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const columnLabel = COLUMN_LABELS[column] || column;

  const exportCSV = () => {
    const header = ['Code Abonné', 'Nom / Raison Sociale', 'Commune', 'Type Abonné', columnLabel, 'Nb Opérations'];
    const rows = filtered.map((s: any) => [s.numab, s.name, s.commune, s.type_abonne, s.amount, s.count]);
    const csv = [header, ...rows].map(r => r.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `abonnes_${targetName}_${column}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] overflow-hidden animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-start justify-between p-8 pb-6 border-b border-[#F2F4F7] bg-gradient-to-r from-brand-50/60 to-white flex-shrink-0">
        <div>
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-sm font-bold text-[#667085] hover:text-[#101828] mb-4 transition-all active:scale-95 cursor-pointer"
          >
            <ChevronRight className="rotate-180" size={16} /> Retour à la répartition
          </button>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase border bg-brand-50 text-brand-600 border-brand-100">
              Détail Abonnés
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase border bg-blue-50 text-blue-600 border-blue-100">
              {columnLabel}
            </span>
          </div>
          <h2 className="text-xl font-black text-[#101828] tracking-tight">{targetName}</h2>
          <p className="text-sm text-[#667085] mt-1 font-medium">
            {loading ? 'Chargement...' : `${filtered.length} abonné${filtered.length !== 1 ? 's' : ''} trouvé${filtered.length !== 1 ? 's' : ''}`}
            {startDate ? ` · du ${startDate.slice(6,8)}/${startDate.slice(4,6)}/${startDate.slice(0,4)}` : ''}
            {endDate ? ` au ${endDate.slice(6,8)}/${endDate.slice(4,6)}/${endDate.slice(0,4)}` : ''}
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-8 py-4 border-b border-[#F2F4F7] flex-shrink-0">
        <div className="relative flex-1">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#98A2B3] pointer-events-none">
            <Search size={14} />
          </div>
          <input
            type="text"
            placeholder="Rechercher par code abonné, nom ou commune..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2.5 bg-[#F9FAFB] border border-[#E4E7EC] rounded-xl text-xs font-medium text-[#101828] placeholder:text-[#98A2B3] outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-100/50 transition-all"
          />
        </div>
        <button
          onClick={exportCSV}
          disabled={loading || filtered.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black hover:bg-emerald-700 active:scale-95 transition-all shadow-sm shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FileSpreadsheet size={13} />
          Exporter CSV
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-56 gap-4">
            <div className="w-10 h-10 border-4 border-brand-100 border-t-brand-600 rounded-full animate-spin" />
            <p className="text-sm font-medium text-[#667085]">Chargement des abonnés...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-56 gap-3">
            <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center">
              <UserX className="text-rose-500" size={24} />
            </div>
            <p className="text-sm font-bold text-rose-600">{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-56 gap-3">
            <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center">
              <Users className="text-[#D0D5DD]" size={24} />
            </div>
            <p className="text-sm font-medium text-[#667085]">Aucun abonné trouvé pour ce filtre.</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F9FAFB] text-[#475467] text-[10px] uppercase tracking-wider font-black border-b border-[#F2F4F7]">
                <th className="px-6 py-4 w-12">#</th>
                <th className="px-4 py-4">Code Abonn.</th>
                <th className="px-4 py-4">Nom / Raison Sociale</th>
                <th className="px-4 py-4">Commune</th>
                <th className="px-4 py-4">Type</th>
                <th className="px-4 py-4 text-right text-brand-600">{columnLabel}</th>
                <th className="px-6 py-4 text-right">Opérations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2F4F7]">
              {paged.map((s: any, i: number) => (
                <tr key={s.numab} className="hover:bg-brand-50/20 transition-colors">
                  <td className="px-6 py-3.5 text-xs text-[#98A2B3] font-mono">{(page - 1) * PAGE_SIZE + i + 1}</td>
                  <td className="px-4 py-3.5">
                    <span className="font-mono text-[11px] font-bold text-[#101828] bg-[#F9FAFB] px-2 py-0.5 rounded border border-[#E4E7EC]">{s.numab}</span>
                  </td>
                  <td className="px-4 py-3.5 text-sm font-semibold text-[#101828]">{s.name}</td>
                  <td className="px-4 py-3.5 text-xs text-[#475467] font-medium">{s.commune}</td>
                  <td className="px-4 py-3.5 text-[11px] text-[#667085]">{s.type_abonne}</td>
                  <td className="px-4 py-3.5 text-right font-black text-sm text-brand-600 whitespace-nowrap">{fmt(s.amount)}</td>
                  <td className="px-6 py-3.5 text-right text-xs font-bold text-[#475467]">{s.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {!loading && !error && totalPages > 1 && (
        <div className="flex items-center justify-between px-8 py-4 border-t border-[#F2F4F7] bg-[#F9FAFB]/50 flex-shrink-0">
          <span className="text-xs text-[#667085] font-medium">
            Page {page} / {totalPages} · {filtered.length} résultat{filtered.length !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-[#475467] bg-white border border-[#E4E7EC] hover:border-[#D0D5DD] disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
            >← Préc.</button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
              let p: number;
              if (totalPages <= 5) p = idx + 1;
              else if (page <= 3) p = idx + 1;
              else if (page >= totalPages - 2) p = totalPages - 4 + idx;
              else p = page - 2 + idx;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-all active:scale-95 ${
                    page === p ? 'bg-brand-600 text-white shadow-sm' : 'text-[#475467] bg-white border border-[#E4E7EC] hover:border-[#D0D5DD]'
                  }`}
                >{p}</button>
              );
            })}
            <button
              disabled={page === totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-[#475467] bg-white border border-[#E4E7EC] hover:border-[#D0D5DD] disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
            >Suiv. →</button>
          </div>
        </div>
      )}
    </div>
  );
}

function CreanceRepartitionView({ data, typeSectionFilter, setTypeSectionFilter, onGoToCalculation, startDate, endDate }: any) {
  const [expandedTypes, setExpandedTypes] = useState<string[]>(['EAU', 'PRESTATIONS']);
  const [drillDown, setDrillDown] = useState<{targetName: string, column: string} | null>(null);

  const fmt = (n: number) =>
    new Intl.NumberFormat("fr-DZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      .format(n)
      .replace(/[\u202F\u00A0]/g, ' ') + " DA";

  const fmtNum = (n: number) =>
    new Intl.NumberFormat("fr-DZ", { maximumFractionDigits: 0 })
      .format(n)
      .replace(/[\u202F\u00A0]/g, ' ');

  const toggleTypeSection = (section: string) => {
    setExpandedTypes(prev =>
      prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
    );
  };

  if (!data || !data.by_type) {
    return (
      <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] p-12 text-center max-w-2xl mx-auto my-12 animate-in fade-in duration-300">
        <div className="w-20 h-20 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-brand-100 shadow-inner">
          <BarChart3 className="text-brand-600" size={36} />
        </div>
        <h3 className="text-2xl font-black text-[#101828] mb-3">Aucune donnée disponible</h3>
        <p className="text-sm text-[#667085] leading-relaxed max-w-md mx-auto mb-8 font-medium">
          Les calculs financiers n'ont pas encore été lancés pour la période actuelle. Veuillez vous rendre sur la Synthèse Globale pour charger les données.
        </p>
        <button
          onClick={onGoToCalculation}
          className="inline-flex items-center justify-center px-6 py-3.5 bg-brand-600 text-white rounded-2xl text-sm font-black hover:bg-brand-700 active:scale-95 transition-all shadow-lg shadow-brand-600/25 border border-brand-500/10"
        >
          Aller à la Synthèse Globale
        </button>
      </div>
    );
  }

  if (drillDown) {
    return (
      <SubscriberDrillDownView
        targetName={drillDown.targetName}
        column={drillDown.column}
        startDate={startDate}
        endDate={endDate}
        onClose={() => setDrillDown(null)}
      />
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Filters and Context */}
      <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h3 className="text-2xl font-black tracking-tight text-[#101828]">Répartition par Type d'Abonné</h3>
          <p className="text-sm text-[#667085] mt-1 font-medium">Cliquez sur un montant pour voir le détail des abonnés concernés</p>
        </div>
        
        {/* Modern Tab Filters */}
        <div className="flex bg-[#F2F4F7] p-1.5 rounded-2xl gap-1 self-start md:self-auto border border-[#E4E7EC]">
          {[
            { id: 'ALL', label: 'Tous les Types' },
            { id: 'EAU', label: 'Eau Uniquement' },
            { id: 'PRESTATIONS', label: 'Prestations Uniquement' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setTypeSectionFilter(tab.id as any)}
              className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all duration-200 border ${
                typeSectionFilter === tab.id
                  ? 'bg-white text-brand-600 shadow-sm border-[#E4E7EC]/40'
                  : 'text-[#667085] border-transparent hover:text-[#101828]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F9FAFB] text-[#475467] text-[10px] uppercase tracking-wider font-black border-b border-[#F2F4F7]">
                <th className="px-8 py-5">Section</th>
                <th className="px-6 py-5">Type</th>
                <th className="px-8 py-5">Type d'Abonné</th>
                <th className="px-6 py-5 text-right">CA Eau</th>
                <th className="px-6 py-5 text-right">CA Prest.</th>
                <th className="px-6 py-5 text-right">Total CA</th>
                <th className="px-6 py-5 text-right text-teal-600">CA Recouvré</th>
                <th className="px-6 py-5 text-right text-emerald-600">Encaissement</th>
                <th className="px-6 py-5 text-right text-rose-600">Créance</th>
                <th className="px-8 py-5 text-right">Taux Recov.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2F4F7]">
              {(typeSectionFilter === 'ALL' ? ['EAU', 'PRESTATIONS'] : [typeSectionFilter]).map(section => {
                const sectionRows = data.by_type.filter((t: any) => t.section === section);
                if (sectionRows.length === 0) return null;

                const isExpanded = expandedTypes.includes(section);
                const subTotalCaEau = sectionRows.reduce((acc: number, curr: any) => acc + curr.ca_eau, 0);
                const subTotalCaPrest = sectionRows.reduce((acc: number, curr: any) => acc + curr.ca_prestation, 0);
                const subTotalCa = sectionRows.reduce((acc: number, curr: any) => acc + curr.ca, 0);
                const subTotalCaRecouvre = sectionRows.reduce((acc: number, curr: any) => acc + (curr.ca_recouvre || 0), 0);
                const subTotalRecouvre = sectionRows.reduce((acc: number, curr: any) => acc + curr.recouvre, 0);
                const subTotalCreance = sectionRows.reduce((acc: number, curr: any) => acc + curr.creance, 0);
                const subTotalTaux = subTotalCa > 0 ? (subTotalCaRecouvre / subTotalCa * 100) : 0;

                const isEau = section === 'EAU';

                return (
                  <Fragment key={section}>
                    {/* Group Header Toggle */}
                    <tr
                      onClick={() => toggleTypeSection(section)}
                      className={`${isEau ? 'bg-blue-50/10' : 'bg-teal-50/10'} cursor-pointer hover:bg-slate-50/50 transition-colors border-y border-[#F2F4F7]`}
                    >
                      <td colSpan={10} className="px-8 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
                            <ChevronRight size={16} className="text-[#98A2B3]" />
                          </div>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase border ${isEau ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-teal-50 text-teal-600 border-teal-100'}`}>
                            {section}
                          </span>
                          <span className="text-[11px] font-bold text-[#667085]">
                            {isExpanded ? 'Masquer le détail' : `Afficher le détail (${sectionRows.length} types d'abonnés)`}
                          </span>
                        </div>
                      </td>
                    </tr>

                    {isExpanded && sectionRows.map((t: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-50/40 transition-colors group">
                        {i === 0 && (
                          <td
                            rowSpan={sectionRows.length}
                            className="px-8 py-4 align-middle border-r border-[#F2F4F7]"
                          >
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold tracking-widest uppercase ${isEau ? 'bg-blue-50 text-blue-600 border border-blue-100/50' : 'bg-teal-50 text-teal-600 border border-teal-100/50'}`}>
                              {t.section}
                            </span>
                          </td>
                        )}
                        <td className="px-6 py-4">
                          <span className="font-mono text-[10px] font-medium text-[#667085] bg-[#F9FAFB] px-2 py-0.5 rounded border border-[#E4E7EC]">
                            {t.type_code}
                          </span>
                        </td>
                        <td className="px-8 py-4 font-black text-sm text-[#101828]">{t.name}</td>
                        <td className="px-6 py-4 text-right font-medium text-[13px] text-blue-600 whitespace-nowrap">
                          <span className="cursor-pointer hover:bg-blue-50/60 hover:text-blue-700 underline decoration-dotted underline-offset-2 transition-all rounded px-1 py-0.5" onClick={() => setDrillDown({ targetName: t.name, column: 'ca_eau' })} title="Voir les abonnés concernés">{fmt(t.ca_eau)}</span>
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-[13px] text-cyan-600 whitespace-nowrap">
                          <span className="cursor-pointer hover:bg-cyan-50/60 hover:text-cyan-700 underline decoration-dotted underline-offset-2 transition-all rounded px-1 py-0.5" onClick={() => setDrillDown({ targetName: t.name, column: 'ca_prestation' })} title="Voir les abonnés concernés">{fmt(t.ca_prestation)}</span>
                        </td>
                        <td className="px-6 py-4 text-right font-black text-[13px] text-brand-600 whitespace-nowrap">
                          <span className="cursor-pointer hover:bg-brand-50/60 hover:text-brand-700 underline decoration-dotted underline-offset-2 transition-all rounded px-1 py-0.5" onClick={() => setDrillDown({ targetName: t.name, column: 'ca' })} title="Voir les abonnés concernés">{fmt(t.ca)}</span>
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-[13px] text-teal-600 bg-teal-50/5 whitespace-nowrap">
                          <span className="cursor-pointer hover:bg-teal-50/60 hover:text-teal-700 underline decoration-dotted underline-offset-2 transition-all rounded px-1 py-0.5" onClick={() => setDrillDown({ targetName: t.name, column: 'ca_recouvre' })} title="Voir les abonnés concernés">{fmt(t.ca_recouvre || 0)}</span>
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-[13px] text-emerald-600 bg-emerald-50/5 whitespace-nowrap">
                          <span className="cursor-pointer hover:bg-emerald-50/60 hover:text-emerald-700 underline decoration-dotted underline-offset-2 transition-all rounded px-1 py-0.5" onClick={() => setDrillDown({ targetName: t.name, column: 'recouvre' })} title="Voir les abonnés concernés">{fmt(t.recouvre)}</span>
                        </td>
                        <td className="px-6 py-4 text-right font-black text-[13px] text-rose-600 bg-rose-50/10 whitespace-nowrap">
                          <span className="cursor-pointer hover:bg-rose-50/60 hover:text-rose-700 underline decoration-dotted underline-offset-2 transition-all rounded px-1 py-0.5" onClick={() => setDrillDown({ targetName: t.name, column: 'creance' })} title="Voir les abonnés concernés">{fmt(t.creance)}</span>
                        </td>
                        <td className="px-8 py-4 text-right font-black text-[13px] text-[#475467] whitespace-nowrap">{t.taux.toFixed(2)}%</td>
                      </tr>
                    ))}

                    {/* Section Subtotal Row */}
                    <tr className={`${isEau ? 'bg-blue-50/40' : 'bg-teal-50/40'} border-y border-[#F2F4F7]/50`}>
                      <td colSpan={3} className="px-8 py-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-1 h-4 rounded-full ${isEau ? 'bg-blue-400' : 'bg-teal-400'} opacity-50`}></div>
                          <span className="font-black text-[12px] text-[#101828] uppercase tracking-wider">Sous-total {section}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-black text-[13px] text-blue-600 font-mono whitespace-nowrap">{fmt(subTotalCaEau)}</td>
                      <td className="px-6 py-4 text-right font-black text-[13px] text-cyan-600 font-mono whitespace-nowrap">{fmt(subTotalCaPrest)}</td>
                      <td className="px-6 py-4 text-right font-black text-[13px] text-brand-600 font-mono whitespace-nowrap">{fmt(subTotalCa)}</td>
                      <td className="px-6 py-4 text-right font-black text-[13px] text-teal-600 font-mono bg-white/5 whitespace-nowrap">{fmt(subTotalCaRecouvre)}</td>
                      <td className="px-6 py-4 text-right font-black text-[13px] text-emerald-600 font-mono bg-white/5 whitespace-nowrap">{fmt(subTotalRecouvre)}</td>
                      <td className="px-6 py-4 text-right font-black text-[13px] text-rose-600 font-mono bg-white/5 whitespace-nowrap">{fmt(subTotalCreance)}</td>
                      <td className="px-8 py-4 text-right font-black text-[13px] text-[#475467] font-mono whitespace-nowrap">{subTotalTaux.toFixed(2)}%</td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
            {typeSectionFilter === 'ALL' && (
              <tfoot className="sticky bottom-0 z-10">
                <tr className="bg-slate-900 text-white font-black shadow-[0_-4px_10px_rgba(0,0,0,0.1)]">
                  <td colSpan={3} className="px-8 py-5 text-sm uppercase tracking-widest">TOTAL GÉNÉRAL</td>
                  <td className="px-6 py-5 text-right text-blue-400 font-mono whitespace-nowrap">{fmt(data.total_ca_eau)}</td>
                  <td className="px-6 py-5 text-right text-cyan-400 font-mono whitespace-nowrap">{fmt(data.total_ca_prestation)}</td>
                  <td className="px-6 py-5 text-right text-brand-400 font-mono whitespace-nowrap">{fmt(data.total_ca)}</td>
                  <td className="px-6 py-5 text-right text-teal-400 font-mono bg-white/5 whitespace-nowrap">{fmt(data.total_ca_recouvre || 0)}</td>
                  <td className="px-6 py-5 text-right text-emerald-400 font-mono bg-white/5 whitespace-nowrap">{fmt(data.total_recouvre)}</td>
                  <td className="px-6 py-5 text-right text-rose-400 bg-white/5 font-mono whitespace-nowrap">{fmt(data.total_creance)}</td>
                  <td className="px-8 py-5 text-right text-slate-300 font-mono whitespace-nowrap">{(data.total_ca > 0 ? (((data.total_ca_recouvre || 0) / data.total_ca) * 100) : 0).toFixed(2)}%</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}


function CreanceCommuneView({ data, onGoToCalculation }: any) {
  const [collapsedCommunes, setCollapsedCommunes] = useState<string[]>([]);
  const [isTableCollapsed, setIsTableCollapsed] = useState(false);

  const fmt = (n: number) =>
    new Intl.NumberFormat("fr-DZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      .format(n)
      .replace(/[\u202F\u00A0]/g, ' ') + " DA";

  const toggleCommune = (communeId: string) => {
    setCollapsedCommunes(prev =>
      prev.includes(communeId) ? prev.filter(id => id !== communeId) : [...prev, communeId]
    );
  };

  const expandAllCommunes = () => {
    setCollapsedCommunes([]);
  };

  const collapseAllCommunes = () => {
    if (data?.by_commune) {
      setCollapsedCommunes(data.by_commune.map((c: any) => c.id));
    }
  };

  if (!data || !data.by_commune) {
    return (
      <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] p-12 text-center max-w-2xl mx-auto my-12 animate-in fade-in duration-300">
        <div className="w-20 h-20 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-brand-100 shadow-inner">
          <MapPin className="text-brand-600" size={36} />
        </div>
        <h3 className="text-2xl font-black text-[#101828] mb-3">Aucune donnée disponible</h3>
        <p className="text-sm text-[#667085] leading-relaxed max-w-md mx-auto mb-8 font-medium">
          Les calculs financiers n'ont pas encore été lancés pour la période actuelle. Veuillez vous rendre sur la Synthèse Globale pour charger les données.
        </p>
        <button
          onClick={onGoToCalculation}
          className="inline-flex items-center justify-center px-6 py-3.5 bg-brand-600 text-white rounded-2xl text-sm font-black hover:bg-brand-700 active:scale-95 transition-all shadow-lg shadow-brand-600/25 border border-brand-500/10"
        >
          Aller à la Synthèse Globale
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header and Controls */}
      <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h3 className="text-2xl font-black tracking-tight text-[#101828]">Répartition par Commune</h3>
          <p className="text-sm text-[#667085] mt-1 font-medium">Détails du Chiffre d'Affaire Eau et Prestation par commune</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsTableCollapsed(!isTableCollapsed)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all shadow-sm active:scale-95 cursor-pointer border ${
              isTableCollapsed 
                ? 'bg-brand-600 text-white border-brand-700 hover:bg-brand-700' 
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {isTableCollapsed ? 'Déplier le Tableau' : 'Plier le Tableau'}
          </button>

          {!isTableCollapsed && (
            <>
              <div className="w-[1px] h-6 bg-[#E4E7EC] mx-1 hidden sm:block"></div>
              <button
                onClick={expandAllCommunes}
                className="flex items-center gap-2 px-4 py-2.5 bg-brand-50 text-brand-600 border border-brand-100 rounded-xl text-xs font-black hover:bg-brand-100 hover:text-brand-700 transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                Déplier Tout
              </button>
              <button
                onClick={collapseAllCommunes}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 text-slate-600 border border-slate-200 rounded-xl text-xs font-black hover:bg-slate-100 hover:text-slate-700 transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                Plier Tout
              </button>
            </>
          )}
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] overflow-hidden">
        <div className={`transition-all duration-300 ease-in-out ${isTableCollapsed ? 'max-h-0 opacity-0 overflow-hidden' : 'max-h-[5000px] opacity-100'}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F9FAFB] text-[#475467] text-[10px] uppercase tracking-wider font-black border-b border-[#F2F4F7]">
                  <th className="px-8 py-5">Commune</th>
                  <th className="px-6 py-5 text-right">CA Eau (DA)</th>
                  <th className="px-6 py-5 text-right">CA Prest. (DA)</th>
                  <th className="px-6 py-5 text-right">Total CA (DA)</th>
                  <th className="px-6 py-5 text-right text-teal-600">CA Recouvré (DA)</th>
                  <th className="px-6 py-5 text-right text-emerald-600">Encaissement (DA)</th>
                  <th className="px-6 py-5 text-right text-rose-600">Créance (DA)</th>
                  <th className="px-8 py-5 text-right">Taux Recov. (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2F4F7]">
                {data.by_commune.map((c: any, i: number) => {
                  const isCollapsed = collapsedCommunes.includes(c.id);
                  return (
                    <Fragment key={c.id || i}>
                      {/* Main Commune Row */}
                      <tr className="hover:bg-[#F9FAFB] transition-colors group">
                        <td className="px-8 py-4 font-black text-sm text-[#101828]">
                          <div
                            className="flex items-center gap-2 cursor-pointer select-none group-hover:text-brand-600 transition-colors"
                            onClick={() => toggleCommune(c.id)}
                          >
                            <div className={`transition-transform duration-200 ${!isCollapsed ? 'rotate-90' : ''}`}>
                              <ChevronRight size={14} className="text-[#98A2B3]" />
                            </div>
                            <span>{c.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-[13px] text-blue-600">{fmt(c.ca_eau)}</td>
                        <td className="px-6 py-4 text-right font-medium text-[13px] text-cyan-600">{fmt(c.ca_prestation)}</td>
                        <td className="px-6 py-4 text-right font-black text-[13px] text-brand-600">{fmt(c.ca)}</td>
                        <td className="px-6 py-4 text-right font-medium text-[13px] text-teal-600 bg-teal-50/10">{fmt(c.ca_recouvre || 0)}</td>
                        <td className="px-6 py-4 text-right font-medium text-[13px] text-emerald-600 bg-emerald-50/10">{fmt(c.recouvre)}</td>
                        <td className="px-6 py-4 text-right font-black text-[13px] text-rose-600 bg-rose-50/30">{fmt(c.creance)}</td>
                        <td className="px-8 py-4 text-right font-black text-[13px] text-[#475467]">{c.taux.toFixed(2)}%</td>
                      </tr>

                      {/* Eau Sub-row */}
                      {!isCollapsed && (
                        <tr className="bg-blue-50/5 hover:bg-blue-50/15 transition-colors border-b border-[#F2F4F7]">
                          <td className="px-8 py-2.5 pl-14 text-xs font-bold text-blue-600">
                            <span className="text-[#98A2B3] mr-2">↳</span>Eau
                          </td>
                          <td className="px-6 py-2.5 text-right font-medium text-[12px] text-blue-600 font-mono">{fmt(c.ca_eau)}</td>
                          <td className="px-6 py-2.5 text-right font-medium text-[12px] text-slate-300 font-mono">-</td>
                          <td className="px-6 py-2.5 text-right font-bold text-[12px] text-blue-800 font-mono">{fmt(c.ca_eau)}</td>
                          <td className="px-6 py-2.5 text-right font-medium text-[12px] text-teal-600 bg-teal-50/5 font-mono">{fmt(c.ca_recouvre_eau || 0)}</td>
                          <td className="px-6 py-2.5 text-right font-medium text-[12px] text-emerald-600 bg-emerald-50/5 font-mono">{fmt(c.recouvre_eau || 0)}</td>
                          <td className="px-6 py-2.5 text-right font-bold text-[12px] text-rose-600 bg-rose-50/10 font-mono">{fmt(c.creance_eau || 0)}</td>
                          <td className="px-8 py-2.5 text-right font-black text-[12px] text-blue-700 font-mono">{c.taux_eau.toFixed(2)}%</td>
                        </tr>
                      )}

                      {/* Prestations Sub-row */}
                      {!isCollapsed && (
                        <tr className="bg-cyan-50/5 hover:bg-cyan-50/15 transition-colors border-b border-[#F2F4F7]">
                          <td className="px-8 py-2.5 pl-14 text-xs font-bold text-cyan-600">
                            <span className="text-[#98A2B3] mr-2">↳</span>Prestations
                          </td>
                          <td className="px-6 py-2.5 text-right font-medium text-[12px] text-slate-300 font-mono">-</td>
                          <td className="px-6 py-2.5 text-right font-medium text-[12px] text-cyan-600 font-mono">{fmt(c.ca_prestation)}</td>
                          <td className="px-6 py-2.5 text-right font-bold text-[12px] text-cyan-800 font-mono">{fmt(c.ca_prestation)}</td>
                          <td className="px-6 py-2.5 text-right font-medium text-[12px] text-teal-600 bg-teal-50/5 font-mono">{fmt(c.ca_recouvre_prestation || 0)}</td>
                          <td className="px-6 py-2.5 text-right font-medium text-[12px] text-emerald-600 bg-emerald-50/5 font-mono">{fmt(c.recouvre_prestation || 0)}</td>
                          <td className="px-6 py-2.5 text-right font-bold text-[12px] text-rose-600 bg-rose-50/10 font-mono">{fmt(c.creance_prestation || 0)}</td>
                          <td className="px-8 py-2.5 text-right font-black text-[12px] text-cyan-700 font-mono">{c.taux_prestation.toFixed(2)}%</td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot className="sticky bottom-0 z-10">
                <tr className="bg-slate-900 text-white font-black shadow-[0_-4px_10px_rgba(0,0,0,0.1)]">
                  <td className="px-8 py-5 text-sm uppercase tracking-widest">TOTAL GÉNÉRAL</td>
                  <td className="px-6 py-5 text-right text-blue-400 font-mono">{fmt(data.total_ca_eau)}</td>
                  <td className="px-6 py-5 text-right text-cyan-400 font-mono">{fmt(data.total_ca_prestation)}</td>
                  <td className="px-6 py-5 text-right text-brand-400 font-mono">{fmt(data.total_ca)}</td>
                  <td className="px-6 py-5 text-right text-teal-400 font-mono bg-white/5">{fmt(data.total_ca_recouvre || 0)}</td>
                  <td className="px-6 py-5 text-right text-emerald-400 font-mono bg-white/5">{fmt(data.total_recouvre)}</td>
                  <td className="px-6 py-5 text-right text-rose-400 bg-white/5 font-mono">{fmt(data.total_creance)}</td>
                  <td className="px-8 py-5 text-right text-slate-300 font-mono">{(data.total_ca > 0 ? (((data.total_ca_recouvre || 0) / data.total_ca) * 100) : 0).toFixed(2)}%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

const NUMERIC_SORT_KEYS = new Set(['montant_creance', 'nombre_creance']);

function CreancesAbonnesView({ onBack }: any) {
  // ─── Raw data from API ───────────────────────────────────────────
  const [allSubscribers, setAllSubscribers] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Filter UI state ──────────────────────────────────────────────
  const [filterExpanded, setFilterExpanded] = useState(false);

  // ─── Filter state ────────────────────────────────────────────────
  const [customTournees, setCustomTournees] = useState<string[]>([]);
  const [newTourneeInput, setNewTourneeInput] = useState('');
  const [montantOp, setMontantOp] = useState<'>='|'='|'<='>('>=');
  const [montantVal, setMontantVal] = useState('');
  const [nbCreanceOp, setNbCreanceOp] = useState<'>='|'='|'<='>('>=');
  const [nbCreanceVal, setNbCreanceVal] = useState('');
  const [dernierPaiementDays, setDernierPaiementDays] = useState('');
  const [dernierPaiementOp, setDernierPaiementOp] = useState<'>'|'='|'<'>('>');

  // ─── Results state ───────────────────────────────────────────────
  const [results, setResults] = useState<any[] | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState('montant_creance');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [filterTypesAbon, setFilterTypesAbon] = useState<string[]>([]);
  const [filterEtatsCpt, setFilterEtatsCpt] = useState<string[]>([]);
  const [filterTourneesTable, setFilterTourneesTable] = useState<string[]>([]);
  const [selectedNumabs, setSelectedNumabs] = useState<string[]>([]);
  const PAGE_SIZE = 20;

  const fmt = (n: number) =>
    new Intl.NumberFormat("fr-DZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      .format(n).replace(/[\u202F\u00A0]/g, ' ') + " DA";

  // Load all data once
  const loadData = async () => {
    setDataLoading(true);
    setError(null);
    try {
      const res = await fetch("http://127.0.0.1:8000/creances_abonnes");
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setAllSubscribers(data.subscribers || []);
        setDataLoaded(true);
      }
    } catch {
      setError("Impossible de contacter le serveur backend.");
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // ─── Day helper ──────────────────────────────────────────────────
  const daysSince = (raw: string | null): number | null => {
    if (!raw || raw.length !== 8) return null;
    try {
      const y = parseInt(raw.slice(0, 4));
      const m = parseInt(raw.slice(4, 6)) - 1;
      const d = parseInt(raw.slice(6, 8));
      const diff = Date.now() - new Date(y, m, d).getTime();
      return Math.floor(diff / 86400000);
    } catch { return null; }
  };

  // ─── Apply filters ───────────────────────────────────────────────
  const applyFilters = () => {
    setPage(1);
    setSearch('');
    let filtered = [...allSubscribers];

    // 1. Tournées filter
    if (customTournees.length > 0) {
      filtered = filtered.filter(s => customTournees.includes(s.tournee));
    }

    // 2. Montant filter
    if (montantVal.trim() !== '') {
      const threshold = parseFloat(montantVal);
      if (!isNaN(threshold)) {
        filtered = filtered.filter(s => {
          if (montantOp === '>=') return s.montant_creance >= threshold;
          if (montantOp === '=')  return Math.abs(s.montant_creance - threshold) < 0.01;
          if (montantOp === '<=') return s.montant_creance <= threshold;
          return true;
        });
      }
    }

    // 3. Nombre créances filter
    if (nbCreanceVal.trim() !== '') {
      const threshold = parseInt(nbCreanceVal);
      if (!isNaN(threshold)) {
        filtered = filtered.filter(s => {
          if (nbCreanceOp === '>=') return s.nombre_creance >= threshold;
          if (nbCreanceOp === '=')  return s.nombre_creance === threshold;
          if (nbCreanceOp === '<=') return s.nombre_creance <= threshold;
          return true;
        });
      }
    }

    // 4. Dernière date de paiement filter
    if (dernierPaiementDays.trim() !== '') {
      const threshold = parseInt(dernierPaiementDays);
      if (!isNaN(threshold)) {
        filtered = filtered.filter(s => {
          const days = daysSince(s.raw_last_payment);
          // days === null means "never paid" → treat as infinite days ago
          const effectiveDays = days === null ? Infinity : days;
          if (dernierPaiementOp === '>') return effectiveDays > threshold;
          if (dernierPaiementOp === '=') return days !== null && Math.abs(effectiveDays - threshold) < 1;
          if (dernierPaiementOp === '<') return days !== null && effectiveDays < threshold;
          return true;
        });
      }
    }

    setFilterTypesAbon([]);
    setFilterEtatsCpt([]);
    setFilterTourneesTable([]);
    setSortKey('montant_creance');
    setSortDir('desc');
    setResults(filtered);
  };

  const resetFilters = () => {
    setCustomTournees([]);
    setNewTourneeInput('');
    setMontantOp('>='); setMontantVal('');
    setNbCreanceOp('>='); setNbCreanceVal('');
    setDernierPaiementOp('>'); setDernierPaiementDays('');
    setFilterTypesAbon([]);
    setFilterEtatsCpt([]);
    setFilterTourneesTable([]);
    setSortKey('montant_creance');
    setSortDir('desc');
    setResults(null);
    setSearch('');
    setPage(1);
  };

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  };

  const addTournee = () => {
    const trimmed = newTourneeInput.trim().toUpperCase();
    if (!trimmed) return;
    
    // Extract only digits from the input
    const digits = trimmed.replace(/\D/g, '');
    
    // Validate: must have 1-3 digits
    if (!digits || digits.length > 3) {
      alert('Veuillez entrer un nombre entre 0 et 999');
      return;
    }
    
    // Format as xxx (e.g., 002, 015, 123)
    const formatted = digits.padStart(3, '0');
    
    if (!customTournees.includes(formatted)) {
      setCustomTournees(prev => [...prev, formatted]);
      setNewTourneeInput('');
    } else {
      alert(`${formatted} est déjà ajoutée`);
    }
  };

  const removeTournee = (t: string) => {
    setCustomTournees(prev => prev.filter(x => x !== t));
  };

  const filterOptions = useMemo(() => {
    const base = results ?? [];
    const types = [...new Set(base.map((s: any) => s.type_abon).filter((v: string) => v && v !== '—'))].sort((a, b) =>
      a.localeCompare(b, 'fr')
    );
    const etats = [...new Set(base.map((s: any) => s.etat_cpt).filter((v: string) => v && v !== '—'))].sort((a, b) =>
      a.localeCompare(b, 'fr')
    );
    const tournees = [...new Set(base.map((s: any) => s.tournee).filter((v: string) => v && v !== '—'))].sort((a, b) =>
      a.localeCompare(b, 'fr', { numeric: true })
    );
    return { types, etats, tournees };
  }, [results]);

  const searchFiltered = useMemo(() => {
    const q = search.toLowerCase();
    return (results ?? []).filter(
      (s: any) =>
        !q ||
        s.numab?.toLowerCase().includes(q) ||
        s.name?.toLowerCase().includes(q) ||
        s.type_abon?.toLowerCase().includes(q) ||
        s.etat_cpt?.toLowerCase().includes(q) ||
        s.adresse?.toLowerCase().includes(q)
    );
  }, [results, search]);

  const columnFiltered = useMemo(() => {
    return searchFiltered.filter((s: any) => {
      if (filterTypesAbon.length > 0 && !filterTypesAbon.includes(s.type_abon)) return false;
      if (filterEtatsCpt.length > 0 && !filterEtatsCpt.includes(s.etat_cpt)) return false;
      if (filterTourneesTable.length > 0 && !filterTourneesTable.includes(s.tournee)) return false;
      return true;
    });
  }, [searchFiltered, filterTypesAbon, filterEtatsCpt, filterTourneesTable]);

  const hasTableColumnFilters =
    filterTypesAbon.length > 0 || filterEtatsCpt.length > 0 || filterTourneesTable.length > 0;

  const addTableFilter = (
    value: string,
    selected: string[],
    setter: (next: string[]) => void
  ) => {
    if (!value || selected.includes(value)) return;
    setter([...selected, value]);
    setPage(1);
  };

  const removeTableFilter = (
    value: string,
    selected: string[],
    setter: (next: string[]) => void
  ) => {
    setter(selected.filter(v => v !== value));
    setPage(1);
  };

  const sorted = useMemo(() => {
    const list = [...columnFiltered];
    list.sort((a: any, b: any) => {
      let cmp = 0;
      if (sortKey === 'raw_last_payment') {
        const va = a.raw_last_payment || '';
        const vb = b.raw_last_payment || '';
        if (!va && !vb) cmp = 0;
        else if (!va) cmp = 1;
        else if (!vb) cmp = -1;
        else cmp = va.localeCompare(vb);
      } else if (NUMERIC_SORT_KEYS.has(sortKey)) {
        cmp = (Number(a[sortKey]) || 0) - (Number(b[sortKey]) || 0);
      } else {
        const va = (a[sortKey] ?? '').toString().toLowerCase();
        const vb = (b[sortKey] ?? '').toString().toLowerCase();
        cmp = va.localeCompare(vb, 'fr', { numeric: true });
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [columnFiltered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const visibleNumabs = paged.map((s: any) => s.numab).filter(Boolean);
  const allVisibleSelected = visibleNumabs.length > 0 && visibleNumabs.every(id => selectedNumabs.includes(id));
  const selectedCount = selectedNumabs.length;
  const selectedRows = useMemo(
    () => selectedCount > 0 ? sorted.filter((s: any) => selectedNumabs.includes(s.numab)) : sorted,
    [selectedCount, selectedNumabs, sorted]
  );

  const tableTotals = useMemo(
    () => ({
      count: sorted.length,
      factures: sorted.reduce((a: number, s: any) => a + (s.nombre_creance || 0), 0),
      montant: sorted.reduce((a: number, s: any) => a + (s.montant_creance || 0), 0),
    }),
    [sorted]
  );

  const Th = ({
    label,
    field,
    align = 'left',
    px = 'px-6',
  }: {
    label: string;
    field: string;
    align?: 'left' | 'center' | 'right';
    px?: string;
  }) => {
    const active = sortKey === field;
    const alignCls =
      align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : '';
    return (
      <th
        className={`${px} py-5 ${alignCls} cursor-pointer select-none group`}
        onClick={() => handleSort(field)}
      >
        <span
          className={`inline-flex items-center gap-1.5 ${align === 'center' ? 'justify-center w-full' : ''} ${align === 'right' ? 'justify-end w-full' : ''}`}
        >
          {align === 'right' && (
            <span className={`text-[10px] ${active ? 'text-brand-600' : 'text-[#D0D5DD] group-hover:text-[#98A2B3]'}`}>
              {active ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
            </span>
          )}
          <span className={active ? 'text-brand-600' : 'group-hover:text-[#101828]'}>{label}</span>
          {align !== 'right' && (
            <span className={`text-[10px] ${active ? 'text-brand-600' : 'text-[#D0D5DD] group-hover:text-[#98A2B3]'}`}>
              {active ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
            </span>
          )}
        </span>
      </th>
    );
  };

  const exportCSV = () => {
    const header = ['Code Abonné', 'Nom / Raison Sociale', 'Adresse', 'Bloc', 'N° Dom', 'Type Abonné', 'Code Type', 'État Cpt', 'Code État', 'N° Série Compteur', 'Tournée', 'Dernier Paiement', 'Factures Impayées', 'Montant Créance (DA)'];
    const rows = selectedRows.map((s: any) => [
      s.numab,
      s.name,
      s.adresse || '—',
      s.bloc || '—',
      s.ndom || '—',
      s.type_abon || '—',
      s.type_abon_code || '—',
      s.etat_cpt || '—',
      s.etat_cpt_code || '—',
      s.numser || '—',
      s.tournee,
      s.derniere_date_paiement,
      s.nombre_creance,
      s.montant_creance
    ]);
    const csv = [header, ...rows].map(r => r.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `liste_creanciers_filtree.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const escapeHtml = (v: unknown) =>
    String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const printCreanciersList = () => {
    if (sorted.length === 0) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Veuillez autoriser les fenêtres pop-up pour pouvoir imprimer.');
      return;
    }

    const filterParts: string[] = [];
    if (filterTypesAbon.length > 0) filterParts.push(`Types: ${filterTypesAbon.join(', ')}`);
    if (filterEtatsCpt.length > 0) filterParts.push(`États: ${filterEtatsCpt.join(', ')}`);
    if (filterTourneesTable.length > 0) filterParts.push(`Tournées: ${filterTourneesTable.join(', ')}`);
    if (search.trim()) filterParts.push(`Recherche: ${search.trim()}`);
    const filtersLine = filterParts.length > 0 ? filterParts.join(' · ') : 'Aucun filtre tableau actif';

    const montantCibleLabel = montantVal.trim()
      ? `${OP_OPTIONS.find(o => o.value === montantOp)?.label ?? montantOp} ${montantVal} DA`
      : 'Non défini (tous les montants)';

    const joursCibleLabel = dernierPaiementDays.trim()
      ? `${DAY_OP_OPTIONS.find(o => o.value === dernierPaiementOp)?.label ?? dernierPaiementOp} · ${dernierPaiementDays} jours`
      : 'Non défini (toutes anciennetés)';

    const montantFmt = (n: number) =>
      new Intl.NumberFormat('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        .format(n)
        .replace(/[\u202F\u00A0]/g, ' ') + ' DA';

    const printTotals = {
      count: selectedRows.length,
      factures: selectedRows.reduce((a: number, s: any) => a + (s.nombre_creance || 0), 0),
      montant: selectedRows.reduce((a: number, s: any) => a + (s.montant_creance || 0), 0),
    };

    const rowsHtml = selectedRows
      .map(
        (s: any, i: number) => `
        <tr>
          <td style="text-align:center;color:#98A2B3;font-weight:700;">${i + 1}</td>
          <td class="font-bold-black">${escapeHtml(s.numab)}</td>
          <td class="font-bold-black">${escapeHtml(s.name)}</td>
          <td>${escapeHtml(s.adresse)}</td>
          <td>${escapeHtml(s.bloc)}</td>
          <td>${escapeHtml(s.ndom)}</td>
          <td>${escapeHtml(s.type_abon)}</td>
          <td>${escapeHtml(s.etat_cpt)}</td>
          <td>${escapeHtml(s.numser)}</td>
          <td class="tournee-badge">${escapeHtml(s.tournee)}</td>
          <td>${escapeHtml(s.derniere_date_paiement)}</td>
          <td style="text-align:center;font-weight:700;">${s.nombre_creance ?? 0}</td>
          <td style="text-align:right;font-weight:700;color:#E11D48;">${montantFmt(s.montant_creance || 0)}</td>
          <td class="observation-cell"></td>
        </tr>`
      )
      .join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Liste des abonnés créanciers</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap');
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              color: #101828;
              margin: 40px;
              font-size: 10px;
              line-height: 1.4;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #F2F4F7;
              padding-bottom: 20px;
              margin-bottom: 25px;
            }
            .logo-section { display: flex; align-items: center; gap: 12px; }
            .logo-text { font-size: 14px; font-weight: 900; color: #0D83DE; }
            .company-name { font-size: 9px; font-weight: 700; color: #667085; text-transform: uppercase; }
            .title-section { text-align: right; }
            .title { font-size: 18px; font-weight: 900; margin: 0; }
            .subtitle { font-size: 11px; color: #667085; margin: 4px 0 0 0; }
            .filters { font-size: 10px; color: #667085; margin-bottom: 20px; font-style: italic; }
            .meta-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 12px;
              background-color: #F9FAFB;
              border: 1px solid #E4E7EC;
              border-radius: 12px;
              padding: 12px 20px;
              margin-bottom: 25px;
            }
            .meta-grid-criteria {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 12px;
              background-color: #F5F3FF;
              border: 1px solid #DDD6FE;
              border-radius: 12px;
              padding: 12px 20px;
              margin-bottom: 25px;
            }
            .meta-label { font-size: 9px; font-weight: 700; color: #98A2B3; text-transform: uppercase; }
            .meta-value { font-size: 11px; font-weight: 700; color: #344054; }
            table { width: 100%; border-collapse: collapse; }
            thead { display: table-header-group; }
            tr { page-break-inside: avoid; }
            th {
              background-color: #F9FAFB;
              color: #475467;
              font-size: 8px;
              text-transform: uppercase;
              font-weight: 700;
              border-bottom: 2px solid #EAECF0;
              padding: 8px 6px;
              text-align: left;
            }
            td {
              border-bottom: 1px solid #EAECF0;
              padding: 7px 6px;
              color: #475467;
            }
            .font-bold-black { font-weight: 700; color: #101828; }
            .tournee-badge { font-weight: 700; color: #2563EB; }
            .observation-cell {
              min-width: 90px;
              min-height: 1.4em;
              background-color: #fff;
            }
            tfoot td {
              background-color: #0F172A;
              color: #fff;
              font-weight: 700;
              border: none;
              padding: 12px 6px;
            }
            @page {
              size: A4 landscape;
              margin: 12mm;
            }
            @media print {
              body { margin: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo-section">
              <img src="${window.location.origin}/ade.png" alt="ADE" style="height: 40px; width: auto;" onerror="this.style.display='none'" />
              <div>
                <div class="logo-text">EPEOR Analytics</div>
                <div class="company-name">Algérienne Des Eaux</div>
              </div>
            </div>
            <div class="title-section">
              <h1 class="title">Liste des abonnés créanciers</h1>
              <p class="subtitle">Liste nominative des créances en cours</p>
            </div>
          </div>
          <p class="filters">${escapeHtml(filtersLine)}</p>
          <div class="meta-grid">
            <div><div class="meta-label">Date d'édition</div><div class="meta-value">${new Date().toLocaleDateString('fr-FR')}</div></div>
            <div><div class="meta-label">Nombre d'abonnés</div><div class="meta-value">${printTotals.count}</div></div>
            <div><div class="meta-label">Total créances</div><div class="meta-value" style="color:#E11D48;">${montantFmt(printTotals.montant)}</div></div>
            <div><div class="meta-label">Total factures impayées</div><div class="meta-value">${printTotals.factures.toLocaleString('fr-FR')}</div></div>
            <div><div class="meta-label">Montant ciblé (critère)</div><div class="meta-value">${escapeHtml(montantCibleLabel)}</div></div>
            <div><div class="meta-label">Ancienneté ciblée (critère)</div><div class="meta-value">${escapeHtml(joursCibleLabel)}</div></div>
          </div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Code Abonné</th>
                <th>Nom / Raison Sociale</th>
                <th>Adresse</th>
                <th>Bloc</th>
                <th>N° Dom</th>
                <th>Type Abonné</th>
                <th>État Cpt</th>
                <th>N° Série</th>
                <th>Tournée</th>
                <th>Dernier Paiement</th>
                <th style="text-align:center">Factures</th>
                <th style="text-align:right">Montant ciblé</th>
                <th>Observation</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
            <tfoot>
              <tr>
                <td colspan="11" style="text-transform:uppercase;letter-spacing:0.05em;">TOTAL GÉNÉRAL — ${printTotals.count} abonné${printTotals.count !== 1 ? 's' : ''}</td>
                <td style="text-align:center;">${printTotals.factures.toLocaleString('fr-FR')}</td>
                <td style="text-align:right;color:#FCA5A5;">${montantFmt(printTotals.montant)}</td>
                <td class="observation-cell"></td>
              </tr>
            </tfoot>
          </table>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                setTimeout(function() { window.close(); }, 500);
              }, 300);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handlePrintQuarterlyCreanciers = () => {
    if (sorted.length === 0 && selectedRows.length === 0) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Veuillez autoriser les fenêtres pop-up pour pouvoir imprimer.');
      return;
    }

    const sourceRows = selectedRows.length > 0 ? selectedRows : sorted;

    // 1. Find latest bill date
    let maxDateStr = '';
    for (const r of sourceRows) {
      if (r.factures && Array.isArray(r.factures)) {
        for (const f of r.factures) {
          const df = String(f.date_fact || '').trim();
          if (df && df.length === 8) {
            if (!maxDateStr || df > maxDateStr) maxDateStr = df;
          }
        }
      }
    }

    let refYear = new Date().getFullYear();
    if (maxDateStr && maxDateStr.length >= 4) {
      const parsedYear = parseInt(maxDateStr.substring(0,4), 10);
      if (!isNaN(parsedYear)) refYear = parsedYear;
    }

    const startYear = refYear - 10;
    const endYear = refYear;
    const antecedentYear = startYear - 1;
    const years: number[] = [];
    for (let y = startYear; y <= endYear; y++) years.push(y);

    let hasAntecedents = false;
    for (const r of sourceRows) {
      if (r.factures && Array.isArray(r.factures)) {
        for (const f of r.factures) {
          const df = String(f.date_fact || '').trim();
          if (df.length === 8) {
            const y = parseInt(df.substring(0,4), 10);
            if (y < startYear) { hasAntecedents = true; break; }
          }
        }
      }
      if (hasAntecedents) break;
    }

    const filterTexts: string[] = [];
    if (filterTypesAbon.length > 0) filterTexts.push(`Type: ${filterTypesAbon.join(', ')}`);
    if (filterEtatsCpt.length > 0) filterTexts.push(`États: ${filterEtatsCpt.join(', ')}`);
    if (filterTourneesTable.length > 0) filterTexts.push(`Tournées: ${filterTourneesTable.join(', ')}`);
    if (search.trim()) filterTexts.push(`Recherche: ${search.trim()}`);

    const getQuarter = (monthStr: string) => {
      const m = parseInt(monthStr, 10);
      if (isNaN(m)) return 1;
      if (m<=3) return 1; if (m<=6) return 2; if (m<=9) return 3; return 4;
    };

    const matrixRows = sourceRows.map((r: any) => {
      const cellAmounts: Record<string, number> = {};
      let subscriberTotal = 0;
      let hasMonthly = false; let hasQuarterly = false;
      if (r.factures && Array.isArray(r.factures)) {
        for (const f of r.factures) {
          const df = String(f.date_fact || '').trim();
          if (df.length === 8) {
            const y = parseInt(df.substring(0,4), 10);
            const mStr = df.substring(4,6);
            const amt = Number(f.montant) || 0;
            const periode = Number(f.periode) || 3;
            if (periode===1) hasMonthly = true; if (periode===3) hasQuarterly = true;
            if (y>=startYear && y<=endYear) {
              if (periode===1) { const key = `${y}-M${mStr}`; cellAmounts[key] = (cellAmounts[key]||0) + amt; }
              else { const q = getQuarter(mStr); const key = `${y}-Q${q}`; cellAmounts[key] = (cellAmounts[key]||0) + amt; }
              subscriberTotal += amt;
            } else if (y < startYear) {
              if (periode===1) { const key = `Ant-M${mStr}`; cellAmounts[key] = (cellAmounts[key]||0) + amt; }
              else { const q = getQuarter(mStr); const key = `Ant-Q${q}`; cellAmounts[key] = (cellAmounts[key]||0) + amt; }
              subscriberTotal += amt;
            }
          }
        }
      }
      let finalCellAmounts = cellAmounts;
      if (hasMonthly && hasQuarterly) {
        finalCellAmounts = {};
        for (const [key, value] of Object.entries(cellAmounts)) {
          if (key.includes('-M')) {
            const [yearPart, monthPart] = key.split('-');
            const monthNum = monthPart.substring(1);
            const q = getQuarter(monthNum);
            const newKey = `${yearPart}-Q${q}`;
            finalCellAmounts[newKey] = (finalCellAmounts[newKey]||0) + (value as number);
          } else finalCellAmounts[key] = (finalCellAmounts[key]||0) + (value as number);
        }
      }
      return {
        ...r,
        cellAmounts: finalCellAmounts,
        subscriberTotal,
        hasMonthly,
        hasQuarterly,
        isMonthlySolo: hasMonthly && !hasQuarterly
      };
    });

    const columnTotals: Record<number, number> = {};
    let antecedentColumnTotal = 0; let grandTotal = 0;
    for (const y of years) {
      columnTotals[y] = 0;
      for (const mr of matrixRows) {
        let yearSum = 0;
        for (let q=1;q<=4;q++) yearSum += mr.cellAmounts[`${y}-Q${q}`]||0;
        for (let m=1;m<=12;m++) yearSum += mr.cellAmounts[`${y}-M${String(m).padStart(2,'0')}`]||0;
        columnTotals[y] += yearSum;
      }
      grandTotal += columnTotals[y];
    }
    if (hasAntecedents) {
      for (const mr of matrixRows) {
        let ant=0; for (let q=1;q<=4;q++) ant += mr.cellAmounts[`Ant-Q${q}`]||0; for (let m=1;m<=12;m++) ant += mr.cellAmounts[`Ant-M${String(m).padStart(2,'0')}`]||0; antecedentColumnTotal += ant;
      }
      grandTotal += antecedentColumnTotal;
    }

    const fmtClean = (n: number) => n===0? '—' : new Intl.NumberFormat('fr-DZ',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n).replace(/[\u202F\u00A0]/g,' ') + ' DA';
    const fmtCleanTotal = (n: number) => new Intl.NumberFormat('fr-DZ',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n).replace(/[\u202F\u00A0]/g,' ') + ' DA';

    // Construct print html content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Détails des Créances par Facture et Trimestre (10 ans) - Abonnés</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap');
            @page {
              size: landscape;
              margin: 6mm 6mm;
            }
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              color: #101828;
              margin: 10px;
              font-size: 8px;
              line-height: 1.2;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #F2F4F7;
              padding-bottom: 8px;
              margin-bottom: 10px;
            }
            .logo-section {
              display: flex;
              align-items: center;
              gap: 8px;
            }
            .logo-text {
              font-size: 11px;
              font-weight: 900;
              color: #0D83DE;
              letter-spacing: -0.5px;
              margin-bottom: 1px;
            }
            .company-name {
              font-size: 7px;
              font-weight: 700;
              color: #667085;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .title-section {
              text-align: right;
            }
            .title {
              font-size: 13px;
              font-weight: 900;
              color: #101828;
              margin: 0;
              letter-spacing: -0.5px;
            }
            .subtitle {
              font-size: 8px;
              color: #667085;
              margin: 2px 0 0 0;
              font-weight: 500;
            }
            .filters {
              background-color: #F9FAFB;
              border: 1px solid #E4E7EC;
              border-radius: 6px;
              padding: 6px 12px;
              margin-bottom: 8px;
              font-size: 7px;
            }
            .filter-item {
              margin-bottom: 2px;
            }
            .filter-label {
              font-weight: 700;
              color: #98A2B3;
              text-transform: uppercase;
            }
            .filter-value {
              color: #344054;
              margin-left: 4px;
            }
            .meta-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 10px;
              background-color: #F9FAFB;
              border: 1px solid #E4E7EC;
              border-radius: 6px;
              padding: 6px 12px;
              margin-bottom: 10px;
            }
            .meta-item {
              display: flex;
              flex-direction: column;
            }
            .meta-label {
              font-size: 7px;
              font-weight: 700;
              color: #98A2B3;
              text-transform: uppercase;
              margin-bottom: 1px;
            }
            .meta-value {
              font-size: 9px;
              font-weight: 700;
              color: #344054;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 5px;
            }
            thead {
              display: table-header-group;
            }
            tr {
              page-break-inside: avoid;
            }
            th {
              background-color: #F9FAFB;
              color: #475467;
              font-size: 7.5px;
              text-transform: uppercase;
              font-weight: 700;
              border: 1px solid #EAECF0;
              padding: 4px 6px;
              text-align: center;
            }
            td {
              border: 1px solid #EAECF0;
              padding: 4px 6px;
              text-align: center;
              color: #475467;
              font-size: 7.5px;
            }
            .year-col {
              background-color: #F8F9FC;
              font-weight: 700;
              width: 6.5%;
            }
            .info-cell {
              text-align: left;
              line-height: 1.3;
              width: 15%;
              min-width: 150px;
              font-size: 7.5px;
              background-color: #FFFFFF;
              font-weight: 500;
              vertical-align: middle;
              padding: 4px 6px;
            }
            .info-cell.resilie {
              color: #B91C1C;
              font-weight: 900;
            }
            .info-cell.resilie strong {
              color: #B91C1C;
            }
            .q-label-cell {
              font-weight: 700;
              text-align: left;
              background-color: #F9FAFB;
              font-size: 7.5px;
              color: #344054;
            }
            .order-cell {
              text-align: center;
              vertical-align: middle;
              font-weight: 700;
              width: 4%;
              font-size: 7.5px;
              background-color: #FFFFFF;
            }
            .amount-val {
              font-family: monospace;
              font-size: 7px;
              text-align: center;
              white-space: nowrap;
            }
            .total-cell {
              font-weight: 900;
              font-family: monospace;
              font-size: 7px;
              text-align: center;
            }
            .resilie-row td,
            .resilie-row .total-cell {
              color: #B91C1C !important;
              font-weight: 900;
            }
            .has-value {
              background-color: #FEF3C7;
              font-weight: 700;
              color: #B45309;
            }
            .has-value-ant {
              background-color: #FFF5F5;
              font-weight: 700;
              color: #B91C1C;
            }
            .has-value-ant-subtotal {
              background-color: #FEE2E2;
              color: #991B1B;
            }
            .has-value-subtotal {
              background-color: #E0F2FE;
              color: #0369A1;
            }
            .total-cell {
              font-weight: 900;
              font-family: monospace;
              font-size: 7px;
              text-align: center;
              background-color: #E5E7EB !important;
              color: #111827 !important;
            }
            .subtotal-row {
              background-color: #F3F4F6;
              font-weight: 900;
            }
            .footer-row {
              background-color: #E5E7EB !important;
              color: #111827 !important;
              font-weight: 900;
            }
            .footer-row td {
              border-color: #D1D5DB;
              color: #111827 !important;
              padding: 6px 8px;
            }
            .footer-row .total-sum {
              background-color: #E5E7EB !important;
              color: #111827 !important;
              font-family: monospace;
              font-size: 7.5px;
              text-align: right;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo-section">
              <img src="${window.location.origin}/ade.png" alt="ADE Logo" style="height: 25px; width: auto;" />
              <div style="display: flex; flex-direction: column;">
                <span class="logo-text">EPEOR Analytics</span>
                <span class="company-name">Algérienne Des Eaux</span>
              </div>
            </div>
            <div class="title-section">
              <h1 class="title">Créance Abonnés — Impression par Facture</h1>
              <p class="subtitle">Détails des factures impayées (mensuelles et/ou trimestrielles) sur 10 ans (${startYear} - ${endYear})</p>
            </div>
          </div>

          ${filterTexts.length > 0 ? `<div class="filters">${filterTexts.map(t => `<div class="filter-item"><span class="filter-label">Filtres appliqués :</span> ${t}</div>`).join('')}</div>` : ''}

          <div class="meta-grid">
            <div class="meta-item">
              <span class="meta-label">Total Abonnés</span>
              <span class="meta-value">${sourceRows.length}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Période d'Analyse</span>
              <span class="meta-value">10 ans (${startYear} à ${endYear})</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Montant Total Créance Table</span>
              <span class="meta-value">${fmtCleanTotal(grandTotal)}</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 4%">N° Ordre</th>
                <th style="width: 14%; text-align: left;">Informations</th>
                <th style="width: 8%; text-align: left;">Période</th>
                ${hasAntecedents ? `<th class="year-col" style="background-color: #FEE2E2; color: #991B1B;">Ant. ${antecedentYear}</th>` : ''}
                ${years.map(y => `<th class="year-col">${y}</th>`).join('')}
                <th style="width: 10%; background-color: #E5E7EB; color: #111827;">Total Créance</th>
              </tr>
            </thead>
            <tbody>
              ${matrixRows.map((mr, mi) => {
                const monthLabels = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
                const qLabels = ["1° Trim", "2° Trim", "3° Trim", "4° Trim"];
                const resilieClass = mr.etat_cpt === 'RESILIE' ? 'resilie-row' : '';
                const infoCellClass = mr.etat_cpt === 'RESILIE' ? 'info-cell resilie' : 'info-cell';
                const orderNumber = String(mi + 1).padStart(2, '0');

                let periodsToShow: { label: string; keys: string[] }[] = [];
                let rowSpan = 5;

                if (mr.isMonthlySolo) {
                  periodsToShow = monthLabels.map((label, idx) => ({
                    label,
                    keys: [String(idx + 1).padStart(2, '0')]
                  }));
                  rowSpan = 13;
                } else {
                  periodsToShow = [
                    { label: "1° Trim", keys: ["01", "02", "03"] },
                    { label: "2° Trim", keys: ["04", "05", "06"] },
                    { label: "3° Trim", keys: ["07", "08", "09"] },
                    { label: "4° Trim", keys: ["10", "11", "12"] }
                  ];
                  rowSpan = 5;
                }

                const periodsHtml = periodsToShow.map((period, idx) => {
                  const orderCellHtml = idx === 0 ? `
                    <td rowspan="${rowSpan}" class="order-cell">${orderNumber}</td>
                  ` : '';

                  const infoCellHtml = idx === 0 ? `
                    <td rowspan="${rowSpan}" class="${infoCellClass}">
                      <strong>Code:</strong> ${mr.numab || '—'}<br/>
                      <strong>Nom:</strong> ${mr.name || mr.raisoc || '—'}<br/>
                      <strong>Adresse:</strong> ${mr.adresse || '—'}<br/>
                      ${mr.bloc && mr.bloc !== '—' ? `<strong>Bloc:</strong> ${mr.bloc}<br/>` : ''}
                      ${mr.ndom && mr.ndom !== '—' ? `<strong>N° Dom:</strong> ${mr.ndom}<br/>` : ''}
                      <strong>N° Série:</strong> ${mr.numser || '—'}<br/>
                      <strong>État:</strong> ${mr.etat_cpt || '—'}<br/>
                      <strong>Tournée:</strong> ${mr.tournee ? `T-${mr.tournee}` : '—'}
                    </td>
                  ` : '';

                  let periodTotal = 0;
                  if (mr.isMonthlySolo) {
                    const monthKey = period.keys[0];
                    periodTotal = years.reduce((sum, y) => sum + (mr.cellAmounts[`${y}-M${monthKey}`] || 0), 0);
                    if (hasAntecedents) {
                      periodTotal += (mr.cellAmounts[`Ant-M${monthKey}`] || 0);
                    }
                  } else {
                    const q = parseInt(period.label.charAt(0));
                    periodTotal = years.reduce((sum, y) => sum + (mr.cellAmounts[`${y}-Q${q}`] || 0), 0);
                    if (hasAntecedents) {
                      periodTotal += (mr.cellAmounts[`Ant-Q${q}`] || 0);
                    }
                  }

                  const antCellHtml = hasAntecedents ? (() => {
                    let antVal = 0;
                    if (mr.isMonthlySolo) {
                      antVal = mr.cellAmounts[`Ant-M${period.keys[0]}`] || 0;
                    } else {
                      const q = parseInt(period.label.charAt(0));
                      antVal = mr.cellAmounts[`Ant-Q${q}`] || 0;
                    }
                    const hasVal = antVal >= 0.01;
                    return `<td class="amount-val ${hasVal ? 'has-value-ant' : ''} ${resilieClass}" style="background-color: #FFF5F5;">${fmtClean(antVal)}</td>`;
                  })() : '';

                  const yearCellsHtml = years.map(y => {
                    let val = 0;
                    if (mr.isMonthlySolo) {
                      val = mr.cellAmounts[`${y}-M${period.keys[0]}`] || 0;
                    } else {
                      const q = parseInt(period.label.charAt(0));
                      val = mr.cellAmounts[`${y}-Q${q}`] || 0;
                    }
                    const hasVal = val >= 0.01;
                    return `<td class="amount-val ${hasVal ? 'has-value' : ''} ${resilieClass}">${fmtClean(val)}</td>`;
                  }).join('');

                  const grandTotalCellHtml = idx === 0 ? `
                    <td rowspan="${rowSpan}" class="total-cell ${resilieClass}">
                      ${fmtCleanTotal(mr.subscriberTotal)}
                    </td>
                  ` : '';

                  return `
                    <tr class="${resilieClass}">
                      ${orderCellHtml}
                      ${infoCellHtml}
                      <td class="q-label-cell">${period.label}</td>
                      ${antCellHtml}
                      ${yearCellsHtml}
                      ${grandTotalCellHtml}
                    </tr>
                  `;
                }).join('');

                const antTotalCellHtml = hasAntecedents ? (() => {
                  let antTotal = 0;
                  if (mr.isMonthlySolo) {
                    for (let m = 1; m <= 12; m++) {
                      antTotal += mr.cellAmounts[`Ant-M${String(m).padStart(2, '0')}`] || 0;
                    }
                  } else {
                    for (let q = 1; q <= 4; q++) {
                      antTotal += mr.cellAmounts[`Ant-Q${q}`] || 0;
                    }
                  }
                  const hasVal = antTotal >= 0.01;
                  return `<td class="amount-val ${hasVal ? 'has-value-ant-subtotal' : ''}" style="font-weight: 900; background-color: #FEE2E2;">${fmtClean(antTotal)}</td>`;
                })() : '';

                const subTotalYearCellsHtml = years.map(y => {
                  let yearTotal = 0;
                  if (mr.isMonthlySolo) {
                    for (let m = 1; m <= 12; m++) {
                      yearTotal += mr.cellAmounts[`${y}-M${String(m).padStart(2, '0')}`] || 0;
                    }
                  } else {
                    for (let q = 1; q <= 4; q++) {
                      yearTotal += mr.cellAmounts[`${y}-Q${q}`] || 0;
                    }
                  }
                  const hasVal = yearTotal >= 0.01;
                  return `<td class="amount-val ${hasVal ? 'has-value-subtotal' : ''}" style="font-weight: 900;">${fmtClean(yearTotal)}</td>`;
                }).join('');

                const totalRowHtml = `
                  <tr class="subtotal-row ${resilieClass}">
                    <td class="q-label-cell" style="background-color: #EAECF0;">TOTAL</td>
                    ${antTotalCellHtml}
                    ${subTotalYearCellsHtml}
                  </tr>
                `;

                return periodsHtml + totalRowHtml;
              }).join('')}

              <tr class="footer-row">
                <td colspan="3" style="text-align: left;">TOTAL GÉNÉRAL</td>
                ${hasAntecedents ? `<td class="total-sum" style="background-color: #E5E7EB !important; color: #111827 !important; text-align: right;">${fmtCleanTotal(antecedentColumnTotal)}</td>` : ''}
                ${years.map(y => `<td class="total-sum">${fmtCleanTotal(columnTotals[y] || 0)}</td>`).join('')}
                <td class="total-sum" style="background-color: #E5E7EB !important; color: #111827 !important;">${fmtCleanTotal(grandTotal)}</td>
              </tr>
            </tbody>
          </table>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                setTimeout(function() { window.close(); }, 500);
              }, 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const OP_OPTIONS = [
    { value: '>=', label: '≥ (Supérieur ou égal)' },
    { value: '=',  label: '= (Égal à)' },
    { value: '<=', label: '≤ (Inférieur ou égal)' },
  ];
  const DAY_OP_OPTIONS = [
    { value: '>', label: '> Plus de N jours' },
    { value: '=', label: '= Exactement N jours' },
    { value: '<', label: '< Moins de N jours' },
  ];

  const inputCls = "w-full px-3.5 py-2.5 bg-[#F9FAFB] border border-[#E4E7EC] rounded-xl text-xs font-bold text-[#101828] placeholder:text-[#98A2B3] outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100/60 transition-all";
  const selectCls = "w-full px-3.5 py-2.5 bg-[#F9FAFB] border border-[#E4E7EC] rounded-xl text-xs font-black text-[#475467] outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100/60 transition-all appearance-none cursor-pointer";
  const labelCls = "block text-[10px] font-black uppercase tracking-widest text-[#667085] mb-2";

  return (
    <div className="space-y-8 animate-in fade-in duration-300">

      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] p-8 no-print">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-bold text-[#667085] hover:text-[#101828] mb-4 transition-all active:scale-95 cursor-pointer"
        >
          <ChevronRight className="rotate-180" size={16} /> Retour au tableau de bord
        </button>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black tracking-tight text-[#101828]">Créances Abonnés</h2>
            <p className="text-sm text-[#667085] mt-1 font-medium">
              Établissez une liste nominative des abonnés créanciers en configurant vos critères de filtrage
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#98A2B3]">
            {dataLoaded && <span className="text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">{allSubscribers.length} créanciers chargés</span>}
          </div>
        </div>
      </div>

      {/* ── Filter Panel ─────────────────────────────────────────────── */}
      <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] overflow-hidden">
        <button
          onClick={() => setFilterExpanded(!filterExpanded)}
          className="w-full px-8 py-5 border-b border-[#F2F4F7] bg-gradient-to-r from-brand-50/60 to-white flex items-center gap-3 hover:bg-gradient-to-r hover:from-brand-100/40 hover:to-white/80 transition-all"
        >
          <div className="w-8 h-8 bg-brand-100 rounded-xl flex items-center justify-center">
            <Search size={14} className="text-brand-600" />
          </div>
          <div className="flex-1 text-left">
            <h3 className="text-sm font-black text-[#101828]">Critères de Filtrage</h3>
            <p className="text-xs text-[#667085] font-medium">Définissez vos critères puis cliquez sur Rechercher</p>
          </div>
          <div className="text-[#98A2B3]">
            {filterExpanded ? (
              <ChevronDown size={18} className="transition-transform" />
            ) : (
              <ChevronRight size={18} className="transition-transform" />
            )}
          </div>
        </button>

        {filterExpanded && (
          <>
        <div className="p-8">
          {dataLoading ? (
            <div className="flex items-center justify-center gap-3 py-10">
              <div className="w-8 h-8 border-4 border-brand-100 border-t-brand-600 rounded-full animate-spin" />
              <p className="text-sm font-bold text-[#667085]">Chargement des données...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-10">
              <p className="text-sm font-bold text-rose-600">{error}</p>
              <button onClick={loadData} className="px-4 py-2 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-xs font-bold hover:bg-rose-100 transition-all">
                Réessayer le chargement
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 items-start">

                {/* 1. Tournées */}
                <div>
                  <label className={labelCls}>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-4 h-4 bg-blue-100 rounded-md flex items-center justify-center text-blue-600 text-[9px] font-black">1</span>
                      Tournée(s)
                    </span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="ex: 1, 15, 2"
                      value={newTourneeInput}
                      onChange={e => setNewTourneeInput(e.target.value)}
                      onKeyPress={e => e.key === 'Enter' && addTournee()}
                      className={inputCls}
                    />
                    <button
                      onClick={addTournee}
                      disabled={!newTourneeInput.trim()}
                      className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    >
                      Ajouter
                    </button>
                  </div>
                  <p className="text-[10px] text-[#98A2B3] font-medium mt-1.5">Vide = toutes les tournées</p>
                </div>

                {/* 2. Montant de créance */}
                <div>
                  <label className={labelCls}>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-4 h-4 bg-rose-100 rounded-md flex items-center justify-center text-rose-600 text-[9px] font-black">2</span>
                      Montant de Créance (DA)
                    </span>
                  </label>
                  <div className="flex gap-2">
                    <div className="relative w-20 flex-shrink-0">
                      <select
                        value={montantOp}
                        onChange={e => setMontantOp(e.target.value as any)}
                        className={selectCls}
                      >
                        {OP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label.split(' ')[0]}</option>)}
                      </select>
                    </div>
                    <input
                      type="number"
                      placeholder="ex: 2000"
                      value={montantVal}
                      onChange={e => setMontantVal(e.target.value)}
                      className={inputCls}
                      min="0"
                    />
                  </div>
                  <p className="text-[10px] text-[#98A2B3] font-medium mt-1.5">Laissez vide pour ignorer</p>
                </div>

                {/* 3. Nombre de créances */}
                <div>
                  <label className={labelCls}>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-4 h-4 bg-amber-100 rounded-md flex items-center justify-center text-amber-600 text-[9px] font-black">3</span>
                      Factures Impayées
                    </span>
                  </label>
                  <div className="flex gap-2">
                    <div className="relative w-20 flex-shrink-0">
                      <select
                        value={nbCreanceOp}
                        onChange={e => setNbCreanceOp(e.target.value as any)}
                        className={selectCls}
                      >
                        {OP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label.split(' ')[0]}</option>)}
                      </select>
                    </div>
                    <input
                      type="number"
                      placeholder="ex: 5"
                      value={nbCreanceVal}
                      onChange={e => setNbCreanceVal(e.target.value)}
                      className={inputCls}
                      min="0"
                      step="1"
                    />
                  </div>
                  <p className="text-[10px] text-[#98A2B3] font-medium mt-1.5">Laissez vide pour ignorer</p>
                </div>

                {/* 4. Dernier paiement */}
                <div>
                  <label className={labelCls}>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-4 h-4 bg-teal-100 rounded-md flex items-center justify-center text-teal-600 text-[9px] font-black">4</span>
                      Ancienneté Paiement
                    </span>
                  </label>
                  <div className="flex gap-2">
                    <div className="relative w-20 flex-shrink-0">
                      <select
                        value={dernierPaiementOp}
                        onChange={e => setDernierPaiementOp(e.target.value as any)}
                        className={selectCls}
                      >
                        {DAY_OP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label.split(' ')[0]}</option>)}
                      </select>
                    </div>
                    <div className="relative flex-1">
                      <input
                        type="number"
                        placeholder="ex: 30"
                        value={dernierPaiementDays}
                        onChange={e => setDernierPaiementDays(e.target.value)}
                        className={inputCls}
                        min="0"
                        step="1"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#98A2B3]">j</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-[#98A2B3] font-medium mt-1.5">Sans paiement = inclus</p>
                </div>

              </div>

              {customTournees.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap p-4 bg-blue-50 border border-blue-100 rounded-xl mt-6">
                  <span className="text-[10px] font-black uppercase tracking-widest text-blue-700">Tournées ajoutées :</span>
                  {customTournees.map(t => (
                    <span key={t} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-blue-700 rounded-lg text-[11px] font-black border border-blue-200 shadow-sm">
                      {t}
                      <button onClick={() => removeTournee(t)} className="text-blue-400 hover:text-blue-700 font-bold">×</button>
                    </span>
                  ))}
                  <button onClick={() => setCustomTournees([])} className="text-[10px] text-rose-500 font-bold hover:text-rose-700 ml-auto">Tout effacer</button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Action buttons */}
        {!dataLoading && !error && (
          <div className="flex items-center justify-between gap-4 px-8 py-5 border-t border-[#F2F4F7] bg-[#F9FAFB]/60">
            <button
              onClick={resetFilters}
              className="px-5 py-2.5 rounded-xl text-xs font-black text-[#667085] bg-white border border-[#E4E7EC] hover:border-[#D0D5DD] active:scale-95 transition-all"
            >
              Réinitialiser
            </button>
            <button
              onClick={applyFilters}
              disabled={!dataLoaded}
              className="inline-flex items-center gap-2 px-7 py-3 bg-brand-600 text-white rounded-xl text-sm font-black hover:bg-brand-700 active:scale-95 transition-all shadow-lg shadow-brand-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Search size={15} />
              Rechercher les Créanciers
            </button>
          </div>
        )}
        </>
        )}
      </div>

      {/* ── Results ───────────────────────────────────────────────────── */}
      {results === null ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 bg-white border border-dashed border-[#D0D5DD] rounded-[2rem]">
          <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center border border-brand-100">
            <Search size={24} className="text-brand-400" />
          </div>
          <p className="text-base font-black text-[#344054]">Configurez vos critères puis cliquez sur Rechercher</p>
          <p className="text-xs text-[#98A2B3] font-medium">Les résultats apparaîtront ici</p>
        </div>
      ) : (
        <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] overflow-hidden">
          {/* Results toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-8 py-5 border-b border-[#F2F4F7] bg-slate-50/30">
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-black border ${results.length === 0 ? 'bg-slate-50 text-slate-600 border-slate-200' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                {results.length} abonné{results.length !== 1 ? 's' : ''} créancier{results.length !== 1 ? 's' : ''}
              </span>
              {results.length > 0 && (
                <span className="text-xs text-[#667085] font-bold">
                  Total créances : <span className="text-rose-600">{fmt(results.reduce((a, s) => a + s.montant_creance, 0))}</span>
                </span>
              )}
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#98A2B3]" />
                <input
                  type="text"
                  placeholder="Affiner par code ou nom..."
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                  className="pl-8 pr-4 py-2 bg-[#F9FAFB] border border-[#E4E7EC] rounded-xl text-xs font-bold text-[#101828] placeholder:text-[#98A2B3] outline-none focus:border-brand-300 transition-all w-60"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#667085]">
                {selectedCount > 0 ? (
                  <>
                    <span className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-brand-50 text-brand-700 border border-brand-100">
                      <strong>{selectedCount}</strong> abonné{selectedCount !== 1 ? 's' : ''} sélectionné{selectedCount !== 1 ? 's' : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedNumabs([])}
                      className="px-3 py-2 rounded-xl bg-white border border-[#E4E7EC] text-[#344054] hover:bg-[#F9FAFB] text-[10px] font-black"
                    >
                      Effacer la sélection
                    </button>
                  </>
                ) : (
                  <span className="text-[10px] text-[#98A2B3]">Sélectionnez les lignes pour imprimer uniquement celles-ci.</span>
                )}
              </div>
              <button
                onClick={printCreanciersList}
                disabled={selectedRows.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-[#E4E7EC] text-[#344054] rounded-xl text-xs font-black hover:bg-[#F9FAFB] hover:border-[#D0D5DD] active:scale-95 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Printer size={13} /> {selectedCount > 0 ? 'Imprimer la sélection' : 'Imprimer tout'}
              </button>
              <button
                onClick={handlePrintQuarterlyCreanciers}
                disabled={sorted.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 bg-brand-50 text-brand-700 border border-brand-100 rounded-xl text-xs font-black hover:bg-brand-100 active:scale-95 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Printer size={13} /> Détails des factures impayées
              </button>
              <button
                onClick={exportCSV}
                disabled={sorted.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black hover:bg-emerald-700 active:scale-95 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileSpreadsheet size={13} /> Exporter CSV
              </button>
            </div>
          </div>

          {/* Filtres colonnes tableau (sélection multiple) */}
          <div className="flex flex-wrap items-start gap-4 px-8 py-4 border-b border-[#F2F4F7] bg-brand-50/20">
            <div className="min-w-[220px] flex-1">
              <label className={labelCls}>Type Abonné</label>
              <select
                value=""
                onChange={e => addTableFilter(e.target.value, filterTypesAbon, setFilterTypesAbon)}
                className={selectCls}
              >
                <option value="">Ajouter un type…</option>
                {filterOptions.types
                  .filter(t => !filterTypesAbon.includes(t))
                  .map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
              </select>
              {filterTypesAbon.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {filterTypesAbon.map(t => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-brand-100 text-brand-800 border border-brand-200"
                    >
                      {t}
                      <button
                        type="button"
                        onClick={() => removeTableFilter(t, filterTypesAbon, setFilterTypesAbon)}
                        className="text-brand-500 hover:text-brand-900 font-black leading-none"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={() => { setFilterTypesAbon([]); setPage(1); }}
                    className="text-[10px] text-rose-500 font-bold hover:text-rose-700"
                  >
                    Tout effacer
                  </button>
                </div>
              ) : (
                <p className="text-[10px] text-[#98A2B3] mt-1.5">Aucun — tous les types</p>
              )}
            </div>
            <div className="min-w-[220px] flex-1">
              <label className={labelCls}>État Cpt</label>
              <select
                value=""
                onChange={e => addTableFilter(e.target.value, filterEtatsCpt, setFilterEtatsCpt)}
                className={selectCls}
              >
                <option value="">Ajouter un état…</option>
                {filterOptions.etats
                  .filter(e => !filterEtatsCpt.includes(e))
                  .map(e => (
                    <option key={e} value={e}>{e}</option>
                  ))}
              </select>
              {filterEtatsCpt.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {filterEtatsCpt.map(e => (
                    <span
                      key={e}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-200"
                    >
                      {e}
                      <button
                        type="button"
                        onClick={() => removeTableFilter(e, filterEtatsCpt, setFilterEtatsCpt)}
                        className="text-teal-600 hover:text-teal-900 font-black leading-none"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={() => { setFilterEtatsCpt([]); setPage(1); }}
                    className="text-[10px] text-rose-500 font-bold hover:text-rose-700"
                  >
                    Tout effacer
                  </button>
                </div>
              ) : (
                <p className="text-[10px] text-[#98A2B3] mt-1.5">Aucun — tous les états</p>
              )}
            </div>
            <div className="min-w-[160px] flex-1">
              <label className={labelCls}>Tournée</label>
              <select
                value=""
                onChange={e => addTableFilter(e.target.value, filterTourneesTable, setFilterTourneesTable)}
                className={selectCls}
              >
                <option value="">Ajouter une tournée…</option>
                {filterOptions.tournees
                  .filter(t => !filterTourneesTable.includes(t))
                  .map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
              </select>
              {filterTourneesTable.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {filterTourneesTable.map(t => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200"
                    >
                      {t}
                      <button
                        type="button"
                        onClick={() => removeTableFilter(t, filterTourneesTable, setFilterTourneesTable)}
                        className="text-blue-600 hover:text-blue-900 font-black leading-none"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={() => { setFilterTourneesTable([]); setPage(1); }}
                    className="text-[10px] text-rose-500 font-bold hover:text-rose-700"
                  >
                    Tout effacer
                  </button>
                </div>
              ) : (
                <p className="text-[10px] text-[#98A2B3] mt-1.5">Aucune — toutes les tournées</p>
              )}
            </div>
            {hasTableColumnFilters && (
              <button
                type="button"
                onClick={() => {
                  setFilterTypesAbon([]);
                  setFilterEtatsCpt([]);
                  setFilterTourneesTable([]);
                  setPage(1);
                }}
                className="px-4 py-2.5 rounded-xl text-xs font-black text-brand-700 bg-white border border-brand-200 hover:bg-brand-50 transition-all self-end"
              >
                Effacer tous les filtres
              </button>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            {sorted.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3">
                <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100">
                  <Users size={26} className="text-[#D0D5DD]" />
                </div>
                <p className="text-sm font-bold text-[#667085]">
                  {results.length === 0
                    ? 'Aucun abonné ne correspond à ces critères.'
                    : 'Aucun résultat avec les filtres du tableau.'}
                </p>
                <p className="text-xs text-[#98A2B3]">Essayez d\'assouplir vos conditions de filtrage.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F9FAFB] text-[#475467] text-[10px] uppercase tracking-wider font-black border-b border-[#F2F4F7]">
                    <th className="px-4 py-5 w-12">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-[#D0D5DD] text-brand-600 focus:ring-brand-500"
                        checked={allVisibleSelected}
                        onChange={() => {
                          if (allVisibleSelected) {
                            setSelectedNumabs(prev => prev.filter(id => !visibleNumabs.includes(id)));
                          } else {
                            setSelectedNumabs(prev => Array.from(new Set([...prev, ...visibleNumabs])));
                          }
                        }}
                      />
                    </th>
                    <th className="px-8 py-5 w-12">#</th>
                    <Th label="Code Abonné" field="numab" />
                    <Th label="Nom / Raison Sociale" field="name" />
                    <Th label="Adresse" field="adresse" align="center" />
                    <Th label="Bloc" field="bloc" align="center" />
                    <Th label="N° Dom" field="ndom" align="center" />
                    <Th label="Type Abonné" field="type_abon" align="center" />
                    <Th label="État Cpt" field="etat_cpt" align="center" />
                    <Th label="N° Série Compteur" field="numser" align="center" />
                    <Th label="Tournée" field="tournee" align="center" />
                    <Th label="Dernier Paiement" field="raw_last_payment" align="center" />
                    <Th label="Factures Impayées" field="nombre_creance" align="center" />
                    <Th label="Montant Créance" field="montant_creance" align="right" px="px-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2F4F7]">
                  {paged.map((s: any, i: number) => {
                    const days = daysSince(s.raw_last_payment);
                    const isAlarmant = days === null || days > 90;
                    return (
                      <tr key={s.numab} className="hover:bg-brand-50/10 transition-colors group">
                        <td className="px-4 py-4 text-center">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-[#D0D5DD] text-brand-600 focus:ring-brand-500"
                            checked={selectedNumabs.includes(s.numab)}
                            onChange={() => {
                              setSelectedNumabs(prev =>
                                prev.includes(s.numab)
                                  ? prev.filter(id => id !== s.numab)
                                  : [...prev, s.numab]
                              );
                            }}
                          />
                        </td>
                        <td className="px-8 py-4 text-xs text-[#98A2B3] font-mono font-bold">{(safePage - 1) * PAGE_SIZE + i + 1}</td>
                        <td className="px-6 py-4">
                          <span className="font-mono text-xs font-black text-[#101828] bg-[#F9FAFB] px-2.5 py-1 rounded-lg border border-[#E4E7EC]">{s.numab}</span>
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-[#101828]">{s.name}</td>
                        <td className="px-6 py-4 text-center text-xs text-[#475467] font-medium max-w-[220px]">{s.adresse}</td>
                        <td className="px-6 py-4 text-center text-xs text-[#475467] font-medium">{s.bloc}</td>
                        <td className="px-6 py-4 text-center text-xs text-[#475467] font-medium">{s.ndom}</td>
                        <td className="px-6 py-4 text-center text-xs text-[#475467] font-medium max-w-[200px]" title={s.type_abon_code ? `Code T${s.type_abon_code}` : undefined}>{s.type_abon}</td>
                        <td className="px-6 py-4 text-center text-xs text-[#475467] font-medium max-w-[180px]" title={s.etat_cpt_code ? `Code ${s.etat_cpt_code}` : undefined}>{s.etat_cpt}</td>
                        <td className="px-6 py-4 text-center text-xs font-mono font-bold text-[#101828]">{s.numser}</td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-black border bg-blue-50 text-blue-600 border-blue-100">{s.tournee}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${
                            isAlarmant
                              ? 'bg-rose-50 text-rose-700 border-rose-100'
                              : days !== null && days > 30
                                ? 'bg-amber-50 text-amber-700 border-amber-100'
                                : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}>
                            <Calendar size={10} />
                            <span>{s.derniere_date_paiement}</span>
                            {days !== null && <span className="opacity-70">({days}j)</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-black border ${
                            s.nombre_creance >= 5
                              ? 'bg-rose-50 text-rose-700 border-rose-100'
                              : 'bg-amber-50 text-amber-700 border-amber-100'
                          }`}>
                            {s.nombre_creance} facture{s.nombre_creance > 1 ? 's' : ''}
                          </span>
                        </td>
                        <td className="px-8 py-4 text-right font-black text-sm text-rose-600 font-mono whitespace-nowrap">{fmt(s.montant_creance)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="sticky bottom-0 z-10">
                  <tr className="bg-slate-900 text-white font-black shadow-[0_-4px_10px_rgba(0,0,0,0.1)]">
                    <td colSpan={11} className="px-8 py-5 text-sm uppercase tracking-widest">
                      TOTAL GÉNÉRAL — {tableTotals.count.toLocaleString('fr-FR')} abonné{tableTotals.count !== 1 ? 's' : ''}
                    </td>
                    <td className="px-6 py-5 text-center text-amber-300 font-mono text-sm">
                      {tableTotals.factures.toLocaleString('fr-FR')}
                    </td>
                    <td className="px-8 py-5 text-right text-rose-400 font-mono text-sm">
                      {fmt(tableTotals.montant)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          {/* Pagination */}
          {!error && sorted.length > 0 && (
            <div className="flex items-center justify-between px-8 py-5 border-t border-[#F2F4F7] bg-[#F9FAFB]/50">
              <span className="text-xs text-[#667085] font-bold">
                Page {safePage}/{totalPages} · {sorted.length} résultat{sorted.length !== 1 ? 's' : ''}
                {hasTableColumnFilters && (
                  <span className="text-brand-600 ml-1">(filtres actifs)</span>
                )}
              </span>
              <div className="flex items-center gap-1.5">
                <button disabled={safePage === 1} onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="px-3.5 py-2 rounded-xl text-xs font-black text-[#475467] bg-white border border-[#E4E7EC] hover:border-[#D0D5DD] disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all">
                  ← Préc.
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
                  let p: number;
                  if (totalPages <= 5) p = idx + 1;
                  else if (safePage <= 3) p = idx + 1;
                  else if (safePage >= totalPages - 2) p = totalPages - 4 + idx;
                  else p = safePage - 2 + idx;
                  return (
                    <button key={p} onClick={() => setPage(p)}
                      className={`w-9 h-9 rounded-xl text-xs font-black transition-all active:scale-95 ${
                        safePage === p ? 'bg-brand-600 text-white shadow-sm' : 'text-[#475467] bg-white border border-[#E4E7EC] hover:border-[#D0D5DD]'
                      }`}>{p}</button>
                  );
                })}
                <button disabled={safePage === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="px-3.5 py-2 rounded-xl text-xs font-black text-[#475467] bg-white border border-[#E4E7EC] hover:border-[#D0D5DD] disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all">
                  Suiv. →
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function getQuarterFromMonth(monthStr: string): number {
  const m = parseInt(monthStr, 10);
  if (isNaN(m)) return 1;
  if (m >= 1 && m <= 3) return 1;
  if (m >= 4 && m <= 6) return 2;
  if (m >= 7 && m <= 9) return 3;
  if (m >= 10 && m <= 12) return 4;
  return 1;
}

function computeRowQuarterAmounts(row: any): Record<string, number> {
  const raw: Record<string, number> = {};
  if (!row.factures || !Array.isArray(row.factures)) return raw;
  for (const f of row.factures) {
    const df = String(f.date_fact || '').trim();
    if (df.length !== 8) continue;
    const y = parseInt(df.substring(0, 4), 10);
    if (isNaN(y)) continue;
    const mStr = df.substring(4, 6);
    const amt = Number(f.montant) || 0;
    const periode = Number(f.periode) || 3;
    if (periode === 1) {
      raw[`${y}-M${mStr}`] = (raw[`${y}-M${mStr}`] || 0) + amt;
    } else {
      const q = getQuarterFromMonth(mStr);
      raw[`${y}-Q${q}`] = (raw[`${y}-Q${q}`] || 0) + amt;
    }
  }
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key.includes('-M')) {
      const [yearPart, monthPart] = key.split('-');
      const q = getQuarterFromMonth(monthPart.substring(1));
      const newKey = `${yearPart}-Q${q}`;
      result[newKey] = Math.round(((result[newKey] || 0) + value) * 100) / 100;
    } else {
      result[key] = Math.round(((result[key] || 0) + value) * 100) / 100;
    }
  }
  return result;
}

function getRefYearFromRows(rows: any[]): number {
  let maxDateStr = '';
  for (const r of rows) {
    if (!r.factures || !Array.isArray(r.factures)) continue;
    for (const f of r.factures) {
      const df = String(f.date_fact || '').trim();
      if (df.length === 8 && (!maxDateStr || df > maxDateStr)) maxDateStr = df;
    }
  }
  if (maxDateStr.length >= 4) {
    const y = parseInt(maxDateStr.substring(0, 4), 10);
    if (!isNaN(y)) return y;
  }
  return new Date().getFullYear();
}

function buildQuarterSearchOrder(refYear: number, yearsBack = 20): { year: number; q: number }[] {
  const order: { year: number; q: number }[] = [];
  for (let y = refYear; y >= refYear - yearsBack; y--) {
    for (let q = 1; q <= 4; q++) order.push({ year: y, q });
  }
  return order;
}

function formatQuarterLabel(year: number, q: number): string {
  const ordinals = ['', '1er', '2ème', '3ème', '4ème'];
  return `${ordinals[q]} trimestre ${year}`;
}

function parseAmountInput(input: string): number | null {
  const cleaned = input.trim().replace(/\s/g, '').replace(',', '.');
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  if (isNaN(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

function findMinSubsetSum(
  items: { id: string; amountCents: number }[],
  targetCents: number
): string[] | null {
  const n = items.length;
  if (n === 0) return null;
  let best: string[] | null = null;
  let bestSize = Infinity;
  for (let mask = 1; mask < 1 << n; mask++) {
    let sum = 0;
    const ids: string[] = [];
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        sum += items[i].amountCents;
        ids.push(items[i].id);
      }
    }
    if (sum === targetCents && ids.length < bestSize) {
      best = ids;
      bestSize = ids.length;
    }
  }
  return best;
}

type QuarterPick = {
  numab: string;
  year: number;
  quarter: number;
  quarterKey: string;
  amount: number;
  amountCents: number;
  row: any;
  itemIndex: number;
};

type CombinationPriority = 1 | 2 | 3 | 4;

const PRIORITY_SECTIONS: Record<
  CombinationPriority,
  { title: string; description: string; headerClass: string; borderClass: string }
> = {
  1: {
    title: 'Priorité 1 — Même trimestre (même année)',
    description: 'Combinaisons limitées à un seul trimestre d\'une même année (ex. uniquement T1 2025).',
    headerClass: 'bg-brand-50 text-brand-900 border-brand-200',
    borderClass: 'border-brand-200',
  },
  2: {
    title: 'Priorité 2 — Multi-trimestres (même année)',
    description: 'Plusieurs trimestres d\'une même année (ex. T1 + T2 + T3 2025).',
    headerClass: 'bg-violet-50 text-violet-900 border-violet-200',
    borderClass: 'border-violet-200',
  },
  3: {
    title: 'Priorité 3 — Recherche mixte et inter-années progressive par nombre d\'années',
    description: 'Recherche progressive par nombre d\'années explorant ordonnément : Cas A (Même trimestre sur années distinctes), Cas C (Blocs complets de trimestres), Cas B (Mélange libre), et Cas D (Grand mix éloigné).',
    headerClass: 'bg-amber-50 text-amber-900 border-amber-200',
    borderClass: 'border-amber-200',
  },
  4: {
    title: 'Priorité 4 — Recherche élargie (purement aléatoire)',
    description: 'Recherche élargie sans contrainte de structure annuelle comme fallback final.',
    headerClass: 'bg-rose-50 text-rose-900 border-rose-200',
    borderClass: 'border-rose-200',
  },
};

function classifyCombinationPriority(picks: QuarterPick[]): CombinationPriority {
  const years = new Set(picks.map(p => p.year).filter(Boolean));
  const quarterKeys = new Set(picks.map(p => p.quarterKey).filter(Boolean));
  if (years.size === 1 && quarterKeys.size === 1) return 1;
  if (years.size === 1) return 2;
  return 3;
}

function combinationKeyFromPicks(picks: QuarterPick[]): string {
  return picks
    .map(p => p.itemIndex)
    .sort((a, b) => a - b)
    .join('|');
}

type ComboSearchState = {
  picks: QuarterPick[];
  subscriberCount: number;
  pickCount: number;
};

function buildQuarterItemsFromRows(
  rowQuarterMaps: { row: any; quarters: Record<string, number> }[],
  refYear: number,
  yearsBack = 10
): QuarterPick[] {
  const minYear = refYear - yearsBack;
  const items: QuarterPick[] = [];
  for (const { row, quarters } of rowQuarterMaps) {
    for (const [key, amount] of Object.entries(quarters)) {
      if (amount <= 0) continue;
      const match = key.match(/^(\d+)-Q(\d+)$/);
      if (!match) continue;
      const year = parseInt(match[1], 10);
      const quarter = parseInt(match[2], 10);
      if (year < minYear || year > refYear) continue;
      items.push({
        numab: row.numab,
        year,
        quarter,
        quarterKey: key,
        amount,
        amountCents: Math.round(amount * 100),
        row,
        itemIndex: items.length,
      });
    }
  }
  const quarterOrder = buildQuarterSearchOrder(refYear, yearsBack);
  const orderIndex = new Map<string, number>();
  quarterOrder.forEach(({ year, q }, i) => orderIndex.set(`${year}-Q${q}`, i));
  items.sort((a, b) => {
    const oa = orderIndex.get(a.quarterKey) ?? 9999;
    const ob = orderIndex.get(b.quarterKey) ?? 9999;
    if (oa !== ob) return oa - ob;
    return b.amountCents - a.amountCents;
  });
  return items;
}

function shiftLeftBits(words: Uint32Array, shift: number, wordCount: number): Uint32Array {
  const out = new Uint32Array(wordCount);
  if (shift <= 0) {
    out.set(words.subarray(0, wordCount));
    return out;
  }
  const wordShift = shift >>> 5;
  const bitShift = shift & 31;
  for (let i = wordCount - 1; i >= 0; i--) {
    const src = i - wordShift;
    if (src < 0) continue;
    let val = words[src] >>> 0;
    if (bitShift > 0) {
      val = ((val << bitShift) >>> 0);
      if (src > 0) val |= (words[src - 1] >>> (32 - bitShift));
    }
    out[i] = val >>> 0;
  }
  return out;
}

function setSumBit(bits: Uint32Array, sum: number) {
  bits[sum >>> 5] |= 1 << (sum & 31);
}

function isSumReachable(reachable: Uint8Array, sum: number): boolean {
  return sum >= 0 && sum < reachable.length && reachable[sum] === 1;
}

function runBitsetSubsetSum(
  items: QuarterPick[],
  targetCents: number
): { reachable: Uint8Array; prevItemIdx: Int32Array; bits: Uint32Array } | null {
  if (items.length === 0 || targetCents <= 0) return null;

  const wordCount = (targetCents >>> 5) + 1;
  const bits = new Uint32Array(wordCount);
  bits[0] = 1;

  const reachable = new Uint8Array(targetCents + 1);
  reachable[0] = 1;

  const prevItemIdx = new Int32Array(targetCents + 1);
  prevItemIdx.fill(-1);

  for (let i = 0; i < items.length; i++) {
    const amt = items[i].amountCents;
    if (amt <= 0 || amt > targetCents) continue;

    const shifted = shiftLeftBits(bits, amt, wordCount);

    for (let wi = 0; wi < wordCount; wi++) {
      const newly = shifted[wi] & ~bits[wi];
      if (newly === 0) continue;
      for (let b = 0; b < 32; b++) {
        if (!(newly & (1 << b))) continue;
        const s = wi * 32 + b;
        if (s > targetCents) continue;
        const prev = s - amt;
        if (prev < 0 || !isSumReachable(reachable, prev)) continue;
        if (prevItemIdx[s] < 0) prevItemIdx[s] = i;
        reachable[s] = 1;
        setSumBit(bits, s);
      }
    }

    for (let wi = 0; wi < wordCount; wi++) {
      bits[wi] |= shifted[wi];
    }
  }

  return { reachable, prevItemIdx, bits };
}

function reconstructPicksFromBitset(
  items: QuarterPick[],
  targetCents: number,
  prevItemIdx: Int32Array,
  reachable: Uint8Array
): QuarterPick[] | null {
  if (!isSumReachable(reachable, targetCents)) return null;

  const picks: QuarterPick[] = [];
  let s = targetCents;
  const used = new Set<number>();

  while (s > 0) {
    let idx = prevItemIdx[s];
    if (idx >= 0 && !used.has(idx)) {
      used.add(idx);
      picks.push(items[idx]);
      s -= items[idx].amountCents;
      continue;
    }
    let found = false;
    for (let i = items.length - 1; i >= 0; i--) {
      if (used.has(i)) continue;
      const amt = items[i].amountCents;
      if (amt > 0 && amt <= s && isSumReachable(reachable, s - amt)) {
        used.add(i);
        picks.push(items[i]);
        s -= amt;
        found = true;
        break;
      }
    }
    if (!found) return null;
  }

  picks.reverse();
  return picks.reduce((a, p) => a + p.amountCents, 0) === targetCents ? picks : null;
}

const MAX_COMBINATIONS = 100;

async function findAllCombinationIndicesAsync(
  items: QuarterPick[],
  targetCents: number,
  maxResults = MAX_COMBINATIONS,
  callbacks?: {
    onProgress?: (ratio: number) => void;
    onFound?: (picks: QuarterPick[], foundCount: number) => void | Promise<void>;
    isAborted?: () => boolean;
  },
  seenGlobal?: Set<string>,
  acceptCombination?: (picks: QuarterPick[]) => boolean
): Promise<{ truncated: boolean; effectiveTarget: number | null; totalFound: number }> {
  // 1. Pré-filtrage par rapport au montant cible
  const filteredItems = items.filter(it => it.amountCents > 0 && it.amountCents <= targetCents);
  if (filteredItems.length === 0 || targetCents <= 0) {
    return { truncated: false, effectiveTarget: null, totalFound: 0 };
  }

  // 2. Tri par ordre décroissant pour le backtracking efficace
  const sortedItems = [...filteredItems].sort((a, b) => b.amountCents - a.amountCents);

  let effectiveTarget: number | null = null;
  for (const tryTarget of [targetCents, targetCents - 1, targetCents + 1]) {
    if (callbacks?.isAborted?.()) {
      return { truncated: false, effectiveTarget: null, totalFound: 0 };
    }
    if (tryTarget <= 0) continue;
    const bitset = runBitsetSubsetSum(sortedItems, tryTarget);
    if (bitset && isSumReachable(bitset.reachable, tryTarget)) {
      effectiveTarget = tryTarget;
      break;
    }
  }
  if (effectiveTarget === null) {
    return { truncated: false, effectiveTarget: null, totalFound: 0 };
  }

  // 3. Pré-calcul des sommes de suffixes pour l'élagage (pruning)
  const suffixSums = new Float64Array(sortedItems.length + 1);
  let runningSum = 0;
  for (let i = sortedItems.length - 1; i >= 0; i--) {
    runningSum += sortedItems[i].amountCents;
    suffixSums[i] = runningSum;
  }

  const results: number[][] = [];
  const seen = seenGlobal ?? new Set<string>();
  let steps = 0;

  async function dfs(start: number, remaining: number, path: number[]): Promise<void> {
    if (callbacks?.isAborted?.()) return;
    if (results.length >= maxResults) return;
    if (remaining === 0) {
      const picks = path.map(i => sortedItems[i]);
      if (acceptCombination && !acceptCombination(picks)) return;
      const key = combinationKeyFromPicks(picks);
      if (seen.has(key)) return;
      seen.add(key);
      const idxCopy = [...path];
      results.push(idxCopy);
      await callbacks?.onFound?.(picks, results.length);
      await new Promise<void>(resolve => setTimeout(resolve, 0));
      return;
    }

    if (start >= sortedItems.length || remaining < 0) return;

    // Élagage 1 : La somme cumulée maximale possible restante est insuffisante
    if (suffixSums[start] < remaining) return;

    // Élagage 2 : Le plus petit élément restant (global) est supérieur au reste cible
    const minVal = sortedItems[sortedItems.length - 1].amountCents;
    if (minVal > remaining) return;

    steps++;
    if (steps % 2500 === 0) {
      callbacks?.onProgress?.(Math.min(0.98, steps / (sortedItems.length * 500 + 1)));
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    }

    let lastAmt = -1; // Élagage 3 : Sauter les doublons de montant au même niveau
    for (let i = start; i < sortedItems.length; i++) {
      if (callbacks?.isAborted?.()) return;
      const amt = sortedItems[i].amountCents;

      // Élagage 3 : Si le montant courant est identique au précédent au même niveau,
      // la branche est équivalente → on la saute pour éviter les combinaisons dupliquées
      if (amt === lastAmt) continue;
      lastAmt = amt;

      // Le tableau est trié décroissant : si l'élément courant dépasse le reste cible,
      // les suivants (plus petits) peuvent encore correspondre → on continue
      if (amt > remaining) continue;

      path.push(i);
      await dfs(i + 1, remaining - amt, path);
      path.pop();
      if (results.length >= maxResults) return;
    }
  }

  await dfs(0, effectiveTarget, []);
  callbacks?.onProgress?.(1);
  return {
    truncated: results.length >= maxResults,
    effectiveTarget,
    totalFound: results.length,
  };
}

function findMinSubsetSumIds(
  items: { id: string; amountCents: number }[],
  targetCents: number
): string[] | null {
  if (items.length === 0) return null;
  if (items.length <= 22) return findMinSubsetSum(items, targetCents);
  const pseudoPicks: QuarterPick[] = items.map((it, i) => ({
    numab: it.id,
    year: 0,
    quarter: 0,
    quarterKey: '',
    amount: it.amountCents / 100,
    amountCents: it.amountCents,
    row: { numab: it.id },
    itemIndex: i,
  }));
  const result = runBitsetSubsetSum(pseudoPicks, targetCents);
  if (!result || !isSumReachable(result.reachable, targetCents)) return null;
  const picks = reconstructPicksFromBitset(
    pseudoPicks,
    targetCents,
    result.prevItemIdx,
    result.reachable
  );
  if (!picks) return null;
  return [...new Set(picks.map(p => p.numab))];
}

function buildInvoiceItemsFromRows(
  rowQuarterMaps: { row: any; quarters: Record<string, number> }[],
  refYear: number,
  yearsBack = 20
): QuarterPick[] {
  const minYear = refYear - yearsBack;
  const items: QuarterPick[] = [];
  for (const { row } of rowQuarterMaps) {
    if (!row.factures || !Array.isArray(row.factures)) continue;
    for (const f of row.factures) {
      const amt = Number(f.montant) || 0;
      if (amt <= 0) continue;
      const df = String(f.date_fact || '').trim();
      if (df.length !== 8) continue;
      const year = parseInt(df.substring(0, 4), 10);
      if (isNaN(year) || year < minYear) continue;
      const mStr = df.substring(4, 6);
      const quarter = getQuarterFromMonth(mStr);
      items.push({
        numab: row.numab,
        year,
        quarter,
        quarterKey: `${year}-Q${quarter}`,
        amount: Math.round(amt * 100) / 100,
        amountCents: Math.round(amt * 100),
        row,
        itemIndex: items.length,
      });
    }
  }
  const quarterOrder = buildQuarterSearchOrder(refYear, yearsBack);
  const orderIndex = new Map<string, number>();
  quarterOrder.forEach(({ year, q }, i) => orderIndex.set(`${year}-Q${q}`, i));
  items.sort((a, b) => {
    const oa = orderIndex.get(a.quarterKey) ?? 9999;
    const ob = orderIndex.get(b.quarterKey) ?? 9999;
    if (oa !== ob) return oa - ob;
    return b.amountCents - a.amountCents;
  });
  return items;
}

function picksToLines(picks: QuarterPick[]) {
  return picks
    .map(p => ({
      numab: p.numab,
      raisoc: p.row?.raisoc || '—',
      codinstit: p.row?.codinstit || '—',
      lib_instit: p.row?.lib_instit || '—',
      year: p.year,
      quarter: p.quarter,
      periodLabel: p.year ? formatQuarterLabel(p.year, p.quarter) : '—',
      amount: p.amount,
    }))
    .sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      if (a.quarter !== b.quarter) return a.quarter - b.quarter;
      return String(a.numab).localeCompare(String(b.numab), 'fr');
    });
}

function classifyP3SubCase(picks: QuarterPick[]): 'A' | 'B' | 'C' | 'D' | undefined {
  const years = [...new Set(picks.map(p => p.year).filter(Boolean))].sort((a, b) => a - b);
  if (years.length < 2) return undefined;

  const quarters = picks.map(p => p.quarter);
  const distinctQuarters = new Set(quarters);

  // Cas A : Même trimestre sur des années distinctes (ex. tous les picks sont de Q1)
  if (distinctQuarters.size === 1) {
    return 'A';
  }

  // Cas D : Grand mix multi-années éloignées (ex. >= 4 années distinctes, ou écart >= 5 ans)
  const minYear = years[0];
  const maxYear = years[years.length - 1];
  if (years.length >= 4 || (maxYear - minYear) >= 5) {
    return 'D';
  }

  // Cas C : Blocs complets de trimestres (ex. au moins une année a ses 4 trimestres représentés)
  let hasCompleteYear = false;
  for (const year of years) {
    const quartersInYear = new Set(picks.filter(p => p.year === year).map(p => p.quarter));
    if (quartersInYear.size === 4) {
      hasCompleteYear = true;
      break;
    }
  }
  if (hasCompleteYear) {
    return 'C';
  }

  // Cas B : Mélange libre de trimestres et d'années (par défaut)
  return 'B';
}

function buildCombinationResult(
  picks: QuarterPick[],
  id: number,
  priority: CombinationPriority
): QuarterCombinationResult {
  const lines = picksToLines(picks);
  const numabs = [...new Set(picks.map(p => p.numab))];
  const sum = Math.round(lines.reduce((a, l) => a + l.amount, 0) * 100) / 100;
  const quarterKeys = [...new Set(picks.map(p => p.quarterKey))];
  const years = [...new Set(picks.map(p => p.year))].sort((a, b) => a - b);
  
  let label: string;
  let p3SubCase: 'A' | 'B' | 'C' | 'D' | undefined;

  if (priority === 1) {
    label = formatQuarterLabel(picks[0].year, picks[0].quarter);
  } else if (priority === 2) {
    label = `Année ${years[0]} (${quarterKeys.length} trimestre${quarterKeys.length !== 1 ? 's' : ''})`;
  } else if (priority === 3) {
    p3SubCase = classifyP3SubCase(picks);
    const subLabels: Record<'A' | 'B' | 'C' | 'D', string> = {
      A: 'Même trimestre / années distinctes',
      B: 'Mélange libre de trimestres et d\'années',
      C: 'Blocs complets de trimestres',
      D: 'Grand mix multi-années éloignées',
    };
    const subText = p3SubCase ? ` [Cas ${p3SubCase} — ${subLabels[p3SubCase]}]` : '';
    label = `${years.join(' · ')} (${years.length} ans)${subText}`;
  } else {
    label = `${years.join(' · ')} (Recherche aléatoire)`;
  }

  const mode =
    priority === 1
      ? 'same_quarter'
      : priority === 2
      ? 'same_year'
      : priority === 3
      ? 'multi_quarter'
      : 'random';

  return {
    id,
    priority,
    p3SubCase,
    mode,
    label,
    numabs,
    sum,
    pickCount: picks.length,
    lines,
  };
}

type QuarterCombinationResult = {
  id: number;
  priority: CombinationPriority;
  p3SubCase?: 'A' | 'B' | 'C' | 'D';
  mode: 'same_quarter' | 'same_year' | 'multi_quarter' | 'random';
  label: string;
  numabs: string[];
  sum: number;
  pickCount: number;
  lines: {
    numab: string;
    raisoc: string;
    codinstit: string;
    lib_instit: string;
    year: number;
    quarter: number;
    periodLabel: string;
    amount: number;
  }[];
};

type InstitGroup = { codinstit: string; lib_instit: string; rows: any[] };

const compareRows = (a: any, b: any, sortKey: string, sortDir: 'asc' | 'desc') => {
  const av = a[sortKey];
  const bv = b[sortKey];
  if (sortKey === 'montant_creance' || sortKey === 'nombre_creance') {
    const na = Number(av) || 0;
    const nb = Number(bv) || 0;
    return sortDir === 'asc' ? na - nb : nb - na;
  }
  const sa = String(av ?? '').toLowerCase();
  const sb = String(bv ?? '').toLowerCase();
  const cmp = sa.localeCompare(sb, 'fr');
  return sortDir === 'asc' ? cmp : -cmp;
};

const groupTotals = (g: InstitGroup) => ({
  montant: g.rows.reduce((a, r) => a + (r.montant_creance || 0), 0),
  factures: g.rows.reduce((a, r) => a + (r.nombre_creance || 0), 0),
});

function CreancesInstitutionsView({ onBack }: { onBack: () => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [targetMontantSearch, setTargetMontantSearch] = useState('');
  const [combinationResults, setCombinationResults] = useState<QuarterCombinationResult[]>([]);
  const [combinationTruncated, setCombinationTruncated] = useState(false);
  const [combinationMessage, setCombinationMessage] = useState<string | null>(null);
  const [combinationSearching, setCombinationSearching] = useState(false);
  const [combinationProgress, setCombinationProgress] = useState(0);
  const [combinationCurrentPriority, setCombinationCurrentPriority] = useState<CombinationPriority | null>(null);
  const [filterCodInstit, setFilterCodInstit] = useState<string[]>([]);
  const [filterTypeAbonInst, setFilterTypeAbonInst] = useState<string[]>([]);
  const [filterEtatCptInst, setFilterEtatCptInst] = useState<string[]>([]);
  const [filterTourneeInst, setFilterTourneeInst] = useState<string[]>([]);
  const [filterInstitution, setFilterInstitution] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState('codinstit');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selectedNumabsInst, setSelectedNumabsInst] = useState<string[]>([]);
  const searchAbortedRef = useRef(false);

  const abortSearchQuarterCombination = () => {
    searchAbortedRef.current = true;
  };

  const [expandedComboIds, setExpandedComboIds] = useState<Record<number, boolean>>({});

  const toggleComboExpand = (id: number) => {
    setExpandedComboIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const PAGE_SIZE = 15;

  const fmt = (n: number) =>
    new Intl.NumberFormat('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      .format(n).replace(/[\u202F\u00A0]/g, ' ') + ' DA';

  const loadData = async () => {
    setDataLoading(true);
    setError(null);
    try {
      const res = await fetch('http://127.0.0.1:8000/creances_institutions');
      if (res.status === 404) {
        setError(
          'Route API introuvable (404). Fermez la fenêtre « EPEOR Backend » et relancez start.bat pour charger la dernière version du serveur.'
        );
        setRows([]);
        return;
      }
      const data = await res.json();
      if (data.status === 'loading') {
        setError(data.message || 'Chargement des données en cours… Réessayez dans quelques secondes.');
        setRows([]);
      } else if (data.error) {
        setError(data.error);
        setRows([]);
      } else {
        setRows(data.rows || []);
      }
    } catch {
      setError('Impossible de contacter le serveur backend. Vérifiez qu\'il tourne sur le port 8000.');
      setRows([]);
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r: any) => {
      if (filterCodInstit.length > 0 && !filterCodInstit.includes(String(r.codinstit || ''))) return false;
      if (filterTypeAbonInst.length > 0 && !filterTypeAbonInst.includes(String(r.type_abon || ''))) return false;
      if (filterEtatCptInst.length > 0 && !filterEtatCptInst.includes(String(r.etat_cpt || ''))) return false;
      if (filterTourneeInst.length > 0 && !filterTourneeInst.includes(String(r.tournee || ''))) return false;
      if (filterInstitution.length > 0 && !filterInstitution.includes(String(r.lib_instit || ''))) return false;
      if (!q) return true;
      return [r.codinstit, r.lib_instit, r.numab, r.raisoc, r.adresse, r.tournee]
        .some((v: string) => String(v || '').toLowerCase().includes(q));
    });
  }, [rows, search, filterCodInstit, filterTypeAbonInst, filterEtatCptInst, filterTourneeInst, filterInstitution]);

  const filterOptions = useMemo(() => {
    const codinstit = [...new Set(rows.map(r => String(r.codinstit || '')).filter(v => v))].sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }));
    const types = [...new Set(rows.map(r => String(r.type_abon || '')).filter(v => v))].sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }));
    const etats = [...new Set(rows.map(r => String(r.etat_cpt || '')).filter(v => v))].sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }));
    const tournees = [...new Set(rows.map(r => String(r.tournee || '')).filter(v => v))].sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }));
    const institutions = [...new Set(rows.map(r => String(r.lib_instit || '')).filter(v => v))].sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }));
    return { codinstit, types, etats, tournees, institutions };
  }, [rows]);

  const groups = useMemo(() => {
    const map = new Map<string, InstitGroup>();
    for (const r of filtered) {
      const key = String(r.codinstit || '—');
      let g = map.get(key);
      if (!g) {
        g = { codinstit: key, lib_instit: r.lib_instit || '—', rows: [] };
        map.set(key, g);
      }
      g.rows.push(r);
    }
    const list = Array.from(map.values());
    for (const g of list) {
      g.rows.sort((a, b) => compareRows(a, b, sortKey, sortDir));
    }
    list.sort((a, b) => {
      if (sortKey === 'codinstit') {
        const cmp = a.codinstit.localeCompare(b.codinstit, 'fr');
        return sortDir === 'asc' ? cmp : -cmp;
      }
      if (sortKey === 'lib_instit') {
        const cmp = a.lib_instit.localeCompare(b.lib_instit, 'fr');
        return sortDir === 'asc' ? cmp : -cmp;
      }
      if (sortKey === 'montant_creance' || sortKey === 'nombre_creance') {
        const field = sortKey as 'montant_creance' | 'nombre_creance';
        const ta = a.rows.reduce((s, r) => s + (Number(r[field]) || 0), 0);
        const tb = b.rows.reduce((s, r) => s + (Number(r[field]) || 0), 0);
        return sortDir === 'asc' ? ta - tb : tb - ta;
      }
      const ta = groupTotals(a).montant;
      const tb = groupTotals(b).montant;
      return sortDir === 'asc' ? ta - tb : tb - ta;
    });
    return list;
  }, [filtered, sortKey, sortDir]);

  const flatRows = useMemo(() => groups.flatMap(g => g.rows), [groups]);

  const totalPages = Math.max(1, Math.ceil(groups.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedGroups = groups.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const visibleNumabsInst = pagedGroups.flatMap(g => g.rows).map(r => r.numab).filter(Boolean as any);
  const allVisibleSelectedInst = visibleNumabsInst.length > 0 && visibleNumabsInst.every((id: any) => selectedNumabsInst.includes(id));
  const selectedCountInst = selectedNumabsInst.length;
  const selectedRowsInst = useMemo(() => selectedCountInst > 0 ? flatRows.filter((r: any) => selectedNumabsInst.includes(r.numab)) : flatRows, [selectedCountInst, selectedNumabsInst, flatRows]);

  const tableTotals = useMemo(() => ({
    institutions: groups.length,
    count: flatRows.length,
    montant: flatRows.reduce((a, r) => a + (r.montant_creance || 0), 0),
    factures: flatRows.reduce((a, r) => a + (r.nombre_creance || 0), 0),
  }), [groups, flatRows]);

  const comboHighlightNumabs = useMemo(() => {
    const set = new Set<string>();
    for (const combo of combinationResults) {
      for (const numab of combo.numabs) set.add(numab);
    }
    return set;
  }, [combinationResults]);

  const combinationByPriority = useMemo(() => ({
    1: combinationResults.filter(c => c.priority === 1),
    2: combinationResults.filter(c => c.priority === 2),
    3: combinationResults.filter(c => c.priority === 3),
    4: combinationResults.filter(c => c.priority === 4),
  }), [combinationResults]);

  const searchQuarterCombination = async () => {
    searchAbortedRef.current = false;
    setCombinationResults([]);
    setCombinationTruncated(false);
    setCombinationMessage(null);
    setCombinationCurrentPriority(null);
    setExpandedComboIds({});
    if (selectedCountInst === 0) {
      setCombinationMessage('Sélectionnez au moins un abonné dans le tableau.');
      return;
    }
    const target = parseAmountInput(targetMontantSearch);
    if (target === null) {
      setCombinationMessage('Saisissez un montant cible valide (ex. 225105,63).');
      return;
    }
    const targetCents = Math.round(target * 100);
    const sourceRows = flatRows.filter((r: any) => selectedNumabsInst.includes(r.numab));
    const refYear = getRefYearFromRows(sourceRows);
    const rowQuarterMaps = sourceRows.map((row: any) => ({
      row,
      quarters: computeRowQuarterAmounts(row),
    }));

    setCombinationSearching(true);
    setCombinationProgress(0);

    try {
      const allItems = buildInvoiceItemsFromRows(rowQuarterMaps, refYear);
      if (allItems.length === 0) {
        setCombinationMessage('Aucune facture impayée trouvée pour les abonnés sélectionnés.');
        return;
      }

      // Pré-filtrage strict des données pour exclure les factures supérieures au montant cible
      const filteredAllItems = allItems.filter(item => item.amountCents <= targetCents);
      if (filteredAllItems.length === 0) {
        const availableTotal = allItems.reduce((a, it) => a + it.amountCents, 0) / 100;
        setCombinationMessage(
          `Aucune facture impayée n'est inférieure ou égale au montant cible (${fmt(target)}). Toutes les factures dépassent individuellement cette cible (total disponible : ${fmt(availableTotal)}).`
        );
        return;
      }

      const seenGlobal = new Set<string>();
      let nextComboId = 1;
      let remaining = MAX_COMBINATIONS;
      let truncated = false;
      let effectiveTarget: number | null = null;
      let totalFound = 0;

      const emitFound = async (picks: QuarterPick[], priority: CombinationPriority) => {
        const combo = buildCombinationResult(picks, nextComboId++, priority);
        setCombinationResults(prev => [...prev, combo]);
        setCombinationCurrentPriority(priority);
      };

      const runPhase = async (
        priority: CombinationPriority,
        items: QuarterPick[],
        accept?: (picks: QuarterPick[]) => boolean,
        progressBase = 0,
        progressSpan = 0.33
      ) => {
        if (searchAbortedRef.current) return;
        if (remaining <= 0 || items.length === 0) return;
        setCombinationCurrentPriority(priority);
        const r = await findAllCombinationIndicesAsync(
          items,
          targetCents,
          remaining,
          {
            onProgress: ratio =>
              setCombinationProgress(progressBase + ratio * progressSpan),
            onFound: async (picks) => {
              await emitFound(picks, priority);
            },
            isAborted: () => searchAbortedRef.current,
          },
          seenGlobal,
          accept
        );
        if (effectiveTarget === null && r.effectiveTarget !== null) {
          effectiveTarget = r.effectiveTarget;
        }
        totalFound += r.totalFound;
        remaining -= r.totalFound;
        truncated = truncated || r.truncated;
      };

      // Priorité 1 : un seul trimestre d'une même année
      const quarterOrder = buildQuarterSearchOrder(refYear);
      const p1Groups = quarterOrder
        .map(({ year, q }) => ({
          year,
          q,
          items: filteredAllItems.filter(i => i.year === year && i.quarter === q),
        }))
        .filter(g => g.items.length > 0);
      for (let gi = 0; gi < p1Groups.length; gi++) {
        if (searchAbortedRef.current) break;
        await new Promise<void>(resolve => setTimeout(resolve, 0));
        await runPhase(
          1,
          p1Groups[gi].items,
          undefined,
          (gi / p1Groups.length) * 0.25,
          0.25 / Math.max(p1Groups.length, 1)
        );
      }

      // Priorité 2 : multi-trimestres, même année uniquement (si P1 n'a rien trouvé)
      if (totalFound === 0 && !searchAbortedRef.current) {
        const yearsDesc = [...new Set(filteredAllItems.map(i => i.year))].sort((a, b) => b - a);
        for (let yi = 0; yi < yearsDesc.length; yi++) {
          if (searchAbortedRef.current) break;
          await new Promise<void>(resolve => setTimeout(resolve, 0));
          const year = yearsDesc[yi];
          const yearItems = filteredAllItems.filter(i => i.year === year);
          await runPhase(
            2,
            yearItems,
            picks => classifyCombinationPriority(picks) === 2,
            0.25 + (yi / yearsDesc.length) * 0.25,
            0.25 / Math.max(yearsDesc.length, 1)
          );
        }
      }

      // Priorité 3 : recherche mixte progressive par nombre d'années (si P1 & P2 n'ont rien trouvé)
      if (totalFound === 0 && !searchAbortedRef.current) {
        const distinctYearsInItems = [...new Set(filteredAllItems.map(i => i.year))].filter(Boolean).sort((a, b) => b - a);
        const maxY = distinctYearsInItems.length;

        // Helper pour générer les combinaisons mathématiques de taille k
        function getCombinations<T>(array: T[], k: number): T[][] {
          const result: T[][] = [];
          function helper(start: number, path: T[]) {
            if (path.length === k) {
              result.push([...path]);
              return;
            }
            for (let i = start; i < array.length; i++) {
              path.push(array[i]);
              helper(i + 1, path);
              path.pop();
            }
          }
          helper(0, []);
          return result;
        }
        
        const limitYears = Math.min(5, maxY);
        for (let numYears = 2; numYears <= limitYears; numYears++) {
          if (searchAbortedRef.current || totalFound > 0) break;

          // On génère toutes les combinaisons de exactly `numYears` années
          const yearCombos = getCombinations(distinctYearsInItems, numYears);

          // On boucle sur chaque groupe d'années cible (ex. [2024, 2022])
          for (let yci = 0; yci < yearCombos.length; yci++) {
            if (searchAbortedRef.current || totalFound > 0) break;
            
            // Permet de libérer le thread principal et d'éviter que le navigateur ne se fige
            await new Promise<void>(resolve => setTimeout(resolve, 0));

            const targetYears = yearCombos[yci];
            
            // Pré-filtrage strict des items pour ne garder UNIQUE que ces années (réduit la taille matricielle à une poignée d'éléments)
            const subsetItems = filteredAllItems.filter(i => targetYears.includes(i.year));
            if (subsetItems.length === 0) continue;

            // 1. Sous-priorité A : Même trimestre sur des années distinctes
            if (!searchAbortedRef.current && totalFound === 0) {
              // Dans le cas A, on peut filtrer trimestre par trimestre pour accélérer encore plus !
              for (let q = 1; q <= 4; q++) {
                if (searchAbortedRef.current || totalFound > 0) break;
                const qSubsetItems = subsetItems.filter(i => i.quarter === q);
                if (qSubsetItems.length === 0) continue;

                await runPhase(
                  3,
                  qSubsetItems,
                  picks => {
                    const pickedYears = new Set(picks.map(p => p.year).filter(Boolean));
                    if (pickedYears.size !== numYears) return false;
                    const quarters = new Set(picks.map(p => p.quarter));
                    return quarters.size === 1;
                  },
                  0.50 + ((numYears - 2) / Math.max(maxY - 1, 1)) * 0.25,
                  (0.25 / Math.max(maxY - 1, 1)) * 0.25 / 4
                );
              }
            }

            // 2. Sous-priorité C : Blocs complets de trimestres sur plusieurs années
            if (!searchAbortedRef.current && totalFound === 0) {
              await runPhase(
                3,
                subsetItems,
                picks => {
                  const pickedYears = [...new Set(picks.map(p => p.year).filter(Boolean))].sort((a, b) => a - b);
                  if (pickedYears.length !== numYears) return false;
                  const quarters = new Set(picks.map(p => p.quarter));
                  if (quarters.size === 1) return false; // Exclure Cas A
                  let hasCompleteYear = false;
                  for (const year of pickedYears) {
                    const quartersInYear = new Set(picks.filter(p => p.year === year).map(p => p.quarter));
                    if (quartersInYear.size === 4) {
                      hasCompleteYear = true;
                      break;
                    }
                  }
                  return hasCompleteYear;
                },
                0.50 + ((numYears - 2) / Math.max(maxY - 1, 1)) * 0.25 + (0.25 / Math.max(maxY - 1, 1)) * 0.25,
                (0.25 / Math.max(maxY - 1, 1)) * 0.25 / Math.max(yearCombos.length, 1)
              );
            }

            // 3. Sous-priorité B : Mélange libre de trimestres et d'années
            if (!searchAbortedRef.current && totalFound === 0) {
              await runPhase(
                3,
                subsetItems,
                picks => {
                  const pickedYears = [...new Set(picks.map(p => p.year).filter(Boolean))].sort((a, b) => a - b);
                  if (pickedYears.length !== numYears) return false;
                  const quarters = new Set(picks.map(p => p.quarter));
                  if (quarters.size === 1) return false; // Exclure Cas A
                  let hasCompleteYear = false;
                  for (const year of pickedYears) {
                    const quartersInYear = new Set(picks.filter(p => p.year === year).map(p => p.quarter));
                    if (quartersInYear.size === 4) {
                      hasCompleteYear = true;
                      break;
                    }
                  }
                  if (hasCompleteYear) return false; // Exclure Cas C
                  const minYear = pickedYears[0];
                  const maxYear = pickedYears[pickedYears.length - 1];
                  const isCasD = pickedYears.length >= 4 || (maxYear - minYear) >= 5;
                  return !isCasD;
                },
                0.50 + ((numYears - 2) / Math.max(maxY - 1, 1)) * 0.25 + (0.25 / Math.max(maxY - 1, 1)) * 0.50,
                (0.25 / Math.max(maxY - 1, 1)) * 0.25 / Math.max(yearCombos.length, 1)
              );
            }

            // 4. Sous-priorité D : Grand mix multi-années éloignées
            if (!searchAbortedRef.current && totalFound === 0) {
              await runPhase(
                3,
                subsetItems,
                picks => {
                  const pickedYears = [...new Set(picks.map(p => p.year).filter(Boolean))].sort((a, b) => a - b);
                  if (pickedYears.length !== numYears) return false;
                  const quarters = new Set(picks.map(p => p.quarter));
                  if (quarters.size === 1) return false; // Exclure Cas A
                  let hasCompleteYear = false;
                  for (const year of pickedYears) {
                    const quartersInYear = new Set(picks.filter(p => p.year === year).map(p => p.quarter));
                    if (quartersInYear.size === 4) {
                      hasCompleteYear = true;
                      break;
                    }
                  }
                  if (hasCompleteYear) return false; // Exclure Cas C
                  const minYear = pickedYears[0];
                  const maxYear = pickedYears[pickedYears.length - 1];
                  return pickedYears.length >= 4 || (maxYear - minYear) >= 5;
                },
                0.50 + ((numYears - 2) / Math.max(maxY - 1, 1)) * 0.25 + (0.25 / Math.max(maxY - 1, 1)) * 0.75,
                (0.25 / Math.max(maxY - 1, 1)) * 0.25 / Math.max(yearCombos.length, 1)
              );
            }
          }
        }
      }

      // Priorité 4 : recherche élargie et purement aléatoire (si tout le reste est épuisé)
      if (totalFound === 0 && !searchAbortedRef.current) {
        const shuffledItems = [...filteredAllItems].sort(() => Math.random() - 0.5);
        await runPhase(
          4,
          shuffledItems,
          undefined,
          0.75,
          0.25
        );
      }

      if (searchAbortedRef.current) {
        setCombinationMessage(
          `Recherche arrêtée par l'utilisateur. ${nextComboId - 1} combinaison(s) gelée(s) à l'écran.`
        );
        return;
      }

      if (effectiveTarget === null || totalFound === 0) {
        const availableTotal = allItems.reduce((a, it) => a + it.amountCents, 0) / 100;
        setCombinationMessage(
          `Aucune combinaison trouvée pour ${fmt(target)} parmi ${selectedCountInst} abonné(s) et ${allItems.length} facture(s) (total disponible : ${fmt(availableTotal)}).`
        );
        return;
      }

      setCombinationTruncated(truncated);
      if (truncated) {
        setCombinationMessage(
          `${MAX_COMBINATIONS} combinaisons affichées — d'autres solutions peuvent exister.`
        );
      } else if (effectiveTarget !== targetCents) {
        setCombinationMessage(
          `Tolérance de 0,01 DA appliquée (montant effectif : ${fmt(effectiveTarget / 100)}).`
        );
      } else {
        setCombinationMessage(null);
      }
    } finally {
      setCombinationSearching(false);
      setCombinationProgress(0);
      setCombinationCurrentPriority(null);
    }
  };

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
    setPage(1);
  };

  const SortTh = ({ label, col }: { label: string; col: string }) => (
    <th
      className="px-4 py-4 cursor-pointer hover:bg-[#F2F4F7] transition-colors select-none"
      onClick={() => handleSort(col)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === col && <span className="text-brand-600">{sortDir === 'asc' ? '↑' : '↓'}</span>}
      </span>
    </th>
  );

  const exportCSV = () => {
    const headers = [
      'Code Institution', 'Libellé Institution', 'Code Abonné', 'Raison sociale',
      'Adresse', 'Bloc', 'N° Dom', 'Type', 'État Cpt', 'N° Série', 'Tournée',
      'Factures impayées', 'Montant créance', 'Dernier paiement',
    ];
    const lines = selectedRowsInst.flatMap((r: any) =>
      [
        r.codinstit, r.lib_instit, r.numab, r.raisoc, r.adresse, r.bloc, r.ndom,
        r.type_abon, r.etat_cpt, r.numser, r.tournee,
        r.nombre_creance, r.montant_creance, r.derniere_date_paiement,
      ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')
    );
    const blob = new Blob(['\ufeff' + [headers.join(';'), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `creances_institutions_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintCreances = () => {
    if (selectedRowsInst.length === 0 && flatRows.length === 0) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Veuillez autoriser les fenêtres pop-up pour pouvoir imprimer.");
      return;
    }

    const filterTexts = [];
    if (filterCodInstit.length > 0) filterTexts.push(`Code inst. : ${filterCodInstit.join(', ')}`);
    if (filterInstitution.length > 0) filterTexts.push(`Institution : ${filterInstitution.join(', ')}`);
    if (filterTypeAbonInst.length > 0) filterTexts.push(`Type : ${filterTypeAbonInst.join(', ')}`);
    if (filterEtatCptInst.length > 0) filterTexts.push(`État Cpt : ${filterEtatCptInst.join(', ')}`);
    if (filterTourneeInst.length > 0) filterTexts.push(`Tournée : ${filterTourneeInst.join(', ')}`);
    if (search.trim()) filterTexts.push(`Recherche : ${search}`);

    const sourceRows = selectedRowsInst.length > 0 ? selectedRowsInst : flatRows;

    const printTotals = {
      institutions: new Set(sourceRows.map((r: any) => String(r.codinstit || ''))).size,
      count: sourceRows.length,
      montant: sourceRows.reduce((a: number, r: any) => a + (r.montant_creance || 0), 0),
      factures: sourceRows.reduce((a: number, r: any) => a + (r.nombre_creance || 0), 0),
    };

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Créance Institutions</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap');
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              color: #101828;
              margin: 40px;
              font-size: 10px;
              line-height: 1.5;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #F2F4F7;
              padding-bottom: 20px;
              margin-bottom: 25px;
            }
            .logo-section {
              display: flex;
              align-items: center;
              gap: 12px;
            }
            .logo-text {
              font-size: 14px;
              font-weight: 900;
              color: #0D83DE;
              letter-spacing: -0.5px;
              margin-bottom: 2px;
            }
            .company-name {
              font-size: 9px;
              font-weight: 700;
              color: #667085;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .title-section {
              text-align: right;
            }
            .title {
              font-size: 18px;
              font-weight: 900;
              color: #101828;
              margin: 0;
              letter-spacing: -0.5px;
            }
            .subtitle {
              font-size: 10px;
              color: #667085;
              margin: 4px 0 0 0;
              font-weight: 500;
            }
            .filters {
              background-color: #F9FAFB;
              border: 1px solid #E4E7EC;
              border-radius: 12px;
              padding: 12px 20px;
              margin-bottom: 20px;
              font-size: 9px;
            }
            .filter-item {
              margin-bottom: 6px;
            }
            .filter-label {
              font-weight: 700;
              color: #98A2B3;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .filter-value {
              color: #344054;
              margin-left: 8px;
            }
            .meta-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 15px;
              background-color: #F9FAFB;
              border: 1px solid #E4E7EC;
              border-radius: 12px;
              padding: 12px 20px;
              margin-bottom: 30px;
            }
            .meta-item {
              display: flex;
              flex-direction: column;
            }
            .meta-label {
              font-size: 8px;
              font-weight: 700;
              color: #98A2B3;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 3px;
            }
            .meta-value {
              font-size: 11px;
              font-weight: 700;
              color: #344054;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
            }
            thead {
              display: table-header-group;
            }
            tr {
              page-break-inside: avoid;
            }
            th {
              background-color: #F9FAFB;
              color: #475467;
              font-size: 8px;
              text-transform: uppercase;
              font-weight: 700;
              letter-spacing: 0.5px;
              border-bottom: 2px solid #EAECF0;
              padding: 8px 10px;
              text-align: left;
            }
            td {
              border-bottom: 1px solid #EAECF0;
              padding: 8px 10px;
              text-align: left;
              color: #475467;
            }
            .font-bold-black {
              font-weight: 700;
              color: #101828;
            }
            .amount-right {
              text-align: right;
              font-weight: 700;
            }
            @media print {
              body {
                margin: 20px;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo-section">
              <img src="${window.location.origin}/ade.png" alt="ADE Logo" style="height: 40px; width: auto;" />
              <div style="display: flex; flex-direction: column;">
                <span class="logo-text">EPEOR Analytics</span>
                <span class="company-name">Algérienne Des Eaux</span>
              </div>
            </div>
            <div class="title-section">
              <h1 class="title">Créance Institutions</h1>
              <p class="subtitle">Créances des organismes payeurs — liens institutionnels</p>
            </div>
          </div>

          ${filterTexts.length > 0 ? `<div class="filters">${filterTexts.map(t => `<div class="filter-item"><span class="filter-label">Filtres appliqués :</span> ${t}</div>`).join('')}</div>` : ''}

          <div class="meta-grid">
            <div class="meta-item">
              <span class="meta-label">Total Institutions</span>
              <span class="meta-value">${printTotals.institutions}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Total Abonnés</span>
              <span class="meta-value">${printTotals.count}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Montant Total</span>
              <span class="meta-value">${fmt(printTotals.montant)}</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 8%">Code Inst.</th>
                <th style="width: 15%">Institution</th>
                <th style="width: 10%">Code Abonn.</th>
                <th style="width: 15%">Raison Sociale</th>
                <th style="width: 12%">Type</th>
                <th style="width: 8%">État Cpt</th>
                <th style="width: 8%">Tournée</th>
                <th style="width: 6%; text-align: center;">Fact.</th>
                <th style="width: 12%; text-align: right;">Montant Créance</th>
              </tr>
            </thead>
            <tbody>
              ${sourceRows.map(r => `
                <tr>
                  <td class="font-bold-black">${r.codinstit || '—'}</td>
                  <td>${r.lib_instit || '—'}</td>
                  <td class="font-bold-black">${r.numab || '—'}</td>
                  <td>${r.raisoc || '—'}</td>
                  <td>${r.type_abon || '—'}</td>
                  <td>${r.etat_cpt || '—'}</td>
                  <td>${r.tournee ? `T-${r.tournee}` : '—'}</td>
                  <td style="text-align: center;">${r.nombre_creance || 0}</td>
                  <td class="amount-right">${fmt(r.montant_creance || 0)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                setTimeout(function() { window.close(); }, 500);
              }, 300);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handlePrintQuarterlyCreances = () => {
    if (selectedRowsInst.length === 0 && flatRows.length === 0) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Veuillez autoriser les fenêtres pop-up pour pouvoir imprimer.");
      return;
    }

    // determine source rows (selected or all)
    const sourceRows = selectedRowsInst.length > 0 ? selectedRowsInst : flatRows;

    // 1. Find the latest bill date to establish the reference year
    let maxDateStr = "";
    for (const r of sourceRows) {
      if (r.factures && Array.isArray(r.factures)) {
        for (const f of r.factures) {
          const df = String(f.date_fact || "").trim();
          if (df && df.length === 8) {
            if (!maxDateStr || df > maxDateStr) {
              maxDateStr = df;
            }
          }
        }
      }
    }

    // If no date found or date is invalid, default to current local time's year (2026)
    let refYear = 2026;
    if (maxDateStr && maxDateStr.length >= 4) {
      const parsedYear = parseInt(maxDateStr.substring(0, 4), 10);
      if (!isNaN(parsedYear)) {
        refYear = parsedYear;
      }
    }

    // 2. Generate the 11 years (from refYear - 10 to refYear)
    const startYear = refYear - 10;
    const endYear = refYear;
    const antecedentYear = startYear - 1;
    const years: number[] = [];
    for (let y = startYear; y <= endYear; y++) {
      years.push(y);
    }

    // 3. Detect if any subscriber has older debts prior to startYear
    let hasAntecedents = false;
    for (const r of sourceRows) {
      if (r.factures && Array.isArray(r.factures)) {
        for (const f of r.factures) {
          const df = String(f.date_fact || "").trim();
          if (df.length === 8) {
            const y = parseInt(df.substring(0, 4), 10);
            if (y < startYear) {
              hasAntecedents = true;
              break;
            }
          }
        }
      }
      if (hasAntecedents) break;
    }

    // 4. Prepare filters text
    const filterTexts = [];
    if (filterCodInstit.length > 0) filterTexts.push(`Code inst. : ${filterCodInstit.join(', ')}`);
    if (filterInstitution.length > 0) filterTexts.push(`Institution : ${filterInstitution.join(', ')}`);
    if (filterTypeAbonInst.length > 0) filterTexts.push(`Type : ${filterTypeAbonInst.join(', ')}`);
    if (filterEtatCptInst.length > 0) filterTexts.push(`État Cpt : ${filterEtatCptInst.join(', ')}`);
    if (filterTourneeInst.length > 0) filterTexts.push(`Tournée : ${filterTourneeInst.join(', ')}`);
    if (search.trim()) filterTexts.push(`Recherche : ${search}`);

    // Helpers
    const getQuarter = (monthStr: string): number => {
      const m = parseInt(monthStr, 10);
      if (isNaN(m)) return 1;
      if (m >= 1 && m <= 3) return 1;
      if (m >= 4 && m <= 6) return 2;
      if (m >= 7 && m <= 9) return 3;
      if (m >= 10 && m <= 12) return 4;
      return 1;
    };

    // Calculate amounts for each row, handling both monthly (PERIODE=1) and quarterly (PERIODE=3) invoices
    const matrixRows = sourceRows.map((r: any) => {
      const cellAmounts: { [key: string]: number } = {};
      let subscriberTotal = 0;
      let hasMonthly = false;
      let hasQuarterly = false;

      if (r.factures && Array.isArray(r.factures)) {
        for (const f of r.factures) {
          const df = String(f.date_fact || "").trim();
          if (df.length === 8) {
            const y = parseInt(df.substring(0, 4), 10);
            const mStr = df.substring(4, 6);
            const amt = Number(f.montant) || 0;
            const periode = Number(f.periode) || 3; // Default to quarterly

            // Detect invoice type
            if (periode === 1) hasMonthly = true;
            if (periode === 3) hasQuarterly = true;

            // Store amount based on period type
            if (y >= startYear && y <= endYear) {
              if (periode === 1) {
                // Monthly invoice
                const key = `${y}-M${mStr}`;
                cellAmounts[key] = (cellAmounts[key] || 0) + amt;
              } else {
                // Quarterly invoice
                const q = getQuarter(mStr);
                const key = `${y}-Q${q}`;
                cellAmounts[key] = (cellAmounts[key] || 0) + amt;
              }
              subscriberTotal += amt;
            } else if (y < startYear) {
              if (periode === 1) {
                const key = `Ant-M${mStr}`;
                cellAmounts[key] = (cellAmounts[key] || 0) + amt;
              } else {
                const q = getQuarter(mStr);
                const key = `Ant-Q${q}`;
                cellAmounts[key] = (cellAmounts[key] || 0) + amt;
              }
              subscriberTotal += amt;
            }
          }
        }
      }

      // If subscriber has both monthly and quarterly, convert monthly to quarterly
      let finalCellAmounts = cellAmounts;
      if (hasMonthly && hasQuarterly) {
        finalCellAmounts = {};
        for (const [key, value] of Object.entries(cellAmounts)) {
          if (key.includes('-M')) {
            // Convert monthly key to quarterly
            const [yearPart, monthPart] = key.split('-');
            const monthNum = monthPart.substring(1);
            const q = getQuarter(monthNum);
            const newKey = `${yearPart}-Q${q}`;
            finalCellAmounts[newKey] = (finalCellAmounts[newKey] || 0) + (value as number);
          } else {
            // Keep quarterly as-is, summing if key already exists
            finalCellAmounts[key] = (finalCellAmounts[key] || 0) + (value as number);
          }
        }
      }

      return {
        ...r,
        cellAmounts: finalCellAmounts,
        subscriberTotal,
        hasMonthly,
        hasQuarterly,
        isMonthlySolo: hasMonthly && !hasQuarterly
      };
    });

    // Calculate column totals (total per year and grand total)
    const columnTotals: { [key: number]: number } = {};
    let antecedentColumnTotal = 0;
    let grandTotal = 0;

    for (const y of years) {
      columnTotals[y] = 0;
      for (const mr of matrixRows) {
        // Sum both quarterly and monthly amounts
        let yearSum = 0;
        for (let q = 1; q <= 4; q++) {
          yearSum += mr.cellAmounts[`${y}-Q${q}`] || 0;
        }
        for (let m = 1; m <= 12; m++) {
          yearSum += mr.cellAmounts[`${y}-M${String(m).padStart(2, '0')}`] || 0;
        }
        columnTotals[y] += yearSum;
      }
      grandTotal += columnTotals[y];
    }

    if (hasAntecedents) {
      for (const mr of matrixRows) {
        let antSum = 0;
        for (let q = 1; q <= 4; q++) {
          antSum += mr.cellAmounts[`Ant-Q${q}`] || 0;
        }
        for (let m = 1; m <= 12; m++) {
          antSum += mr.cellAmounts[`Ant-M${String(m).padStart(2, '0')}`] || 0;
        }
        antecedentColumnTotal += antSum;
      }
      grandTotal += antecedentColumnTotal;
    }

    const fmtClean = (n: number) => {
      if (n === 0) return "—";
      return new Intl.NumberFormat('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        .format(n).replace(/[\u202F\u00A0]/g, ' ') + ' DA';
    };

    const fmtCleanTotal = (n: number) => {
      return new Intl.NumberFormat('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        .format(n).replace(/[\u202F\u00A0]/g, ' ') + ' DA';
    };

    // Construct print html content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Détails des Créances par Facture et Trimestre (10 ans)</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap');
            @page {
              size: landscape;
              margin: 6mm 6mm;
            }
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              color: #101828;
              margin: 10px;
              font-size: 8px;
              line-height: 1.2;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #F2F4F7;
              padding-bottom: 8px;
              margin-bottom: 10px;
            }
            .logo-section {
              display: flex;
              align-items: center;
              gap: 8px;
            }
            .logo-text {
              font-size: 11px;
              font-weight: 900;
              color: #0D83DE;
              letter-spacing: -0.5px;
              margin-bottom: 1px;
            }
            .company-name {
              font-size: 7px;
              font-weight: 700;
              color: #667085;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .title-section {
              text-align: right;
            }
            .title {
              font-size: 13px;
              font-weight: 900;
              color: #101828;
              margin: 0;
              letter-spacing: -0.5px;
            }
            .subtitle {
              font-size: 8px;
              color: #667085;
              margin: 2px 0 0 0;
              font-weight: 500;
            }
            .filters {
              background-color: #F9FAFB;
              border: 1px solid #E4E7EC;
              border-radius: 6px;
              padding: 6px 12px;
              margin-bottom: 8px;
              font-size: 7px;
            }
            .filter-item {
              margin-bottom: 2px;
            }
            .filter-label {
              font-weight: 700;
              color: #98A2B3;
              text-transform: uppercase;
            }
            .filter-value {
              color: #344054;
              margin-left: 4px;
            }
            .meta-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 10px;
              background-color: #F9FAFB;
              border: 1px solid #E4E7EC;
              border-radius: 6px;
              padding: 6px 12px;
              margin-bottom: 10px;
            }
            .meta-item {
              display: flex;
              flex-direction: column;
            }
            .meta-label {
              font-size: 7px;
              font-weight: 700;
              color: #98A2B3;
              text-transform: uppercase;
              margin-bottom: 1px;
            }
            .meta-value {
              font-size: 9px;
              font-weight: 700;
              color: #344054;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 5px;
            }
            thead {
              display: table-header-group;
            }
            tr {
              page-break-inside: avoid;
            }
            th {
              background-color: #F9FAFB;
              color: #475467;
              font-size: 7.5px;
              text-transform: uppercase;
              font-weight: 700;
              border: 1px solid #EAECF0;
              padding: 4px 6px;
              text-align: center;
            }
            td {
              border: 1px solid #EAECF0;
              padding: 4px 6px;
              text-align: center;
              color: #475467;
              font-size: 7.5px;
            }
            .year-col {
              background-color: #F8F9FC;
              font-weight: 700;
              width: 6.5%;
            }
            .info-cell {
              text-align: center;
              line-height: 1.3;
              width: 10%;
              min-width: 100px;
              font-size: 7.5px;
              background-color: #FFFFFF;
              font-weight: 500;
              vertical-align: middle;
              padding: 4px 6px;
            }
            .info-cell.resilie {
              color: #B91C1C;
              font-weight: 900;
            }
            .info-cell.resilie strong {
              color: #B91C1C;
            }
            .q-label-cell {
              font-weight: 700;
              text-align: left;
              background-color: #F9FAFB;
              font-size: 7.5px;
              color: #344054;
            }
            .order-cell {
              text-align: center;
              vertical-align: middle;
              font-weight: 700;
              width: 4%;
              font-size: 7.5px;
              background-color: #FFFFFF;
            }
            .amount-val {
              font-family: monospace;
              font-size: 7px;
              text-align: center;
              white-space: nowrap;
            }
            .total-cell {
              font-weight: 900;
              font-family: monospace;
              font-size: 7px;
              text-align: center;
            }
            .resilie-row td,
            .resilie-row .total-cell {
              color: #B91C1C !important;
              font-weight: 900;
            }
            .has-value {
              background-color: #FEF3C7; /* amber-100 light highlights for quarterly unpaid bills */
              font-weight: 700;
              color: #B45309;
            }
            .has-value-ant {
              background-color: #FFF5F5; /* light red highlight for antecedents */
              font-weight: 700;
              color: #B91C1C;
            }
            .has-value-ant-subtotal {
              background-color: #FEE2E2; /* sky-100 style red for year subtotals */
              color: #991B1B;
            }
            .has-value-subtotal {
              background-color: #E0F2FE; /* sky-100 for year subtotals */
              color: #0369A1;
            }
            .total-cell {
              font-weight: 900;
              font-family: monospace;
              font-size: 7px;
              text-align: center;
              background-color: #E5E7EB !important;
              color: #111827 !important;
            }
            .subtotal-row {
              background-color: #F3F4F6;
              font-weight: 900;
            }
            .footer-row {
              background-color: #E5E7EB !important;
              color: #111827 !important;
              font-weight: 900;
            }
            .footer-row td {
              border-color: #D1D5DB;
              color: #111827 !important;
              padding: 6px 8px;
            }
            .footer-row .total-sum {
              background-color: #E5E7EB !important;
              color: #111827 !important;
              font-family: monospace;
              font-size: 7.5px;
              text-align: right;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo-section">
              <img src="${window.location.origin}/ade.png" alt="ADE Logo" style="height: 25px; width: auto;" />
              <div style="display: flex; flex-direction: column;">
                <span class="logo-text">EPEOR Analytics</span>
                <span class="company-name">Algérienne Des Eaux</span>
              </div>
            </div>
            <div class="title-section">
              <h1 class="title">Créance Institutions — Impression par Facture</h1>
              <p class="subtitle">Détails des factures impayées (mensuelles et/ou trimestrielles) sur 10 ans (${startYear} - ${endYear})</p>
            </div>
          </div>

          ${filterTexts.length > 0 ? `<div class="filters">${filterTexts.map(t => `<div class="filter-item"><span class="filter-label">Filtres appliqués :</span> ${t}</div>`).join('')}</div>` : ''}

          <div class="meta-grid">
            <div class="meta-item">
              <span class="meta-label">Total Abonnés</span>
              <span class="meta-value">${tableTotals.count}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Période d'Analyse</span>
              <span class="meta-value">10 ans (${startYear} à ${endYear})</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Montant Total Créance Table</span>
              <span class="meta-value">${fmtCleanTotal(grandTotal)}</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 4%">N° Ordre</th>
                <th style="width: 14%; text-align: left;">Informations</th>
                <th style="width: 8%; text-align: left;">Période</th>
                ${hasAntecedents ? `<th class="year-col" style="background-color: #FEE2E2; color: #991B1B;">Ant. ${antecedentYear}</th>` : ''}
                ${years.map(y => `<th class="year-col">${y}</th>`).join('')}
                <th style="width: 10%; background-color: #E5E7EB; color: #111827;">Total Créance</th>
              </tr>
            </thead>
            <tbody>
              ${matrixRows.map((mr, mi) => {
                const monthLabels = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
                const qLabels = ["1° Trim", "2° Trim", "3° Trim", "4° Trim"];
                const resilieClass = mr.etat_cpt === 'RESILIE' ? 'resilie-row' : '';
                const infoCellClass = mr.etat_cpt === 'RESILIE' ? 'info-cell resilie' : 'info-cell';
                const orderNumber = String(mi + 1).padStart(2, '0');

                let periodsToShow: { label: string; keys: string[] }[] = [];
                let rowSpan = 5;

                if (mr.isMonthlySolo) {
                  // Show 12 months
                  periodsToShow = monthLabels.map((label, idx) => ({
                    label,
                    keys: [String(idx + 1).padStart(2, '0')]
                  }));
                  rowSpan = 13; // 12 months + 1 total row
                } else {
                  // Show 4 quarters
                  periodsToShow = [
                    { label: "1° Trim", keys: ["01", "02", "03"] },
                    { label: "2° Trim", keys: ["04", "05", "06"] },
                    { label: "3° Trim", keys: ["07", "08", "09"] },
                    { label: "4° Trim", keys: ["10", "11", "12"] }
                  ];
                  rowSpan = 5;
                }

                const periodsHtml = periodsToShow.map((period, idx) => {
                  const orderCellHtml = idx === 0 ? `
                    <td rowspan="${rowSpan}" class="order-cell">${orderNumber}</td>
                  ` : '';

                  const infoCellHtml = idx === 0 ? `
                    <td rowspan="${rowSpan}" class="${infoCellClass}">
                      <strong>Code:</strong> ${mr.numab || '—'}<br/>
                      <strong>Nom:</strong> ${mr.raisoc || '—'}<br/>
                      <strong>Adresse:</strong> ${mr.adresse || '—'}<br/>
                      <strong>N° Série:</strong> ${mr.numser || '—'}<br/>
                      <strong>État:</strong> ${mr.etat_cpt || '—'}
                    </td>
                  ` : '';

                  // For monthly: sum the month, for quarterly: sum by quarter
                  let periodTotal = 0;
                  if (mr.isMonthlySolo) {
                    const monthKey = period.keys[0];
                    periodTotal = years.reduce((sum, y) => sum + (mr.cellAmounts[`${y}-M${monthKey}`] || 0), 0);
                    if (hasAntecedents) {
                      periodTotal += (mr.cellAmounts[`Ant-M${monthKey}`] || 0);
                    }
                  } else {
                    const q = parseInt(period.label.charAt(0));
                    periodTotal = years.reduce((sum, y) => sum + (mr.cellAmounts[`${y}-Q${q}`] || 0), 0);
                    if (hasAntecedents) {
                      periodTotal += (mr.cellAmounts[`Ant-Q${q}`] || 0);
                    }
                  }

                  // Antecedent cell
                  const antCellHtml = hasAntecedents ? (() => {
                    let antVal = 0;
                    if (mr.isMonthlySolo) {
                      antVal = mr.cellAmounts[`Ant-M${period.keys[0]}`] || 0;
                    } else {
                      const q = parseInt(period.label.charAt(0));
                      antVal = mr.cellAmounts[`Ant-Q${q}`] || 0;
                    }
                    const hasVal = antVal >= 0.01;
                    return `<td class="amount-val ${hasVal ? 'has-value-ant' : ''} ${resilieClass}" style="background-color: #FFF5F5;">${fmtClean(antVal)}</td>`;
                  })() : '';

                  // Year cells
                  const yearCellsHtml = years.map(y => {
                    let val = 0;
                    if (mr.isMonthlySolo) {
                      val = mr.cellAmounts[`${y}-M${period.keys[0]}`] || 0;
                    } else {
                      const q = parseInt(period.label.charAt(0));
                      val = mr.cellAmounts[`${y}-Q${q}`] || 0;
                    }
                    const hasVal = val >= 0.01;
                    return `<td class="amount-val ${hasVal ? 'has-value' : ''} ${resilieClass}">${fmtClean(val)}</td>`;
                  }).join('');

                  // Grand total cell: only on first row, spans all period rows
                  const grandTotalCellHtml = idx === 0 ? `
                    <td rowspan="${rowSpan}" class="total-cell ${resilieClass}" style="
                      background-color: #E5E7EB;
                      color: #111827;
                      font-size: 9px;
                      font-weight: 900;
                      text-align: center;
                      vertical-align: middle;
                      font-family: monospace;
                      white-space: nowrap;
                      border: 2px solid #D1D5DB;
                    ">${fmtCleanTotal(mr.subscriberTotal)}</td>
                  ` : '';

                  return `
                    <tr class="${resilieClass}">
                      ${orderCellHtml}
                      ${infoCellHtml}
                      <td class="q-label-cell">${period.label}</td>
                      ${antCellHtml}
                      ${yearCellsHtml}
                      ${grandTotalCellHtml}
                    </tr>
                  `;
                }).join('');

                // Generate the TOTAL row
                const antTotalCellHtml = hasAntecedents ? (() => {
                  let antTotal = 0;
                  if (mr.isMonthlySolo) {
                    for (let m = 1; m <= 12; m++) {
                      antTotal += mr.cellAmounts[`Ant-M${String(m).padStart(2, '0')}`] || 0;
                    }
                  } else {
                    for (let q = 1; q <= 4; q++) {
                      antTotal += mr.cellAmounts[`Ant-Q${q}`] || 0;
                    }
                  }
                  const hasVal = antTotal >= 0.01;
                  return `<td class="amount-val ${hasVal ? 'has-value-ant-subtotal' : ''}" style="font-weight: 900; background-color: #FEE2E2;">${fmtClean(antTotal)}</td>`;
                })() : '';

                const subTotalYearCellsHtml = years.map(y => {
                  let yearTotal = 0;
                  if (mr.isMonthlySolo) {
                    for (let m = 1; m <= 12; m++) {
                      yearTotal += mr.cellAmounts[`${y}-M${String(m).padStart(2, '0')}`] || 0;
                    }
                  } else {
                    for (let q = 1; q <= 4; q++) {
                      yearTotal += mr.cellAmounts[`${y}-Q${q}`] || 0;
                    }
                  }
                  const hasVal = yearTotal >= 0.01;
                  return `<td class="amount-val ${hasVal ? 'has-value-subtotal' : ''}" style="font-weight: 900;">${fmtClean(yearTotal)}</td>`;
                }).join('');

                const totalRowHtml = `
                  <tr class="subtotal-row ${resilieClass}">
                    <td class="q-label-cell" style="background-color: #EAECF0;">TOTAL</td>
                    ${antTotalCellHtml}
                    ${subTotalYearCellsHtml}
                  </tr>
                `;

                return periodsHtml + totalRowHtml;
              }).join('')}

              <tr class="footer-row">
                <td colspan="3" style="text-align: left;">TOTAL GÉNÉRAL</td>
                ${hasAntecedents ? `<td class="total-sum" style="background-color: #E5E7EB !important; color: #111827 !important; text-align: right;">${fmtCleanTotal(antecedentColumnTotal)}</td>` : ''}
                ${years.map(y => `<td class="total-sum">${fmtCleanTotal(columnTotals[y] || 0)}</td>`).join('')}
                <td class="total-sum" style="background-color: #E5E7EB !important; color: #111827 !important;">${fmtCleanTotal(grandTotal)}</td>
              </tr>
            </tbody>
          </table>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                setTimeout(function() { window.close(); }, 500);
              }, 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handlePrintCombination = (combo: QuarterCombinationResult) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Veuillez autoriser les fenêtres pop-up pour pouvoir imprimer.");
      return;
    }

    const priorityText = PRIORITY_SECTIONS[combo.priority].title;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Impression Combinaison - ${combo.label}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap');
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              color: #101828;
              margin: 40px;
              font-size: 10px;
              line-height: 1.5;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #F2F4F7;
              padding-bottom: 20px;
              margin-bottom: 25px;
            }
            .logo-section {
              display: flex;
              align-items: center;
              gap: 12px;
            }
            .logo-text {
              font-size: 14px;
              font-weight: 900;
              color: #0D83DE;
              letter-spacing: -0.5px;
              margin-bottom: 2px;
            }
            .company-name {
              font-size: 9px;
              font-weight: 700;
              color: #667085;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .title-section {
              text-align: right;
            }
            .title {
              font-size: 18px;
              font-weight: 900;
              color: #101828;
              margin: 0;
              letter-spacing: -0.5px;
            }
            .subtitle {
              font-size: 10px;
              color: #667085;
              margin: 4px 0 0 0;
              font-weight: 500;
            }
            .meta-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 15px;
              background-color: #F9FAFB;
              border: 1px solid #E4E7EC;
              border-radius: 12px;
              padding: 12px 20px;
              margin-bottom: 30px;
            }
            .meta-item {
              display: flex;
              flex-direction: column;
            }
            .meta-label {
              font-size: 8px;
              font-weight: 700;
              color: #98A2B3;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 3px;
            }
            .meta-value {
              font-size: 11px;
              font-weight: 700;
              color: #344054;
            }
            .comb-banner {
              background-color: #F8F9FA;
              border-left: 4px solid #0D83DE;
              padding: 12px 16px;
              border-radius: 0 8px 8px 0;
              margin-bottom: 20px;
            }
            .comb-banner-title {
              font-size: 11px;
              font-weight: 700;
              color: #101828;
            }
            .comb-banner-desc {
              font-size: 9px;
              color: #475467;
              margin-top: 2px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
            }
            thead {
              display: table-header-group;
            }
            tr {
              page-break-inside: avoid;
            }
            th {
              background-color: #F9FAFB;
              color: #475467;
              font-size: 8px;
              text-transform: uppercase;
              font-weight: 700;
              letter-spacing: 0.5px;
              border-bottom: 2px solid #EAECF0;
              padding: 8px 10px;
              text-align: left;
            }
            td {
              border-bottom: 1px solid #EAECF0;
              padding: 8px 10px;
              text-align: left;
              color: #475467;
            }
            .font-bold-black {
              font-weight: 700;
              color: #101828;
            }
            .amount-right {
              text-align: right;
              font-weight: 700;
            }
            .total-row td {
              border-top: 2px solid #EAECF0;
              border-bottom: none;
              font-weight: 900;
              color: #101828;
              background-color: #F9FAFB;
            }
            @media print {
              body {
                margin: 20px;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo-section">
              <img src="${window.location.origin}/ade.png" alt="ADE Logo" style="height: 40px; width: auto;" />
              <div style="display: flex; flex-direction: column;">
                <span class="logo-text">EPEOR Analytics</span>
                <span class="company-name">Algérienne Des Eaux</span>
              </div>
            </div>
            <div class="title-section">
              <h1 class="title">Détails de la combinaison</h1>
              <p class="subtitle">Recherche de combinaison par trimestre</p>
            </div>
          </div>

          <div class="comb-banner">
            <div class="comb-banner-title">Priorité de la combinaison : ${priorityText}</div>
            <div class="comb-banner-desc">${PRIORITY_SECTIONS[combo.priority].description}</div>
          </div>

          <div class="meta-grid">
            <div class="meta-item">
              <span class="meta-label">Label Période</span>
              <span class="meta-value">${combo.label}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Abonnés uniques</span>
              <span class="meta-value">${combo.numabs.length}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Montant Total</span>
              <span class="meta-value">${fmt(combo.sum)}</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 5%">N°</th>
                <th style="width: 15%">Code Abonné</th>
                <th style="width: 25%">Raison Sociale</th>
                <th style="width: 25%">Institution</th>
                <th style="width: 15%">Période</th>
                <th style="width: 15%; text-align: right;">Montant</th>
              </tr>
            </thead>
            <tbody>
              ${combo.lines.map((line, idx) => `
                <tr>
                  <td class="font-bold-black">${String(idx + 1).padStart(2, '0')}</td>
                  <td class="font-bold-black">${line.numab || '—'}</td>
                  <td>${line.raisoc || '—'}</td>
                  <td>
                    ${line.codinstit || '—'}
                    ${line.lib_instit !== '—' ? `<br/><span style="font-size: 8px; color: #667085;">${line.lib_instit}</span>` : ''}
                  </td>
                  <td class="font-bold-black">${line.periodLabel}</td>
                  <td class="amount-right">${fmt(line.amount)}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td colspan="5" style="text-align: right; text-transform: uppercase; font-size: 8px; letter-spacing: 0.5px; padding: 10px;">Total combinaison</td>
                <td class="amount-right" style="color: #E11D48; font-size: 11px; padding: 10px;">${fmt(combo.sum)}</td>
              </tr>
            </tbody>
          </table>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                setTimeout(function() { window.close(); }, 500);
              }, 300);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const inputCls = 'pl-8 pr-4 py-2 bg-[#F9FAFB] border border-[#E4E7EC] rounded-xl text-xs font-bold text-[#101828] placeholder:text-[#98A2B3] outline-none focus:border-brand-300 transition-all w-72';
  const selectCls = 'py-2 pl-4 pr-8 bg-[#F9FAFB] border border-[#E4E7EC] rounded-xl text-xs font-bold text-[#101828] outline-none focus:border-brand-300 transition-all min-w-[180px]';
 

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] p-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-bold text-[#667085] hover:text-[#101828] mb-4 transition-colors"
        >
          <ChevronRight className="rotate-180" size={16} /> Retour au tableau de bord
        </button>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black tracking-tight text-[#101828]">Créance institutions</h2>
            <p className="text-sm text-[#667085] mt-1 font-medium">
              Créances des organismes payeurs liées aux abonnés institutionnels (factures impayées)
            </p>
          </div>
        </div>

        <div className="mt-6 p-5 bg-[#F9FAFB] border border-[#E4E7EC] rounded-2xl">
          <p className="text-xs font-black text-[#344054] uppercase tracking-wide mb-1">
            Recherche de combinaison par trimestre
          </p>
          <p className="text-xs text-[#667085] font-medium mb-4">
            Sélectionnez des abonnés, saisissez un montant cible, puis lancez la recherche.
            Les combinaisons s&apos;affichent au fur et à mesure, classées par priorité :
            (1) même trimestre, (2) multi-trimestres d&apos;une même année, (3) mixte inter-années.
          </p>
          <div className="flex flex-col sm:flex-row sm:items-end gap-3 flex-wrap">
            <div>
              <label className="block text-[10px] font-bold text-[#667085] uppercase mb-1.5">
                Montant cible (DA)
              </label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="225105,63"
                value={targetMontantSearch}
                onChange={e => { setTargetMontantSearch(e.target.value); setCombinationResults([]); setCombinationTruncated(false); setCombinationMessage(null); setCombinationCurrentPriority(null); }}
                onKeyDown={e => { if (e.key === 'Enter' && !combinationSearching) searchQuarterCombination(); }}
                disabled={combinationSearching}
                className="py-2.5 px-4 bg-white border border-[#E4E7EC] rounded-xl text-sm font-bold text-[#101828] outline-none focus:border-brand-300 w-full sm:w-48 disabled:opacity-50"
              />
            </div>
            <button
              onClick={searchQuarterCombination}
              disabled={selectedCountInst === 0 || dataLoading || combinationSearching}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white rounded-xl text-xs font-black hover:bg-brand-700 disabled:opacity-50 transition-all active:scale-95"
            >
              {combinationSearching ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Recherche… {Math.round(combinationProgress * 100)}%
                </>
              ) : (
                <>
                  <Search size={13} /> Rechercher
                </>
              )}
            </button>
            {combinationSearching && (
              <button
                onClick={abortSearchQuarterCombination}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-600 text-white rounded-xl text-xs font-black hover:bg-rose-700 transition-all active:scale-95 animate-pulse"
              >
                <Ban size={13} /> Arrêter la recherche
              </button>
            )}
            {combinationResults.length > 0 && (
              <button
                onClick={() => { setCombinationResults([]); setCombinationTruncated(false); setCombinationMessage(null); setCombinationCurrentPriority(null); setExpandedComboIds({}); }}
                className="px-4 py-2.5 bg-white border border-[#E4E7EC] rounded-xl text-xs font-black text-[#475467] hover:bg-[#F9FAFB]"
              >
                Effacer
              </button>
            )}
            {selectedCountInst > 0 && (
              <span className="text-xs font-bold text-[#667085] sm:ml-auto">
                {selectedCountInst} abonné{selectedCountInst !== 1 ? 's' : ''} sélectionné{selectedCountInst !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {(combinationSearching || combinationResults.length > 0) && (
            <div className="mt-4 space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <p className="text-sm font-black text-emerald-800">
                  {combinationResults.length} combinaison{combinationResults.length !== 1 ? 's' : ''} trouvée{combinationResults.length !== 1 ? 's' : ''}
                  {combinationTruncated ? ` (limite : ${MAX_COMBINATIONS} affichées)` : ''}
                </p>
                {combinationSearching && (
                  <span className="inline-flex items-center gap-2 text-xs font-bold text-brand-700">
                    <span className="w-3 h-3 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
                    {combinationCurrentPriority
                      ? `${PRIORITY_SECTIONS[combinationCurrentPriority].title}…`
                      : 'Recherche en cours…'}{' '}
                    {Math.round(combinationProgress * 100)}%
                  </span>
                )}
              </div>

              {combinationSearching && combinationResults.length === 0 && (
                <p className="text-xs text-[#667085] font-medium">
                  Priorité 1 en cours — puis priorité 2, puis priorité 3 (progressive), et enfin priorité 4 si nécessaire.
                </p>
              )}

              {([1, 2, 3, 4] as CombinationPriority[]).map(priority => {
                const combos = combinationByPriority[priority];
                const section = PRIORITY_SECTIONS[priority];
                const isActive = combinationSearching && combinationCurrentPriority === priority;
                if (combos.length === 0 && !isActive) return null;
                return (
                  <div
                    key={priority}
                    className={`rounded-xl border ${section.borderClass} overflow-hidden`}
                  >
                    <div className={`px-4 py-3 border-b ${section.headerClass}`}>
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <p className="text-xs font-black">{section.title}</p>
                          <p className="text-[10px] font-medium mt-0.5 opacity-90">{section.description}</p>
                        </div>
                        <div className="text-right text-[10px] font-bold">
                          {isActive && (
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                              En cours…
                            </span>
                          )}
                          {!isActive && combos.length > 0 && (
                            <span>{combos.length} combinaison{combos.length !== 1 ? 's' : ''}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="p-3 space-y-3 bg-white/40">
                      {combos.length === 0 && isActive && (
                        <p className="text-xs text-[#667085] font-medium px-1">Analyse en cours…</p>
                      )}
                       {combos.map((combo, comboIdx) => {
                        const isExpanded = !!expandedComboIds[combo.id];
                        return (
                          <div
                            key={combo.id}
                            className="p-4 bg-white border border-[#E4E7EC] rounded-xl animate-in fade-in slide-in-from-bottom-2 duration-300 shadow-sm"
                          >
                            <div
                              onClick={() => toggleComboExpand(combo.id)}
                              className="flex items-center justify-between gap-4 cursor-pointer select-none hover:bg-slate-50/50 p-1.5 rounded-lg -m-1.5 transition-colors"
                              title="Cliquer pour afficher ou masquer les détails de la combinaison"
                            >
                              <div>
                                <p className="text-xs font-black text-[#101828]">
                                  Combinaison {comboIdx + 1} — {combo.label}
                                </p>
                                <p className="text-xs text-[#667085] font-bold mt-1">
                                  {combo.numabs.length} abonné{combo.numabs.length !== 1 ? 's' : ''}
                                  {' · '}{combo.pickCount} ligne{combo.pickCount !== 1 ? 's' : ''}
                                  {' · '}Total : {fmt(combo.sum)}
                                </p>
                              </div>
                              <button
                                type="button"
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-[#F2F4F7] border border-[#D0D5DD] text-[#475467] hover:bg-[#E4E7EC] hover:text-[#101828] rounded-lg text-[10px] font-black transition-colors"
                              >
                                {isExpanded ? (
                                  <>
                                    <ChevronDown className="rotate-180 transition-transform duration-200" size={12} />
                                    Masquer les détails
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="transition-transform duration-200" size={12} />
                                    Afficher les détails
                                  </>
                                )}
                              </button>
                            </div>

                            {isExpanded && (
                              <div className="mt-3 overflow-x-auto animate-in fade-in slide-in-from-top-1 duration-200">
                                <table className="w-full text-xs border border-[#E4E7EC] rounded-xl overflow-hidden">
                                  <thead>
                                    <tr className="text-[10px] uppercase text-[#475467] font-bold bg-[#F9FAFB]">
                                      <th className="text-left py-2 px-3 w-10">N°</th>
                                      <th className="text-left py-2 px-3">Code abonné</th>
                                      <th className="text-left py-2 px-3">Raison sociale</th>
                                      <th className="text-left py-2 px-3">Institution</th>
                                      <th className="text-left py-2 px-3">Période</th>
                                      <th className="text-right py-2 px-3">Montant</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {combo.lines.map((line, idx) => (
                                      <tr key={`${combo.id}-${line.numab}-${line.year}-Q${line.quarter}-${idx}`} className="border-t border-[#F2F4F7]">
                                        <td className="py-2 px-3 font-black text-[#344054]">{String(idx + 1).padStart(2, '0')}</td>
                                        <td className="py-2 px-3 font-mono font-bold">{line.numab}</td>
                                        <td className="py-2 px-3">{line.raisoc}</td>
                                        <td className="py-2 px-3">
                                          <span className="font-mono text-[10px] text-[#667085]">{line.codinstit}</span>
                                          {line.lib_instit !== '—' && (
                                            <span className="block text-[10px] text-[#98A2B3]">{line.lib_instit}</span>
                                          )}
                                        </td>
                                        <td className="py-2 px-3 font-bold text-[#344054]">{line.periodLabel}</td>
                                        <td className="py-2 px-3 text-right font-black text-rose-600 whitespace-nowrap">{fmt(line.amount)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                  <tfoot>
                                    <tr className="bg-[#F9FAFB] text-[#101828] font-black border-t-2 border-[#E4E7EC]">
                                      <td colSpan={5} className="py-2 px-3 text-right uppercase text-[10px] tracking-wide">
                                        Total combinaison
                                      </td>
                                      <td className="py-2 px-3 text-right text-rose-700 whitespace-nowrap">{fmt(combo.sum)}</td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                            )}

                            <div className="mt-3 flex items-center gap-2 flex-wrap">
                              <button
                                onClick={() => setSelectedNumabsInst(combo.numabs)}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-[#101828] text-white rounded-xl text-xs font-black hover:bg-[#344054] transition-all active:scale-95"
                              >
                                Appliquer cette sélection ({combo.numabs.length})
                              </button>
                              <button
                                onClick={() => handlePrintCombination(combo)}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-[#D0D5DD] text-[#344054] rounded-xl text-xs font-black hover:bg-[#F9FAFB] hover:text-[#101828] transition-all active:scale-95"
                              >
                                <Printer size={13} /> Imprimer la combinaison
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {combinationMessage && (
            <p className={`mt-3 text-xs font-bold rounded-xl px-4 py-3 border ${
              combinationResults.length > 0
                ? 'text-amber-700 bg-amber-50 border-amber-200'
                : 'text-amber-700 bg-amber-50 border-amber-200'
            }`}>
              {combinationMessage}
            </p>
          )}
        </div>
      </div>

      <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-4 px-8 py-5 border-b border-[#F2F4F7] bg-slate-50/30">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#98A2B3]" />
              <input
                type="text"
                placeholder="Code inst., nom, abonné…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className={inputCls}
              />
            </div>
            <button
              onClick={exportCSV}
              disabled={selectedRowsInst.length === 0 && flatRows.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black hover:bg-emerald-700 disabled:opacity-50 transition-all"
            >
              <FileSpreadsheet size={13} /> CSV
            </button>
            <button
              onClick={handlePrintCreances}
              disabled={selectedRowsInst.length === 0 && flatRows.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-700 border border-rose-100 rounded-xl text-xs font-black hover:bg-rose-100 disabled:opacity-50 transition-all"
              title="Imprimer avec les filtres appliqués"
            >
              <Printer size={13} /> Imprimer
            </button>
            <button
              onClick={handlePrintQuarterlyCreances}
              disabled={selectedRowsInst.length === 0 && flatRows.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-50 text-brand-700 border border-brand-100 rounded-xl text-xs font-black hover:bg-brand-100 disabled:opacity-50 transition-all"
              title="Imprimer le tableau comparatif trimestriel sur 10 ans"
            >
              <Printer size={13} /> Imprimer par Facture (Trimestres)
            </button>
            <button
              onClick={loadData}
              className="px-4 py-2 bg-white border border-[#E4E7EC] rounded-xl text-xs font-black text-[#475467] hover:bg-[#F9FAFB]"
            >
              Actualiser
            </button>
          </div>
        </div>
        <div className="px-8 py-4 border-b border-[#F2F4F7] bg-[#FAFBFC] flex items-center gap-4 overflow-x-auto">
          <div className="min-w-[220px]">
            <MultiSelectDropdown
              label="Code inst."
              options={filterOptions.codinstit}
              selected={filterCodInstit}
              onChange={vals => { setFilterCodInstit(vals); setPage(1); }}
            />
          </div>
          <div className="min-w-[220px]">
            <MultiSelectDropdown
              label="Institution"
              options={filterOptions.institutions}
              selected={filterInstitution}
              onChange={vals => { setFilterInstitution(vals); setPage(1); }}
            />
          </div>
          <div className="min-w-[220px]">
            <MultiSelectDropdown
              label="Type"
              options={filterOptions.types}
              selected={filterTypeAbonInst}
              onChange={vals => { setFilterTypeAbonInst(vals); setPage(1); }}
            />
          </div>
          <div className="min-w-[220px]">
            <MultiSelectDropdown
              label="État Cpt"
              options={filterOptions.etats}
              selected={filterEtatCptInst}
              onChange={vals => { setFilterEtatCptInst(vals); setPage(1); }}
            />
          </div>
          <div className="min-w-[220px]">
            <MultiSelectDropdown
              label="Tournée"
              options={filterOptions.tournees}
              selected={filterTourneeInst}
              onChange={vals => { setFilterTourneeInst(vals); setPage(1); }}
            />
          </div>
        </div>

        {dataLoading ? (
          <div className="flex items-center justify-center gap-3 py-20">
            <div className="w-8 h-8 border-4 border-brand-100 border-t-brand-600 rounded-full animate-spin" />
            <p className="text-sm font-bold text-[#667085]">Calcul des créances institutions…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-16 px-8">
            <p className="text-sm font-bold text-rose-600 text-center">{error}</p>
            <button onClick={loadData} className="px-4 py-2 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-xs font-bold">
              Réessayer
            </button>
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <Building2 size={32} className="text-[#D0D5DD]" />
            <p className="text-sm font-black text-[#667085]">Aucune créance institutionnelle trouvée</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#F9FAFB] text-[#475467] text-[10px] uppercase tracking-wider font-bold border-b border-[#E4E7EC]">
                    <th className="px-4 py-4 w-10">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-[#D0D5DD] text-brand-600"
                        checked={allVisibleSelectedInst}
                        onChange={() => {
                          if (allVisibleSelectedInst) {
                            setSelectedNumabsInst(prev => prev.filter(id => !visibleNumabsInst.includes(id)));
                          } else {
                            setSelectedNumabsInst(prev => Array.from(new Set([...prev, ...visibleNumabsInst])));
                          }
                        }}
                      />
                    </th>
                    <SortTh label="Code Inst." col="codinstit" />
                    <SortTh label="Institution" col="lib_instit" />
                    <SortTh label="Code Abonné" col="numab" />
                    <SortTh label="Raison sociale" col="raisoc" />
                    <SortTh label="Adresse" col="adresse" />
                    <SortTh label="Bloc" col="bloc" />
                    <SortTh label="N° Dom" col="ndom" />
                    <SortTh label="Type" col="type_abon" />
                    <SortTh label="État Cpt" col="etat_cpt" />
                    <SortTh label="N° Série" col="numser" />
                    <SortTh label="Tournée" col="tournee" />
                    <SortTh label="Fact." col="nombre_creance" />
                    <SortTh label="Montant créance" col="montant_creance" />
                    <SortTh label="Dernier paiement" col="derniere_date_paiement" />
                  </tr>
                </thead>
                <tbody>
                  {pagedGroups.map((g: InstitGroup) => {
                    const gt = groupTotals(g);
                    return (
                      <Fragment key={g.codinstit}>
                        <tr className="bg-brand-50 border-t-2 border-brand-200">
                          <td className="px-4 py-3" />
                          <td className="px-4 py-3 font-mono font-black text-brand-900 whitespace-nowrap">
                            {g.codinstit}
                          </td>
                          <td className="px-4 py-3 font-black text-brand-900 max-w-[220px]">
                            {g.lib_instit}
                            <span className="ml-2 text-[10px] font-bold text-brand-600">
                              ({g.rows.length} abonné{g.rows.length !== 1 ? 's' : ''})
                            </span>
                          </td>
                          <td className="px-4 py-3" colSpan={10} />
                          <td className="px-4 py-3 text-center font-black text-brand-900">
                            {gt.factures.toLocaleString('fr-FR')}
                          </td>
                          <td className="px-4 py-3 text-right font-black text-rose-600 whitespace-nowrap">
                            {fmt(gt.montant)}
                          </td>
                          <td className="px-4 py-3" />
                        </tr>
                        {g.rows.map((r: any, i: number) => {
                          const isComboMatch = comboHighlightNumabs.has(r.numab);
                          return (
                          <tr key={`${g.codinstit}-${r.numab}-${i}`} className={`hover:bg-[#F9FAFB] border-b border-[#F2F4F7] ${isComboMatch ? 'bg-emerald-50 ring-1 ring-inset ring-emerald-200' : ''}`}>
                            <td className="px-4 py-2 text-center">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-[#D0D5DD] text-brand-600"
                                checked={selectedNumabsInst.includes(r.numab)}
                                onChange={() => setSelectedNumabsInst(prev => prev.includes(r.numab) ? prev.filter(id => id !== r.numab) : [...prev, r.numab])}
                              />
                            </td>
                            <td className="px-4 py-2" colSpan={2} />
                            <td className="px-4 py-2 font-mono font-bold">{r.numab}</td>
                            <td className="px-4 py-2 font-bold text-[#101828] max-w-[200px]">{r.raisoc}</td>
                            <td className="px-4 py-2 text-[#475467] max-w-[160px]">{r.adresse}</td>
                            <td className="px-4 py-2">{r.bloc}</td>
                            <td className="px-4 py-2">{r.ndom}</td>
                            <td className="px-4 py-2">{r.type_abon}</td>
                            <td className="px-4 py-2">{r.etat_cpt}</td>
                            <td className="px-4 py-2 font-mono text-[10px]">{r.numser}</td>
                            <td className="px-4 py-2 font-bold text-blue-600">{r.tournee}</td>
                            <td className="px-4 py-2 text-center font-bold">{r.nombre_creance}</td>
                            <td className="px-4 py-2 text-right font-black text-rose-600 whitespace-nowrap">{fmt(r.montant_creance)}</td>
                            <td className="px-4 py-2 whitespace-nowrap">{r.derniere_date_paiement}</td>
                          </tr>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-[#0F172A] text-white text-xs font-bold">
                    <td colSpan={11} className="px-4 py-3 uppercase tracking-wide">
                      Total — {tableTotals.institutions} institutions · {tableTotals.count} abonnés
                    </td>
                    <td className="px-4 py-3 text-center">{tableTotals.factures.toLocaleString('fr-FR')}</td>
                    <td className="px-4 py-3 text-right text-rose-300 whitespace-nowrap">{fmt(tableTotals.montant)}</td>
                    <td className="px-4 py-3" />
                  </tr>
                </tfoot>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex justify-between items-center px-8 py-4 border-t border-[#F2F4F7] bg-[#F9FAFB]">
                <p className="text-xs font-bold text-[#667085]">
                  Page {safePage} / {totalPages} · {pagedGroups.length} institutions affichées
                </p>
                <div className="flex gap-2">
                  <button disabled={safePage <= 1} onClick={() => setPage(p => p - 1)}
                    className="px-3.5 py-2 rounded-xl text-xs font-black border border-[#E4E7EC] bg-white disabled:opacity-40">
                    ← Préc.
                  </button>
                  <button disabled={safePage >= totalPages} onClick={() => setPage(p => p + 1)}
                    className="px-3.5 py-2 rounded-xl text-xs font-black border border-[#E4E7EC] bg-white disabled:opacity-40">
                    Suiv. →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SettingsView({ onBack }: { onBack: () => void }) {
  const [unites, setUnites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sectorSearch, setSectorSearch] = useState('');
  const [clearingCache, setClearingCache] = useState(false);
  const [cacheMessage, setCacheMessage] = useState<string | null>(null);

  const fetchSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/unites_settings");
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setUnites(data);
      }
    } catch {
      setError("Impossible de charger les paramètres depuis le serveur backend.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleClearCache = async () => {
    if (!confirm("Êtes-vous sûr de vouloir vider le cache et recharger toutes les tables DBF ? Cette opération peut prendre quelques minutes.")) {
      return;
    }
    setClearingCache(true);
    setCacheMessage("Vidage du cache et rechargement en cours. Veuillez patienter...");
    try {
      const res = await fetch("http://127.0.0.1:8000/api/clear_cache");
      const data = await res.json();
      setCacheMessage(data.message || "Rechargement lancé avec succès !");
      setTimeout(() => {
        window.location.reload();
      }, 5000);
    } catch {
      setCacheMessage("Erreur lors de la communication avec le serveur.");
      setClearingCache(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] p-8 no-print">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-bold text-[#667085] hover:text-[#101828] mb-4 transition-colors"
        >
          <ChevronRight className="rotate-180" size={16} /> Retour au tableau de bord
        </button>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-3xl font-black tracking-tight text-[#101828]">Paramètres du Système</h2>
            <p className="text-sm text-[#667085] mt-1 font-medium">Consultez la structure organisationnelle d'EPEOR, l'unité de gestion et ses centres associés.</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-[#E4E7EC] rounded-[2rem] shadow-sm">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-[#0D83DE] rounded-full animate-spin"></div>
          <p className="mt-4 text-sm font-bold text-[#475467]">Chargement de la structure organisationnelle...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-6 rounded-[2rem] shadow-sm">
          <p className="font-bold">Une erreur est survenue</p>
          <p className="text-sm mt-1">{error}</p>
          <button
            onClick={fetchSettings}
            className="mt-4 px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            Réessayer
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {unites.map((u: any) => {
            const filteredSectors = u.sectors.filter((s: any) => 
              s.code.toLowerCase().includes(sectorSearch.toLowerCase()) ||
              s.libelle.toLowerCase().includes(sectorSearch.toLowerCase())
            );

            return (
              <div key={u.code} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Unit Card */}
                <div className="lg:col-span-1 bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] p-8 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center font-black text-lg">
                        {u.code}
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-[#101828] uppercase">Unité {u.denom}</h3>
                        <p className="text-xs text-blue-600 font-bold">Unité de Gestion Principale</p>
                      </div>
                    </div>

                    <div className="border-t border-[#F2F4F7] pt-6 space-y-4">
                      <div>
                        <span className="block text-[10px] font-bold text-[#98A2B3] uppercase tracking-wider">Adresse</span>
                        <span className="text-sm font-bold text-[#344054]">{u.adresse || '—'}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-[#98A2B3] uppercase tracking-wider">Téléphone</span>
                        <span className="text-sm font-bold text-[#344054]">{u.telephone || '—'}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-[#98A2B3] uppercase tracking-wider">Identifiant Fiscal (NIF)</span>
                        <span className="text-sm font-mono font-bold text-[#344054]">{u.identfisc || '—'}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-[#98A2B3] uppercase tracking-wider">Article d'Imposition</span>
                        <span className="text-sm font-mono font-bold text-[#344054]">{u.nartfisc || '—'}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-[#98A2B3] uppercase tracking-wider">Banque</span>
                        <span className="text-sm font-bold text-[#344054]">{u.ncompte || '—'}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-[#98A2B3] uppercase tracking-wider">RIB / Compte Bancaire</span>
                        <span className="text-sm font-mono font-bold text-slate-700 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 block mt-1 overflow-x-auto select-all">
                          {u.dombanq || '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 pt-6 border-t border-[#F2F4F7]">
                    <div className="flex items-center gap-2.5 text-xs font-bold text-[#667085]">
                      <span>Statut :</span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                        Opérationnel
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sectors/Centers Card */}
                <div className="lg:col-span-2 bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] p-8 flex flex-col">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div>
                      <h3 className="text-lg font-black text-[#101828]">Centres & Secteurs Associés</h3>
                      <p className="text-xs text-[#667085] font-medium mt-0.5">Secteurs géographiques rattachés à l'unité de {u.denom} ({u.sectors.length} centres chargés)</p>
                    </div>
                    
                    {/* Search sector */}
                    <div className="relative">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#98A2B3]" size={16} />
                      <input
                        type="text"
                        placeholder="Rechercher un centre..."
                        className="bg-white border-[#D0D5DD] border rounded-xl pl-10 pr-4 py-2 text-xs focus:outline-none focus:ring-4 focus:ring-blue-50 focus:border-[#0D83DE] transition-all placeholder:text-[#98A2B3] w-48 sm:w-64"
                        value={sectorSearch}
                        onChange={(e) => setSectorSearch(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="border border-[#E4E7EC] rounded-2xl overflow-hidden flex-1 max-h-[500px] overflow-y-auto">
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="bg-[#F9FAFB] border-b border-[#E4E7EC] text-[#475467] text-[10px] uppercase font-black">
                          <th className="px-6 py-4">Code Centre</th>
                          <th className="px-6 py-4">Nom du Centre (Secteur)</th>
                          <th className="px-6 py-4">Code Unité</th>
                          <th className="px-6 py-4 text-right">Rattachement</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F2F4F7]">
                        {filteredSectors.length > 0 ? (
                          filteredSectors.map((s: any) => (
                            <tr key={s.code} className="hover:bg-[#F9FAFB] transition-colors group">
                              <td className="px-6 py-4 font-mono font-black text-sm text-[#0D83DE]">
                                {s.code}
                              </td>
                              <td className="px-6 py-4 font-black text-slate-800 text-sm">
                                {s.libelle}
                              </td>
                              <td className="px-6 py-4 font-mono text-xs text-[#667085]">
                                {s.unite}
                              </td>
                              <td className="px-6 py-4 text-right">
                                <span className="inline-flex items-center px-2.5 py-1 bg-blue-50/50 text-blue-700 border border-blue-100/50 rounded-lg text-[10px] font-bold">
                                  Lié à {u.denom}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="px-6 py-12 text-center text-sm font-bold text-[#98A2B3]">
                              Aucun centre ne correspond à votre recherche.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Cache Settings card */}
          <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] p-8 no-print">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h3 className="text-lg font-black text-[#101828]">Gestion du Cache de Données</h3>
                <p className="text-sm text-[#667085] mt-1 font-medium">Forcez la ré-analyse et la mise en cache des tables DBF brutes. Utilisez cette fonction si les fichiers de données sur le disque ont été modifiés.</p>
              </div>
              <button
                onClick={handleClearCache}
                disabled={clearingCache}
                className={`px-6 py-3.5 rounded-2xl font-black text-xs transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-2 ${
                  clearingCache 
                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed' 
                    : 'bg-[#0D83DE] text-white hover:bg-[#0b72c2] border border-[#0b72c2] shadow-blue-100'
                }`}
              >
                <RefreshCw size={16} className={clearingCache ? 'animate-spin' : ''} />
                Réindexer & Recharger les DBF
              </button>
            </div>
            {cacheMessage && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-100 text-blue-800 rounded-xl text-xs font-bold animate-in fade-in duration-300">
                {cacheMessage}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


