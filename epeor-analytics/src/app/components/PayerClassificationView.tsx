"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Printer } from "lucide-react";
import { apiUrl, apiUrlObject } from "../lib/api";

type PayerRecord = {
  numab: string;
  name: string;
  commune: string;
  level: number;
  classification: string;
  last_payment: string | null;
  days_since_last_payment: number | null;
  average_gap_days: number | null;
  maximum_gap_days: number | null;
  payment_count: number;
};

type SubscriberInvoice = {
  DATFACT?: string;
  DATREG?: string;
  PERIODE?: string;
  MONTTC?: number | string;
  MODALITE?: string;
  TYPE?: string;
  NUMREC?: string;
};

const PAGE_SIZE = 20;
const LEVEL_STYLES: Record<number, string> = {
  1: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  2: "bg-lime-50 text-lime-700 ring-lime-200",
  3: "bg-amber-50 text-amber-700 ring-amber-200",
  4: "bg-orange-50 text-orange-700 ring-orange-200",
  5: "bg-rose-50 text-rose-700 ring-rose-200",
};

export function PayerClassificationView({ selectedSecteur = "" }: { selectedSecteur?: string }) {
  const [records, setRecords] = useState<PayerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("all");
  const [page, setPage] = useState(0);
  const [expandedNumab, setExpandedNumab] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<SubscriberInvoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [invoicesError, setInvoicesError] = useState<string | null>(null);
  const [invoiceFilter, setInvoiceFilter] = useState<"ALL" | "PAID" | "UNPAID">("ALL");
  const [invoicePage, setInvoicePage] = useState(1);

  useEffect(() => {
    const controller = new AbortController();
    const url = apiUrlObject("/payer_classification");
    if (selectedSecteur) url.searchParams.set("secteur", selectedSecteur);

    setLoading(true);
    setError(null);
    setPage(0);
    fetch(url.toString(), { credentials: "include", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.detail || "Impossible de charger le classement des payeurs.");
        }
        if (!payload.ready || !Array.isArray(payload.records)) {
          throw new Error("La réponse du classement des payeurs est invalide.");
        }
        setRecords(payload.records);
      })
      .catch((fetchError: unknown) => {
        if (controller.signal.aborted) return;
        setError(fetchError instanceof Error ? fetchError.message : "Erreur lors du chargement du classement.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [selectedSecteur]);

  useEffect(() => {
    if (!expandedNumab) return;

    const controller = new AbortController();
    setInvoices([]);
    setInvoicesError(null);
    setInvoicesLoading(true);
    fetch(apiUrl(`/abonne_factures?numab=${encodeURIComponent(expandedNumab)}`), {
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.detail || "Impossible de charger les factures de cet abonné.");
        }
        if (!Array.isArray(payload)) {
          throw new Error(payload.message || payload.error || "La réponse des factures est invalide.");
        }
        setInvoices(payload);
      })
      .catch((fetchError: unknown) => {
        if (controller.signal.aborted) return;
        setInvoicesError(fetchError instanceof Error ? fetchError.message : "Erreur lors du chargement des factures.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setInvoicesLoading(false);
      });

    return () => controller.abort();
  }, [expandedNumab]);

  const counts = useMemo(
    () => records.reduce((total, record) => {
      total[record.level] = (total[record.level] ?? 0) + 1;
      return total;
    }, {} as Record<number, number>),
    [records],
  );

  const filteredRecords = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("fr");
    return records.filter((record) => {
      if (selectedLevel !== "all" && record.level !== Number(selectedLevel)) return false;
      if (!normalizedSearch) return true;
      return `${record.numab} ${record.name} ${record.commune}`.toLocaleLowerCase("fr").includes(normalizedSearch);
    });
  }, [records, search, selectedLevel]);

  const pageCount = Math.ceil(filteredRecords.length / PAGE_SIZE);
  const visibleRecords = filteredRecords.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const selectedRecord = records.find((record) => record.numab === expandedNumab) ?? null;
  const firstVisibleRecord = filteredRecords.length ? page * PAGE_SIZE + 1 : 0;
  const lastVisibleRecord = Math.min((page + 1) * PAGE_SIZE, filteredRecords.length);
  const filteredInvoices = useMemo(() => invoices.filter((invoice) => {
    const paidDate = String(invoice.DATREG ?? "").trim();
    const isPaid = Boolean(paidDate && !["00000000", "19000101"].includes(paidDate));
    return invoiceFilter === "ALL" || (invoiceFilter === "PAID" ? isPaid : !isPaid);
  }), [invoices, invoiceFilter]);
  const invoicePageCount = Math.max(1, Math.ceil(filteredInvoices.length / PAGE_SIZE));
  const visibleInvoices = filteredInvoices.slice((invoicePage - 1) * PAGE_SIZE, invoicePage * PAGE_SIZE);
  const invoiceTotals = useMemo(() => invoices.reduce((totals, invoice) => {
    const paidDate = String(invoice.DATREG ?? "").trim();
    const isPaid = Boolean(paidDate && !["00000000", "19000101"].includes(paidDate));
    const amount = Number(invoice.MONTTC) || 0;
    if (isPaid) {
      totals.paidAmount += amount;
      totals.paidCount += 1;
    } else {
      totals.unpaidAmount += amount;
      totals.unpaidCount += 1;
    }
    return totals;
  }, { paidAmount: 0, paidCount: 0, unpaidAmount: 0, unpaidCount: 0 }), [invoices]);
  const firstVisibleInvoice = filteredInvoices.length ? (invoicePage - 1) * PAGE_SIZE + 1 : 0;
  const lastVisibleInvoice = Math.min(invoicePage * PAGE_SIZE, filteredInvoices.length);
  const formatDate = (value: string | null) => value
    ? new Intl.DateTimeFormat("fr-FR").format(new Date(`${value}T00:00:00`))
    : "Aucun paiement";
  const formatInvoiceDate = (value?: string) => {
    const raw = String(value ?? "").trim();
    if (/^\d{8}$/.test(raw)) return `${raw.slice(6, 8)}/${raw.slice(4, 6)}/${raw.slice(0, 4)}`;
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return new Intl.DateTimeFormat("fr-FR").format(new Date(`${raw.slice(0, 10)}T00:00:00`));
    return "—";
  };
  const formatAmount = (value?: number | string) => {
    const amount = Number(value);
    return Number.isFinite(amount)
      ? `${amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DA`
      : "—";
  };
  const formatInvoicePeriod = (invoice: SubscriberInvoice) => {
    const raw = String(invoice.DATFACT ?? "").trim();
    if (!/^\d{8}$/.test(raw)) return formatInvoiceDate(raw);
    const year = raw.slice(0, 4);
    const month = raw.slice(4, 6);
    if (String(invoice.PERIODE ?? "").trim() === "3") {
      const quarter = { "03": "1er Trim", "06": "2ème Trim", "09": "3ème Trim", "12": "4ème Trim" }[month];
      if (quarter) return `${quarter} ${year}`;
    }
    return `${month}-${year}`;
  };
  const formatInvoiceReference = (invoice: SubscriberInvoice) => {
    const raw = String(invoice.DATFACT ?? "").trim();
    return /^\d{8}$/.test(raw) ? `${raw.slice(4, 6)}-${raw.slice(0, 4)}/${invoice.TYPE || ""}` : "—";
  };
  const isInvoicePaid = (invoice: SubscriberInvoice) => {
    const paidDate = String(invoice.DATREG ?? "").trim();
    return Boolean(paidDate && !["00000000", "19000101"].includes(paidDate));
  };

  return (
    <section className="space-y-6">
      {selectedRecord ? (
        <div className="overflow-hidden rounded-[2rem] border border-[#E4E7EC] bg-white shadow-sm animate-in fade-in duration-300">
          <div className="overflow-x-auto">
            <div className="flex min-w-[900px] flex-col">
              <div className="flex flex-col items-start justify-between gap-4 border-b border-[#F2F4F7] bg-[#F9FAFB] p-6 md:flex-row md:items-center">
                <div>
                  <button
                    type="button"
                    onClick={() => setExpandedNumab(null)}
                    className="mb-3 flex items-center gap-2 text-sm font-bold text-[#667085] transition-colors hover:text-[#101828]"
                  >
                    <ArrowLeft size={16} /> Retour à la liste
                  </button>
                  <h3 className="text-lg font-black text-[#101828]">Historique des factures</h3>
                  <p className="mt-1 text-xs font-medium text-[#667085]">
                    {selectedRecord.name} <span className="mx-1">·</span> NUMAB {selectedRecord.numab} <span className="mx-1">·</span> {selectedRecord.commune}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label htmlFor="payer-invoice-filter" className="text-[11px] font-bold uppercase tracking-wider text-[#667085]">Filtrer :</label>
                  <select
                    id="payer-invoice-filter"
                    value={invoiceFilter}
                    onChange={(event) => { setInvoiceFilter(event.target.value as "ALL" | "PAID" | "UNPAID"); setInvoicePage(1); }}
                    className="cursor-pointer rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-xs font-bold text-[#101828] shadow-sm outline-none transition focus:border-[#0D83DE] focus:ring-2 focus:ring-[#0D83DE]/20"
                  >
                    <option value="ALL">Toutes les factures</option>
                    <option value="PAID">Factures payées</option>
                    <option value="UNPAID">Factures impayées</option>
                  </select>
                  <span className="mx-1 hidden h-6 w-px bg-[#E4E7EC] sm:block" />
                  <button
                    type="button"
                    onClick={() => window.print()}
                    disabled={invoicesLoading || filteredInvoices.length === 0}
                    className="flex items-center gap-1.5 rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-xs font-bold text-[#475467] shadow-sm transition-colors hover:bg-gray-50 hover:text-[#101828] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Printer size={14} /> Imprimer
                  </button>
                </div>
              </div>

              {invoicesLoading ? (
                <div role="status" className="flex min-h-56 items-center justify-center gap-3">
                  <div className="spinner-premium" style={{ width: 40, height: 40 }} />
                  <span className="text-sm font-medium text-[#667085]">Chargement des factures…</span>
                </div>
              ) : invoicesError ? (
                <p role="alert" className="px-6 py-12 text-center text-sm font-medium text-rose-700">{invoicesError}</p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-[#F9FAFB] text-[11px] font-bold uppercase tracking-wider text-[#475467]">
                          <th className="border-b border-[#F2F4F7] px-6 py-5">Période</th>
                          <th className="border-b border-[#F2F4F7] px-6 py-5">Référence</th>
                          <th className="border-b border-[#F2F4F7] px-6 py-5">Type</th>
                          <th className="border-b border-[#F2F4F7] px-6 py-5 text-right">Montant TTC</th>
                          <th className="border-b border-[#F2F4F7] px-6 py-5 text-right">Date règlement</th>
                          <th className="border-b border-[#F2F4F7] px-6 py-5 text-right">Modalité</th>
                          <th className="border-b border-[#F2F4F7] px-6 py-5 text-center">Statut</th>
                          <th className="border-b border-[#F2F4F7] px-6 py-5 text-right">N° reçu</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F2F4F7]">
                        {visibleInvoices.map((invoice, invoiceIndex) => {
                          const isPaid = isInvoicePaid(invoice);
                          return (
                            <tr key={`${invoice.DATFACT ?? "facture"}-${invoiceIndex}`} className="transition-colors hover:bg-[#F9FAFB]">
                              <td className="px-6 py-4 font-bold text-[13px] text-[#101828]">{formatInvoicePeriod(invoice)}</td>
                              <td className="px-6 py-4 font-mono text-[13px] font-medium text-[#0D83DE]">{formatInvoiceReference(invoice)}</td>
                              <td className="px-6 py-4 text-[13px] font-medium text-[#667085]">{invoice.TYPE || "—"}</td>
                              <td className="px-6 py-4 text-right text-[13px] font-black text-[#101828]">{formatAmount(invoice.MONTTC)}</td>
                              <td className="px-6 py-4 text-right text-[13px] font-medium text-[#475467]">{isPaid ? formatInvoiceDate(invoice.DATREG) : "—"}</td>
                              <td className="px-6 py-4 text-right text-[13px] font-medium text-[#667085]">{invoice.MODALITE || "—"}</td>
                              <td className="px-6 py-4 text-center">
                                <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-bold uppercase ${isPaid ? "border-emerald-100 bg-emerald-50 text-emerald-600" : "border-rose-100 bg-rose-50 text-rose-600"}`}>
                                  {isPaid ? "Payé" : "Impayé"}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right font-mono text-[12px] text-[#667085]">{invoice.NUMREC || "—"}</td>
                            </tr>
                          );
                        })}
                        {filteredInvoices.length === 0 && (
                          <tr><td colSpan={8} className="px-6 py-12 text-center font-medium text-[#667085]">Aucune facture trouvée avec ce filtre.</td></tr>
                        )}
                      </tbody>
                      {filteredInvoices.length > 0 && (
                        <tfoot>
                          <tr className="border-t border-[#E4E7EC] bg-emerald-50/40 font-bold">
                            <td colSpan={3} className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-emerald-800">Total factures payées</td>
                            <td className="px-6 py-4 text-right font-mono text-[13px] font-black text-emerald-700">{formatAmount(invoiceTotals.paidAmount)}</td>
                            <td colSpan={4} className="px-6 py-4 text-xs font-medium text-emerald-600">({invoiceTotals.paidCount} facture{invoiceTotals.paidCount === 1 ? "" : "s"})</td>
                          </tr>
                          <tr className="border-t border-[#E4E7EC] bg-rose-50/40 font-bold">
                            <td colSpan={3} className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-rose-800">Total factures impayées</td>
                            <td className="px-6 py-4 text-right font-mono text-[13px] font-black text-rose-700">{formatAmount(invoiceTotals.unpaidAmount)}</td>
                            <td colSpan={4} className="px-6 py-4 text-xs font-medium text-rose-600">({invoiceTotals.unpaidCount} facture{invoiceTotals.unpaidCount === 1 ? "" : "s"})</td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                  <div className="flex flex-col items-start justify-between gap-3 border-t border-[#F2F4F7] bg-[#F9FAFB] px-6 py-4 sm:flex-row sm:items-center">
                    <p className="text-xs font-bold text-[#667085]">
                      Affichage {firstVisibleInvoice}–{lastVisibleInvoice} sur <span className="text-[#101828]">{filteredInvoices.length.toLocaleString("fr-FR")}</span> factures
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setInvoicePage((current) => Math.max(1, current - 1))}
                        disabled={invoicePage <= 1}
                        className="rounded-xl border border-[#D0D5DD] bg-white px-4 py-2 text-xs font-bold transition-colors hover:bg-[#F2F4F7] disabled:opacity-40"
                      >
                        ← Précédent
                      </button>
                      <span className="px-3 py-2 text-xs font-bold text-[#475467]">Page {invoicePage} / {invoicePageCount}</span>
                      <button
                        type="button"
                        onClick={() => setInvoicePage((current) => Math.min(invoicePageCount, current + 1))}
                        disabled={invoicePage >= invoicePageCount}
                        className="rounded-xl border border-[#D0D5DD] bg-white px-4 py-2 text-xs font-bold transition-colors hover:bg-[#F2F4F7] disabled:opacity-40"
                      >
                        Suivant →
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
      <div className="rounded-2xl border border-[#E4E7EC] bg-white p-6 shadow-sm sm:p-8">
        <h3 className="text-2xl font-black text-[#101828]">Classement des payeurs</h3>
        <p className="mt-2 max-w-3xl text-sm text-[#667085]">
          Classement basé sur le pire résultat entre l’intervalle moyen des paiements et le nombre de jours depuis le dernier paiement.
          Les dates de paiement sont dédupliquées par jour.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {[
            "Bon payeur",
            "Payeur régulier",
            "Retardataire",
            "Mauvais payeur",
            "Non payeur",
          ].map((label, index) => (
            <div key={label} className="rounded-xl border border-[#EAECF0] bg-[#FCFCFD] p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#667085]">{index + 1} · {label}</p>
              <p className="mt-2 text-2xl font-black text-[#101828]">{(counts[index + 1] ?? 0).toLocaleString("fr-FR")}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-[0_8px_30px_rgba(16,24,40,0.06)]">
        <div className="flex flex-col gap-4 border-b border-[#EAECF0] bg-gradient-to-r from-[#F8FBFF] to-white p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h4 className="text-lg font-black text-[#101828]">Détail par abonné</h4>
            <p className="mt-1 text-xs font-medium text-[#667085]">
              {filteredRecords.length.toLocaleString("fr-FR")} abonné{filteredRecords.length === 1 ? "" : "s"} · {PAGE_SIZE} par page
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="search"
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(0); }}
              placeholder="Rechercher un abonné ou une commune"
              aria-label="Rechercher un abonné ou une commune"
              className="min-h-10 rounded-xl border border-[#D0D5DD] bg-white px-3.5 text-sm shadow-sm outline-none transition focus:border-[#0D83DE] focus:ring-4 focus:ring-blue-100"
            />
            <select
              value={selectedLevel}
              onChange={(event) => { setSelectedLevel(event.target.value); setPage(0); }}
              aria-label="Filtrer par classement"
              className="min-h-10 rounded-xl border border-[#D0D5DD] bg-white px-3.5 text-sm shadow-sm outline-none transition focus:border-[#0D83DE] focus:ring-4 focus:ring-blue-100"
            >
              <option value="all">Tous les degrés</option>
              {["Bon payeur", "Payeur régulier", "Retardataire", "Mauvais payeur", "Non payeur"].map((label, index) => (
                <option key={label} value={index + 1}>{index + 1} · {label}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div role="status" className="flex h-56 flex-col items-center justify-center gap-4">
            <div className="spinner-premium" style={{ width: 40, height: 40 }} />
            <p className="text-sm font-medium text-[#667085]">Chargement du classement des payeurs…</p>
          </div>
        ) : error ? (
          <p role="alert" className="p-10 text-center text-sm font-medium text-rose-700">{error}</p>
        ) : filteredRecords.length === 0 ? (
          <p className="p-10 text-center text-sm font-medium text-[#667085]">Aucun abonné ne correspond à ces critères.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-left text-sm">
                <thead className="bg-[#F2F6FB] text-[10px] uppercase tracking-[0.08em] text-[#475467]">
                  <tr className="border-b border-[#E4EAF1]">
                    <th className="w-16 px-5 py-4 text-right font-extrabold">N°</th>
                    <th className="px-5 py-4 font-extrabold">NUMAB</th>
                    <th className="px-5 py-4 font-extrabold">Abonné</th>
                    <th className="px-5 py-4 font-extrabold">Commune</th>
                    <th className="px-5 py-4 text-right font-extrabold">Dernier paiement</th>
                    <th className="px-5 py-4 text-right font-extrabold">Jours écoulés</th>
                    <th className="px-5 py-4 text-right font-extrabold">Écart moyen</th>
                    <th className="px-5 py-4 text-right font-extrabold">Écart maximum</th>
                    <th className="px-5 py-4 text-right font-extrabold">Paiements</th>
                    <th className="px-5 py-4 font-extrabold">Degré</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF1F5]">
                  {visibleRecords.map((record, index) => (
                    <tr
                      key={record.numab}
                      onClick={() => { setInvoiceFilter("ALL"); setInvoicePage(1); setExpandedNumab(record.numab); }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setInvoiceFilter("ALL");
                          setInvoicePage(1);
                          setExpandedNumab((current) => current === record.numab ? null : record.numab);
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-expanded={expandedNumab === record.numab}
                      className="cursor-pointer transition-colors odd:bg-white even:bg-[#FBFCFE] hover:bg-[#F1F7FF] focus:bg-[#F1F7FF] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#0D83DE]"
                    >
                      <td className="px-5 py-4 text-right font-mono text-xs text-[#667085]">
                        {(page * PAGE_SIZE + index + 1).toLocaleString("fr-FR")}
                      </td>
                      <td className="px-5 py-4 font-mono text-xs font-bold text-[#344054]">{record.numab}</td>
                      <td className="px-5 py-4">
                        <div className="font-bold text-[#101828]">{record.name}</div>
                      </td>
                      <td className="px-5 py-4 font-medium text-[#344054]">{record.commune}</td>
                      <td className="px-5 py-4 text-right font-medium tabular-nums text-[#344054]">{formatDate(record.last_payment)}</td>
                      <td className="px-5 py-4 text-right font-bold tabular-nums text-[#101828]">
                        {record.days_since_last_payment == null ? "—" : `${record.days_since_last_payment} j`}
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums text-[#344054]">
                        {record.average_gap_days == null ? "—" : `${record.average_gap_days} j`}
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums text-[#344054]">
                        {record.maximum_gap_days == null ? "—" : `${record.maximum_gap_days} j`}
                      </td>
                      <td className="px-5 py-4 text-right font-semibold tabular-nums text-[#344054]">{record.payment_count.toLocaleString("fr-FR")}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-extrabold ring-1 ring-inset ${LEVEL_STYLES[record.level] ?? LEVEL_STYLES[5]}`}>
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/70 text-[10px]">{record.level}</span>
                          {record.classification}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pageCount > 1 && (
              <div className="flex flex-col gap-3 border-t border-[#EAECF0] bg-[#FCFCFD] px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span className="font-medium text-[#667085]">
                  Affichage <span className="font-bold text-[#344054]">{firstVisibleRecord}–{lastVisibleRecord}</span> sur{" "}
                  <span className="font-bold text-[#344054]">{filteredRecords.length.toLocaleString("fr-FR")}</span> abonnés
                </span>
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <span className="text-xs font-semibold text-[#667085]">Page {page + 1} / {pageCount}</span>
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.max(0, current - 1))}
                    disabled={page === 0}
                    aria-label="Page précédente"
                    className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#D0D5DD] bg-white px-3 font-semibold text-[#344054] shadow-sm transition hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft size={16} /> Précédent
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
                    disabled={page >= pageCount - 1}
                    aria-label="Page suivante"
                    className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#D0D5DD] bg-white px-3 font-semibold text-[#344054] shadow-sm transition hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Suivant <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
        </>
      )}
    </section>
  );
}
