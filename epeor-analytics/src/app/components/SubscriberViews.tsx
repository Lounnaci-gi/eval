"use client";

import { useEffect, useState, useRef, useMemo, useId } from "react";
import dynamic from "next/dynamic";
import {
  ChevronRight, MapPin, Printer, Search,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { apiUrlObject } from "../lib/api";
import { buildSubscribersUrl, appendSecteurParam } from "./utils";
import { SecteurDropdown } from "./ui";
import { NominativeTable } from "./NominativeTable";
import { ScrollableTabs, ScrollableTab } from "./ScrollableTabs";
import { SubscriberNetworkGraph } from "./SubscriberNetworkGraph";
import { escapeHtml } from "../../lib/escape";

const SubscribersEvolutionView = dynamic(
  () => import("./EvolutionView").then((mod) => ({ default: mod.SubscribersEvolutionView })),
  {
    loading: () => (
      <div className="p-12 flex justify-center">
        <div className="spinner-premium" style={{ width: 32, height: 32 }} />
      </div>
    ),
  }
);

const SubscriberTerrain3D = dynamic(
  () => import("./SubscriberTerrain3D").then((mod) => ({ default: mod.SubscriberTerrain3D })),
  { ssr: false, loading: () => <div className="h-[360px] animate-pulse rounded-2xl bg-[#dce9e2] sm:h-[460px]" /> },
);

function mapCommuneChartData(communes: any[]) {
  return communes.map((commune: any) => ({
    id: String(commune.id ?? ""),
    name: commune.name,
    total: Number(commune.value) || 0,
    active: (Number(commune.value) || 0) - (Number(commune.resigned) || 0),
    forfait: Number(commune.forfait_count) || 0,
    resigned: Number(commune.resigned) || 0,
  }));
}

type DistributionChartConfig = {
  title: string;
  description: string;
  emptyMessage: string;
  color: string;
  data: { name: string; count: number }[];
};

function DistributionChart({ chart }: { chart: DistributionChartConfig }) {
  const gradientId = `distribution-${useId().replace(/:/g, '')}`;
  const data = chart.data.filter((row) => row.count > 0);

  return (
    <section className="obat-card min-w-0 overflow-hidden p-5 sm:p-7">
      <div className="mb-5">
        <h3 className="text-xl font-black tracking-tight text-[#101828]">{chart.title}</h3>
        <p className="mt-1 text-sm font-medium text-[#667085]">{chart.description}</p>
      </div>
      {data.length > 0 ? (
        <div className="overflow-x-auto">
          <div style={{ minWidth: Math.max(520, data.length * 56) }}>
            <ResponsiveContainer width="100%" height={340} minWidth={0}>
              <BarChart data={data} margin={{ top: 12, right: 20, left: 0, bottom: 72 }}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chart.color} stopOpacity={0.78} />
                    <stop offset="100%" stopColor={chart.color} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#E9EDF3" />
                <XAxis
                  dataKey="name"
                  interval={0}
                  angle={-35}
                  textAnchor="end"
                  height={76}
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis type="number" allowDecimals={false} width={48} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: `${chart.color}14` }}
                  formatter={(value) => [Number(value ?? 0).toLocaleString('fr-FR'), 'Abonnés']}
                />
                <Bar dataKey="count" fill={`url(#${gradientId})`} radius={[7, 7, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <p className="py-8 text-center text-sm font-medium text-[#667085]">{chart.emptyMessage}</p>
      )}
    </section>
  );
}

function DistributionCharts({ charts }: { charts: DistributionChartConfig[] }) {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      {charts.map((chart) => <DistributionChart key={chart.title} chart={chart} />)}
    </div>
  );
}

