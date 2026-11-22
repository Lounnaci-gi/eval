"use client";

import { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import "../../lib/i18n";
import { ChevronDown, ChevronRight, Users, TrendingUp, Calendar, FileText } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend,
} from "recharts";
import { apiUrlObject } from "../lib/api";
import {
  sanitizeEvolutionRows,
  formatPeriodFrench as formatPeriodFrenchSafe,
  ChartContainer,
} from "./utils";
import { ScrollableTabs, ScrollableTab } from "./ScrollableTabs";

export function SubscribersEvolutionView({ stats, selectedSecteur }: any) {
  const { t } = useTranslation();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<string>('2015');

  // Filtering states
  const [selectedFilterCommune, setSelectedFilterCommune] = useState<string>("");
  const [selectedFilterType, setSelectedFilterType] = useState<string>("");

  // Interactive date calculator states
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(String(currentDate.getFullYear()));
  const [filterPeriod, setFilterPeriod] = useState("all");
  const [dateSelectionError, setDateSelectionError] = useState<string | null>(null);
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
        if (!res.ok) throw new Error(t('common.error', "Erreur serveur"));
        return res.json();
      })
      .then(resData => {
        if (cancelled) return;
        if (resData.ready) {
          setData(sanitizeEvolutionRows(resData.evolution));
        } else {
          setError(resData.message || t('common.noData', "Les données ne sont pas prêtes"));
        }
      })
      .catch(err => {
        if (cancelled) return;
        setError(t('subscribers.errorLoadHistory', "Impossible de charger l'historique des abonnés."));
        console.error(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSecteur, selectedFilterCommune, selectedFilterType, t]);

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
      result.push({ period: latest.period, count: latest.count });
    }
    // Sort latest first
    return result.sort((a, b) => b.period.localeCompare(a.period));
  }, [data]);

  const availableYears = useMemo(
    () => [...new Set(data.map(row => String(row.period || "").slice(0, 4)).filter(year => /^\d{4}$/.test(year)))].sort((a, b) => Number(b) - Number(a)),
    [data],
  );

  // Calculator logic
  const maxYear = new Date().getFullYear();

  const handleCalculatePeriod = (yearValue = filterYear, periodValue = filterPeriod) => {
    const latestYear = availableYears[0] || String(maxYear);
    const year = yearValue === "all" ? Number(latestYear) : Number(yearValue);
    if (!Number.isInteger(year) || year < 1900 || year > maxYear) {
      setDateSelectionError("Saisissez une année valide.");
      return;
    }

    let month = 12;
    if (/^q[1-4]$/.test(periodValue)) {
      month = Number(periodValue[1]) * 3;
    } else if (/^(0[1-9]|1[0-2])$/.test(periodValue)) {
      month = Number(periodValue);
    }

    setSelectedYear(year);
    setSelectedMonth(month);
    setDateSelectionError(null);
  };

  const calculatorResult = useMemo(() => {
    if (!data || data.length === 0) return null;
    const targetPeriod = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}`;
    
    // Find exact or closest preceding record
    let found = data.find(d => d.period === targetPeriod);
    if (!found) {
      // Find latest record before targetPeriod
      const sortedBefore = data
        .filter(d => d.period < targetPeriod)
        .sort((a, b) => b.period.localeCompare(a.period));
      if (sortedBefore.length > 0) {
        found = sortedBefore[0];
      }
    }

    const firstPeriod = data[0].period;
    const isBefore = targetPeriod < firstPeriod;

    return {
      count: found ? found.count : 0,
      new_registrations: found ? (found.new_registrations || 0) : 0,
      resigned_count: found ? (found.resigned_count || 0) : 0,
      stopped_count: found ? (found.stopped_count || 0) : 0,
      isBefore
    };
  }, [data, selectedYear, selectedMonth]);

  const growthStats = useMemo(() => {
    if (!data || data.length < 13) return null;
    const latestCount = data[data.length - 1].count;
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

  const { xAxisTicks, formatTick } = useMemo(() => {
    if (!filteredData || filteredData.length === 0) return { xAxisTicks: [], formatTick: (t: string) => t };
    
    // Choose appropriate interval based on data size
    let type = 'all';
    if (filteredData.length > 120) {
      type = '10years';
    } else if (filteredData.length > 60) {
      type = '5years';
    } else if (filteredData.length > 24) {
      type = '1year';
    } else if (filteredData.length > 12) {
      type = 'semester';
    } else {
      type = 'quarter';
    }

    const generatedTicks: string[] = [];
    filteredData.forEach((d) => {
      if (!d?.period) return;
      const parts = d.period.split('-');
      const y = parseInt(parts[0]);
      const m = parseInt(parts[1]);

      if (type === '10years') {
        if (y % 10 === 0 && m === 12) generatedTicks.push(d.period);
      } else if (type === '5years') {
        if (y % 5 === 0 && m === 12) generatedTicks.push(d.period);
      } else if (type === '1year') {
        if (m === 12) generatedTicks.push(d.period);
      } else if (type === 'semester') {
        if (m === 6 || m === 12) generatedTicks.push(d.period);
      } else {
        if (m % 3 === 0) generatedTicks.push(d.period);
      }
    });

    // Make sure first and last periods are included if not present
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
      
      if (type === '10years' || type === '5years' || type === '1year') {
        return y;
      } else if (type === 'semester') {
        const semesterLabel = m === 1 ? t('monthsShort.1', 'Jan') : t('monthsShort.7', 'Juil');
        return `${semesterLabel} ${y}`;
      } else if (type === 'quarter') {
        const shortMonth = t(`monthsShort.${m}`, m.toString());
        return `${shortMonth} ${y.slice(-2)}`;
      } else {
        const fullMonth = t(`months.${m}`, m.toString());
        return `${fullMonth} ${y}`;
      }
    };

    return { xAxisTicks: generatedTicks, formatTick };
  }, [filteredData, t]);

  if (loading) {
    return (
      <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] p-16 flex flex-col items-center justify-center gap-4 min-h-[400px]">
        <div className="spinner-premium" style={{ width: 48, height: 48 }} />
        <p className="text-base font-bold text-[#475467] animate-pulse">{t('subscribers.loadingSubscribersEvolution', "Calcul de l'évolution des abonnés...")}</p>
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
          {t('common.retry')}
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
            <div className="p-4 rounded-2xl bg-blue-50 text-[#245A83]">
              <Users size={24} />
            </div>
            <span className="text-[11px] font-black uppercase tracking-widest text-[#98A2B3]">{t('kpi.cumul', 'Cumul')}</span>
          </div>
          <div>
            <p className="text-[#475467] text-sm font-bold mb-1">{t('subscribers.totalSubscribersLabel', 'Total Abonnés Actuels')}</p>
            <p className="text-2xl sm:text-3xl font-black text-[#101828] tracking-tight">
              {(data[data.length - 1]?.count ?? 0).toLocaleString()}
            </p>
            <p className="text-xs text-[#667085] mt-1 font-medium">{t('subscribers.atEndOf', 'À fin')} {formatPeriodFrenchSafe(data[data.length - 1]?.period)}</p>
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
            <p className="text-[#475467] text-sm font-bold mb-1">{t('subscribers.growthLabel', 'Croissance (12 mois)')}</p>
            <p className="text-2xl sm:text-3xl font-black text-[#101828] tracking-tight">
              {growthStats ? `+${growthStats.growth12m.toLocaleString()}` : '---'}
            </p>
            <p className="text-xs text-[#667085] mt-1 font-medium">{t('subscribers.newSubscribersSubtitle', 'Nouveaux abonnés sur la dernière année')}</p>
          </div>
        </div>

        <div className="bg-white border border-[#E4E7EC] p-6 rounded-[2rem] shadow-sm">
          <div className="flex justify-between items-start mb-6">
            <div className="p-4 rounded-2xl bg-purple-50 text-purple-600">
              <Calendar size={24} />
            </div>
            <span className="text-[11px] font-black uppercase tracking-widest text-purple-600">{t('subscribers.rhythm', 'Rythme')}</span>
          </div>
          <div>
            <p className="text-[#475467] text-sm font-bold mb-1">{t('subscribers.monthlyAverageLabel', 'Moyenne Mensuelle')}</p>
            <p className="text-2xl sm:text-3xl font-black text-[#101828] tracking-tight">
              {growthStats ? `+${growthStats.avgMonthlyNew}` : '---'}
            </p>
            <p className="text-xs text-[#667085] mt-1 font-medium">{t('subscribers.avgRegistrationsSubtitle', 'Inscriptions moyennes par mois')}</p>
          </div>
        </div>
      </div>

      {/* Main Chart Area */}
      <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[1.25rem] sm:rounded-[2rem] page-card min-w-0">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="min-w-0">
            <h3 className="text-lg sm:text-xl font-black tracking-tight text-[#101828]">{t('subscribers.chartGrowthTitle', 'Courbe de Croissance Temporelle')}</h3>
            <p className="text-xs text-[#667085] mt-1">{t('subscribers.chartGrowthSubtitle', 'Évolution cumulative des abonnés enregistrés')}</p>
          </div>
          
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 w-full xl:w-auto">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#98A2B3] shrink-0">{t('common.commune', 'Commune :')}</span>
              <div className="relative w-full sm:w-auto min-w-0">
                <select
                  value={selectedFilterCommune}
                  onChange={(e) => setSelectedFilterCommune(e.target.value)}
                  className="w-full sm:w-auto max-w-full text-xs font-bold border-[#D0D5DD] border rounded-xl pl-3 pr-8 py-2 bg-[#F9FAFB] focus:outline-none focus:ring-2 focus:ring-blue-100 appearance-none cursor-pointer"
                >
                  <option value="">{t('common.allCommunes', 'Toutes les communes')}</option>
                  {(stats?.subscriber_communes || []).map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#667085] pointer-events-none" size={12} />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#98A2B3] shrink-0">{t('subscribers.category', 'Catégorie :')}</span>
              <div className="relative w-full sm:w-44 min-w-0">
                <select
                  value={selectedFilterType}
                  onChange={(e) => setSelectedFilterType(e.target.value)}
                  className="w-full text-xs font-bold border-[#D0D5DD] border rounded-xl pl-3 pr-8 py-2 bg-[#F9FAFB] focus:outline-none focus:ring-2 focus:ring-blue-100 appearance-none cursor-pointer truncate"
                >
                  <option value="">{t('subscribers.allCategories', 'Toutes les catégories')}</option>
                  {(stats?.subscriber_types || []).map((t: any) => (
                    <option key={t.code} value={t.code}>{t.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#667085] pointer-events-none" size={12} />
              </div>
            </div>

            <ScrollableTabs className="w-full xl:w-auto">
              {[
                { id: '2000', label: t('subscribers.timeRangeSince2000', 'Depuis 2000') },
                { id: '2010', label: t('subscribers.timeRangeSince2010', 'Depuis 2010') },
                { id: '2015', label: t('subscribers.timeRangeSince2015', 'Depuis 2015') },
                { id: '2020', label: t('subscribers.timeRangeSince2020', 'Depuis 2020') },
                { id: 'all', label: t('common.all', 'Tout') }
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
                  <stop offset="5%" stopColor="#245A83" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#245A83" stopOpacity={0.0}/>
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
                tickFormatter={(val) => val.toLocaleString()}
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
                labelFormatter={(label) => formatPeriodFrenchSafe(label)}
                formatter={(value: any) => [
                  <span key="value" className="font-bold text-white">{value.toLocaleString()} {t('kpi.subscribers', 'abonnés')}</span>,
                  t('kpi.cumul', 'Cumul')
                ]}
              />
              <Area type="monotone" dataKey="count" stroke="#245A83" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
            </AreaChart>
        </ChartContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Simulateur */}
        <div className="group bg-white border border-[#E6EEF9] shadow-sm rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between gap-4 px-5 py-3 bg-gradient-to-r from-white to-slate-50">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-[#E6F0FF] to-[#F9FBFF] flex items-center justify-center border border-[#DCEFFF]">
                <Calendar className="text-[#0D6FCC]" size={20} />
              </div>
              <div>
                <div className="text-sm font-extrabold text-[#0F1724]">{t('subscribers.simulatorTitle', 'Contexte — Simulateur Historique')}</div>
                <div className="text-[11px] text-[#64748B]">{t('subscribers.simulatorSubtitle', 'Choisissez mois et année pour contexte temporel.')}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-xs text-[#64748B]">{t('subscribers.context', 'Contexte')}</div>
              <button
                onClick={() => setSimOpen(s => !s)}
                aria-expanded={simOpen}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-lg border border-[#E6EEF9] bg-white text-sm font-bold hover:shadow"
              >
                {simOpen ? t('common.collapse', 'Réduire') : t('common.expand', 'Étendre')}
                <ChevronRight className={simOpen ? 'rotate-90' : ''} />
              </button>
            </div>
          </div>

          <div className={`transition-all px-5 ${simOpen ? 'pb-5 pt-4' : 'max-h-0 pb-0 overflow-hidden'}`}>
            <div className="flex flex-col gap-4 md:flex-row md:items-end">
              <div className="space-y-2">
                <label htmlFor="subscriber-simulator-year" className="px-1 text-[10px] font-bold uppercase text-[#98A2B3]">
                  {t('common.year', 'Année')}
                </label>
                <div className="flex items-center gap-2">
                <input
                    id="subscriber-simulator-year"
                    list="subscriber-simulator-years"
                    value={filterYear}
                    onChange={event => {
                      const nextYear = event.target.value;
                      setFilterYear(nextYear);
                      handleCalculatePeriod(nextYear, filterPeriod);
                    }}
                    onKeyDown={event => {
                      if (event.key === "Enter") handleCalculatePeriod();
                    }}
                    aria-invalid={Boolean(dateSelectionError)}
                    placeholder="Entrez une année ou choisissez"
                    className="block w-full rounded-xl border border-[#E4E7EC] bg-[#F9FAFB] px-4 py-2.5 text-xs font-bold text-[#101828] outline-none transition-all hover:border-[#D0D5DD] focus:border-[#245A83] focus:ring-4 focus:ring-[#245A83]/10 md:w-48"
                />
                  <datalist id="subscriber-simulator-years">
                    <option value="all">Toutes</option>
                    {availableYears.map(year => <option key={year} value={year} />)}
                  </datalist>
                  <button
                    type="button"
                    onClick={() => {
                      setFilterYear("all");
                      setFilterPeriod("all");
                      handleCalculatePeriod("all", "all");
                    }}
                    className="hidden rounded-xl border border-[#E4E7EC] bg-white px-3 py-2.5 text-[10px] font-black text-[#245A83] transition hover:bg-[#F9FAFB] md:inline-block"
                  >
                    Toutes
                  </button>
                </div>
                {dateSelectionError && <p role="alert" className="px-1 text-[11px] font-semibold text-red-600">{dateSelectionError}</p>}
              </div>

              <div className="space-y-2">
                <label htmlFor="subscriber-simulator-period" className="px-1 text-[10px] font-bold uppercase text-[#98A2B3]">
                  Période
                </label>
                <select
                  id="subscriber-simulator-period"
                  value={filterPeriod}
                  onChange={event => {
                    const nextPeriod = event.target.value;
                    setFilterPeriod(nextPeriod);
                    handleCalculatePeriod(filterYear, nextPeriod);
                  }}
                  className="block w-full rounded-xl border border-[#E4E7EC] bg-[#F9FAFB] px-4 py-2.5 text-xs font-bold text-[#101828] outline-none transition-all hover:border-[#D0D5DD] focus:border-[#245A83] focus:ring-4 focus:ring-[#245A83]/10 md:w-56"
                >
                  <option value="all">Année {filterYear === "all" ? "complète" : filterYear}</option>
                  <optgroup label="Trimestres">
                    <option value="q1">1er Trim {filterYear !== "all" ? filterYear : ""}</option>
                    <option value="q2">2ème Trim {filterYear !== "all" ? filterYear : ""}</option>
                    <option value="q3">3ème Trim {filterYear !== "all" ? filterYear : ""}</option>
                    <option value="q4">4ème Trim {filterYear !== "all" ? filterYear : ""}</option>
                  </optgroup>
                  <optgroup label="Mois">
                    {Array.from({ length: 12 }, (_, index) => {
                      const month = String(index + 1).padStart(2, "0");
                      return (
                        <option key={month} value={month}>
                          {t(`months.${index + 1}`, new Date(2020, index).toLocaleDateString('fr-FR', { month: 'long' }))} {filterYear !== "all" ? filterYear : ""}
                        </option>
                      );
                    })}
                  </optgroup>
                </select>
              </div>

            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-stretch">
              <div className="flex-1 rounded-xl border border-[#EAF3FF] bg-[#F8FAFF] p-4">
                <div className="text-[11px] text-[#64748B] font-semibold">{t('subscribers.estimatedSubscribers', 'Abonnés estimés')}</div>
                <div className="text-2xl font-extrabold text-[#0F1724] mt-2">{calculatorResult ? (calculatorResult.isBefore ? '0' : calculatorResult.count.toLocaleString()) : '---'}</div>
                <div className="text-[11px] text-[#94A3B8] mt-1">{t('subscribers.asOf', 'au')} 01/{selectedMonth.toString().padStart(2, '0')}/{selectedYear}</div>
              </div>

              <div className="w-full rounded-xl border border-[#EEF2FF] bg-white p-4 shadow-sm sm:w-64">
                <div className="text-[11px] text-[#64748B] font-semibold">{t('common.details', 'Détails')}</div>
                <div className="mt-2 text-sm text-[#0F1724]">
                  <div>{t('charts.resigned', 'Résiliés')}: <span className="font-bold text-rose-600">{(calculatorResult?.resigned_count ?? 0).toLocaleString()}</span></div>
                  <div className="mt-1">{t('subscribers.stoppedInvoicesLabel', 'Factures arrêtées')}: <span className="font-bold text-amber-600">{(calculatorResult?.stopped_count ?? stats?.invoice_stopped_subscribers ?? 0).toLocaleString()}</span></div>
                  {calculatorResult && calculatorResult.new_registrations > 0 && (
                    <div className="mt-2 inline-block text-[12px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded">+{calculatorResult.new_registrations} {t('subscribers.newRegistrationsBadge', 'nouvelles')}</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Milestones */}
        <div className="group bg-white border border-[#E6EEF9] shadow-sm rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between gap-4 px-5 py-3 bg-gradient-to-r from-white to-slate-50">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-[#FFF7ED] to-[#FFFBF5] flex items-center justify-center border border-[#FFF0E6]">
                <FileText className="text-[#B45309]" size={20} />
              </div>
              <div>
                <div className="text-sm font-extrabold text-[#0F1724]">{t('subscribers.milestonesTitle', 'Contexte — Jalons & Repères')}</div>
                <div className="text-[11px] text-[#64748B]">{t('subscribers.milestonesSubtitle', 'Repères clés et croissance entre échéances.')}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-xs text-[#64748B]">{t('subscribers.milestonesBadge', 'Repères')}</div>
              <button
                onClick={() => setMilestonesOpen(s => !s)}
                aria-expanded={milestonesOpen}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-lg border border-[#E6EEF9] bg-white text-sm font-bold hover:shadow"
              >
                {milestonesOpen ? t('common.collapse', 'Réduire') : t('common.expand', 'Étendre')}
                <ChevronRight className={milestonesOpen ? 'rotate-90' : ''} />
              </button>
            </div>
          </div>

          <div className={`transition-all px-5 ${milestonesOpen ? 'pb-5 pt-4' : 'max-h-0 pb-0 overflow-hidden'}`}>
            <div className="grid grid-cols-1 gap-3">
              {milestones.slice(0, 6).map((m: any, idx: number) => (
                <div key={m.period} className="flex items-center justify-between px-3 py-2 rounded-lg border border-[#F1F5F9] bg-white">
                  <div>
                    <div className="text-sm font-semibold text-[#0F1724]">{formatPeriodFrenchSafe(m.period)}</div>
                    <div className="text-xs text-[#64748B]">{t('common.period', 'Période')}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-extrabold text-[#0F1724]">{m.count.toLocaleString()}</div>
                    <div className="text-xs text-[#64748B]">{idx === 0 ? t('subscribers.reference', 'Référence') : ''}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-[11px] text-[#64748B] mt-3">{t('subscribers.milestonesFootnote', "Volume total d'abonnés par commune — filtrable depuis les menus.")}</div>
          </div>
        </div>
      </div>
      
      {/* Bar Chart at the bottom */}
      <div className="h-[240px] sm:h-[320px] w-full min-w-0 mt-6">
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
              tickFormatter={(v) => v.toLocaleString()}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#101828', border: 'none', borderRadius: '14px', color: '#fff', fontSize: '12px' }}
              labelStyle={{ color: '#98A2B3', fontWeight: 'bold', marginBottom: '4px' }}
              labelFormatter={(_: any, payload: any) => payload?.[0]?.payload?.fullName || _}
              formatter={(value: any, name: any) => [
                value.toLocaleString(),
                name === 'actifs' ? t('charts.active', 'Actifs') : name === 'resiliés' ? t('charts.resigned', 'Résiliés') : t('common.total', 'Total')
              ]}
            />
            <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', paddingTop: '12px' }} />
            <Bar dataKey="actifs" name={t('charts.active', 'Actifs')} stackId="a" fill="#245A83" radius={[0, 0, 0, 0]} />
            <Bar dataKey="resiliés" name={t('charts.resigned', 'Résiliés')} stackId="a" fill="#f43f5e" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
