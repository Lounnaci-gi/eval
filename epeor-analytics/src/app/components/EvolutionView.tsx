"use client";

import { useEffect, useState, useMemo } from "react";
import { ChevronDown, ChevronRight, Users, TrendingUp, Calendar, FileText } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend,
} from "recharts";
import { apiUrl, apiUrlObject } from "../lib/api";
import {
  sanitizeEvolutionRows,
  formatPeriodFrench as formatPeriodFrenchSafe,
  ChartContainer,
} from "./utils";
import { ScrollableTabs, ScrollableTab } from "./ScrollableTabs";

export function SubscribersEvolutionView({ stats, selectedSecteur }: any) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<string>('2015');

  // Filtering states
  const [selectedFilterCommune, setSelectedFilterCommune] = useState<string>("");
  const [selectedFilterType, setSelectedFilterType] = useState<string>("");

  // Interactive date calculator states
  const [selectedYear, setSelectedYear] = useState<number>(2020);
  const [selectedMonth, setSelectedMonth] = useState<number>(7);
  // Compact panels open state (remplace <details>) — visibles par défaut
  const [simOpen, setSimOpen] = useState<boolean>(true);
  const [milestonesOpen, setMilestonesOpen] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    
    const url = apiUrlObject('/api/subscribers_evolution');
    if (selectedSecteur) {
      url.searchParams.set('secteur', selectedSecteur);
    }
    if (selectedFilterCommune) {
      url.searchParams.set('commune', selectedFilterCommune);
    }
    if (selectedFilterType) {
      url.searchParams.set('type_abon', selectedFilterType);
    }
    
    fetch(url.toString())
      .then(res => {
        if (!res.ok) throw new Error("Erreur serveur");
        return res.json();
      })
      .then(resData => {
        if (cancelled) return;
        if (resData.ready) {
          setData(sanitizeEvolutionRows(resData.evolution));
        } else {
          setError(resData.message || "Les données ne sont pas prêtes");
        }
      })
      .catch(err => {
        if (cancelled) return;
        setError("Impossible de charger l'historique des abonnés.");
        console.error(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSecteur, selectedFilterCommune, selectedFilterType]);

  const filteredData = useMemo(() => {
    if (!data?.length) return [];
    if (timeRange === 'all') return data;
    const startYear = parseInt(timeRange, 10);
    if (Number.isNaN(startYear)) return data;
    return data.filter(d => {
      if (!d?.period) return false;
      const y = parseInt(d.period.split('-')[0], 10);
      return !Number.isNaN(y) && y >= startYear;
    });
  }, [data, timeRange]);

  const milestones = useMemo(() => {
    if (!data || data.length === 0) return [];
    const targets = ['2000-12', '2005-12', '2010-12', '2015-12', '2020-12', '2021-12', '2022-12', '2023-12', '2024-12', '2025-12'];
    const result: any[] = [];
    targets.forEach(t => {
      const found = data.find(d => d.period === t);
      if (found) {
        result.push({ period: t, count: found.count });
      }
    });
    const latest = data[data.length - 1];
    if (latest && !targets.includes(latest.period)) {
      result.push({ period: latest.period, count: latest.count, isLatest: true });
    }
    return result;
  }, [data]);


  // Find simulated count
  const calculatorResult = useMemo(() => {
    if (!data || data.length === 0) return null;
    const periodKey = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}`;
    const found = data.find(d => d.period === periodKey);
    if (found) return found;
    
    // Fallback: if selected date is before data starts, return first record
    const targetInt = selectedYear * 100 + selectedMonth;
    const firstPeriod = data[0].period;
    const [fy, fm] = firstPeriod.split('-').map(Number);
    const firstInt = fy * 100 + fm;
    if (targetInt < firstInt) {
      return { period: periodKey, count: 0, new_registrations: 0, resigned_count: 0, isBefore: true };
    }
    
    // If selected date is after data ends, return last record
    const lastPeriod = data[data.length - 1].period;
    const [ly, lm] = lastPeriod.split('-').map(Number);
    const lastInt = ly * 100 + lm;
    if (targetInt > lastInt) {
      return { period: periodKey, count: data[data.length - 1].count, new_registrations: 0, resigned_count: data[data.length - 1].resigned_count ?? 0, isAfter: true };
    }
    
    return null;
  }, [data, selectedYear, selectedMonth]);

  // Calculate annual growth stats
  const growthStats = useMemo(() => {
    if (!data || data.length < 13) return null;
    const latestCount = data[data.length - 1].count;
    // Count 12 months ago
    const oneYearAgoIndex = data.length - 13;
    const countOneYearAgo = data[oneYearAgoIndex].count;
    const growth12m = latestCount - countOneYearAgo;
    const pct12m = ((growth12m) / countOneYearAgo) * 100;
    
    // Average new registrations per month
    const totalNewLast12m = data.slice(data.length - 12).reduce((sum, d) => sum + d.new_registrations, 0);
    const avgMonthlyNew = totalNewLast12m / 12;

    return {
      growth12m,
      pct12m: pct12m.toFixed(2),
      avgMonthlyNew: Math.round(avgMonthlyNew)
    };
  }, [data]);

  const monthsList = [
    { value: 1, label: "Janvier" },
    { value: 2, label: "Février" },
    { value: 3, label: "Mars" },
    { value: 4, label: "Avril" },
    { value: 5, label: "Mai" },
    { value: 6, label: "Juin" },
    { value: 7, label: "Juillet" },
    { value: 8, label: "Août" },
    { value: 9, label: "Septembre" },
    { value: 10, label: "Octobre" },
    { value: 11, label: "Novembre" },
    { value: 12, label: "Décembre" }
  ];

  const yearsList = useMemo(() => {
    if (!data || data.length === 0) return Array.from({ length: 27 }, (_, i) => 2000 + i);
    const firstYear = parseInt(data[0].period.split('-')[0]);
    const lastYear = parseInt(data[data.length - 1].period.split('-')[0]);
    const list = [];
    for (let y = firstYear; y <= lastYear; y++) {
      list.push(y);
    }
    return list;
  }, [data]);

  const minYear = yearsList[0] ?? 2000;
  const maxYear = yearsList[yearsList.length - 1] ?? 2026;

  const formatPeriodFrench = formatPeriodFrenchSafe;

  const { xAxisTicks, formatTick } = useMemo(() => {
    if (!filteredData || filteredData.length === 0) {
      return { xAxisTicks: [], formatTick: (v: string) => v };
    }
    
    const N = filteredData.length;
    let type: '10years' | '5years' | '1year' | 'semester' | 'quarter' | 'month';
    if (N > 240) {
      type = '10years';
    } else if (N > 120) {
      type = '5years';
    } else if (N > 24) {
      type = '1year';
    } else if (N > 12) {
      type = 'semester';
    } else if (N > 6) {
      type = 'quarter';
    } else {
      type = 'month';
    }

    const generatedTicks: string[] = [];
    
    filteredData.forEach((d) => {
      if (!d || !d.period) return;
      const parts = d.period.split('-');
      const y = parseInt(parts[0]);
      const m = parseInt(parts[1]);
      
      if (type === '10years') {
        if (y % 10 === 0 && m === 1) {
          generatedTicks.push(d.period);
        }
      } else if (type === '5years') {
        if (y % 5 === 0 && m === 1) {
          generatedTicks.push(d.period);
        }
      } else if (type === '1year') {
        if (m === 1) {
          generatedTicks.push(d.period);
        }
      } else if (type === 'semester') {
        if (m === 1 || m === 7) {
          generatedTicks.push(d.period);
        }
      } else if (type === 'quarter') {
        if (m === 1 || m === 4 || m === 7 || m === 10) {
          generatedTicks.push(d.period);
        }
      } else {
        generatedTicks.push(d.period);
      }
    });

    if (generatedTicks.length === 0) {
      if (filteredData[0]?.period) {
        generatedTicks.push(filteredData[0].period);
      }
      if (filteredData.length > 1 && filteredData[filteredData.length - 1]?.period) {
        generatedTicks.push(filteredData[filteredData.length - 1].period);
      }
    }

    const formatTick = (tick: string) => {
      if (!tick) return '';
      const parts = tick.split('-');
      const y = parts[0];
      const m = parseInt(parts[1]);
      const monthsShort = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jui", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];
      const monthsFull = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
      
      if (type === '10years' || type === '5years' || type === '1year') {
        return y;
      } else if (type === 'semester') {
        return `${m === 1 ? 'Jan' : 'Juil'} ${y}`;
      } else if (type === 'quarter') {
        return `${monthsShort[m - 1]} ${y.slice(-2)}`;
      } else {
        return `${monthsFull[m - 1]} ${y}`;
      }
    };

    return { xAxisTicks: generatedTicks, formatTick };
  }, [filteredData]);

  if (loading) {
    return (
      <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] p-16 flex flex-col items-center justify-center gap-4 min-h-[400px]">
        <div className="w-12 h-12 border-4 border-blue-100 border-t-[#0D83DE] rounded-full animate-spin" />
        <p className="text-base font-bold text-[#475467] animate-pulse">Calcul de l'évolution des abonnés...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] p-12 text-center text-rose-600">
        <p className="font-bold">{error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-4 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-bold border border-blue-100 hover:bg-blue-100 transition-all"
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* KPI Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-[#E4E7EC] p-6 rounded-[2rem] shadow-sm">
          <div className="flex justify-between items-start mb-6">
            <div className="p-4 rounded-2xl bg-blue-50 text-[#0D83DE]">
              <Users size={24} />
            </div>
            <span className="text-[11px] font-black uppercase tracking-widest text-[#98A2B3]">Cumul</span>
          </div>
          <div>
            <p className="text-[#475467] text-sm font-bold mb-1">Total Abonnés Actuels</p>
            <p className="text-3xl font-black text-[#101828] tracking-tight">
              {(data[data.length - 1]?.count ?? 0).toLocaleString('fr-FR')}
            </p>
            <p className="text-xs text-[#667085] mt-1 font-medium">À fin {formatPeriodFrench(data[data.length - 1]?.period)}</p>
          </div>
        </div>

        <div className="bg-white border border-[#E4E7EC] p-6 rounded-[2rem] shadow-sm">
          <div className="flex justify-between items-start mb-6">
            <div className="p-4 rounded-2xl bg-emerald-50 text-emerald-600">
              <TrendingUp size={24} />
            </div>
            <span className="text-[11px] font-black uppercase tracking-widest text-emerald-600">
              {growthStats ? `+${growthStats.pct12m}%` : ''}
            </span>
          </div>
          <div>
            <p className="text-[#475467] text-sm font-bold mb-1">Croissance (12 mois)</p>
            <p className="text-3xl font-black text-[#101828] tracking-tight">
              {growthStats ? `+${growthStats.growth12m.toLocaleString('fr-FR')}` : '---'}
            </p>
            <p className="text-xs text-[#667085] mt-1 font-medium">Nouveaux abonnés sur la dernière année</p>
          </div>
        </div>

        <div className="bg-white border border-[#E4E7EC] p-6 rounded-[2rem] shadow-sm">
          <div className="flex justify-between items-start mb-6">
            <div className="p-4 rounded-2xl bg-purple-50 text-purple-600">
              <Calendar size={24} />
            </div>
            <span className="text-[11px] font-black uppercase tracking-widest text-purple-600">Rythme</span>
          </div>
          <div>
            <p className="text-[#475467] text-sm font-bold mb-1">Moyenne Mensuelle</p>
            <p className="text-3xl font-black text-[#101828] tracking-tight">
              {growthStats ? `+${growthStats.avgMonthlyNew}` : '---'}
            </p>
            <p className="text-xs text-[#667085] mt-1 font-medium">Inscriptions moyennes par mois</p>
          </div>
        </div>
      </div>

      {/* Main Chart Area */}
      <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[1.25rem] sm:rounded-[2rem] page-card min-w-0">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="min-w-0">
            <h3 className="text-lg sm:text-xl font-black tracking-tight text-[#101828]">Courbe de Croissance Temporelle</h3>
            <p className="text-xs text-[#667085] mt-1">Évolution cumulative des abonnés enregistrés</p>
          </div>
          
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 w-full xl:w-auto">
            <div className="flex flex-col xs:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#98A2B3] shrink-0">Commune :</span>
              <div className="relative w-full sm:w-auto min-w-0">
                <select
                  value={selectedFilterCommune}
                  onChange={(e) => setSelectedFilterCommune(e.target.value)}
                  className="w-full sm:w-auto max-w-full text-xs font-bold border-[#D0D5DD] border rounded-xl pl-3 pr-8 py-2 bg-[#F9FAFB] focus:outline-none focus:ring-2 focus:ring-blue-100 appearance-none cursor-pointer"
                >
                  <option value="">Toutes les communes</option>
                  {(stats?.subscriber_communes || []).map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#667085] pointer-events-none" size={12} />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#98A2B3] shrink-0">Catégorie :</span>
              <div className="relative w-full sm:w-44 min-w-0">
                <select
                  value={selectedFilterType}
                  onChange={(e) => setSelectedFilterType(e.target.value)}
                  className="w-full text-xs font-bold border-[#D0D5DD] border rounded-xl pl-3 pr-8 py-2 bg-[#F9FAFB] focus:outline-none focus:ring-2 focus:ring-blue-100 appearance-none cursor-pointer truncate"
                >
                  <option value="">Toutes les catégories</option>
                  {(stats?.subscriber_types || []).map((t: any) => (
                    <option key={t.code} value={t.code}>{t.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#667085] pointer-events-none" size={12} />
              </div>
            </div>

            <ScrollableTabs className="w-full xl:w-auto">
              {[
                { id: '2000', label: 'Depuis 2000' },
                { id: '2010', label: 'Depuis 2010' },
                { id: '2015', label: 'Depuis 2015' },
                { id: '2020', label: 'Depuis 2020' },
                { id: 'all', label: 'Tout' }
              ].map(range => (
                <ScrollableTab
                  key={range.id}
                  active={timeRange === range.id}
                  onClick={() => setTimeRange(range.id)}
                >
                  {range.label}
                </ScrollableTab>
              ))}
            </ScrollableTabs>
          </div>
        </div>

        <ChartContainer className="h-[260px] sm:h-[320px] lg:h-[350px] w-full min-w-0">
          <AreaChart data={filteredData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0D83DE" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#0D83DE" stopOpacity={0.0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F2F4F7" />
              <XAxis 
                dataKey="period" 
                ticks={xAxisTicks}
                tickLine={false} 
                axisLine={false}
                stroke="#98A2B3"
                style={{ fontSize: '10px', fontWeight: 'bold' } as any}
                tickFormatter={formatTick}
              />
              <YAxis 
                tickLine={false} 
                axisLine={false}
                stroke="#98A2B3"
                style={{ fontSize: '10px', fontWeight: 'bold' } as any}
                domain={['dataMin - 1000', 'dataMax + 1000']}
                tickFormatter={(val) => val.toLocaleString('fr-FR')}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: "#101828",
                  border: "none",
                  borderRadius: "16px",
                  color: "#fff",
                  fontSize: '12px',
                  boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)"
                }}
                labelStyle={{ fontWeight: 'black', marginBottom: '4px', color: '#98A2B3' }}
                labelFormatter={(label) => formatPeriodFrench(label)}
                formatter={(value: any) => [
                  <span key="value" className="font-bold text-white">{value.toLocaleString('fr-FR')} abonnés</span>,
                  'Cumul'
                ]}
              />
              <Area type="monotone" dataKey="count" stroke="#0D83DE" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
            </AreaChart>
        </ChartContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Simulateur - style professionnel compact */}
        <div className="group bg-white border border-[#E6EEF9] shadow-sm rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between gap-4 px-5 py-3 bg-gradient-to-r from-white to-slate-50">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-[#E6F0FF] to-[#F9FBFF] flex items-center justify-center border border-[#DCEFFF]">
                <Calendar className="text-[#0D6FCC]" size={20} />
              </div>
              <div>
                <div className="text-sm font-extrabold text-[#0F1724]">Contexte — Simulateur Historique</div>
                <div className="text-[11px] text-[#64748B]">Choisissez mois et année pour contexte temporel.</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-xs text-[#64748B]">Contexte</div>
              <button
                onClick={() => setSimOpen(s => !s)}
                aria-expanded={simOpen}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-lg border border-[#E6EEF9] bg-white text-sm font-bold hover:shadow"
              >
                {simOpen ? 'Réduire' : 'Étendre'}
                <ChevronRight className={simOpen ? 'rotate-90' : ''} />
              </button>
            </div>
          </div>

          <div className={`transition-all px-5 ${simOpen ? 'pb-5 pt-4' : 'max-h-0 pb-0 overflow-hidden'}`}>
            <div className="grid grid-cols-2 gap-4 items-center">
              <div>
                <label className="text-[10px] font-semibold text-[#94A3B8]">Mois</label>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Math.min(12, Math.max(1, Number(e.target.value || 1))))}
                  className="mt-1 w-full text-sm font-semibold border border-[#E6EEF9] rounded-lg px-3 py-2 bg-white focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-[#94A3B8]">Année</label>
                <input
                  type="number"
                  min={minYear}
                  max={maxYear}
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Math.min(maxYear, Math.max(minYear, Number(e.target.value || minYear))))}
                  className="mt-1 w-full text-sm font-semibold border border-[#E6EEF9] rounded-lg px-3 py-2 bg-white focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-4 flex gap-4 items-center">
              <div className="flex-1 p-4 rounded-lg bg-[#F8FAFF] border border-[#EAF3FF]">
                <div className="text-[11px] text-[#64748B] font-semibold">Abonnés estimés</div>
                <div className="text-2xl font-extrabold text-[#0F1724] mt-2">{calculatorResult ? (calculatorResult.isBefore ? '0' : calculatorResult.count.toLocaleString('fr-FR')) : '---'}</div>
                <div className="text-[11px] text-[#94A3B8] mt-1">au 01/{selectedMonth.toString().padStart(2, '0')}/{selectedYear}</div>
              </div>

              <div className="w-64 p-4 rounded-lg bg-white border border-[#EEF2FF] shadow-xs">
                <div className="text-[11px] text-[#64748B] font-semibold">Détails</div>
                <div className="mt-2 text-sm text-[#0F1724]">
                  <div>Résiliés: <span className="font-bold text-rose-600">{(calculatorResult?.resigned_count ?? 0).toLocaleString('fr-FR')}</span></div>
                  <div className="mt-1">Factures arrêtées: <span className="font-bold text-amber-600">{(calculatorResult?.stopped_count ?? stats?.invoice_stopped_subscribers ?? 0).toLocaleString('fr-FR')}</span></div>
                  {calculatorResult?.new_registrations > 0 && (
                    <div className="mt-2 inline-block text-[12px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded">+{calculatorResult.new_registrations} nouvelles</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Milestones - style professionnel compact */}
        <div className="group bg-white border border-[#E6EEF9] shadow-sm rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between gap-4 px-5 py-3 bg-gradient-to-r from-white to-slate-50">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-[#FFF7ED] to-[#FFFBF5] flex items-center justify-center border border-[#FFF0E6]">
                <FileText className="text-[#B45309]" size={20} />
              </div>
              <div>
                <div className="text-sm font-extrabold text-[#0F1724]">Contexte — Jalons & Repères</div>
                <div className="text-[11px] text-[#64748B]">Repères clés et croissance entre échéances.</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-xs text-[#64748B]">Repères</div>
              <button
                onClick={() => setMilestonesOpen(s => !s)}
                aria-expanded={milestonesOpen}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-lg border border-[#E6EEF9] bg-white text-sm font-bold hover:shadow"
              >
                {milestonesOpen ? 'Réduire' : 'Étendre'}
                <ChevronRight className={milestonesOpen ? 'rotate-90' : ''} />
              </button>
            </div>
          </div>

          <div className={`transition-all px-5 ${milestonesOpen ? 'pb-5 pt-4' : 'max-h-0 pb-0 overflow-hidden'}`}>
            <div className="grid grid-cols-1 gap-3">
              {milestones.slice(0, 6).map((m: any, idx: number) => (
                <div key={m.period} className="flex items-center justify-between px-3 py-2 rounded-lg border border-[#F1F5F9] bg-white">
                  <div>
                    <div className="text-sm font-semibold text-[#0F1724]">{formatPeriodFrench(m.period)}</div>
                    <div className="text-xs text-[#64748B]">Période</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-extrabold text-[#0F1724]">{m.count.toLocaleString('fr-FR')}</div>
                    <div className="text-xs text-[#64748B]">{idx === 0 ? 'Référence' : ''}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-[11px] text-[#64748B] mt-3">Volume total d'abonnés par commune — filtrable depuis les menus.</div>
          </div>
        </div>
      </div>
        <div className="h-[240px] sm:h-[320px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart
              data={(stats?.subscriber_communes || []).slice(0, 15).map((c: any) => ({
                name: c.name?.length > 18 ? c.name.slice(0, 16) + '…' : c.name,
                fullName: c.name,
                total: c.value,
                actifs: c.value - (c.resigned || 0),
                resiliés: c.resigned || 0,
              }))}
              margin={{ top: 5, right: 20, left: 10, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F2F4F7" />
              <XAxis
                dataKey="name"
                tickLine={false}
                axisLine={false}
                stroke="#98A2B3"
                style={{ fontSize: '9px', fontWeight: 'bold' } as any}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                stroke="#98A2B3"
                style={{ fontSize: '10px', fontWeight: 'bold' } as any}
                tickFormatter={(v) => v.toLocaleString('fr-FR')}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#101828', border: 'none', borderRadius: '14px', color: '#fff', fontSize: '12px' }}
                labelStyle={{ color: '#98A2B3', fontWeight: 'bold', marginBottom: '4px' }}
                labelFormatter={(_: any, payload: any) => payload?.[0]?.payload?.fullName || _}
                formatter={(value: any, name: any) => [value.toLocaleString('fr-FR'), name === 'actifs' ? 'Actifs' : name === 'resiliés' ? 'Résiliés' : 'Total']}
              />
              <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', paddingTop: '12px' }} />
              <Bar dataKey="actifs" name="Actifs" stackId="a" fill="#0D83DE" radius={[0, 0, 0, 0]} />
              <Bar dataKey="resiliés" name="Résiliés" stackId="a" fill="#f43f5e" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

      
    </div>
  );
}
