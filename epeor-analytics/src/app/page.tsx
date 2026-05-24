"use client";

import { useEffect, useState, Fragment, useRef, useMemo } from "react";
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
  Bell,
  HelpCircle,
  Printer,
  FileText,
  FileSpreadsheet,
  Percent,
  MapPin
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import * as XLSX from 'xlsx';
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
  LabelList
} from "recharts";



const formatDate = (dateStr: string) => {
  if (!dateStr) return "";
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
};

const FrenchDateInput = ({ value, onChange, className, label }: any) => {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2 relative">
      {label && <label className="text-[10px] font-bold text-[#98A2B3] uppercase px-1">{label}</label>}
      <div className="relative">
        <input
          type="text"
          readOnly
          value={formatDate(value)}
          onClick={() => inputRef.current?.showPicker()}
          className={`${className} cursor-pointer`}
        />
        <input
          type="date"
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 pointer-events-none"
          tabIndex={-1}
        />
        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#98A2B3]">
          <Calendar size={14} />
        </div>
      </div>
    </div>
  );
};

export default function Dashboard() {
  const [currentView, setCurrentView] = useState<'dashboard' | 'details' | 'resigned' | 'stopped' | 'no_meter' | 'creance' | 'repartition' | 'commune' | 'creances_abonnes'>('dashboard');
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
  const itemsPerPage = 20;

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
      case '30': return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-600 border border-purple-100">Sans compteur</span>;
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

  if (
    !stats ||
    stats.status === 'loading' ||
    stats.ready === false ||
    (stats.ready === true && stats.total_subscribers === 0 && !stats.subscriber_types?.length)
  ) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center p-8">
        <div className="bg-white border border-[#E4E7EC] shadow-2xl rounded-[3rem] p-16 flex flex-col items-center gap-8 max-w-md w-full text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-24 w-24 border-4 border-violet-100 border-t-violet-600"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[10px] font-black text-violet-600 uppercase tracking-widest animate-pulse">EPEOR</span>
            </div>
          </div>
          <div className="space-y-4">
            <h1 className="text-2xl font-black text-[#101828] tracking-tight">Initialisation du Système</h1>
            <p className="text-sm text-[#475467] font-medium min-h-[40px] flex items-center justify-center">
              {stats?.message || "Connexion au serveur backend..."}
            </p>
          </div>
          <div className="w-full bg-[#F2F4F7] rounded-full h-1.5 overflow-hidden">
            <div className="bg-violet-600 h-full animate-pulse w-full rounded-full"></div>
          </div>
          <p className="text-[10px] font-bold text-[#98A2B3] uppercase tracking-wider">
            Reconstitution du cache de performance (cela peut prendre 1 à 2 minutes la première fois)
          </p>
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
      <aside className="w-72 bg-white border-r border-[#E4E7EC] p-6 flex flex-col gap-10 hidden md:flex no-print">
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
            icon={<Calendar size={20} />}
            label="Périodes de Facturation"
          />
        </nav>

        <div className="mt-auto flex flex-col gap-1 pt-6 border-t border-[#F2F4F7]">
          <NavItem icon={<Bell size={20} />} label="Notifications" />
          <NavItem icon={<HelpCircle size={20} />} label="Centre d'aide" />
          <NavItem icon={<Settings size={20} />} label="Paramètres" />
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
        <header className="flex justify-between items-start mb-12 no-print">
          <div>
            <h1 className="text-4xl font-black text-[#101828] tracking-tight">Bonjour, Admin !</h1>
            <p className="text-[#475467] mt-1 text-lg">Retrouvez la situation globale de votre réseau aujourd'hui.</p>
          </div>

          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#98A2B3] group-focus-within:text-[#0D83DE] transition-colors" size={20} />
              <input
                type="text"
                placeholder="Un abonné, un numéro..."
                className="bg-white border-[#D0D5DD] border rounded-2xl pl-12 pr-6 py-3.5 w-80 focus:outline-none focus:ring-4 focus:ring-blue-50 focus:border-[#0D83DE] transition-all placeholder:text-[#98A2B3] shadow-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button className="bg-[#0D83DE] hover:bg-[#0b72c2] text-white px-8 py-3.5 rounded-2xl font-bold transition-all shadow-md shadow-blue-100 flex items-center gap-2">
              <Search size={18} />
              Rechercher
            </button>
          </form>
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
                icon={<Percent className="text-indigo-500" size={24} />}
                trend={`${targetSubs.toLocaleString()} abonnés`}
                color="indigo"
              />
              <StatsCard
                title="Chiffre d'Affaire"
                value={`${stats?.total_revenue?.toLocaleString() || "..."} DA`}
                icon={<CreditCard className="text-violet-500" size={24} />}
                trend={stats?.revenue_period || "Période en cours"}
                color="violet"
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

            {/* Charts & Analytics */}
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
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
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
                  </ResponsiveContainer>
                </div>
              </div>

              <div
                onClick={() => setCurrentView('details')}
                className="lg:col-span-3 bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] p-8 text-obat-gray cursor-pointer hover:shadow-md hover:border-[#D0D5DD] transition-all group"
              >
                <h3 className="text-xl font-black tracking-tight mb-8 text-[#101828] group-hover:text-[#0D83DE] transition-colors">Types d'Abonnés</h3>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
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
                            '#7C3AED', // Violet
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
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

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
          <DetailedStatsView stats={stats} onBack={() => setCurrentView('dashboard')} />
        ) : currentView === 'resigned' ? (
          <ResignedDetailView stats={stats} onBack={() => setCurrentView('dashboard')} />
        ) : currentView === 'stopped' ? (
          <StoppedDetailView stats={stats} onBack={() => setCurrentView('dashboard')} />
        ) : currentView === 'no_meter' ? (
          <NoMeterDetailView stats={stats} onBack={() => setCurrentView('dashboard')} />
        ) : currentView === 'creances_abonnes' ? (
          <CreancesAbonnesView onBack={() => setCurrentView('dashboard')} />
        ) : ['creance', 'repartition', 'commune'].includes(currentView) ? (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Unified Financial Suite Header */}
            <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] p-8 no-print">
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
                
                {/* Modern Segmented Navigation Tabs */}
                <div className="flex bg-[#F2F4F7] p-1.5 rounded-2xl gap-1 self-start md:self-auto border border-[#E4E7EC] shadow-sm">
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
                          ? 'bg-white text-violet-600 shadow-sm border-[#E4E7EC]/40'
                          : 'text-[#667085] border-transparent hover:text-[#101828]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
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
    violet: "bg-violet-50 text-violet-600",
    emerald: "bg-emerald-50 text-emerald-600",
    indigo: "bg-indigo-50 text-indigo-600",
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
                <th style="width: 26%">Nom / Raison Sociale</th>
                <th style="width: 26%">Adresse</th>
                <th style="width: 8%">Tournée</th>
                <th style="width: 10%">N° Série</th>
                <th style="width: 10%; text-align: right;">Nouvel Index</th>
                <th style="width: 8%">Type</th>
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
        <NominativeTable subscribers={quartierSubscribers} loading={loadingSubscribers} accentColor="amber" />
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
                <th style="width: 26%">Nom / Raison Sociale</th>
                <th style="width: 26%">Adresse</th>
                <th style="width: 8%">Tournée</th>
                <th style="width: 10%">N° Série</th>
                <th style="width: 10%; text-align: right;">Nouvel Index</th>
                <th style="width: 8%">Type</th>
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
        <NominativeTable subscribers={quartierSubscribers} loading={loadingSubscribers} accentColor="cyan" />
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
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 whitespace-nowrap">{label}</span>;
    case '4': // 40-49: cancelled
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap">{label}</span>;
    default:
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-50 text-slate-500 border border-slate-200 whitespace-nowrap">{label}</span>;
  }
}

