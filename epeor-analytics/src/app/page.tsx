"use client";

import { useEffect, useState, Fragment } from "react";
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
  HelpCircle
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Legend
} from "recharts";

// Removed dummy data

export default function Dashboard() {
  const [currentView, setCurrentView] = useState<'dashboard' | 'details' | 'resigned' | 'stopped' | 'creance' | 'ventilation'>('dashboard');
  const [stats, setStats] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [filteredResults, setFilteredResults] = useState<any[]>([]);
  const [filterQuery, setFilterQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [hoveredAbonne, setHoveredAbonne] = useState<any>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const itemsPerPage = 20;

  useEffect(() => {
    fetch("http://localhost:8000/stats")
      .then((res) => {
        if (!res.ok) throw new Error("Erreur réseau");
        return res.json();
      })
      .then((data) => {
        setStats(data);
      })
      .catch((err) => {
        console.error("Erreur de chargement des stats:", err);
        setStats({ error: "Impossible de contacter le serveur backend (Port 8000)" });
      });
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
    const res = await fetch(`http://localhost:8000/search?query=${searchQuery}`);
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

  return (
    <div className="flex min-h-screen bg-[#F9FAFB] text-[#101828] relative" onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}>

      {/* Floating Hover Card - Obat Style */}
      {hoveredAbonne && (
        <div
          className="fixed z-50 w-80 bg-white border border-[#E4E7EC] shadow-2xl rounded-[2rem] p-6 pointer-events-none animate-in fade-in zoom-in duration-200"
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
      <aside className="w-72 bg-white border-r border-[#E4E7EC] p-6 flex flex-col gap-10 hidden md:flex">
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
          <NavItem icon={<LayoutDashboard size={20} />} label="Tableau de bord" active />
          <NavItem icon={<Users size={20} />} label="Gestion Abonnés" />
          <NavItem icon={<BarChart3 size={20} />} label="Analyses Financières" />
          <NavItem icon={<Calendar size={20} />} label="Périodes de Facturation" />
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
      <main className="flex-1 p-10 overflow-y-auto">
        <header className="flex justify-between items-start mb-12">
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
                  <h3 className="text-xl font-black tracking-tight">Répartition par Commune</h3>
                  <div className="flex bg-[#F9FAFB] p-1 rounded-xl">
                    <button className="px-4 py-1.5 bg-white shadow-sm rounded-lg text-sm font-bold">Toutes les communes</button>
                  </div>
                </div>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats?.subscriber_communes || []} margin={{ left: -20, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F2F4F7" vertical={false} />
                      <XAxis dataKey="name" stroke="#98A2B3" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                      <YAxis stroke="#98A2B3" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#101828", border: "none", borderRadius: "12px", color: "#fff" }}
                        itemStyle={{ color: "#fff" }}
                        formatter={(value: any, name: any, props: any) => {
                          if (name === "value") return [`${value.toLocaleString()}`, "Abonnés Actifs/Total"];
                          if (name === "resigned") return [`${value.toLocaleString()}`, "Abonnés Résiliés"];
                          return [value, name];
                        }}
                      />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', color: '#475467' }} />
                      <Bar dataKey="value" name="Actifs/Total" fill="#0D83DE" radius={[8, 8, 0, 0]} barSize={20} />
                      <Bar dataKey="resigned" name="Résiliés" fill="#E11D48" radius={[8, 8, 0, 0]} barSize={20} />
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
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats?.subscriber_types?.slice(0, 8) || []} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#F2F4F7" horizontal={false} />
                      <XAxis type="number" hide />
                      <YAxis
                        dataKey="name"
                        type="category"
                        stroke="#475467"
                        fontSize={11}
                        width={120}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#101828", border: "none", borderRadius: "12px", color: "#fff" }}
                        itemStyle={{ color: "#fff" }}
                        formatter={(value: any, name: any, props: any) => [
                          `${value.toLocaleString()} (${props.payload.percentage}%)`,
                          "Abonnés"
                        ]}
                      />
                      <Bar dataKey="value" fill="#00D1FF" radius={[0, 8, 8, 0]} barSize={24} />
                    </BarChart>
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
        ) : currentView === 'creance' ? (
          <CreanceDetailView onBack={() => setCurrentView('dashboard')} onGoToVentilation={() => setCurrentView('ventilation')} />
        ) : currentView === 'ventilation' ? (
          <CreanceVentilationView onBack={() => setCurrentView('creance')} />
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

function NavItem({ icon, label, active = false }: any) {
  return (
    <div className={`
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
      const res = await fetch(`http://localhost:8000/subscribers?quartier=${q.id}`);
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
      const res = await fetch(`http://localhost:8000/subscribers?quartier=${q.id}&etat=40`);
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
      const res = await fetch(`http://localhost:8000/subscribers?quartier=${q.id}&etat=20`);
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

function NominativeTable({ subscribers, loading, accentColor = "blue" }: any) {
  const [hoveredSub, setHoveredSub] = useState<any>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const accentMap: any = {
    blue: { spinner: "border-[#0D83DE]", badge: "bg-blue-50 text-[#0D83DE] border-blue-200", dot: "bg-[#0D83DE]" },
    rose: { spinner: "border-rose-500", badge: "bg-rose-50 text-rose-600 border-rose-200", dot: "bg-rose-500" },
    amber: { spinner: "border-amber-500", badge: "bg-amber-50 text-amber-600 border-amber-200", dot: "bg-amber-500" },
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
                <span className="text-[10px] font-bold text-[#98A2B3] uppercase tracking-wider">N° Série</span>
                <span className="text-[12px] font-medium text-[#475467]">{hoveredSub.numser || '—'}</span>
              </div>
              <div className="flex justify-between items-center gap-3">
                <span className="text-[10px] font-bold text-[#98A2B3] uppercase tracking-wider">Type</span>
                <span className="text-[12px] font-medium text-[#475467] text-right">{hoveredSub.type || '—'}</span>
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
        <table className="w-full text-left">
          <thead>
            <tr className="bg-[#F9FAFB] text-[#475467] text-[11px] uppercase tracking-wider font-bold">
              <th className="px-6 py-5">N° Abonné</th>
              <th className="px-6 py-5">Nom / Raison Sociale</th>
              <th className="px-6 py-5">Adresse</th>
              <th className="px-4 py-5">Bloc</th>
              <th className="px-4 py-5">N° Dom</th>
              <th className="px-6 py-5">N° Série</th>
              <th className="px-6 py-5">Type d'Abonnement</th>
              <th className="px-6 py-5 text-right">N° Ordre</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F2F4F7]">
            {subscribers.length > 0 ? subscribers.map((sub: any, i: number) => (
              <tr
                key={i}
                className="hover:bg-[#F9FAFB] transition-colors cursor-default"
                onMouseEnter={(e) => { setHoveredSub(sub); setMousePos({ x: e.clientX, y: e.clientY }); }}
                onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setHoveredSub(null)}
              >
                <td className="px-6 py-4 font-black text-[13px] text-[#101828] whitespace-nowrap">{sub.numab}</td>
                <td className="px-6 py-4 font-medium text-[13px] text-[#101828] min-w-[200px]">{sub.name}</td>
                <td className="px-6 py-4 font-medium text-[13px] text-[#667085] min-w-[200px]">{sub.adresse}</td>
                <td className="px-4 py-4 font-medium text-[13px] text-[#667085]">{sub.bloc}</td>
                <td className="px-4 py-4 font-medium text-[13px] text-[#667085]">{sub.ndom}</td>
                <td className="px-6 py-4 font-medium text-[13px] text-[#475467] whitespace-nowrap">{sub.numser}</td>
                <td className="px-6 py-4 font-medium text-[13px] text-[#667085]">{sub.type}</td>
                <td className="px-6 py-4 text-right font-medium text-[13px] text-[#475467]">{sub.numordre}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={8} className="px-8 py-8 text-center text-[#667085] font-medium">Aucun abonné trouvé.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

function CreanceDetailView({ onBack, onGoToVentilation }: any) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
  const [filterPeriod, setFilterPeriod] = useState('all');

  const fetchData = async (start = '', end = '') => {
    setData(null);
    setLoading(true);
    try {
      const url = new URL("http://localhost:8000/creance");
      if (start) url.searchParams.append("start_date", start.replace(/-/g, ''));
      if (end) url.searchParams.append("end_date", end.replace(/-/g, ''));

      const res = await fetch(url.toString());
      const d = await res.json();
      setData(d);
    } catch (e) {
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
    new Intl.NumberFormat("fr-DZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + " DA";

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
          <button
            onClick={onGoToVentilation}
            className="px-6 py-3 bg-white border border-[#0D83DE] text-[#0D83DE] rounded-2xl text-xs font-black hover:bg-blue-50 transition-all flex items-center gap-2 shadow-sm"
          >
            <BarChart3 size={16} />
            Ventilation Détaillée (SQL)
          </button>
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
              className="px-6 py-2.5 bg-violet-600 text-white rounded-xl text-xs font-black shadow-lg shadow-violet-100 hover:bg-violet-700 transition-all flex items-center gap-2"
            >
              <Search size={14} />
              Calculer
            </button>
          </div>

          <div className="flex items-end gap-3 p-4 bg-[#F9FAFB] rounded-2xl border border-[#F2F4F7] border-dashed">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#98A2B3] uppercase px-1">Intervalle de date personnalisé</label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  className="block bg-white border border-[#E4E7EC] rounded-xl px-3 py-2 text-xs font-bold text-[#101828] focus:ring-2 focus:ring-violet-500 outline-none"
                />
                <span className="text-[#98A2B3] text-xs font-bold">au</span>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  className="block bg-white border border-[#E4E7EC] rounded-xl px-3 py-2 text-xs font-bold text-[#101828] focus:ring-2 focus:ring-violet-500 outline-none"
                />
                <button
                  onClick={handleCustomFilter}
                  className="p-2 bg-white border border-[#E4E7EC] rounded-xl text-violet-600 hover:bg-violet-50 transition-colors shadow-sm"
                >
                  <Search size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] p-16 flex flex-col items-center gap-6">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-500"></div>
          <div className="text-center">
            <p className="font-black text-[#101828] text-lg">Calcul en cours…</p>
            <p className="text-sm text-[#667085] mt-1">Traitement de plus d'un million de factures. Veuillez patienter.</p>
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
                  if (kpi.label === "Créance") {
                    document.getElementById('raw-type-table')?.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                className={`bg-white border border-[#E4E7EC] rounded-[2.5rem] p-5 shadow-sm hover:shadow-md transition-all ${kpi.label === "Créance" ? "cursor-pointer ring-offset-2 hover:ring-2 hover:ring-rose-500" : ""}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-2 h-2 rounded-full ${kpi.dot}`}></div>
                  <p className="text-[10px] font-black text-[#667085] uppercase tracking-widest">{kpi.label}</p>
                </div>
                <p className={`text-base font-black tracking-tighter ${kpi.color.split(' ')[1]}`}>{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* Progress bar recouvrement */}
          <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] p-8">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-bold text-[#475467]">Taux de recouvrement global</span>
              <span className="text-sm font-black text-[#101828]">{((data.total_recouvre / data.total_ca) * 100).toFixed(2)}%</span>
            </div>
            <div className="w-full bg-[#F2F4F7] rounded-full h-3">
              <div
                className="h-3 rounded-full bg-gradient-to-r from-violet-500 to-emerald-500 transition-all duration-700"
                style={{ width: `${Math.min((data.total_recouvre / data.total_ca) * 100, 100)}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-[11px] font-bold text-[#98A2B3] mt-2">
              <span>0%</span>
              <span className="text-amber-500">Objectif 90%</span>
              <span>100%</span>
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
              </table>
            </div>
          </div>
          {/* Tableau par Type de Facture (Codes Raw) */}
          <div id="raw-type-table" className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] overflow-hidden scroll-mt-10">
            <div className="p-8 border-b border-[#F2F4F7]">
              <h4 className="text-xl font-black tracking-tight text-[#101828]">Répartition par Code de Facture (Raw TYPE)</h4>
              <p className="text-sm text-[#667085] mt-1">Breakdown détaillé par code brut (E, C, 7, etc.) tel que défini dans le système</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F9FAFB] text-[#475467] text-[10px] uppercase tracking-wider font-black">
                    <th className="px-8 py-5">Code Type</th>
                    <th className="px-6 py-5 text-right">Nb Factures</th>
                    <th className="px-6 py-5 text-right text-rose-600">Montant Créance (DA)</th>
                    <th className="px-8 py-5 text-right">Part (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2F4F7]">
                  {data.by_raw_type?.map((t: any, i: number) => (
                    <tr key={i} className="hover:bg-[#F9FAFB] transition-colors group">
                      <td className="px-8 py-4 font-black text-sm text-[#101828]">Type {t.type}</td>
                      <td className="px-6 py-4 text-right font-medium text-[13px] text-[#475467]">{t.count.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right font-black text-[13px] text-rose-600 bg-rose-50/30">{fmt(t.creance)}</td>
                      <td className="px-8 py-4 text-right font-black text-[13px] text-[#475467]">
                        {((t.creance / data.total_creance) * 100).toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

    </div>
  );
}

function CreanceVentilationView({ onBack }: any) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateArrete, setDateArrete] = useState(new Date().toISOString().split('T')[0]);

  const fetchData = async (date: string) => {
    setLoading(true);
    setError(null);
    try {
      const formattedDate = date.replace(/-/g, '');
      const res = await fetch(`http://localhost:8000/creance_detaillee?date_arrete=${formattedDate}`);
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setData(d);
    } catch (e: any) {
      setError(e.message || "Erreur de connexion.");
    }
    setLoading(false);
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("fr-DZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + " DA";

  return (
    <div className="space-y-10">
      <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] p-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-bold text-[#667085] hover:text-[#101828] mb-4 transition-colors"
        >
          <ChevronRight className="rotate-180" size={16} /> Retour à l'analyse globale
        </button>
        <h3 className="text-2xl font-black tracking-tight text-[#101828]">Ventilation Détaillée des Créances</h3>
        <p className="text-sm text-[#667085] mt-1">Structure financière arrêtée à une date précise (Requête SQL Legacy)</p>

        <div className="flex items-end gap-4 mt-8 pt-8 border-t border-[#F2F4F7]">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-[#98A2B3] uppercase px-1">Date d'Arrêté</label>
            <input
              type="date"
              value={dateArrete}
              onChange={(e) => setDateArrete(e.target.value)}
              className="block bg-[#F9FAFB] border border-[#E4E7EC] rounded-xl px-4 py-2.5 text-xs font-bold text-[#101828] outline-none hover:border-[#D0D5DD] transition-all"
            />
          </div>
          <button
            onClick={() => fetchData(dateArrete)}
            className="px-8 py-2.5 bg-[#0D83DE] text-white rounded-xl text-xs font-black shadow-lg shadow-blue-100 hover:bg-[#0b72c2] transition-all flex items-center gap-2"
          >
            <TrendingUp size={16} />
            Générer le rapport
          </button>
        </div>
      </div>

      {loading && (
        <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] p-16 flex flex-col items-center gap-6">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0D83DE]"></div>
          <p className="font-black text-[#101828] text-lg text-center">Calcul de la ventilation en cours…<br/><span className="text-sm text-[#667085] font-bold">Analyse de la section EAU et PRESTATIONS</span></p>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-[2rem] p-8 text-rose-600 font-bold">{error}</div>
      )}

      {data.length > 0 && !loading && (
        <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#F9FAFB] text-[#475467] text-[10px] uppercase tracking-wider font-black">
                  <th className="px-8 py-5">Section</th>
                  <th className="px-6 py-5">Type</th>
                  <th className="px-6 py-5">Catégorie / Service</th>
                  <th className="px-6 py-5 text-right">Nb Factures</th>
                  <th className="px-6 py-5 text-right">Nb Abonnés</th>
                  <th className="px-8 py-5 text-right">Créance (DA)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2F4F7]">
                {['PRESTATIONS', 'EAU'].map(section => {
                  const sectionRows = data.filter(r => r.SECTION === section);
                  if (sectionRows.length === 0) return null;
                  
                  const subTotalFactures = sectionRows.reduce((acc, curr) => acc + curr.NBR_FACTURES, 0);
                  const subTotalAbonnes = sectionRows.reduce((acc, curr) => acc + curr.NBR_ABONNES, 0);
                  const subTotalCreance = sectionRows.reduce((acc, curr) => acc + curr.CREANCE, 0);

                  const isEau = section === 'EAU';

                  return (
                    <Fragment key={section}>
                      {sectionRows.map((row, i) => (
                        <tr key={`${section}-${i}`} className="hover:bg-[#F9FAFB] transition-colors group">
                          <td className="px-8 py-5">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wider uppercase ${isEau ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-purple-50 text-purple-600 border border-purple-100'}`}>
                              {row.SECTION}
                            </span>
                          </td>
                          <td className="px-6 py-5 font-mono text-xs text-[#475467]">
                            <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{row.TYPE_CODE}</span>
                          </td>
                          <td className="px-6 py-5">
                            <div className="font-black text-sm text-[#101828] mb-0.5">{row.CATEGORIE}</div>
                            <div className="text-[11px] text-[#667085] font-medium">Rang d'ordre: {row.ORDRE}</div>
                          </td>
                          <td className="px-6 py-5 text-right font-bold text-sm text-[#101828]">{row.NBR_FACTURES.toLocaleString()}</td>
                          <td className="px-6 py-5 text-right font-bold text-sm text-[#101828]">{row.NBR_ABONNES.toLocaleString()}</td>
                          <td className="px-8 py-5 text-right font-black text-sm text-[#101828] bg-slate-50/30">{fmt(row.CREANCE)}</td>
                        </tr>
                      ))}
                      {/* Section Sub-total Row - Premium Styling */}
                      <tr className={`${isEau ? 'bg-blue-50/40' : 'bg-purple-50/40'} border-y-2 ${isEau ? 'border-blue-100/50' : 'border-purple-100/50'}`}>
                        <td colSpan={3} className="px-8 py-6">
                          <div className="flex items-center gap-3">
                            <div className={`w-1.5 h-6 rounded-full ${isEau ? 'bg-blue-500' : 'bg-purple-500'}`}></div>
                            <div>
                              <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${isEau ? 'text-blue-600' : 'text-purple-600'}`}>Synthèse Section</p>
                              <p className="text-sm font-black text-[#101828]">Sous-total {section}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-6 text-right">
                          <span className="text-xs font-black text-[#475467] block uppercase mb-1 opacity-50">Factures</span>
                          <span className="text-sm font-black text-[#101828]">{subTotalFactures.toLocaleString()}</span>
                        </td>
                        <td className="px-6 py-6 text-right">
                          <span className="text-xs font-black text-[#475467] block uppercase mb-1 opacity-50">Abonnés</span>
                          <span className="text-sm font-black text-[#101828]">{subTotalAbonnes.toLocaleString()}</span>
                        </td>
                        <td className={`px-8 py-6 text-right ${isEau ? 'bg-blue-100/30' : 'bg-purple-100/30'}`}>
                          <span className={`text-xs font-black block uppercase mb-1 ${isEau ? 'text-blue-600' : 'text-purple-600'}`}>Créance Totale</span>
                          <span className="text-lg font-black text-[#101828]">{fmt(subTotalCreance)}</span>
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
                {/* Global Total Row - Ultra Premium */}
                <tr className="bg-[#101828] text-white overflow-hidden relative">
                  <td colSpan={3} className="px-8 py-10 relative z-10">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <TrendingUp className="text-white" size={24} />
                      </div>
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-[0.3em] text-blue-400 mb-1">Situation Consolidée</h4>
                        <p className="text-xl font-black tracking-tight">Total Général Arrêté</p>
                      </div>
                    </div>
                    {/* Decorative background element */}
                    <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-blue-500/10 to-transparent pointer-events-none"></div>
                  </td>
                  <td className="px-6 py-10 text-right relative z-10">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Volume Factures</p>
                    <p className="text-lg font-black">{data.reduce((acc, curr) => acc + curr.NBR_FACTURES, 0).toLocaleString()}</p>
                  </td>
                  <td className="px-6 py-10 text-right relative z-10">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Taux Couverture</p>
                    <p className="text-lg font-black">100%</p>
                  </td>
                  <td className="px-8 py-10 text-right bg-blue-600 relative z-10">
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-100 mb-2 text-right">Créance Nette Globale</p>
                    <p className="text-2xl font-black text-white">{fmt(data.reduce((acc, curr) => acc + curr.CREANCE, 0))}</p>
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
