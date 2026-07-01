"use client";

import React, { useState, useEffect } from "react";
import { X, FileText, CheckCircle, Landmark, Check, Plus, Trash2 } from "lucide-react";
import { apiUrlObject } from "../lib/api";

interface Heritier {
  id: string;
  nom: string;
  adresse: string;
  codeAbonne?: string;
  telephone?: string;
  email?: string;
  numeroIdentite?: string;
  dateDelivrance?: string;
  lieuDelivrance?: string;
}

interface DossierJuridiquePanelProps {
  isOpen: boolean;
  onClose: () => void;
  abonne: any; // Abonne object passed from parent
}

export function DossierJuridiquePanel({ isOpen, onClose, abonne }: DossierJuridiquePanelProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [dossier, setDossier] = useState({
    statut_abonne: "Actif",
    etape_recouvrement: "Amiable",
    has_mise_en_demeure: false,
    has_echeancier: false,
    transmis_cours: false,
    nom_notaire: "",
    coordonnees_notaire: "",
    liste_heritiers: "",
    date_declaration_creance: "",
    heritiers: [] as Heritier[]
  });

  useEffect(() => {
    if (isOpen && abonne) {
      setLoading(true);
      fetch(apiUrlObject(`/api/abonne/${abonne.numab}/dossier`).toString())
        .then(res => res.json())
        .then(data => {
          setDossier({
            statut_abonne: data.statut_abonne || "Actif",
            etape_recouvrement: data.etape_recouvrement || "Amiable",
            has_mise_en_demeure: !!data.has_mise_en_demeure,
            has_echeancier: !!data.has_echeancier,
            transmis_cours: !!data.transmis_cours,
            nom_notaire: data.nom_notaire || "",
            coordonnees_notaire: data.coordonnees_notaire || "",
            liste_heritiers: data.liste_heritiers || "",
            date_declaration_creance: data.date_declaration_creance || "",
            heritiers: data.heritiers || []
          });
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, abonne]);

  if (!isOpen || !abonne) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(apiUrlObject(`/api/abonne/${abonne.numab}/dossier`).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dossier)
      });
      alert("Dossier mis à jour avec succès");
      onClose();
    } catch (e) {
      alert("Erreur lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  };

  const downloadPDF = (type: string) => {
    const url = apiUrlObject(`/api/abonne/${abonne.numab}/${type}`).toString();
    window.open(url, '_blank');
  };

  const addHeritier = () => {
    const newHeritier: Heritier = {
      id: Date.now().toString(),
      nom: "",
      adresse: "",
      codeAbonne: "",
      telephone: "",
      email: "",
      numeroIdentite: "",
      dateDelivrance: "",
      lieuDelivrance: ""
    };
    setDossier({
      ...dossier,
      heritiers: [...dossier.heritiers, newHeritier]
    });
  };

  const removeHeritier = (id: string) => {
    setDossier({
      ...dossier,
      heritiers: dossier.heritiers.filter(h => h.id !== id)
    });
  };

  const updateHeritier = (id: string, field: keyof Heritier, value: string) => {
    setDossier({
      ...dossier,
      heritiers: dossier.heritiers.map(h =>
        h.id === id ? { ...h, [field]: value } : h
      )
    });
  };

  const steps = ["Amiable", "Mise en demeure", "Succession Notaire", "Tribunal"];
  const currentStepIndex = steps.indexOf(dossier.etape_recouvrement);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20 backdrop-blur-sm transition-opacity">
      <div className="w-full max-w-xl h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/50">
          <div>
            <h2 className="text-lg font-black text-gray-900">Dossier de Recouvrement</h2>
            <p className="text-sm font-semibold text-gray-500 mt-1">Abonné {abonne.numab} — {abonne.name}</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-900 bg-white rounded-xl shadow-sm border border-gray-200 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {loading ? (
            <div className="flex items-center justify-center h-40"><div className="spinner-premium" /></div>
          ) : (
            <>
              {/* Stepper */}
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-gray-500 mb-4">Étape du recouvrement</h3>
                <div className="flex items-center justify-between relative">
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-gray-100 rounded-full" />
                  <div 
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-brand-500 rounded-full transition-all duration-500" 
                    style={{ width: `${(Math.max(0, currentStepIndex) / (steps.length - 1)) * 100}%` }}
                  />
                  {steps.map((step, idx) => {
                    const isCompleted = idx <= currentStepIndex;
                    return (
                      <div key={step} className="relative flex flex-col items-center gap-2 z-10 w-1/4 cursor-pointer" onClick={() => setDossier({ ...dossier, etape_recouvrement: step })}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[10px] border-2 transition-colors ${
                          isCompleted ? "bg-brand-500 border-brand-500 text-white" : "bg-white border-gray-200 text-gray-400"
                        }`}>
                          {isCompleted ? <Check size={14} /> : idx + 1}
                        </div>
                        <span className={`text-[10px] font-bold text-center mt-1 ${isCompleted ? "text-brand-700" : "text-gray-400"}`}>{step}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Status and Checks */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-2">Statut de l'abonné</label>
                  <select 
                    value={dossier.statut_abonne} 
                    onChange={e => setDossier({...dossier, statut_abonne: e.target.value})}
                    className="w-full text-sm font-bold px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-brand-500 transition-colors"
                  >
                    <option value="Actif">Actif</option>
                    <option value="Suspendu">Suspendu</option>
                    <option value="Décédé">Décédé</option>
                    <option value="Héritier">Héritier</option>
                  </select>
                </div>
                
                <div className="flex flex-col justify-end space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${dossier.has_mise_en_demeure ? "bg-amber-500 border-amber-500 text-white" : "bg-white border-gray-300 text-transparent group-hover:border-amber-400"}`}>
                      <Check size={14} strokeWidth={3} />
                    </div>
                    <span className="text-sm font-bold text-gray-700">Mise en demeure envoyée</span>
                    <input type="checkbox" className="hidden" checked={dossier.has_mise_en_demeure} onChange={e => setDossier({...dossier, has_mise_en_demeure: e.target.checked})} />
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${dossier.has_echeancier ? "bg-emerald-500 border-emerald-500 text-white" : "bg-white border-gray-300 text-transparent group-hover:border-emerald-400"}`}>
                      <Check size={14} strokeWidth={3} />
                    </div>
                    <span className="text-sm font-bold text-gray-700">Échéancier accordé</span>
                    <input type="checkbox" className="hidden" checked={dossier.has_echeancier} onChange={e => setDossier({...dossier, has_echeancier: e.target.checked})} />
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${dossier.transmis_cours ? "bg-rose-500 border-rose-500 text-white" : "bg-white border-gray-300 text-transparent group-hover:border-rose-400"}`}>
                      <Check size={14} strokeWidth={3} />
                    </div>
                    <span className="text-sm font-bold text-gray-700">Transmis à la cour</span>
                    <input type="checkbox" className="hidden" checked={dossier.transmis_cours} onChange={e => setDossier({...dossier, transmis_cours: e.target.checked})} />
                  </label>
                </div>
              </div>

              {/* Succession Specific Fields */}
              {dossier.statut_abonne === "Décédé" && (
                <div className="p-5 rounded-2xl bg-indigo-50 border border-indigo-100 space-y-4 animate-in fade-in zoom-in-95">
                  <div className="flex items-center gap-2 text-indigo-700 mb-2">
                    <Landmark size={18} />
                    <h3 className="text-sm font-black">Informations de Succession</h3>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-indigo-900/60 mb-1">Nom du Notaire</label>
                      <input 
                        type="text" 
                        value={dossier.nom_notaire} 
                        onChange={e => setDossier({...dossier, nom_notaire: e.target.value})}
                        className="w-full text-sm font-bold px-3 py-2 rounded-xl border border-indigo-200 bg-white focus:ring-2 focus:ring-indigo-500"
                        placeholder="Ex: Maître Dupont"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-indigo-900/60 mb-1">Date déclaration de créance</label>
                      <input 
                        type="date" 
                        value={dossier.date_declaration_creance} 
                        onChange={e => setDossier({...dossier, date_declaration_creance: e.target.value})}
                        className="w-full text-sm font-bold px-3 py-2 rounded-xl border border-indigo-200 bg-white focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-indigo-900/60 mb-1">Coordonnées du notaire</label>
                    <input 
                      type="text" 
                      value={dossier.coordonnees_notaire} 
                      onChange={e => setDossier({...dossier, coordonnees_notaire: e.target.value})}
                      className="w-full text-sm font-bold px-3 py-2 rounded-xl border border-indigo-200 bg-white focus:ring-2 focus:ring-indigo-500"
                      placeholder="Téléphone, adresse email..."
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-indigo-900/60 mb-1">Liste des héritiers connus</label>
                    <textarea 
                      value={dossier.liste_heritiers} 
                      onChange={e => setDossier({...dossier, liste_heritiers: e.target.value})}
                      className="w-full text-sm font-bold px-3 py-2 rounded-xl border border-indigo-200 bg-white focus:ring-2 focus:ring-indigo-500 min-h-[80px]"
                      placeholder="Noms et prénoms des héritiers..."
                    />
                  </div>
                </div>
              )}

              {/* Heritier Specific Fields */}
              {dossier.statut_abonne === "Héritier" && (
                <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-100 space-y-4 animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-black text-emerald-900">Liste des Héritiers</h3>
                    <button
                      onClick={addHeritier}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors"
                    >
                      <Plus size={14} /> Ajouter un héritier
                    </button>
                  </div>

                  {dossier.heritiers.length === 0 ? (
                    <p className="text-xs text-emerald-600 italic">Aucun héritier ajouté pour le moment</p>
                  ) : (
                    <div className="space-y-4">
                      {dossier.heritiers.map((heritier, idx) => (
                        <div key={heritier.id} className="p-4 bg-white rounded-xl border border-emerald-200 space-y-3">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-black text-emerald-700">Héritier {idx + 1}</span>
                            <button
                              onClick={() => removeHeritier(heritier.id)}
                              className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-bold text-emerald-900/60 mb-1">Nom complet *</label>
                              <input
                                type="text"
                                value={heritier.nom}
                                onChange={e => updateHeritier(heritier.id, "nom", e.target.value)}
                                className="w-full text-sm font-bold px-3 py-2 rounded-lg border border-emerald-200 bg-white focus:ring-2 focus:ring-emerald-500"
                                placeholder="Nom et prénom"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-emerald-900/60 mb-1">Code abonné</label>
                              <input
                                type="text"
                                value={heritier.codeAbonne || ""}
                                onChange={e => updateHeritier(heritier.id, "codeAbonne", e.target.value)}
                                className="w-full text-sm font-bold px-3 py-2 rounded-lg border border-emerald-200 bg-white focus:ring-2 focus:ring-emerald-500"
                                placeholder="Code abonné (optionnel)"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-emerald-900/60 mb-1">Adresse *</label>
                            <input
                              type="text"
                              value={heritier.adresse}
                              onChange={e => updateHeritier(heritier.id, "adresse", e.target.value)}
                              className="w-full text-sm font-bold px-3 py-2 rounded-lg border border-emerald-200 bg-white focus:ring-2 focus:ring-emerald-500"
                              placeholder="Adresse complète"
                              required
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-bold text-emerald-900/60 mb-1">Téléphone</label>
                              <input
                                type="tel"
                                value={heritier.telephone || ""}
                                onChange={e => updateHeritier(heritier.id, "telephone", e.target.value)}
                                className="w-full text-sm font-bold px-3 py-2 rounded-lg border border-emerald-200 bg-white focus:ring-2 focus:ring-emerald-500"
                                placeholder="Numéro de téléphone (optionnel)"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-emerald-900/60 mb-1">Email</label>
                              <input
                                type="email"
                                value={heritier.email || ""}
                                onChange={e => updateHeritier(heritier.id, "email", e.target.value)}
                                className="w-full text-sm font-bold px-3 py-2 rounded-lg border border-emerald-200 bg-white focus:ring-2 focus:ring-emerald-500"
                                placeholder="Email (optionnel)"
                              />
                            </div>
                          </div>

                          <div className="border-t border-emerald-200 pt-3 mt-3">
                            <h4 className="text-xs font-bold text-emerald-900 mb-3">Pièce d'identité</h4>
                            <div>
                              <label className="block text-xs font-bold text-emerald-900/60 mb-1">Numéro de la pièce d'identité (18 chiffres)</label>
                              <input
                                type="text"
                                value={heritier.numeroIdentite || ""}
                                onChange={e => updateHeritier(heritier.id, "numeroIdentite", e.target.value)}
                                className="w-full text-sm font-bold px-3 py-2 rounded-lg border border-emerald-200 bg-white focus:ring-2 focus:ring-emerald-500 font-mono"
                                placeholder="Ex: 128563290140005217"
                                maxLength={18}
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-3 mt-3">
                              <div>
                                <label className="block text-xs font-bold text-emerald-900/60 mb-1">Date de délivrance</label>
                                <input
                                  type="date"
                                  value={heritier.dateDelivrance || ""}
                                  onChange={e => updateHeritier(heritier.id, "dateDelivrance", e.target.value)}
                                  className="w-full text-sm font-bold px-3 py-2 rounded-lg border border-emerald-200 bg-white focus:ring-2 focus:ring-emerald-500"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-emerald-900/60 mb-1">Lieu de délivrance</label>
                                <input
                                  type="text"
                                  value={heritier.lieuDelivrance || ""}
                                  onChange={e => updateHeritier(heritier.id, "lieuDelivrance", e.target.value)}
                                  className="w-full text-sm font-bold px-3 py-2 rounded-lg border border-emerald-200 bg-white focus:ring-2 focus:ring-emerald-500"
                                  placeholder="Ex: Berrouaghia"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Actions PDF */}
              <div className="pt-6 border-t border-gray-100">
                <h3 className="text-xs font-black uppercase tracking-wider text-gray-500 mb-4">Génération de documents</h3>
                
                {dossier.statut_abonne !== "Décédé" ? (
                  <button 
                    onClick={() => downloadPDF("pdf_mise_en_demeure")}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-black text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors"
                  >
                    <FileText size={18} /> Générer la mise en demeure (PDF)
                  </button>
                ) : (
                  <button 
                    onClick={() => downloadPDF("pdf_declaration_creance")}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-black text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 transition-colors"
                  >
                    <FileText size={18} /> Générer la déclaration de créance (PDF)
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-gray-50 flex gap-3 justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl text-sm font-bold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            Annuler
          </button>
          <button 
            onClick={handleSave}
            disabled={saving || loading}
            className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-brand-600 border border-brand-600 hover:bg-brand-700 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {saving ? <div className="spinner-premium w-4 h-4 border-2" /> : <CheckCircle size={16} />} 
            Sauvegarder le dossier
          </button>
        </div>

      </div>
    </div>
  );
}