function NominativeTable({ subscribers, loading, accentColor = "blue" }: any) {
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
        <PaginatedNominativeTable subscribers={subscribers} style={style} setHoveredSub={setHoveredSub} setMousePos={setMousePos} />
      )}
    </div>
  );
}

function PaginatedNominativeTable({ subscribers, style, setHoveredSub, setMousePos }: any) {
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

    const filteredInvoices = invoices.filter((inv: any) => {
      const isPaid = inv.DATREG && inv.DATREG.trim() !== '' && inv.DATREG !== '00000000' && inv.DATREG !== '19000101';
      if (invoiceFilter === 'PAID') return isPaid;
      if (invoiceFilter === 'UNPAID') return !isPaid;
      return true;
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

      // FOOTER
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(152, 162, 179);
        const printDate = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        doc.text(`Imprimé le ${printDate} - EPEOR Analytics`, 40, doc.internal.pageSize.height - 20);
        doc.text(`Page ${i} / ${pageCount}`, pageWidth - 40, doc.internal.pageSize.height - 20, { align: 'right' });
      }

      doc.save(`Historique_Factures_${selectedSubForInvoices.numab}.pdf`);
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
              <td className="px-6 py-4 text-right font-medium text-[13px] text-[#475467]">{sub.numordre}</td>
            </tr>
          )) : (
            <tr>
              <td colSpan={11} className="px-8 py-8 text-center text-[#667085] font-medium">Aucun abonné trouvé.</td>
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
              className="px-6 py-2.5 bg-violet-600 text-white rounded-xl text-xs font-black shadow-lg shadow-violet-100 hover:bg-violet-700 transition-all flex items-center gap-2 h-[42px]"
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
              className="block bg-white border border-[#E4E7EC] rounded-xl px-4 py-2.5 text-xs font-bold text-[#101828] focus:ring-2 focus:ring-violet-500 outline-none w-32"
            />
            <FrenchDateInput
              label="Au"
              value={dateRange.end}
              onChange={(val: string) => setDateRange({ ...dateRange, end: val })}
              className="block bg-white border border-[#E4E7EC] rounded-xl px-4 py-2.5 text-xs font-bold text-[#101828] focus:ring-2 focus:ring-violet-500 outline-none w-32"
            />
            <div className="pb-1">
              <button
                onClick={handleCustomFilter}
                className="p-3 bg-white border border-[#E4E7EC] rounded-xl text-violet-600 hover:bg-violet-50 transition-colors shadow-sm"
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
            <div className="animate-spin rounded-full h-20 w-20 border-b-2 border-violet-500"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[10px] font-black text-violet-600">{Math.round(calcProgress)}%</span>
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
                  className="h-full bg-violet-600 rounded-full transition-all duration-300 shadow-sm shadow-violet-200"
                  style={{ width: `${calcProgress}%` }}
                ></div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-black text-[#98A2B3] uppercase tracking-widest">Traitement Big Data</span>
                <span className="text-[9px] font-black text-violet-600 uppercase tracking-widest">Calcul Optimisé</span>
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
            <Search className="text-violet-500" size={32} />
          </div>
          <div>
            <p className="text-lg font-black text-[#101828]">Prêt pour l'analyse</p>
            <p className="text-sm text-[#667085] mt-1 max-w-md">Sélectionnez une année et une période ci-dessus, puis cliquez sur le bouton <span className="text-violet-600 font-bold text-xs uppercase">Calculer</span> pour traiter les données de facturation.</p>
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
              { label: "CA Total", value: fmt(data.total_ca), color: "bg-violet-50 text-violet-600", dot: "bg-violet-500" },
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
                  className={`bg-white border border-[#E4E7EC] rounded-[2.5rem] p-5 shadow-sm hover:shadow-md transition-all ${isClickable ? "cursor-pointer hover:border-violet-300 hover:bg-slate-50/30" : ""}`}
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
                                className={`${section === 'EAU' ? 'bg-blue-50/10' : 'bg-purple-50/10'} cursor-pointer hover:bg-slate-50 transition-colors border-y border-[#F2F4F7]`}
                              >
                                <td colSpan={5} className="px-8 py-3">
                                  <div className="flex items-center gap-3">
                                    <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
                                      <ChevronRight size={16} className="text-[#98A2B3]" />
                                    </div>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border ${section === 'EAU' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-purple-50 text-purple-600 border-purple-100'}`}>
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
                                    <td rowSpan={rows.length} className={`px-5 py-8 text-center border-r border-[#F2F4F7] ${section === 'EAU' ? 'bg-blue-50/10' : 'bg-purple-50/10'}`}>
                                      <div className="flex flex-col items-center justify-center h-full">
                                        <span className={`[writing-mode:vertical-lr] rotate-180 text-[13px] font-black uppercase tracking-[0.4em] ${section === 'EAU' ? 'text-blue-500' : 'text-purple-500'}`}>
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
                              <tr className={`${section === 'EAU' ? 'bg-blue-50/40' : 'bg-purple-50/40'} border-y border-[#F2F4F7]/50`}>
                                <td colSpan={3} className="px-8 py-4">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-1 h-4 rounded-full ${section === 'EAU' ? 'bg-blue-400' : 'bg-purple-400'} opacity-50`}></div>
                                    <span className="font-black text-[12px] text-[#101828] uppercase tracking-wider">Sous-total {section}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <span className="font-black text-[13px] text-[#475467] font-mono">{fmtNum(rows.reduce((acc, r) => acc + r.NBR_FACTURES, 0))}</span>
                                </td>
                                <td className="px-8 py-4 text-right">
                                  <span className={`font-black text-[15px] ${section === 'EAU' ? 'text-blue-700' : 'text-purple-700'} font-mono tracking-tighter`}>{fmt(subTotal)}</span>
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
              <div className="w-full lg:w-[22%] aspect-square relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
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
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
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
                  <div className="p-4 bg-[#F9FAFB] rounded-[2rem] border border-[#F2F4F7] group hover:border-violet-200 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-500"></div>
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
          <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] p-8 mt-8">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
              <div>
                <h4 className="text-xl font-black tracking-tight text-[#101828]">Analyse Rétrospective des 12 Derniers Mois</h4>
                <p className="text-xs text-[#667085] mt-0.5 font-medium">
                  Évolution mensuelle des indicateurs sur les 12 mois précédant la date d'arrêt ({lastVentDate ? formatDate(lastVentDate) : '...'})
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
                        ? 'bg-white text-violet-600 shadow-sm border-[#E4E7EC]/40'
                        : 'text-[#667085] border-transparent hover:text-[#101828]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {data.history && data.history.length > 0 ? (
              <div className="h-[380px] w-full">
                <ResponsiveContainer width="100%" height="100%">
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
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-60 gap-2 border-2 border-dashed border-[#E4E7EC] rounded-3xl bg-[#F9FAFB]">
                <p className="text-sm font-bold text-[#667085]">Aucune donnée historique disponible.</p>
                <p className="text-xs text-[#98A2B3]">Veuillez relancer le calcul pour charger l'historique.</p>
              </div>
            )}
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
      <div className="flex items-start justify-between p-8 pb-6 border-b border-[#F2F4F7] bg-gradient-to-r from-violet-50/60 to-white flex-shrink-0">
        <div>
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-sm font-bold text-[#667085] hover:text-[#101828] mb-4 transition-all active:scale-95 cursor-pointer"
          >
            <ChevronRight className="rotate-180" size={16} /> Retour à la répartition
          </button>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase border bg-violet-50 text-violet-600 border-violet-100">
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
            className="w-full pl-9 pr-4 py-2.5 bg-[#F9FAFB] border border-[#E4E7EC] rounded-xl text-xs font-medium text-[#101828] placeholder:text-[#98A2B3] outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100/50 transition-all"
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
            <div className="w-10 h-10 border-4 border-violet-100 border-t-violet-600 rounded-full animate-spin" />
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
                <th className="px-4 py-4 text-right text-violet-600">{columnLabel}</th>
                <th className="px-6 py-4 text-right">Opérations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2F4F7]">
              {paged.map((s: any, i: number) => (
                <tr key={s.numab} className="hover:bg-violet-50/20 transition-colors">
                  <td className="px-6 py-3.5 text-xs text-[#98A2B3] font-mono">{(page - 1) * PAGE_SIZE + i + 1}</td>
                  <td className="px-4 py-3.5">
                    <span className="font-mono text-[11px] font-bold text-[#101828] bg-[#F9FAFB] px-2 py-0.5 rounded border border-[#E4E7EC]">{s.numab}</span>
                  </td>
                  <td className="px-4 py-3.5 text-sm font-semibold text-[#101828]">{s.name}</td>
                  <td className="px-4 py-3.5 text-xs text-[#475467] font-medium">{s.commune}</td>
                  <td className="px-4 py-3.5 text-[11px] text-[#667085]">{s.type_abonne}</td>
                  <td className="px-4 py-3.5 text-right font-black text-sm text-violet-600 whitespace-nowrap">{fmt(s.amount)}</td>
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
                    page === p ? 'bg-violet-600 text-white shadow-sm' : 'text-[#475467] bg-white border border-[#E4E7EC] hover:border-[#D0D5DD]'
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
        <div className="w-20 h-20 bg-violet-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-violet-100 shadow-inner">
          <BarChart3 className="text-violet-600" size={36} />
        </div>
        <h3 className="text-2xl font-black text-[#101828] mb-3">Aucune donnée disponible</h3>
        <p className="text-sm text-[#667085] leading-relaxed max-w-md mx-auto mb-8 font-medium">
          Les calculs financiers n'ont pas encore été lancés pour la période actuelle. Veuillez vous rendre sur la Synthèse Globale pour charger les données.
        </p>
        <button
          onClick={onGoToCalculation}
          className="inline-flex items-center justify-center px-6 py-3.5 bg-violet-600 text-white rounded-2xl text-sm font-black hover:bg-violet-700 active:scale-95 transition-all shadow-lg shadow-violet-600/25 border border-violet-500/10"
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
                  ? 'bg-white text-violet-600 shadow-sm border-[#E4E7EC]/40'
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
                      className={`${isEau ? 'bg-blue-50/10' : 'bg-purple-50/10'} cursor-pointer hover:bg-slate-50/50 transition-colors border-y border-[#F2F4F7]`}
                    >
                      <td colSpan={10} className="px-8 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
                            <ChevronRight size={16} className="text-[#98A2B3]" />
                          </div>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase border ${isEau ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-purple-50 text-purple-600 border-purple-100'}`}>
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
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold tracking-widest uppercase ${isEau ? 'bg-blue-50 text-blue-600 border border-blue-100/50' : 'bg-purple-50 text-purple-600 border border-purple-100/50'}`}>
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
                        <td className="px-6 py-4 text-right font-black text-[13px] text-violet-600 whitespace-nowrap">
                          <span className="cursor-pointer hover:bg-violet-50/60 hover:text-violet-700 underline decoration-dotted underline-offset-2 transition-all rounded px-1 py-0.5" onClick={() => setDrillDown({ targetName: t.name, column: 'ca' })} title="Voir les abonnés concernés">{fmt(t.ca)}</span>
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
                    <tr className={`${isEau ? 'bg-blue-50/40' : 'bg-purple-50/40'} border-y border-[#F2F4F7]/50`}>
                      <td colSpan={3} className="px-8 py-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-1 h-4 rounded-full ${isEau ? 'bg-blue-400' : 'bg-purple-400'} opacity-50`}></div>
                          <span className="font-black text-[12px] text-[#101828] uppercase tracking-wider">Sous-total {section}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-black text-[13px] text-blue-600 font-mono whitespace-nowrap">{fmt(subTotalCaEau)}</td>
                      <td className="px-6 py-4 text-right font-black text-[13px] text-cyan-600 font-mono whitespace-nowrap">{fmt(subTotalCaPrest)}</td>
                      <td className="px-6 py-4 text-right font-black text-[13px] text-violet-600 font-mono whitespace-nowrap">{fmt(subTotalCa)}</td>
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
                  <td className="px-6 py-5 text-right text-violet-400 font-mono whitespace-nowrap">{fmt(data.total_ca)}</td>
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
        <div className="w-20 h-20 bg-violet-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-violet-100 shadow-inner">
          <MapPin className="text-violet-600" size={36} />
        </div>
        <h3 className="text-2xl font-black text-[#101828] mb-3">Aucune donnée disponible</h3>
        <p className="text-sm text-[#667085] leading-relaxed max-w-md mx-auto mb-8 font-medium">
          Les calculs financiers n'ont pas encore été lancés pour la période actuelle. Veuillez vous rendre sur la Synthèse Globale pour charger les données.
        </p>
        <button
          onClick={onGoToCalculation}
          className="inline-flex items-center justify-center px-6 py-3.5 bg-violet-600 text-white rounded-2xl text-sm font-black hover:bg-violet-700 active:scale-95 transition-all shadow-lg shadow-violet-600/25 border border-violet-500/10"
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
                ? 'bg-violet-600 text-white border-violet-700 hover:bg-violet-700' 
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
                className="flex items-center gap-2 px-4 py-2.5 bg-violet-50 text-violet-600 border border-violet-100 rounded-xl text-xs font-black hover:bg-violet-100 hover:text-violet-700 transition-all shadow-sm active:scale-95 cursor-pointer"
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
                            className="flex items-center gap-2 cursor-pointer select-none group-hover:text-violet-600 transition-colors"
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
                        <td className="px-6 py-4 text-right font-black text-[13px] text-violet-600">{fmt(c.ca)}</td>
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
                  <td className="px-6 py-5 text-right text-violet-400 font-mono">{fmt(data.total_ca)}</td>
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

function CreancesAbonnesView({ onBack }: any) {
  // ─── Raw data from API ───────────────────────────────────────────
  const [allSubscribers, setAllSubscribers] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  const PAGE_SIZE = 20;

  const NUMERIC_SORT_KEYS = new Set(['montant_creance', 'nombre_creance']);

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
            <span className={`text-[10px] ${active ? 'text-violet-600' : 'text-[#D0D5DD] group-hover:text-[#98A2B3]'}`}>
              {active ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
            </span>
          )}
          <span className={active ? 'text-violet-600' : 'group-hover:text-[#101828]'}>{label}</span>
          {align !== 'right' && (
            <span className={`text-[10px] ${active ? 'text-violet-600' : 'text-[#D0D5DD] group-hover:text-[#98A2B3]'}`}>
              {active ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
            </span>
          )}
        </span>
      </th>
    );
  };

  const exportCSV = () => {
    const header = ['Code Abonné', 'Nom / Raison Sociale', 'Adresse', 'Bloc', 'N° Dom', 'Type Abonné', 'Code Type', 'État Cpt', 'Code État', 'N° Série Compteur', 'Tournée', 'Dernier Paiement', 'Factures Impayées', 'Montant Créance (DA)'];
    const rows = sorted.map((s: any) => [
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

    const formatDaysSinceLabel = (raw: string | null) => {
      const d = daysSince(raw);
      if (d === null) return 'Jamais';
      return `${d} j`;
    };

    const montantFmt = (n: number) =>
      new Intl.NumberFormat('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        .format(n)
        .replace(/[\u202F\u00A0]/g, ' ') + ' DA';

    const rowsHtml = sorted
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
          <td style="text-align:center;font-weight:700;">${escapeHtml(formatDaysSinceLabel(s.raw_last_payment))}</td>
          <td style="text-align:center;font-weight:700;">${s.nombre_creance ?? 0}</td>
          <td style="text-align:right;font-weight:700;color:#E11D48;">${montantFmt(s.montant_creance || 0)}</td>
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
            <div><div class="meta-label">Nombre d'abonnés</div><div class="meta-value">${tableTotals.count}</div></div>
            <div><div class="meta-label">Total créances</div><div class="meta-value" style="color:#E11D48;">${montantFmt(tableTotals.montant)}</div></div>
            <div><div class="meta-label">Total factures impayées</div><div class="meta-value">${tableTotals.factures.toLocaleString('fr-FR')}</div></div>
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
                <th style="text-align:center">Nb jours</th>
                <th style="text-align:center">Factures</th>
                <th style="text-align:right">Montant ciblé</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
            <tfoot>
              <tr>
                <td colspan="12" style="text-transform:uppercase;letter-spacing:0.05em;">TOTAL GÉNÉRAL — ${tableTotals.count} abonné${tableTotals.count !== 1 ? 's' : ''}</td>
                <td style="text-align:center;">${tableTotals.factures.toLocaleString('fr-FR')}</td>
                <td style="text-align:right;color:#FCA5A5;">${montantFmt(tableTotals.montant)}</td>
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

  const inputCls = "w-full px-3.5 py-2.5 bg-[#F9FAFB] border border-[#E4E7EC] rounded-xl text-xs font-bold text-[#101828] placeholder:text-[#98A2B3] outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100/60 transition-all";
  const selectCls = "w-full px-3.5 py-2.5 bg-[#F9FAFB] border border-[#E4E7EC] rounded-xl text-xs font-black text-[#475467] outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100/60 transition-all appearance-none cursor-pointer";
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
        <div className="px-8 py-5 border-b border-[#F2F4F7] bg-gradient-to-r from-violet-50/60 to-white flex items-center gap-3">
          <div className="w-8 h-8 bg-violet-100 rounded-xl flex items-center justify-center">
            <Search size={14} className="text-violet-600" />
          </div>
          <div>
            <h3 className="text-sm font-black text-[#101828]">Critères de Filtrage</h3>
            <p className="text-xs text-[#667085] font-medium">Définissez vos critères puis cliquez sur Rechercher</p>
          </div>
        </div>

        <div className="p-8">
          {dataLoading ? (
            <div className="flex items-center justify-center gap-3 py-10">
              <div className="w-8 h-8 border-4 border-violet-100 border-t-violet-600 rounded-full animate-spin" />
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

              {/* 1. Tournées */}
              <div className="lg:col-span-2">
                <label className={labelCls}>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-4 h-4 bg-blue-100 rounded-md flex items-center justify-center text-blue-600 text-[9px] font-black">1</span>
                    Tournée(s) — Ajoutez les tournées pour votre recherche
                  </span>
                </label>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="ex: 1, 15, 2 → sera 001, 015, 002"
                      value={newTourneeInput}
                      onChange={e => setNewTourneeInput(e.target.value)}
                      onKeyPress={e => e.key === 'Enter' && addTournee()}
                      className={inputCls}
                    />
                    <button
                      onClick={addTournee}
                      disabled={!newTourneeInput.trim()}
                      className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    >
                      Ajouter
                    </button>
                  </div>
                  {customTournees.length > 0 ? (
                    <div className="flex items-center gap-2 flex-wrap p-4 bg-blue-50 border border-blue-100 rounded-xl">
                      <span className="text-[10px] font-black uppercase tracking-widest text-blue-700">Tournées :</span>
                      {customTournees.map(t => (
                        <span key={t} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-blue-700 rounded-lg text-[11px] font-black border border-blue-200 shadow-sm">
                          {t}
                          <button onClick={() => removeTournee(t)} className="text-blue-400 hover:text-blue-700 font-bold">×</button>
                        </span>
                      ))}
                      <button onClick={() => setCustomTournees([])} className="text-[10px] text-rose-500 font-bold hover:text-rose-700 ml-auto">Tout effacer</button>
                    </div>
                  ) : (
                    <p className="text-xs text-[#98A2B3] font-medium px-4 py-3 bg-[#F9FAFB] rounded-xl border border-[#E4E7EC]">Aucune tournée. Laisser vide cherchera dans toutes les tournées.</p>
                  )}
                </div>
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
                  <div className="relative w-44 flex-shrink-0">
                    <select
                      value={montantOp}
                      onChange={e => setMontantOp(e.target.value as any)}
                      className={selectCls}
                    >
                      {OP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
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
                <p className="text-[10px] text-[#98A2B3] font-medium mt-1.5">Laissez vide pour ignorer ce critère</p>
              </div>

              {/* 3. Nombre de créances */}
              <div>
                <label className={labelCls}>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-4 h-4 bg-amber-100 rounded-md flex items-center justify-center text-amber-600 text-[9px] font-black">3</span>
                    Nombre de Factures Impayées
                  </span>
                </label>
                <div className="flex gap-2">
                  <div className="relative w-44 flex-shrink-0">
                    <select
                      value={nbCreanceOp}
                      onChange={e => setNbCreanceOp(e.target.value as any)}
                      className={selectCls}
                    >
                      {OP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
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
                <p className="text-[10px] text-[#98A2B3] font-medium mt-1.5">Laissez vide pour ignorer ce critère</p>
              </div>

              {/* 4. Dernier paiement */}
              <div className="lg:col-span-2">
                <label className={labelCls}>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-4 h-4 bg-teal-100 rounded-md flex items-center justify-center text-teal-600 text-[9px] font-black">4</span>
                    Dernier Paiement — Ancienneté en jours
                  </span>
                </label>
                <div className="flex gap-2 max-w-xl">
                  <div className="relative w-56 flex-shrink-0">
                    <select
                      value={dernierPaiementOp}
                      onChange={e => setDernierPaiementOp(e.target.value as any)}
                      className={selectCls}
                    >
                      {DAY_OP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
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
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-black text-[#98A2B3]">jours</span>
                  </div>
                </div>
                <p className="text-[10px] text-[#98A2B3] font-medium mt-1.5">Les abonnés sans aucun paiement seront toujours inclus avec &gt; N jours</p>
              </div>
            </div>
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
              className="inline-flex items-center gap-2 px-7 py-3 bg-violet-600 text-white rounded-xl text-sm font-black hover:bg-violet-700 active:scale-95 transition-all shadow-lg shadow-violet-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Search size={15} />
              Rechercher les Créanciers
            </button>
          </div>
        )}
      </div>

      {/* ── Results ───────────────────────────────────────────────────── */}
      {results === null ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 bg-white border border-dashed border-[#D0D5DD] rounded-[2rem]">
          <div className="w-16 h-16 bg-violet-50 rounded-full flex items-center justify-center border border-violet-100">
            <Search size={24} className="text-violet-400" />
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
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#98A2B3]" />
                <input
                  type="text"
                  placeholder="Affiner par code ou nom..."
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                  className="pl-8 pr-4 py-2 bg-[#F9FAFB] border border-[#E4E7EC] rounded-xl text-xs font-bold text-[#101828] placeholder:text-[#98A2B3] outline-none focus:border-violet-300 transition-all w-60"
                />
              </div>
              <button
                onClick={printCreanciersList}
                disabled={sorted.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-[#E4E7EC] text-[#344054] rounded-xl text-xs font-black hover:bg-[#F9FAFB] hover:border-[#D0D5DD] active:scale-95 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Printer size={13} /> Imprimer
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
          <div className="flex flex-wrap items-start gap-4 px-8 py-4 border-b border-[#F2F4F7] bg-violet-50/20">
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
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-violet-100 text-violet-800 border border-violet-200"
                    >
                      {t}
                      <button
                        type="button"
                        onClick={() => removeTableFilter(t, filterTypesAbon, setFilterTypesAbon)}
                        className="text-violet-500 hover:text-violet-900 font-black leading-none"
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
                className="px-4 py-2.5 rounded-xl text-xs font-black text-violet-700 bg-white border border-violet-200 hover:bg-violet-50 transition-all self-end"
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
                      <tr key={s.numab} className="hover:bg-violet-50/10 transition-colors group">
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
                  <span className="text-violet-600 ml-1">(filtres actifs)</span>
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
                        safePage === p ? 'bg-violet-600 text-white shadow-sm' : 'text-[#475467] bg-white border border-[#E4E7EC] hover:border-[#D0D5DD]'
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



