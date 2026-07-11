"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  CheckCircle,
  Check,
  Plus,
  Trash2,
} from "lucide-react";
import { apiUrlObject } from "../lib/api";
import { showAlert } from "./utils";
import { escapeHtml } from "../../lib/escape";
import SuiviRecouvrementAbonne from "./SuiviRecouvrementAbonne";

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

interface EcheanceLine {
  id: string;
  date: string;
  invoiceIds: string[];
}

interface DossierState {
  statut_abonne: string;
  etape_recouvrement: string;
  has_mise_en_demeure: boolean;
  has_echeancier: boolean;
  transmis_huissier: boolean;
  transmis_cours: boolean;
  execution_jugement: boolean;
  reglement_conciliation: boolean;
  jugement_definitif: string | null; // 'par_defaut' | 'contradictoire' | null
  appel: boolean;
  dossier_en_delibere_appel: boolean;
  rendu_arret: boolean;
  notification_jugement: boolean;
  notification_arret: boolean;
  dossier_en_delibere: boolean;
  prononce_jugement: boolean;
  nom_notaire: string;
  coordonnees_notaire: string;
  liste_heritiers: string;
  date_declaration_creance: string;
  motif: string;
  echeancier_plan: EcheanceLine[];
  heritiers: Heritier[];
}

const initialDossierState: DossierState = {
  statut_abonne: "Actif",
  etape_recouvrement: "Amiable",
  has_mise_en_demeure: false,
  has_echeancier: false,
  transmis_huissier: false,
  transmis_cours: false,
  execution_jugement: false,
  reglement_conciliation: false,
  jugement_definitif: null,
  appel: false,
  dossier_en_delibere_appel: false,
  rendu_arret: false,
  notification_jugement: false,
  notification_arret: false,
  dossier_en_delibere: false,
  prononce_jugement: false,
  nom_notaire: "",
  coordonnees_notaire: "",
  liste_heritiers: "",
  date_declaration_creance: "",
  motif: "",
  echeancier_plan: [],
  heritiers: [],
};

