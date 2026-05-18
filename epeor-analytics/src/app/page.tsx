"use client";

import { useEffect, useState, Fragment, useRef } from "react";
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
  FileSpreadsheet
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import * as XLSX from 'xlsx';
import { saveAs } from "file-saver";
import {
  BarChart,
  Bar,
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
  const [currentView, setCurrentView] = useState<'dashboard' | 'details' | 'resigned' | 'stopped' | 'no_meter' | 'creance' | 'ventilation'>('dashboard');
  const [showChartGuide, setShowChartGuide] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [filteredResults, setFilteredResults] = useState<any[]>([]);
  const [filterQuery, setFilterQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [hoveredAbonne, setHoveredAbonne] = useState<any>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [ventilationFilter, setVentilationFilter] = useState<'ALL' | 'EAU' | 'PRESTATIONS'>('ALL');
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
          setStats(data);
          if (data && data.status === 'loading') {
            if (!intervalId) {
              intervalId = setInterval(checkStats, 2000);
            }
          } else {
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

  useEffect(() => {
    const handleUnload = () => {
      // Clear backend database pickle caches dynamically when the user closes the site tab/window
      navigator.sendBeacon("http://127.0.0.1:8000/api/clear_cache");
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
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

  if (!stats || stats.status === 'loading') {
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
            active={currentView === 'creance' || currentView === 'ventilation'}
            onClick={() => setCurrentView('creance')}
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
        {stats?.error && (
          <div className="mb-8 p-6 bg-rose-50 border border-rose-100 rounded-3xl flex items-center gap-4 text-rose-600 animate-pulse">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
              <Ban size={24} />
            </div>
            <div>
              <p className="font-black uppercase text-xs tracking-widest mb-1">Erreur de Connexion</p>
              <p className="font-bold text-sm">{stats.error}</p>
            </div>
          </div>
        )}
        {currentView === 'dashboard' ? (
          <div className="space-y-10">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-6">
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
                title="Chiffre d'Affaire"
                value={`${stats?.total_revenue?.toLocaleString() || "..."} DA`}
                icon={<CreditCard className="text-violet-500" size={24} />}
                trend="HT / TTC"
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
        ) : currentView === 'creance' ? (
          <CreanceDetailView
            onBack={() => setCurrentView('dashboard')}
          />
        ) : currentView === 'ventilation' ? (
          <CreanceVentilationView onBack={() => setCurrentView('creance')} initialFilter={ventilationFilter} />
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

    const handlePrintInvoices = () => {
      const doc = new jsPDF("p", "pt", "a4");
      const pageWidth = doc.internal.pageSize.width;

      // HEADER
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(13, 131, 222);
      doc.text("Algérienne Des Eaux", 40, 40);

      doc.setFontSize(10);
      doc.setTextColor(71, 84, 103);
      doc.text("Unité : 26 - MEDEA", pageWidth - 40, 35, { align: 'right' });
      doc.text("Centre : S02 - BERROUAGHIA", pageWidth - 40, 47, { align: 'right' });

      // TITLE
      doc.setFontSize(16);
      doc.setTextColor(16, 24, 40);
      doc.text("HISTORIQUE DES FACTURES", pageWidth / 2, 85, { align: 'center' });

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
        startY: 215,
        theme: 'grid',
        styles: { fontSize: 8, font: 'helvetica' },
        headStyles: { fillColor: [13, 131, 222], textColor: 255, fontStyle: 'bold' },
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
              <td className="px-6 py-4 font-medium text-[13px] text-[#667085]">{sub.type}</td>
              <td className="px-6 py-4">{etatBadge(sub.etatcpt, sub.etat_label)}</td>
              <td className="px-6 py-4 text-right font-medium text-[13px] text-[#475467]">{sub.numordre}</td>
            </tr>
          )) : (
            <tr>
              <td colSpan={10} className="px-8 py-8 text-center text-[#667085] font-medium">Aucun abonné trouvé.</td>
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

function CreanceDetailView({ onBack }: any) {

  const [data, setData] = useState<any>(null);
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
  const [lastVentDate, setLastVentDate] = useState("");

  const toggleSection = (section: string) => {
    setExpandedSections(prev =>
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
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-bold text-[#667085] hover:text-[#101828] mb-4 transition-colors"
        >
          <ChevronRight className="rotate-180" size={16} /> Retour au tableau de bord
        </button>
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-2xl font-black tracking-tight text-[#101828]">Créance Globale & Chiffre d'Affaires</h3>
            <p className="text-sm text-[#667085] mt-1">Analyse de la facturation et du recouvrement depuis FACTURES.DBF</p>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mt-8 pt-8 border-t border-[#F2F4F7]">
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
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
            {[
              { label: "CA Eau", value: fmt(data.total_ca_eau), color: "bg-blue-50 text-blue-600", dot: "bg-blue-500" },
              { label: "CA Prestation", value: fmt(data.total_ca_prestation), color: "bg-cyan-50 text-cyan-600", dot: "bg-cyan-500" },
              { label: "CA Total", value: fmt(data.total_ca), color: "bg-violet-50 text-violet-600", dot: "bg-violet-500" },
              { label: "Recouvré", value: fmt(data.total_recouvre), color: "bg-emerald-50 text-emerald-600", dot: "bg-emerald-500" },
              { label: "Créance", value: fmt(data.total_creance), color: "bg-rose-50 text-rose-600", dot: "bg-rose-500" },
              { label: "Taux Recov.", value: `${((data.total_recouvre / data.total_ca) * 100).toFixed(2)}%`, color: "bg-amber-50 text-amber-600", dot: "bg-amber-500" },
            ].map((kpi, i) => (
              <div
                key={i}
                onClick={() => {
                  // Scroll reference removed
                }}
                className={`bg-white border border-[#E4E7EC] rounded-[2.5rem] p-5 shadow-sm hover:shadow-md transition-all`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-2 h-2 rounded-full ${kpi.dot}`}></div>
                  <p className="text-[10px] font-black text-[#667085] uppercase tracking-widest">{kpi.label}</p>
                </div>
                <p className={`text-base font-black tracking-tighter ${kpi.color.split(' ')[1]}`}>{kpi.value}</p>
              </div>
            ))}
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
                      value: (data.total_recouvre / data.total_ca) * 100,
                      fill: (data.total_recouvre / data.total_ca) * 100 >= 90 ? '#10B981' : '#F59E0B'
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
                      {((data.total_recouvre / data.total_ca) * 100).toFixed(1)}
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
                  <div className={`px-4 py-2 rounded-2xl border font-black text-xs uppercase tracking-widest ${((data.total_recouvre / data.total_ca) * 100) >= 90 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                    {((data.total_recouvre / data.total_ca) * 100) >= 90 ? 'Objectif Atteint' : 'Sous Objectif (90%)'}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-[#F9FAFB] rounded-[2rem] border border-[#F2F4F7] group hover:border-violet-200 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-500"></div>
                      <p className="text-[10px] font-black text-[#98A2B3] uppercase tracking-widest">CA Total Émis</p>
                    </div>
                    <p className="text-lg font-black text-[#101828] font-mono tracking-tighter">{fmt(data.total_ca)}</p>
                  </div>
                  <div className="p-4 bg-emerald-50/50 rounded-[2rem] border border-emerald-100 group hover:border-emerald-200 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Montant Recouvré</p>
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
                      className={`h-full rounded-full transition-all duration-1000 shadow-sm ${((data.total_recouvre / data.total_ca) * 100) >= 90 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                      style={{ width: `${Math.min((data.total_recouvre / data.total_ca) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>


          {/* Tableau par Commune */}
          <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] overflow-hidden">
            <div className="p-8 border-b border-[#F2F4F7]">
              <h4 className="text-xl font-black tracking-tight text-[#101828]">Répartition par Commune</h4>
              <p className="text-sm text-[#667085] mt-1">Détails du Chiffre d'Affaire Eau et Prestation</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F9FAFB] text-[#475467] text-[10px] uppercase tracking-wider font-black">
                    <th className="px-8 py-5">Commune</th>
                    <th className="px-6 py-5 text-right">CA Eau (DA)</th>
                    <th className="px-6 py-5 text-right">CA Prest. (DA)</th>
                    <th className="px-6 py-5 text-right">Total CA (DA)</th>
                    <th className="px-6 py-5 text-right text-rose-600">Créance (DA)</th>
                    <th className="px-8 py-5 text-right">Taux Cré. (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2F4F7]">
                  {data.by_commune.map((c: any, i: number) => (
                    <tr key={i} className="hover:bg-[#F9FAFB] transition-colors group">
                      <td className="px-8 py-4 font-black text-sm text-[#101828]">{c.name}</td>
                      <td className="px-6 py-4 text-right font-medium text-[13px] text-blue-600">{fmt(c.ca_eau)}</td>
                      <td className="px-6 py-4 text-right font-medium text-[13px] text-cyan-600">{fmt(c.ca_prestation)}</td>
                      <td className="px-6 py-4 text-right font-black text-[13px] text-violet-600">{fmt(c.ca)}</td>
                      <td className="px-6 py-4 text-right font-black text-[13px] text-rose-600 bg-rose-50/30">{fmt(c.creance)}</td>
                      <td className="px-8 py-4 text-right font-black text-[13px] text-[#475467]">{c.taux.toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="sticky bottom-0 z-10">
                  <tr className="bg-slate-900 text-white font-black shadow-[0_-4px_10px_rgba(0,0,0,0.1)]">
                    <td className="px-8 py-5 text-sm uppercase tracking-widest">TOTAL GÉNÉRAL</td>
                    <td className="px-6 py-5 text-right text-blue-400 font-mono">{fmt(data.total_ca_eau)}</td>
                    <td className="px-6 py-5 text-right text-cyan-400 font-mono">{fmt(data.total_ca_prestation)}</td>
                    <td className="px-6 py-5 text-right text-violet-400 font-mono">{fmt(data.total_ca)}</td>
                    <td className="px-6 py-5 text-right text-rose-400 bg-white/5 font-mono">{fmt(data.total_creance)}</td>
                    <td className="px-8 py-5 text-right text-slate-300 font-mono">{((data.total_creance / data.total_ca) * 100).toFixed(2)}%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Tableau par Type */}
          <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] overflow-hidden">
            <div className="p-8 border-b border-[#F2F4F7]">
              <h4 className="text-xl font-black tracking-tight text-[#101828]">Répartition par Type d'Abonné</h4>
              <p className="text-sm text-[#667085] mt-1">Analyse comparative Eau / Prestation</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F9FAFB] text-[#475467] text-[10px] uppercase tracking-wider font-black">
                    <th className="px-8 py-5">Type d'Abonné</th>
                    <th className="px-6 py-5 text-right">CA Eau (DA)</th>
                    <th className="px-6 py-5 text-right">CA Prest. (DA)</th>
                    <th className="px-6 py-5 text-right">Total CA (DA)</th>
                    <th className="px-6 py-5 text-right text-rose-600">Créance (DA)</th>
                    <th className="px-8 py-5 text-right">Taux Cré. (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2F4F7]">
                  {data.by_type.map((t: any, i: number) => (
                    <tr key={i} className="hover:bg-[#F9FAFB] transition-colors group">
                      <td className="px-8 py-4 font-black text-sm text-[#101828]">{t.name}</td>
                      <td className="px-6 py-4 text-right font-medium text-[13px] text-blue-600">{fmt(t.ca_eau)}</td>
                      <td className="px-6 py-4 text-right font-medium text-[13px] text-cyan-600">{fmt(t.ca_prestation)}</td>
                      <td className="px-6 py-4 text-right font-black text-[13px] text-violet-600">{fmt(t.ca)}</td>
                      <td className="px-6 py-4 text-right font-black text-[13px] text-rose-600 bg-rose-50/30">{fmt(t.creance)}</td>
                      <td className="px-8 py-4 text-right font-black text-[13px] text-[#475467]">{t.taux.toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="sticky bottom-0 z-10">
                  <tr className="bg-slate-900 text-white font-black shadow-[0_-4px_10px_rgba(0,0,0,0.1)]">
                    <td className="px-8 py-5 text-sm uppercase tracking-widest">TOTAL GÉNÉRAL</td>
                    <td className="px-6 py-5 text-right text-blue-400 font-mono">{fmt(data.total_ca_eau)}</td>
                    <td className="px-6 py-5 text-right text-cyan-400 font-mono">{fmt(data.total_ca_prestation)}</td>
                    <td className="px-6 py-5 text-right text-violet-400 font-mono">{fmt(data.total_ca)}</td>
                    <td className="px-6 py-5 text-right text-rose-400 bg-white/5 font-mono">{fmt(data.total_creance)}</td>
                    <td className="px-8 py-5 text-right text-slate-300 font-mono">{((data.total_creance / data.total_ca) * 100).toFixed(2)}%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}


function CreanceVentilationView({ onBack, initialFilter }: any) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateArrete, setDateArrete] = useState(new Date().toISOString().split('T')[0]);
  const [tableSearch, setTableSearch] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' | null }>({ key: '', direction: null });
  const [sectionFilter, setSectionFilter] = useState<'ALL' | 'EAU' | 'PRESTATIONS'>(initialFilter || 'ALL');

  useEffect(() => {
    if (initialFilter) {
      setSectionFilter(initialFilter);
    }
  }, [initialFilter]);


  const fetchData = async (date: string) => {
    setLoading(true);
    setError(null);
    try {
      const formattedDate = date.replace(/-/g, '');
      const res = await fetch(`http://127.0.0.1:8000/creance_detaillee?date_arrete=${formattedDate}`);
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setData(d);
    } catch (e: any) {
      setError(e.message || "Erreur de connexion.");
    }
    setLoading(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortedData = (rows: any[]) => {
    if (!sortConfig.key || !sortConfig.direction) return rows;

    return [...rows].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const sA = String(aVal).toLowerCase();
      const sB = String(bVal).toLowerCase();
      if (sA < sB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (sA > sB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const getFilteredData = () => {
    let filtered = data;
    if (sectionFilter !== 'ALL') {
      filtered = filtered.filter(r => r.SECTION === sectionFilter);
    }
    if (!tableSearch) return filtered;
    const s = tableSearch.toLowerCase();
    return filtered.filter(r =>
      r.CATEGORIE.toLowerCase().includes(s) ||
      r.SECTION.toLowerCase().includes(s) ||
      r.TYPE_CODE.toLowerCase().includes(s)
    );
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("fr-DZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + " DA";

  const handleExportExcel = () => {
    const filteredData = getFilteredData();
    if (filteredData.length === 0) return;

    // Prepare data for Excel
    const worksheetData = filteredData.map(row => ({
      'Section': row.SECTION,
      'Type': row.TYPE_CODE,
      'Désignation': row.CATEGORIE,
      'Volume (Factures)': row.NBR_FACTURES,
      'Abonnés': row.NBR_ABONNES,
      'Créance (DA)': row.CREANCE
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Ventilation Créances");

    // Auto-size columns
    const maxWidths = [15, 10, 40, 15, 15, 20];
    worksheet['!cols'] = maxWidths.map(w => ({ wch: w }));

    XLSX.writeFile(workbook, `Ventilation_Creances_${dateArrete}.xlsx`);
  };

  const handleExportPDF = () => {
    const filteredData = getFilteredData();
    if (filteredData.length === 0) return;

    const doc = new jsPDF();

    // Group rows by section and only show section label on first row of each group
    const tableData: any[] = [];
    let lastSection = '';
    filteredData.forEach(row => {
      tableData.push([
        row.SECTION !== lastSection ? row.SECTION : '',
        row.TYPE_CODE,
        row.CATEGORIE,
        row.NBR_FACTURES.toLocaleString(),
        row.NBR_ABONNES.toLocaleString(),
        fmt(row.CREANCE)
      ]);
      lastSection = row.SECTION;
    });

    doc.setFontSize(18);
    doc.text("Ventilation Détaillée des Créances", 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Situation arrêtée au : ${formatDate(dateArrete)}`, 14, 30);

    autoTable(doc, {
      startY: 40,
      head: [['Section', 'Type', 'Désignation', 'Volume', 'Abonnés', 'Créance']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [16, 24, 40], textColor: [255, 255, 255] },
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: {
        0: { fontStyle: 'bold', textColor: [13, 131, 222] },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' }
      }
    });

    doc.save(`Ventilation_Creances_${dateArrete}.pdf`);
  };



  return (
    <div className="space-y-10">
      <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] p-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-bold text-[#667085] hover:text-[#101828] mb-4 transition-colors no-print"
        >
          <ChevronRight className="rotate-180" size={16} /> Retour à l'analyse globale
        </button>
        <h3 className="text-2xl font-black tracking-tight text-[#101828]">Ventilation Détaillée des Créances</h3>
        <p className="text-sm text-[#667085] mt-1 no-print">Structure financière arrêtée à une date précise (Requête SQL Legacy)</p>

        <div className="flex items-end justify-between mt-8 pt-8 border-t border-[#F2F4F7]">
          <div className="flex items-end gap-6 no-print">
            <FrenchDateInput
              label="Date d'Arrêté"
              value={dateArrete}
              onChange={setDateArrete}
              className="block bg-[#F9FAFB] border border-[#E4E7EC] rounded-xl px-4 py-2.5 text-xs font-bold text-[#101828] outline-none hover:border-[#D0D5DD] transition-all w-48"
            />
            <button
              onClick={() => fetchData(dateArrete)}
              className="px-8 py-2.5 bg-[#0D83DE] text-white rounded-xl text-xs font-black shadow-lg shadow-blue-100 hover:bg-[#0b72c2] transition-all flex items-center gap-2 h-[42px]"
            >
              <TrendingUp size={16} />
              Générer
            </button>

            {data.length > 0 && (
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[#98A2B3] uppercase px-1">Type de Ventilation</label>
                <div className="flex bg-[#F2F4F7] p-1 rounded-xl">
                  <button
                    onClick={() => setSectionFilter('ALL')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${sectionFilter === 'ALL' ? 'bg-white shadow-sm text-[#101828]' : 'text-[#667085] hover:text-[#101828]'}`}
                  >
                    Tout
                  </button>
                  <button
                    onClick={() => setSectionFilter('EAU')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${sectionFilter === 'EAU' ? 'bg-white shadow-sm text-blue-600' : 'text-[#667085] hover:text-[#101828]'}`}
                  >
                    Eau
                  </button>
                  <button
                    onClick={() => setSectionFilter('PRESTATIONS')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${sectionFilter === 'PRESTATIONS' ? 'bg-white shadow-sm text-purple-600' : 'text-[#667085] hover:text-[#101828]'}`}
                  >
                    Prestations
                  </button>
                </div>
              </div>
            )}

            {data.length > 0 && (
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[#98A2B3] uppercase px-1">Filtrer le tableau</label>
                <div className="relative">
                  <input
                    type="text"
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    placeholder="Rechercher une catégorie..."
                    className="block bg-white border border-[#E4E7EC] rounded-xl px-9 py-2.5 text-xs font-bold text-[#101828] outline-none focus:ring-2 focus:ring-[#0D83DE]/20 w-64"
                  />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#98A2B3]" size={14} />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 no-print">
            <button
              onClick={handleExportExcel}
              disabled={data.length === 0}
              className="px-6 py-2.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-black hover:bg-emerald-100 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileSpreadsheet size={16} />
              Excel
            </button>
            <button
              onClick={handleExportPDF}
              disabled={data.length === 0}
              className="px-6 py-2.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-black hover:bg-rose-100 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileText size={16} />
              PDF
            </button>
            <button
              onClick={handlePrint}
              disabled={data.length === 0}
              className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black shadow-lg shadow-slate-200 hover:bg-black transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Printer size={16} />
              Imprimer (A4)
            </button>
          </div>

          {/* Title for Print only */}
          <div className="hidden print:block text-center w-full">
            <h1 className="text-2xl font-black uppercase tracking-widest text-[#101828]">Ventilation Détaillée des Créances</h1>
            <p className="text-sm font-bold text-[#475467] mt-1">Situation arrêtée au : {formatDate(dateArrete)}</p>
          </div>
        </div>
      </div>

      {loading && (
        <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] p-16 flex flex-col items-center gap-6">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0D83DE]"></div>
          <p className="font-black text-[#101828] text-lg text-center">Calcul de la ventilation en cours…<br /><span className="text-sm text-[#667085] font-bold">Analyse de la section EAU et PRESTATIONS</span></p>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-[2rem] p-8 text-rose-600 font-bold">{error}</div>
      )}

      {data.length > 0 && !loading && (
        <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] overflow-hidden">
          <div id="print-area" className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="sticky top-0 z-20 bg-white">
                <tr className="bg-[#F9FAFB] text-[#667085] text-[10px] uppercase tracking-[0.2em] font-bold border-b border-[#E4E7EC]">
                  <th className="px-8 py-4 cursor-pointer hover:text-[#101828] transition-colors" onClick={() => handleSort('SECTION')}>
                    <div className="flex items-center gap-1">Section {sortConfig.key === 'SECTION' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</div>
                  </th>
                  <th className="px-6 py-4 cursor-pointer hover:text-[#101828] transition-colors" onClick={() => handleSort('TYPE_CODE')}>
                    <div className="flex items-center gap-1">Type {sortConfig.key === 'TYPE_CODE' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</div>
                  </th>
                  <th className="px-6 py-4 cursor-pointer hover:text-[#101828] transition-colors" onClick={() => handleSort('CATEGORIE')}>
                    <div className="flex items-center gap-1">Désignation {sortConfig.key === 'CATEGORIE' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</div>
                  </th>
                  <th className="px-6 py-4 text-right cursor-pointer hover:text-[#101828] transition-colors" onClick={() => handleSort('NBR_FACTURES')}>
                    <div className="flex items-center justify-end gap-1">Volume {sortConfig.key === 'NBR_FACTURES' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</div>
                  </th>
                  <th className="px-6 py-4 text-right cursor-pointer hover:text-[#101828] transition-colors" onClick={() => handleSort('NBR_ABONNES')}>
                    <div className="flex items-center justify-end gap-1">Abonnés {sortConfig.key === 'NBR_ABONNES' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</div>
                  </th>
                  <th className="px-8 py-4 text-right cursor-pointer hover:text-[#101828] transition-colors" onClick={() => handleSort('CREANCE')}>
                    <div className="flex items-center justify-end gap-1">Créance {sortConfig.key === 'CREANCE' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2F4F7]">
                {(sectionFilter === 'ALL' ? ['EAU', 'PRESTATIONS'] : [sectionFilter]).map(section => {
                  const sectionRows = getSortedData(getFilteredData().filter((r: any) => r.SECTION === section));
                  if (sectionRows.length === 0) return null;

                  const subTotalFactures = sectionRows.reduce((acc: number, curr: any) => acc + curr.NBR_FACTURES, 0);
                  const subTotalAbonnes = sectionRows.reduce((acc: number, curr: any) => acc + curr.NBR_ABONNES, 0);
                  const subTotalCreance = sectionRows.reduce((acc: number, curr: any) => acc + curr.CREANCE, 0);

                  const isEau = section === 'EAU';

                  return (
                    <Fragment key={section}>
                      {sectionRows.map((row, i) => (
                        <tr key={`${section}-${i}`} className="hover:bg-[#F9FAFB]/50 transition-colors group">
                          {/* Section cell: only render on the first row of the group, spanning all rows */}
                          {i === 0 && (
                            <td
                              rowSpan={sectionRows.length}
                              className="px-8 py-4 align-middle border-r border-[#F2F4F7]"
                            >
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold tracking-widest uppercase ${isEau ? 'bg-blue-50 text-blue-600 border border-blue-100/50' : 'bg-purple-50 text-purple-600 border border-purple-100/50'}`}>
                                {row.SECTION}
                              </span>
                            </td>
                          )}
                          <td className="px-6 py-4">
                            <span className="font-mono text-[10px] font-medium text-[#667085] bg-[#F9FAFB] px-1.5 py-0.5 rounded border border-[#E4E7EC]">
                              {row.TYPE_CODE}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-semibold text-[13px] text-[#101828] uppercase tracking-tight leading-tight">{row.CATEGORIE}</div>
                            <div className="text-[9px] text-[#98A2B3] font-medium uppercase mt-0.5 tracking-tighter">Code Ordre: {row.ORDRE.toString().padStart(3, '0')}</div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="font-medium text-[13px] text-[#475467] font-mono">{row.NBR_FACTURES.toLocaleString()}</div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="font-medium text-[13px] text-[#475467] font-mono">{row.NBR_ABONNES.toLocaleString()}</div>
                          </td>
                          <td className="px-8 py-4 text-right">
                            <div className="font-semibold text-[13px] text-[#101828] font-mono tracking-tighter tabular-nums">{fmt(row.CREANCE)}</div>
                          </td>
                        </tr>
                      ))}
                      {/* Section Sub-total Row - Premium Styling */}
                      <tr className={`${isEau ? 'bg-blue-50/20' : 'bg-purple-50/20'} border-y border-[#F2F4F7] print:bg-slate-50 print:h-8`}>
                        <td colSpan={3} className="px-8 py-4 print:py-1">
                          <div className="flex items-center gap-2">
                            <div className={`w-1 h-5 rounded-full ${isEau ? 'bg-blue-400' : 'bg-purple-400'} opacity-50`}></div>
                            <p className="text-[13px] font-bold text-[#101828]">Sous-total {section}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right print:py-1">
                          <span className="text-[13px] font-semibold text-[#475467] font-mono">{subTotalFactures.toLocaleString()}</span>
                        </td>
                        <td className="px-6 py-4 text-right print:py-1">
                          <span className="text-[13px] font-semibold text-[#475467] font-mono">{subTotalAbonnes.toLocaleString()}</span>
                        </td>
                        <td className={`px-8 py-4 text-right ${isEau ? 'bg-blue-50/50' : 'bg-purple-50/50'} print:py-1`}>
                          <span className="text-[15px] font-bold text-[#101828] font-mono tracking-tighter">{fmt(subTotalCreance)}</span>
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
                <tr className="bg-white border-t-2 border-[#101828] relative z-10">
                  <td colSpan={3} className="px-8 py-6 border-b border-white">
                    <div className="flex items-center gap-3">
                      <div className="w-1 h-8 bg-[#0D83DE] rounded-full"></div>
                      <div>
                        <h4 className="text-[9px] font-bold uppercase tracking-[0.3em] text-[#0D83DE] mb-0.5">Situation Consolidée</h4>
                        <p className="text-lg font-bold tracking-tight text-[#101828] uppercase">Total Général</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-6 text-right border-l border-[#F2F4F7]">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-[#98A2B3] mb-1">Volume</p>
                    <p className="text-[15px] font-bold text-[#475467] font-mono">
                      {getFilteredData().reduce((acc: number, curr: any) => acc + curr.NBR_FACTURES, 0).toLocaleString()}
                    </p>
                  </td>
                  <td className="px-6 py-6 text-right border-l border-[#F2F4F7]">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-[#98A2B3] mb-1">Couv.</p>
                    <p className="text-[15px] font-bold text-[#475467] font-mono">100%</p>
                  </td>
                  <td className="px-8 py-6 text-right border-l border-[#F2F4F7] bg-[#F9FAFB]/30">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-[#0D83DE] mb-1">Créance Nette</p>
                    <p className="text-xl font-bold text-[#101828] tracking-tighter font-mono tabular-nums">
                      {fmt(getFilteredData().reduce((acc: number, curr: any) => acc + curr.CREANCE, 0))}
                    </p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
