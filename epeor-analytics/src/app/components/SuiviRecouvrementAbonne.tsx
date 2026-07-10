"use client";

import React from "react";
import {
  FileText,
  Landmark,
  Scale,
  Mail,
  Gavel,
  FileCheck,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Handshake,
} from "lucide-react";

/**
 * Structure de l'objet abonne reçu par le composant.
 */
export interface SuiviAbonneData {
  id_abonnement: string | number;
  nom_abonne: string;
  montant_creance: number;
  ref_dossier_justice: string;
  current_step: number; // ID de l'étape (1 à 8)
  step_status: "en_attente" | "en_cours" | "valide";
  // Propriétés additionnelles pour refléter le détail des branchements
  reglement_conciliation?: boolean;
  jugement_definitif?: "par_defaut" | "contradictoire" | null;
  appel?: boolean;
}

interface SuiviRecouvrementAbonneProps {
  abonne: SuiviAbonneData;
  /** Callback optionnel pour interagir avec le diagramme (modifier l'état au clic) */
  onStepClick?: (stepId: number, fieldName: string, value: any) => void;
}

interface StepDefinition {
  id: number;
  title: string;
  description: string;
  actor: "Huissier" | "Tribunal" | "Régie" | "Avocat";
  fieldName: string; // Nom du champ dans DossierState
  icon: React.ComponentType<any>;
}

