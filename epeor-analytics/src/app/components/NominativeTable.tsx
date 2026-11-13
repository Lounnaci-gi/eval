"use client";

import { useEffect, useRef, useState } from "react";
import { Printer } from "lucide-react";
import {
  Brush,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiUrl } from "../lib/api";
import { escapeHtml } from "../../lib/escape";

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

export function NominativeTable({ subscribers, loading, accentColor = "blue", consecutiveEtatColumn, selectedNumabs = [], onSelectedNumabsChange, printedSubscribersRef, onInvoiceViewChange, showInstitution = false }: { subscribers: any[]; loading: boolean; accentColor?: string; consecutiveEtatColumn?: { field: string; label: string; activeClass: string; hoverClass: string }; selectedNumabs?: string[]; onSelectedNumabsChange?: (numabs: string[]) => void; printedSubscribersRef?: any; onInvoiceViewChange?: (viewing: boolean) => void; showInstitution?: boolean }) {
  const [hoveredSub, setHoveredSub] = useState<any>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isViewingInvoices, setIsViewingInvoices] = useState(false);

  const handleInvoiceViewChange = (viewing: boolean) => {
    setIsViewingInvoices(viewing);
    if (onInvoiceViewChange) onInvoiceViewChange(viewing);
  };

  const accentMap: any = {
    blue: { spinner: "border-[#245A83]", badge: "bg-blue-50 text-[#245A83] border-blue-200", dot: "bg-[#245A83]" },
    rose: { spinner: "border-rose-500", badge: "bg-rose-50 text-rose-600 border-rose-200", dot: "bg-rose-500" },
    amber: { spinner: "border-amber-500", badge: "bg-amber-50 text-amber-600 border-amber-200", dot: "bg-amber-500" },
    cyan: { spinner: "border-cyan-500", badge: "bg-cyan-50 text-cyan-600 border-cyan-200", dot: "bg-cyan-500" },
  };
  const style = accentMap[accentColor] || accentMap.blue;
  void style;

  return (
    <div className="overflow-x-auto table-scroll relative">
      {/* Hover Tooltip Card — hidden while the invoice panel is open */}
      {hoveredSub && !isViewingInvoices && (
        <div
          className="fixed z-[9999] pointer-events-none transition-opacity duration-150"
          style={{ top: mousePos.y + 18, left: Math.min(mousePos.x + 18, window.innerWidth - 340) }}
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-[#E4E7EC] p-5 w-80">
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
            <div className="space-y-2.5">
              <div className="flex justify-between items-start gap-3">
                <span className="text-[10px] font-bold text-[#98A2B3] uppercase tracking-wider whitespace-nowrap">Adresse</span>
                <span className="text-[12px] font-medium text-[#475467] text-right leading-tight">
                  {[hoveredSub.adresse, hoveredSub.bloc ? `Bl. ${hoveredSub.bloc}` : '', hoveredSub.ndom ? `N°${hoveredSub.ndom}` : ''].filter(Boolean).join(' · ') || '—'}
                </span>
              </div>
              <div className="flex justify-between items-center gap-3">
                <span className="text-[10px] font-bold text-[#98A2B3] uppercase tracking-wider">Tournée</span>
                <span className="text-[12px] font-bold text-[#245A83]">{hoveredSub.tournee ? `T-${hoveredSub.tournee}` : '—'}</span>
              </div>
              <div className="flex justify-between items-center gap-3">
                <span className="text-[10px] font-bold text-[#98A2B3] uppercase tracking-wider">N° Série</span>
                <span className="text-[12px] font-medium text-[#475467]">{hoveredSub.numser || '—'}</span>
              </div>
              {hoveredSub.nouvelx != null && (
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
        <PaginatedNominativeTable subscribers={subscribers} style={style} setHoveredSub={setHoveredSub} setMousePos={setMousePos} consecutiveEtatColumn={consecutiveEtatColumn} selectedNumabs={selectedNumabs} onSelectedNumabsChange={onSelectedNumabsChange} printedSubscribersRef={printedSubscribersRef} onInvoiceViewChange={handleInvoiceViewChange} showInstitution={showInstitution} />
      )}
    </div>
  );
}


function PaginatedNominativeTable({ subscribers, style, setHoveredSub, setMousePos, consecutiveEtatColumn, selectedNumabs = [], onSelectedNumabsChange, printedSubscribersRef, onInvoiceViewChange, showInstitution = false }: any) {
  void style;
  const ITEMS_PER_PAGE = 20;
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<string>('numab');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [filterText, setFilterText] = useState('');
  const subscriberSearchRef = useRef<HTMLInputElement | null>(null);
  const [selectedSubForInvoices, setSelectedSubForInvoices] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [invoicePage, setInvoicePage] = useState(1);
  const [invoiceFilter, setInvoiceFilter] = useState<'ALL' | 'PAID' | 'UNPAID'>('ALL');
  const [invoiceChartTab, setInvoiceChartTab] = useState<'amount' | 'volume'>('amount');
  const [hoveredInvoicePeriod, setHoveredInvoicePeriod] = useState<string | null>(null);
  const INVOICES_PER_PAGE = 20;

  useEffect(() => {
    const applyQueuedSearch = () => {
      try {
      const queuedSearch = window.sessionStorage.getItem('epeor:subscriber-search');
      if (queuedSearch === null) return;
      window.sessionStorage.removeItem('epeor:subscriber-search');
      setFilterText(queuedSearch);
      requestAnimationFrame(() => subscriberSearchRef.current?.focus());
      } catch {
        // The subscriber list remains usable when session storage is unavailable.
      }
    };

    applyQueuedSearch();
    window.addEventListener('epeor:subscriber-search', applyQueuedSearch);
    return () => window.removeEventListener('epeor:subscriber-search', applyQueuedSearch);
  }, []);

  const handleRowClick = async (sub: any) => {
    setSelectedSubForInvoices(sub);
    setHoveredInvoicePeriod(null);
    if (onInvoiceViewChange) onInvoiceViewChange(true);
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
      (sub.institution || '').toLowerCase().includes(q) ||
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

    const invoiceChartData = filteredInvoices.map((inv: any) => ({
      period: formatDatFact(inv.DATFACT, inv.PERIODE),
      type: inv.TYPE || 'Facture',
      amount: Number(inv.MONTTC) || 0,
      volume: Number(inv.QTE) || 0,
    }));
    const isAmountChart = invoiceChartTab === 'amount';
    const chartDataKey = isAmountChart ? 'amount' : 'volume';
    const chartName = isAmountChart ? 'Montant TTC' : "Volume d'eau";
    const chartUnit = isAmountChart ? 'DA' : 'm³';
    const chartColor = isAmountChart ? '#245A83' : '#0F766E';

    const parseInvoiceDate = (value: unknown) => {
      const rawDate = String(value ?? '').trim();
      const match = rawDate.match(/^(\d{4})-?(\d{2})-?(\d{2})$/);
      if (!match || rawDate === '00000000' || rawDate === '19000101') return null;
      const [, year, month, day] = match;
      const timestamp = Date.UTC(Number(year), Number(month) - 1, Number(day));
      const dateValue = new Date(timestamp);
      if (dateValue.getUTCFullYear() !== Number(year) || dateValue.getUTCMonth() !== Number(month) - 1 || dateValue.getUTCDate() !== Number(day)) return null;
      return timestamp;
    };
    const now = new Date();
    const todayTimestamp = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const paymentDelayByInvoice = new Map<any, number | null>();
    for (const invoice of invoices) {
      const issuedAt = parseInvoiceDate(invoice.DATSAISIE);
      const registeredAt = parseInvoiceDate(invoice.DATREG);
      const isPaid = registeredAt !== null;
      const endDate = isPaid ? registeredAt : todayTimestamp;
      paymentDelayByInvoice.set(
        invoice,
        issuedAt === null ? null : Math.max(0, Math.floor((endDate - issuedAt) / 86_400_000))
      );
    }
    const analyzedPaymentDelays = Array.from(paymentDelayByInvoice.values())
      .filter((delay): delay is number => delay !== null);
    const averageInvoiceDelay = analyzedPaymentDelays.length
      ? analyzedPaymentDelays.reduce((sum, delay) => sum + delay, 0) / analyzedPaymentDelays.length
      : null;
    const maximumInvoiceDelay = analyzedPaymentDelays.length
      ? Math.max(...analyzedPaymentDelays)
      : null;
    const paymentRhythm = averageInvoiceDelay === null
      ? 0
      : averageInvoiceDelay <= 30
        ? 1
        : averageInvoiceDelay <= 40
          ? 2
          : averageInvoiceDelay <= 50
            ? 3
            : averageInvoiceDelay <= 60
              ? 4
              : 5;
    const paymentRhythmLabel = paymentRhythm === 0
      ? 'Données insuffisantes'
      : paymentRhythm === 5 && averageInvoiceDelay! > 90
        ? 'Récalcitrant (>90 j)'
        : ['Bon payeur', 'Payeur modéré', 'Retardataire', 'Mauvais payeur', 'Récalcitrant'][paymentRhythm - 1];
    const paymentRhythmClass = paymentRhythm === 0
      ? 'border-slate-200 bg-slate-100 text-slate-700'
      : [
      'border-emerald-200 bg-emerald-50 text-emerald-700',
      'border-sky-200 bg-sky-50 text-sky-700',
      'border-amber-200 bg-amber-50 text-amber-700',
      'border-rose-200 bg-rose-50 text-rose-700',
        'border-red-300 bg-red-100 text-red-800',
      ][paymentRhythm - 1];
    const historyPaidCount = invoices.filter((inv: any) => {
      const rawDate = String(inv.DATREG ?? '').trim();
      return rawDate !== '' && rawDate !== '00000000' && rawDate !== '19000101';
    }).length;
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
        doc.addImage(logoImg, "PNG", 40, 25, 150, 40);
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
          <button onClick={() => { setSelectedSubForInvoices(null); if (onInvoiceViewChange) onInvoiceViewChange(false); }} className="self-start flex items-center gap-2 text-sm font-bold text-[#667085] hover:text-[#101828] transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="rotate-180"><path d="m9 18 6-6-6-6" /></svg> Retour à la liste
          </button>

          <div className="flex items-center gap-2">
            <label htmlFor="invoice-filter" className="text-[11px] font-bold text-[#667085] uppercase tracking-wider">Filtrer :</label>
            <div className="relative">
              <select
                id="invoice-filter"
                value={invoiceFilter}
                onChange={(e) => { setInvoiceFilter(e.target.value as any); setInvoicePage(1); }}
                className="pl-3 pr-9 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs font-bold text-[#101828] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#245A83]/20 focus:border-[#245A83] transition-all cursor-pointer appearance-none"
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

        {!loadingInvoices && (
          <section aria-label="Régularité des paiements" className="border-b border-[#F2F4F7] bg-[#FCFCFD] px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-sm font-black text-[#101828]">Régularité des paiements</h3>
                <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-black ${paymentRhythmClass}`}>
                  {paymentRhythmLabel}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs sm:grid-cols-4">
                <div>
                  <span className="block text-[#667085]">Factures réglées</span>
                  <strong className="text-[#101828]">{historyPaidCount} / {invoices.length}</strong>
                </div>
                <div>
                  <span className="block text-[#667085]">Factures analysées</span>
                  <strong className="text-[#101828]">{analyzedPaymentDelays.length} / {invoices.length}</strong>
                </div>
                <div>
                  <span className="block text-[#667085]">Délai moyen</span>
                  <strong className="text-[#101828]">{averageInvoiceDelay === null ? '—' : `${Math.round(averageInvoiceDelay)} jours`}</strong>
                </div>
                <div>
                  <span className="block text-[#667085]">Délai maximum</span>
                  <strong className="text-[#101828]">{maximumInvoiceDelay === null ? '—' : `${maximumInvoiceDelay} jours`}</strong>
                </div>
              </div>
            </div>
          </section>
        )}

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
                  <th className="px-6 py-5 border-b border-[#F2F4F7] text-right">Délai depuis saisie</th>
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
                  const paymentDelay = paymentDelayByInvoice.get(inv);
                  return (
                    <tr
                      key={i}
                      onMouseEnter={() => setHoveredInvoicePeriod(formatDatFact(inv.DATFACT, inv.PERIODE))}
                      onMouseLeave={() => setHoveredInvoicePeriod(null)}
                      className={`transition-colors ${hoveredInvoicePeriod === formatDatFact(inv.DATFACT, inv.PERIODE) ? 'bg-signal-50' : 'hover:bg-[#F9FAFB]'}`}
                    >
                      <td className="px-6 py-4 font-bold text-[13px] text-[#101828]">{formatDatFact(inv.DATFACT, inv.PERIODE)}</td>
                      <td className="px-6 py-4 font-medium text-[13px] text-[#245A83] font-mono">{formatInvoiceRef(inv.DATFACT, inv.TYPE)}</td>
                      <td className="px-6 py-4 font-medium text-[13px] text-[#667085]">{inv.TYPE || '---'}</td>
                      <td className="px-6 py-4 font-black text-[13px] text-[#101828] text-right">{inv.MONTTC.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DA</td>
                      <td className="px-6 py-4 font-bold text-[12px] text-right text-[#475467]">
                        {paymentDelay === null || paymentDelay === undefined
                          ? '—'
                          : `${paymentDelay} j${isPaid ? '' : ' · en cours'}`}
                      </td>
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
                      <td className="px-6 py-4 font-mono text-[12px] text-[#667085] text-right">{String(inv.CHEQUE ?? '').trim() || '---'}</td>
                    </tr>
                  )
                }) : (
                  <tr>
                    <td colSpan={10} className="px-6 py-12 text-center text-[#667085] font-medium">Aucune facture trouvée avec ce filtre.</td>
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
                    <td colSpan={6} className="px-6 py-4 text-left text-xs text-emerald-600 font-medium">
                      ({totals.paidCount} facture{totals.paidCount > 1 ? 's' : ''})
                    </td>
                  </tr>
                  <tr className="bg-rose-50/40 font-bold border-t border-[#E4E7EC]">
                    <td colSpan={3} className="px-6 py-4 text-xs font-bold text-rose-800 uppercase tracking-wider">Total Factures Impayées</td>
                    <td className="px-6 py-4 text-right text-[13px] font-black text-rose-700 font-mono">
                      {totals.unpaidAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DA
                    </td>
                    <td colSpan={6} className="px-6 py-4 text-left text-xs text-rose-600 font-medium">
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

        {filteredInvoices.length > 0 && !loadingInvoices && (
          <section className="border-t border-[#F2F4F7] p-4 sm:p-6">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-black text-[#101828]">
                  Évolution {isAmountChart ? 'du montant' : "du volume d'eau"}
                </h3>
                <p className="mt-1 text-xs font-medium text-[#667085]">
                  Par facture · {filteredInvoices.length} points
                </p>
              </div>
              <div role="tablist" aria-label="Indicateur à afficher" className="inline-flex w-fit rounded-lg border border-[#E4E7EC] bg-[#F9FAFB] p-1">
                <button
                  id="invoice-chart-amount-tab"
                  type="button"
                  role="tab"
                  aria-selected={isAmountChart}
                  aria-controls="invoice-chart-panel"
                  onClick={() => setInvoiceChartTab('amount')}
                  className={`rounded-md px-3 py-2 text-xs font-bold transition-colors ${isAmountChart ? 'bg-white text-[#245A83] shadow-sm' : 'text-[#667085] hover:text-[#101828]'}`}
                >
                  Montant (DA)
                </button>
                <button
                  id="invoice-chart-volume-tab"
                  type="button"
                  role="tab"
                  aria-selected={!isAmountChart}
                  aria-controls="invoice-chart-panel"
                  onClick={() => setInvoiceChartTab('volume')}
                  className={`rounded-md px-3 py-2 text-xs font-bold transition-colors ${!isAmountChart ? 'bg-white text-[#0F766E] shadow-sm' : 'text-[#667085] hover:text-[#101828]'}`}
                >
                  Volume (m³)
                </button>
              </div>
            </div>
            <div id="invoice-chart-panel" role="tabpanel" aria-labelledby={isAmountChart ? 'invoice-chart-amount-tab' : 'invoice-chart-volume-tab'} className="overflow-x-auto">
              <div style={{ minWidth: Math.max(680, invoiceChartData.length * 52) }}>
                <ResponsiveContainer width="100%" height={320} minWidth={0}>
                  <ComposedChart
                    data={invoiceChartData}
                    margin={{ top: 8, right: 12, left: 8, bottom: 8 }}
                    onMouseMove={(state: any) => setHoveredInvoicePeriod(typeof state?.activeLabel === 'string' ? state.activeLabel : null)}
                    onMouseLeave={() => setHoveredInvoicePeriod(null)}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F2F4F7" />
                    <XAxis
                      dataKey="period"
                      interval={Math.max(0, Math.ceil(invoiceChartData.length / 12) - 1)}
                      tick={{ fontSize: 10, fill: '#667085' }}
                      tickMargin={10}
                    />
                    <YAxis
                      yAxisId={chartDataKey}
                      tickFormatter={(value) => Number(value).toLocaleString('fr-FR')}
                      tick={{ fontSize: 10, fill: '#667085' }}
                      width={72}
                    />
                    <Tooltip
                      labelFormatter={(label, payload) => {
                        const invoiceType = payload?.[0]?.payload?.type;
                        return invoiceType ? `${label} · ${invoiceType}` : label;
                      }}
                      formatter={(value) => [
                        `${Number(value ?? 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} ${chartUnit}`,
                        chartName,
                      ]}
                    />
                    <Brush dataKey="period" height={22} stroke="#98A2B3" travellerWidth={10} />
                    {hoveredInvoicePeriod && (
                      <ReferenceLine x={hoveredInvoicePeriod} stroke="#C66A3D" strokeDasharray="4 4" />
                    )}
                    <Line
                      yAxisId={chartDataKey}
                      type="monotone"
                      dataKey={chartDataKey}
                      name={chartName}
                      stroke={chartColor}
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: chartColor }}
                      activeDot={{ r: 5 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>
        )}
      </div>
    );
  }

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * ITEMS_PER_PAGE;
  const pageItems = sorted.slice(start, start + ITEMS_PER_PAGE);
  const selectedSubscribers = sorted.filter((sub: any) => selectedNumabs.includes(sub.numab));

  const handlePrintSelected = () => {
    if (selectedSubscribers.length === 0) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Veuillez autoriser les fenêtres pop-up pour pouvoir imprimer.");
      return;
    }

    const cell = (value: unknown) => escapeHtml(String(value ?? "—"));
    const rowsHtml = selectedSubscribers.map((sub: any) => `
      <tr>
        <td>${cell(sub.numab)}</td>
        <td>${cell(sub.name)}</td>
        <td>${cell([sub.adresse, sub.bloc ? `Bl. ${sub.bloc}` : "", sub.ndom ? `N°${sub.ndom}` : ""].filter(Boolean).join(" · ") || "—")}</td>
        <td>${cell(sub.tournee ? `T-${sub.tournee}` : "—")}</td>
        <td>${cell(sub.numser)}</td>
        <td>${cell(sub.nouvelx !== undefined ? Number(sub.nouvelx).toLocaleString("fr-FR") : "—")}</td>
        <td>${cell(sub.type)}</td>
        <td>${cell(sub.etat_label || sub.etatcpt)}</td>
      </tr>
    `).join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="fr">
        <head>
          <meta charset="utf-8" />
          <title>Abonnés sélectionnés</title>
          <style>
            body { font-family: 'Manrope', 'Segoe UI', sans-serif; color: #101828; margin: 24px; font-size: 11px; }
            .print-header { display: flex; justify-content: space-between; align-items: center; gap: 16px; border-bottom: 2px solid #F2F4F7; padding-bottom: 16px; margin-bottom: 18px; }
            .logo-section { display: flex; align-items: center; gap: 12px; }
            .logo-section img { height: 40px; width: auto; object-fit: contain; }
            .brand-name { color: #245A83; font-size: 14px; font-weight: 900; }
            .company-name { color: #667085; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
            .title-section { text-align: right; }
            h1 { font-size: 18px; margin: 0 0 6px; }
            p { color: #667085; margin: 0; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #D0D5DD; padding: 7px; text-align: left; }
            th { background: #F2F4F7; }
            tr { page-break-inside: avoid; }
            @media print { body { margin: 12mm; } }
          </style>
        </head>
        <body>
          <div class="print-header">
            <div class="logo-section">
              <img src="${window.location.origin}/ade.png" alt="Logo ADE" />
              <div>
                <div class="brand-name">EPEOR Analytics</div>
                <div class="company-name">Algérienne Des Eaux</div>
              </div>
            </div>
            <div class="title-section">
              <h1>Liste des abonnés sélectionnés</h1>
              <p>${selectedSubscribers.length} abonné${selectedSubscribers.length === 1 ? "" : "s"}</p>
              <p>Date d'édition : ${new Date().toLocaleDateString("fr-FR")}</p>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>N° Abonné</th><th>Nom / Raison sociale</th><th>Adresse</th><th>Tournée</th>
                <th>N° Série</th><th>Nouvel index</th><th>Type</th><th>État</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          <script>window.onload = function() { window.print(); };</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

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
            <span className={`text-[10px] transition-colors ${active ? 'text-[#245A83]' : 'text-[#D0D5DD] group-hover:text-[#98A2B3]'}`}>
              {active ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
            </span>
          )}
          <span className={`transition-colors ${active ? 'text-[#245A83]' : 'group-hover:text-[#101828]'}`}>{label}</span>
          {align !== 'right' && (
            <span className={`text-[10px] transition-colors ${active ? 'text-[#245A83]' : 'text-[#D0D5DD] group-hover:text-[#98A2B3]'}`}>
              {active ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
            </span>
          )}
        </span>
      </th>
    );
  };

  return (
    <>
      <div className="p-4 border-b border-[#F2F4F7] bg-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative max-w-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#98A2B3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>
          <input
            ref={subscriberSearchRef}
            aria-label="Rechercher un abonné"
            data-testid="subscriber-search"
            type="text"
            className="block w-full pl-9 pr-3 py-2 border border-[#E4E7EC] rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#245A83]/20 focus:border-[#245A83] outline-none transition-all placeholder-[#98A2B3]"
            placeholder="Rechercher un abonné (Nom, N° série...)"
            value={filterText}
            onChange={(e) => {
              setFilterText(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <button
          type="button"
          onClick={handlePrintSelected}
          disabled={selectedSubscribers.length === 0}
          className="no-print inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#245A83] hover:bg-[#1F4D70] active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:bg-[#D0D5DD] disabled:text-[#667085] disabled:shadow-none disabled:cursor-not-allowed"
          title={selectedSubscribers.length > 0 ? "Imprimer uniquement les abonnés sélectionnés" : "Cochez au moins un abonné pour l'imprimer"}
        >
          <Printer size={14} />
          Imprimer la sélection ({selectedSubscribers.length})
        </button>
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
                className="w-4 h-4 rounded border-[#D0D5DD] text-[#245A83] focus:ring-2 focus:ring-[#245A83]/20 cursor-pointer"
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
            {showInstitution && <Th label="Institution" field="institution" />}
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
                  className="w-4 h-4 rounded border-[#D0D5DD] text-[#245A83] focus:ring-2 focus:ring-[#245A83]/20 cursor-pointer"
                />
              </td>
              <td className="px-6 py-4 font-black text-[13px] text-[#101828] whitespace-nowrap cursor-pointer" onClick={() => handleRowClick(sub)}>{sub.numab}</td>
              <td className="px-6 py-4 font-medium text-[13px] text-[#101828] min-w-[200px] cursor-pointer" onClick={() => handleRowClick(sub)}>{sub.name}</td>
              <td className="px-6 py-4 font-medium text-[13px] text-[#667085] min-w-[200px] cursor-pointer" onClick={() => handleRowClick(sub)}>{sub.adresse}</td>
              <td className="px-6 py-4 font-bold text-[13px] text-[#245A83] whitespace-nowrap cursor-pointer" onClick={() => handleRowClick(sub)}>T-{sub.tournee}</td>
              <td className="px-4 py-4 font-medium text-[13px] text-[#667085] cursor-pointer" onClick={() => handleRowClick(sub)}>{sub.bloc}</td>
              <td className="px-4 py-4 font-medium text-[13px] text-[#667085] cursor-pointer" onClick={() => handleRowClick(sub)}>{sub.ndom}</td>
              <td className="px-6 py-4 font-medium text-[13px] text-[#475467] whitespace-nowrap cursor-pointer" onClick={() => handleRowClick(sub)}>{sub.numser}</td>
              <td className="px-6 py-4 font-bold text-[13px] text-[#101828] text-right cursor-pointer" onClick={() => handleRowClick(sub)}>{sub.nouvelx != null ? Number(sub.nouvelx).toLocaleString('fr-FR') : '—'}</td>
              <td className="px-6 py-4 font-medium text-[13px] text-[#667085] cursor-pointer" onClick={() => handleRowClick(sub)}>{sub.type}</td>
              {showInstitution && <td className="px-6 py-4 font-medium text-[13px] text-[#475467] min-w-[200px] cursor-pointer" onClick={() => handleRowClick(sub)}>{sub.institution || '—'}</td>}
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
            {sortKey && <span className="ml-2 text-[#245A83]">· Trié par {sortKey} ({sortDir === 'asc' ? '↑ ASC' : '↓ DESC'})</span>}
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
