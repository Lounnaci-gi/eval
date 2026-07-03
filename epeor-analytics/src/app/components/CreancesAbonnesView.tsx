"use client";

import { useEffect, useState, useMemo, useCallback, Fragment } from "react";
import {
  ChevronRight, ChevronDown, Search, Printer, MapPin, Calendar, Users, FileSpreadsheet,
} from "lucide-react";
import { apiUrlObject } from "../lib/api";
import { appendSecteurParam, showAlert } from "./utils";
import { SecteurDropdown } from "./ui";
import { escapeHtml } from "../../lib/escape";

const NUMERIC_SORT_KEYS = new Set(["montant_creance", "nombre_creance"]);

export function CreancesAbonnesView({
  onBack,
  selectedSecteur = '',
  sectors = [],
  uniteLabel = '',
  onSecteurChange,
  sectorsLoading = false,
  allowAll = false,
}: any) {
  const secteurLabel = selectedSecteur
    ? (sectors.find((s: { code: string; libelle: string }) => s.code === selectedSecteur)?.libelle ?? selectedSecteur)
    : null;

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

  const loadData = useCallback(async () => {
    setDataLoading(true);
    setError(null);
    setDataLoaded(false);
    setResults(null);
    setAllSubscribers([]);
    try {
      const url = apiUrlObject('/creances_abonnes');
      appendSecteurParam(url, selectedSecteur);
      const res = await fetch(url.toString());
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
  }, [selectedSecteur]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Day helper ──────────────────────────────────────────────────
  const daysSince = useCallback((raw: string | null): number | null => {
    if (!raw || raw.length !== 8) return null;
    try {
      const y = parseInt(raw.slice(0, 4));
      const m = parseInt(raw.slice(4, 6)) - 1;
      const d = parseInt(raw.slice(6, 8));
      const diff = Date.now() - new Date(y, m, d).getTime();
      return Math.floor(diff / 86400000);
    } catch { return null; }
  }, []);

  const toggleContentieux = async (s: any) => {
    const newVal = !s.is_contentieux;
    // Optimistic update
    setAllSubscribers(prev => prev.map(x => x.numab === s.numab ? { ...x, is_contentieux: newVal } : x));
    setResults(prev => prev ? prev.map(x => x.numab === s.numab ? { ...x, is_contentieux: newVal } : x) : null);

    try {
      const url = apiUrlObject(`/api/abonne/${s.numab}/legal_status`);
      const res = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_contentieux: newVal })
      });
      if (!res.ok) {
        throw new Error('Server error');
      }
    } catch (e) {
      // Revert on error
      setAllSubscribers(prev => prev.map(x => x.numab === s.numab ? { ...x, is_contentieux: !newVal } : x));
      setResults(prev => prev ? prev.map(x => x.numab === s.numab ? { ...x, is_contentieux: !newVal } : x) : null);
      void showAlert("Erreur lors de la mise à jour du statut juridique.", { icon: "error" });
    }
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
      void showAlert('Veuillez entrer un nombre entre 0 et 999', { icon: "warning" });
      return;
    }
    
    // Format as xxx (e.g., 002, 015, 123)
    const formatted = digits.padStart(3, '0');
    
    if (!customTournees.includes(formatted)) {
      setCustomTournees(prev => [...prev, formatted]);
      setNewTourneeInput('');
    } else {
      void showAlert(`${formatted} est déjà ajoutée`, { icon: "warning" });
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
    const header = ['Code Abonné', 'Nom / Raison Sociale', 'Adresse', 'Bloc', 'N° Dom', 'Type Abonné', 'Code Type', 'État Cpt', 'Code État', 'N° Série Compteur', 'Tournée', 'Dernier Paiement', 'Factures Impayées', 'Montant Créance (DA)', 'Statut'];
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
      s.montant_creance,
      s.is_contentieux ? 'Transmis service juridique' : ''
    ]);
    const csv = [header, ...rows].map(r => r.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `liste_creanciers_filtree.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // Utiliser escapeHtml centralisé (&, <, >, ", ', /) — importé depuis lib/escape
  // (pas de rédéfinition locale incomplète)

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
        (s: any, i: number) => {
          return `
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
          <td style="text-align:center;font-weight:700;color:${s.is_contentieux ? '#E11D48' : '#667085'}">${s.is_contentieux ? 'Transmis' : ''}</td>
          <td class="observation-cell"></td>
        </tr>`;
        }
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
              background-color: #f1f5f9;
              color: #101828;
              font-weight: 700;
              border-top: 1px solid #94a3b8;
              border-bottom: 1px solid #94a3b8;
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
                <th style="text-align:center">Statut</th>
                <th>Observation</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
            <tfoot>
              <tr>
                <td colspan="11" style="text-transform:uppercase;letter-spacing:0.05em;">TOTAL GÉNÉRAL — ${printTotals.count} abonné${printTotals.count !== 1 ? 's' : ''}</td>
                <td style="text-align:center;">${printTotals.factures.toLocaleString('fr-FR')}</td>
                <td style="text-align:right;color:#e11d48;">${montantFmt(printTotals.montant)}</td>
                <td colspan="2" class="observation-cell"></td>
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
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <h2 className="text-3xl font-black tracking-tight text-[#101828]">Créances Abonnés</h2>
            <p className="text-sm text-[#667085] mt-1 font-medium">
              {secteurLabel
                ? `Créanciers du centre ${secteurLabel} — filtres nominatifs ci-dessous`
                : 'Liste nominative des abonnés créanciers — toute l\'unité'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <SecteurDropdown
              sectors={sectors}
              selectedSecteur={selectedSecteur}
              onSelect={(code: string) => onSecteurChange?.(code)}
              uniteLabel={uniteLabel}
              loading={sectorsLoading}
              allowAll={allowAll}
            />
            {dataLoaded && !dataLoading && (
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-2 rounded-full border border-emerald-100">
                {allSubscribers.length} créancier{allSubscribers.length !== 1 ? 's' : ''}
              </span>
            )}
            {dataLoading && (
              <span className="text-xs font-bold text-[#667085] bg-[#F9FAFB] px-3 py-2 rounded-full border border-[#E4E7EC]">
                Chargement…
              </span>
            )}
          </div>
        </div>
      </div>

      {secteurLabel && !dataLoading && (
        <div className="flex items-center gap-3 px-5 py-3.5 bg-blue-50 border border-blue-100 rounded-2xl text-xs font-bold text-[#0D83DE] no-print">
          <MapPin size={16} className="shrink-0" />
          <span>
            Données limitées au centre <strong className="font-black">{secteurLabel}</strong>
            {uniteLabel ? ` (${uniteLabel})` : ''}. Changez de centre pour recharger la liste.
          </span>
        </div>
      )}

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
                    <Th label="Montant Créance" field="montant_creance" align="right" px="px-4" />
                    <Th label="Statut" field="statut" align="center" />
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
                        <td className="px-4 py-4 text-right font-black text-sm text-rose-600 font-mono whitespace-nowrap">{fmt(s.montant_creance)}</td>
                        <td className="px-4 py-4 text-center">
                          <button
                            type="button"
                            onClick={() => toggleContentieux(s)}
                            className={`inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-black border uppercase tracking-wider transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-brand-500 ${
                              s.is_contentieux
                                ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                                : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {s.is_contentieux ? 'Transmis' : 'Non transmis'}
                          </button>
                        </td>
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
                    <td className="px-4 py-5 text-right text-rose-400 font-mono text-sm">
                      {fmt(tableTotals.montant)}
                    </td>
                    <td className="px-4 py-5"></td>
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