export function GestionAbonnesShell({
  currentView,
  setCurrentView,
  baseStats,
  selectedSecteur,
  sectors,
  uniteLabel,
  onSecteurChange,
  sectorsLoading,
  onBack,
  allowAll = true,
}: {
  currentView: 'details' | 'evolution' | 'resigned' | 'stopped' | 'no_meter' | 'institutions' | 'unconnected' | 'terrain';
  setCurrentView: (v: any) => void;
  baseStats: any;
  selectedSecteur: string;
  sectors: { code: string; libelle: string }[];
  uniteLabel: string;
  onSecteurChange: (code: string) => void;
  sectorsLoading: boolean;
  onBack: () => void;
  allowAll?: boolean;
}) {
  const [gestionStats, setGestionStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchStarted, setSearchStarted] = useState(false);
  const [selectedSearchNumabs, setSelectedSearchNumabs] = useState<string[]>([]);
  const [selectedUnconnectedRow, setSelectedUnconnectedRow] = useState<{ kind: 'commune' | 'type'; row: any } | null>(null);
  const [unconnectedSubscribers, setUnconnectedSubscribers] = useState<any[]>([]);
  const [selectedUnconnectedNumabs, setSelectedUnconnectedNumabs] = useState<string[]>([]);
  const [unconnectedSubscribersLoading, setUnconnectedSubscribersLoading] = useState(false);
  const [unconnectedSubscribersError, setUnconnectedSubscribersError] = useState<string | null>(null);
  const [selectedInstitutionRow, setSelectedInstitutionRow] = useState<{ kind: 'commune' | 'type' | 'institution'; row: any } | null>(null);
  const [institutionRecords, setInstitutionRecords] = useState<any[]>([]);
  const [institutionRecordsLoading, setInstitutionRecordsLoading] = useState(false);
  const [institutionRecordsError, setInstitutionRecordsError] = useState<string | null>(null);
  const [selectedInstitutionNumabs, setSelectedInstitutionNumabs] = useState<string[]>([]);
  const [showSubscriberNetwork, setShowSubscriberNetwork] = useState(false);

  useEffect(() => {
    const searchTerm = searchQuery.trim().length > 0
      ? searchQuery
      : currentView === 'unconnected'
        ? '41'
        : '';

    if (searchTerm.trim().length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      setSearchStarted(false);
      return;
    }

    setSearchResults([]);
    setSearchLoading(false);
    setSearchStarted(false);
    const controller = new AbortController();

    const timeoutId = setTimeout(() => {
      setSearchStarted(true);
      setSearchLoading(true);
      const url = apiUrlObject('/search');
      url.searchParams.append('query', searchTerm);
      if (currentView === 'unconnected') {
        url.searchParams.append('etatcpt', '41');
      }
      if (selectedSecteur) {
        url.searchParams.append('secteur', selectedSecteur);
      }

      fetch(url.toString(), { signal: controller.signal })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setSearchResults(data);
          } else {
            setSearchResults([]);
          }
        })
        .catch(err => {
          if (err.name !== 'AbortError') {
            console.error('Search error:', err);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setSearchLoading(false);
          }
        });
    }, 400); // Wait for typing to pause before searching

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [searchQuery, selectedSecteur, currentView]);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setSelectedSearchNumabs([]);
  };

  const handleUnconnectedRowClick = async (kind: 'commune' | 'type', row: any) => {
    setSelectedUnconnectedRow({ kind, row });
    setUnconnectedSubscribers([]);
    setSelectedUnconnectedNumabs([]);
    setUnconnectedSubscribersError(null);
    setUnconnectedSubscribersLoading(true);
    try {
      const response = await fetch(buildSubscribersUrl(undefined, {
        etat: '41',
        secteur: selectedSecteur,
        ...(kind === 'commune'
          ? { commune: row.id }
          : { typabon: row.code || '__EMPTY__' }),
      }));
      if (!response.ok) {
        throw new Error(`Erreur HTTP ${response.status}`);
      }
      const data = await response.json();
      if (!Array.isArray(data)) {
        throw new Error(data?.error || 'Réponse invalide du serveur');
      }
      setUnconnectedSubscribers(data);
    } catch (error) {
      console.error('Erreur lors du chargement des abonnés non branchés :', error);
      setUnconnectedSubscribersError('Impossible de charger la liste des abonnés non branchés. Réessayez.');
    } finally {
      setUnconnectedSubscribersLoading(false);
    }
  };

  const handleInstitutionRowClick = (kind: 'commune' | 'type' | 'institution', row: any) => {
    setSelectedInstitutionRow({ kind, row });
    setSelectedInstitutionNumabs([]);
  };

  useEffect(() => {
    if (currentView !== 'institutions') return;
    const controller = new AbortController();
    setInstitutionRecordsLoading(true);
    setInstitutionRecordsError(null);
    const url = apiUrlObject('/institution_subscribers');
    appendSecteurParam(url, selectedSecteur);
    fetch(url.toString(), { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Erreur HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (!Array.isArray(data)) throw new Error(data?.error || 'Réponse invalide du serveur');
        setInstitutionRecords(data);
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          console.error('Erreur lors du chargement des abonnés institutionnels :', error);
          setInstitutionRecordsError('Impossible de charger les abonnés liés aux institutions. Réessayez.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setInstitutionRecordsLoading(false);
      });
    return () => controller.abort();
  }, [currentView, selectedSecteur]);

  const secteurLabel = selectedSecteur
    ? (sectors.find(s => s.code === selectedSecteur)?.libelle ?? selectedSecteur)
    : null;

  useEffect(() => {
    if (!baseStats?.ready) return;
    if (!selectedSecteur) {
      setGestionStats(null);
      return;
    }
    let cancelled = false;
    setStatsLoading(true);
    const url = apiUrlObject('/stats');
    appendSecteurParam(url, selectedSecteur);
    fetch(url.toString())
      .then(r => r.json())
      .then(data => {
        if (!cancelled && data?.ready) setGestionStats(data);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setStatsLoading(false); });
    return () => { cancelled = true; };
  }, [selectedSecteur, baseStats?.ready]);

  const stats = selectedSecteur && gestionStats ? gestionStats : baseStats;
  const tabs = [
    { id: 'details' as const, label: 'Vue globale' },
    { id: 'terrain' as const, label: 'Relief des abonnés' },
    { id: 'evolution' as const, label: 'Évolution des abonnés' },
    { id: 'resigned' as const, label: 'Résiliés' },
    { id: 'stopped' as const, label: "À l'arrêt" },
    { id: 'no_meter' as const, label: 'Sans compteur' },
    { id: 'institutions' as const, label: 'Institutions' },
    { id: 'unconnected' as const, label: 'Non branchés' },
  ];
  const institutionSubscribers = useMemo(() => {
    const byNumab = new Map<string, any>();
    for (const record of institutionRecords) {
      const key = String(record.numab ?? '').trim();
      if (!key) continue;
      let subscriber = byNumab.get(key);
      if (!subscriber) {
        subscriber = { ...record, institutions: new Set<string>(), institutionCodes: new Set<string>() };
        byNumab.set(key, subscriber);
      }
      subscriber.institutions.add(`${record.codinstit || ''} ${record.lib_instit || ''}`.trim());
      subscriber.institutionCodes.add(String(record.codinstit ?? ''));
    }
    return [...byNumab.values()].map((subscriber: any) => ({
      ...subscriber,
      institution: [...subscriber.institutions].filter(Boolean).join(' · '),
      institutionCodes: [...subscriber.institutionCodes].filter(Boolean),
    }));
  }, [institutionRecords]);
  const institutionCommunes = useMemo(() => {
    const groups = new Map<string, any>();
    for (const subscriber of institutionSubscribers) {
      const key = String(subscriber.codcom ?? '');
      const row = groups.get(key) ?? { id: key, name: subscriber.commune_name, value: 0 };
      row.value += 1;
      groups.set(key, row);
    }
    return [...groups.values()].sort((a, b) => b.value - a.value);
  }, [institutionSubscribers]);
  const institutionTypes = useMemo(() => {
    const groups = new Map<string, any>();
    for (const subscriber of institutionSubscribers) {
      const key = String(subscriber.typabon ?? '');
      const row = groups.get(key) ?? { code: key, name: subscriber.type || 'Inconnu', value: 0 };
      row.value += 1;
      groups.set(key, row);
    }
    return [...groups.values()].sort((a, b) => b.value - a.value);
  }, [institutionSubscribers]);
  const institutionGroups = useMemo(() => {
    const groups = new Map<string, any>();
    for (const record of institutionRecords) {
      const code = String(record.codinstit ?? '').trim();
      if (!code) continue;
      const row = groups.get(code) ?? { code, name: record.lib_instit || code, numabs: new Set<string>() };
      row.numabs.add(String(record.numab ?? '').trim());
      groups.set(code, row);
    }
    return [...groups.values()]
      .map(({ numabs, ...row }) => ({ ...row, value: numabs.size }))
      .sort((a, b) => b.value - a.value);
  }, [institutionRecords]);
  const selectedInstitutionSubscribers = useMemo(() => {
    if (!selectedInstitutionRow) return [];
    return institutionSubscribers.filter((subscriber: any) => (
      selectedInstitutionRow.kind === 'commune'
        ? String(subscriber.codcom) === String(selectedInstitutionRow.row.id)
        : selectedInstitutionRow.kind === 'type'
          ? String(subscriber.typabon) === String(selectedInstitutionRow.row.code)
          : subscriber.institutionCodes.includes(String(selectedInstitutionRow.row.code))
    ));
  }, [institutionSubscribers, selectedInstitutionRow]);
  const institutionTables = [
    { title: 'Répartition des institutions par commune', label: 'Commune', rows: institutionCommunes, kind: 'commune' as const },
    { title: "Répartition des institutions par type d'abonné", label: "Type d'abonné", rows: institutionTypes, kind: 'type' as const },
    { title: 'Répartition des abonnés par institutions', label: 'Institution', rows: institutionGroups, kind: 'institution' as const },
  ];
  const handlePrintInstitutionTable = (title: string, label: string, rows: any[]) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Veuillez autoriser les fenêtres pop-up pour pouvoir imprimer.');
      return;
    }

    const total = rows.reduce((sum: number, row: any) => sum + Number(row.value || 0), 0);
    const printDate = new Date().toLocaleDateString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const perimeter = secteurLabel ? `Centre : ${secteurLabel}` : uniteLabel || "Toute l'unité";
    const tableRows = rows.map((row: any) => {
      const value = Number(row.value) || 0;
      const percentage = total ? ((value / total) * 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00';
      return `<tr><td>${escapeHtml(row.name)}</td><td class="number">${value.toLocaleString('fr-FR')}</td><td class="number">${percentage}%</td></tr>`;
    }).join('');

    printWindow.document.write(`<!doctype html>
      <html lang="fr">
        <head>
          <meta charset="utf-8">
          <title>${escapeHtml(title)}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap');
            @page { size: landscape; margin: 10mm 12mm; }
            body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #101828; margin: 0; font-size: 9px; line-height: 1.4; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #F2F4F7; padding-bottom: 10px; margin-bottom: 12px; }
            .logo-section { display: flex; align-items: center; gap: 12px; }
            .logo-text { font-size: 14px; font-weight: 900; color: #0D83DE; margin: 0; }
            .company-name { font-size: 8.5px; font-weight: 700; color: #667085; text-transform: uppercase; margin-top: 1px; }
            .title-section { text-align: right; }
            .title { font-size: 16px; font-weight: 900; color: #101828; margin: 0; }
            .subtitle { font-size: 9.5px; color: #667085; margin: 3px 0 0; font-weight: 500; }
            .meta-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 15px; background: #F9FAFB; border: 1px solid #E4E7EC; border-radius: 8px; padding: 8px 12px; }
            .meta-item { display: flex; flex-direction: column; }
            .meta-label { font-size: 8px; text-transform: uppercase; color: #667085; font-weight: 700; margin-bottom: 2px; }
            .meta-value { font-size: 10px; font-weight: 700; color: #101828; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 15px; text-align: left; }
            th { background: #F9FAFB; color: #475467; font-size: 8px; font-weight: 700; text-transform: uppercase; padding: 7px 12px; border-bottom: 1px solid #F2F4F7; }
            td { border-bottom: 1px solid #F2F4F7; padding: 5px 12px; font-size: 9px; }
            .number { text-align: right; }
            .footer-info { display: flex; justify-content: space-between; align-items: center; color: #667085; font-size: 8px; border-top: 1px solid #F2F4F7; padding-top: 10px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo-section">
              <img src="${window.location.origin}/ade.png" alt="ADE Logo" style="height: 40px; width: auto;" />
              <div>
                <h1 class="logo-text">EPEOR ANALYTICS</h1>
                <div class="company-name">Algérienne des Eaux</div>
              </div>
            </div>
            <div class="title-section">
              <h2 class="title">${escapeHtml(title)}</h2>
              <p class="subtitle">Gestion Abonnés</p>
            </div>
          </div>
          <div class="meta-grid">
            <div class="meta-item"><span class="meta-label">Périmètre</span><span class="meta-value">${escapeHtml(perimeter)}</span></div>
            <div class="meta-item"><span class="meta-label">Date d'édition</span><span class="meta-value">${printDate}</span></div>
          </div>
          <table>
            <thead><tr><th>${escapeHtml(label)}</th><th class="number">Abonnés institutionnels</th><th class="number">Part (%)</th></tr></thead>
            <tbody>${tableRows || `<tr><td colspan="3">Aucune donnée disponible.</td></tr>`}</tbody>
            <tfoot><tr><td>Total</td><td class="number">${total.toLocaleString('fr-FR')}</td><td class="number">${total ? '100,00%' : '0,00%'}</td></tr></tfoot>
          </table>
          <div class="footer-info"><span>EPEOR Analytics - Gestion Abonnés</span><span>Page 1 sur 1</span></div>
          <script>window.onload = function() { setTimeout(function() { window.print(); }, 500); };</script>
        </body>
      </html>`);
    printWindow.document.close();
  };

  const viewProps = { stats, onBack, selectedSecteur, secteurLabel };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[1.25rem] sm:rounded-[2rem] page-card no-print">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-bold text-[#667085] hover:text-[#101828] mb-4 transition-colors"
        >
          <ChevronRight className="rotate-180" size={16} /> Retour au tableau de bord
        </button>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6">
          <div className="min-w-0">
            <h2 className="page-title text-[#101828]">Gestion Abonnés</h2>
            <p className="text-sm text-[#667085] mt-1 font-medium">
              {secteurLabel
                ? `Statistiques et listes du centre ${secteurLabel}`
                : 'Répartition par commune, quartier et état — toute l\'unité'}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 w-full lg:w-auto">
            <SecteurDropdown
              sectors={sectors}
              selectedSecteur={selectedSecteur}
              onSelect={onSecteurChange}
              uniteLabel={uniteLabel}
              loading={sectorsLoading}
              allowAll={allowAll}
            />
            {stats?.ready && !statsLoading && (
              <>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-2 rounded-full border border-emerald-100">
                  {(stats.total_subscribers ?? 0).toLocaleString('fr-FR')} abonné{(stats.total_subscribers ?? 0) !== 1 ? 's' : ''}
                </span>
                <span className="text-xs font-bold text-amber-600 bg-amber-50 px-3 py-2 rounded-full border border-amber-100">
                  {(stats.invoice_stopped_subscribers ?? 0).toLocaleString('fr-FR')} factures arrêtées
                </span>
              </>
            )}
          </div>
        </div>
        <div className="mt-4 sm:mt-6">
          <ScrollableTabs className="w-full flex items-center justify-between">
            <div className="flex items-center gap-1">
              {tabs.map(tab => (
                <ScrollableTab
                  key={tab.id}
                  active={currentView === tab.id && !searchQuery}
                  onClick={() => {
                    setCurrentView(tab.id);
                    setSearchQuery('');
                  }}
                >
                  {tab.label}
                </ScrollableTab>
              ))}
            </div>

            <div className="relative shrink-0 w-48 sm:w-64 ml-auto mr-1 py-0.5">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#98A2B3]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Nom, adresse, N° chèque/versement, NUMAB, compteur ou état..."
                aria-label="Recherche par plusieurs critères, séparés par des virgules"
                title="Séparez les critères par des virgules. Chaque critère doit correspondre au même abonné."
                className="w-full text-[11px] font-black pl-8 pr-7 py-1.5 rounded-xl border border-[#E4E7EC]/80 bg-white text-[#101828] placeholder-[#98A2B3] focus:outline-none focus:ring-1 focus:ring-brand-500 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => handleSearchChange('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#98A2B3] hover:text-[#101828] text-[10px] font-black"
                >
                  ✕
                </button>
              )}
            </div>
          </ScrollableTabs>
        </div>
      </div>

      {secteurLabel && (
        <div className="flex items-center gap-3 px-5 py-3.5 bg-blue-50 border border-blue-100 rounded-2xl text-xs font-bold text-[#0D83DE]">
          <MapPin size={16} className="shrink-0" />
          <span>
            Périmètre : centre <strong className="font-black">{secteurLabel}</strong>
            {uniteLabel ? ` — ${uniteLabel}` : ''}. Les tableaux et listes nominatives suivent ce filtre.
          </span>
        </div>
      )}

      <div className="relative">
        {statsLoading && !searchQuery.trim() && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70 backdrop-blur-[2px] rounded-[2rem] min-h-[120px]">
            <div className="flex flex-col items-center gap-2">
              <div className="spinner-premium" style={{ width: 32, height: 32 }} />
              <p className="text-[10px] font-black text-brand-600 uppercase tracking-widest">Calcul par centre…</p>
            </div>
          </div>
        )}
        {searchQuery.trim().length > 0 || currentView === 'unconnected' || currentView === 'institutions' ? (
          <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[1.25rem] sm:rounded-[2rem] p-4 sm:p-6 space-y-4 animate-in fade-in duration-200">
            {currentView === 'institutions' && !searchQuery.trim() && (
              institutionRecordsError ? (
                <p role="alert" className="p-6 text-sm font-medium text-rose-700">{institutionRecordsError}</p>
              ) : institutionRecordsLoading ? (
                <div className="flex justify-center p-12"><div className="spinner-premium" style={{ width: 32, height: 32 }} /></div>
              ) : selectedInstitutionRow ? (
                <section className="overflow-hidden rounded-2xl border border-[#E4E7EC] bg-white">
                  <div className="border-b border-[#F2F4F7] px-5 py-4">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedInstitutionRow(null);
                        setSelectedInstitutionNumabs([]);
                      }}
                      className="mb-3 flex items-center gap-2 text-sm font-bold text-[#667085] transition-colors hover:text-[#101828]"
                    >
                      <ChevronRight className="rotate-180" size={16} /> Retour aux répartitions
                    </button>
                    <h3 className="text-sm font-black text-[#101828]">
                      Abonnés institutionnels — {selectedInstitutionRow.row.name}
                    </h3>
                    <p className="mt-1 text-xs font-medium text-[#667085]">
                      {selectedInstitutionRow.kind === 'commune'
                        ? 'Commune'
                        : selectedInstitutionRow.kind === 'type'
                          ? "Type d'abonné"
                          : 'Institution'}
                      {secteurLabel ? ` · Centre ${secteurLabel}` : ''}
                    </p>
                  </div>
                  {selectedInstitutionSubscribers.length === 0 ? (
                    <p className="p-6 text-sm font-medium text-[#667085]">Aucun abonné institutionnel trouvé pour cette ligne.</p>
                  ) : (
                    <NominativeTable
                      subscribers={selectedInstitutionSubscribers}
                      loading={false}
                      accentColor="blue"
                      showInstitution
                      selectedNumabs={selectedInstitutionNumabs}
                      onSelectedNumabsChange={setSelectedInstitutionNumabs}
                    />
                  )}
                </section>
              ) : (
              <div className="space-y-5">
                {institutionTables.map(({ title, label, rows, kind }) => {
                  const total = rows.reduce((sum: number, row: any) => sum + row.value, 0);
                  return (
                    <section key={title} className="overflow-hidden rounded-2xl border border-[#E4E7EC] bg-white">
                      <div className="flex items-center justify-between gap-3 border-b border-[#F2F4F7] px-5 py-4">
                        <h3 className="text-sm font-black text-[#101828]">{title}</h3>
                        <button
                          type="button"
                          onClick={() => handlePrintInstitutionTable(title, label, rows)}
                          aria-label={`Imprimer ${title}`}
                          title={`Imprimer ${title}`}
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#E4E7EC] text-[#475467] transition-colors hover:bg-[#F9FAFB] hover:text-[#101828]"
                        >
                          <Printer size={16} />
                        </button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="bg-[#F9FAFB] text-[10px] font-bold uppercase tracking-wider text-[#475467]">
                              <th className="px-5 py-3">{label}</th>
                              <th className="px-5 py-3 text-right">Abonnés institutionnels</th>
                              <th className="px-5 py-3 text-right">Part des institutions (%)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#F2F4F7]">
                            {rows.length > 0 ? rows.map((row: any) => (
                              <tr
                                key={row.id ?? row.code ?? row.name}
                                onClick={() => handleInstitutionRowClick(kind, row)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    handleInstitutionRowClick(kind, row);
                                  }
                                }}
                                role="button"
                                tabIndex={0}
                                className="cursor-pointer transition-colors hover:bg-[#F9FAFB]"
                              >
                                <td className="px-5 py-3 text-sm font-bold text-[#101828]">{row.name}</td>
                                <td className="px-5 py-3 text-right text-sm font-bold text-blue-700">
                                  {row.value.toLocaleString('fr-FR')}
                                </td>
                                <td className="px-5 py-3 text-right text-sm font-medium text-[#475467]">
                                  {total
                                    ? ((row.value / total) * 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                    : '0,00'}%
                                </td>
                              </tr>
                            )) : (
                              <tr>
                                <td colSpan={3} className="px-5 py-6 text-center text-sm font-medium text-[#667085]">
                                  Aucun abonné institutionnel trouvé.
                                </td>
                              </tr>
                            )}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-[#E4E7EC] bg-[#F9FAFB] text-sm font-black text-[#101828]">
                              <td className="px-5 py-3">Total</td>
                              <td className="px-5 py-3 text-right">{total.toLocaleString('fr-FR')}</td>
                              <td className="px-5 py-3 text-right">{total ? '100,00%' : '0,00%'}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </section>
                  );
                })}
              </div>
              )
            )}
            {currentView === 'unconnected' && !searchQuery.trim() && (
              <div className="space-y-5">
                {selectedUnconnectedRow ? (
                  <section className="overflow-hidden rounded-2xl border border-[#E4E7EC] bg-white">
                    <div className="border-b border-[#F2F4F7] px-5 py-4">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedUnconnectedRow(null);
                          setSelectedUnconnectedNumabs([]);
                        }}
                        className="mb-3 flex items-center gap-2 text-sm font-bold text-[#667085] transition-colors hover:text-[#101828]"
                      >
                        <ChevronRight className="rotate-180" size={16} /> Retour aux répartitions
                      </button>
                      <h3 className="text-sm font-black text-[#101828]">
                        Abonnés non branchés — {selectedUnconnectedRow.row.name}
                      </h3>
                      <p className="mt-1 text-xs font-medium text-[#667085]">
                        {selectedUnconnectedRow.kind === 'commune' ? 'Commune' : "Type d'abonné"}
                        {secteurLabel ? ` · Centre ${secteurLabel}` : ''}
                      </p>
                    </div>
                    {unconnectedSubscribersError ? (
                      <p role="alert" className="p-6 text-sm font-medium text-rose-700">{unconnectedSubscribersError}</p>
                    ) : !unconnectedSubscribersLoading && unconnectedSubscribers.length === 0 ? (
                      <p className="p-6 text-sm font-medium text-[#667085]">Aucun abonné non branché trouvé pour cette ligne.</p>
                    ) : (
                      <NominativeTable
                        subscribers={unconnectedSubscribers}
                        loading={unconnectedSubscribersLoading}
                        accentColor="blue"
                        selectedNumabs={selectedUnconnectedNumabs}
                        onSelectedNumabsChange={setSelectedUnconnectedNumabs}
                      />
                    )}
                  </section>
                ) : [
                  {
                    title: 'Répartition Détaillée des Abonnés non branchés par Commune',
                    label: 'Commune',
                    rows: stats?.unconnected_communes ?? [],
                    kind: 'commune' as const,
                  },
                  {
                    title: "Répartition Détaillée des Abonnés non branchés par Type d'Abonné",
                    label: "Type d'Abonné",
                    rows: stats?.unconnected_types ?? [],
                    kind: 'type' as const,
                  },
                ].map(({ title, label, rows, kind }) => (
                  <section key={title} className="overflow-hidden rounded-2xl border border-[#E4E7EC] bg-white">
                    <h3 className="border-b border-[#F2F4F7] px-5 py-4 text-sm font-black text-[#101828]">
                      {title}
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-[#F9FAFB] text-[10px] font-bold uppercase tracking-wider text-[#475467]">
                            <th className="px-5 py-3">{label}</th>
                            <th className="px-5 py-3 text-right">Abonnés non branchés</th>
                            <th className="px-5 py-3 text-right">Part des non branchés (%)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#F2F4F7]">
                          {rows.length > 0 ? rows.map((row: any) => (
                            <tr
                              key={row.id ?? row.code ?? row.name}
                              onClick={() => handleUnconnectedRowClick(kind, row)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault();
                                  handleUnconnectedRowClick(kind, row);
                                }
                              }}
                              role="button"
                              tabIndex={0}
                              className="cursor-pointer hover:bg-[#F9FAFB] transition-colors"
                            >
                              <td className="px-5 py-3 text-sm font-bold text-[#101828]">{row.name}</td>
                              <td className="px-5 py-3 text-right text-sm font-bold text-blue-700">
                                {Number(row.value ?? 0).toLocaleString('fr-FR')}
                              </td>
                              <td className="px-5 py-3 text-right text-sm font-medium text-[#475467]">
                                {Number(row.percentage ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                              </td>
                            </tr>
                          )) : (
                            <tr>
                              <td colSpan={3} className="px-5 py-6 text-center text-sm font-medium text-[#667085]">
                                Aucun abonné non branché trouvé.
                              </td>
                            </tr>
                          )}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-[#E4E7EC] bg-[#F9FAFB] text-sm font-black text-[#101828]">
                            <td className="px-5 py-3">Total</td>
                            <td className="px-5 py-3 text-right">
                              {Number(stats?.unconnected_subscribers ?? 0).toLocaleString('fr-FR')}
                            </td>
                            <td className="px-5 py-3 text-right">
                              {stats?.unconnected_subscribers ? '100,00%' : '0,00%'}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </section>
                ))}
                {!selectedUnconnectedRow && (
                  <DistributionCharts
                    charts={[
                      {
                        title: "Abonnés non branchés par commune",
                        description: "Répartition géographique des abonnés non branchés",
                        emptyMessage: "Aucune donnée de non-branchement disponible par commune.",
                        color: '#2563EB',
                        data: (stats?.unconnected_communes ?? []).map((row: any) => ({
                          name: String(row.name ?? 'Commune inconnue'),
                          count: Number(row.value) || 0,
                        })),
                      },
                      {
                        title: "Abonnés non branchés par type",
                        description: "Répartition par type d'abonné",
                        emptyMessage: "Aucune donnée de non-branchement disponible par type d'abonné.",
                        color: '#2563EB',
                        data: (stats?.unconnected_types ?? []).map((row: any) => ({
                          name: String(row.name ?? "Type d'abonné inconnu"),
                          count: Number(row.value) || 0,
                        })),
                      },
                    ]}
                  />
                )}
              </div>
            )}
            {!(currentView === 'unconnected' && !searchQuery.trim() && searchStarted)
              && !(currentView === 'institutions' && !searchQuery.trim()) && (
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-[11px] sm:text-xs font-black text-[#101828] uppercase tracking-wider flex items-center gap-2">
                  {searchStarted
                    ? `🔍 Résultats de recherche (${searchResults.length})`
                    : currentView === 'unconnected' && !searchQuery.trim()
                      ? 'Chargement des abonnés non branchés…'
                      : searchQuery.trim().length < 2
                        ? 'Saisissez au moins 2 caractères'
                        : 'Recherche après une courte pause'}
                </h3>
              </div>
            )}

            {searchStarted && (currentView !== 'unconnected' || searchQuery.trim().length > 0) ? (
              <NominativeTable
                subscribers={searchResults.map((sub: any) => ({
                  numab: sub.NUMAB || '—',
                  name: sub.NOM || '—',
                  adresse: sub.ADRESSE || '—',
                  tournee: sub.TOURNEE || '—',
                  bloc: sub.BLOC || '—',
                  ndom: sub.NDOM || '—',
                  numser: sub.NUMSER || '---',
                  nouvelx: sub.NOUVELX !== undefined ? sub.NOUVELX : 0,
                  type: sub.TYPE_LABEL || '—',
                  etatcpt: sub.ETATCPT || '—',
                  etat_label: sub.ETAT_LABEL || '—',
                  numordre: sub.NUMORDRE || '—'
                }))}
                loading={searchLoading}
                accentColor="blue"
                selectedNumabs={selectedSearchNumabs}
                onSelectedNumabsChange={setSelectedSearchNumabs}
              />
            ) : !searchStarted && (currentView !== 'institutions' || searchQuery.trim().length > 0) ? (
              <p className="py-8 text-center text-sm font-medium text-[#667085]">
                {currentView === 'unconnected' && !searchQuery.trim()
                  ? 'Chargement des répartitions des abonnés non branchés…'
                  : searchQuery.trim().length < 2
                    ? 'Entrez au moins deux caractères pour rechercher.'
                    : 'La recherche démarre après une courte pause de saisie.'}
              </p>
            ) : null}
          </div>
        ) : (
          <>
            {currentView === 'details' && (
              <DetailedStatsView key={`details-${selectedSecteur}`} {...viewProps} />
            )}
            {currentView === 'terrain' && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2" role="group" aria-label="Mode de visualisation des abonnés">
                  <button
                    type="button"
                    aria-pressed={!showSubscriberNetwork}
                    onClick={() => setShowSubscriberNetwork(false)}
                    className={`rounded-xl border px-4 py-2 text-sm font-bold transition-colors ${
                      !showSubscriberNetwork
                        ? 'border-[#176b58] bg-[#176b58] text-white'
                        : 'border-[#d7e4df] bg-white text-[#244d42] hover:bg-[#eff6f2]'
                    }`}
                  >
                    Relief 3D
                  </button>
                  <button
                    type="button"
                    aria-pressed={showSubscriberNetwork}
                    onClick={() => setShowSubscriberNetwork(true)}
                    className={`rounded-xl border px-4 py-2 text-sm font-bold transition-colors ${
                      showSubscriberNetwork
                        ? 'border-[#176b58] bg-[#176b58] text-white'
                        : 'border-[#d7e4df] bg-white text-[#244d42] hover:bg-[#eff6f2]'
                    }`}
                  >
                    Réseau des liens
                  </button>
                </div>
                {showSubscriberNetwork ? (
                  <SubscriberNetworkGraph secteur={selectedSecteur} />
                ) : (
                  <SubscriberTerrain3D
                    data={mapCommuneChartData(stats?.subscriber_communes || [])}
                    secteur={selectedSecteur}
                  />
                )}
              </div>
            )}
            {currentView === 'evolution' && (
              <SubscribersEvolutionView key={`evolution-${selectedSecteur}`} {...viewProps} />
            )}
            {currentView === 'resigned' && (
              <ResignedDetailView key={`resigned-${selectedSecteur}`} {...viewProps} />
            )}
            {currentView === 'stopped' && (
              <StoppedDetailView key={`stopped-${selectedSecteur}`} {...viewProps} />
            )}
            {currentView === 'no_meter' && (
              <NoMeterDetailView key={`no_meter-${selectedSecteur}`} {...viewProps} />
            )}
          </>
        )}
      </div>
    </div>
  );
}


