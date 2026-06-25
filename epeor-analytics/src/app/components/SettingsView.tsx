"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Database, RefreshCw, Search, Plus, Trash2, Edit2, Shield, User, Lock, X, AlertTriangle } from "lucide-react";
import { apiUrl } from "../lib/api";

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
  const [activeTab, setActiveTab] = useState<'system' | 'users'>('system');

  // User management states
  const [usersList, setUsersList] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);

  // User form states
  const [formUsername, setFormUsername] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formIsAdmin, setFormIsAdmin] = useState(false);
  const [formSectors, setFormSectors] = useState<string[]>([]);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [formMessage, setFormMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [formLoading, setFormLoading] = useState(false);

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
      setUsersError('Impossible de charger la liste des utilisateurs.');
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

  // --- Change username / password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingCreds, setChangingCreds] = useState(false);
  const [changeMessage, setChangeMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const handleChangeCredentials = async () => {
    setChangeMessage(null);
    if (!currentPassword) {
      setChangeMessage({ type: 'err', text: "Mot de passe actuel requis." });
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      setChangeMessage({ type: 'err', text: "Les nouveaux mots de passe ne correspondent pas." });
      return;
    }
    if (!newUsername && !newPassword) {
      setChangeMessage({ type: 'err', text: "Indiquez un nouveau nom d'utilisateur ou un nouveau mot de passe." });
      return;
    }

    setChangingCreds(true);
    try {
      const res = await fetch(apiUrl('/api/auth/change'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: currentPassword, new_username: newUsername || undefined, new_password: newPassword || undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setChangeMessage({ type: 'err', text: err.detail || 'Erreur lors de la modification des identifiants.' });
        return;
      }
      const data = await res.json();
      setChangeMessage({ type: 'ok', text: 'Identifiants mis à jour.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      if (newUsername) setNewUsername('');
      // If username changed, refresh page to reflect it
      setTimeout(() => window.location.reload(), 800);
    } catch (e) {
      setChangeMessage({ type: 'err', text: 'Impossible de contacter le serveur.' });
    } finally {
      setChangingCreds(false);
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
            <ChevronRight className="rotate-180" size={16} /> Retour au tableau de bord
          </button>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h2 className="page-title text-[#101828]">Paramètres du Système</h2>
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

      {/* Tab navigation — visible only in non-setup mode for admins */}
      {!setupMode && user?.is_admin && (
        <div className="flex gap-1 bg-[#F2F4F7] rounded-2xl p-1.5 no-print">
          <button
            type="button"
            onClick={() => setActiveTab('system')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-black transition-all ${activeTab === 'system' ? 'bg-white shadow-sm text-[#0D83DE]' : 'text-[#667085] hover:text-[#344054]'}`}
          >
            ⚙️ Système
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-black transition-all ${activeTab === 'users' ? 'bg-white shadow-sm text-[#0D83DE]' : 'text-[#667085] hover:text-[#344054]'}`}
          >
            👥 Utilisateurs
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

      {/* ======== System Tab (always visible in setup mode or when system tab active) ======== */}
      {(setupMode || activeTab === 'system' || !user?.is_admin) && (
        <>

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

      {/* Compte utilisateur — changement nom d'utilisateur / mot de passe */}
      {!setupMode && (
        <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] p-8 no-print">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 bg-slate-100 text-[#0D83DE] rounded-2xl flex items-center justify-center shrink-0">
              <Database size={22} />
            </div>
            <div>
              <h3 className="text-lg font-black text-[#101828]">Compte</h3>
              <p className="text-sm text-[#667085] mt-1 font-medium">Changez votre nom d'utilisateur ou mot de passe (confirmez avec le mot de passe actuel).</p>
            </div>
          </div>

          {changeMessage && (
            <div className={`p-3 rounded-xl mb-4 text-sm font-bold ${changeMessage.type === 'ok' ? 'bg-emerald-50 border border-emerald-100 text-emerald-800' : 'bg-rose-50 border border-rose-100 text-rose-800'}`}>
              {changeMessage.text}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-[#98A2B3] uppercase tracking-wider mb-2">Mot de passe actuel</label>
              <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="w-full rounded-xl border border-[#D0D5DD] px-4 py-3 bg-[#F9FAFB]" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[#98A2B3] uppercase tracking-wider mb-2">Nouveau nom d'utilisateur</label>
              <input type="text" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} className="w-full rounded-xl border border-[#D0D5DD] px-4 py-3 bg-[#F9FAFB]" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[#98A2B3] uppercase tracking-wider mb-2">Nouveau mot de passe</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full rounded-xl border border-[#D0D5DD] px-4 py-3 bg-[#F9FAFB]" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[#98A2B3] uppercase tracking-wider mb-2">Confirmer mot de passe</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full rounded-xl border border-[#D0D5DD] px-4 py-3 bg-[#F9FAFB]" />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={handleChangeCredentials} disabled={changingCreds} className={`px-5 py-3 rounded-2xl font-black text-xs ${changingCreds ? 'bg-slate-100 text-slate-400' : 'bg-[#0D83DE] text-white hover:bg-[#0b72c2]'}`}>
              {changingCreds ? 'Modification…' : 'Mettre à jour'}
            </button>
          </div>
        </div>
      )}

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
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    display_name: '',
    password: '',
    is_admin: false,
    allowed_sectors: [] as string[],
  });
  const [formMessage, setFormMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const resetForm = () => {
    setFormData({ username: '', display_name: '', password: '', is_admin: false, allowed_sectors: [] });
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
      is_admin: !!u.is_admin,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormMessage(null);
    try {
      if (editingUser) {
        // Update existing user
        const body: any = {
          display_name: formData.display_name,
          is_admin: formData.is_admin,
        };
        if (formData.password.trim()) body.password = formData.password;
        if (!formData.is_admin) {
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
          setFormMessage({ type: 'err', text: data.detail || 'Erreur lors de la modification.' });
          return;
        }
        setFormMessage({ type: 'ok', text: 'Utilisateur mis à jour.' });
        setTimeout(() => { setShowForm(false); resetForm(); onRefresh(); }, 1000);
      } else {
        // Create new user
        const body: any = {
          username: formData.username.trim().toLowerCase(),
          display_name: formData.display_name,
          password: formData.password,
          is_admin: formData.is_admin,
        };
        if (!formData.is_admin) {
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
          setFormMessage({ type: 'err', text: data.detail || 'Erreur lors de la création.' });
          return;
        }
        setFormMessage({ type: 'ok', text: 'Utilisateur créé avec succès.' });
        setTimeout(() => { setShowForm(false); resetForm(); onRefresh(); }, 1000);
      }
    } catch {
      setFormMessage({ type: 'err', text: 'Erreur de connexion au serveur.' });
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (userId: number, username: string) => {
    if (!confirm(`Supprimer l'utilisateur "${username}" ? Cette action est irréversible.`)) return;
    setDeletingId(userId);
    try {
      const res = await fetch(apiUrl(`/api/admin/users/${userId}`), {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.detail || 'Erreur lors de la suppression.');
        return;
      }
      onRefresh();
    } catch {
      alert('Erreur de connexion au serveur.');
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
            <h3 className="text-lg font-black text-[#101828]">Gestion des utilisateurs</h3>
            <p className="text-sm text-[#667085] mt-1">Créez des utilisateurs avec accès limité à un ou plusieurs secteurs.</p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-2 px-5 py-3 bg-[#0D83DE] text-white rounded-2xl text-sm font-black hover:bg-[#0b72c2] transition-all shadow-md shadow-blue-100 shrink-0"
          >
            <Plus size={16} /> Nouvel utilisateur
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
          <p className="text-sm text-[#98A2B3] text-center py-8 font-medium">Aucun utilisateur trouvé.</p>
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
                        Accès complet
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
                    title="Modifier"
                  >
                    <Edit2 size={16} />
                  </button>
                  {u.username !== currentUsername && (
                    <button
                      type="button"
                      onClick={() => handleDelete(u.id, u.username)}
                      disabled={deletingId === u.id}
                      className="p-2 rounded-xl text-[#667085] hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
                      title="Supprimer"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-200 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-[#F2F4F7]">
                <div>
                  <h3 className="text-lg font-black text-[#101828]">
                    {editingUser ? `Modifier — ${editingUser.username}` : 'Créer un utilisateur'}
                  </h3>
                  <p className="text-xs text-[#667085] mt-0.5 font-medium">
                    {editingUser ? 'Laissez le mot de passe vide pour ne pas le modifier.' : 'Remplissez tous les champs requis.'}
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

              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                {!editingUser && (
                  <label className="block">
                    <span className="text-xs font-black text-[#344054] uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                      <User size={12} /> Nom d'utilisateur
                    </span>
                    <input
                      type="text"
                      required
                      value={formData.username}
                      onChange={e => setFormData(p => ({ ...p, username: e.target.value }))}
                      className="w-full border border-[#D0D5DD] rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0D83DE]/30 focus:border-[#0D83DE] transition"
                      placeholder="ex: agent01"
                      autoComplete="username"
                    />
                  </label>
                )}

                <label className="block">
                  <span className="text-xs font-black text-[#344054] uppercase tracking-widest mb-1.5 block">Nom affiché</span>
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
                    <Lock size={12} /> Mot de passe {editingUser ? '(optionnel)' : ''}
                  </span>
                  <input
                    type="password"
                    required={!editingUser}
                    value={formData.password}
                    onChange={e => setFormData(p => ({ ...p, password: e.target.value }))}
                    className="w-full border border-[#D0D5DD] rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0D83DE]/30 focus:border-[#0D83DE] transition"
                    placeholder={editingUser ? 'Laisser vide = inchangé' : 'Min. 4 caractères'}
                    autoComplete="new-password"
                  />
                </label>

                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formData.is_admin}
                    onChange={e => setFormData(p => ({ ...p, is_admin: e.target.checked, allowed_sectors: e.target.checked ? [] : p.allowed_sectors }))}
                    className="w-5 h-5 rounded-lg accent-[#0D83DE]"
                  />
                  <span className="text-sm font-black text-[#344054] flex items-center gap-1.5">
                    <Shield size={14} className="text-amber-500" /> Administrateur (accès complet)
                  </span>
                </label>

                {!formData.is_admin && (
                  <div>
                    <p className="text-xs font-black text-[#344054] uppercase tracking-widest mb-3">
                      Secteurs autorisés {formData.allowed_sectors.length > 0 ? `(${formData.allowed_sectors.length} sélectionnés)` : '— tous si aucun coché'}
                    </p>
                    {sectors.length === 0 ? (
                      <p className="text-xs text-[#98A2B3] italic">Données pas encore chargées — secteurs indisponibles.</p>
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

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => { setShowForm(false); resetForm(); }}
                    className="flex-1 py-3 rounded-2xl border border-[#D0D5DD] text-sm font-black text-[#344054] hover:bg-[#F9FAFB] transition"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="flex-1 py-3 rounded-2xl bg-[#0D83DE] text-white text-sm font-black hover:bg-[#0b72c2] transition disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {formLoading ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                    ) : (
                      editingUser ? 'Enregistrer' : 'Créer l\'utilisateur'
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
