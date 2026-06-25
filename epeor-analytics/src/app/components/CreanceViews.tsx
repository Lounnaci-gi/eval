"use client";

import { useEffect, useState, useRef, useMemo, useCallback, Fragment } from "react";
import { saveAs } from "file-saver";
import {
  ChevronRight, ChevronDown, Search, Printer, FileText, FileSpreadsheet,
  Percent, MapPin, BarChart3, Calendar, RefreshCw, CreditCard, Users, Ban, Database,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadialBarChart, RadialBar,
  PolarAngleAxis, ReferenceLine, LabelList, AreaChart, Area,
} from "recharts";
import { apiUrl, apiUrlObject } from "../lib/api";
import {
  ChartContainer, formatDate, formatPeriodLabel, appendSecteurParam,
} from "./utils";
import { SecteurDropdown, MultiSelectDropdown, FrenchDateInput } from "./ui";

export function CreanceDetailView({
  creanceData, setCreanceData, ventilationData, setVentilationData, lastVentDate, setLastVentDate,
  ventilationFilter, setVentilationFilter, onNavigateToRepartition, onNavigateToVentilation,
  onCalcDateChange, selectedSecteur = '', sectors = [], uniteLabel = ''
}: any) {

  const data = creanceData;
  const secteurLabel = selectedSecteur
    ? (sectors.find((s: { code: string; libelle: string }) => s.code === selectedSecteur)?.libelle ?? selectedSecteur)
    : null;
  const setData = setCreanceData;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [calcProgress, setCalcProgress] = useState(0);
  const [calcStep, setCalcStep] = useState("");
  const [categoryCounts, setCategoryCounts] = useState<{ id: string; label: string; value: number }[]>([]);
  const [categoryCountsLoading, setCategoryCountsLoading] = useState(false);
  const [categoryCountsPeriod, setCategoryCountsPeriod] = useState('');
  const [periodSubscriberTotal, setPeriodSubscriberTotal] = useState<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [activeHistoryMetric, setActiveHistoryMetric] = useState<'creance' | 'ca' | 'encaissement' | 'ca_recouvre' | 'objectif' | 'tableau'>('creance');

  const [histType, setHistType] = useState<'monthly_12' | 'years' | 'months' | 'days'>('monthly_12');
  const [histStartYear, setHistStartYear] = useState('2015');
  const [histEndYear, setHistEndYear] = useState(new Date().getFullYear().toString());
  const [histStartMonth, setHistStartMonth] = useState('01');
  const [histEndMonth, setHistEndMonth] = useState('12');
  const [histStartDate, setHistStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [histEndDate, setHistEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const formatMonthFr = (m: string) => {
    const months: Record<string, string> = {
      '01': 'Janvier', '02': 'Février', '03': 'Mars', '04': 'Avril', '05': 'Mai', '06': 'Juin',
      '07': 'Juillet', '08': 'Août', '09': 'Septembre', '10': 'Octobre', '11': 'Novembre', '12': 'Décembre'
    };
    return months[m] || m;
  };

  const formatPeriodLabel = (start: string, end: string) => {
    if (!start && !end) return 'Période calculée';
    if (start && end && start === end) {
      return `${formatMonthFr(start.slice(4, 6))} ${start.slice(0, 4)}`;
    }
    if (start && end) {
      return `${formatMonthFr(start.slice(4, 6))} ${start.slice(0, 4)} → ${formatMonthFr(end.slice(4, 6))} ${end.slice(0, 4)}`;
    }
    if (end) {
      return `Jusqu'au ${formatMonthFr(end.slice(4, 6))} ${end.slice(0, 4)}`;
    }
    return `À partir de ${formatMonthFr(start.slice(4, 6))} ${start.slice(0, 4)}`;
  };

  const loadCategoryCounts = async (start = '', end = '', signal?: AbortSignal) => {
    if (!start && !end) {
      setCategoryCounts([]);
      setCategoryCountsPeriod('');
      setPeriodSubscriberTotal(null);
      return;
    }

    setCategoryCountsLoading(true);
    setCategoryCountsPeriod(formatPeriodLabel(start, end));
    try {
      const url = apiUrlObject('/subscriber_category_counts');
      if (start) url.searchParams.append('start_date', start);
      if (end) url.searchParams.append('end_date', end);
      appendSecteurParam(url, selectedSecteur);
      const res = await fetch(url.toString(), { signal });
      if (!res.ok) return;
      const json = await res.json();
      if (!json?.ready) return;
      const categories = json?.communes?.reduce((acc: any[], commune: any) => {
        Object.entries(commune.categories || {}).forEach(([key, value]) => {
          const existing = acc.find(item => item.id === key);
          if (existing) {
            existing.value += Number(value || 0);
          } else {
            acc.push({ id: key, label: key === 'menages' ? 'Cat I' : key === 'administrations' ? 'Cat II' : key === 'commerce' ? 'Cat III' : key === 'industriel' ? 'Cat IV' : 'Cat V', value: Number(value || 0) });
          }
        });
        return acc;
      }, []);
      const ordered = [
        { id: 'menages', label: 'Cat I' },
        { id: 'administrations', label: 'Cat II' },
        { id: 'commerce', label: 'Cat III' },
        { id: 'industriel', label: 'Cat IV' },
        { id: 'vente_en_gros', label: 'Cat V' },
      ].map((item) => ({
        ...item,
        value: categories.find((cat: any) => cat.id === item.id)?.value || 0,
      }));
      setCategoryCounts(ordered);
      setPeriodSubscriberTotal(Number(json.total ?? ordered.reduce((sum, category) => sum + category.value, 0)));
    } catch (error: any) {
      if (error?.name === 'AbortError') return;
      console.error('Erreur chargement abonnés par catégorie :', error);
    } finally {
      setCategoryCountsLoading(false);
    }
  };

  const recoveryRate = data ? (data.total_ca > 0 ? ((data.total_ca_recouvre || 0) / data.total_ca) * 100 : 0) : 0;


  const fetchData = async (start = '', end = '') => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setData(null);
    setError(null);
    setLoading(true);
    setCategoryCounts([]);
    setCalcProgress(0);
    setCalcStep("Préparation du calcul...");
    loadCategoryCounts(start, end, controller.signal).catch(() => {});

    const targetFilter = ventilationFilter || 'ALL';
    setVentilationFilter(targetFilter);
    const ventDate = end || new Date().toISOString().split('T')[0];
    setLastVentDate(ventDate);

    try {
      // Step 1: Start Global KPIs
      setCalcStep("Calcul des indicateurs financiers globaux...");
      setCalcProgress(10);

      const url = apiUrlObject("/creance");
      if (start) url.searchParams.append("start_date", start.replace(/-/g, ''));
      if (end) url.searchParams.append("end_date", end.replace(/-/g, ''));
      appendSecteurParam(url, selectedSecteur);
      url.searchParams.append("hist_type", histType);
      if (histType === 'years') {
        url.searchParams.append("hist_start", histStartYear);
        url.searchParams.append("hist_end", histEndYear);
      } else if (histType === 'months') {
        url.searchParams.append("hist_start", `${histStartYear}${histStartMonth}`);
        url.searchParams.append("hist_end", `${histEndYear}${histEndMonth}`);
      } else if (histType === 'days') {
        url.searchParams.append("hist_start", histStartDate.replace(/-/g, ''));
        url.searchParams.append("hist_end", histEndDate.replace(/-/g, ''));
      }

      // We run them in sequence to show "real" progress as requested
      // though parallel is faster, the user wants to see the steps
      const res1 = await fetch(url.toString(), { signal: controller.signal });
      const d1 = await res1.json();
      setData(d1);
      setCalcProgress(50);

      // Step 2: Start Ventilation
      setCalcStep("Calcul de la ventilation par type d'abonné...");
      setCalcProgress(60);

      const ventUrl = apiUrlObject('/creance_detaillee');
      ventUrl.searchParams.set('date_arrete', ventDate.replace(/-/g, ''));
      appendSecteurParam(ventUrl, selectedSecteur);
      const res2 = await fetch(ventUrl.toString(), { signal: controller.signal });
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

    } catch (error: any) {
      if (error?.name === 'AbortError') {
        setCalcStep("Calcul annulé.");
        setError("Calcul annulé par l'utilisateur.");
      } else {
        setError("Erreur de connexion au serveur.");
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
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

      // 12 derniers mois : date d'arrêt = fin de période du dernier calcul
      if (histType === 'monthly_12' && !end) {
        const ventEnd = lastVentDate || dateRange.end;
        if (ventEnd) end = ventEnd.replace(/-/g, '');
      }

      const url = apiUrlObject("/creance");
      if (start) url.searchParams.append("start_date", start);
      if (end) url.searchParams.append("end_date", end);
      appendSecteurParam(url, selectedSecteur);
      url.searchParams.append("hist_type", histType);
      if (histType === 'years') {
        url.searchParams.append("hist_start", histStartYear);
        url.searchParams.append("hist_end", histEndYear);
      } else if (histType === 'months') {
        url.searchParams.append("hist_start", `${histStartYear}${histStartMonth}`);
        url.searchParams.append("hist_end", `${histEndYear}${histEndMonth}`);
      } else if (histType === 'days') {
        url.searchParams.append("hist_start", histStartDate.replace(/-/g, ''));
        url.searchParams.append("hist_end", histEndDate.replace(/-/g, ''));
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

  const historyWithObjective = data?.history?.map((row: any) => ({
    ...row,
    taux_objectif_atteint: row.taux_objectif_atteint != null
      ? row.taux_objectif_atteint
      : (row.creance_total + row.ca_eau) > 0
        ? (row.encaissement_total * 12 * 100) / (row.creance_total + row.ca_eau)
        : 0,
  })) || [];

  const [histView, setHistView] = useState<'chart' | 'table'>('chart');
  const printTable = () => {
    try {
      const table = document.getElementById('retrospective-table');
      if (!table) { window.print(); return; }
      const hwObj = (data?.history || []).map((row: any) => ({
        ...row,
        taux_objectif_atteint: row.taux_objectif_atteint != null
          ? row.taux_objectif_atteint
          : (row.creance_total + row.ca_eau) > 0
            ? (row.encaissement_total * 12 * 100) / (row.creance_total + row.ca_eau)
            : 0,
      }));
      const fmtDA = (n: number) =>
        new Intl.NumberFormat('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          .format(n).replace(/[\u202F\u00A0]/g, ' ') + ' DA';
      const centreSuffix = secteurLabel ? ` — centre ${secteurLabel}` : '';
      const periodLabel = histType === 'monthly_12'
        ? `12 derniers mois${centreSuffix}`
        : histType === 'years'
          ? `${histStartYear} → ${histEndYear}${centreSuffix}`
          : `${formatMonthFr(histStartMonth)} ${histStartYear} → ${formatMonthFr(histEndMonth)} ${histEndYear}${centreSuffix}`;
      const today = new Date();
      const dateStr = `${today.getDate().toString().padStart(2,'0')}/${(today.getMonth()+1).toString().padStart(2,'0')}/${today.getFullYear()}`;
      const origin = window.location.origin;
      const rows = hwObj.map((row: any) => {
        const tauxRecov = Number(row.ca_total) > 0
          ? (Number(row.ca_recouvre_total || 0) / Number(row.ca_total)) * 100 : 0;
        const bgColor = Number(row.taux_objectif_atteint) >= 90 ? '#F0FDF4' : '#FFF7ED';
        return `<tr style="background:${bgColor};">
          <td style="padding:4px 8px;border:1px solid #E4E7EC;white-space:nowrap;font-weight:700;">${row.label || row.month}</td>
          <td style="padding:4px 8px;border:1px solid #E4E7EC;text-align:right;white-space:nowrap;">${fmtDA(Number(row.ca_eau||0))}</td>
          <td style="padding:4px 8px;border:1px solid #E4E7EC;text-align:right;white-space:nowrap;">${fmtDA(Number(row.ca_prest||0))}</td>
          <td style="padding:4px 8px;border:1px solid #E4E7EC;text-align:right;white-space:nowrap;">${fmtDA(Number(row.ca_total||0))}</td>
          <td style="padding:4px 8px;border:1px solid #E4E7EC;text-align:right;white-space:nowrap;">${fmtDA(Number(row.ca_recouvre_total||0))}</td>
          <td style="padding:4px 8px;border:1px solid #E4E7EC;text-align:right;white-space:nowrap;">${fmtDA(Number(row.encaissement_total||0))}</td>
          <td style="padding:4px 8px;border:1px solid #E4E7EC;text-align:right;white-space:nowrap;">${fmtDA(Number(row.creance_total||0))}</td>
          <td style="padding:4px 8px;border:1px solid #E4E7EC;text-align:right;white-space:nowrap;">${tauxRecov.toFixed(2)}%</td>
          <td style="padding:4px 8px;border:1px solid #E4E7EC;text-align:right;white-space:nowrap;color:${Number(row.taux_objectif_atteint)>=90?'#16A34A':'#D97706'};font-weight:700;">${Number(row.taux_objectif_atteint).toFixed(2)}%</td>
        </tr>`;
      }).join('');
      const tableHtml = `<table style="width:100%;border-collapse:collapse;font-family:Inter,sans-serif;font-size:10px;">
        <thead><tr style="background:#F2F4F7;">
          <th style="padding:5px 8px;border:1px solid #E4E7EC;text-align:left;font-size:9px;font-weight:700;color:#667085;text-transform:uppercase;white-space:nowrap;">Période</th>
          <th style="padding:5px 8px;border:1px solid #E4E7EC;text-align:right;font-size:9px;font-weight:700;color:#667085;text-transform:uppercase;white-space:nowrap;">CA Eau</th>
          <th style="padding:5px 8px;border:1px solid #E4E7EC;text-align:right;font-size:9px;font-weight:700;color:#667085;text-transform:uppercase;white-space:nowrap;">CA Prestation</th>
          <th style="padding:5px 8px;border:1px solid #E4E7EC;text-align:right;font-size:9px;font-weight:700;color:#667085;text-transform:uppercase;white-space:nowrap;">CA Total</th>
          <th style="padding:5px 8px;border:1px solid #E4E7EC;text-align:right;font-size:9px;font-weight:700;color:#667085;text-transform:uppercase;white-space:nowrap;">CA Recouvré</th>
          <th style="padding:5px 8px;border:1px solid #E4E7EC;text-align:right;font-size:9px;font-weight:700;color:#667085;text-transform:uppercase;white-space:nowrap;">Encaissement</th>
          <th style="padding:5px 8px;border:1px solid #E4E7EC;text-align:right;font-size:9px;font-weight:700;color:#667085;text-transform:uppercase;white-space:nowrap;">Créance</th>
          <th style="padding:5px 8px;border:1px solid #E4E7EC;text-align:right;font-size:9px;font-weight:700;color:#667085;text-transform:uppercase;white-space:nowrap;">Taux Recov.</th>
          <th style="padding:5px 8px;border:1px solid #E4E7EC;text-align:right;font-size:9px;font-weight:700;color:#667085;text-transform:uppercase;white-space:nowrap;">Objectif atteint</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
      const w = window.open('', '_blank');
      if (!w) return;
      w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Tableau Rétrospectif</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap" rel="stylesheet">
        <style>
          *{box-sizing:border-box;margin:0;padding:0;}
          @page{size:A4 landscape;margin:12mm;}
          body{font-family:'Inter',sans-serif;background:white;color:#101828;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
          .hdr{display:flex;justify-content:space-between;align-items:center;padding-bottom:10px;border-bottom:2px solid #E4E7EC;margin-bottom:14px;}
        </style></head><body>
        <div class="hdr">
          <div style="display:flex;align-items:center;gap:12px;">
            <img src="${origin}/ade.png" style="height:40px;width:auto;object-fit:contain;">
            <div>
              <div style="font-size:13px;font-weight:900;color:#101828;">Tableau Détaillé des Indicateurs</div>
              <div style="font-size:9px;font-weight:600;color:#667085;margin-top:3px;">Période : ${periodLabel}</div>
              ${secteurLabel ? `<div style="display:inline-block;margin-top:5px;padding:2px 10px;background:#EBF5FF;border:1px solid #BFDBFE;border-radius:20px;font-size:9px;font-weight:800;color:#1D4ED8;letter-spacing:0.02em;">&#128205; Secteur : ${secteurLabel}</div>` : ''}
            </div>
          </div>
          <div style="text-align:right;font-size:8.5px;color:#98A2B3;font-weight:600;line-height:1.7;">
            <div>Édité le : ${dateStr}</div>
            <div>Unité : 26 — MEDEA | EPEOR Analytics</div>
          </div>
        </div>
        ${tableHtml}
        <script>window.onload=function(){setTimeout(function(){window.print();},600);};<\/script>
      </body></html>`);
      w.document.close();
    } catch (err) {
      console.error('Print failed', err);
      window.print();
    }
  };

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
      const W = 490, H = 210;
      const PAD = { top: 22, right: 16, bottom: 42, left: 62 };
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
          return `<circle cx="${cx}" cy="${cy}" r="3" fill="white" stroke="${stroke}" stroke-width="2" />`;
        }).join('');

      const yTicksSvg = Array.from({ length: 5 }, (_, i) => {
        const v = (maxV / 4) * i;
        const y = yOf(v).toFixed(1);
        return `<line x1="${PAD.left}" y1="${y}" x2="${W - PAD.right}" y2="${y}" stroke="#F2F4F7" stroke-width="1"/>
          <text x="${PAD.left - 5}" y="${Number(y) + 3}" text-anchor="end" font-size="7.5" fill="#98A2B3" font-family="Inter,sans-serif">${fmtV(v)}</text>`;
      }).join('');

      const step = n <= 14 ? 1 : n <= 30 ? 2 : n <= 60 ? 4 : Math.ceil(n / 14);
      const xTicksSvg = history.map((d: any, i: number) => {
        if (i % step !== 0 && i !== n - 1) return '';
        return `<text x="${xOf(i).toFixed(1)}" y="${H - PAD.bottom + 11}" text-anchor="middle" font-size="7.5" fill="#667085" font-family="Inter,sans-serif" font-weight="600">${d.month}</text>`;
      }).join('');

      return `<div style="background:#fff;border:1px solid #E4E7EC;border-radius:10px;padding:10px 14px 8px;page-break-inside:avoid;">
          <div style="font-family:Inter,sans-serif;font-size:10px;font-weight:900;color:#101828;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;">
            <span>${title}</span>
            <span style="display:flex;gap:8px;font-size:8px;font-weight:700;color:#667085;align-items:center;">
              <span style="display:flex;align-items:center;gap:2px;"><span style="display:inline-block;width:14px;height:2px;background:#0D83DE;border-radius:2px;"></span>Eau</span>
              <span style="display:flex;align-items:center;gap:2px;"><span style="display:inline-block;width:14px;height:2px;background:${colorPrest};border-radius:2px;"></span>Prestations</span>
              <span style="display:flex;align-items:center;gap:2px;"><span style="display:inline-block;width:14px;height:0;border-top:2px dashed #10B981;"></span>Total</span>
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

    const buildSvgTauxObjectifChart = () => {
      const hwObj = (data?.history || []).map((row: any) => ({
        ...row,
        taux_objectif_atteint: row.taux_objectif_atteint != null
          ? row.taux_objectif_atteint
          : (row.creance_total + row.ca_eau) > 0
            ? (row.encaissement_total * 12 * 100) / (row.creance_total + row.ca_eau)
            : 0,
      }));
      const W = 900, H = 300;
      const PAD = { top: 28, right: 60, bottom: 48, left: 55 };
      const chartW = W - PAD.left - PAD.right;
      const chartH = H - PAD.top - PAD.bottom;
      const n = hwObj.length;
      const maxV = Math.max(...hwObj.map((d: any) => Number(d.taux_objectif_atteint || 0)), 100);

      const xOf = (i: number) => PAD.left + (n <= 1 ? chartW / 2 : (i / (n - 1)) * chartW);
      const yOf = (v: number) => PAD.top + chartH - (v / maxV) * chartH;

      const pts = hwObj.map((d: any, i: number) =>
        `${xOf(i).toFixed(1)},${yOf(Number(d.taux_objectif_atteint || 0)).toFixed(1)}`
      ).join(' ');

      const dots = hwObj.map((d: any, i: number) => {
        const cx = xOf(i).toFixed(1);
        const cy = yOf(Number(d.taux_objectif_atteint || 0)).toFixed(1);
        return `<circle cx="${cx}" cy="${cy}" r="4" fill="white" stroke="#F59E0B" stroke-width="2.5" />`;
      }).join('');

      const y90 = yOf(90).toFixed(1);
      const refLine = `<line x1="${PAD.left}" y1="${y90}" x2="${W - PAD.right}" y2="${y90}" stroke="#F59E0B" stroke-width="1.5" stroke-dasharray="6 4"/>
        <text x="${W - PAD.right + 4}" y="${Number(y90) + 4}" font-size="9" fill="#F59E0B" font-weight="700" font-family="Inter,sans-serif">Seuil 90%</text>`;

      const yTicksSvg = Array.from({ length: 6 }, (_, i) => {
        const v = (maxV / 5) * i;
        const y = yOf(v).toFixed(1);
        return `<line x1="${PAD.left}" y1="${y}" x2="${W - PAD.right}" y2="${y}" stroke="#F2F4F7" stroke-width="1"/>
          <text x="${PAD.left - 6}" y="${Number(y) + 3.5}" text-anchor="end" font-size="9" fill="#98A2B3" font-family="Inter,sans-serif">${v.toFixed(0)}%</text>`;
      }).join('');

      const step = n <= 14 ? 1 : n <= 30 ? 2 : n <= 60 ? 4 : Math.ceil(n / 14);
      const xTicksSvg = hwObj.map((d: any, i: number) => {
        if (i % step !== 0 && i !== n - 1) return '';
        return `<text x="${xOf(i).toFixed(1)}" y="${H - PAD.bottom + 14}" text-anchor="middle" font-size="9" fill="#667085" font-family="Inter,sans-serif" font-weight="600">${d.month}</text>`;
      }).join('');

      return `<div style="background:#fff;border:1px solid #E4E7EC;border-radius:10px;padding:16px 18px 12px;">
          <div style="font-family:Inter,sans-serif;font-size:12px;font-weight:900;color:#101828;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;">
            <span>Taux Objectif Atteint (%)</span>
            <span style="display:flex;align-items:center;gap:10px;font-size:9px;font-weight:700;color:#F59E0B;">
              <span style="display:inline-block;width:20px;height:2.5px;background:#F59E0B;border-radius:2px;"></span>Taux Objectif &nbsp;
              <span style="display:inline-block;width:20px;height:0;border-top:2px dashed #F59E0B;"></span>Seuil 90%
            </span>
          </div>
          <svg width="100%" viewBox="0 0 ${W} ${H}" style="overflow:visible;display:block;">
            ${yTicksSvg}
            ${xTicksSvg}
            <line x1="${PAD.left}" y1="${PAD.top}" x2="${PAD.left}" y2="${PAD.top + chartH}" stroke="#E4E7EC" stroke-width="1"/>
            ${refLine}
            <polyline points="${pts}" fill="none" stroke="#F59E0B" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            ${dots}
          </svg>
        </div>`;
    };

    const buildTableHtml = () => {
      const hwObj = (data?.history || []).map((row: any) => ({
        ...row,
        taux_objectif_atteint: row.taux_objectif_atteint != null
          ? row.taux_objectif_atteint
          : (row.creance_total + row.ca_eau) > 0
            ? (row.encaissement_total * 12 * 100) / (row.creance_total + row.ca_eau)
            : 0,
      }));
      const fmtDA = (n: number) =>
        new Intl.NumberFormat('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          .format(n).replace(/[\u202F\u00A0]/g, ' ') + ' DA';
      const rows = hwObj.map((row: any) => {
        const tauxRecov = Number(row.ca_total) > 0
          ? (Number(row.ca_recouvre_total || 0) / Number(row.ca_total)) * 100 : 0;
        const bgColor = Number(row.taux_objectif_atteint) >= 90 ? '#F0FDF4' : '#FFF7ED';
        return `<tr style="background:${bgColor};">
          <td style="padding:4px 8px;border:1px solid #E4E7EC;white-space:nowrap;font-weight:700;">${row.label || row.month}</td>
          <td style="padding:4px 8px;border:1px solid #E4E7EC;text-align:right;white-space:nowrap;">${fmtDA(Number(row.ca_eau||0))}</td>
          <td style="padding:4px 8px;border:1px solid #E4E7EC;text-align:right;white-space:nowrap;">${fmtDA(Number(row.ca_prest||0))}</td>
          <td style="padding:4px 8px;border:1px solid #E4E7EC;text-align:right;white-space:nowrap;">${fmtDA(Number(row.ca_total||0))}</td>
          <td style="padding:4px 8px;border:1px solid #E4E7EC;text-align:right;white-space:nowrap;">${fmtDA(Number(row.ca_recouvre_total||0))}</td>
          <td style="padding:4px 8px;border:1px solid #E4E7EC;text-align:right;white-space:nowrap;">${fmtDA(Number(row.encaissement_total||0))}</td>
          <td style="padding:4px 8px;border:1px solid #E4E7EC;text-align:right;white-space:nowrap;">${fmtDA(Number(row.creance_total||0))}</td>
          <td style="padding:4px 8px;border:1px solid #E4E7EC;text-align:right;white-space:nowrap;">${tauxRecov.toFixed(2)}%</td>
          <td style="padding:4px 8px;border:1px solid #E4E7EC;text-align:right;white-space:nowrap;color:${Number(row.taux_objectif_atteint)>=90?'#16A34A':'#D97706'};font-weight:700;">${Number(row.taux_objectif_atteint).toFixed(2)}%</td>
        </tr>`;
      }).join('');
      return `<table style="width:100%;border-collapse:collapse;font-family:Inter,sans-serif;font-size:10px;">
        <thead><tr style="background:#F2F4F7;">
          <th style="padding:5px 8px;border:1px solid #E4E7EC;text-align:left;font-size:9px;font-weight:700;color:#667085;text-transform:uppercase;white-space:nowrap;">Période</th>
          <th style="padding:5px 8px;border:1px solid #E4E7EC;text-align:right;font-size:9px;font-weight:700;color:#667085;text-transform:uppercase;white-space:nowrap;">CA Eau</th>
          <th style="padding:5px 8px;border:1px solid #E4E7EC;text-align:right;font-size:9px;font-weight:700;color:#667085;text-transform:uppercase;white-space:nowrap;">CA Prestation</th>
          <th style="padding:5px 8px;border:1px solid #E4E7EC;text-align:right;font-size:9px;font-weight:700;color:#667085;text-transform:uppercase;white-space:nowrap;">CA Total</th>
          <th style="padding:5px 8px;border:1px solid #E4E7EC;text-align:right;font-size:9px;font-weight:700;color:#667085;text-transform:uppercase;white-space:nowrap;">CA Recouvré</th>
          <th style="padding:5px 8px;border:1px solid #E4E7EC;text-align:right;font-size:9px;font-weight:700;color:#667085;text-transform:uppercase;white-space:nowrap;">Encaissement</th>
          <th style="padding:5px 8px;border:1px solid #E4E7EC;text-align:right;font-size:9px;font-weight:700;color:#667085;text-transform:uppercase;white-space:nowrap;">Créance</th>
          <th style="padding:5px 8px;border:1px solid #E4E7EC;text-align:right;font-size:9px;font-weight:700;color:#667085;text-transform:uppercase;white-space:nowrap;">Taux Recov.</th>
          <th style="padding:5px 8px;border:1px solid #E4E7EC;text-align:right;font-size:9px;font-weight:700;color:#667085;text-transform:uppercase;white-space:nowrap;">Objectif atteint</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
    };

    const centreSuffix = secteurLabel ? ` — centre ${secteurLabel}` : '';
    const periodLabel = histType === 'monthly_12'
      ? `12 derniers mois (arrêtés au ${lastVentDate ? lastVentDate.replace(/(\d{4})(\d{2})(\d{2})/, '$3/$2/$1') : '...'})${centreSuffix}`
      : histType === 'years'
        ? `${histStartYear} → ${histEndYear}${centreSuffix}`
        : `${formatMonthFr(histStartMonth)} ${histStartYear} → ${formatMonthFr(histEndMonth)} ${histEndYear}${centreSuffix}`;

    const today = new Date();
    const dateStr = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
    const origin = window.location.origin;

    const chartCA      = buildSvgChart("Chiffre d'Affaires", '#F59E0B', 'ca_eau', 'ca_prest', 'ca_total');
    const chartCreance = buildSvgChart("Créances", '#E11D48', 'creance_eau', 'creance_prest', 'creance_total');
    const chartEnc     = buildSvgChart("Encaissements", '#10B981', 'encaissement_eau', 'encaissement_prest', 'encaissement_total');
    const chartCARec   = buildSvgChart("CA Recouvré", '#8B5CF6', 'ca_recouvre_eau', 'ca_recouvre_prest', 'ca_recouvre_total');
    const chartTaux    = buildSvgTauxObjectifChart();
    const tableHtml    = buildTableHtml();

    const mkHeader = (pageTitle: string) => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:10px;border-bottom:2px solid #E4E7EC;margin-bottom:14px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <img src="${origin}/ade.png" style="height:42px;width:auto;object-fit:contain;">
          <div>
            <div style="font-family:Inter,sans-serif;font-size:13px;font-weight:900;color:#101828;">${pageTitle}</div>
            <div style="font-family:Inter,sans-serif;font-size:9px;font-weight:600;color:#667085;margin-top:3px;">Période : ${periodLabel}</div>
            ${secteurLabel ? `<div style="display:inline-block;margin-top:5px;padding:2px 10px;background:#EBF5FF;border:1px solid #BFDBFE;border-radius:20px;font-family:Inter,sans-serif;font-size:9px;font-weight:800;color:#1D4ED8;letter-spacing:0.02em;">&#128205; Secteur : ${secteurLabel}</div>` : ''}
          </div>
        </div>
        <div style="text-align:right;font-family:Inter,sans-serif;font-size:8.5px;color:#98A2B3;font-weight:600;line-height:1.7;">
          <div>Édité le : ${dateStr}</div>
          <div>Unité : 26 — MEDEA &nbsp;|&nbsp; EPEOR Analytics</div>
        </div>
      </div>`;

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
    @page{size:A4 landscape;margin:12mm;}
    body{font-family:'Inter',sans-serif;background:white;color:#101828;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
    .print-page{width:100%;page-break-after:always;overflow:hidden;}
    .print-page:last-child{page-break-after:auto;}
    .charts-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
  </style>
</head>
<body>
  <div class="print-page">
    ${mkHeader('Analyse Rétrospective des Indicateurs Financiers')}
    <div class="charts-grid">
      ${chartCA}
      ${chartCreance}
      ${chartEnc}
      ${chartCARec}
    </div>
  </div>
  <div class="print-page">
    ${mkHeader('Courbe Taux Objectif Atteint')}
    ${chartTaux}
  </div>
  <div class="print-page">
    ${mkHeader('Tableau Détaillé des Indicateurs')}
    ${tableHtml}
  </div>
  <script>window.onload=function(){setTimeout(function(){window.print();},800);};<\/script>
</body>
</html>`);
    printWindow.document.close();
  };

  return (
    <div className="space-y-10">
      {secteurLabel && (
        <div className="flex items-center gap-3 px-5 py-3.5 bg-blue-50 border border-blue-100 rounded-2xl text-xs font-bold text-[#0D83DE]">
          <MapPin size={16} className="shrink-0" />
          <span>
            Périmètre : centre <strong className="font-black">{secteurLabel}</strong>
            {uniteLabel ? ` — unité ${uniteLabel}` : ''}. Relancez <strong>Calculer</strong> après un changement de centre.
          </span>
        </div>
      )}
      {/* Header */}
      <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] p-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="flex flex-col md:flex-row md:items-end gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-[#98A2B3] uppercase px-1">Année</label>
              <div className="flex items-center gap-2">
                <input
                  list="years-list"
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                  placeholder="Entrez une année ou choisissez"
                  className="block w-full md:w-32 bg-[#F9FAFB] border border-[#E4E7EC] rounded-xl px-4 py-2.5 text-xs font-bold text-[#101828] outline-none hover:border-[#D0D5DD] transition-all"
                />
                <datalist id="years-list">
                  <option value="all">Toutes</option>
                  {Array.from({ length: 30 }, (_, i) => (new Date().getFullYear() - i).toString()).map(year => (
                    <option key={year} value={year} />
                  ))}
                </datalist>
                <button type="button" onClick={() => setFilterYear('all')}
                  className="hidden md:inline-block px-3 py-2 rounded-xl text-[10px] font-black bg-white text-[#0D83DE] border border-[#E4E7EC]">
                  Toutes
                </button>
              </div>
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
              <div className="flex flex-col md:flex-row justify-between items-center gap-3">
                <span className="text-[9px] font-black text-[#98A2B3] uppercase tracking-widest">Traitement Big Data</span>
                <span className="text-[9px] font-black text-brand-600 uppercase tracking-widest">Calcul Optimisé</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                abortControllerRef.current?.abort();
                setCalcStep("Annulation en cours...");
              }}
              className="px-6 py-2 rounded-full border border-rose-200 bg-rose-50 text-rose-700 font-bold text-xs uppercase tracking-widest hover:bg-rose-100 transition-colors"
            >
              Annuler le calcul
            </button>
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
          <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-6">
            {(() => {
              const encaissement = data.total_recouvre || 0;
              const creance = data.total_creance || 0;
              const caEau = data.total_ca_eau || 0;
              const objectifBase = (creance + caEau) / 12;
              const tauxObjectifAtteint = objectifBase > 0 ? ((encaissement / objectifBase) * 100).toFixed(2) : "0.00";

              return [
                { label: "CA Eau", value: fmt(data.total_ca_eau), color: "bg-blue-50 text-blue-600", dot: "bg-blue-500" },
                { label: "CA Prestation", value: fmt(data.total_ca_prestation), color: "bg-cyan-50 text-cyan-600", dot: "bg-cyan-500" },
                { label: "CA Total", value: fmt(data.total_ca), color: "bg-brand-50 text-brand-600", dot: "bg-brand-500" },
                { label: "CA Recouvré", value: fmt(data.total_ca_recouvre || 0), color: "bg-teal-50 text-teal-600", dot: "bg-teal-500" },
                { label: "Encaissement", value: fmt(data.total_recouvre), color: "bg-emerald-50 text-emerald-600", dot: "bg-emerald-500" },
                { label: "Créance", value: fmt(data.total_creance), color: "bg-rose-50 text-rose-600", dot: "bg-rose-500" },
                { label: "Créance résilié", value: fmt(data.total_creance_resilie || 0), color: "bg-red-50 text-red-700", dot: "bg-red-700" },
                { label: "Objectif atteint", value: `${tauxObjectifAtteint}%`, color: "bg-amber-50 text-amber-600", dot: "bg-amber-500" },
                { label: "Taux Recov.", value: `${data.total_ca > 0 ? (((data.total_ca_recouvre || 0) / data.total_ca) * 100).toFixed(2) : "0.00"}%`, color: "bg-amber-50 text-amber-600", dot: "bg-amber-500" },
              ];
            })().map((kpi, i) => {
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

          {ventilationData.length > 0 && lastVentDate && (
            <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-black text-brand-600 uppercase tracking-widest mb-1">Ventilation disponible</p>
                <p className="text-sm font-bold text-[#101828]">
                  Détail ventilation des créances arrêtées au{' '}
                  {lastVentDate.replace(/(\d{4})(\d{2})(\d{2})/, '$3/$2/$1').replace(/(\d{4})-(\d{2})-(\d{2})/, '$3/$2/$1')}
                </p>
                <p className="text-xs text-[#667085] mt-1">{ventilationData.length} lignes · export Excel / PDF</p>
              </div>
              <button
                type="button"
                onClick={onNavigateToVentilation}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white rounded-xl text-xs font-black hover:bg-brand-700 transition-all shadow-sm self-start md:self-center"
              >
                Voir la ventilation détaillée
                <ChevronRight size={14} />
              </button>
            </div>
          )}

          {categoryCounts.length > 0 && (
            <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] p-6 mt-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#98A2B3]">Abonnés par catégorie</p>
                  <p className="text-sm text-[#667085] mt-1">Période : {categoryCountsPeriod}</p>
                  {periodSubscriberTotal !== null && (
                    <p className="text-sm text-[#101828] font-black mt-1">Abonnés période : {periodSubscriberTotal.toLocaleString('fr-FR')}</p>
                  )}
                </div>
                {categoryCountsLoading && (
                  <div className="inline-flex items-center gap-2 rounded-full bg-[#F9FAFB] px-4 py-2 text-xs font-black text-[#667085] border border-[#E4E7EC]">
                    <div className="w-2.5 h-2.5 rounded-full bg-brand-600 animate-pulse" /> Chargement des totaux
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
                {categoryCounts.map((category) => (
                  <div key={category.id} className="p-4 bg-[#F9FAFB] rounded-[2rem] border border-[#F2F4F7]">
                    <p className="text-[10px] font-black text-[#98A2B3] uppercase tracking-widest mb-2">{category.label}</p>
                    <p className="text-3xl font-black text-[#101828] tabular-nums">{category.value.toLocaleString('fr-FR')}</p>
                  </div>
                ))}
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

                <div className="flex flex-wrap gap-2 items-center pt-2">
                  {lastVentDate && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-brand-50 rounded-full border border-brand-100 text-xs font-bold text-brand-600">
                      <Calendar size={12} />
                      <span>Arrêtée au {lastVentDate.replace(/(\d{4})(\d{2})(\d{2})/, '$3/$2/$1').replace(/(\d{4})-(\d{2})-(\d{2})/, '$3/$2/$1')}</span>
                    </div>
                  )}
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-full border border-slate-100 text-xs font-bold text-slate-600">
                    <MapPin size={12} />
                    <span>{secteurLabel ? `Centre ${secteurLabel}` : 'Toute l\'unité'}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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
                  <div className="p-4 bg-red-50/50 rounded-[2rem] border border-red-100 group hover:border-red-200 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-600"></div>
                      <p className="text-[10px] font-black text-red-600 uppercase tracking-widest">Créance Résilié</p>
                    </div>
                    <p className="text-lg font-black text-red-700 font-mono tracking-tighter">{fmt(data.total_creance_resilie || 0)}</p>
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
                   histType === 'days' ? `Analyse Rétrospective du ${histStartDate.split('-').reverse().join('/')} au ${histEndDate.split('-').reverse().join('/')}` :
                   `Analyse Rétrospective (${formatMonthFr(histStartMonth)} ${histStartYear} → ${formatMonthFr(histEndMonth)} ${histEndYear})`}
                </h4>
                <p className="text-xs text-[#667085] mt-0.5 font-medium">
                  {histType === 'monthly_12' 
                    ? `Évolution mensuelle sur les 12 mois précédant le ${lastVentDate ? formatDate(lastVentDate) : '...'}${secteurLabel ? ` — centre ${secteurLabel}` : ' — toute l\'unité'}`
                    : `Évolution sur la période sélectionnée${secteurLabel ? ` — centre ${secteurLabel}` : ' — toute l\'unité'}.`}
                </p>
              </div>

              {/* Toggles interactifs de métrique */}
              <div className="flex bg-[#F2F4F7] p-1.5 rounded-2xl gap-1 border border-[#E4E7EC] self-start lg:self-auto shadow-sm">
                {[
                  { id: 'creance', label: 'Créances' },
                  { id: 'ca', label: "Chiffre d'Affaires" },
                  { id: 'encaissement', label: 'Encaissements' },
                  { id: 'ca_recouvre', label: 'CA Recouvré' },
                  { id: 'objectif', label: 'Taux Objectif' },
                  { id: 'tableau', label: 'Tableau' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveHistoryMetric(tab.id as any);
                    }}
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
                  <option value="days">Par Jour (Max 31 jours)</option>
                </select>
              </div>

              {histType !== 'monthly_12' && (
                <div className="flex items-center gap-2">
                  {/* Début */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-[#98A2B3] uppercase px-1">Du</label>
                    <div className="flex gap-2">
                      {histType === 'days' ? (
                        <input
                          type="date"
                          value={histStartDate}
                          onChange={(e) => {
                            const newDate = e.target.value;
                            setHistStartDate(newDate);
                            if (newDate && histEndDate) {
                              const start = new Date(newDate);
                              const end = new Date(histEndDate);
                              if ((end.getTime() - start.getTime()) / (1000 * 3600 * 24) > 31) {
                                const newEnd = new Date(start);
                                newEnd.setDate(start.getDate() + 31);
                                setHistEndDate(newEnd.toISOString().split('T')[0]);
                              }
                            }
                          }}
                          className="block bg-white border border-[#E4E7EC] rounded-xl px-3 py-2 text-xs font-bold text-[#101828] focus:ring-2 focus:ring-brand-500 outline-none w-36 shadow-sm cursor-pointer"
                        />
                      ) : (
                        <>
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
                        </>
                      )}
                    </div>
                  </div>

                  <span className="text-xs font-bold text-[#98A2B3] pt-4">→</span>

                  {/* Fin */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-[#98A2B3] uppercase px-1">Au</label>
                    <div className="flex gap-2">
                      {histType === 'days' ? (
                        <input
                          type="date"
                          value={histEndDate}
                          onChange={(e) => {
                            const newDate = e.target.value;
                            setHistEndDate(newDate);
                            if (newDate && histStartDate) {
                              const start = new Date(histStartDate);
                              const end = new Date(newDate);
                              if ((end.getTime() - start.getTime()) / (1000 * 3600 * 24) > 31) {
                                const newStart = new Date(end);
                                newStart.setDate(end.getDate() - 31);
                                setHistStartDate(newStart.toISOString().split('T')[0]);
                              }
                            }
                          }}
                          className="block bg-white border border-[#E4E7EC] rounded-xl px-3 py-2 text-xs font-bold text-[#101828] focus:ring-2 focus:ring-brand-500 outline-none w-36 shadow-sm cursor-pointer"
                        />
                      ) : (
                        <>
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
                        </>
                      )}
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
                activeHistoryMetric !== 'tableau' ? (
                  <ChartContainer className="h-[380px] w-full">
                    <LineChart
                      data={historyWithObjective}
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
                        tickFormatter={(val) => activeHistoryMetric === 'objectif' ? `${Number(val).toFixed(0)}%` : fmtNum(val) + " DA"}
                        width={activeHistoryMetric === 'objectif' ? 60 : 100}
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
                        formatter={(value: any, name: any) => [
                          activeHistoryMetric === 'objectif'
                            ? `${Number(value).toFixed(2)}%`
                            : fmt(value),
                          name
                        ]}
                      />
                      <Legend
                        verticalAlign="top"
                        align="right"
                        iconType="circle"
                        wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', paddingBottom: '16px' }}
                      />
                      {activeHistoryMetric !== 'objectif' ? (
                        <>
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
                        </>
                      ) : (
                        <>
                          <ReferenceLine y={90} stroke="#F59E0B" strokeDasharray="4 3" label={{ position: 'insideTopRight', value: 'Seuil 90%', fill: '#F59E0B', fontSize: 10, fontWeight: 700 }} />
                          <Line
                            type="monotone"
                            dataKey="taux_objectif_atteint"
                            name="Taux Objectif"
                            stroke="#F59E0B"
                            strokeWidth={3}
                            dot={{ r: 4, stroke: "#F59E0B", strokeWidth: 2, fill: "#fff" }}
                            activeDot={{ r: 6, strokeWidth: 0 }}
                          />
                        </>
                      )}
                    </LineChart>
                  </ChartContainer>
                ) : (
                  <div className="bg-white border border-[#E4E7EC] rounded-2xl p-4 overflow-auto">
                    <table id="retrospective-table" className="min-w-full divide-y divide-gray-200 text-xs">
                      <thead>
                        <tr className="text-left text-xs text-[#667085] uppercase font-bold">
                          <th className="px-2 py-1 whitespace-nowrap">Période</th>
                          <th className="px-2 py-1 text-right whitespace-nowrap">CA Eau</th>
                          <th className="px-2 py-1 text-right whitespace-nowrap">CA Prestation</th>
                          <th className="px-2 py-1 text-right whitespace-nowrap">CA Total</th>
                          <th className="px-2 py-1 text-right whitespace-nowrap">CA Recouvré</th>
                          <th className="px-2 py-1 text-right whitespace-nowrap">Encaissement</th>
                          <th className="px-2 py-1 text-right whitespace-nowrap">Créance</th>
                          <th className="px-2 py-1 text-right whitespace-nowrap">Taux Recov.</th>
                          <th className="px-2 py-1 text-right whitespace-nowrap">Objectif atteint</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyWithObjective.map((row: any, idx: number) => {
                          const tauxRecov = row.ca_total > 0 ? (Number(row.ca_recouvre_total || 0) / Number(row.ca_total || 1)) * 100 : 0;
                          return (
                            <tr key={row.month || row.label || idx} className="border-t">
                              <td className="px-2 py-1 align-top whitespace-nowrap">{row.label}</td>
                              <td className="px-2 py-1 text-right align-top whitespace-nowrap">{fmt(row.ca_eau || 0)}</td>
                              <td className="px-2 py-1 text-right align-top whitespace-nowrap">{fmt(row.ca_prest || 0)}</td>
                              <td className="px-2 py-1 text-right align-top whitespace-nowrap">{fmt(row.ca_total || 0)}</td>
                              <td className="px-2 py-1 text-right align-top whitespace-nowrap">{fmt(row.ca_recouvre_total || 0)}</td>
                              <td className="px-2 py-1 text-right align-top whitespace-nowrap">{fmt(row.encaissement_total || 0)}</td>
                              <td className="px-2 py-1 text-right align-top whitespace-nowrap">{fmt(row.creance_total || 0)}</td>
                              <td className="px-2 py-1 text-right align-top whitespace-nowrap">{tauxRecov.toFixed(2)}%</td>
                              <td className="px-2 py-1 text-right align-top whitespace-nowrap">{(Number(row.taux_objectif_atteint || 0)).toFixed(2)}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )
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

