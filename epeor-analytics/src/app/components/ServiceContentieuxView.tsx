"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  ChevronRight, Search, FileSpreadsheet, Printer, Users,
  ArrowUpDown, ArrowUp, ArrowDown, RefreshCw, FolderOpen, CheckCircle2,
} from "lucide-react";
import { apiUrlObject } from "../lib/api";
import { appendSecteurParam } from "./utils";
import { SecteurDropdown } from "./ui";
import { DossierJuridiquePanel } from "./DossierJuridiquePanel";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AbonneContentieux {
  numab: string;
  name: string;
  adresse: string;
  bloc: string;
  ndom: string;
  type_abon: string;
  type_abon_code: string;
  etat_cpt: string;
  etat_cpt_code: string;
  numser: string;
  tournee: string;
  derniere_date_paiement: string;
  raw_last_payment: string | null;
  nombre_creance: number;
  montant_creance: number;
  is_contentieux: boolean;
  date_transmission: string | null;
}

type SortDir = "asc" | "desc";

const SORT_NUMERIC = new Set(["nombre_creance", "montant_creance"]);
const PAGE_SIZE = 25;

// ─── Component ────────────────────────────────────────────────────────────────

export function ServiceContentieuxView({
  onBack,
  selectedSecteur = "",
  sectors = [],
  uniteLabel = "",
  onSecteurChange,
  sectorsLoading = false,
  allowAll = false,
}: any) {
  const secteurLabel = selectedSecteur
    ? (sectors.find((s: any) => s.code === selectedSecteur)?.libelle ?? selectedSecteur)
    : null;

  // ─── Data state ──────────────────────────────────────────────────
  const [rows, setRows] = useState<AbonneContentieux[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Table state ─────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<string>("nombre_creance");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // ─── Selection state ─────────────────────────────────────────────
  const [selectedNumabs, setSelectedNumabs] = useState<string[]>([]);

  // ─── Tab state ───────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"tous" | "transmis" | "dossiers">("tous");

  // ─── Panel state ─────────────────────────────────────────────────
  const [selectedDossierAbonne, setSelectedDossierAbonne] = useState<AbonneContentieux | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // ─── Dossiers tab state ──────────────────────────────────────────
  const [dossiers, setDossiers] = useState<any[]>([]);
  const [dossiersLoading, setDossiersLoading] = useState(false);
  const [dossierSearch, setDossierSearch] = useState("");
  const [dossierSortKey, setDossierSortKey] = useState("updated_at");
  const [dossierSortDir, setDossierSortDir] = useState<SortDir>("desc");
  const [dossierEtapeFilter, setDossierEtapeFilter] = useState("");
  const [dossierStatutFilter, setDossierStatutFilter] = useState("");

  // ─── Column filters ──────────────────────────────────────────────
  const [filterTypes, setFilterTypes] = useState<string[]>([]);
  const [filterEtats, setFilterEtats] = useState<string[]>([]);
  const [filterTournees, setFilterTournees] = useState<string[]>([]);

  // ─── Load data ───────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setRows([]);
    setPage(1);
    setSelectedNumabs([]);
    try {
      const url = apiUrlObject("/creances_abonnes");
      appendSecteurParam(url, selectedSecteur);
      const res = await fetch(url.toString());
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        // Keep only rows with at least 1 unpaid invoice
        const list: AbonneContentieux[] = (data.subscribers || []).filter(
          (s: AbonneContentieux) => s.nombre_creance > 0
        );
        setRows(list);
      }
    } catch {
      setError("Impossible de contacter le serveur backend.");
    } finally {
      setLoading(false);
    }
  }, [selectedSecteur]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Load dossiers ───────────────────────────────────────────────
  const loadDossiers = useCallback(async () => {
    setDossiersLoading(true);
    try {
      const res = await fetch(apiUrlObject("/api/dossiers").toString());
      const data = await res.json();
      setDossiers(data.dossiers || []);
    } catch {
      setDossiers([]);
    } finally {
      setDossiersLoading(false);
    }
  }, []);

  useEffect(() => { if (activeTab === "dossiers") loadDossiers(); }, [activeTab, loadDossiers]);

  // ─── Distinct filter options ─────────────────────────────────────
  const filterOptions = useMemo(() => ({
    types:    [...new Set(rows.map(r => r.type_abon).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr")),
    etats:    [...new Set(rows.map(r => r.etat_cpt).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr")),
    tournees: [...new Set(rows.map(r => r.tournee).filter(v => v && v !== "—"))].sort((a, b) => a.localeCompare(b, "fr", { numeric: true })),
  }), [rows]);

  // ─── Search + column filter + sort ───────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter(r => {
      if (q && !(
        r.numab?.toLowerCase().includes(q) ||
        r.name?.toLowerCase().includes(q) ||
        r.adresse?.toLowerCase().includes(q) ||
        r.tournee?.toLowerCase().includes(q)
      )) return false;
      if (filterTypes.length > 0 && !filterTypes.includes(r.type_abon)) return false;
      if (filterEtats.length > 0 && !filterEtats.includes(r.etat_cpt)) return false;
      if (filterTournees.length > 0 && !filterTournees.includes(r.tournee)) return false;
      
      if (activeTab === "transmis" && !r.is_contentieux) return false;
      
      return true;
    });
  }, [rows, search, filterTypes, filterEtats, filterTournees, activeTab]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a: any, b: any) => {
      let cmp = 0;
      if (sortKey === "raw_last_payment") {
        const va = a.raw_last_payment || "";
        const vb = b.raw_last_payment || "";
        if (!va && !vb) cmp = 0;
        else if (!va) cmp = 1;
        else if (!vb) cmp = -1;
        else cmp = va.localeCompare(vb);
      } else if (SORT_NUMERIC.has(sortKey)) {
        cmp = (Number(a[sortKey]) || 0) - (Number(b[sortKey]) || 0);
      } else {
        const va = (a[sortKey] ?? "").toString().toLowerCase();
        const vb = (b[sortKey] ?? "").toString().toLowerCase();
        cmp = va.localeCompare(vb, "fr", { numeric: true });
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const visibleNumabs = useMemo(() => paged.map(r => r.numab).filter(Boolean), [paged]);
  const allVisibleSelected = useMemo(() => visibleNumabs.length > 0 && visibleNumabs.every(id => selectedNumabs.includes(id)), [visibleNumabs, selectedNumabs]);
  const selectedCount = selectedNumabs.length;
  const selectedRows = useMemo(() => selectedCount > 0 ? sorted.filter(r => selectedNumabs.includes(r.numab)) : sorted, [selectedCount, selectedNumabs, sorted]);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
    setPage(1);
  };

  // ─── Totals ──────────────────────────────────────────────────────
  const totals = useMemo(() => ({
    abonnes: sorted.length,
    factures: sorted.reduce((a, r) => a + (r.nombre_creance || 0), 0),
    montant: sorted.reduce((a, r) => a + (r.montant_creance || 0), 0),
  }), [sorted]);

  const fmt = (n: number) =>
    new Intl.NumberFormat("fr-DZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      .format(n).replace(/[\u202F\u00A0]/g, " ") + " DA";

  // ─── Export CSV ──────────────────────────────────────────────────
  const exportCSV = () => {
    const header = ["Code Abonné", "Raison Sociale", "Adresse", "Bloc", "N° Dom", "Type Abonné", "État Cpt", "N° Série Cpt", "Tournée", "Date Dernier Paiement", "Nb Factures Impayées", "Montant Créance (DA)"];
    if (activeTab === "transmis") header.push("Date Transmission");
    
    const rowsData = selectedRows.map(r => {
      const row = [
        r.numab, r.name, r.adresse || "—", r.bloc || "—", r.ndom || "—",
        r.type_abon || "—", r.etat_cpt || "—", r.numser || "—",
        r.tournee || "—", r.derniere_date_paiement || "—",
        r.nombre_creance, r.montant_creance,
      ];
      if (activeTab === "transmis") {
        row.push(r.date_transmission ? new Date(r.date_transmission).toLocaleDateString('fr-DZ') : "—");
      }
      return row;
    });
    const csv = [header, ...rowsData]
      .map(row => row.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `service_contentieux_${selectedSecteur || "tout"}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // ─── Print ───────────────────────────────────────────────────────
  const handlePrint = () => {
    const fmtP = (n: number) =>
      new Intl.NumberFormat("fr-DZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        .format(n).replace(/[\u202F\u00A0]/g, " ") + " DA";
    const esc = (v: unknown) =>
      String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const rowsHtml = selectedRows.map((r, i) => `
      <tr>
        <td style="text-align:center;color:#98A2B3;font-weight:700;">${i + 1}</td>
        <td style="font-weight:800;">${esc(r.numab)}</td>
        <td style="font-weight:700;">${esc(r.name)}</td>
        <td>${esc(r.adresse)}</td>
        <td>${esc(r.bloc)}</td>
        <td>${esc(r.ndom)}</td>
        <td>${esc(r.type_abon)}</td>
        <td>${esc(r.etat_cpt)}</td>
        <td>${esc(r.numser)}</td>
        <td style="text-align:center;">${esc(r.tournee)}</td>
        <td>${esc(r.derniere_date_paiement)}</td>
        <td style="text-align:right;font-weight:700;color:#E11D48;">${fmtP(r.montant_creance || 0)}</td>
        <td style="text-align:center;font-weight:700;">${r.nombre_creance ?? 0}</td>
        ${activeTab === "transmis" ? `<td style="text-align:center;">${r.date_transmission ? new Date(r.date_transmission).toLocaleDateString('fr-DZ') : "—"}</td>` : ''}
      </tr>`).join("");

    const win = window.open("", "_blank");
    if (!win) { alert("Veuillez autoriser les popups pour imprimer."); return; }
    win.document.write(`<!DOCTYPE html><html><head>
      <title>Service Contentieux</title>
      <style>
        body { font-family: 'Inter', Arial, sans-serif; font-size: 9px; margin: 30px; color: #101828; }
        h1 { font-size: 16px; font-weight: 900; margin: 0 0 4px; }
        .sub { font-size: 10px; color: #667085; margin-bottom: 16px; }
        .totals { display: flex; gap: 24px; background: #F9FAFB; border: 1px solid #E4E7EC; border-radius: 8px; padding: 10px 16px; margin-bottom: 16px; }
        .tot-label { font-size: 8px; font-weight: 700; color: #98A2B3; text-transform: uppercase; }
        .tot-val { font-size: 13px; font-weight: 900; color: #101828; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #F9FAFB; font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: .05em; color: #667085; padding: 6px 8px; text-align: left; border-bottom: 1px solid #E4E7EC; }
        td { padding: 5px 8px; border-bottom: 1px solid #F2F4F7; font-size: 9px; }
        tr:nth-child(even) td { background: #FAFAFA; }
        @media print { @page { size: A4 landscape; margin: 0.5cm; } }
      </style>
    </head><body>
      <h1>Service Contentieux</h1>
      <div class="sub">${secteurLabel ? `Centre : ${esc(secteurLabel)}` : "Toute l'unité"} — ${selectedRows.length} abonné(s)</div>
      <div class="totals">
        <div><div class="tot-label">Abonnés</div><div class="tot-val">${selectedRows.length}</div></div>
        <div><div class="tot-label">Factures impayées</div><div class="tot-val">${selectedRows.reduce((a, s) => a + (s.nombre_creance || 0), 0)}</div></div>
        <div><div class="tot-label">Montant total</div><div class="tot-val">${fmtP(selectedRows.reduce((a, s) => a + (s.montant_creance || 0), 0))}</div></div>
      </div>
      <table>
        <thead><tr>
          <th>#</th><th>Code Abonné</th><th>Raison Sociale</th><th>Adresse</th>
          <th>Bloc</th><th>N°Dom</th><th>Type Abonné</th><th>État Cpt</th>
          <th>N° Série Cpt</th><th>Tournée</th><th>Dernier Paiement</th>
          <th style="text-align:right;">Montant Total</th><th style="text-align:center;">Nb Fact. Impayées</th>
          ${activeTab === "transmis" ? `<th style="text-align:center;">Date Transmission</th>` : ''}
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </body></html>`);
    win.document.close();
    win.print();
  };

  // ─── Sortable header helper ───────────────────────────────────────
  const Th = ({ label, field, align = "left", className = "" }: { label: string; field: string; align?: "left" | "center" | "right"; className?: string }) => {
    const active = sortKey === field;
    const Icon = active ? (sortDir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
      <th
        className={`py-4 px-3 text-${align} cursor-pointer select-none group whitespace-nowrap ${className}`}
        onClick={() => handleSort(field)}
      >
        <span className={`inline-flex items-center gap-1 ${align === "right" ? "justify-end w-full" : align === "center" ? "justify-center w-full" : ""}`}>
          <span className={`text-[11px] font-black uppercase tracking-wider ${active ? "text-brand-600" : "text-[#98A2B3] group-hover:text-[#475467]"}`}>{label}</span>
          <Icon size={10} className={active ? "text-brand-600" : "text-[#D0D5DD] group-hover:text-[#98A2B3]"} />
        </span>
      </th>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-in fade-in duration-300">

      {/* ── Header card ── */}
      <div
        className="page-card border"
        style={{ background: "var(--glass-bg, #fff)", borderColor: "var(--glass-border, #E4E7EC)", boxShadow: "var(--glass-shadow)" }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-bold text-[#667085] hover:text-[#101828] mb-4 transition-colors"
        >
          <ChevronRight className="rotate-180" size={16} /> Retour au tableau de bord
        </button>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="min-w-0">
            {/* Title with gradient */}
            <h2 className="page-title" style={{ background: "var(--gradient-accent)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              Service Contentieux
            </h2>
            <p className="text-sm text-[#667085] mt-1 font-medium">
              {secteurLabel
                ? `Centre : ${secteurLabel}`
                : "Toute l'unité — liste des abonnés avec factures impayées"}
            </p>
          </div>

          {/* Sector selector */}
          <div className="flex-shrink-0 w-full lg:w-64">
            <SecteurDropdown
              sectors={sectors}
              selectedSecteur={selectedSecteur}
              onSelect={onSecteurChange}
              uniteLabel={uniteLabel}
              loading={sectorsLoading}
              allowAll={allowAll}
            />
          </div>
        </div>

        {/* ── KPI totals ── */}
        {!loading && rows.length > 0 && (
          <div className="mt-5 grid grid-cols-3 gap-3">
            {[
              { label: "Abonnés concernés", value: totals.abonnes.toLocaleString("fr-DZ"), color: "var(--glow-blue)" },
              { label: "Factures impayées", value: totals.factures.toLocaleString("fr-DZ"), color: "var(--glow-rose)" },
              { label: "Montant total", value: fmt(totals.montant), color: "var(--glow-amber)" },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="rounded-2xl px-4 py-3 border"
                style={{ background: "var(--gradient-accent-soft)", borderColor: "var(--glass-border, #E4E7EC)" }}
              >
                <p className="text-[10px] font-black uppercase tracking-wider text-[#98A2B3]">{label}</p>
                <p className="text-base sm:text-lg font-black text-[#101828] tabular-nums mt-0.5" style={{ color: `rgb(var(--color-text-primary))` }}>{value}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Table card ── */}
      <div
        className="obat-card overflow-hidden"
        style={{ background: "var(--glass-bg, #fff)", borderColor: "var(--glass-border, #E4E7EC)" }}
      >
        {/* Tabs */}
        <div className="flex border-b border-[#F2F4F7] px-4 sm:px-6">
          <button
            onClick={() => { setActiveTab("tous"); setPage(1); }}
            className={`px-4 py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === "tous" ? "border-brand-500 text-brand-600" : "border-transparent text-[#667085] hover:text-[#344054]"}`}
          >
            Tous les abonnés
          </button>
          <button
            onClick={() => { setActiveTab("transmis"); setPage(1); }}
            className={`px-4 py-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === "transmis" ? "border-rose-500 text-rose-600" : "border-transparent text-[#667085] hover:text-[#344054]"}`}
          >
            Transmis Service Juridique
            {activeTab !== "transmis" && rows.filter(r => r.is_contentieux).length > 0 && (
              <span className="bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full text-[10px]">{rows.filter(r => r.is_contentieux).length}</span>
            )}
          </button>
          <button
            onClick={() => { setActiveTab("dossiers"); setDossierSearch(""); }}
            className={`px-4 py-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === "dossiers" ? "border-indigo-500 text-indigo-700" : "border-transparent text-[#667085] hover:text-[#344054]"}`}
          >
            <FolderOpen size={15} />
            Dossiers de Recouvrement
          </button>
        </div>

        {/* ══════════════════════════════════════════════════════════
            ONGLET : DOSSIERS DE RECOUVREMENT
        ══════════════════════════════════════════════════════════ */}
        {activeTab === "dossiers" && (() => {
          const STEPS = ["Amiable", "Mise en demeure", "Succession Notaire", "Tribunal"];
          const STATUT_COLORS: Record<string, string> = {
            "Actif": "bg-emerald-50 text-emerald-700 border-emerald-200",
            "Suspendu": "bg-amber-50 text-amber-700 border-amber-200",
            "Décédé": "bg-slate-100 text-slate-600 border-slate-300",
            "Héritier": "bg-indigo-50 text-indigo-700 border-indigo-200",
          };
          const ETAPE_COLORS: Record<string, string> = {
            "Amiable": "bg-sky-50 text-sky-700 border-sky-200",
            "Mise en demeure": "bg-amber-50 text-amber-700 border-amber-200",
            "Succession Notaire": "bg-indigo-50 text-indigo-700 border-indigo-200",
            "Tribunal": "bg-rose-50 text-rose-700 border-rose-200",
          };
          const filtered = dossiers.filter(d => {
            const q = dossierSearch.toLowerCase();
            if (q && !(d.numab?.toLowerCase().includes(q) || d.name?.toLowerCase().includes(q) || d.adresse?.toLowerCase().includes(q))) return false;
            if (dossierEtapeFilter && d.etape_recouvrement !== dossierEtapeFilter) return false;
            if (dossierStatutFilter && d.statut_abonne !== dossierStatutFilter) return false;
            return true;
          });
          const sortedD = [...filtered].sort((a: any, b: any) => {
            const va = (a[dossierSortKey] ?? "").toString().toLowerCase();
            const vb = (b[dossierSortKey] ?? "").toString().toLowerCase();
            return dossierSortDir === "asc" ? va.localeCompare(vb, "fr", { numeric: true }) : vb.localeCompare(va, "fr", { numeric: true });
          });
          const ThD = ({ label, field }: { label: string; field: string }) => {
            const active = dossierSortKey === field;
            const Icon = active ? (dossierSortDir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
            return (
              <th className="py-4 px-3 text-left cursor-pointer select-none group whitespace-nowrap" onClick={() => { if (dossierSortKey === field) setDossierSortDir(d => d === "asc" ? "desc" : "asc"); else { setDossierSortKey(field); setDossierSortDir("asc"); } }}>
                <span className="inline-flex items-center gap-1">
                  <span className={`text-[11px] font-black uppercase tracking-wider ${active ? "text-indigo-600" : "text-[#98A2B3] group-hover:text-[#475467]"}`}>{label}</span>
                  <Icon size={10} className={active ? "text-indigo-600" : "text-[#D0D5DD] group-hover:text-[#98A2B3]"} />
                </span>
              </th>
            );
          };
          return (
            <>
              {/* Dossiers toolbar */}
              <div className="px-4 sm:px-6 pt-5 pb-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 border-b border-[#F2F4F7]">
                <div className="relative flex-1 w-full sm:max-w-xs">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#98A2B3]" />
                  <input type="text" placeholder="Rechercher (code, nom…)" value={dossierSearch} onChange={e => setDossierSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-xs font-semibold rounded-xl border border-[#E4E7EC] bg-[#F9FAFB] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all" />
                </div>
                <div className="flex flex-wrap gap-2">
                  <select value={dossierEtapeFilter} onChange={e => setDossierEtapeFilter(e.target.value)} className="text-xs font-bold px-3 py-2 rounded-xl border border-[#E4E7EC] bg-[#F9FAFB] text-[#344054] focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer">
                    <option value="">Toutes les étapes</option>
                    {STEPS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <select value={dossierStatutFilter} onChange={e => setDossierStatutFilter(e.target.value)} className="text-xs font-bold px-3 py-2 rounded-xl border border-[#E4E7EC] bg-[#F9FAFB] text-[#344054] focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer">
                    <option value="">Tous les statuts</option>
                    {["Actif","Suspendu","Décédé","Héritier"].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <button onClick={loadDossiers} title="Actualiser" className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-[#E4E7EC] bg-[#F9FAFB] text-[#344054] hover:border-indigo-500 hover:text-indigo-600 transition-all ml-auto">
                  <RefreshCw size={13} className={dossiersLoading ? "animate-spin" : ""} />
                </button>
              </div>

              {/* Dossiers states */}
              {dossiersLoading && (
                <div className="py-20 flex flex-col items-center gap-4 text-[#98A2B3]"><div className="spinner-premium" /><p className="text-sm font-semibold">Chargement des dossiers…</p></div>
              )}
              {!dossiersLoading && sortedD.length === 0 && (
                <div className="py-20 flex flex-col items-center gap-3 text-[#98A2B3]">
                  <FolderOpen size={40} strokeWidth={1.2} />
                  <p className="text-sm font-semibold">Aucun dossier de recouvrement</p>
                  <p className="text-xs">Transmettez des abonnés au service juridique depuis l'onglet "Créances Abonnés".</p>
                </div>
              )}
              {!dossiersLoading && sortedD.length > 0 && (
                <div className="table-scroll">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[#F9FAFB] border-b border-[#E4E7EC]">
                        <th className="py-4 px-3 text-center text-[11px] font-black uppercase tracking-wider text-[#98A2B3] w-10">#</th>
                        <ThD label="Code Abonné" field="numab" />
                        <ThD label="Nom / Raison Sociale" field="name" />
                        <ThD label="Adresse" field="adresse" />
                        <ThD label="Tournée" field="tournee" />
                        <th className="py-4 px-3 text-center text-[11px] font-black uppercase tracking-wider text-[#98A2B3]">Statut Abonné</th>
                        <th className="py-4 px-3 text-center text-[11px] font-black uppercase tracking-wider text-[#98A2B3]">Étape Recouvrement</th>
                        <th className="py-4 px-3 text-center text-[11px] font-black uppercase tracking-wider text-[#98A2B3]">Démarches</th>
                        <ThD label="Date Transmission" field="date_transmission" />
                        <ThD label="Dernière MàJ" field="updated_at" />
                        <th className="py-4 px-3 text-center text-[11px] font-black uppercase tracking-wider text-[#98A2B3]">Dossier</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedD.map((d, i) => (
                        <tr key={d.numab} className="border-b border-[#F2F4F7] hover:bg-indigo-50/30 transition-colors cursor-pointer"
                          onClick={() => {
                            setSelectedDossierAbonne(d as any);
                            setIsPanelOpen(true);
                          }}>
                          <td className="py-3 px-3 text-center text-[#98A2B3] font-bold">{i + 1}</td>
                          <td className="py-3 px-3">
                            <span className="font-mono text-xs font-black text-[#101828] bg-[#F9FAFB] px-2 py-0.5 rounded-lg border border-[#E4E7EC]">{d.numab}</span>
                          </td>
                          <td className="py-3 px-3 max-w-[180px]">
                            <span className="font-bold text-[#344054] truncate block">{d.name || "—"}</span>
                          </td>
                          <td className="py-3 px-3 max-w-[160px]">
                            <span className="text-[#667085] truncate block">{d.adresse || "—"}</span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="inline-flex items-center justify-center w-9 h-6 rounded-lg text-[11px] font-black text-brand-600 bg-brand-50 border border-brand-100">{d.tournee || "—"}</span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black border ${STATUT_COLORS[d.statut_abonne] || "bg-gray-50 text-gray-600 border-gray-200"}`}>
                              {d.statut_abonne || "Actif"}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            {/* Progress indicator */}
                            <div className="flex flex-col items-center gap-1">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black border ${ETAPE_COLORS[d.etape_recouvrement] || "bg-gray-50 text-gray-600 border-gray-200"}`}>
                                {d.etape_recouvrement || "Amiable"}
                              </span>
                              <div className="flex items-center gap-0.5 mt-0.5">
                                {STEPS.map((step, idx) => {
                                  const curIdx = STEPS.indexOf(d.etape_recouvrement);
                                  return (
                                    <div key={step} className={`h-1 w-5 rounded-full transition-colors ${idx <= curIdx ? "bg-indigo-500" : "bg-gray-200"}`} title={step} />
                                  );
                                })}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <div className="flex flex-col gap-1 items-start">
                              {d.has_mise_en_demeure ? <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700"><CheckCircle2 size={10} /> Mise en demeure</span> : null}
                              {d.has_echeancier ? <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700"><CheckCircle2 size={10} /> Échéancier</span> : null}
                              {d.transmis_cours ? <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700"><CheckCircle2 size={10} /> Transmis cour</span> : null}
                              {!d.has_mise_en_demeure && !d.has_echeancier && !d.transmis_cours && <span className="text-[10px] text-[#98A2B3]">—</span>}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center text-[#667085] font-medium whitespace-nowrap">
                            {d.date_transmission ? new Date(d.date_transmission).toLocaleDateString('fr-DZ') : "—"}
                          </td>
                          <td className="py-3 px-3 text-center text-[#667085] font-medium whitespace-nowrap">
                            {d.updated_at ? new Date(d.updated_at).toLocaleDateString('fr-DZ') : "—"}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-100 transition-colors">
                              <FolderOpen size={11} /> Ouvrir
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {/* Summary footer */}
                  <div className="px-4 sm:px-6 py-4 border-t border-[#F2F4F7] flex items-center justify-between">
                    <p className="text-xs text-[#667085] font-semibold">{sortedD.length} dossier(s)</p>
                    <div className="flex gap-4 text-xs text-[#667085]">
                      {STEPS.map(step => {
                        const count = sortedD.filter(d => d.etape_recouvrement === step).length;
                        return count > 0 ? (
                          <span key={step} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold border ${ETAPE_COLORS[step]}`}>
                            {step}: {count}
                          </span>
                        ) : null;
                      })}
                    </div>
                  </div>
                </div>
              )}
            </>
          );
        })()}

        {/* ══════════════════════════════════════════════════════════
            ONGLETS : TOUS / TRANSMIS (existing content)
        ══════════════════════════════════════════════════════════ */}
        {activeTab !== "dossiers" && (
          <>
        {/* Toolbar */}
        <div className="px-4 sm:px-6 pt-5 pb-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 border-b border-[#F2F4F7]">
          {/* Search */}
          <div className="relative flex-1 w-full sm:max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#98A2B3]" />
            <input
              type="text"
              placeholder="Rechercher (code, nom, adresse…)"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-4 py-2 text-xs font-semibold rounded-xl border border-[#E4E7EC] bg-[#F9FAFB] focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all"
            />
          </div>

          {/* Column filters */}
          <div className="flex flex-wrap gap-2">
            {/* Type filter */}
            <select
              value=""
              onChange={e => { if (e.target.value && !filterTypes.includes(e.target.value)) { setFilterTypes(p => [...p, e.target.value]); setPage(1); } e.target.value = ""; }}
              className="text-xs font-bold px-3 py-2 rounded-xl border border-[#E4E7EC] bg-[#F9FAFB] text-[#344054] focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
            >
              <option value="">Type abonné…</option>
              {filterOptions.types.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {/* État filter */}
            <select
              value=""
              onChange={e => { if (e.target.value && !filterEtats.includes(e.target.value)) { setFilterEtats(p => [...p, e.target.value]); setPage(1); } e.target.value = ""; }}
              className="text-xs font-bold px-3 py-2 rounded-xl border border-[#E4E7EC] bg-[#F9FAFB] text-[#344054] focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
            >
              <option value="">État compte…</option>
              {filterOptions.etats.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
            {/* Tournée filter */}
            <select
              value=""
              onChange={e => { if (e.target.value && !filterTournees.includes(e.target.value)) { setFilterTournees(p => [...p, e.target.value]); setPage(1); } e.target.value = ""; }}
              className="text-xs font-bold px-3 py-2 rounded-xl border border-[#E4E7EC] bg-[#F9FAFB] text-[#344054] focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
            >
              <option value="">Tournée…</option>
              {filterOptions.tournees.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Actions */}
          <div className="flex gap-2 ml-auto">
            <button
              onClick={loadData}
              title="Actualiser"
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-[#E4E7EC] bg-[#F9FAFB] text-[#344054] hover:border-brand-500 hover:text-brand-600 transition-all"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={exportCSV}
              disabled={sorted.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-[#E4E7EC] bg-[#F9FAFB] text-[#344054] hover:border-brand-500 hover:text-brand-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FileSpreadsheet size={13} /> CSV ({selectedCount > 0 ? selectedCount : sorted.length})
            </button>
            <button
              onClick={handlePrint}
              disabled={sorted.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-[#E4E7EC] bg-[#F9FAFB] text-[#344054] hover:border-brand-500 hover:text-brand-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Printer size={13} /> Imprimer ({selectedCount > 0 ? selectedCount : sorted.length})
            </button>
          </div>
        </div>

        {/* Active filters chips */}
        {(filterTypes.length > 0 || filterEtats.length > 0 || filterTournees.length > 0) && (
          <div className="px-4 sm:px-6 py-2 flex flex-wrap gap-2 border-b border-[#F2F4F7]">
            {filterTypes.map(v => (
              <span key={v} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-50 text-brand-700 border border-brand-100">
                {v} <button onClick={() => setFilterTypes(p => p.filter(x => x !== v))} className="ml-0.5 hover:text-rose-500">×</button>
              </span>
            ))}
            {filterEtats.map(v => (
              <span key={v} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
                {v} <button onClick={() => setFilterEtats(p => p.filter(x => x !== v))} className="ml-0.5 hover:text-rose-500">×</button>
              </span>
            ))}
            {filterTournees.map(v => (
              <span key={v} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-100">
                T{v} <button onClick={() => setFilterTournees(p => p.filter(x => x !== v))} className="ml-0.5 hover:text-rose-500">×</button>
              </span>
            ))}
            <button
              onClick={() => { setFilterTypes([]); setFilterEtats([]); setFilterTournees([]); setPage(1); }}
              className="text-[10px] font-bold text-[#667085] hover:text-rose-600 transition-colors"
            >Effacer tout</button>
          </div>
        )}

        {/* ── Loading / Error / Empty states ── */}
        {loading && (
          <div className="py-20 flex flex-col items-center gap-4 text-[#98A2B3]">
            <div className="spinner-premium" />
            <p className="text-sm font-semibold">Chargement des données…</p>
          </div>
        )}

        {!loading && error && (
          <div className="py-16 flex flex-col items-center gap-3 text-rose-500">
            <p className="text-sm font-bold">Erreur : {error}</p>
            <button onClick={loadData} className="text-xs font-bold underline hover:text-rose-700">Réessayer</button>
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <div className="py-20 flex flex-col items-center gap-3 text-[#98A2B3]">
            <Users size={40} strokeWidth={1.2} />
            <p className="text-sm font-semibold">Aucun abonné avec factures impayées</p>
            <p className="text-xs">Vérifiez le centre sélectionné ou l'état des données.</p>
          </div>
        )}

        {!loading && !error && rows.length > 0 && (
          <>
            {/* Table */}
            <div className="table-scroll">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#F9FAFB] border-b border-[#E4E7EC]">
                    <th className="py-4 px-3 text-center w-10">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-[#D0D5DD] text-brand-600 focus:ring-brand-500 cursor-pointer"
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
                    <th className="py-4 px-3 text-center text-[11px] font-black uppercase tracking-wider text-[#98A2B3] w-10">#</th>
                    <Th label="Code Abonné"       field="numab" />
                    <Th label="Raison Sociale"    field="name" />
                    <Th label="Adresse"           field="adresse" />
                    <Th label="Bloc"              field="bloc" className="hidden lg:table-cell" />
                    <Th label="N°Dom"             field="ndom" className="hidden lg:table-cell" />
                    <Th label="Type Abonné"       field="type_abon" className="hidden md:table-cell" />
                    <Th label="État Cpt"          field="etat_cpt" />
                    <Th label="N° Série Cpt"      field="numser" className="hidden xl:table-cell" />
                    <Th label="Tournée"           field="tournee" align="center" />
                    <Th label="Dernier Paiement"  field="raw_last_payment" className="hidden md:table-cell" />
                    <Th label="Montant total (DA)" field="montant_creance" align="right" />
                    <Th label="Fact. Impayées"    field="nombre_creance" align="right" />
                    {activeTab === "transmis" && <Th label="Date Transmission" field="date_transmission" align="center" />}
                  </tr>
                </thead>
                <tbody>
                  {paged.map((r, i) => {
                    const globalIdx = (safePage - 1) * PAGE_SIZE + i + 1;
                    const isHigh = r.nombre_creance >= 5;
                    return (
                      <tr
                        key={r.numab}
                        onClick={(e) => {
                          if ((e.target as HTMLElement).tagName === 'INPUT') return;
                          if (activeTab === "transmis") {
                            setSelectedDossierAbonne(r);
                            setIsPanelOpen(true);
                          }
                        }}
                        className={`border-b border-[#F2F4F7] hover:bg-[#F9FAFB] transition-colors group ${activeTab === "transmis" ? "cursor-pointer" : ""}`}
                      >
                        <td className="py-3 px-3 text-center w-10">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-[#D0D5DD] text-brand-600 focus:ring-brand-500 cursor-pointer"
                            checked={selectedNumabs.includes(r.numab)}
                            onChange={() => {
                              setSelectedNumabs(prev =>
                                prev.includes(r.numab)
                                  ? prev.filter(id => id !== r.numab)
                                  : [...prev, r.numab]
                              );
                            }}
                          />
                        </td>
                        <td className="py-3 px-3 text-center text-[#98A2B3] font-bold">{globalIdx}</td>

                        {/* Code abonné */}
                        <td className="py-3 px-3">
                          <span className="font-black text-[#101828] tracking-wide">{r.numab}</span>
                        </td>

                        {/* Raison sociale */}
                        <td className="py-3 px-3 max-w-[180px]">
                          <span className="font-bold text-[#344054] truncate block">{r.name || "—"}</span>
                        </td>

                        {/* Adresse */}
                        <td className="py-3 px-3 max-w-[160px]">
                          <span className="text-[#667085] truncate block">{r.adresse || "—"}</span>
                        </td>

                        {/* Bloc */}
                        <td className="py-3 px-3 hidden lg:table-cell text-[#667085]">{r.bloc || "—"}</td>

                        {/* Ndom */}
                        <td className="py-3 px-3 hidden lg:table-cell text-[#667085]">{r.ndom || "—"}</td>

                        {/* Type abonné */}
                        <td className="py-3 px-3 hidden md:table-cell">
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F9FAFB] border border-[#E4E7EC] text-[#344054]">
                            {r.type_abon || "—"}
                          </span>
                        </td>

                        {/* État compte */}
                        <td className="py-3 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              r.etat_cpt_code === "10"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                : r.etat_cpt_code === "20"
                                ? "bg-amber-50 text-amber-700 border-amber-100"
                                : r.etat_cpt_code === "30"
                                ? "bg-rose-50 text-rose-700 border-rose-100"
                                : "bg-[#F9FAFB] text-[#667085] border-[#E4E7EC]"
                            }`}
                          >
                            {r.etat_cpt || "—"}
                          </span>
                        </td>

                        {/* N° série cpt */}
                        <td className="py-3 px-3 hidden xl:table-cell font-mono text-[#667085] text-[11px]">{r.numser || "—"}</td>

                        {/* Tournée */}
                        <td className="py-3 px-3 text-center">
                          <span className="inline-flex items-center justify-center w-9 h-6 rounded-lg text-[11px] font-black text-brand-600 bg-brand-50 border border-brand-100">
                            {r.tournee || "—"}
                          </span>
                        </td>

                        {/* Date dernier paiement */}
                        <td className="py-3 px-3 hidden md:table-cell text-[#667085] font-medium">
                          {r.derniere_date_paiement === "Aucun"
                            ? <span className="text-rose-500 font-bold">Aucun</span>
                            : r.derniere_date_paiement || "—"
                          }
                        </td>

                        {/* Montant total */}
                        <td className="py-3 px-3 text-right font-black text-rose-600 tabular-nums">
                          {fmt(r.montant_creance)}
                        </td>

                        {/* Nb factures impayées */}
                        <td className="py-3 px-3 text-right">
                          <span
                            className={`inline-flex items-center justify-center min-w-[2rem] h-6 rounded-lg text-[11px] font-black px-2 ${
                              isHigh
                                ? "bg-rose-100 text-rose-700 border border-rose-200"
                                : "bg-amber-50 text-amber-700 border border-amber-100"
                            }`}
                          >
                            {r.nombre_creance}
                          </span>
                        </td>

                        {/* Date transmission */}
                        {activeTab === "transmis" && (
                          <td className="py-3 px-3 text-center text-[#667085] font-medium whitespace-nowrap">
                            {r.date_transmission ? new Date(r.date_transmission).toLocaleDateString('fr-DZ') : "—"}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Pagination ── */}
            <div className="px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[#F2F4F7]">
              <p className="text-xs text-[#667085] font-semibold">
                {sorted.length} abonné(s) — page {safePage}/{totalPages}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(1)}
                  disabled={safePage === 1}
                  className="px-2.5 py-1.5 text-xs font-bold rounded-lg border border-[#E4E7EC] text-[#344054] hover:border-brand-500 hover:text-brand-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >«</button>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="px-2.5 py-1.5 text-xs font-bold rounded-lg border border-[#E4E7EC] text-[#344054] hover:border-brand-500 hover:text-brand-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >‹</button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let p: number;
                  if (totalPages <= 5) p = i + 1;
                  else if (safePage <= 3) p = i + 1;
                  else if (safePage >= totalPages - 2) p = totalPages - 4 + i;
                  else p = safePage - 2 + i;
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                        p === safePage
                          ? "border-brand-500 text-brand-600 bg-brand-50"
                          : "border-[#E4E7EC] text-[#344054] hover:border-brand-500 hover:text-brand-600"
                      }`}
                    >{p}</button>
                  );
                })}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  className="px-2.5 py-1.5 text-xs font-bold rounded-lg border border-[#E4E7EC] text-[#344054] hover:border-brand-500 hover:text-brand-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >›</button>
                <button
                  onClick={() => setPage(totalPages)}
                  disabled={safePage === totalPages}
                  className="px-2.5 py-1.5 text-xs font-bold rounded-lg border border-[#E4E7EC] text-[#344054] hover:border-brand-500 hover:text-brand-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >»</button>
              </div>
            </div>
          </>
        )}
        </> 
        )} {/* end activeTab !== dossiers */}
      </div>

      <DossierJuridiquePanel 
        isOpen={isPanelOpen}
        onClose={() => {
          setIsPanelOpen(false);
          // Reload dossiers in case changes were made
          if (activeTab === "dossiers") loadDossiers();
        }}
        abonne={selectedDossierAbonne}
      />
    </div>
  );
}
