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

  const [dossier, setDossier] = useState({
    statut_abonne: "Actif",
    etape_recouvrement: "Amiable",
    has_mise_en_demeure: false,
    has_echeancier: false,
    transmis_huissier: false,
    transmis_cours: false,
    execution_jugement: false,
    nom_notaire: "",
    coordonnees_notaire: "",
    liste_heritiers: "",
    date_declaration_creance: "",
    motif: "",
    echeancier_plan: [] as EcheanceLine[],
    heritiers: [] as Heritier[],
  });

  const sanitizeDossierForStatus = useCallback(
    (values: Partial<typeof dossier>) => {
      if (values.statut_abonne === "Suspendu") {
        return {
          ...values,
          has_mise_en_demeure: false,
          has_echeancier: false,
          transmis_huissier: false,
          transmis_cours: false,
          execution_jugement: false,
        };
      }
      return values;
    },
    [],
  );

  const deriveEtapeRecouvrement = useCallback(
    (values: Partial<typeof dossier>) => {
    if (values.statut_abonne === "Suspendu") {
      return "Suspendu";
    }
    if (values.execution_jugement) {
      return "Exécution de Jugement";
    }
    if (values.transmis_huissier) {
      return "Transmis Huissier";
    }
    if (values.transmis_cours) {
      return "Tribunal";
    }
    if (values.statut_abonne === "Décédé") {
      return "Transmis Huissier";
    }
      if (values.has_mise_en_demeure || values.has_echeancier) {
        return "Amiable";
      }
      return values.etape_recouvrement || "Amiable";
    },
    [],
  );

  const updateDossierState = (updates: Partial<typeof dossier>) => {
    setDossier((current) => {
      const next = sanitizeDossierForStatus({ ...current, ...updates });
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
    "Mise en demeure",
    "Transmis Huissier",
    "Tribunal",
    "Exécution de Jugement",
  ];
  const isSuspendedStatus = dossier.statut_abonne === "Suspendu";
  const effectiveEtapeRecouvrement = deriveEtapeRecouvrement(dossier);
  const currentStepIndex = steps.indexOf(effectiveEtapeRecouvrement);

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
              <p className="text-sm text-[#667085] mt-1 font-medium">
                Abonné {abonne.numab} — {abonne.name}
              </p>
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
                <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
                  <div className="rounded-[30px] border border-[#E4E7EC] bg-[#F8FAFC] p-6 space-y-6">
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-[#667085] mb-4">
                        Étape du recouvrement
                      </h3>
                      <div className="relative">
                        <div className="absolute inset-y-1/2 left-0 right-0 h-1 bg-[#E2E8F0] rounded-full" />
                        <div
                          className="absolute inset-y-1/2 left-0 h-1 bg-brand-500 rounded-full transition-all duration-500"
                          style={{
                            width: `${(Math.max(0, currentStepIndex) / (steps.length - 1)) * 100}%`,
                          }}
                        />
                        <div className="relative flex flex-wrap justify-between gap-3">
                          {steps.map((step, idx) => {
                            const isCompleted = idx <= currentStepIndex;
                            return (
                              <button
                                key={step}
                                type="button"
                                onClick={() =>
                                  updateDossierState({ etape_recouvrement: step })
                                }
                                className="relative flex flex-col items-center gap-2 bg-white/70 rounded-full p-2"
                              >
                                <span
                                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${isCompleted ? "border-brand-500 bg-brand-500 text-white" : "border-[#CBD5E1] bg-white text-[#94A3B8]"}`}
                                >
                                  {isCompleted ? <Check size={14} /> : idx + 1}
                                </span>
                                <span
                                  className={`text-[10px] font-black text-center ${isCompleted ? "text-brand-700" : "text-[#94A3B8]"}`}
                                >
                                  {step}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {steps.map((step, idx) => (
                        <div
                          key={step}
                          className="rounded-3xl border border-[#E4E7EC] bg-white p-4"
                        >
                          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-[#98A2B3]">
                            {step}
                          </p>
                          <p className="mt-3 text-sm font-bold text-[#334155]">
                            {idx <= currentStepIndex
                              ? "Terminé"
                              : idx === currentStepIndex + 1
                                ? "Actif"
                                : "À venir"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="rounded-[30px] border border-[#E4E7EC] bg-white p-6">
                      <h3 className="text-xs font-black uppercase tracking-wider text-[#667085] mb-5">
                        Statut du dossier
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-black uppercase tracking-wider text-[#94A3B8] mb-2">
                            Statut de l'abonné
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
                            className="w-full rounded-2xl border border-[#E4E7EC] bg-[#F8FAFC] px-4 py-3 text-sm font-bold text-[#0F172A] focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                          >
                            <option value="Actif">Actif</option>
                            <option value="Suspendu">Suspendu</option>
                            <option value="Décédé">Décédé</option>
                            <option value="Héritier">Héritier</option>
                          </select>
                        </div>
                        {isSuspendedStatus && (
                          <label className="grid gap-2">
                            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#98A2B3]">
                              Motif de suspension <span className="text-red-500">*</span>
                            </span>
                            <textarea
                              value={dossier.motif}
                              onChange={(e) => {
                                setDossier({
                                  ...dossier,
                                  motif: e.target.value,
                                });
                                if (motifError) {
                                  setMotifError("");
                                }
                              }}
                              className={`min-h-[96px] rounded-3xl border bg-white px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 ${motifError ? "border-red-300 focus:border-red-500 focus:ring-red-100" : "border-[#E4E7EC] focus:border-brand-500 focus:ring-brand-100"}`}
                              placeholder="Ex : Paiement non effectué, changement de situation..."
                            />
                            {motifError ? (
                              <p className="text-xs font-semibold text-red-600">
                                {motifError}
                              </p>
                            ) : (
                              <p className="text-xs text-[#667085]">
                                Le motif est obligatoire pour un dossier suspendu.
                              </p>
                            )}
                          </label>
                        )}
                        {isSuspendedStatus && (
                          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-700">
                            Aucune démarche ne peut être attribuée lorsque le dossier est suspendu.
                          </div>
                        )}
                        <div className="grid grid-cols-1 gap-3">
                          {[
                            {
                              key: "has_mise_en_demeure",
                              label: "Mise en demeure envoyée",
                              color: "amber",
                            },
                            {
                              key: "has_echeancier",
                              label: "Échéancier accordé",
                              color: "emerald",
                            },
                            {
                              key: "transmis_huissier",
                              label: "Transmis au huissier",
                              color: "violet",
                            },
                            {
                              key: "transmis_cours",
                              label: "Transmis à la cour",
                              color: "rose",
                            },
                            {
                              key: "execution_jugement",
                              label: "Exécution de Jugement",
                              color: "amber",
                            },
                          ].map(({ key, label }) => {
                            const value = dossier[
                              key as keyof typeof dossier
                            ] as boolean;
                            return (
                              <label
                                key={key}
                                className="flex items-center gap-3 rounded-2xl border border-[#E4E7EC] bg-[#F8FAFC] px-4 py-3 cursor-pointer transition-colors hover:border-brand-300"
                              >
                                <input
                                  type="checkbox"
                                  checked={value}
                                  disabled={isSuspendedStatus}
                                  onChange={(e) =>
                                    updateDossierState({ [key]: e.target.checked })
                                  }
                                  className="h-4 w-4 rounded-md border-gray-300 text-brand-600 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
                                />
                                <span className="text-sm font-bold text-[#334155]">
                                  {label}
                                </span>
                              </label>
                            );
                          })}
                        </div>
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
