"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import "../../lib/i18n";
import { ChevronRight, Database, RefreshCw, Search, Plus, Trash2, Edit2, Shield, User, Lock, X, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { apiUrl } from "../lib/api";
import { showAlert, showConfirm } from "./utils";

export function SettingsView({
  onBack,
  setupMode = false,
  showBack = false,
  onConfigured,
  user,
}: {
  onBack: () => void;
  setupMode?: boolean;
  showBack?: boolean;
  onConfigured?: () => void;
  user?: {
    username: string;
    display_name: string;
    is_admin: boolean;
    auth_enabled: boolean;
    allowed_sectors?: string[] | null;
  } | null;
}) {
  const { t } = useTranslation();
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

  // Active tab selection
  const [activeTab, setActiveTab] = useState<'system' | 'users' | 'profile'>(user?.is_admin ? 'system' : 'profile');

  // User management states
  const [usersList, setUsersList] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);

  const fetchUsers = async () => {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const res = await fetch(apiUrl('/api/admin/users'), { credentials: 'include' });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setUsersList(data);
    } catch {
      setUsersError(t('settings.cannotLoadUsers', 'Impossible de charger la liste des utilisateurs.'));
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    }
  }, [activeTab]);

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
    const result = await showConfirm(`Utiliser ce dossier pour les données EPEOR ?\n\n${trimmed}\n\nLes données seront rechargées (quelques minutes).`, { title: "Confirmer le changement de dossier", icon: "question" });
    if (!result.isConfirmed) {
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
    const result = await showConfirm("Êtes-vous sûr de vouloir vider le cache et recharger toutes les tables DBF ? Cette opération peut prendre quelques minutes.", { title: "Vider le cache", icon: "warning" });
    if (!result.isConfirmed) {
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
        <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[1.25rem] sm:rounded-[2rem] page-card no-print">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm font-bold text-[#667085] hover:text-[#101828] mb-4 transition-colors"
          >
            <ChevronRight className="rotate-180" size={16} /> {t('dashboard.backToDashboard')}
          </button>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h2 className="page-title text-[#101828]">{t('settings.title')}</h2>
              <p className="text-sm text-[#667085] mt-1 font-medium">{t('settings.subtitle', "Consultez la structure organisationnelle d'EPEOR, l'unité de gestion et ses centres associés.")}</p>
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
          <ChevronRight className="rotate-180" size={16} /> {t('common.back')}
        </button>
      )}

      {/* Tab navigation — visible only in non-setup mode for admins */}
      {!setupMode && user?.is_admin && (
        <div className="flex gap-1 bg-[#F2F4F7] rounded-2xl p-1.5 no-print">
          <button
            type="button"
            onClick={() => setActiveTab('system')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-black transition-all ${activeTab === 'system' ? 'bg-white shadow-sm text-[#0D83DE]' : 'text-[#667085] hover:text-[#344054]'}`}
          >
            ⚙️ {t('settings.tabSystem', 'Système')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-black transition-all ${activeTab === 'users' ? 'bg-white shadow-sm text-[#0D83DE]' : 'text-[#667085] hover:text-[#344054]'}`}
          >
            👥 {t('settings.tabUsers', 'Utilisateurs')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-black transition-all ${activeTab === 'profile' ? 'bg-white shadow-sm text-[#0D83DE]' : 'text-[#667085] hover:text-[#344054]'}`}
          >
            👤 {t('settings.tabProfile', 'Mon Profil')}
          </button>
        </div>
      )}

      {/* ======== Users Tab ======== */}
      {!setupMode && activeTab === 'users' && user?.is_admin && (
        <UsersManagementPanel
          usersList={usersList}
          usersLoading={usersLoading}
          usersError={usersError}
          sectors={(() => {
            const allSectors: string[] = [];
            unites.forEach((u: any) => (u.sectors || []).forEach((s: any) => {
              if (s.code && !allSectors.includes(s.code)) allSectors.push(s.code);
            }));
            return allSectors.map(code => {
              for (const u of unites) {
                const s = (u.sectors || []).find((s: any) => s.code === code);
                if (s) return { code, libelle: s.libelle || code };
              }
              return { code, libelle: code };
            });
          })()}
          onRefresh={fetchUsers}
          currentUsername={user.username}
        />
      )}

      {/* ======== Profile Tab ======== */}
      {!setupMode && activeTab === 'profile' && user && (
        <UserProfilePanel
          user={user}
          sectors={(() => {
            const allSectors: string[] = [];
            unites.forEach((u: any) => (u.sectors || []).forEach((s: any) => {
              if (s.code && !allSectors.includes(s.code)) allSectors.push(s.code);
            }));
            return allSectors.map(code => {
              for (const u of unites) {
                const s = (u.sectors || []).find((s: any) => s.code === code);
                if (s) return { code, libelle: s.libelle || code };
              }
              return { code, libelle: code };
            });
          })()}
        />
      )}

      {/* ======== System Tab (always visible in setup mode or when system tab active) ======== */}
      {(setupMode || (activeTab === 'system' && user?.is_admin)) && (
        <>

      {/* Dossier données EPEOR */}
      <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] p-8 no-print">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 bg-slate-100 text-[#0D83DE] rounded-2xl flex items-center justify-center shrink-0">
            <Database size={22} />
          </div>
          <div>
            <h3 className="text-lg font-black text-[#101828]">{t('settings.dataPath')}</h3>
            <p className="text-sm text-[#667085] mt-1 font-medium">
              {t('settings.dataPathDesc', "Chemin du répertoire contenant les fichiers EPEOR (ABONNE.DBF, FACTURES.DBF, etc.). Le changement déclenche un rechargement complet.")}
            </p>
          </div>
        </div>

        {dataDirLoading ? (
          <p className="text-xs font-bold text-[#98A2B3]">{t('settings.dataPathLoading', 'Lecture de la configuration...')}</p>
        ) : (
          <div className="space-y-4">
            {dataDirInfo?.locked_by_env && (
              <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs font-bold">
                {t('settings.dataPathLocked', "Chemin verrouillé par la variable d'environnement")} <span className="font-mono">EPEOR_DATA_DIR</span>.
                {' '}{t('settings.dataPathLockedHint', 'Modifiez-la dans start.bat ou les paramètres Windows, puis redémarrez le backend.')}
              </div>
            )}
            <div>
              <label className="block text-[10px] font-bold text-[#98A2B3] uppercase tracking-wider mb-2">
                {t('settings.dataPathLabel')}
              </label>
              <input
                type="text"
                value={dataDir}
                onChange={(e) => setDataDir(e.target.value)}
                disabled={dataDirInfo?.locked_by_env || savingDataDir}
                placeholder={t('settings.dataPathPlaceholder')}
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
                  {dataDirInfo.data_dir_exists ? t('settings.folderAccessible', 'Dossier accessible') : t('settings.folderNotFound', 'Dossier introuvable')}
                </span>
                {typeof dataDirInfo.dbf_count === 'number' && (
                  <span className="inline-flex items-center px-2.5 py-1 bg-slate-50 text-slate-600 border border-slate-200 rounded-full">
                    {dataDirInfo.dbf_count} {t('settings.dbfFiles', 'fichier(s) DBF')}
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
                {savingDataDir ? t('common.loading') : t('settings.applyReload', 'Appliquer et recharger')}
              </button>
              <button
                type="button"
                onClick={fetchDataDir}
                disabled={dataDirLoading || savingDataDir}
                className="px-6 py-3 rounded-2xl font-black text-xs border border-[#D0D5DD] text-[#344054] hover:bg-[#F9FAFB] transition-all"
              >
                {t('common.retry')}
              </button>
            </div>
          </div>
        )}
      </div>

      {!setupMode && (loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-[#E4E7EC] rounded-[2rem] shadow-sm">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-[#0D83DE] rounded-full animate-spin"></div>
          <p className="mt-4 text-sm font-bold text-[#475467]">{t('settings.loadingOrg', 'Chargement de la structure organisationnelle...')}</p>
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-6 rounded-[2rem] shadow-sm">
          <p className="font-bold">{t('common.error')}</p>
          <p className="text-sm mt-1">{error}</p>
          <button
            onClick={fetchSettings}
            className="mt-4 px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            {t('common.retry')}
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
                        <h3 className="text-xl font-black text-[#101828] uppercase">{t('settings.unitTitle', 'Unité')} {u.denom}</h3>
                        <p className="text-xs text-blue-600 font-bold">{t('settings.unitSubtitle', 'Unité de Gestion Principale')}</p>
                      </div>
                    </div>

                    <div className="border-t border-[#F2F4F7] pt-6 space-y-4">
                      <div>
                        <span className="block text-[10px] font-bold text-[#98A2B3] uppercase tracking-wider">{t('settings.unitAddress', 'Adresse')}</span>
                        <span className="text-sm font-bold text-[#344054]">{u.adresse || '—'}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-[#98A2B3] uppercase tracking-wider">{t('settings.unitPhone', 'Téléphone')}</span>
                        <span className="text-sm font-bold text-[#344054]">{u.telephone || '—'}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-[#98A2B3] uppercase tracking-wider">{t('settings.unitNif', 'Identifiant Fiscal (NIF)')}</span>
                        <span className="text-sm font-mono font-bold text-[#344054]">{u.identfisc || '—'}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-[#98A2B3] uppercase tracking-wider">{t('settings.unitArticle', "Article d'Imposition")}</span>
                        <span className="text-sm font-mono font-bold text-[#344054]">{u.nartfisc || '—'}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-[#98A2B3] uppercase tracking-wider">{t('settings.unitBank', 'Banque')}</span>
                        <span className="text-sm font-bold text-[#344054]">{u.ncompte || '—'}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-[#98A2B3] uppercase tracking-wider">{t('settings.unitRib', 'RIB / Compte Bancaire')}</span>
                        <span className="text-sm font-mono font-bold text-slate-700 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 block mt-1 overflow-x-auto select-all">
                          {u.dombanq || '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 pt-6 border-t border-[#F2F4F7]">
                    <div className="flex items-center gap-2.5 text-xs font-bold text-[#667085]">
                      <span>{t('settings.unitStatus', 'Statut :')}</span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                        {t('settings.unitOperational', 'Opérationnel')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sectors/Centers Card */}
                <div className="lg:col-span-2 bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] p-8 flex flex-col">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div>
                      <h3 className="text-lg font-black text-[#101828]">{t('settings.sectorsTitle', 'Centres & Secteurs Associés')}</h3>
                      <p className="text-xs text-[#667085] font-medium mt-0.5">{t('settings.sectorsSub', 'Secteurs géographiques rattachés à l\'unité de')} {u.denom} ({u.sectors.length} {t('settings.centersLoaded', 'centres chargés')})</p>
                    </div>
                    
                    {/* Search sector */}
                    <div className="relative">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#98A2B3]" size={16} />
                      <input
                        type="text"
                        placeholder={t('settings.searchCenter', 'Rechercher un centre...')}
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
                           <th className="px-6 py-4">{t('settings.colCenterCode', 'Code Centre')}</th>
                          <th className="px-6 py-4">{t('settings.colCenterName', 'Nom du Centre (Secteur)')}</th>
                          <th className="px-6 py-4">{t('settings.colUnitCode', 'Code Unité')}</th>
                          <th className="px-6 py-4 text-right">{t('settings.colLink', 'Rattachement')}</th>
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
                                  {t('settings.linkedTo', 'Lié à')} {u.denom}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="px-6 py-12 text-center text-sm font-bold text-[#98A2B3]">
                              {t('settings.noSearchResults', 'Aucun centre ne correspond à votre recherche.')}
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
                <h3 className="text-lg font-black text-[#101828]">{t('settings.cacheTitle', 'Gestion du Cache de Données')}</h3>
                <p className="text-sm text-[#667085] mt-1 font-medium">{t('settings.cacheDesc', 'Forcez la ré-analyse et la mise en cache des tables DBF brutes. Utilisez cette fonction si les fichiers de données sur le disque ont été modifiés.')}</p>
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
                {t('settings.reindexBtn', 'Réindexer & Recharger les DBF')}
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

        </>
      )}
    </div>
  );
}


// ─── User Management Panel ────────────────────────────────────────────────────

function UsersManagementPanel({
  usersList,
  usersLoading,
  usersError,
  sectors,
  onRefresh,
  currentUsername,
}: {
  usersList: any[];
  usersLoading: boolean;
  usersError: string | null;
  sectors: { code: string; libelle: string }[];
  onRefresh: () => void;
  currentUsername: string;
}) {
  const { t } = useTranslation();
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    display_name: '',
    password: '',
    password_confirm: '',
    allowed_sectors: [] as string[],
  });
  const [formMessage, setFormMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const getPasswordStrength = (password: string) => {
    if (!password) {
      return { percent: 0, label: t('settings.pwdNone', 'Aucun mot de passe'), color: 'bg-slate-300', textColor: 'text-slate-500', icon: '•' };
    }

    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    const percent = Math.min(100, Math.round((score / 5) * 100));
    if (score <= 2) {
      return { percent, label: t('settings.pwdWeak', 'Faible'), color: 'bg-gradient-to-r from-red-500 to-rose-500', textColor: 'text-red-600', icon: '✕' };
    }
    if (score === 3) {
      return { percent, label: t('settings.pwdMedium', 'Moyen'), color: 'bg-gradient-to-r from-amber-500 to-orange-500', textColor: 'text-amber-600', icon: '!' };
    }
    if (score === 4) {
      return { percent, label: t('settings.pwdGood', 'Bon'), color: 'bg-gradient-to-r from-blue-500 to-cyan-500', textColor: 'text-blue-600', icon: '✓' };
    }
    return { percent, label: t('settings.pwdStrong', 'Très fort'), color: 'bg-gradient-to-r from-emerald-500 to-green-500', textColor: 'text-emerald-600', icon: '✓' };
  };

  const passwordStrength = getPasswordStrength(formData.password);

  const isPasswordValid = (password: string) => {
    if (!password) return false;
    return password.length >= 8 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password);
  };

  const resetForm = () => {
    setFormData({ username: '', display_name: '', password: '', password_confirm: '', allowed_sectors: [] });
    setFormMessage(null);
    setEditingUser(null);
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (u: any) => {
    setFormData({
      username: u.username,
      display_name: u.display_name || '',
      password: '',
      password_confirm: '',
      allowed_sectors: u.allowed_sectors || [],
    });
    setEditingUser(u);
    setFormMessage(null);
    setShowForm(true);
  };

  const toggleSector = (code: string) => {
    setFormData(prev => {
      const set = new Set(prev.allowed_sectors);
      if (set.has(code)) set.delete(code); else set.add(code);
      return { ...prev, allowed_sectors: Array.from(set) };
    });
  };

  const normalizedUsername = formData.username.trim().toLowerCase();
  const isUsernameValid = /^[a-z0-9_]{3,32}$/.test(normalizedUsername);
  const passwordValid = formData.password.length >= 8 && /[a-z]/.test(formData.password) && /[A-Z]/.test(formData.password) && /\d/.test(formData.password);
  const passwordMatch = formData.password === formData.password_confirm;
  const isCreateMode = !editingUser;
  const isFormValid = isUsernameValid
    && formData.display_name.trim().length > 0
    && (!formData.password || passwordValid)
    && (isCreateMode ? passwordMatch : true);

  const generatePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()";
    let password = "";
    for (let i = 0; i < 12; i += 1) {
      password += chars[Math.floor(Math.random() * chars.length)];
    }
    setFormData(prev => ({ ...prev, password, password_confirm: password }));
    setShowPassword(true);
    setShowPasswordConfirm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormMessage(null);
    try {
      if (!editingUser) {
        if (formData.password !== formData.password_confirm) {
          setFormMessage({ type: 'err', text: 'Les mots de passe ne correspondent pas.' });
          return;
        }
        if (!isPasswordValid(formData.password)) {
          setFormMessage({ type: 'err', text: 'Le mot de passe doit faire au moins 8 caractères, avec une minuscule, une majuscule et un chiffre.' });
          return;
        }
      }

      if (editingUser) {
        const body: any = {
          username: formData.username.trim().toLowerCase(),
          display_name: formData.display_name,
        };
        if (formData.password.trim()) body.password = formData.password;
        if (!editingUser.is_admin) {
          body.allowed_sectors = formData.allowed_sectors;
        }
        const res = await fetch(apiUrl(`/api/admin/users/${editingUser.id}`), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
          setFormMessage({ type: 'err', text: data.detail || t('settings.errUpdate', 'Erreur lors de la modification.') });
          return;
        }
        setFormMessage({ type: 'ok', text: t('settings.userUpdated', 'Utilisateur mis à jour.') });
        setTimeout(() => { setShowForm(false); resetForm(); onRefresh(); }, 1000);
      } else {
        const body: any = {
          username: formData.username.trim().toLowerCase(),
          display_name: formData.display_name,
          password: formData.password,
        };
        if (formData.allowed_sectors.length > 0) {
          body.allowed_sectors = formData.allowed_sectors;
        }
        const res = await fetch(apiUrl('/api/admin/users'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
          setFormMessage({ type: 'err', text: data.detail || t('settings.errCreate', 'Erreur lors de la création.') });
          return;
        }
        setFormMessage({ type: 'ok', text: t('settings.userCreated', 'Utilisateur créé avec succès.') });
        setTimeout(() => { setShowForm(false); resetForm(); onRefresh(); }, 1000);
      }
    } catch {
      setFormMessage({ type: 'err', text: t('settings.errConnection', 'Erreur de connexion au serveur.') });
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (userId: number, username: string) => {
    const result = await showConfirm(t('settings.confirmDelete', 'Supprimer l\'utilisateur') + ` "${username}" ? ` + t('settings.irréversible', 'Cette action est irréversible.'), { title: "Supprimer l'utilisateur", icon: "warning" });
    if (!result.isConfirmed) return;
    setDeletingId(userId);
    try {
      const res = await fetch(apiUrl(`/api/admin/users/${userId}`), {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json();
        void showAlert(data.detail || t('settings.errDelete', 'Erreur lors de la suppression.'), { icon: "error" });
        return;
      }
      onRefresh();
    } catch {
      void showAlert(t('settings.errConnection', 'Erreur de connexion au serveur.'), { icon: "error" });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* User List */}
      <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-black text-[#101828]">{t('settings.usersTitle', 'Gestion des utilisateurs')}</h3>
            <p className="text-sm text-[#667085] mt-1">{t('settings.usersSubtitle', 'Créez des utilisateurs avec accès limité à un ou plusieurs secteurs.')}</p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-2 px-5 py-3 bg-[#0D83DE] text-white rounded-2xl text-sm font-black hover:bg-[#0b72c2] transition-all shadow-md shadow-blue-100 shrink-0"
          >
            <Plus size={16} /> {t('settings.newUser', 'Nouvel utilisateur')}
          </button>
        </div>

        {usersLoading ? (
          <div className="flex items-center justify-center p-8">
            <div className="w-8 h-8 border-4 border-blue-100 border-t-[#0D83DE] rounded-full animate-spin" />
          </div>
        ) : usersError ? (
          <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-700 text-sm font-bold">
            <AlertTriangle size={18} /> {usersError}
          </div>
        ) : usersList.length === 0 ? (
          <p className="text-sm text-[#98A2B3] text-center py-8 font-medium">{t('settings.noUsers', 'Aucun utilisateur trouvé.')}</p>
        ) : (
          <div className="space-y-3">
            {usersList.map((u: any) => (
              <div
                key={u.id}
                className="flex items-center gap-3 p-4 rounded-2xl border border-[#E4E7EC] hover:bg-[#F9FAFB] transition-colors"
              >
                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-black text-slate-600 shrink-0">
                  {u.username?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-black text-[#101828]">{u.display_name || u.username}</p>
                    {u.is_admin ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-100 rounded-full px-2 py-0.5">
                        <Shield size={10} /> Admin
                      </span>
                    ) : u.allowed_sectors && u.allowed_sectors.length > 0 ? (
                      <span className="text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-100 rounded-full px-2 py-0.5">
                       Secteurs : {u.allowed_sectors.join(', ')}
                      </span>
                    ) : (
                      <span className="text-[10px] font-black bg-slate-50 text-slate-500 border border-slate-100 rounded-full px-2 py-0.5">
                       {t('settings.fullAccess', 'Accès complet')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#667085] font-medium">@{u.username}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEdit(u)}
                    className="p-2 rounded-xl text-[#667085] hover:bg-[#EFF8FF] hover:text-[#0D83DE] transition-colors"
                    title={t('common.edit')}
                  >
                    <Edit2 size={16} />
                  </button>
                  {u.username !== currentUsername && !u.is_admin && (
                    <button
                      type="button"
                      onClick={() => handleDelete(u.id, u.username)}
                      disabled={deletingId === u.id}
                      className="p-2 rounded-xl text-[#667085] hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
                      title={t('common.delete')}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Form Modal */}
      {showForm && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={() => { setShowForm(false); resetForm(); }}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
            <div className="w-full max-w-xl max-h-[92vh] overflow-hidden rounded-[1.75rem] bg-white shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200 flex flex-col">
              <div className="flex items-start justify-between gap-3 border-b border-[#F2F4F7] bg-white/95 px-5 py-4 sm:px-6 sm:py-5">
                <div>
                  <h3 className="text-lg font-black text-[#101828]">
                    {editingUser ? `${t('settings.editUser')} — ${editingUser.username}` : t('settings.createUser', 'Créer un utilisateur')}
                  </h3>
                  <p className="text-xs text-[#667085] mt-0.5 font-medium">
                    {editingUser ? t('settings.editHint', 'Laissez le mot de passe vide pour ne pas le modifier.') : t('settings.createHint', 'Remplissez tous les champs requis.')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); resetForm(); }}
                  className="p-2 rounded-xl text-[#667085] hover:bg-[#F2F4F7] transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 sm:p-6 sm:space-y-4">
                <label className="block">
                  <span className="text-xs font-black text-[#344054] uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                    <User size={12} /> {t('settings.username')}
                  </span>
                  <input
                    type="text"
                    required
                    value={formData.username}
                    onChange={e => setFormData(p => ({ ...p, username: e.target.value }))}
                    className={`w-full border rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0D83DE]/30 focus:border-[#0D83DE] transition ${formData.username && !isUsernameValid ? 'border-red-300 focus:border-red-400' : 'border-[#D0D5DD]'}`}
                    placeholder="ex: agent01"
                    autoComplete="username"
                    aria-invalid={formData.username !== '' && !isUsernameValid}
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    {t('settings.usernameHint', '3–32 caractères, lettres minuscules, chiffres et underscore.')}
                  </p>
                  {formData.username && !isUsernameValid && (
                    <p className="mt-1 text-[11px] font-semibold text-red-600">{t('settings.usernameInvalid', "Nom d'utilisateur invalide.")}</p>
                  )}
                </label>

                <label className="block">
                  <span className="text-xs font-black text-[#344054] uppercase tracking-widest mb-1.5 block">{t('settings.displayName')}</span>
                  <input
                    type="text"
                    required
                    value={formData.display_name}
                    onChange={e => setFormData(p => ({ ...p, display_name: e.target.value }))}
                    className="w-full border border-[#D0D5DD] rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0D83DE]/30 focus:border-[#0D83DE] transition"
                    placeholder="ex: Agent Secteur 01"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-black text-[#344054] uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                    <Lock size={12} /> {t('settings.password')} {editingUser ? `(${t('settings.optional', 'optionnel')})` : ''}
                  </span>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required={!editingUser}
                      value={formData.password}
                      onChange={e => setFormData(p => ({ ...p, password: e.target.value }))}
                      className={`w-full border rounded-2xl px-4 py-3 pr-11 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0D83DE]/30 focus:border-[#0D83DE] transition ${formData.password && !passwordValid ? 'border-red-300 focus:border-red-400' : 'border-[#D0D5DD]'}`}
                      placeholder={editingUser ? t('settings.pwdPlaceholderEdit', 'Laisser vide = inchangé') : t('settings.pwdPlaceholderNew', '8 caractères minimum')}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(x => !x)}
                      className="absolute inset-y-0 right-3 flex items-center text-slate-500"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <div className="mt-2 flex flex-col gap-1 text-[11px]">
                    <div className="flex items-center justify-between gap-3 text-slate-500">
                      <span>{isCreateMode ? t('settings.pwdSecurity', 'Sécurité') : t('settings.newPwd', 'Nouveau mot de passe')}</span>
                      <button
                        type="button"
                        onClick={generatePassword}
                        className="text-[#0D83DE] font-black text-[11px] hover:text-[#0b72c2] transition"
                      >
                        {t('settings.generate', 'Générer')}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <span className={`rounded-full px-2 py-1 ${formData.password.length >= 8 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{t('settings.pwdChars', '8 caractères')}</span>
                      <span className={`rounded-full px-2 py-1 ${/[a-z]/.test(formData.password) ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{t('settings.pwdLower', 'minuscule')}</span>
                      <span className={`rounded-full px-2 py-1 ${/[A-Z]/.test(formData.password) ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{t('settings.pwdUpper', 'majuscule')}</span>
                      <span className={`rounded-full px-2 py-1 ${/\d/.test(formData.password) ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{t('settings.pwdDigit', 'chiffre')}</span>
                    </div>
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span>{t('settings.pwdStrength', 'Force du mot de passe')}</span>
                          <span className={`font-black ${passwordStrength.textColor}`}>{passwordStrength.label}</span>
                        </div>
                        <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className={`${passwordStrength.color} h-full`} style={{ width: `${passwordStrength.percent}%` }} />
                        </div>
                      </div>
                    </div>
                  </label>

                {!editingUser && (
                  <label className="block">
                    <span className="text-xs font-black text-[#344054] uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                      <Lock size={12} /> {t('settings.confirmPwd', 'Confirmer le mot de passe')}
                    </span>
                    <div className="relative">
                      <input
                        type={showPasswordConfirm ? 'text' : 'password'}
                        required
                        value={formData.password_confirm}
                        onChange={e => setFormData(p => ({ ...p, password_confirm: e.target.value }))}
                        className={`w-full border rounded-2xl px-4 py-3 pr-11 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0D83DE]/30 focus:border-[#0D83DE] transition ${formData.password_confirm && !passwordMatch ? 'border-red-300 focus:border-red-400' : 'border-[#D0D5DD]'}`}
                        placeholder={t('settings.confirmPwdPlaceholder', 'Retapez le mot de passe')}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswordConfirm(x => !x)}
                        className="absolute inset-y-0 right-3 flex items-center text-slate-500"
                        tabIndex={-1}
                      >
                        {showPasswordConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {formData.password_confirm && !passwordMatch && (
                      <p className="mt-2 text-[11px] text-red-600">{t('settings.pwdMismatch', 'Les mots de passe ne correspondent pas.')}</p>
                    )}
                  </label>
                )}

                {editingUser?.is_admin && (
                  <div className="flex items-center gap-2 p-3 rounded-2xl bg-amber-50 border border-amber-100 text-amber-800 text-sm font-bold">
                    <Shield size={16} className="text-amber-500 shrink-0" />
                    {t('settings.adminNote', "Compte administrateur unique — accès complet à l'application.")}
                  </div>
                )}

                {!editingUser?.is_admin && (
                  <div>
                    <p className="text-xs font-black text-[#344054] uppercase tracking-widest mb-3">
                      {t('settings.allowedSectors')} {formData.allowed_sectors.length > 0 ? `(${formData.allowed_sectors.length} ${t('settings.selected', 'sélectionnés')})` : `— ${t('settings.allIfNone', 'tous si aucun coché')}`}
                    </p>
                    {sectors.length === 0 ? (
                      <p className="text-xs text-[#98A2B3] italic">{t('settings.sectorsNotLoaded', 'Données pas encore chargées — secteurs indisponibles.')}</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                        {sectors.map(s => {
                          const checked = formData.allowed_sectors.includes(s.code);
                          return (
                            <label
                              key={s.code}
                              className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${checked ? 'bg-blue-50 border-[#0D83DE] text-[#0D83DE]' : 'border-[#E4E7EC] text-[#344054] hover:bg-[#F9FAFB]'}`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleSector(s.code)}
                                className="accent-[#0D83DE] w-4 h-4"
                              />
                              <div className="min-w-0">
                                <p className="text-xs font-black truncate">{s.libelle || s.code}</p>
                                <p className="text-[10px] text-[#98A2B3]">Code {s.code}</p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {formMessage && (
                  <div className={`p-3 rounded-2xl text-sm font-bold animate-in fade-in duration-200 ${formMessage.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                    {formMessage.text}
                  </div>
                )}

                <div className="flex gap-3 border-t border-[#F2F4F7] pt-4">
                  <button
                    type="button"
                    onClick={() => { setShowForm(false); resetForm(); }}
                    className="flex-1 py-3 rounded-2xl border border-[#D0D5DD] text-sm font-black text-[#344054] hover:bg-[#F9FAFB] transition"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={formLoading || !isFormValid}
                    className={`flex-1 py-3 rounded-2xl bg-[#0D83DE] text-white text-sm font-black hover:bg-[#0b72c2] transition disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 flex items-center justify-center gap-2 ${formLoading || !isFormValid ? 'opacity-80' : ''}`}
                  >
                    {formLoading ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                    ) : (
                      editingUser ? t('common.save') : t('settings.createUserBtn', "Créer l'utilisateur")
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}


// ─── User Profile Panel ────────────────────────────────────────────────────────

function UserProfilePanel({
  user,
  sectors,
}: {
  user: {
    username: string;
    display_name: string;
    is_admin: boolean;
    allowed_sectors?: string[] | null;
  };
  sectors: { code: string; libelle: string }[];
}) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    username: user.username,
    display_name: user.display_name,
    new_password: '',
    new_password_confirm: '',
    current_password: '',
  });

  const [formMessage, setFormMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

  const getPasswordStrength = (password: string) => {
    if (!password) {
      return { percent: 0, label: t('settings.pwdNone', 'Aucun mot de passe'), color: 'bg-slate-300', textColor: 'text-slate-500', icon: '•' };
    }
    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    const percent = Math.min(100, Math.round((score / 5) * 100));
    if (score <= 2) {
      return { percent, label: t('settings.pwdWeak', 'Faible'), color: 'bg-gradient-to-r from-red-500 to-rose-500', textColor: 'text-red-600', icon: '✕' };
    }
    if (score === 3) {
      return { percent, label: t('settings.pwdMedium', 'Moyen'), color: 'bg-gradient-to-r from-amber-500 to-orange-500', textColor: 'text-amber-600', icon: '!' };
    }
    if (score === 4) {
      return { percent, label: t('settings.pwdGood', 'Bon'), color: 'bg-gradient-to-r from-blue-500 to-cyan-500', textColor: 'text-blue-600', icon: '✓' };
    }
    return { percent, label: t('settings.pwdStrong', 'Très fort'), color: 'bg-gradient-to-r from-emerald-500 to-green-500', textColor: 'text-emerald-600', icon: '✓' };
  };

  const passwordStrength = getPasswordStrength(formData.new_password);

  const isPasswordValid = (password: string) => {
    if (!password) return false;
    return password.length >= 8 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password);
  };

  const normalizedUsername = formData.username.trim().toLowerCase();
  const isUsernameValid = /^[a-z0-9_]{3,32}$/.test(normalizedUsername);
  const passwordValid = !formData.new_password || isPasswordValid(formData.new_password);
  const passwordMatch = formData.new_password === formData.new_password_confirm;
  const isFormValid = isUsernameValid
    && formData.display_name.trim().length > 0
    && formData.current_password.length > 0
    && passwordValid
    && passwordMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;
    setFormLoading(true);
    setFormMessage(null);

    try {
      const body: any = {
        current_password: formData.current_password,
      };

      if (formData.username.trim().toLowerCase() !== user.username.trim().toLowerCase()) {
        body.new_username = formData.username.trim().toLowerCase();
      }
      if (formData.display_name.trim() !== user.display_name.trim()) {
        body.new_display_name = formData.display_name.trim();
      }
      if (formData.new_password.trim()) {
        body.new_password = formData.new_password;
      }

      if (Object.keys(body).length <= 1) {
        setFormMessage({ type: 'err', text: 'Aucune modification détectée.' });
        setFormLoading(false);
        return;
      }

      const res = await fetch(apiUrl('/api/auth/change'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormMessage({ type: 'err', text: data.detail || 'Erreur lors de la mise à jour.' });
        return;
      }

      setFormMessage({ type: 'ok', text: 'Profil mis à jour avec succès ! Rechargement de la session...' });
      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch {
      setFormMessage({ type: 'err', text: 'Erreur de communication avec le serveur.' });
    } finally {
      setFormLoading(false);
    }
  };

  const assignedSectors = sectors.filter(s => (user.allowed_sectors || []).includes(s.code));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-300">
      {/* Profil Form Card */}
      <div className="lg:col-span-2 bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] p-8 page-card">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 bg-blue-50 text-[#0D83DE] rounded-2xl flex items-center justify-center font-black text-lg">
            <User size={22} />
          </div>
          <div>
            <h3 className="text-lg font-black text-[#101828]">{t('settings.myProfile', 'Mon Profil')}</h3>
            <p className="text-sm text-[#667085] mt-1">{t('settings.myProfileSubtitle', 'Modifiez vos informations d\'identification de compte.')}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
          <label className="block">
            <span className="text-xs font-black text-[#344054] uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
              <User size={12} /> Nom d'utilisateur
            </span>
            <input
              type="text"
              required
              value={formData.username}
              onChange={e => setFormData(p => ({ ...p, username: e.target.value }))}
              className={`w-full border rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0D83DE]/30 focus:border-[#0D83DE] transition ${formData.username && !isUsernameValid ? 'border-red-300 focus:border-red-400' : 'border-[#D0D5DD]'}`}
              autoComplete="username"
            />
            {formData.username && !isUsernameValid && (
              <p className="mt-1 text-[11px] font-semibold text-red-600">Nom d'utilisateur invalide (3-32 caractères, minuscules/chiffres/_).</p>
            )}
          </label>

          <label className="block">
            <span className="text-xs font-black text-[#344054] uppercase tracking-widest mb-1.5 block">Nom d'affichage</span>
            <input
              type="text"
              required
              value={formData.display_name}
              onChange={e => setFormData(p => ({ ...p, display_name: e.target.value }))}
              className="w-full border border-[#D0D5DD] rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0D83DE]/30 focus:border-[#0D83DE] transition"
            />
          </label>

          <div className="border-t border-slate-100 pt-4 mt-6">
            <p className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4">Modifier le mot de passe (laisser vide si inchangé)</p>
            
            <div className="space-y-4">
              <label className="block">
                <span className="text-xs font-black text-[#344054] uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                  <Lock size={12} /> Nouveau mot de passe
                </span>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.new_password}
                    onChange={e => setFormData(p => ({ ...p, new_password: e.target.value }))}
                    className={`w-full border rounded-2xl px-4 py-3 pr-11 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0D83DE]/30 focus:border-[#0D83DE] transition ${formData.new_password && !passwordValid ? 'border-red-300 focus:border-red-400' : 'border-[#D0D5DD]'}`}
                    placeholder="8 caractères minimum"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(x => !x)}
                    className="absolute inset-y-0 right-3 flex items-center text-slate-500"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {formData.new_password && (
                  <div className="mt-2 flex flex-col gap-1 text-[11px]">
                    <div className="grid grid-cols-2 gap-2">
                      <span className={`rounded-full px-2 py-1 ${formData.new_password.length >= 8 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>8 caractères</span>
                      <span className={`rounded-full px-2 py-1 ${/[a-z]/.test(formData.new_password) ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>minuscule</span>
                      <span className={`rounded-full px-2 py-1 ${/[A-Z]/.test(formData.new_password) ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>majuscule</span>
                      <span className={`rounded-full px-2 py-1 ${/\d/.test(formData.new_password) ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>chiffre</span>
                    </div>
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>Force</span>
                        <span className={`font-black ${passwordStrength.textColor}`}>{passwordStrength.label}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div className={`${passwordStrength.color} h-full`} style={{ width: `${passwordStrength.percent}%` }} />
                      </div>
                    </div>
                  </div>
                )}
              </label>

              {formData.new_password && (
                <label className="block">
                  <span className="text-xs font-black text-[#344054] uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                    <Lock size={12} /> Confirmer le nouveau mot de passe
                  </span>
                  <div className="relative">
                    <input
                      type={showPasswordConfirm ? 'text' : 'password'}
                      required
                      value={formData.new_password_confirm}
                      onChange={e => setFormData(p => ({ ...p, new_password_confirm: e.target.value }))}
                      className={`w-full border rounded-2xl px-4 py-3 pr-11 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0D83DE]/30 focus:border-[#0D83DE] transition ${formData.new_password_confirm && !passwordMatch ? 'border-red-300 focus:border-red-400' : 'border-[#D0D5DD]'}`}
                      placeholder="Confirmez le mot de passe"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordConfirm(x => !x)}
                      className="absolute inset-y-0 right-3 flex items-center text-slate-500"
                      tabIndex={-1}
                    >
                      {showPasswordConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {formData.new_password_confirm && !passwordMatch && (
                    <p className="mt-2 text-[11px] text-red-600">Les mots de passe ne correspondent pas.</p>
                  )}
                </label>
              )}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-6 mt-6 bg-slate-50/50 p-5 rounded-2xl border border-slate-100">
            <label className="block">
              <span className="text-xs font-black text-rose-900 dark:text-rose-400 uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                <Shield size={14} className="text-rose-500" /> Confirmation de Sécurité Recommandée
              </span>
              <p className="text-xs text-[#667085] mb-3 font-medium">Saisissez votre mot de passe actuel pour valider et appliquer les modifications.</p>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  required
                  value={formData.current_password}
                  onChange={e => setFormData(p => ({ ...p, current_password: e.target.value }))}
                  className="w-full border border-[#D0D5DD] bg-white rounded-2xl px-4 py-3 pr-11 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0D83DE]/30 focus:border-[#0D83DE] transition"
                  placeholder="Mot de passe actuel"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(x => !x)}
                  className="absolute inset-y-0 right-3 flex items-center text-slate-500"
                  tabIndex={-1}
                >
                  {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
          </div>

          {formMessage && (
            <div className={`p-4 rounded-2xl text-sm font-bold animate-in fade-in duration-200 ${formMessage.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
              {formMessage.text}
            </div>
          )}

          <div className="pt-4">
            <button
              type="submit"
              disabled={formLoading || !isFormValid}
              className={`w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-[#0D83DE] text-white text-sm font-black hover:bg-[#0b72c2] transition disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 flex items-center justify-center gap-2 ${formLoading || !isFormValid ? 'opacity-80' : ''}`}
            >
              {formLoading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
              ) : (
                'Enregistrer les modifications'
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Rôle et Affectations géographiques (Secteurs) Card */}
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] p-8 page-card">
          <h3 className="text-lg font-black text-[#101828] mb-4">Statut &amp; Rôle</h3>
          <div className="space-y-4">
            <div>
              <span className="block text-[10px] font-bold text-[#98A2B3] uppercase tracking-wider">Type de Compte</span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 mt-1.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-full text-xs font-black">
                <Shield size={12} /> {user.is_admin ? 'Administrateur' : 'Utilisateur Ordinaire'}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-[#98A2B3] uppercase tracking-wider">Accès API</span>
              <p className="text-xs text-[#667085] mt-1.5 font-medium leading-relaxed">
                {user.is_admin 
                  ? 'Accès complet en lecture et écriture à tous les paramètres système et de gestion d\'utilisateurs.'
                  : 'Accès restreint. Seules les modifications de profil personnelles et la lecture du tableau de bord sont autorisées.'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] p-8 page-card">
          <h3 className="text-lg font-black text-[#101828] mb-1">Affectations géographiques</h3>
          <p className="text-xs text-[#667085] font-medium mb-4">Secteurs associés à votre compte (visualisation seule).</p>
          
          <div className="border-t border-[#F2F4F7] pt-4">
            {user.is_admin ? (
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-100 text-amber-800 text-xs font-bold leading-relaxed">
                Accès administrateur complet. La restriction par secteurs géographiques ne s\'applique pas à ce compte.
              </div>
            ) : assignedSectors.length === 0 ? (
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-slate-500 text-xs font-bold leading-relaxed">
                Accès complet. Aucun secteur spécifique n\'est restreint sur votre compte.
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {assignedSectors.map(s => (
                  <div key={s.code} className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#0D83DE] border border-blue-100 flex items-center justify-center font-black text-xs">
                      {s.code
}                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black truncate text-slate-800">{s.libelle}</p>
                      <p className="text-[10px] text-slate-400 font-bold">Rattachement principal</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