export function DossierJuridiquePanel({
  isOpen,
  onClose,
  abonne,
}: DossierJuridiquePanelProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [motifError, setMotifError] = useState("");
  const [factures, setFactures] = useState<any[]>([]);
  const [installments, setInstallments] = useState(3);
  const [installmentIntervalMonths, setInstallmentIntervalMonths] = useState(1);
  const [installmentStartDate, setInstallmentStartDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [installmentTargetAmount, setInstallmentTargetAmount] = useState(0);

  const [dossier, setDossier] = useState<DossierState>(initialDossierState);

  const sanitizeDossierForStatus = useCallback(
    (values: Partial<DossierState>): DossierState => {
      const base: DossierState = {
        ...initialDossierState,
        ...values,
      };

      if (base.statut_abonne === "Suspendu") {
        return {
          ...base,
          has_mise_en_demeure: false,
          has_echeancier: false,
          transmis_huissier: false,
          transmis_cours: false,
          execution_jugement: false,
          reglement_conciliation: false,
          jugement_definitif: null,
          appel: false,
          dossier_en_delibere_appel: false,
          rendu_arret: false,
          notification_jugement: false,
          notification_arret: false,
          dossier_en_delibere: false,
          prononce_jugement: false,
        };
      }
      return base;
    },
    [],
  );

  const deriveEtapeRecouvrement = useCallback(
    (values: Partial<DossierState>) => {
    if (values.statut_abonne === "Suspendu") {
      return "Suspendu";
    }
    if (values.execution_jugement) {
      return "Procédures d'exécution de l'arrêt";
    }
    if (values.transmis_huissier) {
      return "Transmis Huissier";
    }
    if (values.transmis_cours) {
      return "Enregistrement du dossier au tribunal";
    }
    if (values.statut_abonne === "Décédé") {
      return "Transmis Huissier";
    }
      // Follow diagram flow
      if (values.has_mise_en_demeure) {
        if (values.reglement_conciliation) return "Échéancier accordé";
        return "Dernière mise en demeure avant les poursuites judiciaires";
      }
      if (values.has_echeancier) {
        return "Amiable";
      }

      if (values.jugement_definitif) return "Jugement définitif";
      if (values.prononce_jugement) return "Prononcé d'un jugement de première instance";
      if (values.notification_jugement) return "Notification du jugement";
      if (values.jugement_definitif) return "Jugement définitif";
      if (values.appel) return "Appel du jugement";
      if (values.dossier_en_delibere_appel) return "Dossier en délibéré (Appel)";
      if (values.rendu_arret) return "Rendu de l'arrêt";
      if (values.notification_arret) return "Notification de l'arrêt";

      return values.etape_recouvrement || "Amiable";
    },
    [],
  );

  const updateDossierState = (updates: Partial<DossierState>) => {
    setDossier((current) => {
      const merged = { ...current, ...updates } as DossierState;

      // Enforce workflow sequence (cannot skip steps)
      const enforced = { ...merged } as DossierState;

      // Prerequisites are enforced via UI disabling only — no upstream auto-enforcement here.
      // has_echeancier mirrors reglement_conciliation (same concept, one-directional copy).
      enforced.has_echeancier = enforced.reglement_conciliation;

      // Notification du jugement requires prononcé
      if (enforced.notification_jugement && !enforced.prononce_jugement) enforced.prononce_jugement = true;

      // Jugement définitif requires notification_jugement
      if (enforced.jugement_definitif && !enforced.notification_jugement) enforced.notification_jugement = true;

      // Appel flow forward-only enforcement
      if (enforced.notification_arret && !enforced.rendu_arret) enforced.rendu_arret = true;
      if (enforced.execution_jugement && !enforced.notification_arret) enforced.notification_arret = true;

      // If earlier step unset, clear downstream steps
      if (!enforced.has_mise_en_demeure) {
        enforced.reglement_conciliation = false;
        enforced.has_echeancier = false;
        enforced.transmis_cours = false;
        enforced.dossier_en_delibere = false;
        enforced.prononce_jugement = false;
        enforced.notification_jugement = false;
        enforced.jugement_definitif = null;
        enforced.appel = false;
        enforced.dossier_en_delibere_appel = false;
        enforced.rendu_arret = false;
        enforced.notification_arret = false;
        enforced.execution_jugement = false;
      }

      if (!enforced.transmis_cours) {
        enforced.dossier_en_delibere = false;
        enforced.prononce_jugement = false;
        enforced.notification_jugement = false;
        enforced.jugement_definitif = null;
        enforced.appel = false;
        enforced.dossier_en_delibere_appel = false;
      }

      const next = sanitizeDossierForStatus(enforced);
      return {
        ...next,
        etape_recouvrement: deriveEtapeRecouvrement(next),
      };
    });
  };

  useEffect(() => {
    if (isOpen && abonne) {
      setLoading(true);
      Promise.all([
        fetch(
          apiUrlObject(`/api/abonne/${abonne.numab}/dossier`).toString(),
        ).then((res) => res.json()),
        fetch(apiUrlObject(`/api/abonne/${abonne.numab}`).toString()).then(
          (res) => res.json(),
        ),
      ])
        .then(([dossierData, abonneData]) => {
          const initialDossier = sanitizeDossierForStatus({
            statut_abonne: dossierData.statut_abonne || "Actif",
            etape_recouvrement: deriveEtapeRecouvrement({
              ...dossierData,
              statut_abonne: dossierData.statut_abonne || "Actif",
              etape_recouvrement: dossierData.etape_recouvrement || "Amiable",
              has_mise_en_demeure: !!dossierData.has_mise_en_demeure,
              has_echeancier: !!dossierData.has_echeancier,
              transmis_huissier: !!dossierData.transmis_huissier,
              transmis_cours: !!dossierData.transmis_cours,
              execution_jugement: !!dossierData.execution_jugement,
            }),
            has_mise_en_demeure: !!dossierData.has_mise_en_demeure,
            has_echeancier: !!dossierData.has_echeancier,
            transmis_huissier: !!dossierData.transmis_huissier,
            transmis_cours: !!dossierData.transmis_cours,
            execution_jugement: !!dossierData.execution_jugement,
            reglement_conciliation: !!dossierData.reglement_conciliation,
            jugement_definitif: dossierData.jugement_definitif || null,
            appel: !!dossierData.appel,
            dossier_en_delibere: !!dossierData.dossier_en_delibere,
            prononce_jugement: !!dossierData.prononce_jugement,
            dossier_en_delibere_appel: !!dossierData.dossier_en_delibere_appel,
            rendu_arret: !!dossierData.rendu_arret,
            notification_jugement: !!dossierData.notification_jugement,
            notification_arret: !!dossierData.notification_arret,
            nom_notaire: dossierData.nom_notaire || "",
            coordonnees_notaire: dossierData.coordonnees_notaire || "",
            liste_heritiers: dossierData.liste_heritiers || "",
            date_declaration_creance:
              dossierData.date_declaration_creance || "",
            motif: dossierData.motif || dossierData.motif_suspension || "",
            echeancier_plan: Array.isArray(dossierData.echeancier_plan)
              ? dossierData.echeancier_plan
              : [],
            heritiers: dossierData.heritiers || [],
          });

          setDossier(initialDossier);

          if (abonneData && Array.isArray(abonneData.factures)) {
            setFactures(abonneData.factures);
          }
        })
        .finally(() => setLoading(false));
    }
  }, [abonne, deriveEtapeRecouvrement, isOpen, sanitizeDossierForStatus]);

  if (!isOpen || !abonne) return null;

  const handleSave = async () => {
    if (dossier.statut_abonne === "Suspendu" && !dossier.motif.trim()) {
      setMotifError("Veuillez préciser le motif de suspension.");
      void showAlert("Veuillez fournir un motif pour un dossier suspendu.", {
        icon: "warning",
      });
      return;
    }

    setMotifError("");
    setSaving(true);
    try {
      await fetch(
        apiUrlObject(`/api/abonne/${abonne.numab}/dossier`).toString(),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...dossier,
            echeancier_plan: dossier.has_echeancier
              ? dossier.echeancier_plan
              : [],
          }),
        },
      );
      void showAlert("Dossier mis à jour avec succès", { icon: "success" });
      onClose();
    } catch {
      void showAlert("Erreur lors de la sauvegarde.", { icon: "error" });
    } finally {
      setSaving(false);
    }
  };

  const printEcheancier = () => {
    const totalAmount = dossier.echeancier_plan.reduce((sum, line) => {
      return (
        sum +
        line.invoiceIds.reduce(
          (lineSum, invoiceId) => lineSum + getInvoiceAmount(invoiceId),
          0,
        )
      );
    }, 0);

    const formatAmount = (value: number) =>
      value.toLocaleString("fr-FR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

    const htmlContent = `<!DOCTYPE html>
      <html lang="fr">
        <head>
          <meta charset="UTF-8" />
          <title>Échéancier - Abonné ${escapeHtml(abonne.numab)}</title>
          <style>
            @page { size: A4 portrait; margin: 10mm; }
            html, body { width: 190mm; height: 277mm; margin: 0; padding: 0; }
            body { font-family: Inter, sans-serif; color: #111827; padding: 10px; font-size: 10px; line-height: 1.25; }
            h1, h2, h3 { margin: 0 0 10px; }
            .print-header { margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #e2e8f0; }
            .print-header div { line-height: 1.2; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 9.5px; }
            thead { display: table-row-group; }
            th, td { border: 1px solid #d1d5db; padding: 6px 8px; vertical-align: middle; }
            th { background: #ecfdf5; color: #065f46; font-weight: 800; }
            td { background: #ffffff; }
            th:nth-child(1), td:nth-child(1) { width: 8%; text-align: center; }
            th:nth-child(2), td:nth-child(2) { width: 16%; text-align: center; }
            th:nth-child(3), td:nth-child(3) { width: 16%; text-align: center; }
            th:nth-child(4), td:nth-child(4) { width: 40%; text-align: center; }
            th:nth-child(5), td:nth-child(5) { width: 20%; text-align: right; }
            .meta { margin-top: 12px; font-size: 9.5px; }
            .meta strong { display: inline-block; width: 110px; }
            .total-row td { font-weight: 800; background: #f8fafc; }
            img { max-height: 40px; }
            tr { page-break-inside: avoid; }
            .print-header { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
            .print-header .title-section { text-align: right; }
            .print-header .title-section div { font-size: 11px; color: #475569; }
            @media print {
              body { margin: 0; }
              .print-header { page-break-after: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="print-header" style="display:flex;justify-content:space-between;align-items:center;gap:20px;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid #e2e8f0;">
            <div style="display:flex;align-items:center;gap:14px;">
              <img src="${window.location.origin}/ade.png" alt="ADE" style="height:48px;width:auto;object-fit:contain;" onerror="this.style.display='none'" />
              <div>
                <div style="font-size:14px;font-weight:900;color:#0f172a;">ADE - Algérienne des Eaux</div>
                <div style="font-size:11px;color:#475569;letter-spacing:0.08em;">${abonne.nom_secteur ? `Centre : ${escapeHtml(abonne.nom_secteur)}` : abonne.code_secteur ? `Centre : ${escapeHtml(abonne.code_secteur)}` : ""}</div>
              </div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:20px;font-weight:900;color:#0f172a;">Échéancier</div>
              <div style="font-size:12px;color:#475569;">Abonné ${escapeHtml(abonne.numab)}</div>
              <div style="font-size:12px;color:#475569;">${new Date().toLocaleDateString("fr-FR")}</div>
            </div>
          </div>
          <div class="meta"><strong>Abonné :</strong> ${escapeHtml(abonne.numab)} — ${escapeHtml(abonne.name || abonne.nom_prenom || "Inconnu")}</div>
          <div class="meta"><strong>Date :</strong> ${new Date().toLocaleDateString("fr-FR")}</div>
          <div class="meta"><strong>Montant cible par période :</strong> ${installmentTargetAmount > 0 ? formatAmount(installmentTargetAmount) + " DA" : "Non défini"}</div>
          <table>
            <thead>
              <tr>
                <th>Tranche</th>
                <th>Date échéance</th>
                <th>Somme Tranche (DA)</th>
                <th>Facture</th>
                <th>Montant facture (DA)</th>
              </tr>
            </thead>
            <tbody>
              ${dossier.echeancier_plan
                .map((line, idx) => {
                  if (!line.invoiceIds.length) return "";
                  const rowspan = line.invoiceIds.length;
                  const lineAmount = line.invoiceIds.reduce(
                    (sum, invoiceId) => sum + getInvoiceAmount(invoiceId),
                    0,
                  );
                  return line.invoiceIds
                    .map((invoiceId, invoiceIndex) => {
                      const amount = getInvoiceAmount(invoiceId).toFixed(2);
                      const reference = formatInvoiceReference(invoiceId);
                      if (invoiceIndex === 0) {
                        return `
                      <tr>
                        <td rowspan="${rowspan}" style="vertical-align:middle;text-align:center;">${idx + 1}</td>
                        <td rowspan="${rowspan}" style="vertical-align:middle;text-align:center;">${escapeHtml(line.date)}</td>
                        <td rowspan="${rowspan}" style="vertical-align:middle;text-align:center;">${formatAmount(lineAmount)}</td>
                        <td>${escapeHtml(reference)}</td>
                        <td style="text-align:right;">${formatAmount(Number(amount))}</td>
                      </tr>
                    `;
                      }

                      return `
                    <tr>
                      <td>${escapeHtml(reference)}</td>
                      <td style="text-align:right;">${formatAmount(Number(amount))}</td>
                    </tr>
                  `;
                    })
                    .join("");
                })
                .join("")}
              <tr class="total-row">
                <td colspan="4" style="text-align:right;">Total échéancier</td>
                <td style="text-align:right;">${formatAmount(totalAmount)}</td>
              </tr>
            </tbody>
          </table>
          <script>window.onload = function() { window.print(); }</script>
        </body>
      </html>`;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      void showAlert("Veuillez autoriser les pop-ups pour imprimer.", {
        icon: "warning",
      });
      return;
    }
    printWindow.document.write(htmlContent);
    printWindow.document.close();
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
      lieuDelivrance: "",
    };
    setDossier({
      ...dossier,
      heritiers: [...dossier.heritiers, newHeritier],
    });
  };

  const getInvoiceAmount = (invoiceId: string) => {
    return factures.find((f) => f.id === invoiceId)?.montant || 0;
  };

  const formatInvoiceReference = (invoiceRef: string) => {
    const match = /^([0-9]{4})-([0-9]{2})\/([A-Z])$/.exec(invoiceRef);
    if (!match) return invoiceRef;

    const [, year, month, type] = match;
    if (type === "E") {
      const trimLabels: Record<string, string> = {
        "03": "01er Trim",
        "06": "02ème Trim",
        "09": "03ème Trim",
        "12": "04ème Trim",
      };
      const label = trimLabels[month] || `${month} Trim`;
      return `${label} ${year}`;
    }

    return invoiceRef;
  };

  const calculateLineAmount = (line: EcheanceLine) => {
    return line.invoiceIds.reduce((sum, id) => sum + getInvoiceAmount(id), 0);
  };

  const buildAutomaticEcheancier = () => {
    const unpaidFactures = factures.filter((f) => !f.date_reglement);
    if (!unpaidFactures.length) return;
    const sorted = [...unpaidFactures].sort((a, b) => a.montant - b.montant);
    const totalAmount = sorted.reduce((sum, f) => sum + f.montant, 0);
    const useTargetAmount = installmentTargetAmount > 0;
    const target = useTargetAmount
      ? installmentTargetAmount
      : totalAmount / installments;
    const lines: EcheanceLine[] = [];
    let currentDate = new Date(installmentStartDate);
    let currentLine: EcheanceLine = {
      id: Date.now().toString(),
      date: currentDate.toISOString().slice(0, 10),
      invoiceIds: [],
    };
    let currentSum = 0;

    const addLine = () => {
      lines.push({
        ...currentLine,
        invoiceIds: [...currentLine.invoiceIds],
      });
      currentDate = new Date(currentDate);
      currentDate.setMonth(currentDate.getMonth() + installmentIntervalMonths);
      currentLine = {
        id: (Date.now() + lines.length).toString(),
        date: currentDate.toISOString().slice(0, 10),
        invoiceIds: [],
      };
      currentSum = 0;
    };

    sorted.forEach((invoice, idx) => {
      const nextSum = currentSum + invoice.montant;
      const isLastInvoice = idx === sorted.length - 1;
      const shouldCloseLine =
        currentLine.invoiceIds.length > 0 &&
        !isLastInvoice &&
        (currentSum >= target ||
          (nextSum > target &&
            Math.abs(target - currentSum) <= Math.abs(nextSum - target)));

      if (
        !useTargetAmount &&
        currentLine.invoiceIds.length > 0 &&
        !isLastInvoice &&
        currentSum > 0 &&
        lines.length === installments - 1
      ) {
        // Keep final line as last tranche when using fixed numero de tranches
      } else if (shouldCloseLine) {
        addLine();
      }

      currentLine.invoiceIds.push(invoice.id);
      currentSum += invoice.montant;
    });

    if (currentLine.invoiceIds.length > 0) {
      lines.push(currentLine);
    }

    const filteredLines = lines.filter((line) => line.invoiceIds.length > 0);
    setDossier({ ...dossier, echeancier_plan: filteredLines });
  };

  const removeHeritier = (id: string) => {
    setDossier({
      ...dossier,
      heritiers: dossier.heritiers.filter((h) => h.id !== id),
    });
  };

  const updateHeritier = (id: string, field: keyof Heritier, value: string) => {
    setDossier({
      ...dossier,
      heritiers: dossier.heritiers.map((h) =>
        h.id === id ? { ...h, [field]: value } : h,
      ),
    });
  };

  const steps = [
    "Suspendu",
    "Amiable",
    "Dernière mise en demeure avant les poursuites judiciaires",
    "Échéancier accordé",
    "Transmis Huissier",
    "Enregistrement du dossier au tribunal",
    "Dossier en délibéré",
    "Prononcé d'un jugement de première instance",
    "Notification du jugement",
    "Jugement définitif",
    "Appel du jugement",
    "Dossier en délibéré (Appel)",
    "Rendu de l'arrêt",
    "Notification de l'arrêt",
    "Procédures d'exécution de l'arrêt",
  ];
  const isSuspendedStatus = dossier.statut_abonne === "Suspendu";
  const effectiveEtapeRecouvrement = deriveEtapeRecouvrement(dossier);
  const currentStepIndex = steps.indexOf(effectiveEtapeRecouvrement);

  // Calcul du pas de recouvrement actuel (1 à 8) et de son état pour le SuiviRecouvrementAbonne
  let currentStepNumber = 1;
  let currentStepStatus: "en_attente" | "en_cours" | "valide" = "en_cours";

  if (dossier.execution_jugement) {
    currentStepNumber = 8;
    currentStepStatus = "valide";
  } else if (dossier.notification_arret) {
    currentStepNumber = 8;
    currentStepStatus = "en_cours";
  } else if (dossier.rendu_arret) {
    currentStepNumber = 7;
    currentStepStatus = "valide";
  } else if (dossier.dossier_en_delibere_appel) {
    currentStepNumber = 7;
    currentStepStatus = "en_cours";
  } else if (dossier.appel) {
    currentStepNumber = 6;
    currentStepStatus = "en_cours";
  } else if (dossier.jugement_definitif) {
    currentStepNumber = 8;
    currentStepStatus = "en_cours";
  } else if (dossier.notification_jugement) {
    currentStepNumber = 5;
    currentStepStatus = "en_cours";
  } else if (dossier.prononce_jugement) {
    currentStepNumber = 4;
    currentStepStatus = "valide";
  } else if (dossier.dossier_en_delibere) {
    currentStepNumber = 4;
    currentStepStatus = "en_cours";
  } else if (dossier.transmis_cours) {
    currentStepNumber = 3;
    currentStepStatus = "en_cours";
  } else if (dossier.has_mise_en_demeure) {
    currentStepNumber = 2;
    currentStepStatus = "en_cours";
  } else {
    currentStepNumber = 1;
    currentStepStatus = "en_cours";
  }

  return (
    <div className="w-full">
      <div className="w-full rounded-[32px] border border-[#E4E7EC] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.08)] overflow-hidden animate-in fade-in duration-300">
        <div className="page-card border-b border-[#E4E7EC] bg-white">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-6">
            <div className="min-w-0">
              <h2
                className="page-title"
                style={{
                  background: "var(--gradient-accent)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Dossier Contentieux
              </h2>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-end">
              <button
                onClick={onClose}
                className="px-6 py-3 rounded-2xl text-sm font-black text-[#475569] bg-white border border-[#E4E7EC] hover:border-rose-500 hover:text-rose-600 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving || loading}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-brand-600 text-sm font-black text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                {saving ? (
                  <div className="spinner-premium w-4 h-4 border-2" />
                ) : (
                  <CheckCircle size={16} />
                )}
                Sauvegarder le dossier
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto">
          <div className="px-6 py-6 space-y-8">
            {loading ? (
              <div className="flex items-center justify-center h-56">
                <div className="spinner-premium" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-6">
                  <div className="space-y-6">
                    <div className="rounded-[30px] border border-[#E4E7EC] bg-white p-6 shadow-sm">
                      <SuiviRecouvrementAbonne
                        abonne={{
                          id_abonnement: abonne.numab,
                          nom_abonne: abonne.name || abonne.nom_prenom || "Abonné Inconnu",
                          montant_creance: abonne.montant_creance || 0,
                          ref_dossier_justice: abonne.ref_dossier || "",
                          current_step: currentStepNumber,
                          step_status: currentStepStatus,
                          reglement_conciliation: dossier.reglement_conciliation,
                          jugement_definitif: dossier.jugement_definitif as "par_defaut" | "contradictoire" | null,
                          appel: dossier.appel,
                          adresse: abonne.adresse || "",
                          bloc: abonne.bloc || "",
                          ndom: abonne.ndom || "",
                        }}
                        onStepClick={(stepId, fieldName, value) => {
                          updateDossierState({ [fieldName]: value });
                        }}
                      />
                    </div>

                    {/* ── PARCOURS LÉGAL ET BRANCHEMENTS JUDICIAIRES (CHEVRON) ── */}
                    <div className="rounded-[30px] border border-[#E4E7EC] bg-white p-6 space-y-4">
                      <h3 className="text-xs font-black uppercase tracking-wider text-[#667085]">
                        Parcours Légal et Branchements Judiciaires
                      </h3>
                      
                      <div className="overflow-x-auto pb-4">
                        <div className="flex gap-1 min-w-max">
                          {(() => {
                            // Définir toutes les démarches possibles dans l'ordre chronologique
                            const allSteps = [
                              { key: "has_mise_en_demeure", label: "Mise en demeure", color: "slate", phase: "Amiable" },
                              { key: "reglement_conciliation", label: "Échéancier accordé", color: "emerald", phase: "Amiable" },
                              { key: "transmis_cours", label: "Tribunal", color: "blue", phase: "1ère instance" },
                              { key: "dossier_en_delibere", label: "Délibéré", color: "blue", phase: "1ère instance" },
                              { key: "prononce_jugement", label: "Jugement", color: "blue", phase: "1ère instance" },
                              { key: "notification_jugement", label: "Notification", color: "amber", phase: "1ère instance" },
                              { key: "appel", label: "Appel", color: "violet", phase: "Appel" },
                              { key: "dossier_en_delibere_appel", label: "Délibéré (Appel)", color: "violet", phase: "Appel" },
                              { key: "rendu_arret", label: "Arrêt", color: "violet", phase: "Appel" },
                              { key: "notification_arret", label: "Notification Arrêt", color: "amber", phase: "Appel" },
                              { key: "execution_jugement", label: "Exécution", color: "rose", phase: "Exécution" },
                            ];
                            
                            // Filtrer uniquement les démarches actives
                            const activeSteps = allSteps.filter(step => dossier[step.key as keyof typeof dossier]);
                            
                            if (activeSteps.length === 0) {
                              return (
                                <div className="text-xs text-[#667085] italic py-2">
                                  Aucune démarche enregistrée pour ce dossier.
                                </div>
                              );
                            }
                            
                            const colorMap: Record<string, { bg: string; text: string; gradient: string }> = {
                              slate: { bg: "bg-slate-100", text: "text-slate-700", gradient: "from-slate-400 to-slate-500" },
                              amber: { bg: "bg-amber-100", text: "text-amber-700", gradient: "from-amber-400 to-amber-500" },
                              blue: { bg: "bg-blue-100", text: "text-blue-700", gradient: "from-blue-400 to-blue-500" },
                              emerald: { bg: "bg-emerald-100", text: "text-emerald-700", gradient: "from-emerald-400 to-emerald-500" },
                              violet: { bg: "bg-violet-100", text: "text-violet-700", gradient: "from-violet-400 to-violet-500" },
                              rose: { bg: "bg-rose-100", text: "text-rose-700", gradient: "from-rose-400 to-rose-500" },
                            };
                            
                            return activeSteps.map((step, idx) => (
                              <div key={step.key} className="flex items-center">
                                <div
                                  className={`relative px-3 py-2 rounded-lg font-bold text-xs transition-all whitespace-nowrap min-w-fit bg-gradient-to-r ${colorMap[step.color].gradient} text-white shadow-md`}
                                >
                                  <div>{step.label}</div>
                                  <div className="absolute -top-2 -right-2">
                                    <div className="flex items-center justify-center w-5 h-5 rounded-full bg-white border-2 border-green-500">
                                      <Check size={12} className="text-green-500" />
                                    </div>
                                  </div>
                                </div>
                                {idx < activeSteps.length - 1 && (
                                  <div
                                    className={`w-5 h-7 -mx-0.5 bg-gradient-to-r ${colorMap[step.color].gradient} shadow-sm`}
                                    style={{
                                      clipPath: "polygon(0 0, 100% 50%, 0 100%)",
                                    }}
                                  />
                                )}
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[30px] border border-[#E4E7EC] bg-white p-6 space-y-6">
                      {/* ── EN-TÊTE + STATUT ABONNÉ ── */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <h3 className="text-xs font-black uppercase tracking-wider text-[#667085]">
                          Statut du dossier
                        </h3>
                        <div className="flex items-center gap-3">
                          <label className="text-[10px] font-black uppercase tracking-widest text-[#94A3B8] whitespace-nowrap">
                            Statut abonné
                          </label>
                          <select
                            value={dossier.statut_abonne}
                            onChange={(e) => {
                              const nextStatus = e.target.value;
                              updateDossierState({ statut_abonne: nextStatus });
                              if (nextStatus !== "Suspendu") {
                                setMotifError("");
                              }
                            }}
                            className="rounded-xl border border-[#E4E7EC] bg-[#F8FAFC] px-3 py-2 text-xs font-bold text-[#0F172A] focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                          >
                            <option value="Actif">Actif</option>
                            <option value="Suspendu">Suspendu</option>
                            <option value="Décédé">Décédé</option>
                            <option value="Héritier">Héritier</option>
                          </select>
                        </div>
                      </div>

                      {/* ── ALERTE SUSPENSION ── */}
                      {isSuspendedStatus && (
                        <div className="space-y-3">
                          <label className="grid gap-2">
                            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#98A2B3]">
                              Motif de suspension <span className="text-red-500">*</span>
                            </span>
                            <textarea
                              value={dossier.motif}
                              onChange={(e) => {
                                setDossier({ ...dossier, motif: e.target.value });
                                if (motifError) setMotifError("");
                              }}
                              className={`min-h-[80px] rounded-2xl border bg-white px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 ${motifError ? "border-red-300 focus:border-red-500 focus:ring-red-100" : "border-[#E4E7EC] focus:border-brand-500 focus:ring-brand-100"}`}
                              placeholder="Ex : Paiement non effectué, changement de situation..."
                            />
                            {motifError ? (
                              <p className="text-xs font-semibold text-red-600">{motifError}</p>
                            ) : (
                              <p className="text-xs text-[#667085]">Le motif est obligatoire pour un dossier suspendu.</p>
                            )}
                          </label>
                          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-700">
                            Aucune démarche ne peut être attribuée lorsque le dossier est suspendu.
                          </div>
                        </div>
                      )}

                      {/* ── PHASES JUDICIAIRES ── */}
                      {/* Groupe 1 : Phase amiable */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[9px] font-black uppercase tracking-wider border border-slate-200">
                            Phase amiable
                          </span>
                          <div className="flex-1 h-px bg-slate-100" />
                        </div>
                        {[
                          {
                            key: "has_mise_en_demeure",
                            label: "Mise en demeure",
                            description: "Dernière mise en demeure avant les poursuites judiciaires",
                            actor: "Régie",
                            actorColor: "bg-slate-100 text-slate-600 border-slate-200",
                            prereq: null,
                          },

                          {
                            key: "reglement_conciliation",
                            label: "Échéancier accordé",
                            description: "Plan de paiement échelonné convenu avec l'abonné, mettant fin au litige amiable",
                            actor: "Régie",
                            actorColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
                            prereq: "has_mise_en_demeure" as keyof typeof dossier,
                          },
                        ].map(({ key, label, description, actor, actorColor, prereq }) => {
                          const value = dossier[key as keyof typeof dossier] as boolean;
                          const disabled = isSuspendedStatus || (prereq !== null && !dossier[prereq!]);
                          return (
                            <label
                              key={key}
                              className={`flex items-center gap-4 rounded-2xl border px-4 py-3 transition-all duration-200 ${
                                disabled
                                  ? "opacity-40 cursor-not-allowed border-[#E4E7EC] bg-[#F8FAFC]"
                                  : value
                                  ? "border-emerald-400 bg-emerald-50 cursor-pointer hover:border-emerald-500"
                                  : "border-[#E4E7EC] bg-[#F8FAFC] cursor-pointer hover:border-brand-300 hover:bg-white"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={value}
                                disabled={disabled}
                                onChange={(e) => updateDossierState({ [key]: e.target.checked })}
                                className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-sm font-bold ${value ? "text-emerald-800" : "text-[#334155]"}`}>
                                    {label}
                                  </span>
                                  <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${actorColor}`}>
                                    {actor}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{description}</p>
                              </div>
                              {value && <Check size={14} className="text-emerald-500 shrink-0" />}
                            </label>
                          );
                        })}
                      </div>

                      {/* Groupe 2 : Phase judiciaire — Tribunal */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[9px] font-black uppercase tracking-wider border border-blue-200">
                            Tribunal — 1ère instance
                          </span>
                          <div className="flex-1 h-px bg-blue-100" />
                        </div>
                         {[
                          {
                            key: "transmis_cours",
                            label: "Enregistrement au tribunal",
                            description: "Dossier déposé et enregistré auprès du tribunal",
                            actor: "Avocat",
                            actorColor: "bg-blue-50 text-blue-700 border-blue-200",
                            prereq: "has_mise_en_demeure" as keyof typeof dossier,
                          },
                          {
                            key: "dossier_en_delibere",
                            label: "Dossier en délibéré",
                            description: "Affaire mise en délibéré par le tribunal",
                            actor: "Tribunal",
                            actorColor: "bg-blue-50 text-blue-700 border-blue-200",
                            prereq: "transmis_cours" as keyof typeof dossier,
                          },
                          {
                            key: "prononce_jugement",
                            label: "Prononcé du jugement",
                            description: "Jugement de première instance prononcé par le tribunal",
                            actor: "Tribunal",
                            actorColor: "bg-blue-50 text-blue-700 border-blue-200",
                            prereq: "dossier_en_delibere" as keyof typeof dossier,
                          },
                          {
                            key: "notification_jugement",
                            label: "Notification du jugement",
                            description: "Jugement signifié à l'abonné par l'huissier (étape critique)",
                            actor: "Huissier",
                            actorColor: "bg-amber-50 text-amber-700 border-amber-200",
                            prereq: "prononce_jugement" as keyof typeof dossier,
                          },
                        ].map(({ key, label, description, actor, actorColor, prereq }) => {
                          const value = dossier[key as keyof typeof dossier] as boolean;
                          const isHuissier = actor === "Huissier";
                          const disabled = isSuspendedStatus || !dossier[prereq];
                          return (
                            <label
                              key={key}
                              className={`flex items-center gap-4 rounded-2xl border px-4 py-3 transition-all duration-200 ${
                                disabled
                                  ? "opacity-40 cursor-not-allowed border-[#E4E7EC] bg-[#F8FAFC]"
                                  : value
                                  ? isHuissier
                                    ? "border-amber-400 bg-amber-50 cursor-pointer hover:border-amber-500 ring-2 ring-amber-100"
                                    : "border-blue-400 bg-blue-50 cursor-pointer hover:border-blue-500"
                                  : "border-[#E4E7EC] bg-[#F8FAFC] cursor-pointer hover:border-brand-300 hover:bg-white"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={value}
                                disabled={disabled}
                                onChange={(e) => updateDossierState({ [key]: e.target.checked })}
                                className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-sm font-bold ${value ? (isHuissier ? "text-amber-800" : "text-blue-800") : "text-[#334155]"}`}>
                                    {label}
                                  </span>
                                  <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${actorColor}`}>
                                    {actor}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{description}</p>
                              </div>
                              {value && <Check size={14} className={isHuissier ? "text-amber-500 shrink-0" : "text-blue-500 shrink-0"} />}
                            </label>
                          );
                        })}

                        {/* Jugement définitif */}
                        <div className={`rounded-2xl border px-4 py-4 transition-all ${!dossier.notification_jugement ? "opacity-40 border-[#E4E7EC] bg-[#F8FAFC]" : "border-emerald-300 bg-emerald-50/60"}`}>
                          <p className="text-[10px] font-black uppercase tracking-widest text-[#94A3B8] mb-3">
                            Jugement définitif — type
                          </p>
                          <div className="flex flex-wrap gap-3">
                            {[
                              { value: "par_defaut", label: "Par défaut" },
                              { value: "contradictoire", label: "Contradictoire" },
                              { value: "none", label: "Aucun" },
                            ].map((opt) => {
                              const checked = opt.value === "none" ? !dossier.jugement_definitif : dossier.jugement_definitif === opt.value;
                              const isActive = checked && dossier.notification_jugement;
                              return (
                                <label
                                  key={opt.value}
                                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-all text-xs font-bold ${
                                    !dossier.notification_jugement
                                      ? "cursor-not-allowed text-slate-400 border-slate-200 bg-white"
                                      : isActive
                                      ? "border-emerald-500 bg-emerald-100 text-emerald-800"
                                      : "border-[#E4E7EC] bg-white text-[#334155] hover:border-emerald-300"
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name="jugement_definitif"
                                    value={opt.value}
                                    checked={checked}
                                    disabled={!dossier.notification_jugement}
                                    onChange={() => updateDossierState({ jugement_definitif: opt.value === "none" ? null : opt.value as "par_defaut" | "contradictoire" })}
                                    className="h-3.5 w-3.5 text-emerald-600 border-gray-300 focus:ring-emerald-500"
                                  />
                                  {opt.label}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Groupe 3 : Phase d'Appel */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-50 text-violet-700 text-[9px] font-black uppercase tracking-wider border border-violet-200">
                            Cour d'appel
                          </span>
                          <div className="flex-1 h-px bg-violet-100" />
                        </div>
                        {[
                          {
                            key: "appel",
                            label: "Appel du jugement",
                            description: "Pourvoi en appel déposé par l'une des parties",
                            actor: "Avocat",
                            actorColor: "bg-violet-50 text-violet-700 border-violet-200",
                            prereq: "notification_jugement" as keyof typeof dossier,
                          },
                          {
                            key: "dossier_en_delibere_appel",
                            label: "Dossier en délibéré (Appel)",
                            description: "Affaire mise en délibéré devant la Cour d'appel",
                            actor: "Tribunal",
                            actorColor: "bg-violet-50 text-violet-700 border-violet-200",
                            prereq: "appel" as keyof typeof dossier,
                          },
                          {
                            key: "rendu_arret",
                            label: "Rendu de l'arrêt",
                            description: "Arrêt de la Cour d'appel prononcé",
                            actor: "Tribunal",
                            actorColor: "bg-violet-50 text-violet-700 border-violet-200",
                            prereq: "dossier_en_delibere_appel" as keyof typeof dossier,
                          },
                          {
                            key: "notification_arret",
                            label: "Notification de l'arrêt",
                            description: "Arrêt signifié à l'abonné par l'huissier de justice",
                            actor: "Huissier",
                            actorColor: "bg-amber-50 text-amber-700 border-amber-200",
                            prereq: "rendu_arret" as keyof typeof dossier,
                          },
                        ].map(({ key, label, description, actor, actorColor, prereq }) => {
                          const value = dossier[key as keyof typeof dossier] as boolean;
                          const isHuissier = actor === "Huissier";
                          const disabled = isSuspendedStatus || !dossier[prereq];
                          return (
                            <label
                              key={key}
                              className={`flex items-center gap-4 rounded-2xl border px-4 py-3 transition-all duration-200 ${
                                disabled
                                  ? "opacity-40 cursor-not-allowed border-[#E4E7EC] bg-[#F8FAFC]"
                                  : value
                                  ? isHuissier
                                    ? "border-amber-400 bg-amber-50 cursor-pointer hover:border-amber-500 ring-2 ring-amber-100"
                                    : "border-violet-400 bg-violet-50 cursor-pointer hover:border-violet-500"
                                  : "border-[#E4E7EC] bg-[#F8FAFC] cursor-pointer hover:border-brand-300 hover:bg-white"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={value}
                                disabled={disabled}
                                onChange={(e) => updateDossierState({ [key]: e.target.checked })}
                                className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-sm font-bold ${value ? (isHuissier ? "text-amber-800" : "text-violet-800") : "text-[#334155]"}`}>
                                    {label}
                                  </span>
                                  <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${actorColor}`}>
                                    {actor}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{description}</p>
                              </div>
                              {value && <Check size={14} className={isHuissier ? "text-amber-500 shrink-0" : "text-violet-500 shrink-0"} />}
                            </label>
                          );
                        })}
                      </div>

                      {/* Groupe 4 : Exécution forcée */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 text-[9px] font-black uppercase tracking-wider border border-rose-200">
                            Exécution forcée
                          </span>
                          <div className="flex-1 h-px bg-rose-100" />
                        </div>
                        {(() => {
                          const key = "execution_jugement";
                          const value = dossier.execution_jugement;
                          const prereqMet = dossier.notification_arret || !!dossier.jugement_definitif;
                          const disabled = isSuspendedStatus || !prereqMet;
                          return (
                            <label
                              className={`flex items-center gap-4 rounded-2xl border px-4 py-3 transition-all duration-200 ${
                                disabled
                                  ? "opacity-40 cursor-not-allowed border-[#E4E7EC] bg-[#F8FAFC]"
                                  : value
                                  ? "border-rose-400 bg-rose-50 cursor-pointer ring-2 ring-rose-100 hover:border-rose-500"
                                  : "border-[#E4E7EC] bg-[#F8FAFC] cursor-pointer hover:border-rose-300 hover:bg-white"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={value}
                                disabled={disabled}
                                onChange={(e) => updateDossierState({ [key]: e.target.checked })}
                                className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-sm font-bold ${value ? "text-rose-800" : "text-[#334155]"}`}>
                                    Procédures d'exécution forcée
                                  </span>
                                  <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border bg-amber-50 text-amber-700 border-amber-200">
                                    Huissier
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                                  Saisie, coupure réglementaire, recouvrement forcé de l'arrêt
                                </p>
                              </div>
                              {value && <Check size={14} className="text-rose-500 shrink-0" />}
                            </label>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="rounded-[30px] border border-[#E4E7EC] bg-[#F8FAFC] p-6">
                      <h3 className="text-xs font-black uppercase tracking-wider text-[#667085] mb-5">
                        Résumé rapide
                      </h3>
                      <div className="grid gap-3">
                        <div className="rounded-3xl bg-white border border-[#E4E7EC] p-4">
                          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#98A2B3]">
                            État actuel
                          </p>
                          <p className="mt-2 text-sm font-bold text-[#0F172A]">
                            {effectiveEtapeRecouvrement}
                          </p>
                        </div>
                        <div className="rounded-3xl bg-white border border-[#E4E7EC] p-4">
                          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#98A2B3]">
                            Héritiers connus
                          </p>
                          <p className="mt-2 text-sm text-[#475569]">
                            {dossier.liste_heritiers || "Aucun renseigné"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {dossier.has_echeancier && (
                  <div className="rounded-[30px] border border-[#E4E7EC] bg-white p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                      <div>
                        <h3 className="text-sm font-black text-[#0F172A]">
                          Échéancier
                        </h3>
                        <p className="text-xs text-[#667085]">
                          Planifiez les tranches et imprimez le document.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={buildAutomaticEcheancier}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 py-3 text-xs font-black text-white hover:bg-emerald-800 transition-colors"
                        >
                          Générer automatiquement
                        </button>
                        <button
                          type="button"
                          onClick={printEcheancier}
                          disabled={dossier.echeancier_plan.length === 0}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-black text-emerald-700 hover:bg-emerald-100 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Imprimer l'échéancier
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                        <label className="grid gap-2">
                          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#98A2B3]">
                            Date première échéance
                          </span>
                          <input
                            type="date"
                            value={installmentStartDate}
                            onChange={(e) =>
                              setInstallmentStartDate(e.target.value)
                            }
                            className="rounded-2xl border border-[#E4E7EC] bg-[#F8FAFC] px-4 py-3 text-sm font-bold focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                          />
                        </label>
                        <label className="grid gap-2">
                          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#98A2B3]">
                            Montant cible par période (DA)
                          </span>
                          <input
                            type="number"
                            min={0}
                            value={
                              installmentTargetAmount > 0
                                ? installmentTargetAmount
                                : ""
                            }
                            onChange={(e) =>
                              setInstallmentTargetAmount(
                                Math.max(0, Number(e.target.value) || 0),
                              )
                            }
                            placeholder="2000"
                            className="rounded-2xl border border-[#E4E7EC] bg-[#F8FAFC] px-4 py-3 text-sm font-bold focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                          />
                        </label>
                        <label className="grid gap-2">
                          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#98A2B3]">
                            Nombre de tranches
                          </span>
                          <input
                            type="number"
                            min={1}
                            value={installments}
                            onChange={(e) =>
                              setInstallments(
                                Math.max(1, Number(e.target.value) || 1),
                              )
                            }
                            className="rounded-2xl border border-[#E4E7EC] bg-[#F8FAFC] px-4 py-3 text-sm font-bold focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                          />
                        </label>
                        <label className="grid gap-2">
                          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#98A2B3]">
                            Intervalle (mois)
                          </span>
                          <input
                            type="number"
                            min={1}
                            value={installmentIntervalMonths}
                            onChange={(e) =>
                              setInstallmentIntervalMonths(
                                Math.max(1, Number(e.target.value) || 1),
                              )
                            }
                            className="rounded-2xl border border-[#E4E7EC] bg-[#F8FAFC] px-4 py-3 text-sm font-bold focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                          />
                        </label>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <p className="text-sm text-[#475569]">
                          Total factures impayées :{" "}
                          {factures.filter((f) => !f.date_reglement).length} ·
                          Montant total :{" "}
                          {factures
                            .filter((f) => !f.date_reglement)
                            .reduce((sum, f) => sum + f.montant, 0)
                            .toLocaleString("fr-FR")}{" "}
                          DA
                        </p>
                      </div>
                      <div className="rounded-[28px] border border-[#E4E7EC] bg-[#F8FAFC] p-4">
                        {dossier.echeancier_plan.length === 0 ? (
                          <p className="text-sm text-[#475569]">
                            Aucun échéancier généré pour le moment.
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {dossier.echeancier_plan.map((line, idx) => (
                              <div
                                key={line.id}
                                className="rounded-3xl border border-[#E4E7EC] bg-white p-4"
                              >
                                <div className="flex items-center justify-between gap-4">
                                  <div>
                                    <p className="text-[11px] uppercase tracking-[0.2em] text-[#98A2B3]">
                                      Tranche {idx + 1}
                                    </p>
                                    <p className="mt-1 text-sm font-black text-[#0F172A]">
                                      {line.date}
                                    </p>
                                  </div>
                                  <p className="text-sm font-black text-emerald-700">
                                    {calculateLineAmount(line).toFixed(2)} DA
                                  </p>
                                </div>
                                <p className="mt-3 text-xs text-[#475569]">
                                  Factures :{" "}
                                  {line.invoiceIds.join(", ") || "Aucune"}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {dossier.statut_abonne === "Décédé" && (
                  <div className="rounded-[30px] border border-[#E4E7EC] bg-[#F8FAFC] p-6">
                    <div className="flex items-center justify-between gap-4 mb-6">
                      <div>
                        <h3 className="text-sm font-black text-[#0F172A]">
                          Informations de Succession
                        </h3>
                        <p className="text-xs text-[#667085]">
                          Champs relatifs au notaire et à la créance.
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <label className="grid gap-2">
                        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#98A2B3]">
                          Nom du Notaire
                        </span>
                        <input
                          type="text"
                          value={dossier.nom_notaire}
                          onChange={(e) =>
                            setDossier({
                              ...dossier,
                              nom_notaire: e.target.value,
                            })
                          }
                          className="rounded-2xl border border-[#E4E7EC] bg-white px-4 py-3 text-sm font-bold focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                          placeholder="Ex: Maître Dupont"
                        />
                      </label>
                      <label className="grid gap-2">
                        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#98A2B3]">
                          Date déclaration de créance
                        </span>
                        <input
                          type="date"
                          value={dossier.date_declaration_creance}
                          onChange={(e) =>
                            setDossier({
                              ...dossier,
                              date_declaration_creance: e.target.value,
                            })
                          }
                          className="rounded-2xl border border-[#E4E7EC] bg-white px-4 py-3 text-sm font-bold focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                        />
                      </label>
                    </div>
                    <label className="grid gap-2 mt-4">
                      <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#98A3B8]">
                        Coordonnées du notaire
                      </span>
                      <input
                        type="text"
                        value={dossier.coordonnees_notaire}
                        onChange={(e) =>
                          setDossier({
                            ...dossier,
                            coordonnees_notaire: e.target.value,
                          })
                        }
                        className="rounded-2xl border border-[#E4E7EC] bg-white px-4 py-3 text-sm font-bold focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                        placeholder="Téléphone, adresse email..."
                      />
                    </label>
                    <label className="grid gap-2 mt-4">
                      <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#98A2B3]">
                        Liste des héritiers connus
                      </span>
                      <textarea
                        value={dossier.liste_heritiers}
                        onChange={(e) =>
                          setDossier({
                            ...dossier,
                            liste_heritiers: e.target.value,
                          })
                        }
                        className="min-h-[96px] rounded-3xl border border-[#E4E7EC] bg-white px-4 py-3 text-sm font-bold focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                        placeholder="Noms et prénoms des héritiers..."
                      />
                    </label>
                  </div>
                )}

                {dossier.statut_abonne === "Héritier" && (
                  <div className="rounded-[30px] border border-[#E4E7EC] bg-[#F8FAFC] p-6">
                    <div className="flex items-center justify-between gap-4 mb-6">
                      <div>
                        <h3 className="text-sm font-black text-[#0F172A]">
                          Liste des Héritiers
                        </h3>
                        <p className="text-xs text-[#667085]">
                          Ajoutez ou modifiez les héritiers du dossier.
                        </p>
                      </div>
                      <button
                        onClick={addHeritier}
                        className="inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-4 py-3 text-xs font-black text-white hover:bg-emerald-800 transition-colors"
                      >
                        <Plus size={14} /> Ajouter
                      </button>
                    </div>
                    {dossier.heritiers.length === 0 ? (
                      <p className="text-sm text-[#475569]">
                        Aucun héritier ajouté pour le moment.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {dossier.heritiers.map((heritier, idx) => (
                          <div
                            key={heritier.id}
                            className="rounded-[28px] border border-[#E4E7EC] bg-white p-5 space-y-4"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-[11px] uppercase tracking-[0.2em] text-[#98A2B3]">
                                  Héritier {idx + 1}
                                </p>
                                <p className="mt-1 text-sm font-black text-[#0F172A]">
                                  {heritier.nom || "Sans nom"}
                                </p>
                              </div>
                              <button
                                onClick={() => removeHeritier(heritier.id)}
                                className="rounded-full border border-red-100 bg-red-50 p-2 text-red-600 hover:bg-red-100 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                              <label className="grid gap-2">
                                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#98A2B3]">
                                  Nom complet *
                                </span>
                                <input
                                  type="text"
                                  value={heritier.nom}
                                  onChange={(e) =>
                                    updateHeritier(
                                      heritier.id,
                                      "nom",
                                      e.target.value,
                                    )
                                  }
                                  className="rounded-2xl border border-[#E4E7EC] bg-[#F8FAFC] px-4 py-3 text-sm font-bold focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                                  placeholder="Nom et prénom"
                                  required
                                />
                              </label>
                              <label className="grid gap-2">
                                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#98A2B3]">
                                  Code abonné
                                </span>
                                <input
                                  type="text"
                                  value={heritier.codeAbonne || ""}
                                  onChange={(e) =>
                                    updateHeritier(
                                      heritier.id,
                                      "codeAbonne",
                                      e.target.value,
                                    )
                                  }
                                  className="rounded-2xl border border-[#E4E7EC] bg-[#F8FAFC] px-4 py-3 text-sm font-bold focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                                  placeholder="Code abonné (optionnel)"
                                />
                              </label>
                            </div>
                            <label className="grid gap-2">
                              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#98A2B3]">
                                Adresse *
                              </span>
                              <input
                                type="text"
                                value={heritier.adresse}
                                onChange={(e) =>
                                  updateHeritier(
                                    heritier.id,
                                    "adresse",
                                    e.target.value,
                                  )
                                }
                                className="rounded-2xl border border-[#E4E7EC] bg-[#F8FAFC] px-4 py-3 text-sm font-bold focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                                placeholder="Adresse complète"
                                required
                              />
                            </label>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                              <label className="grid gap-2">
                                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#98A2B3]">
                                  Téléphone
                                </span>
                                <input
                                  type="tel"
                                  value={heritier.telephone || ""}
                                  onChange={(e) =>
                                    updateHeritier(
                                      heritier.id,
                                      "telephone",
                                      e.target.value,
                                    )
                                  }
                                  className="rounded-2xl border border-[#E4E7EC] bg-[#F8FAFC] px-4 py-3 text-sm font-bold focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                                  placeholder="Numéro de téléphone"
                                />
                              </label>
                              <label className="grid gap-2">
                                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#98A2B3]">
                                  Email
                                </span>
                                <input
                                  type="email"
                                  value={heritier.email || ""}
                                  onChange={(e) =>
                                    updateHeritier(
                                      heritier.id,
                                      "email",
                                      e.target.value,
                                    )
                                  }
                                  className="rounded-2xl border border-[#E4E7EC] bg-[#F8FAFC] px-4 py-3 text-sm font-bold focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                                  placeholder="Email (optionnel)"
                                />
                              </label>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                              <label className="grid gap-2">
                                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#98A2B3]">
                                  Numéro de pièce d'identité
                                </span>
                                <input
                                  type="text"
                                  value={heritier.numeroIdentite || ""}
                                  onChange={(e) =>
                                    updateHeritier(
                                      heritier.id,
                                      "numeroIdentite",
                                      e.target.value,
                                    )
                                  }
                                  className="rounded-2xl border border-[#E4E7EC] bg-[#F8FAFC] px-4 py-3 text-sm font-bold focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 font-mono"
                                  placeholder="Ex: 128563290140005217"
                                  maxLength={18}
                                />
                              </label>
                              <label className="grid gap-2">
                                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#98A2B3]">
                                  Lieu de délivrance
                                </span>
                                <input
                                  type="text"
                                  value={heritier.lieuDelivrance || ""}
                                  onChange={(e) =>
                                    updateHeritier(
                                      heritier.id,
                                      "lieuDelivrance",
                                      e.target.value,
                                    )
                                  }
                                  className="rounded-2xl border border-[#E4E7EC] bg-[#F8FAFC] px-4 py-3 text-sm font-bold focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                                  placeholder="Ex: Berrouaghia"
                                />
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
