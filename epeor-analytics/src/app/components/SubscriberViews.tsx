"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  ChevronRight, MapPin, Printer, Search,
} from "lucide-react";
import { apiUrl, apiUrlObject } from "../lib/api";
import { buildSubscribersUrl, appendSecteurParam } from "./utils";
import { SecteurDropdown } from "./ui";
import { ScrollableTabs, ScrollableTab } from "./ScrollableTabs";
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
  currentView: 'details' | 'evolution' | 'resigned' | 'stopped' | 'no_meter';
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
  const [searchSortKey, setSearchSortKey] = useState<string>('NUMAB');
  const [searchSortDir, setSearchSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSearchSort = (key: string) => {
    if (searchSortKey === key) {
      setSearchSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSearchSortKey(key);
      setSearchSortDir('asc');
    }
  };

  const sortedSearchResults = [...searchResults].sort((a: any, b: any) => {
    const va = (a[searchSortKey] ?? '').toString().toLowerCase();
    const vb = (b[searchSortKey] ?? '').toString().toLowerCase();
    const cmp = va.localeCompare(vb, 'fr', { numeric: true });
    return searchSortDir === 'asc' ? cmp : -cmp;
  });

  const handleSearch = useCallback((qStr: string) => {
    setSearchQuery(qStr);
    if (!qStr.trim()) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    const url = apiUrlObject('/search');
    url.searchParams.append('query', qStr);
    if (selectedSecteur) {
      url.searchParams.append('secteur', selectedSecteur);
    }
    fetch(url.toString())
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setSearchResults(data);
        } else {
          setSearchResults([]);
        }
      })
      .catch(() => {})
      .finally(() => {
        setSearchLoading(false);
      });
  }, [selectedSecteur]);

  useEffect(() => {
    if (searchQuery.trim()) {
      handleSearch(searchQuery);
    }
  }, [selectedSecteur, handleSearch, searchQuery]);

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
    { id: 'evolution' as const, label: 'Évolution des abonnés' },
    { id: 'resigned' as const, label: 'Résiliés' },
    { id: 'stopped' as const, label: "À l'arrêt" },
    { id: 'no_meter' as const, label: 'Sans compteur' },
  ];

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
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Chercher abonnés..."
                className="w-full text-[11px] font-black pl-8 pr-7 py-1.5 rounded-xl border border-[#E4E7EC]/80 bg-white text-[#101828] placeholder-[#98A2B3] focus:outline-none focus:ring-1 focus:ring-brand-500 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => handleSearch('')}
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
        {statsLoading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70 backdrop-blur-[2px] rounded-[2rem] min-h-[120px]">
            <div className="flex flex-col items-center gap-2">
              <div className="spinner-premium" style={{ width: 32, height: 32 }} />
              <p className="text-[10px] font-black text-brand-600 uppercase tracking-widest">Calcul par centre…</p>
            </div>
          </div>
        )}
        {searchQuery.trim().length > 0 ? (
          <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[1.25rem] sm:rounded-[2rem] p-4 sm:p-6 space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-[11px] sm:text-xs font-black text-[#101828] uppercase tracking-wider flex items-center gap-2">
                🔍 Résultats de recherche ({searchResults.length})
              </h3>
              {searchLoading && (
                <div className="flex items-center gap-1.5 text-xs text-brand-600 font-bold">
                  <div className="spinner-premium animate-spin w-3 h-3 border-2 border-brand-600 border-t-transparent rounded-full" />
                  Recherche en cours...
                </div>
              )}
            </div>

            <div className="overflow-x-auto table-scroll">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-[#F9FAFB] text-[#475467] text-[11px] uppercase tracking-wider font-bold">
                    <th className="px-6 py-5 cursor-pointer select-none group" onClick={() => handleSearchSort('NUMAB')}>
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`transition-colors ${searchSortKey === 'NUMAB' ? 'text-[#0D83DE]' : 'group-hover:text-[#101828]'}`}>N° Abonné</span>
                        <span className={`text-[10px] transition-colors ${searchSortKey === 'NUMAB' ? 'text-[#0D83DE]' : 'text-[#D0D5DD] group-hover:text-[#98A2B3]'}`}>
                          {searchSortKey === 'NUMAB' ? (searchSortDir === 'asc' ? '▲' : '▼') : '⇅'}
                        </span>
                      </span>
                    </th>
                    <th className="px-6 py-5 cursor-pointer select-none group" onClick={() => handleSearchSort('NOM')}>
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`transition-colors ${searchSortKey === 'NOM' ? 'text-[#0D83DE]' : 'group-hover:text-[#101828]'}`}>Nom / Raison Sociale</span>
                        <span className={`text-[10px] transition-colors ${searchSortKey === 'NOM' ? 'text-[#0D83DE]' : 'text-[#D0D5DD] group-hover:text-[#98A2B3]'}`}>
                          {searchSortKey === 'NOM' ? (searchSortDir === 'asc' ? '▲' : '▼') : '⇅'}
                        </span>
                      </span>
                    </th>
                    <th className="px-6 py-5 cursor-pointer select-none group" onClick={() => handleSearchSort('ADRESSE')}>
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`transition-colors ${searchSortKey === 'ADRESSE' ? 'text-[#0D83DE]' : 'group-hover:text-[#101828]'}`}>Adresse</span>
                        <span className={`text-[10px] transition-colors ${searchSortKey === 'ADRESSE' ? 'text-[#0D83DE]' : 'text-[#D0D5DD] group-hover:text-[#98A2B3]'}`}>
                          {searchSortKey === 'ADRESSE' ? (searchSortDir === 'asc' ? '▲' : '▼') : '⇅'}
                        </span>
                      </span>
                    </th>
                    <th className="px-6 py-5 cursor-pointer select-none group" onClick={() => handleSearchSort('TOURNEE')}>
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`transition-colors ${searchSortKey === 'TOURNEE' ? 'text-[#0D83DE]' : 'group-hover:text-[#101828]'}`}>Tournée</span>
                        <span className={`text-[10px] transition-colors ${searchSortKey === 'TOURNEE' ? 'text-[#0D83DE]' : 'text-[#D0D5DD] group-hover:text-[#98A2B3]'}`}>
                          {searchSortKey === 'TOURNEE' ? (searchSortDir === 'asc' ? '▲' : '▼') : '⇅'}
                        </span>
                      </span>
                    </th>
                    <th className="px-4 py-5 cursor-pointer select-none group" onClick={() => handleSearchSort('BLOC')}>
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`transition-colors ${searchSortKey === 'BLOC' ? 'text-[#0D83DE]' : 'group-hover:text-[#101828]'}`}>Bloc</span>
                        <span className={`text-[10px] transition-colors ${searchSortKey === 'BLOC' ? 'text-[#0D83DE]' : 'text-[#D0D5DD] group-hover:text-[#98A2B3]'}`}>
                          {searchSortKey === 'BLOC' ? (searchSortDir === 'asc' ? '▲' : '▼') : '⇅'}
                        </span>
                      </span>
                    </th>
                    <th className="px-4 py-5 cursor-pointer select-none group" onClick={() => handleSearchSort('NDOM')}>
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`transition-colors ${searchSortKey === 'NDOM' ? 'text-[#0D83DE]' : 'group-hover:text-[#101828]'}`}>N° Dom</span>
                        <span className={`text-[10px] transition-colors ${searchSortKey === 'NDOM' ? 'text-[#0D83DE]' : 'text-[#D0D5DD] group-hover:text-[#98A2B3]'}`}>
                          {searchSortKey === 'NDOM' ? (searchSortDir === 'asc' ? '▲' : '▼') : '⇅'}
                        </span>
                      </span>
                    </th>
                    <th className="px-6 py-5 cursor-pointer select-none group" onClick={() => handleSearchSort('NUMSER')}>
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`transition-colors ${searchSortKey === 'NUMSER' ? 'text-[#0D83DE]' : 'group-hover:text-[#101828]'}`}>N° Série</span>
                        <span className={`text-[10px] transition-colors ${searchSortKey === 'NUMSER' ? 'text-[#0D83DE]' : 'text-[#D0D5DD] group-hover:text-[#98A2B3]'}`}>
                          {searchSortKey === 'NUMSER' ? (searchSortDir === 'asc' ? '▲' : '▼') : '⇅'}
                        </span>
                      </span>
                    </th>
                    <th className="px-6 py-5 text-right cursor-pointer select-none group" onClick={() => handleSearchSort('NOUVELX')}>
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`text-[10px] transition-colors ${searchSortKey === 'NOUVELX' ? 'text-[#0D83DE]' : 'text-[#D0D5DD] group-hover:text-[#98A2B3]'}`}>
                          {searchSortKey === 'NOUVELX' ? (searchSortDir === 'asc' ? '▲' : '▼') : '⇅'}
                        </span>
                        <span className={`transition-colors ${searchSortKey === 'NOUVELX' ? 'text-[#0D83DE]' : 'group-hover:text-[#101828]'}`}>Nouvel Index</span>
                      </span>
                    </th>
                    <th className="px-6 py-5 cursor-pointer select-none group" onClick={() => handleSearchSort('TYPE_LABEL')}>
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`transition-colors ${searchSortKey === 'TYPE_LABEL' ? 'text-[#0D83DE]' : 'group-hover:text-[#101828]'}`}>Type d&apos;Abonnement</span>
                        <span className={`text-[10px] transition-colors ${searchSortKey === 'TYPE_LABEL' ? 'text-[#0D83DE]' : 'text-[#D0D5DD] group-hover:text-[#98A2B3]'}`}>
                          {searchSortKey === 'TYPE_LABEL' ? (searchSortDir === 'asc' ? '▲' : '▼') : '⇅'}
                        </span>
                      </span>
                    </th>
                    <th className="px-6 py-5 cursor-pointer select-none group" onClick={() => handleSearchSort('ETATCPT')}>
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`transition-colors ${searchSortKey === 'ETATCPT' ? 'text-[#0D83DE]' : 'group-hover:text-[#101828]'}`}>État</span>
                        <span className={`text-[10px] transition-colors ${searchSortKey === 'ETATCPT' ? 'text-[#0D83DE]' : 'text-[#D0D5DD] group-hover:text-[#98A2B3]'}`}>
                          {searchSortKey === 'ETATCPT' ? (searchSortDir === 'asc' ? '▲' : '▼') : '⇅'}
                        </span>
                      </span>
                    </th>
                    <th className="px-6 py-5 text-right cursor-pointer select-none group" onClick={() => handleSearchSort('NUMORDRE')}>
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`text-[10px] transition-colors ${searchSortKey === 'NUMORDRE' ? 'text-[#0D83DE]' : 'text-[#D0D5DD] group-hover:text-[#98A2B3]'}`}>
                          {searchSortKey === 'NUMORDRE' ? (searchSortDir === 'asc' ? '▲' : '▼') : '⇅'}
                        </span>
                        <span className={`transition-colors ${searchSortKey === 'NUMORDRE' ? 'text-[#0D83DE]' : 'group-hover:text-[#101828]'}`}>N° Ordre</span>
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2F4F7]">
                  {searchResults.length > 0 ? (
                    sortedSearchResults.map((sub, idx) => (
                      <tr key={sub.NUMAB || idx} className="hover:bg-[#F9FAFB] transition-colors">
                        <td className="px-6 py-4 font-black text-[13px] text-[#101828] whitespace-nowrap">{sub.NUMAB || '—'}</td>
                        <td className="px-6 py-4 font-medium text-[13px] text-[#101828] min-w-[200px]">{sub.NOM || '—'}</td>
                        <td className="px-6 py-4 font-medium text-[13px] text-[#667085] min-w-[180px]">{sub.ADRESSE || '—'}</td>
                        <td className="px-6 py-4 font-bold text-[13px] text-[#0D83DE] whitespace-nowrap">{sub.TOURNEE ? `T-${sub.TOURNEE}` : '—'}</td>
                        <td className="px-4 py-4 font-medium text-[13px] text-[#667085]">{sub.BLOC || '—'}</td>
                        <td className="px-4 py-4 font-medium text-[13px] text-[#667085]">{sub.NDOM || '—'}</td>
                        <td className="px-6 py-4 font-medium text-[13px] text-[#475467] whitespace-nowrap">{sub.NUMSER || '---'}</td>
                        <td className="px-6 py-4 font-bold text-[13px] text-[#101828] text-right">
                          {sub.NOUVELX !== undefined ? Number(sub.NOUVELX).toLocaleString('fr-FR') : '—'}
                        </td>
                        <td className="px-6 py-4 font-medium text-[13px] text-[#667085]">{sub.TYPE_LABEL || '—'}</td>
                        <td className="px-6 py-4">{etatBadge(sub.ETATCPT, sub.ETAT_LABEL)}</td>
                        <td className="px-6 py-4 text-right font-medium text-[13px] text-[#475467]">{sub.NUMORDRE || '—'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={11} className="px-6 py-12 text-center text-[#667085] font-medium">
                        {searchLoading ? 'Chargement...' : 'Aucun abonné trouvé.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <>
            {currentView === 'details' && (
              <DetailedStatsView key={`details-${selectedSecteur}`} {...viewProps} />
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

  const communes = stats?.subscriber_communes || [];
  const types = stats?.subscriber_types || [];

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
        <NominativeTable subscribers={quartierSubscribers} loading={loadingSubscribers} accentColor="blue" selectedNumabs={selectedNumabs} onSelectedNumabsChange={setSelectedNumabs} printedSubscribersRef={printedSubscribersRef} />
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
    </div>
  );
}

function ResignedDetailView({ stats, onBack, selectedSecteur = '', secteurLabel }: any) {
  const [selectedCommune, setSelectedCommune] = useState<any>(null);
  const [selectedQuartier, setSelectedQuartier] = useState<any>(null);
  const [quartierSubscribers, setQuartierSubscribers] = useState<any[]>([]);
  const [loadingSubscribers, setLoadingSubscribers] = useState(false);
  const [selectedNumabs, setSelectedNumabs] = useState<string[]>([]);
  const printedSubscribersRef = useRef<any[]>([]);

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

function StoppedDetailView({ stats, onBack, selectedSecteur = '', secteurLabel }: any) {
  const [selectedCommune, setSelectedCommune] = useState<any>(null);
  const [selectedQuartier, setSelectedQuartier] = useState<any>(null);
  const [quartierSubscribers, setQuartierSubscribers] = useState<any[]>([]);
  const [loadingSubscribers, setLoadingSubscribers] = useState(false);
  const [selectedNumabs, setSelectedNumabs] = useState<string[]>([]);
  // NEW: sorting and filtering state for the table
  const [, setSortKey] = useState<string>('numab');
  const [, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [, setFilterText] = useState<string>('');
  const printedSubscribersRef = useRef<any[]>([]);

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

function NoMeterDetailView({ stats, onBack, selectedSecteur = '', secteurLabel }: any) {
  const [selectedCommune, setSelectedCommune] = useState<any>(null);
  const [selectedQuartier, setSelectedQuartier] = useState<any>(null);
  const [quartierSubscribers, setQuartierSubscribers] = useState<any[]>([]);
  const [loadingSubscribers, setLoadingSubscribers] = useState(false);
  const [selectedNumabs, setSelectedNumabs] = useState<string[]>([]);
  const printedSubscribersRef = useRef<any[]>([]);

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
  const customMap: Record<string, string> = {
    '10': 'EN MARCHE',
    '11': "PAS D'EAU",
    '12': 'LIGNE INUTILISEE',
    '13': 'DEPASSEMENT INDEX',
    '14': 'COMPTEUR COUPE',
    '15': 'PUIT',
    '16': 'LOT DE TERRAIN',
    '17': 'NICHE FERMEE',
    '18': 'MAISON INHABITEE',
    '19': 'LIGNE INUTILISEE',
    '20': "A L'ARRET",
    '21': 'HORLOGERIE CASSEE',
    '22': "MANQUE D'EAU",
    '30': 'SANS COMPT.',
    '40': 'RESILIE',
    '41': 'NON BRANCHE',
  };
  const label = customMap[etatcpt] || etatLabel || etatcpt || '—';
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

function NominativeTable({ subscribers, loading, accentColor = "blue", consecutiveEtatColumn, selectedNumabs = [], onSelectedNumabsChange, printedSubscribersRef }: { subscribers: any[]; loading: boolean; accentColor?: string; consecutiveEtatColumn?: { field: string; label: string; activeClass: string; hoverClass: string }; selectedNumabs?: string[]; onSelectedNumabsChange?: (numabs: string[]) => void; printedSubscribersRef?: any }) {
  const [hoveredSub, setHoveredSub] = useState<any>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const accentMap: any = {
    blue: { spinner: "border-[#0D83DE]", badge: "bg-blue-50 text-[#0D83DE] border-blue-200", dot: "bg-[#0D83DE]" },
    rose: { spinner: "border-rose-500", badge: "bg-rose-50 text-rose-600 border-rose-200", dot: "bg-rose-500" },
    amber: { spinner: "border-amber-500", badge: "bg-amber-50 text-amber-600 border-amber-200", dot: "bg-amber-500" },
    cyan: { spinner: "border-cyan-500", badge: "bg-cyan-50 text-cyan-600 border-cyan-200", dot: "bg-cyan-500" },
  };
  const style = accentMap[accentColor] || accentMap.blue;
  void style;

  return (
        <div className="overflow-x-auto table-scroll relative">
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
          <div className="spinner-premium" style={{ width: 32, height: 32 }}></div>
        </div>
      ) : (
        <PaginatedNominativeTable subscribers={subscribers} style={style} setHoveredSub={setHoveredSub} setMousePos={setMousePos} consecutiveEtatColumn={consecutiveEtatColumn} selectedNumabs={selectedNumabs} onSelectedNumabsChange={onSelectedNumabsChange} printedSubscribersRef={printedSubscribersRef} />
      )}
    </div>
  );
}

function PaginatedNominativeTable({ subscribers, style, setHoveredSub, setMousePos, consecutiveEtatColumn, selectedNumabs = [], onSelectedNumabsChange, printedSubscribersRef }: any) {
  void style;
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
      const res = await fetch(apiUrl(`/abonne_factures?numab=${sub.numab}`));
      const data = await res.json();
      setInvoices(data || []);
    } catch (e) {
      console.error(e);
      setInvoices([]);
    }
    setLoadingInvoices(false);
  };

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  };

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

  useEffect(() => {
    if (printedSubscribersRef) {
      printedSubscribersRef.current = sorted;
    }
  }, [sorted, printedSubscribersRef]);

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
      const jsPDF = (await import('jspdf')).default;
      const { default: autoTable } = await import('jspdf-autotable');
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
      const blobUrl = String(doc.output('bloburl'));
      const printWindow = window.open(blobUrl, '_blank');
      if (!printWindow) {
        alert('Veuillez autoriser les fenêtres pop-up pour pouvoir imprimer.');
        URL.revokeObjectURL(blobUrl);
        return;
      }
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
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
              <div className="spinner-premium" style={{ width: 40, height: 40 }}></div>
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
            <th className="px-4 py-5 text-center">
              <input
                type="checkbox"
                checked={pageItems.length > 0 && pageItems.every((s: any) => selectedNumabs.includes(s.numab))}
                onChange={(e) => {
                  if (onSelectedNumabsChange) {
                    if (e.target.checked) {
                      onSelectedNumabsChange([...selectedNumabs, ...pageItems.map((s: any) => s.numab).filter((n: string) => !selectedNumabs.includes(n))]);
                    } else {
                      onSelectedNumabsChange(selectedNumabs.filter((n: string) => !pageItems.map((s: any) => s.numab).includes(n)));
                    }
                  }
                }}
                className="w-4 h-4 rounded border-[#D0D5DD] text-[#0D83DE] focus:ring-2 focus:ring-[#0D83DE]/20 cursor-pointer"
              />
            </th>
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
              className="hover:bg-[#F9FAFB] transition-colors"
              onMouseEnter={(e) => { setHoveredSub(sub); setMousePos({ x: e.clientX, y: e.clientY }); }}
              onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
              onMouseLeave={() => setHoveredSub(null)}
            >
              <td className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selectedNumabs.includes(sub.numab)}
                  onChange={(e) => {
                    e.stopPropagation();
                    if (onSelectedNumabsChange) {
                      if (e.target.checked) {
                        onSelectedNumabsChange([...selectedNumabs, sub.numab]);
                      } else {
                        onSelectedNumabsChange(selectedNumabs.filter((n: string) => n !== sub.numab));
                      }
                    }
                  }}
                  className="w-4 h-4 rounded border-[#D0D5DD] text-[#0D83DE] focus:ring-2 focus:ring-[#0D83DE]/20 cursor-pointer"
                />
              </td>
              <td className="px-6 py-4 font-black text-[13px] text-[#101828] whitespace-nowrap cursor-pointer" onClick={() => handleRowClick(sub)}>{sub.numab}</td>
              <td className="px-6 py-4 font-medium text-[13px] text-[#101828] min-w-[200px] cursor-pointer" onClick={() => handleRowClick(sub)}>{sub.name}</td>
              <td className="px-6 py-4 font-medium text-[13px] text-[#667085] min-w-[200px] cursor-pointer" onClick={() => handleRowClick(sub)}>{sub.adresse}</td>
              <td className="px-6 py-4 font-bold text-[13px] text-[#0D83DE] whitespace-nowrap cursor-pointer" onClick={() => handleRowClick(sub)}>T-{sub.tournee}</td>
              <td className="px-4 py-4 font-medium text-[13px] text-[#667085] cursor-pointer" onClick={() => handleRowClick(sub)}>{sub.bloc}</td>
              <td className="px-4 py-4 font-medium text-[13px] text-[#667085] cursor-pointer" onClick={() => handleRowClick(sub)}>{sub.ndom}</td>
              <td className="px-6 py-4 font-medium text-[13px] text-[#475467] whitespace-nowrap cursor-pointer" onClick={() => handleRowClick(sub)}>{sub.numser}</td>
              <td className="px-6 py-4 font-bold text-[13px] text-[#101828] text-right cursor-pointer" onClick={() => handleRowClick(sub)}>{sub.nouvelx !== undefined ? sub.nouvelx.toLocaleString() : '—'}</td>
              <td className="px-6 py-4 font-medium text-[13px] text-[#667085] cursor-pointer" onClick={() => handleRowClick(sub)}>{sub.type}</td>
              <td className="px-6 py-4 cursor-pointer" onClick={() => handleRowClick(sub)}>{etatBadge(sub.etatcpt, sub.etat_label)}</td>
              {consecutiveEtatColumn && (
                <td className="px-6 py-4 text-right cursor-pointer" onClick={() => handleRowClick(sub)}>
                  <span className={`inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-lg text-[12px] font-black border ${
                    (sub[consecutiveEtatColumn.field] ?? 0) > 0
                      ? consecutiveEtatColumn.activeClass
                      : 'text-[#98A2B3] border-transparent'
                  }`}>
                    {sub[consecutiveEtatColumn.field] ?? 0}
                  </span>
                </td>
              )}
              <td className="px-6 py-4 text-right font-medium text-[13px] text-[#475467] cursor-pointer" onClick={() => handleRowClick(sub)}>{sub.numordre}</td>
            </tr>
          )) : (
            <tr>
              <td colSpan={consecutiveEtatColumn ? 13 : 12} className="px-8 py-8 text-center text-[#667085] font-medium">Aucun abonné trouvé.</td>
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

