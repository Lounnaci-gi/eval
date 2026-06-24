"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Database, RefreshCw, Search } from "lucide-react";
import { apiUrl } from "../lib/api";

export function SettingsView({
  onBack,
  setupMode = false,
  showBack = false,
  onConfigured,
}: {
  onBack: () => void;
  setupMode?: boolean;
  showBack?: boolean;
  onConfigured?: () => void;
}) {
  const [unites, setUnites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sectorSearch, setSectorSearch] = useState('');
  const [clearingCache, setClearingCache] = useState(false);
  const [cacheMessage, setCacheMessage] = useState<string | null>(null);
  const [dataDir, setDataDir] = useState('');
  const [dataDirInfo, setDataDirInfo] = useState<{
    diagnostic?: string;
    dbf_count?: number;
    data_dir_exists?: boolean;
    locked_by_env?: boolean;
    is_db_ready?: boolean;
    loading_status?: string;
  } | null>(null);
  const [dataDirLoading, setDataDirLoading] = useState(true);
  const [savingDataDir, setSavingDataDir] = useState(false);
  const [dataDirMessage, setDataDirMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const fetchDataDir = async () => {
    setDataDirLoading(true);
    try {
      const res = await fetch(apiUrl('/api/data_dir'));
      const data = await res.json();
      setDataDir(data.data_dir || '');
      setDataDirInfo(data);
    } catch {
      setDataDirMessage({ type: 'err', text: 'Impossible de lire la configuration du dossier données.' });
    } finally {
      setDataDirLoading(false);
    }
  };

  const handleSaveDataDir = async () => {
    const trimmed = dataDir.trim();
    if (!trimmed) {
      setDataDirMessage({ type: 'err', text: 'Indiquez le chemin du dossier contenant les fichiers DBF.' });
      return;
    }
    if (!confirm(`Utiliser ce dossier pour les données EPEOR ?\n\n${trimmed}\n\nLes données seront rechargées (quelques minutes).`)) {
      return;
    }
    setSavingDataDir(true);
    setDataDirMessage(null);
    try {
      const res = await fetch(apiUrl('/api/data_dir'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data_dir: trimmed }),
      });
      const data = await res.json();
      if (data.status === 'error') {
        setDataDirMessage({ type: 'err', text: data.message || 'Chemin invalide.' });
        setSavingDataDir(false);
        return;
      }
      setDataDir(data.data_dir || trimmed);
      setDataDirMessage({ type: 'ok', text: data.message || 'Dossier enregistré.' });
      await fetchDataDir();
      if (onConfigured) {
        setTimeout(() => onConfigured(), 3000);
      } else {
        setTimeout(() => window.location.reload(), 5000);
      }
    } catch {
      setDataDirMessage({ type: 'err', text: 'Erreur de communication avec le serveur backend.' });
      setSavingDataDir(false);
    }
  };

  const fetchSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/unites_settings"));
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setUnites(data);
      }
    } catch {
      setError("Impossible de charger les paramètres depuis le serveur backend.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDataDir();
    if (!setupMode) {
      fetchSettings();
    } else {
      setLoading(false);
    }
  }, [setupMode]);

  const handleClearCache = async () => {
    if (!confirm("Êtes-vous sûr de vouloir vider le cache et recharger toutes les tables DBF ? Cette opération peut prendre quelques minutes.")) {
      return;
    }
    setClearingCache(true);
    setCacheMessage("Vidage du cache et rechargement en cours. Veuillez patienter...");
    try {
      const res = await fetch(apiUrl("/api/clear_cache"));
      const data = await res.json();
      setCacheMessage(data.message || "Rechargement lancé avec succès !");
      setTimeout(() => {
        window.location.reload();
      }, 5000);
    } catch {
      setCacheMessage("Erreur lors de la communication avec le serveur.");
      setClearingCache(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      {!setupMode && (
        <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] p-8 no-print">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm font-bold text-[#667085] hover:text-[#101828] mb-4 transition-colors"
          >
            <ChevronRight className="rotate-180" size={16} /> Retour au tableau de bord
          </button>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h2 className="text-3xl font-black tracking-tight text-[#101828]">Paramètres du Système</h2>
              <p className="text-sm text-[#667085] mt-1 font-medium">Consultez la structure organisationnelle d&apos;EPEOR, l&apos;unité de gestion et ses centres associés.</p>
            </div>
          </div>
        </div>
      )}
      {setupMode && showBack && (
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-bold text-[#667085] hover:text-[#101828] flex items-center gap-2"
        >
          <ChevronRight className="rotate-180" size={16} /> Retour
        </button>
      )}

      {/* Dossier données EPEOR */}
      <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] p-8 no-print">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 bg-slate-100 text-[#0D83DE] rounded-2xl flex items-center justify-center shrink-0">
            <Database size={22} />
          </div>
          <div>
            <h3 className="text-lg font-black text-[#101828]">Dossier des données (DBF)</h3>
            <p className="text-sm text-[#667085] mt-1 font-medium">
              Chemin du répertoire contenant les fichiers EPEOR (ABONNE.DBF, FACTURES.DBF, etc.). Le changement déclenche un rechargement complet.
            </p>
          </div>
        </div>

        {dataDirLoading ? (
          <p className="text-xs font-bold text-[#98A2B3]">Lecture de la configuration...</p>
        ) : (
          <div className="space-y-4">
            {dataDirInfo?.locked_by_env && (
              <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs font-bold">
                Chemin verrouillé par la variable d&apos;environnement <span className="font-mono">EPEOR_DATA_DIR</span>.
                Modifiez-la dans start.bat ou les paramètres Windows, puis redémarrez le backend.
              </div>
            )}
            <div>
              <label className="block text-[10px] font-bold text-[#98A2B3] uppercase tracking-wider mb-2">
                Chemin du dossier
              </label>
              <input
                type="text"
                value={dataDir}
                onChange={(e) => setDataDir(e.target.value)}
                disabled={dataDirInfo?.locked_by_env || savingDataDir}
                placeholder="Ex. d:\epeor"
                className="w-full font-mono text-sm font-bold text-[#344054] bg-[#F9FAFB] border border-[#D0D5DD] rounded-xl px-4 py-3 focus:outline-none focus:ring-4 focus:ring-blue-50 focus:border-[#0D83DE] disabled:opacity-60 disabled:cursor-not-allowed"
                spellCheck={false}
              />
            </div>
            {dataDirInfo && (
              <div className="flex flex-wrap gap-3 text-[10px] font-bold">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
                    dataDirInfo.data_dir_exists
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                      : 'bg-rose-50 text-rose-700 border-rose-100'
                  }`}
                >
                  {dataDirInfo.data_dir_exists ? 'Dossier accessible' : 'Dossier introuvable'}
                </span>
                {typeof dataDirInfo.dbf_count === 'number' && (
                  <span className="inline-flex items-center px-2.5 py-1 bg-slate-50 text-slate-600 border border-slate-200 rounded-full">
                    {dataDirInfo.dbf_count} fichier(s) DBF
                  </span>
                )}
                {dataDirInfo.is_db_ready && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-full">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                    Données chargées
                  </span>
                )}
              </div>
            )}
            {dataDirInfo?.diagnostic && (
              <p className="text-xs font-medium text-[#667085]">{dataDirInfo.diagnostic}</p>
            )}
            {dataDirMessage && (
              <div
                className={`p-4 rounded-xl text-xs font-bold ${
                  dataDirMessage.type === 'ok'
                    ? 'bg-emerald-50 border border-emerald-100 text-emerald-800'
                    : 'bg-rose-50 border border-rose-100 text-rose-800'
                }`}
              >
                {dataDirMessage.text}
              </div>
            )}
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={handleSaveDataDir}
                disabled={dataDirInfo?.locked_by_env || savingDataDir || !dataDir.trim()}
                className={`px-6 py-3 rounded-2xl font-black text-xs transition-all shadow-md active:scale-95 flex items-center gap-2 ${
                  dataDirInfo?.locked_by_env || savingDataDir || !dataDir.trim()
                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                    : 'bg-[#0D83DE] text-white hover:bg-[#0b72c2] border border-[#0b72c2]'
                }`}
              >
                <RefreshCw size={16} className={savingDataDir ? 'animate-spin' : ''} />
                {savingDataDir ? 'Enregistrement...' : 'Appliquer et recharger'}
              </button>
              <button
                type="button"
                onClick={fetchDataDir}
                disabled={dataDirLoading || savingDataDir}
                className="px-6 py-3 rounded-2xl font-black text-xs border border-[#D0D5DD] text-[#344054] hover:bg-[#F9FAFB] transition-all"
              >
                Actualiser
              </button>
            </div>
          </div>
        )}
      </div>

      {!setupMode && (loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-[#E4E7EC] rounded-[2rem] shadow-sm">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-[#0D83DE] rounded-full animate-spin"></div>
          <p className="mt-4 text-sm font-bold text-[#475467]">Chargement de la structure organisationnelle...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-6 rounded-[2rem] shadow-sm">
          <p className="font-bold">Une erreur est survenue</p>
          <p className="text-sm mt-1">{error}</p>
          <button
            onClick={fetchSettings}
            className="mt-4 px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            Réessayer
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {unites.map((u: any) => {
            const filteredSectors = u.sectors.filter((s: any) => 
              s.code.toLowerCase().includes(sectorSearch.toLowerCase()) ||
              s.libelle.toLowerCase().includes(sectorSearch.toLowerCase())
            );

            return (
              <div key={u.code} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Unit Card */}
                <div className="lg:col-span-1 bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] p-8 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center font-black text-lg">
                        {u.code}
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-[#101828] uppercase">Unité {u.denom}</h3>
                        <p className="text-xs text-blue-600 font-bold">Unité de Gestion Principale</p>
                      </div>
                    </div>

                    <div className="border-t border-[#F2F4F7] pt-6 space-y-4">
                      <div>
                        <span className="block text-[10px] font-bold text-[#98A2B3] uppercase tracking-wider">Adresse</span>
                        <span className="text-sm font-bold text-[#344054]">{u.adresse || '—'}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-[#98A2B3] uppercase tracking-wider">Téléphone</span>
                        <span className="text-sm font-bold text-[#344054]">{u.telephone || '—'}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-[#98A2B3] uppercase tracking-wider">Identifiant Fiscal (NIF)</span>
                        <span className="text-sm font-mono font-bold text-[#344054]">{u.identfisc || '—'}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-[#98A2B3] uppercase tracking-wider">Article d'Imposition</span>
                        <span className="text-sm font-mono font-bold text-[#344054]">{u.nartfisc || '—'}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-[#98A2B3] uppercase tracking-wider">Banque</span>
                        <span className="text-sm font-bold text-[#344054]">{u.ncompte || '—'}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-[#98A2B3] uppercase tracking-wider">RIB / Compte Bancaire</span>
                        <span className="text-sm font-mono font-bold text-slate-700 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 block mt-1 overflow-x-auto select-all">
                          {u.dombanq || '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 pt-6 border-t border-[#F2F4F7]">
                    <div className="flex items-center gap-2.5 text-xs font-bold text-[#667085]">
                      <span>Statut :</span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                        Opérationnel
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sectors/Centers Card */}
                <div className="lg:col-span-2 bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] p-8 flex flex-col">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div>
                      <h3 className="text-lg font-black text-[#101828]">Centres & Secteurs Associés</h3>
                      <p className="text-xs text-[#667085] font-medium mt-0.5">Secteurs géographiques rattachés à l'unité de {u.denom} ({u.sectors.length} centres chargés)</p>
                    </div>
                    
                    {/* Search sector */}
                    <div className="relative">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#98A2B3]" size={16} />
                      <input
                        type="text"
                        placeholder="Rechercher un centre..."
                        className="bg-white border-[#D0D5DD] border rounded-xl pl-10 pr-4 py-2 text-xs focus:outline-none focus:ring-4 focus:ring-blue-50 focus:border-[#0D83DE] transition-all placeholder:text-[#98A2B3] w-48 sm:w-64"
                        value={sectorSearch}
                        onChange={(e) => setSectorSearch(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="border border-[#E4E7EC] rounded-2xl overflow-hidden flex-1 max-h-[500px] overflow-y-auto">
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="bg-[#F9FAFB] border-b border-[#E4E7EC] text-[#475467] text-[10px] uppercase font-black">
                          <th className="px-6 py-4">Code Centre</th>
                          <th className="px-6 py-4">Nom du Centre (Secteur)</th>
                          <th className="px-6 py-4">Code Unité</th>
                          <th className="px-6 py-4 text-right">Rattachement</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F2F4F7]">
                        {filteredSectors.length > 0 ? (
                          filteredSectors.map((s: any) => (
                            <tr key={s.code} className="hover:bg-[#F9FAFB] transition-colors group">
                              <td className="px-6 py-4 font-mono font-black text-sm text-[#0D83DE]">
                                {s.code}
                              </td>
                              <td className="px-6 py-4 font-black text-slate-800 text-sm">
                                {s.libelle}
                              </td>
                              <td className="px-6 py-4 font-mono text-xs text-[#667085]">
                                {s.unite}
                              </td>
                              <td className="px-6 py-4 text-right">
                                <span className="inline-flex items-center px-2.5 py-1 bg-blue-50/50 text-blue-700 border border-blue-100/50 rounded-lg text-[10px] font-bold">
                                  Lié à {u.denom}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="px-6 py-12 text-center text-sm font-bold text-[#98A2B3]">
                              Aucun centre ne correspond à votre recherche.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Cache Settings card */}
          <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] p-8 no-print">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h3 className="text-lg font-black text-[#101828]">Gestion du Cache de Données</h3>
                <p className="text-sm text-[#667085] mt-1 font-medium">Forcez la ré-analyse et la mise en cache des tables DBF brutes. Utilisez cette fonction si les fichiers de données sur le disque ont été modifiés.</p>
              </div>
              <button
                onClick={handleClearCache}
                disabled={clearingCache}
                className={`px-6 py-3.5 rounded-2xl font-black text-xs transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-2 ${
                  clearingCache 
                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed' 
                    : 'bg-[#0D83DE] text-white hover:bg-[#0b72c2] border border-[#0b72c2] shadow-blue-100'
                }`}
              >
                <RefreshCw size={16} className={clearingCache ? 'animate-spin' : ''} />
                Réindexer & Recharger les DBF
              </button>
            </div>
            {cacheMessage && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-100 text-blue-800 rounded-xl text-xs font-bold animate-in fade-in duration-300">
                {cacheMessage}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}



// NinStatsView removed