function DetailedStatsView({ stats, selectedSecteur = '', secteurLabel }: any) {
  const [selectedCommune, setSelectedCommune] = useState<any>(null);
  const [selectedType, setSelectedType] = useState<any>(null);
  const [selectedQuartier, setSelectedQuartier] = useState<any>(null);
  const [quartierSubscribers, setQuartierSubscribers] = useState<any[]>([]);
  const [loadingSubscribers, setLoadingSubscribers] = useState(false);
  const [selectedNumabs, setSelectedNumabs] = useState<string[]>([]);
  const [viewingInvoices, setViewingInvoices] = useState(false);
  const printedSubscribersRef = useRef<any[]>([]);

  const handleQuartierClick = async (q: any) => {
    setSelectedQuartier(q);
    setSelectedNumabs([]);
    setLoadingSubscribers(true);
    try {
      const res = await fetch(buildSubscribersUrl(q.id, {
        secteur: selectedSecteur,
        ...(selectedType?.code ? { typabon: selectedType.code } : {}),
      }));
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

    const currentSubscribers = printedSubscribersRef.current && printedSubscribersRef.current.length > 0
      ? printedSubscribersRef.current
      : quartierSubscribers;

    const toprint = selectedNumabs.length > 0
      ? currentSubscribers.filter((sub: any) => selectedNumabs.includes(sub.numab))
      : currentSubscribers;

    if (toprint.length === 0) {
      alert('Aucun abonné à imprimer. Veuillez sélectionner au moins un abonné.');
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Veuillez autoriser les fenêtres pop-up pour pouvoir imprimer.");
      return;
    }

    const selectionNote = selectedNumabs.length > 0 ? `Sélection de ${selectedNumabs.length} abonné(s)` : `Total : ${toprint.length} abonné(s)`;

    const rowsHtml = toprint.map((sub: any) => `
      <tr>
        <td class="font-bold-black">${sub.numab || '—'}</td>
        <td class="font-bold-black">${sub.name || '—'}</td>
        <td>${[sub.adresse, sub.bloc ? `Bl. ${sub.bloc}` : '', sub.ndom ? `N°${sub.ndom}` : ''].filter(Boolean).join(' · ') || '—'}</td>
        <td class="tournee-badge">${sub.tournee ? `T-${sub.tournee}` : '—'}</td>
        <td>${sub.numser || '—'}</td>
        <td style="font-weight: 700; text-align: right; color: #101828;">${sub.nouvelx !== undefined ? sub.nouvelx.toLocaleString() : '—'}</td>
        <td>${sub.type || '—'}</td>
      </tr>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Liste nominative - ${escapeHtml(selectedQuartier.name)}</title>
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
              <h1 class="title">Tous les Abonnés</h1>
              <p class="subtitle">Liste nominative des abonnés du quartier</p>
            </div>
          </div>

          <div class="meta-grid">
            <div class="meta-item">
              <span class="meta-label">Commune</span>
              <span class="meta-value">${selectedCommune?.name || '—'}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Quartier</span>
              <span class="meta-value">${escapeHtml(selectedQuartier.name)}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Date d'édition</span>
              <span class="meta-value">${new Date().toLocaleDateString('fr-FR')}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Abonnés à imprimer</span>
              <span class="meta-value">${escapeHtml(selectionNote)}</span>
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
                <th style="width: 12%">Type</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
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
      </html>`;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const communes = useMemo(() => stats?.subscriber_communes || [], [stats?.subscriber_communes]);
  const types = stats?.subscriber_types || [];
  const categoryLabels = [
    { key: "menages", name: "Ménages" },
    { key: "administrations", name: "Administrations" },
    { key: "commerce", name: "Commerce" },
    { key: "industriel", name: "Industrie & tourisme" },
    { key: "vente_en_gros", name: "Vente en gros" },
  ];
  const categoryChartData = categoryLabels.map(({ key, name }) => ({
    name,
    total: communes.reduce(
      (sum: number, commune: any) => sum + (Number(commune.categories?.[key]) || 0),
      0,
    ),
  }));
  const categorizedSubscribers = categoryChartData.reduce((sum, category) => sum + category.total, 0);
  const totalCommuneSubscribers = communes.reduce(
    (sum: number, commune: any) => sum + (Number(commune.value) || 0),
    0,
  );
  if (totalCommuneSubscribers > categorizedSubscribers) {
    categoryChartData.push({
      name: "Autres / non classés",
      total: totalCommuneSubscribers - categorizedSubscribers,
    });
  }
  categoryChartData.sort((a, b) => b.total - a.total);

  const handlePrintCommunes = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Veuillez autoriser les fenêtres pop-up pour pouvoir imprimer.");
      return;
    }

    const titleStr = "Répartition Détaillée des Abonnés par Commune";
    const subTitleStr = secteurLabel
      ? "Centre : " + secteurLabel
      : "Toute l'unité";
    const printDate = new Date().toLocaleDateString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });

    let tableRowsHtml = "";
    communes.forEach((c: any) => {
      const actifs = c.value - (c.resigned || 0);
      const forfait = c.forfait_count ?? 0;
      tableRowsHtml += `
        <tr>
          <td style="padding: 6px 12px; font-weight: bold;">${escapeHtml(c.name)}</td>
          <td style="padding: 6px 12px; text-align: right; font-weight: bold; color: #0D83DE;">${c.value.toLocaleString()}</td>
          <td style="padding: 6px 12px; text-align: right; color: #059669;">${actifs.toLocaleString()}</td>
          <td style="padding: 6px 12px; text-align: right; color: #c2410c;">${forfait.toLocaleString()}</td>
          <td style="padding: 6px 12px; text-align: right; color: #e11d48;">${c.resigned?.toLocaleString() || 0}</td>
          <td style="padding: 6px 12px; text-align: right; font-weight: bold;">${c.percentage}%</td>
        </tr>
      `;
    });

    const totalVal = communes.reduce((acc: number, curr: any) => acc + curr.value, 0);
    const totalResigned = communes.reduce((acc: number, curr: any) => acc + (curr.resigned || 0), 0);
    const totalActifs = totalVal - totalResigned;
    const totalForfait = communes.reduce((acc: number, curr: any) => acc + (curr.forfait_count || 0), 0);
    const totalPct = communes.reduce((acc: number, curr: any) => acc + (curr.percentage || 0), 0);

    tableRowsHtml += `
      <tr style="background: #f1f5f9; color: #101828; font-weight: bold; font-size: 9.5px; border-top: 1px solid #94a3b8; border-bottom: 1px solid #94a3b8;">
        <td style="padding: 9px 12px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: none; color: #101828;">Total Général</td>
        <td style="padding: 9px 12px; text-align: right; color: #1d4ed8; border-bottom: none;">${totalVal.toLocaleString()}</td>
        <td style="padding: 9px 12px; text-align: right; color: #047857; border-bottom: none;">${totalActifs.toLocaleString()}</td>
        <td style="padding: 9px 12px; text-align: right; color: #c2410c; border-bottom: none;">${totalForfait.toLocaleString()}</td>
        <td style="padding: 9px 12px; text-align: right; color: #b91c1c; border-bottom: none;">${totalResigned.toLocaleString()}</td>
        <td style="padding: 9px 12px; text-align: right; color: #101828; border-bottom: none;">${totalPct.toFixed(0)}%</td>
      </tr>
    `;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${titleStr}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap');
            @page {
              size: landscape;
              margin: 10mm 12mm;
            }
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              color: #101828;
              margin: 0;
              font-size: 9px;
              line-height: 1.4;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #F2F4F7;
              padding-bottom: 10px;
              margin-bottom: 12px;
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
              margin: 0;
            }
            .company-name {
              font-size: 8.5px;
              font-weight: 700;
              color: #667085;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-top: 1px;
            }
            .title-section {
              text-align: right;
            }
            .title {
              font-size: 16px;
              font-weight: 900;
              color: #101828;
              margin: 0;
            }
            .subtitle {
              font-size: 9.5px;
              color: #667085;
              margin: 3px 0 0 0;
              font-weight: 500;
            }
            .meta-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 10px;
              margin-bottom: 15px;
              background: #F9FAFB;
              border: 1px solid #E4E7EC;
              border-radius: 8px;
              padding: 8px 12px;
            }
            .meta-item {
              display: flex;
              flex-direction: column;
            }
            .meta-label {
              font-size: 8px;
              text-transform: uppercase;
              color: #667085;
              font-weight: 700;
              letter-spacing: 0.5px;
              margin-bottom: 2px;
            }
            .meta-value {
              font-size: 10px;
              font-weight: 700;
              color: #101828;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 15px;
              text-align: left;
            }
            th {
              background: #F9FAFB;
              color: #475467;
              font-size: 8px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              padding: 7px 12px;
              border-bottom: 1px solid #F2F4F7;
            }
            td {
              border-bottom: 1px solid #F2F4F7;
              padding: 5px 12px;
              font-size: 9px;
            }
            .footer-info {
              display: flex;
              justify-content: space-between;
              align-items: center;
              color: #667085;
              font-size: 8px;
              border-top: 1px solid #F2F4F7;
              padding-top: 10px;
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo-section">
              <img src="${window.location.origin}/ade.png" alt="ADE Logo" style="height: 40px; width: auto;" />
              <div>
                <h1 class="logo-text">EPEOR ANALYTICS</h1>
                <div class="company-name">Algérienne des Eaux</div>
              </div>
            </div>
            <div class="title-section">
              <h2 class="title">${titleStr}</h2>
              <p class="subtitle">Gestion Abonnés</p>
            </div>
          </div>

          <div class="meta-grid">
            <div class="meta-item">
              <span class="meta-label">Périmètre</span>
              <span class="meta-value">${escapeHtml(subTitleStr)}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Date d'édition</span>
              <span class="meta-value">${printDate}</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Commune</th>
                <th style="text-align: right;">Total Abonnés</th>
                <th style="text-align: right;">Abonnés Actifs</th>
                <th style="text-align: right; color: #c2410c;">Forfait</th>
                <th style="text-align: right;">Abonnés Résiliés</th>
                <th style="text-align: right; width: 80px;">Part (%)</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
          </table>

          <div class="footer-info">
            <span>EPEOR Analytics - Gestion Abonnés</span>
            <span>Page 1 sur 1</span>
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handlePrintTypes = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Veuillez autoriser les fenêtres pop-up pour pouvoir imprimer.");
      return;
    }

    const titleStr = "Répartition Détaillée des Abonnés par Type d'Abonné";
    const subTitleStr = secteurLabel
      ? "Centre : " + secteurLabel
      : "Toute l'unité";
    const printDate = new Date().toLocaleDateString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });

    let tableRowsHtml = "";
    types.forEach((t: any) => {
      const actifs = t.value - (t.resigned || 0);
      tableRowsHtml += `
        <tr>
          <td style="padding: 6px 12px; font-weight: bold;">${escapeHtml(t.name)}</td>
          <td style="padding: 6px 12px; text-align: right; font-weight: bold; color: #0D83DE;">${t.value.toLocaleString()}</td>
          <td style="padding: 6px 12px; text-align: right; color: #059669;">${actifs.toLocaleString()}</td>
          <td style="padding: 6px 12px; text-align: right; color: #e11d48;">${t.resigned?.toLocaleString() || 0}</td>
          <td style="padding: 6px 12px; text-align: right; font-weight: bold;">${t.percentage}%</td>
        </tr>
      `;
    });

    const totalVal = types.reduce((acc: number, curr: any) => acc + curr.value, 0);
    const totalResigned = types.reduce((acc: number, curr: any) => acc + (curr.resigned || 0), 0);
    const totalActifs = totalVal - totalResigned;
    const totalPct = types.reduce((acc: number, curr: any) => acc + (curr.percentage || 0), 0);

    tableRowsHtml += `
      <tr style="background: #f1f5f9; color: #101828; font-weight: bold; font-size: 9.5px; border-top: 1px solid #94a3b8; border-bottom: 1px solid #94a3b8;">
        <td style="padding: 9px 12px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: none; color: #101828;">Total Général</td>
        <td style="padding: 9px 12px; text-align: right; color: #1d4ed8; border-bottom: none;">${totalVal.toLocaleString()}</td>
        <td style="padding: 9px 12px; text-align: right; color: #047857; border-bottom: none;">${totalActifs.toLocaleString()}</td>
        <td style="padding: 9px 12px; text-align: right; color: #b91c1c; border-bottom: none;">${totalResigned.toLocaleString()}</td>
        <td style="padding: 9px 12px; text-align: right; color: #101828; border-bottom: none;">${totalPct.toFixed(0)}%</td>
      </tr>
    `;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${titleStr}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap');
            @page {
              size: landscape;
              margin: 10mm 12mm;
            }
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              color: #101828;
              margin: 0;
              font-size: 9px;
              line-height: 1.4;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #F2F4F7;
              padding-bottom: 10px;
              margin-bottom: 12px;
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
              margin: 0;
            }
            .company-name {
              font-size: 8.5px;
              font-weight: 700;
              color: #667085;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-top: 1px;
            }
            .title-section {
              text-align: right;
            }
            .title {
              font-size: 16px;
              font-weight: 900;
              color: #101828;
              margin: 0;
            }
            .subtitle {
              font-size: 9.5px;
              color: #667085;
              margin: 3px 0 0 0;
              font-weight: 500;
            }
            .meta-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 10px;
              margin-bottom: 15px;
              background: #F9FAFB;
              border: 1px solid #E4E7EC;
              border-radius: 8px;
              padding: 8px 12px;
            }
            .meta-item {
              display: flex;
              flex-direction: column;
            }
            .meta-label {
              font-size: 8px;
              text-transform: uppercase;
              color: #667085;
              font-weight: 700;
              letter-spacing: 0.5px;
              margin-bottom: 2px;
            }
            .meta-value {
              font-size: 10px;
              font-weight: 700;
              color: #101828;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 15px;
              text-align: left;
            }
            th {
              background: #F9FAFB;
              color: #475467;
              font-size: 8px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              padding: 7px 12px;
              border-bottom: 1px solid #F2F4F7;
            }
            td {
              border-bottom: 1px solid #F2F4F7;
              padding: 5px 12px;
              font-size: 9px;
            }
            .footer-info {
              display: flex;
              justify-content: space-between;
              align-items: center;
              color: #667085;
              font-size: 8px;
              border-top: 1px solid #F2F4F7;
              padding-top: 10px;
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo-section">
              <img src="${window.location.origin}/ade.png" alt="ADE Logo" style="height: 40px; width: auto;" />
              <div>
                <h1 class="logo-text">EPEOR ANALYTICS</h1>
                <div class="company-name">Algérienne des Eaux</div>
              </div>
            </div>
            <div class="title-section">
              <h2 class="title">${titleStr}</h2>
              <p class="subtitle">Gestion Abonnés</p>
            </div>
          </div>

          <div class="meta-grid">
            <div class="meta-item">
              <span class="meta-label">Périmètre</span>
              <span class="meta-value">${subTitleStr}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Date d'édition</span>
              <span class="meta-value">${printDate}</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Catégorie / Type</th>
                <th style="text-align: right;">Total Abonnés</th>
                <th style="text-align: right;">Abonnés Actifs</th>
                <th style="text-align: right;">Abonnés Résiliés</th>
                <th style="text-align: right; width: 80px;">Part (%)</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
          </table>

          <div class="footer-info">
            <span>EPEOR Analytics - Gestion Abonnés</span>
            <span>Page 1 sur 1</span>
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  if (selectedQuartier) {
    return (
      <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] overflow-hidden">
        {!viewingInvoices && (
          <div className="p-8 border-b border-[#F2F4F7] flex flex-col md:flex-row md:justify-between md:items-center gap-4">
            <div>
              <button
                onClick={() => setSelectedQuartier(null)}
                className="flex items-center gap-2 text-sm font-bold text-[#667085] hover:text-[#101828] mb-4 transition-colors"
              >
                <ChevronRight className="rotate-180" size={16} /> Retour aux quartiers
              </button>
              <h3 className="text-2xl font-black tracking-tight text-[#101828]">
                {selectedType ? `${selectedType.name} — ` : ''}Tous les Abonnés - {selectedQuartier.name}
              </h3>
              <p className="text-sm text-[#667085] mt-1">
                {selectedType
                  ? `Liste nominative des abonnés de type « ${selectedType.name} » dans ce quartier`
                  : 'Liste nominative de tous les abonnés du quartier'}
              </p>
            </div>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#0D83DE] hover:bg-[#0B74C9] active:scale-95 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-blue-600/10 border border-blue-500/10 self-start md:self-auto"
              title="Imprimer la liste des abonnés du quartier"
            >
              <Printer size={13} />
              <span>Imprimer</span>
            </button>
          </div>
        )}
        <NominativeTable subscribers={quartierSubscribers} loading={loadingSubscribers} accentColor="blue" selectedNumabs={selectedNumabs} onSelectedNumabsChange={setSelectedNumabs} printedSubscribersRef={printedSubscribersRef} onInvoiceViewChange={setViewingInvoices} />
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
              <ChevronRight className="rotate-180" size={16} />
              {selectedType ? 'Retour aux communes du type' : 'Retour aux communes'}
            </button>
            <h3 className="text-2xl font-black tracking-tight text-[#101828]">
              {selectedType ? `Quartiers de ${selectedCommune.name} — ${selectedType.name}` : `Quartiers de ${selectedCommune.name}`}
            </h3>
            <p className="text-sm text-[#667085] mt-1">
              {selectedType
                ? `Détail des abonnés « ${selectedType.name} » pour chaque quartier de cette commune`
                : 'Détail des abonnés pour chaque quartier de cette commune'}
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#F9FAFB] text-[#475467] text-[11px] uppercase tracking-wider font-bold">
                <th className="px-8 py-5">Quartier</th>
                <th className="px-6 py-5 text-right">Total Abonnés</th>
                <th className="px-6 py-5 text-right">Abonnés Actifs</th>
                <th className="px-6 py-5 text-right text-orange-500">Forfait</th>
                <th className="px-6 py-5 text-right">Abonnés Résiliés</th>
                <th className="px-8 py-5 text-right">Part (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2F4F7]">
              {quartiers.length > 0 ? quartiers.map((q: any, i: number) => {
                const actifs = q.value - (q.resigned || 0);
                const forfait = q.forfait_count ?? 0;
                return (
                  <tr
                    key={i}
                    onClick={() => handleQuartierClick(q)}
                    className="hover:bg-[#F9FAFB] transition-colors group cursor-pointer"
                  >
                    <td className="px-8 py-5 font-black text-sm text-[#101828]">{q.name}</td>
                    <td className="px-6 py-5 text-right font-bold text-[#0D83DE]">{q.value.toLocaleString()}</td>
                    <td className="px-6 py-5 text-right font-medium text-emerald-600">{actifs.toLocaleString()}</td>
                    <td className="px-6 py-5 text-right font-medium text-orange-600">{forfait.toLocaleString()}</td>
                    <td className="px-6 py-5 text-right font-medium text-rose-600">{q.resigned?.toLocaleString() || 0}</td>
                    <td className="px-8 py-5 text-right font-bold text-[#475467]">{q.percentage}%</td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={6} className="px-8 py-8 text-center text-[#667085] font-medium">Aucun abonné trouvé dans cette commune.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (selectedType) {
    const typeCommunes = selectedType.communes || [];
    return (
      <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] overflow-hidden">
        <div className="p-8 border-b border-[#F2F4F7] flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <button
              onClick={() => setSelectedType(null)}
              className="flex items-center gap-2 text-sm font-bold text-[#667085] hover:text-[#101828] mb-4 transition-colors"
            >
              <ChevronRight className="rotate-180" size={16} /> Retour aux types
            </button>
            <h3 className="text-2xl font-black tracking-tight text-[#101828]">Communes — {selectedType.name}</h3>
            <p className="text-sm text-[#667085] mt-1">Répartition géographique des abonnés de ce type par commune</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#F9FAFB] text-[#475467] text-[11px] uppercase tracking-wider font-bold">
                <th className="px-8 py-5">Commune</th>
                <th className="px-6 py-5 text-right">Total Abonnés</th>
                <th className="px-6 py-5 text-right">Abonnés Actifs</th>
                <th className="px-6 py-5 text-right text-orange-500">Forfait</th>
                <th className="px-6 py-5 text-right">Abonnés Résiliés</th>
                <th className="px-8 py-5 text-right">Part (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2F4F7]">
              {typeCommunes.length > 0 ? typeCommunes.map((c: any, i: number) => {
                const actifs = c.value - (c.resigned || 0);
                const forfait = c.forfait_count ?? 0;
                return (
                  <tr
                    key={i}
                    onClick={() => setSelectedCommune(c)}
                    className="hover:bg-[#F9FAFB] transition-colors group cursor-pointer"
                  >
                    <td className="px-8 py-5 font-black text-sm text-[#101828]">{c.name}</td>
                    <td className="px-6 py-5 text-right font-bold text-[#0D83DE]">{c.value.toLocaleString()}</td>
                    <td className="px-6 py-5 text-right font-medium text-emerald-600">{actifs.toLocaleString()}</td>
                    <td className="px-6 py-5 text-right font-medium text-orange-600">{forfait.toLocaleString()}</td>
                    <td className="px-6 py-5 text-right font-medium text-rose-600">{c.resigned?.toLocaleString() || 0}</td>
                    <td className="px-8 py-5 text-right font-bold text-[#475467]">{c.percentage}%</td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={6} className="px-8 py-8 text-center text-[#667085] font-medium">Aucune commune trouvée pour ce type d'abonné.</td>
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
        <div className="p-8 border-b border-[#F2F4F7] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-2xl font-black tracking-tight text-[#101828]">Répartition Détaillée des Abonnés par Commune</h3>
            <p className="text-sm text-[#667085] mt-1 font-medium">Analyse complète des abonnés par zone géographique</p>
          </div>
          <button
            onClick={handlePrintCommunes}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 active:scale-95 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-brand-600/10 border border-brand-500/10 self-start sm:self-auto"
            title="Imprimer la répartition des abonnés par commune"
          >
            <Printer size={13} />
            <span>Imprimer</span>
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#F9FAFB] text-[#475467] text-[11px] uppercase tracking-wider font-bold">
                <th className="px-8 py-5">Commune</th>
                <th className="px-6 py-5 text-right">Total Abonnés</th>
                <th className="px-6 py-5 text-right">Abonnés Actifs</th>
                <th className="px-6 py-5 text-right text-orange-500">Forfait</th>
                <th className="px-6 py-5 text-right">Abonnés Résiliés</th>
                <th className="px-8 py-5 text-right">Part (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2F4F7]">
              {communes.map((c: any, i: number) => {
                const actifs = c.value - (c.resigned || 0);
                const forfait = c.forfait_count ?? 0;
                return (
                  <tr
                    key={i}
                    onClick={() => { setSelectedCommune(c); setSelectedType(null); setSelectedQuartier(null); }}
                    className="hover:bg-[#F9FAFB] transition-colors group cursor-pointer"
                  >
                    <td className="px-8 py-5 font-black text-sm text-[#101828]">{c.name}</td>
                    <td className="px-6 py-5 text-right font-bold text-[#0D83DE]">{c.value.toLocaleString()}</td>
                    <td className="px-6 py-5 text-right font-medium text-emerald-600">{actifs.toLocaleString()}</td>
                    <td className="px-6 py-5 text-right font-medium text-orange-600">{forfait.toLocaleString()}</td>
                    <td className="px-6 py-5 text-right font-medium text-rose-600">{c.resigned?.toLocaleString() || 0}</td>
                    <td className="px-8 py-5 text-right font-bold text-[#475467]">{c.percentage}%</td>
                  </tr>
                );
              })}

              {/* Totals row */}
              {communes && communes.length > 0 && (() => {
                const totals = communes.reduce((acc: any, c: any) => {
                  acc.total += (c.value || 0);
                  acc.resigned += (c.resigned || 0);
                  acc.forfait += (c.forfait_count || 0);
                  return acc;
                }, { total: 0, resigned: 0, forfait: 0 });
                const actifsTotal = totals.total - (typeof stats?.resigned_subscribers === 'number' ? stats.resigned_subscribers : totals.resigned);
                const forfaitTotal = typeof stats?.forfait_subscribers === 'number'
                  ? stats.forfait_subscribers
                  : totals.forfait;
                const resignedTotal = typeof stats?.resigned_subscribers === 'number' ? stats.resigned_subscribers : totals.resigned;
                return (
                  <tr className="bg-[#F9FAFB] font-bold">
                    <td className="px-8 py-5 text-sm text-[#101828]">Totaux</td>
                    <td className="px-6 py-5 text-right text-[#0D83DE]">{totals.total.toLocaleString()}</td>
                    <td className="px-6 py-5 text-right text-emerald-600">{actifsTotal.toLocaleString()}</td>
                    <td className="px-6 py-5 text-right text-orange-600">{forfaitTotal.toLocaleString()}</td>
                    <td className="px-6 py-5 text-right text-rose-600">{resignedTotal.toLocaleString()}</td>
                    <td className="px-8 py-5 text-right text-[#475467]">100%</td>
                  </tr>
                );
              })()}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] overflow-hidden">
        <div className="p-8 border-b border-[#F2F4F7] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-2xl font-black tracking-tight text-[#101828]">Répartition Détaillée des Abonnés par Type d'Abonné</h3>
            <p className="text-sm text-[#667085] mt-1 font-medium">Analyse des abonnés classés par catégorie (Ménage, Administration, etc.)</p>
          </div>
          <button
            onClick={handlePrintTypes}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 active:scale-95 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-brand-600/10 border border-brand-500/10 self-start sm:self-auto"
            title="Imprimer la répartition des abonnés par type d'abonné"
          >
            <Printer size={13} />
            <span>Imprimer</span>
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#F9FAFB] text-[#475467] text-[11px] uppercase tracking-wider font-bold">
                <th className="px-8 py-5">Catégorie / Type</th>
                <th className="px-6 py-5 text-right">Total Abonnés</th>
                <th className="px-6 py-5 text-right">Abonnés Actifs</th>
                <th className="px-6 py-5 text-right text-orange-500">Forfait</th>
                <th className="px-6 py-5 text-right">Abonnés Résiliés</th>
                <th className="px-8 py-5 text-right">Part (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2F4F7]">
              {types.map((t: any, i: number) => {
                const actifs = t.value - (t.resigned || 0);
                const forfait = t.forfait_count ?? 0;
                return (
                  <tr
                    key={i}
                    onClick={() => { setSelectedType(t); setSelectedCommune(null); setSelectedQuartier(null); }}
                    className="hover:bg-[#F9FAFB] transition-colors group cursor-pointer"
                  >
                    <td className="px-8 py-5 font-black text-sm text-[#101828]">{t.name}</td>
                    <td className="px-6 py-5 text-right font-bold text-[#0D83DE]">{t.value.toLocaleString()}</td>
                    <td className="px-6 py-5 text-right font-medium text-emerald-600">{actifs.toLocaleString()}</td>
                    <td className="px-6 py-5 text-right font-medium text-orange-600">{forfait.toLocaleString()}</td>
                    <td className="px-6 py-5 text-right font-medium text-rose-600">{t.resigned?.toLocaleString() || 0}</td>
                    <td className="px-8 py-5 text-right font-bold text-[#475467]">{t.percentage}%</td>
                  </tr>
                );
              })}

              {/* Totals row for types */}
              {types && types.length > 0 && (() => {
                const totals = types.reduce((acc: any, t: any) => {
                  acc.total += (t.value || 0);
                  acc.resigned += (t.resigned || 0);
                  acc.forfait += (t.forfait_count || 0);
                  return acc;
                }, { total: 0, resigned: 0, forfait: 0 });
                const actifsTotal = totals.total - (typeof stats?.resigned_subscribers === 'number' ? stats.resigned_subscribers : totals.resigned);
                const forfaitTotal = typeof stats?.forfait_subscribers === 'number'
                  ? stats.forfait_subscribers
                  : totals.forfait;
                const resignedTotal = typeof stats?.resigned_subscribers === 'number' ? stats.resigned_subscribers : totals.resigned;
                return (
                  <tr className="bg-[#F9FAFB] font-bold">
                    <td className="px-8 py-5 text-sm text-[#101828]">Totaux</td>
                    <td className="px-6 py-5 text-right text-[#0D83DE]">{totals.total.toLocaleString()}</td>
                    <td className="px-6 py-5 text-right text-emerald-600">{actifsTotal.toLocaleString()}</td>
                    <td className="px-6 py-5 text-right text-orange-600">{forfaitTotal.toLocaleString()}</td>
                    <td className="px-6 py-5 text-right text-rose-600">{resignedTotal.toLocaleString()}</td>
                    <td className="px-8 py-5 text-right text-[#475467]">100%</td>
                  </tr>
                );
              })()}
            </tbody>
          </table>
        </div>
      </div>

      <DistributionCharts
        charts={[
          {
            title: "Abonnés par commune",
            description: "Nombre total d'abonnés dans chaque commune",
            emptyMessage: "Aucune donnée disponible par commune.",
            color: '#2563EB',
            data: communes.map((commune: any) => ({
              name: String(commune.name ?? 'Commune inconnue'),
              count: Number(commune.value) || 0,
            })),
          },
          {
            title: "Abonnés par catégorie",
            description: "Répartition des abonnés selon leur catégorie",
            emptyMessage: "Aucune donnée disponible par catégorie.",
            color: '#2563EB',
            data: categoryChartData.map((category) => ({
              name: category.name,
              count: category.total,
            })),
          },
        ]}
      />
    </div>
  );
}

function ResignedDetailView({ stats, onBack, selectedSecteur = '', secteurLabel }: any) {
  const [selectedCommune, setSelectedCommune] = useState<any>(null);
  const [selectedQuartier, setSelectedQuartier] = useState<any>(null);
  const [selectedType, setSelectedType] = useState<any>(null);
  const [quartierSubscribers, setQuartierSubscribers] = useState<any[]>([]);
  const [typeSubscribers, setTypeSubscribers] = useState<any[]>([]);
  const [typeSubscribersError, setTypeSubscribersError] = useState<string | null>(null);
  const [loadingSubscribers, setLoadingSubscribers] = useState(false);
  const [selectedNumabs, setSelectedNumabs] = useState<string[]>([]);
  const printedSubscribersRef = useRef<any[]>([]);

  const handleTypeClick = async (type: any) => {
    setSelectedType(type);
    setTypeSubscribers([]);
    setTypeSubscribersError(null);
    setSelectedNumabs([]);
    setLoadingSubscribers(true);
    try {
      const response = await fetch(buildSubscribersUrl(undefined, {
        etat: '40',
        secteur: selectedSecteur,
        typabon: type.code,
      }));
      if (!response.ok) {
        throw new Error(`Erreur HTTP ${response.status}`);
      }
      const data = await response.json();
      if (!Array.isArray(data)) {
        throw new Error(data?.error || 'Réponse invalide du serveur');
      }
      setTypeSubscribers(data);
    } catch (error) {
      console.error('Erreur lors du chargement des abonnés résiliés par type :', error);
      setTypeSubscribersError('Impossible de charger la liste des abonnés pour ce type. Réessayez.');
    } finally {
      setLoadingSubscribers(false);
    }
  };

  const handleQuartierClick = async (q: any) => {
    setSelectedQuartier(q);
    setSelectedNumabs([]);
    setLoadingSubscribers(true);
    try {
      const res = await fetch(buildSubscribersUrl(q.id, { etat: '40', secteur: selectedSecteur }));
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

    const currentSubscribers = printedSubscribersRef.current && printedSubscribersRef.current.length > 0
      ? printedSubscribersRef.current
      : quartierSubscribers;

    const toprint = selectedNumabs.length > 0
      ? currentSubscribers.filter((sub: any) => selectedNumabs.includes(sub.numab))
      : currentSubscribers;

    if (toprint.length === 0) {
      alert('Aucun abonné à imprimer. Veuillez sélectionner au moins un abonné.');
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Veuillez autoriser les fenêtres pop-up pour pouvoir imprimer.");
      return;
    }

    const selectionNote = selectedNumabs.length > 0 ? `Sélection de ${selectedNumabs.length} abonné(s)` : `Total : ${toprint.length} abonné(s)`;

    const rowsHtml = toprint.map((sub: any) => `
      <tr>
        <td class="font-bold-black">${sub.numab || '—'}</td>
        <td class="font-bold-black">${sub.name || '—'}</td>
        <td>${[sub.adresse, sub.bloc ? `Bl. ${sub.bloc}` : '', sub.ndom ? `N°${sub.ndom}` : ''].filter(Boolean).join(' · ') || '—'}</td>
        <td class="tournee-badge">${sub.tournee ? `T-${sub.tournee}` : '—'}</td>
        <td>${sub.numser || '—'}</td>
        <td style="font-weight: 700; text-align: right; color: #101828;">${sub.nouvelx !== undefined ? sub.nouvelx.toLocaleString() : '—'}</td>
        <td>${sub.type || '—'}</td>
      </tr>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Liste nominative des abonnés résiliés - ${selectedQuartier.name}</title>
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
              <h1 class="title">Abonnés Résiliés (Code 40)</h1>
              <p class="subtitle">Liste nominative des compteurs résiliés</p>
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
              <span class="meta-label">Abonnés à imprimer</span>
              <span class="meta-value">${selectionNote}</span>
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
                <th style="width: 12%">Type</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
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
      </html>`;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Sort by resigned descending
  const communes = [...(stats?.subscriber_communes || [])].sort((a, b) => (b.resigned || 0) - (a.resigned || 0));
  const types = [...(stats?.subscriber_types || [])].sort((a, b) => (b.resigned || 0) - (a.resigned || 0));
  const resignedCommuneChartData = communes.map((commune: any) => ({
    name: String(commune.name ?? 'Commune inconnue'),
    count: Number(commune.resigned) || 0,
  }));
  const resignedTypeChartData = types.map((type: any) => ({
    name: String(type.name ?? "Type d'abonné inconnu"),
    count: Number(type.resigned) || 0,
  }));

  const handlePrintCommunes = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Veuillez autoriser les fenêtres pop-up pour pouvoir imprimer.");
      return;
    }

    const titleStr = "Répartition Détaillée des Abonnés Résiliés par Commune";
    const subTitleStr = secteurLabel ? "Centre : " + secteurLabel : "Toute l'unité";
    const printDate = new Date().toLocaleDateString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    let tableRowsHtml = "";
    communes.forEach((c: any) => {
      const taux = c.value > 0 ? ((c.resigned || 0) / c.value) * 100 : 0;
      tableRowsHtml += `
        <tr>
          <td style="padding: 6px 12px; font-weight: bold;">${c.name}</td>
          <td style="padding: 6px 12px; text-align: right; font-weight: bold; color: #e11d48;">${(c.resigned || 0).toLocaleString()}</td>
          <td style="padding: 6px 12px; text-align: right; color: #475467;">${c.value.toLocaleString()}</td>
          <td style="padding: 6px 12px; text-align: right; font-weight: bold;">${taux.toFixed(2)}%</td>
        </tr>
      `;
    });

    const totalResigned = communes.reduce((acc: number, curr: any) => acc + (curr.resigned || 0), 0);
    const totalVal = communes.reduce((acc: number, curr: any) => acc + curr.value, 0);
    const totalTaux = totalVal > 0 ? (totalResigned / totalVal) * 100 : 0;

    tableRowsHtml += `
      <tr style="background: #f1f5f9; color: #101828; font-weight: bold; font-size: 9.5px; border-top: 1px solid #94a3b8; border-bottom: 1px solid #94a3b8;">
        <td style="padding: 9px 12px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: none; color: #101828;">Total Général</td>
        <td style="padding: 9px 12px; text-align: right; color: #b91c1c; border-bottom: none;">${totalResigned.toLocaleString()}</td>
        <td style="padding: 9px 12px; text-align: right; color: #101828; border-bottom: none;">${totalVal.toLocaleString()}</td>
        <td style="padding: 9px 12px; text-align: right; color: #101828; border-bottom: none;">${totalTaux.toFixed(2)}%</td>
      </tr>
    `;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${titleStr}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap');
            @page {
              size: landscape;
              margin: 10mm 12mm;
            }
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              color: #101828;
              margin: 0;
              font-size: 9px;
              line-height: 1.4;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #F2F4F7;
              padding-bottom: 10px;
              margin-bottom: 12px;
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
              margin: 0;
            }
            .company-name {
              font-size: 8.5px;
              font-weight: 700;
              color: #667085;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-top: 1px;
            }
            .title-section {
              text-align: right;
            }
            .title {
              font-size: 16px;
              font-weight: 900;
              color: #101828;
              margin: 0;
            }
            .subtitle {
              font-size: 9.5px;
              color: #667085;
              margin: 3px 0 0 0;
              font-weight: 500;
            }
            .meta-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 10px;
              margin-bottom: 15px;
              background: #F9FAFB;
              border: 1px solid #E4E7EC;
              border-radius: 8px;
              padding: 8px 12px;
            }
            .meta-item {
              display: flex;
              flex-direction: column;
            }
            .meta-label {
              font-size: 8px;
              text-transform: uppercase;
              color: #667085;
              font-weight: 700;
              letter-spacing: 0.5px;
              margin-bottom: 2px;
            }
            .meta-value {
              font-size: 10px;
              font-weight: 700;
              color: #101828;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 15px;
              text-align: left;
            }
            th {
              background: #F9FAFB;
              color: #475467;
              font-size: 8px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              padding: 7px 12px;
              border-bottom: 1px solid #F2F4F7;
            }
            td {
              border-bottom: 1px solid #F2F4F7;
              padding: 5px 12px;
              font-size: 9px;
            }
            .footer-info {
              display: flex;
              justify-content: space-between;
              align-items: center;
              color: #667085;
              font-size: 8px;
              border-top: 1px solid #F2F4F7;
              padding-top: 10px;
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo-section">
              <img src="${window.location.origin}/ade.png" alt="ADE Logo" style="height: 40px; width: auto;" />
              <div>
                <h1 class="logo-text">EPEOR ANALYTICS</h1>
                <div class="company-name">Algérienne des Eaux</div>
              </div>
            </div>
            <div class="title-section">
              <h2 class="title">${titleStr}</h2>
              <p class="subtitle">Gestion Abonnés - Résiliés</p>
            </div>
          </div>

          <div class="meta-grid">
            <div class="meta-item">
              <span class="meta-label">Périmètre</span>
              <span class="meta-value">${subTitleStr}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Date d'édition</span>
              <span class="meta-value">${printDate}</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Commune</th>
                <th style="text-align: right;">Abonnés Résiliés</th>
                <th style="text-align: right;">Total Abonnés</th>
                <th style="text-align: right; width: 140px;">Taux de Résiliation (%)</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
          </table>

          <div class="footer-info">
            <span>EPEOR Analytics - Gestion Abonnés (Résiliés)</span>
            <span>Page 1 sur 1</span>
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handlePrintTypes = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Veuillez autoriser les fenêtres pop-up pour pouvoir imprimer.");
      return;
    }

    const titleStr = "Répartition Détaillée des Abonnés Résiliés par Type d'Abonné";
    const subTitleStr = secteurLabel ? "Centre : " + secteurLabel : "Toute l'unité";
    const printDate = new Date().toLocaleDateString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    let tableRowsHtml = "";
    types.forEach((t: any) => {
      const taux = t.value > 0 ? ((t.resigned || 0) / t.value) * 100 : 0;
      tableRowsHtml += `
        <tr>
          <td style="padding: 6px 12px; font-weight: bold;">${t.name}</td>
          <td style="padding: 6px 12px; text-align: right; font-weight: bold; color: #e11d48;">${(t.resigned || 0).toLocaleString()}</td>
          <td style="padding: 6px 12px; text-align: right; color: #475467;">${t.value.toLocaleString()}</td>
          <td style="padding: 6px 12px; text-align: right; font-weight: bold;">${taux.toFixed(2)}%</td>
        </tr>
      `;
    });

    const totalResigned = types.reduce((acc: number, curr: any) => acc + (curr.resigned || 0), 0);
    const totalVal = types.reduce((acc: number, curr: any) => acc + curr.value, 0);
    const totalTaux = totalVal > 0 ? (totalResigned / totalVal) * 100 : 0;

    tableRowsHtml += `
      <tr style="background: #f1f5f9; color: #101828; font-weight: bold; font-size: 9.5px; border-top: 1px solid #94a3b8; border-bottom: 1px solid #94a3b8;">
        <td style="padding: 9px 12px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: none; color: #101828;">Total Général</td>
        <td style="padding: 9px 12px; text-align: right; color: #b91c1c; border-bottom: none;">${totalResigned.toLocaleString()}</td>
        <td style="padding: 9px 12px; text-align: right; color: #101828; border-bottom: none;">${totalVal.toLocaleString()}</td>
        <td style="padding: 9px 12px; text-align: right; color: #101828; border-bottom: none;">${totalTaux.toFixed(2)}%</td>
      </tr>
    `;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${titleStr}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap');
            @page {
              size: landscape;
              margin: 10mm 12mm;
            }
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              color: #101828;
              margin: 0;
              font-size: 9px;
              line-height: 1.4;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #F2F4F7;
              padding-bottom: 10px;
              margin-bottom: 12px;
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
              margin: 0;
            }
            .company-name {
              font-size: 8.5px;
              font-weight: 700;
              color: #667085;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-top: 1px;
            }
            .title-section {
              text-align: right;
            }
            .title {
              font-size: 16px;
              font-weight: 900;
              color: #101828;
              margin: 0;
            }
            .subtitle {
              font-size: 9.5px;
              color: #667085;
              margin: 3px 0 0 0;
              font-weight: 500;
            }
            .meta-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 10px;
              margin-bottom: 15px;
              background: #F9FAFB;
              border: 1px solid #E4E7EC;
              border-radius: 8px;
              padding: 8px 12px;
            }
            .meta-item {
              display: flex;
              flex-direction: column;
            }
            .meta-label {
              font-size: 8px;
              text-transform: uppercase;
              color: #667085;
              font-weight: 700;
              letter-spacing: 0.5px;
              margin-bottom: 2px;
            }
            .meta-value {
              font-size: 10px;
              font-weight: 700;
              color: #101828;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 15px;
              text-align: left;
            }
            th {
              background: #F9FAFB;
              color: #475467;
              font-size: 8px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              padding: 7px 12px;
              border-bottom: 1px solid #F2F4F7;
            }
            td {
              border-bottom: 1px solid #F2F4F7;
              padding: 5px 12px;
              font-size: 9px;
            }
            .footer-info {
              display: flex;
              justify-content: space-between;
              align-items: center;
              color: #667085;
              font-size: 8px;
              border-top: 1px solid #F2F4F7;
              padding-top: 10px;
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo-section">
              <img src="${window.location.origin}/ade.png" alt="ADE Logo" style="height: 40px; width: auto;" />
              <div>
                <h1 class="logo-text">EPEOR ANALYTICS</h1>
                <div class="company-name">Algérienne des Eaux</div>
              </div>
            </div>
            <div class="title-section">
              <h2 class="title">${titleStr}</h2>
              <p class="subtitle">Gestion Abonnés - Résiliés</p>
            </div>
          </div>

          <div class="meta-grid">
            <div class="meta-item">
              <span class="meta-label">Périmètre</span>
              <span class="meta-value">${subTitleStr}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Date d'édition</span>
              <span class="meta-value">${printDate}</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Catégorie / Type</th>
                <th style="text-align: right;">Abonnés Résiliés</th>
                <th style="text-align: right;">Total Abonnés</th>
                <th style="text-align: right; width: 140px;">Taux de Résiliation (%)</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
          </table>

          <div class="footer-info">
            <span>EPEOR Analytics - Gestion Abonnés (Résiliés)</span>
            <span>Page 1 sur 1</span>
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  if (selectedType) {
    return (
      <div className="obat-card overflow-hidden">
        <div className="p-6 sm:p-8 border-b border-[#F2F4F7]">
          <button
            type="button"
            onClick={() => setSelectedType(null)}
            className="flex items-center gap-2 text-sm font-bold text-[#667085] hover:text-[#101828] mb-4 transition-colors"
          >
            <ChevronRight className="rotate-180" size={16} /> Retour à la répartition par type
          </button>
          <h3 className="text-2xl font-black tracking-tight text-[#101828]">
            Abonnés résiliés — {selectedType.name}
          </h3>
          <p className="text-sm text-[#667085] mt-1">
            Liste nominative des abonnés de ce type résiliés (Code 40)
            {secteurLabel ? ` · Centre ${secteurLabel}` : ''}
          </p>
        </div>
        {typeSubscribersError ? (
          <p role="alert" className="p-6 text-sm font-medium text-rose-700">
            {typeSubscribersError}
          </p>
        ) : !loadingSubscribers && typeSubscribers.length === 0 ? (
          <p className="p-6 text-sm font-medium text-[#667085]">
            Aucun abonné résilié trouvé pour ce type.
          </p>
        ) : (
          <NominativeTable
            subscribers={typeSubscribers}
            loading={loadingSubscribers}
            accentColor="rose"
            selectedNumabs={selectedNumabs}
            onSelectedNumabsChange={setSelectedNumabs}
            printedSubscribersRef={printedSubscribersRef}
          />
        )}
      </div>
    );
  }

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
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#E11D48] hover:bg-[#BE123C] active:scale-95 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-rose-600/10 border border-rose-500/10 self-start md:self-auto"
            title="Imprimer la liste des abonnés résiliés du quartier"
          >
            <Printer size={13} />
            <span>Imprimer</span>
          </button>
        </div>
        <NominativeTable subscribers={quartierSubscribers} loading={loadingSubscribers} accentColor="rose" selectedNumabs={selectedNumabs} onSelectedNumabsChange={setSelectedNumabs} printedSubscribersRef={printedSubscribersRef} />
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
          <button
            onClick={handlePrintCommunes}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#E11D48] hover:bg-[#BE123C] active:scale-95 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-rose-600/10 border border-rose-500/10 self-start md:self-auto"
            title="Imprimer la répartition des abonnés résiliés par commune"
          >
            <Printer size={13} />
            <span>Imprimer</span>
          </button>
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
        <div className="p-8 border-b border-[#F2F4F7] flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h3 className="text-2xl font-black tracking-tight text-[#101828]">Répartition des Abonnés Résiliés par Type d'Abonné</h3>
            <p className="text-sm text-[#667085] mt-1 font-medium">Analyse des résiliations classées par catégorie (Ménage, Administration, etc.)</p>
          </div>
          <button
            onClick={handlePrintTypes}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#E11D48] hover:bg-[#BE123C] active:scale-95 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-rose-600/10 border border-rose-500/10 self-start md:self-auto"
            title="Imprimer la répartition des abonnés résiliés par type d'abonné"
          >
            <Printer size={13} />
            <span>Imprimer</span>
          </button>
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
                  <tr
                    key={i}
                    onClick={() => handleTypeClick(t)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        void handleTypeClick(t);
                      }
                    }}
                    tabIndex={0}
                    className="hover:bg-[#F9FAFB] transition-colors group cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
                    aria-label={`Afficher les abonnés résiliés de type ${t.name}`}
                  >
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
      <DistributionCharts
        charts={[
          {
            title: "Abonnés résiliés par commune",
            description: "Comparaison du nombre d'abonnements résiliés",
            emptyMessage: "Aucune donnée de résiliation disponible par commune.",
            color: '#E11D48',
            data: resignedCommuneChartData,
          },
          {
            title: "Abonnés résiliés par type",
            description: "Comparaison du nombre d'abonnements résiliés",
            emptyMessage: "Aucune donnée de résiliation disponible par type d'abonné.",
            color: '#E11D48',
            data: resignedTypeChartData,
          },
        ]}
      />
    </div>
  );
}

function StoppedDetailView({ stats, onBack, selectedSecteur = '', secteurLabel }: any) {
  const [selectedCommune, setSelectedCommune] = useState<any>(null);
  const [selectedQuartier, setSelectedQuartier] = useState<any>(null);
  const [selectedType, setSelectedType] = useState<any>(null);
  const [quartierSubscribers, setQuartierSubscribers] = useState<any[]>([]);
  const [typeSubscribers, setTypeSubscribers] = useState<any[]>([]);
  const [typeSubscribersError, setTypeSubscribersError] = useState<string | null>(null);
  const [loadingSubscribers, setLoadingSubscribers] = useState(false);
  const [selectedNumabs, setSelectedNumabs] = useState<string[]>([]);
  // NEW: sorting and filtering state for the table
  const [, setSortKey] = useState<string>('numab');
  const [, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [, setFilterText] = useState<string>('');
  const printedSubscribersRef = useRef<any[]>([]);

  const handleTypeClick = async (type: any) => {
    setSelectedType(type);
    setTypeSubscribers([]);
    setTypeSubscribersError(null);
    setSelectedNumabs([]);
    setLoadingSubscribers(true);
    try {
      const response = await fetch(buildSubscribersUrl(undefined, {
        etat: '20',
        secteur: selectedSecteur,
        typabon: type.code,
      }));
      if (!response.ok) {
        throw new Error(`Erreur HTTP ${response.status}`);
      }
      const data = await response.json();
      if (!Array.isArray(data)) {
        throw new Error(data?.error || 'Réponse invalide du serveur');
      }
      setTypeSubscribers(data);
    } catch (error) {
      console.error('Erreur lors du chargement des abonnés à l’arrêt par type :', error);
      setTypeSubscribersError('Impossible de charger la liste des abonnés pour ce type. Réessayez.');
    } finally {
      setLoadingSubscribers(false);
    }
  };

  const handleQuartierClick = async (q: any) => {
    setSelectedQuartier(q);
    setSelectedNumabs([]);
    setSortKey('numab');
    setSortDir('asc');
    setFilterText('');
    setLoadingSubscribers(true);
    try {
      const res = await fetch(buildSubscribersUrl(q.id, { etat: '20', secteur: selectedSecteur }));
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

    const currentSubscribers = printedSubscribersRef.current && printedSubscribersRef.current.length > 0
      ? printedSubscribersRef.current
      : quartierSubscribers;

    const toprint = selectedNumabs.length > 0 
      ? currentSubscribers.filter(sub => selectedNumabs.includes(sub.numab))
      : currentSubscribers;

    if (toprint.length === 0) {
      alert('Aucun abonné à imprimer. Veuillez sélectionner au moins un abonné.');
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Veuillez autoriser les fenêtres pop-up pour pouvoir imprimer.");
      return;
    }

    const selectionNote = selectedNumabs.length > 0 ? `Sélection de ${selectedNumabs.length} abonné(s)` : `Total : ${toprint.length} abonné(s)`;

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
              <span class="meta-label">Abonnés à imprimer</span>
              <span class="meta-value">${selectionNote}</span>
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
              ${toprint.map(sub => `
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
  const stoppedCommuneChartData = communes
    .map((commune: any) => ({
      id: String(commune.id ?? ''),
      name: String(commune.name ?? 'Commune inconnue'),
      count: Number(commune.stopped) || 0,
    }))
    .filter((commune: { count: number }) => commune.count > 0);
  const stoppedTypeChartData = types
    .map((type: any) => ({
      code: String(type.code ?? ''),
      name: String(type.name ?? "Type d'abonné inconnu"),
      count: Number(type.stopped) || 0,
    }))
    .filter((type: { count: number }) => type.count > 0);

  const handlePrintCommunes = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Veuillez autoriser les fenêtres pop-up pour pouvoir imprimer.");
      return;
    }

    const titleStr = "Répartition Détaillée des Abonnés à l'Arrêt par Commune";
    const subTitleStr = secteurLabel ? "Centre : " + secteurLabel : "Toute l'unité";
    const printDate = new Date().toLocaleDateString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    let tableRowsHtml = "";
    communes.forEach((c: any) => {
      const taux = c.value > 0 ? ((c.stopped || 0) / c.value) * 100 : 0;
      tableRowsHtml += `
        <tr>
          <td style="padding: 6px 12px; font-weight: bold;">${c.name}</td>
          <td style="padding: 6px 12px; text-align: right; font-weight: bold; color: #D97706;">${(c.stopped || 0).toLocaleString()}</td>
          <td style="padding: 6px 12px; text-align: right; color: #475467;">${c.value.toLocaleString()}</td>
          <td style="padding: 6px 12px; text-align: right; font-weight: bold;">${taux.toFixed(2)}%</td>
        </tr>
      `;
    });

    const totalStopped = communes.reduce((acc: number, curr: any) => acc + (curr.stopped || 0), 0);
    const totalVal = communes.reduce((acc: number, curr: any) => acc + curr.value, 0);
    const totalTaux = totalVal > 0 ? (totalStopped / totalVal) * 100 : 0;

    tableRowsHtml += `
      <tr style="background: #f1f5f9; color: #101828; font-weight: bold; font-size: 9.5px; border-top: 1px solid #94a3b8; border-bottom: 1px solid #94a3b8;">
        <td style="padding: 9px 12px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: none; color: #101828;">Total Général</td>
        <td style="padding: 9px 12px; text-align: right; color: #b45309; border-bottom: none;">${totalStopped.toLocaleString()}</td>
        <td style="padding: 9px 12px; text-align: right; color: #101828; border-bottom: none;">${totalVal.toLocaleString()}</td>
        <td style="padding: 9px 12px; text-align: right; color: #101828; border-bottom: none;">${totalTaux.toFixed(2)}%</td>
      </tr>
    `;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${titleStr}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap');
            @page {
              size: landscape;
              margin: 10mm 12mm;
            }
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              color: #101828;
              margin: 0;
              font-size: 9px;
              line-height: 1.4;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #F2F4F7;
              padding-bottom: 10px;
              margin-bottom: 12px;
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
              margin: 0;
            }
            .company-name {
              font-size: 8.5px;
              font-weight: 700;
              color: #667085;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-top: 1px;
            }
            .title-section {
              text-align: right;
            }
            .title {
              font-size: 16px;
              font-weight: 900;
              color: #101828;
              margin: 0;
            }
            .subtitle {
              font-size: 9.5px;
              color: #667085;
              margin: 3px 0 0 0;
              font-weight: 500;
            }
            .meta-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 10px;
              margin-bottom: 15px;
              background: #F9FAFB;
              border: 1px solid #E4E7EC;
              border-radius: 8px;
              padding: 8px 12px;
            }
            .meta-item {
              display: flex;
              flex-direction: column;
            }
            .meta-label {
              font-size: 8px;
              text-transform: uppercase;
              color: #667085;
              font-weight: 700;
              letter-spacing: 0.5px;
              margin-bottom: 2px;
            }
            .meta-value {
              font-size: 10px;
              font-weight: 700;
              color: #101828;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 15px;
              text-align: left;
            }
            th {
              background: #F9FAFB;
              color: #475467;
              font-size: 8px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              padding: 7px 12px;
              border-bottom: 1px solid #F2F4F7;
            }
            td {
              border-bottom: 1px solid #F2F4F7;
              padding: 5px 12px;
              font-size: 9px;
            }
            .footer-info {
              display: flex;
              justify-content: space-between;
              align-items: center;
              color: #667085;
              font-size: 8px;
              border-top: 1px solid #F2F4F7;
              padding-top: 10px;
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo-section">
              <img src="${window.location.origin}/ade.png" alt="ADE Logo" style="height: 40px; width: auto;" />
              <div>
                <h1 class="logo-text">EPEOR ANALYTICS</h1>
                <div class="company-name">Algérienne des Eaux</div>
              </div>
            </div>
            <div class="title-section">
              <h2 class="title">${titleStr}</h2>
              <p class="subtitle">Gestion Abonnés - À l'arrêt</p>
            </div>
          </div>

          <div class="meta-grid">
            <div class="meta-item">
              <span class="meta-label">Périmètre</span>
              <span class="meta-value">${subTitleStr}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Date d'édition</span>
              <span class="meta-value">${printDate}</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Commune</th>
                <th style="text-align: right;">Abonnés À l'arrêt</th>
                <th style="text-align: right;">Total Abonnés</th>
                <th style="text-align: right; width: 140px;">Taux d'Arrêt (%)</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
          </table>

          <div class="footer-info">
            <span>EPEOR Analytics - Gestion Abonnés (À l'arrêt)</span>
            <span>Page 1 sur 1</span>
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handlePrintTypes = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Veuillez autoriser les fenêtres pop-up pour pouvoir imprimer.");
      return;
    }

    const titleStr = "Répartition Détaillée des Abonnés à l'Arrêt par Type d'Abonné";
    const subTitleStr = secteurLabel ? "Centre : " + secteurLabel : "Toute l'unité";
    const printDate = new Date().toLocaleDateString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    let tableRowsHtml = "";
    types.forEach((t: any) => {
      const taux = t.value > 0 ? ((t.stopped || 0) / t.value) * 100 : 0;
      tableRowsHtml += `
        <tr>
          <td style="padding: 6px 12px; font-weight: bold;">${t.name}</td>
          <td style="padding: 6px 12px; text-align: right; font-weight: bold; color: #D97706;">${(t.stopped || 0).toLocaleString()}</td>
          <td style="padding: 6px 12px; text-align: right; color: #475467;">${t.value.toLocaleString()}</td>
          <td style="padding: 6px 12px; text-align: right; font-weight: bold;">${taux.toFixed(2)}%</td>
        </tr>
      `;
    });

    const totalStopped = types.reduce((acc: number, curr: any) => acc + (curr.stopped || 0), 0);
    const totalVal = types.reduce((acc: number, curr: any) => acc + curr.value, 0);
    const totalTaux = totalVal > 0 ? (totalStopped / totalVal) * 100 : 0;

    tableRowsHtml += `
      <tr style="background: #f1f5f9; color: #101828; font-weight: bold; font-size: 9.5px; border-top: 1px solid #94a3b8; border-bottom: 1px solid #94a3b8;">
        <td style="padding: 9px 12px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: none; color: #101828;">Total Général</td>
        <td style="padding: 9px 12px; text-align: right; color: #b45309; border-bottom: none;">${totalStopped.toLocaleString()}</td>
        <td style="padding: 9px 12px; text-align: right; color: #101828; border-bottom: none;">${totalVal.toLocaleString()}</td>
        <td style="padding: 9px 12px; text-align: right; color: #101828; border-bottom: none;">${totalTaux.toFixed(2)}%</td>
      </tr>
    `;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${titleStr}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap');
            @page {
              size: landscape;
              margin: 10mm 12mm;
            }
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              color: #101828;
              margin: 0;
              font-size: 9px;
              line-height: 1.4;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #F2F4F7;
              padding-bottom: 10px;
              margin-bottom: 12px;
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
              margin: 0;
            }
            .company-name {
              font-size: 8.5px;
              font-weight: 700;
              color: #667085;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-top: 1px;
            }
            .title-section {
              text-align: right;
            }
            .title {
              font-size: 16px;
              font-weight: 900;
              color: #101828;
              margin: 0;
            }
            .subtitle {
              font-size: 9.5px;
              color: #667085;
              margin: 3px 0 0 0;
              font-weight: 500;
            }
            .meta-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 10px;
              margin-bottom: 15px;
              background: #F9FAFB;
              border: 1px solid #E4E7EC;
              border-radius: 8px;
              padding: 8px 12px;
            }
            .meta-item {
              display: flex;
              flex-direction: column;
            }
            .meta-label {
              font-size: 8px;
              text-transform: uppercase;
              color: #667085;
              font-weight: 700;
              letter-spacing: 0.5px;
              margin-bottom: 2px;
            }
            .meta-value {
              font-size: 10px;
              font-weight: 700;
              color: #101828;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 15px;
              text-align: left;
            }
            th {
              background: #F9FAFB;
              color: #475467;
              font-size: 8px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              padding: 7px 12px;
              border-bottom: 1px solid #F2F4F7;
            }
            td {
              border-bottom: 1px solid #F2F4F7;
              padding: 5px 12px;
              font-size: 9px;
            }
            .footer-info {
              display: flex;
              justify-content: space-between;
              align-items: center;
              color: #667085;
              font-size: 8px;
              border-top: 1px solid #F2F4F7;
              padding-top: 10px;
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo-section">
              <div>
                <h1 class="logo-text">EPEOR ANALYTICS</h1>
                <div class="company-name">Algérienne des Eaux</div>
              </div>
            </div>
            <div class="title-section">
              <h2 class="title">${titleStr}</h2>
              <p class="subtitle">Gestion Abonnés - À l'arrêt</p>
            </div>
          </div>

          <div class="meta-grid">
            <div class="meta-item">
              <span class="meta-label">Périmètre</span>
              <span class="meta-value">${subTitleStr}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Date d'édition</span>
              <span class="meta-value">${printDate}</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Catégorie / Type</th>
                <th style="text-align: right;">Abonnés À l'arrêt</th>
                <th style="text-align: right;">Total Abonnés</th>
                <th style="text-align: right; width: 140px;">Taux d'Arrêt (%)</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
          </table>

          <div class="footer-info">
            <span>EPEOR Analytics - Gestion Abonnés (À l'arrêt)</span>
            <span>Page 1 sur 1</span>
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  if (selectedType) {
    return (
      <div className="obat-card overflow-hidden">
        <div className="p-6 sm:p-8 border-b border-[#F2F4F7]">
          <button
            type="button"
            onClick={() => setSelectedType(null)}
            className="flex items-center gap-2 text-sm font-bold text-[#667085] hover:text-[#101828] mb-4 transition-colors"
          >
            <ChevronRight className="rotate-180" size={16} /> Retour à la répartition par type
          </button>
          <h3 className="text-2xl font-black tracking-tight text-[#101828]">
            Abonnés à l’arrêt — {selectedType.name}
          </h3>
          <p className="text-sm text-[#667085] mt-1">
            Liste nominative des abonnés de ce type dont le compteur est à l’arrêt (Code 20)
            {secteurLabel ? ` · Centre ${secteurLabel}` : ''}
          </p>
        </div>
        {typeSubscribersError ? (
          <p role="alert" className="p-6 text-sm font-medium text-rose-700">
            {typeSubscribersError}
          </p>
        ) : !loadingSubscribers && typeSubscribers.length === 0 ? (
          <p className="p-6 text-sm font-medium text-[#667085]">
            Aucun abonné à l’arrêt trouvé pour ce type.
          </p>
        ) : (
          <NominativeTable
            subscribers={typeSubscribers}
            loading={loadingSubscribers}
            accentColor="amber"
            consecutiveEtatColumn={{ field: 'consecutive_etat20', label: "Factures à l'arrêt", activeClass: 'bg-amber-50 text-amber-700 border-amber-100', hoverClass: 'text-amber-700' }}
            selectedNumabs={selectedNumabs}
            onSelectedNumabsChange={setSelectedNumabs}
            printedSubscribersRef={printedSubscribersRef}
          />
        )}
      </div>
    );
  }

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
          selectedNumabs={selectedNumabs}
          onSelectedNumabsChange={setSelectedNumabs}
          printedSubscribersRef={printedSubscribersRef}
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
          <button
            onClick={handlePrintCommunes}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#D97706] hover:bg-[#B45309] active:scale-95 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-amber-600/10 border border-amber-500/10 self-start md:self-auto"
            title="Imprimer la répartition des abonnés à l'arrêt par commune"
          >
            <Printer size={13} />
            <span>Imprimer</span>
          </button>
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
        <div className="p-8 border-b border-[#F2F4F7] flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h3 className="text-2xl font-black tracking-tight text-[#101828]">Répartition des Abonnés À l'Arrêt par Type d'Abonné</h3>
            <p className="text-sm text-[#667085] mt-1 font-medium">Analyse des compteurs à l'arrêt classés par catégorie</p>
          </div>
          <button
            onClick={handlePrintTypes}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#D97706] hover:bg-[#B45309] active:scale-95 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-amber-600/10 border border-amber-500/10 self-start md:self-auto"
            title="Imprimer la répartition des abonnés à l'arrêt par type d'abonné"
          >
            <Printer size={13} />
            <span>Imprimer</span>
          </button>
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
                  <tr
                    key={i}
                    onClick={() => handleTypeClick(t)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        void handleTypeClick(t);
                      }
                    }}
                    tabIndex={0}
                    className="hover:bg-[#F9FAFB] transition-colors group cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
                    aria-label={`Afficher les abonnés à l'arrêt de type ${t.name}`}
                  >
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

      <DistributionCharts
        charts={[
          {
            title: "Abonnés à l'arrêt par commune",
            description: "Comparaison du nombre d'abonnés concernés",
            emptyMessage: "Aucune donnée d'arrêt disponible par commune.",
            color: '#D97706',
            data: stoppedCommuneChartData,
          },
          {
            title: "Abonnés à l'arrêt par type",
            description: "Comparaison du nombre d'abonnés concernés",
            emptyMessage: "Aucune donnée d'arrêt disponible par type d'abonné.",
            color: '#D97706',
            data: stoppedTypeChartData,
          },
        ]}
      />
    </div>
  );
}

function NoMeterDetailView({ stats, onBack, selectedSecteur = '', secteurLabel }: any) {
  const [selectedCommune, setSelectedCommune] = useState<any>(null);
  const [selectedQuartier, setSelectedQuartier] = useState<any>(null);
  const [selectedType, setSelectedType] = useState<any>(null);
  const [quartierSubscribers, setQuartierSubscribers] = useState<any[]>([]);
  const [typeSubscribers, setTypeSubscribers] = useState<any[]>([]);
  const [typeSubscribersError, setTypeSubscribersError] = useState<string | null>(null);
  const [loadingSubscribers, setLoadingSubscribers] = useState(false);
  const [selectedNumabs, setSelectedNumabs] = useState<string[]>([]);
  const printedSubscribersRef = useRef<any[]>([]);

  const handleTypeClick = async (type: any) => {
    setSelectedType(type);
    setTypeSubscribers([]);
    setTypeSubscribersError(null);
    setSelectedNumabs([]);
    setLoadingSubscribers(true);
    try {
      const response = await fetch(buildSubscribersUrl(undefined, {
        etat: '30',
        secteur: selectedSecteur,
        typabon: type.code,
      }));
      if (!response.ok) {
        throw new Error(`Erreur HTTP ${response.status}`);
      }
      const data = await response.json();
      if (!Array.isArray(data)) {
        throw new Error(data?.error || 'Réponse invalide du serveur');
      }
      setTypeSubscribers(data);
    } catch (error) {
      console.error('Erreur lors du chargement des abonnés sans compteur par type :', error);
      setTypeSubscribersError('Impossible de charger la liste des abonnés pour ce type. Réessayez.');
    } finally {
      setLoadingSubscribers(false);
    }
  };

  const handleQuartierClick = async (q: any) => {
    setSelectedQuartier(q);
    setSelectedNumabs([]);
    setLoadingSubscribers(true);
    try {
      const res = await fetch(buildSubscribersUrl(q.id, { etat: '30', secteur: selectedSecteur }));
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

    const currentSubscribers = printedSubscribersRef.current && printedSubscribersRef.current.length > 0
      ? printedSubscribersRef.current
      : quartierSubscribers;

    const toprint = selectedNumabs.length > 0 
      ? currentSubscribers.filter(sub => selectedNumabs.includes(sub.numab))
      : currentSubscribers;

    if (toprint.length === 0) {
      alert('Aucun abonné à imprimer. Veuillez sélectionner au moins un abonné.');
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Veuillez autoriser les fenêtres pop-up pour pouvoir imprimer.");
      return;
    }

    const selectionNote = selectedNumabs.length > 0 ? `Sélection de ${selectedNumabs.length} abonné(s)` : `Total : ${toprint.length} abonné(s)`;

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
              <span class="meta-label">Abonnés à imprimer</span>
              <span class="meta-value">${selectionNote}</span>
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
              ${toprint.map(sub => `
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

  const handlePrintCommunes = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Veuillez autoriser les fenêtres pop-up pour pouvoir imprimer.");
      return;
    }

    const titleStr = "Répartition Détaillée des Abonnés sans Compteur par Commune";
    const subTitleStr = secteurLabel ? "Centre : " + secteurLabel : "Toute l'unité";
    const printDate = new Date().toLocaleDateString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    let tableRowsHtml = "";
    communes.forEach((c: any) => {
      const taux = c.value > 0 ? ((c.no_meter || 0) / c.value) * 100 : 0;
      tableRowsHtml += `
        <tr>
          <td style="padding: 6px 12px; font-weight: bold;">${c.name}</td>
          <td style="padding: 6px 12px; text-align: right; font-weight: bold; color: #0891B2;">${(c.no_meter || 0).toLocaleString()}</td>
          <td style="padding: 6px 12px; text-align: right; color: #475467;">${c.value.toLocaleString()}</td>
          <td style="padding: 6px 12px; text-align: right; font-weight: bold;">${taux.toFixed(2)}%</td>
        </tr>
      `;
    });

    const totalNoMeter = communes.reduce((acc: number, curr: any) => acc + (curr.no_meter || 0), 0);
    const totalVal = communes.reduce((acc: number, curr: any) => acc + curr.value, 0);
    const totalTaux = totalVal > 0 ? (totalNoMeter / totalVal) * 100 : 0;

    tableRowsHtml += `
      <tr style="background: #f1f5f9; color: #101828; font-weight: bold; font-size: 9.5px; border-top: 1px solid #94a3b8; border-bottom: 1px solid #94a3b8;">
        <td style="padding: 9px 12px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: none; color: #101828;">Total Général</td>
        <td style="padding: 9px 12px; text-align: right; color: #0891b2; border-bottom: none;">${totalNoMeter.toLocaleString()}</td>
        <td style="padding: 9px 12px; text-align: right; color: #101828; border-bottom: none;">${totalVal.toLocaleString()}</td>
        <td style="padding: 9px 12px; text-align: right; color: #101828; border-bottom: none;">${totalTaux.toFixed(2)}%</td>
      </tr>
    `;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${titleStr}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap');
            @page {
              size: landscape;
              margin: 10mm 12mm;
            }
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              color: #101828;
              margin: 0;
              font-size: 9px;
              line-height: 1.4;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #F2F4F7;
              padding-bottom: 10px;
              margin-bottom: 12px;
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
              margin: 0;
            }
            .company-name {
              font-size: 8.5px;
              font-weight: 700;
              color: #667085;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-top: 1px;
            }
            .title-section {
              text-align: right;
            }
            .title {
              font-size: 16px;
              font-weight: 900;
              color: #101828;
              margin: 0;
            }
            .subtitle {
              font-size: 9.5px;
              color: #667085;
              margin: 3px 0 0 0;
              font-weight: 500;
            }
            .meta-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 10px;
              margin-bottom: 15px;
              background: #F9FAFB;
              border: 1px solid #E4E7EC;
              border-radius: 8px;
              padding: 8px 12px;
            }
            .meta-item {
              display: flex;
              flex-direction: column;
            }
            .meta-label {
              font-size: 8px;
              text-transform: uppercase;
              color: #667085;
              font-weight: 700;
              letter-spacing: 0.5px;
              margin-bottom: 2px;
            }
            .meta-value {
              font-size: 10px;
              font-weight: 700;
              color: #101828;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 15px;
              text-align: left;
            }
            th {
              background: #F9FAFB;
              color: #475467;
              font-size: 8px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              padding: 7px 12px;
              border-bottom: 1px solid #F2F4F7;
            }
            td {
              border-bottom: 1px solid #F2F4F7;
              padding: 5px 12px;
              font-size: 9px;
            }
            .footer-info {
              display: flex;
              justify-content: space-between;
              align-items: center;
              color: #667085;
              font-size: 8px;
              border-top: 1px solid #F2F4F7;
              padding-top: 10px;
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo-section">
              <img src="${window.location.origin}/ade.png" alt="ADE Logo" style="height: 40px; width: auto;" />
              <div>
                <h1 class="logo-text">EPEOR ANALYTICS</h1>
                <div class="company-name">Algérienne des Eaux</div>
              </div>
            </div>
            <div class="title-section">
              <h2 class="title">${titleStr}</h2>
              <p class="subtitle">Gestion Abonnés - Sans compteur</p>
            </div>
          </div>

          <div class="meta-grid">
            <div class="meta-item">
              <span class="meta-label">Périmètre</span>
              <span class="meta-value">${subTitleStr}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Date d'édition</span>
              <span class="meta-value">${printDate}</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Commune</th>
                <th style="text-align: right;">Abonnés Sans Compteur</th>
                <th style="text-align: right;">Total Abonnés</th>
                <th style="text-align: right; width: 140px;">Taux (%)</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
          </table>

          <div class="footer-info">
            <span>EPEOR Analytics - Gestion Abonnés (Sans compteur)</span>
            <span>Page 1 sur 1</span>
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handlePrintTypes = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Veuillez autoriser les fenêtres pop-up pour pouvoir imprimer.");
      return;
    }

    const titleStr = "Répartition Détaillée des Abonnés sans Compteur par Type d'Abonné";
    const subTitleStr = secteurLabel ? "Centre : " + secteurLabel : "Toute l'unité";
    const printDate = new Date().toLocaleDateString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    let tableRowsHtml = "";
    types.forEach((t: any) => {
      const taux = t.value > 0 ? ((t.no_meter || 0) / t.value) * 100 : 0;
      tableRowsHtml += `
        <tr>
          <td style="padding: 6px 12px; font-weight: bold;">${t.name}</td>
          <td style="padding: 6px 12px; text-align: right; font-weight: bold; color: #0891B2;">${(t.no_meter || 0).toLocaleString()}</td>
          <td style="padding: 6px 12px; text-align: right; color: #475467;">${t.value.toLocaleString()}</td>
          <td style="padding: 6px 12px; text-align: right; font-weight: bold;">${taux.toFixed(2)}%</td>
        </tr>
      `;
    });

    const totalNoMeter = types.reduce((acc: number, curr: any) => acc + (curr.no_meter || 0), 0);
    const totalVal = types.reduce((acc: number, curr: any) => acc + curr.value, 0);
    const totalTaux = totalVal > 0 ? (totalNoMeter / totalVal) * 100 : 0;

    tableRowsHtml += `
      <tr style="background: #f1f5f9; color: #101828; font-weight: bold; font-size: 9.5px; border-top: 1px solid #94a3b8; border-bottom: 1px solid #94a3b8;">
        <td style="padding: 9px 12px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: none; color: #101828;">Total Général</td>
        <td style="padding: 9px 12px; text-align: right; color: #0891b2; border-bottom: none;">${totalNoMeter.toLocaleString()}</td>
        <td style="padding: 9px 12px; text-align: right; color: #101828; border-bottom: none;">${totalVal.toLocaleString()}</td>
        <td style="padding: 9px 12px; text-align: right; color: #101828; border-bottom: none;">${totalTaux.toFixed(2)}%</td>
      </tr>
    `;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${titleStr}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap');
            @page {
              size: landscape;
              margin: 10mm 12mm;
            }
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              color: #101828;
              margin: 0;
              font-size: 9px;
              line-height: 1.4;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #F2F4F7;
              padding-bottom: 10px;
              margin-bottom: 12px;
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
              margin: 0;
            }
            .company-name {
              font-size: 8.5px;
              font-weight: 700;
              color: #667085;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-top: 1px;
            }
            .title-section {
              text-align: right;
            }
            .title {
              font-size: 16px;
              font-weight: 900;
              color: #101828;
              margin: 0;
            }
            .subtitle {
              font-size: 9.5px;
              color: #667085;
              margin: 3px 0 0 0;
              font-weight: 500;
            }
            .meta-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 10px;
              margin-bottom: 15px;
              background: #F9FAFB;
              border: 1px solid #E4E7EC;
              border-radius: 8px;
              padding: 8px 12px;
            }
            .meta-item {
              display: flex;
              flex-direction: column;
            }
            .meta-label {
              font-size: 8px;
              text-transform: uppercase;
              color: #667085;
              font-weight: 700;
              letter-spacing: 0.5px;
              margin-bottom: 2px;
            }
            .meta-value {
              font-size: 10px;
              font-weight: 700;
              color: #101828;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 15px;
              text-align: left;
            }
            th {
              background: #F9FAFB;
              color: #475467;
              font-size: 8px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              padding: 7px 12px;
              border-bottom: 1px solid #F2F4F7;
            }
            td {
              border-bottom: 1px solid #F2F4F7;
              padding: 5px 12px;
              font-size: 9px;
            }
            .footer-info {
              display: flex;
              justify-content: space-between;
              align-items: center;
              color: #667085;
              font-size: 8px;
              border-top: 1px solid #F2F4F7;
              padding-top: 10px;
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo-section">
              <img src="${window.location.origin}/ade.png" alt="ADE Logo" style="height: 40px; width: auto;" />
              <div>
                <h1 class="logo-text">EPEOR ANALYTICS</h1>
                <div class="company-name">Algérienne des Eaux</div>
              </div>
            </div>
            <div class="title-section">
              <h2 class="title">${titleStr}</h2>
              <p class="subtitle">Gestion Abonnés - Sans compteur</p>
            </div>
          </div>

          <div class="meta-grid">
            <div class="meta-item">
              <span class="meta-label">Périmètre</span>
              <span class="meta-value">${subTitleStr}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Date d'édition</span>
              <span class="meta-value">${printDate}</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Type d'Abonné</th>
                <th style="text-align: right;">Abonnés Sans Compteur</th>
                <th style="text-align: right;">Total Abonnés</th>
                <th style="text-align: right; width: 140px;">Taux (%)</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
          </table>

          <div class="footer-info">
            <span>EPEOR Analytics - Gestion Abonnés (Sans compteur)</span>
            <span>Page 1 sur 1</span>
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 500);
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
  const noMeterCommuneChartData = communes.map((commune: any) => ({
    name: String(commune.name ?? 'Commune inconnue'),
    count: Number(commune.no_meter) || 0,
  }));
  const noMeterTypeChartData = types.map((type: any) => ({
    name: String(type.name ?? "Type d'abonné inconnu"),
    count: Number(type.no_meter) || 0,
  }));

  if (selectedType) {
    return (
      <div className="obat-card overflow-hidden">
        <div className="p-6 sm:p-8 border-b border-[#F2F4F7]">
          <button
            type="button"
            onClick={() => setSelectedType(null)}
            className="flex items-center gap-2 text-sm font-bold text-[#667085] hover:text-[#101828] mb-4 transition-colors"
          >
            <ChevronRight className="rotate-180" size={16} /> Retour à la répartition par type
          </button>
          <h3 className="text-2xl font-black tracking-tight text-[#101828]">
            Abonnés sans compteur — {selectedType.name}
          </h3>
          <p className="text-sm text-[#667085] mt-1">
            Liste nominative des abonnés de ce type sans compteur (Code 30)
            {secteurLabel ? ` · Centre ${secteurLabel}` : ''}
          </p>
        </div>
        {typeSubscribersError ? (
          <p role="alert" className="p-6 text-sm font-medium text-rose-700">
            {typeSubscribersError}
          </p>
        ) : !loadingSubscribers && typeSubscribers.length === 0 ? (
          <p className="p-6 text-sm font-medium text-[#667085]">
            Aucun abonné sans compteur trouvé pour ce type.
          </p>
        ) : (
          <NominativeTable
            subscribers={typeSubscribers}
            loading={loadingSubscribers}
            accentColor="cyan"
            consecutiveEtatColumn={{ field: 'consecutive_etat30', label: 'Factures sans compteur', activeClass: 'bg-cyan-50 text-cyan-700 border-cyan-100', hoverClass: 'text-cyan-700' }}
            selectedNumabs={selectedNumabs}
            onSelectedNumabsChange={setSelectedNumabs}
            printedSubscribersRef={printedSubscribersRef}
          />
        )}
      </div>
    );
  }

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
          selectedNumabs={selectedNumabs}
          onSelectedNumabsChange={setSelectedNumabs}
          printedSubscribersRef={printedSubscribersRef}
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
            <h3 className="text-2xl font-black tracking-tight text-[#101828]">Répartition Détaillée des Abonnés sans Compteur par Commune</h3>
            <p className="text-sm text-[#667085] mt-1">Analyse détaillée des abonnés sans compteur (Code 30) par zone géographique</p>
          </div>
          <button
            onClick={handlePrintCommunes}
            className="flex items-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-700 active:scale-95 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-cyan-600/10 border border-cyan-500/10 self-start md:self-auto"
            title="Imprimer la répartition des abonnés sans compteur par commune"
          >
            <Printer size={13} />
            <span>Imprimer</span>
          </button>
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
        <div className="p-8 border-b border-[#F2F4F7] flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h3 className="text-2xl font-black tracking-tight text-[#101828]">Répartition Détaillée des Abonnés sans Compteur par Type d'Abonné</h3>
            <p className="text-sm text-[#667085] mt-1">Analyse des abonnés sans compteur classés par catégorie</p>
          </div>
          <button
            onClick={handlePrintTypes}
            className="flex items-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-700 active:scale-95 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-cyan-600/10 border border-cyan-500/10 self-start md:self-auto"
            title="Imprimer la répartition des abonnés sans compteur par type d'abonné"
          >
            <Printer size={13} />
            <span>Imprimer</span>
          </button>
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
                  <tr
                    key={i}
                    onClick={() => handleTypeClick(t)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        void handleTypeClick(t);
                      }
                    }}
                    tabIndex={0}
                    className="hover:bg-[#F9FAFB] transition-colors group cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
                    aria-label={`Afficher les abonnés sans compteur de type ${t.name}`}
                  >
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
      <DistributionCharts
        charts={[
          {
            title: "Abonnés sans compteur par commune",
            description: "Comparaison du nombre d'abonnés concernés",
            emptyMessage: "Aucune donnée sans compteur disponible par commune.",
            color: '#0891B2',
            data: noMeterCommuneChartData,
          },
          {
            title: "Abonnés sans compteur par type",
            description: "Comparaison du nombre d'abonnés concernés",
            emptyMessage: "Aucune donnée sans compteur disponible par type d'abonné.",
            color: '#0891B2',
            data: noMeterTypeChartData,
          },
        ]}
      />
    </div>
  );
}