export default function SuiviRecouvrementAbonne({
  abonne,
  onStepClick,
}: SuiviRecouvrementAbonneProps) {
  const {
    id_abonnement,
    nom_abonne,
    montant_creance,
    ref_dossier_justice,
    current_step,
    step_status,
    reglement_conciliation = false,
    jugement_definitif = null,
    appel = false,
  } = abonne;

  // Définition des 8 étapes du recouvrement
  const steps: StepDefinition[] = [
    {
      id: 1,
      title: "Mise en demeure",
      description: "Dernière mise en demeure avant poursuites judiciaires",
      actor: "Régie",
      fieldName: "has_mise_en_demeure",
      icon: FileText,
    },
    {
      id: 2,
      title: "Enregistrement au tribunal",
      description: "Dossier enregistré et transmis pour délibéré",
      actor: "Avocat",
      fieldName: "transmis_cours",
      icon: Landmark,
    },
    {
      id: 3,
      title: "Dossier en délibéré",
      description: "Affaire mise en délibéré par le tribunal",
      actor: "Tribunal",
      fieldName: "dossier_en_delibere",
      icon: Landmark,
    },
    {
      id: 4,
      title: "Jugement rendu",
      description: "Prononcé du jugement de première instance",
      actor: "Tribunal",
      fieldName: "prononce_jugement",
      icon: Scale,
    },
    {
      id: 5,
      title: "Signification du jugement",
      description: "Notification du jugement à l'abonné",
      actor: "Huissier",
      fieldName: "notification_jugement",
      icon: Mail,
    },
    {
      id: 6,
      title: "Délibéré d'appel",
      description: "(Si Appel) Dossier en délibéré devant la Cour",
      actor: "Tribunal",
      fieldName: "dossier_en_delibere_appel",
      icon: Gavel,
    },
    {
      id: 7,
      title: "Arrêt rendu",
      description: "Notification de l'arrêt de la Cour par l'huissier",
      actor: "Huissier",
      fieldName: "notification_arret",
      icon: FileCheck,
    },
    {
      id: 8,
      title: "Exécution forcée",
      description: "Saisies, coupure réglementaire ou recouvrement forcé",
      actor: "Huissier",
      fieldName: "execution_jugement",
      icon: ShieldAlert,
    },
  ];

  /**
   * Calcule le statut spécifique d'une étape donnée.
   * Retourne 'valide' (vert), 'en_cours' (bleu ou jaune), ou 'en_attente' (gris).
   */
  const getStepStatus = (
    stepId: number,
  ): "valide" | "en_cours" | "en_attente" | "non_applicable" => {
    // Si règlement / conciliation validé en Étape 1, les étapes suivantes deviennent non applicables
    if (reglement_conciliation && stepId > 1) {
      return "non_applicable";
    }

    // Gestion du branchement à l'Étape 5 (Jugement définitif vs Appel)
    if (jugement_definitif && (stepId === 6 || stepId === 7)) {
      return "non_applicable";
    }

    // Si l'étape est passée
    if (stepId < current_step) {
      // Cas particulier : si on est à l'étape 8 via jugement définitif, l'appel (6,7) est ignoré
      if (current_step === 8 && jugement_definitif && (stepId === 6 || stepId === 7)) {
        return "non_applicable";
      }
      return "valide";
    }

    // Si c'est l'étape actuelle
    if (stepId === current_step) {
      return step_status;
    }

    // Si c'est une étape future
    return "en_attente";
  };

  /**
   * Retourne la couleur et les styles CSS associés à un statut d'étape et à un acteur.
   */
  const getStepStyles = (stepId: number, actor: string) => {
    const status = getStepStatus(stepId);

    if (status === "non_applicable") {
      return {
        card: "bg-slate-50/50 border-dashed border-slate-200 opacity-40 cursor-not-allowed",
        badge: "bg-slate-100 text-slate-400 border-slate-200",
        icon: "text-slate-300",
        text: "text-slate-400",
        statusText: "Non applicable",
      };
    }

    if (status === "valide") {
      return {
        card: "bg-emerald-50 border-emerald-500 hover:border-emerald-600 shadow-sm transition-all duration-300",
        badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
        icon: "text-emerald-600",
        text: "text-[#0F172A]",
        statusText: "Validé",
      };
    }

    if (status === "en_cours") {
      if (actor === "Huissier" || stepId === 1 || stepId === 8) {
        // Huissier / Étape critique -> Jaune clignotant
        return {
          card: "bg-amber-50/80 border-amber-500 shadow-lg ring-4 ring-amber-100/70 animate-pulse border-2",
          badge: "bg-amber-100 text-amber-800 border-amber-300 font-extrabold",
          icon: "text-amber-600",
          text: "text-[#0F172A] font-semibold",
          statusText: "En cours (Huissier)",
        };
      } else {
        // Avocat / Tribunal -> Bleu
        return {
          card: "bg-blue-50/80 border-blue-500 shadow-lg ring-4 ring-blue-100/70 border-2",
          badge: "bg-blue-100 text-blue-700 border-blue-200 font-extrabold",
          icon: "text-blue-600",
          text: "text-[#0F172A] font-semibold",
          statusText: "En cours (Tribunal/Avocat)",
        };
      }
    }

    // Par défaut : en attente (Gris)
    return {
      card: "bg-slate-50 border-slate-200 text-slate-400 opacity-75 hover:opacity-100 transition-all",
      badge: "bg-slate-100 text-slate-400 border-slate-200",
      icon: "text-slate-400",
      text: "text-slate-500",
      statusText: "En attente",
    };
  };

  const handleCardClick = (step: StepDefinition) => {
    if (!onStepClick) return;
    const status = getStepStatus(step.id);

    // Détermine la nouvelle valeur en fonction du clic
    let nextValue = true;
    if (status === "valide") {
      nextValue = false; // Permet de reculer d'un cran
    }

    onStepClick(step.id, step.fieldName, nextValue);
  };

  const formatAmount = (value: number) =>
    value.toLocaleString("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <div className="w-full flex flex-col gap-6">
      {/* ── BANDEAU INFOS ABONNÉ ── */}
      <div className="rounded-[24px] border border-[#E4E7EC] bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#94A3B8]">Abonné</span>
            <div className="text-sm font-black text-[#0F172A] truncate">
              {nom_abonne}
            </div>
            <div className="text-xs text-[#667085] font-medium">Réf: {id_abonnement}</div>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#94A3B8]">Créance Due</span>
            <div className="text-base font-black text-rose-600">
              {formatAmount(montant_creance)} DA
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#94A3B8]">Dossier Justice</span>
            <div className="text-sm font-bold text-[#334155]">
              {ref_dossier_justice || "Non enregistré"}
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#94A3B8]">État Général</span>
            <div>
              {reglement_conciliation ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <CheckCircle2 size={12} /> Litige Résolu (Accord)
                </span>
              ) : current_step === 8 && step_status === "valide" ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <CheckCircle2 size={12} /> Exécution Terminée
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-50 text-amber-800 border border-amber-200">
                  <AlertCircle size={12} className="animate-spin-slow" /> Procédure Judiciaire
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── DIAGRAMME DE FLUX RECOUVREMENT ── */}
      <div className="rounded-[30px] border border-[#E4E7EC] bg-[#F8FAFC] p-6 lg:p-8 overflow-hidden relative">
        <h3 className="text-xs font-black uppercase tracking-widest text-[#667085] mb-6 flex items-center gap-2">
          <TrendingUp size={16} className="text-brand-500" />
          Parcours Légal et Branchements Judiciaires
        </h3>

        {/* Layout responsive: Grid vertical sur mobile, Grid structuré sur Desktop */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
          
          {/* Ligne 1 : Étapes 1 à 4 */}
          {steps.slice(0, 4).map((step) => {
            const styles = getStepStyles(step.id, step.actor);
            const StepIcon = step.icon;
            return (
              <div
                key={step.id}
                onClick={() => handleCardClick(step)}
                className={`flex flex-col justify-between p-5 rounded-[22px] border bg-white cursor-pointer relative group transition-all duration-300 ${styles.card}`}
              >
                {/* Badge Acteur */}
                <div className="flex justify-between items-center mb-3">
                  <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${styles.badge}`}>
                    {step.actor}
                  </span>
                  <span className="text-xs font-black text-slate-300 group-hover:text-slate-400">
                    N°{step.id}
                  </span>
                </div>

                {/* Contenu */}
                <div className="flex gap-3 items-start my-2">
                  <div className={`p-2 rounded-xl bg-white border border-slate-100 shadow-sm ${styles.icon}`}>
                    <StepIcon size={20} />
                  </div>
                  <div className="min-w-0">
                    <h4 className={`text-xs font-bold truncate ${styles.text}`}>
                      {step.title}
                    </h4>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-tight line-clamp-2">
                      {step.description}
                    </p>
                  </div>
                </div>

                {/* Statut au bas */}
                <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                    {styles.statusText}
                  </span>
                  {getStepStatus(step.id) === "valide" && (
                    <CheckCircle2 size={12} className="text-emerald-500" />
                  )}
                </div>

                {/* Option de Branchement Amiable sur Étape 1 */}
                {step.id === 1 && (
                  <div className="absolute -bottom-16 left-0 right-0 z-10 px-2 flex justify-center md:justify-start">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onStepClick) {
                          onStepClick(1, "reglement_conciliation", !reglement_conciliation);
                        }
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black shadow-sm border transition-all ${
                        reglement_conciliation
                          ? "bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200"
                          : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-600"
                      }`}
                    >
                      <Handshake size={12} />
                      {reglement_conciliation ? "Échéancier Actif" : "Option: Échéancier"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Espace pour le branchement et la flèche */}
        <div className="h-16 md:h-12" />

        {/* Étape 5 : Signification Critique */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
          
          {/* Carte Étape 5 */}
          {(() => {
            const step = steps[4];
            const styles = getStepStyles(step.id, step.actor);
            const StepIcon = step.icon;
            return (
              <div
                onClick={() => handleCardClick(step)}
                className={`flex flex-col justify-between p-5 rounded-[22px] border bg-white cursor-pointer relative group transition-all duration-300 md:col-span-1 ${styles.card}`}
              >
                <div className="flex justify-between items-center mb-3">
                  <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${styles.badge}`}>
                    {step.actor}
                  </span>
                  <span className="text-xs font-black text-slate-300 group-hover:text-slate-400">
                    N°{step.id}
                  </span>
                </div>

                <div className="flex gap-3 items-start my-2">
                  <div className={`p-2 rounded-xl bg-white border border-slate-100 shadow-sm ${styles.icon}`}>
                    <StepIcon size={20} />
                  </div>
                  <div className="min-w-0">
                    <h4 className={`text-xs font-bold truncate ${styles.text}`}>
                      {step.title}
                    </h4>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-tight line-clamp-2">
                      {step.description}
                    </p>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                    {styles.statusText}
                  </span>
                  {getStepStatus(step.id) === "valide" && (
                    <CheckCircle2 size={12} className="text-emerald-500" />
                  )}
                </div>
              </div>
            );
          })()}

          {/* Panneau de Contrôle des Branchements à l'Étape 5 */}
          <div className="md:col-span-3 rounded-[22px] border border-[#E4E7EC] bg-white p-5 flex flex-col justify-center gap-3">
            <h5 className="text-[10px] font-black uppercase tracking-widest text-[#94A3B8] mb-1">
              Signification de l'Huissier : Branchements de l'Étape 5
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Branche A : Jugement définitif */}
              <div
                onClick={() => {
                  if (onStepClick) {
                    const isDef = jugement_definitif ? null : "par_defaut";
                    onStepClick(5, "jugement_definitif", isDef);
                  }
                }}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  jugement_definitif
                    ? "bg-emerald-50 border-emerald-500 text-emerald-800"
                    : "bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold text-xs">Branche A : Jugement Définitif</div>
                  <input
                    type="checkbox"
                    checked={!!jugement_definitif}
                    readOnly
                    className="h-4 w-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1 leading-tight">
                  Aucun appel déposé. Le jugement devient exécutoire de droit. Saute directement à l'exécution (Étape 8).
                </p>
                {jugement_definitif && (
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onStepClick) onStepClick(5, "jugement_definitif", "par_defaut");
                      }}
                      className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${
                        jugement_definitif === "par_defaut"
                          ? "bg-emerald-200 text-emerald-900 border-emerald-300"
                          : "bg-white text-slate-600 border-slate-200"
                      }`}
                    >
                      Par défaut
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onStepClick) onStepClick(5, "jugement_definitif", "contradictoire");
                      }}
                      className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${
                        jugement_definitif === "contradictoire"
                          ? "bg-emerald-200 text-emerald-900 border-emerald-300"
                          : "bg-white text-slate-600 border-slate-200"
                      }`}
                    >
                      Contradictoire
                    </button>
                  </div>
                )}
              </div>

              {/* Branche B : Appel */}
              <div
                onClick={() => {
                  if (onStepClick) {
                    onStepClick(5, "appel", !appel);
                  }
                }}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  appel
                    ? "bg-blue-50 border-blue-500 text-blue-800"
                    : "bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold text-xs">Branche B : Appel du Jugement</div>
                  <input
                    type="checkbox"
                    checked={appel}
                    readOnly
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1 leading-tight">
                  L'une des deux parties dépose un appel. Le dossier passe en Cour d'appel (Étapes 6 & 7).
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Espace pour le trajet d'Appel */}
        <div className="h-10" />

        {/* Ligne 3 : Étapes d'Appel (6 & 7) et Étape Finale d'Exécution (8) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
          
          {/* Étape 6 */}
          {(() => {
            const step = steps[5];
            const styles = getStepStyles(step.id, step.actor);
            const StepIcon = step.icon;
            return (
              <div
                onClick={() => handleCardClick(step)}
                className={`flex flex-col justify-between p-5 rounded-[22px] border bg-white cursor-pointer relative group transition-all duration-300 ${styles.card}`}
              >
                <div className="flex justify-between items-center mb-3">
                  <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${styles.badge}`}>
                    {step.actor}
                  </span>
                  <span className="text-xs font-black text-slate-300 group-hover:text-slate-400">
                    N°{step.id}
                  </span>
                </div>

                <div className="flex gap-3 items-start my-2">
                  <div className={`p-2 rounded-xl bg-white border border-slate-100 shadow-sm ${styles.icon}`}>
                    <StepIcon size={20} />
                  </div>
                  <div className="min-w-0">
                    <h4 className={`text-xs font-bold truncate ${styles.text}`}>
                      {step.title}
                    </h4>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-tight line-clamp-2">
                      {step.description}
                    </p>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                    {styles.statusText}
                  </span>
                  {getStepStatus(step.id) === "valide" && (
                    <CheckCircle2 size={12} className="text-emerald-500" />
                  )}
                </div>
              </div>
            );
          })()}

          {/* Étape 7 */}
          {(() => {
            const step = steps[6];
            const styles = getStepStyles(step.id, step.actor);
            const StepIcon = step.icon;
            return (
              <div
                onClick={() => handleCardClick(step)}
                className={`flex flex-col justify-between p-5 rounded-[22px] border bg-white cursor-pointer relative group transition-all duration-300 ${styles.card}`}
              >
                <div className="flex justify-between items-center mb-3">
                  <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${styles.badge}`}>
                    {step.actor}
                  </span>
                  <span className="text-xs font-black text-slate-300 group-hover:text-slate-400">
                    N°{step.id}
                  </span>
                </div>

                <div className="flex gap-3 items-start my-2">
                  <div className={`p-2 rounded-xl bg-white border border-slate-100 shadow-sm ${styles.icon}`}>
                    <StepIcon size={20} />
                  </div>
                  <div className="min-w-0">
                    <h4 className={`text-xs font-bold truncate ${styles.text}`}>
                      {step.title}
                    </h4>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-tight line-clamp-2">
                      {step.description}
                    </p>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                    {styles.statusText}
                  </span>
                  {getStepStatus(step.id) === "valide" && (
                    <CheckCircle2 size={12} className="text-emerald-500" />
                  )}
                </div>
              </div>
            );
          })()}

          {/* Connecteur pour combler l'espace du grid en cas de non appel */}
          <div className="hidden md:block col-span-1" />

          {/* Étape 8 : Exécution Forcée */}
          {(() => {
            const step = steps[7];
            const styles = getStepStyles(step.id, step.actor);
            const StepIcon = step.icon;
            return (
              <div
                onClick={() => handleCardClick(step)}
                className={`flex flex-col justify-between p-5 rounded-[22px] border bg-white cursor-pointer relative group transition-all duration-300 ${styles.card}`}
              >
                <div className="flex justify-between items-center mb-3">
                  <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${styles.badge}`}>
                    {step.actor}
                  </span>
                  <span className="text-xs font-black text-slate-300 group-hover:text-slate-400">
                    N°{step.id}
                  </span>
                </div>

                <div className="flex gap-3 items-start my-2">
                  <div className={`p-2 rounded-xl bg-white border border-slate-100 shadow-sm ${styles.icon}`}>
                    <StepIcon size={20} />
                  </div>
                  <div className="min-w-0">
                    <h4 className={`text-xs font-bold truncate ${styles.text}`}>
                      {step.title}
                    </h4>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-tight line-clamp-2">
                      {step.description}
                    </p>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                    {styles.statusText}
                  </span>
                  {getStepStatus(step.id) === "valide" && (
                    <CheckCircle2 size={12} className="text-emerald-500" />
                  )}
                </div>
              </div>
            );
          })()}

        </div>
      </div>
    </div>
  );
}
