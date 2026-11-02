"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, FileText, Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { apiUrlObject } from "../lib/api";
import { appendSecteurParam } from "./utils";
import { SecteurDropdown } from "./ui";

type Sector = { code: string; libelle: string };

type RecoverySubscriber = {
  numab: string;
  name: string;
  adresse: string;
  bloc: string;
  ndom: string;
  tournee: string;
  numser: string;
  nombre_creance: number;
  montant_creance: number;
  derniere_date_paiement: string;
  is_contentieux: boolean;
  active_demarche?: string | null;
};

type Invoice = {
  NUMFACT?: string;
  NUMFAC?: string;
  PERIODE?: string | number;
  DATFACT?: string;
  DATREG?: string;
  MONTTC?: string | number;
};

const PAGE_SIZE = 20;

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr");
}

function formatAmount(value: number, locale: string): string {
  const currencyLabel = locale.startsWith("ar") ? " د.ج" : " DA";
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value) + currencyLabel;
}

function formatDate(value: string | undefined): string {
  const raw = String(value ?? "").trim();
  if (/^\d{8}$/.test(raw)) {
    return `${raw.slice(6, 8)}/${raw.slice(4, 6)}/${raw.slice(0, 4)}`;
  }
  return raw || "—";
}

export function RecoveryQueueView({
  onBack,
  selectedSecteur = "",
  sectors = [],
  uniteLabel = "",
  onSecteurChange,
  sectorsLoading = false,
  allowAll = false,
}: {
  onBack: () => void;
  selectedSecteur?: string;
  sectors?: Sector[];
  uniteLabel?: string;
  onSecteurChange: (code: string) => void;
  sectorsLoading?: boolean;
  allowAll?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage?.startsWith("ar") ? "ar-DZ" : "fr-DZ";
  const isArabic = locale.startsWith("ar");
  const [subscribers, setSubscribers] = useState<RecoverySubscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selectedSubscriber, setSelectedSubscriber] = useState<RecoverySubscriber | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const invoiceRequestId = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const loadSubscribers = async () => {
      setLoading(true);
      setError(null);
      setPage(1);
      try {
        const url = apiUrlObject("/creances_abonnes");
        appendSecteurParam(url, selectedSecteur);
        const response = await fetch(url.toString(), {
          credentials: "include",
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(t("recoveryQueue.httpError", { status: response.status }));
        }
        const data = await response.json();
        if (data?.error) {
          throw new Error(t("recoveryQueue.loadError"));
        }
        const debtors = Array.isArray(data?.subscribers) ? data.subscribers : [];
        setSubscribers(
          debtors
            .filter((record: RecoverySubscriber) => Number(record.montant_creance) > 0)
            .sort((a: RecoverySubscriber, b: RecoverySubscriber) =>
              Number(b.montant_creance) - Number(a.montant_creance)
              || Number(b.nombre_creance) - Number(a.nombre_creance)
              || a.name.localeCompare(b.name, locale)
            )
        );
      } catch (loadError) {
        if (loadError instanceof Error && loadError.name === "AbortError") return;
        console.error("Erreur de chargement de la liste de recouvrement :", loadError);
        setError(
          loadError instanceof Error && loadError.name === "Error"
            ? loadError.message
            : t("recoveryQueue.loadError")
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    void loadSubscribers();
    return () => controller.abort();
  }, [selectedSecteur, t]);

  const filteredSubscribers = useMemo(() => {
    const normalizedQuery = normalizeText(query.trim());
    if (!normalizedQuery) return subscribers;
    return subscribers.filter((subscriber) =>
      [
        subscriber.numab,
        subscriber.name,
        subscriber.adresse,
        subscriber.tournee,
      ].some((value) => normalizeText(value).includes(normalizedQuery))
    );
  }, [query, subscribers]);

  const pageCount = Math.max(1, Math.ceil(filteredSubscribers.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageItems = filteredSubscribers.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );
  const totalOutstanding = useMemo(
    () => filteredSubscribers.reduce((total, item) => total + Number(item.montant_creance || 0), 0),
    [filteredSubscribers]
  );

  const openInvoices = useCallback(async (subscriber: RecoverySubscriber) => {
    const requestId = ++invoiceRequestId.current;
    setSelectedSubscriber(subscriber);
    setInvoices([]);
    setInvoiceError(null);
    setInvoiceLoading(true);
    try {
      const url = apiUrlObject("/abonne_factures");
      url.searchParams.set("numab", subscriber.numab);
      const response = await fetch(url.toString(), { credentials: "include" });
      if (!response.ok) {
        throw new Error(t("recoveryQueue.httpError", { status: response.status }));
      }
      const data = await response.json();
      if (data?.error) {
        throw new Error(t("recoveryQueue.invoicesError"));
      }
      if (!Array.isArray(data)) {
        throw new Error(t("recoveryQueue.invoicesUnavailable"));
      }
      if (requestId === invoiceRequestId.current) setInvoices(data);
    } catch (loadError) {
      if (requestId !== invoiceRequestId.current) return;
      console.error("Erreur de chargement des factures de l’abonné :", loadError);
      setInvoiceError(
        loadError instanceof Error && loadError.name === "Error"
          ? loadError.message
          : t("recoveryQueue.invoicesError")
      );
    } finally {
      if (requestId === invoiceRequestId.current) setInvoiceLoading(false);
    }
  }, [t]);

  const closeInvoices = () => {
    invoiceRequestId.current += 1;
    setSelectedSubscriber(null);
    setInvoices([]);
    setInvoiceError(null);
    setInvoiceLoading(false);
  };

  return (
    <section dir={isArabic ? "rtl" : "ltr"} className="space-y-5">
      <header className="obat-card flex flex-col gap-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={onBack}
              className="rounded-xl border border-[#E4E7EC] p-2 text-[#475467] hover:bg-[#F9FAFB]"
                aria-label={t("recoveryQueue.back")}
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-xl font-black text-[#101828]">{t("recoveryQueue.title")}</h1>
              <p className="mt-1 text-sm text-[#667085]">
                {t("recoveryQueue.description")}
              </p>
            </div>
          </div>
          <SecteurDropdown
            sectors={sectors}
            selectedSecteur={selectedSecteur}
            onSelect={onSecteurChange}
            uniteLabel={uniteLabel}
            loading={sectorsLoading}
            allowAll={allowAll}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-[#E4E7EC] bg-[#F9FAFB] px-4 py-3">
            <p className="text-xs font-semibold text-[#667085]">{t("recoveryQueue.accountsToProcess")}</p>
            <p className="mt-1 text-lg font-black text-[#101828]">
              {loading ? "…" : filteredSubscribers.length.toLocaleString(locale)}
            </p>
          </div>
          <div className="rounded-xl border border-[#E4E7EC] bg-[#F9FAFB] px-4 py-3">
            <p className="text-xs font-semibold text-[#667085]">{t("recoveryQueue.displayedDebtAmount")}</p>
            <p className="mt-1 text-lg font-black text-[#101828]">
              {loading ? "…" : formatAmount(totalOutstanding, locale)}
            </p>
          </div>
        </div>
        <label className="relative block max-w-xl">
          <Search size={16} className={`absolute ${isArabic ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 text-[#98A2B3]`} />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder={t("recoveryQueue.searchPlaceholder")}
            className={`w-full rounded-xl border border-[#E4E7EC] bg-white py-2 ${isArabic ? "pr-9 pl-3" : "pl-9 pr-3"} text-sm text-[#101828] outline-none focus:ring-2 focus:ring-blue-200`}
          />
        </label>
      </header>

      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {error}
        </div>
      )}

      <div className="obat-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm font-semibold text-[#667085]">{t("recoveryQueue.loading")}</div>
        ) : !error && pageItems.length === 0 ? (
          <div className="p-12 text-center text-sm font-semibold text-[#667085]">
            {t("recoveryQueue.noMatchingDebt")}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-start">
                <thead className="bg-[#F9FAFB] text-[10px] uppercase tracking-wider text-[#667085]">
                  <tr>
                    <th className="px-4 py-3">{t("recoveryQueue.priority")}</th>
                    <th className="px-4 py-3">{t("recoveryQueue.subscriber")}</th>
                    <th className="px-4 py-3">{t("recoveryQueue.address")}</th>
                    <th className="px-4 py-3 text-end">{t("recoveryQueue.unpaidInvoices")}</th>
                    <th className="px-4 py-3 text-end">{t("recoveryQueue.debt")}</th>
                    <th className="px-4 py-3">{t("recoveryQueue.lastPayment")}</th>
                    <th className="px-4 py-3">{t("recoveryQueue.legalFollowUp")}</th>
                    <th className="px-4 py-3"><span className="sr-only">{t("recoveryQueue.action")}</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2F4F7]">
                  {pageItems.map((subscriber, index) => {
                    const priority = (currentPage - 1) * PAGE_SIZE + index + 1;
                    return (
                      <tr key={subscriber.numab} className="hover:bg-[#F9FAFB]">
                        <td className="px-4 py-3 text-sm font-black text-[#667085]">#{priority}</td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-bold text-[#101828]">{subscriber.name || t("recoveryQueue.unknownName")}</p>
                          <p className="mt-0.5 text-xs text-[#667085]">{subscriber.numab}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-[#475467]">
                          {[subscriber.adresse, subscriber.bloc, subscriber.ndom]
                            .filter((part) => part && part !== "—")
                            .join(" ")}
                        </td>
                        <td className="px-4 py-3 text-end text-sm text-[#475467]">
                          {Number(subscriber.nombre_creance || 0).toLocaleString(locale)}
                        </td>
                        <td className="px-4 py-3 text-end text-sm font-black text-[#101828]">
                          {formatAmount(Number(subscriber.montant_creance || 0), locale)}
                        </td>
                        <td className="px-4 py-3 text-sm text-[#475467]">
                          {!subscriber.derniere_date_paiement || subscriber.derniere_date_paiement === "Aucun"
                            ? t("recoveryQueue.none")
                            : subscriber.derniere_date_paiement}
                        </td>
                        <td className="px-4 py-3 text-sm text-[#475467]">
                          {subscriber.active_demarche || (subscriber.is_contentieux ? t("recoveryQueue.litigation") : "—")}
                        </td>
                        <td className="px-4 py-3 text-end">
                          <button
                            type="button"
                            onClick={() => void openInvoices(subscriber)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[#D0D5DD] px-2.5 py-1.5 text-xs font-bold text-[#344054] hover:bg-white"
                          >
                            <FileText size={14} /> {t("recoveryQueue.invoices")}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {pageCount > 1 && (
              <div className="flex items-center justify-between border-t border-[#F2F4F7] px-4 py-3 text-sm">
                <span className="text-[#667085]">
                  {t("recoveryQueue.page", { current: currentPage, total: pageCount })}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setPage(currentPage - 1)}
                    className="rounded-lg border border-[#D0D5DD] px-3 py-1.5 font-semibold disabled:opacity-40"
                  >
                    {t("recoveryQueue.previous")}
                  </button>
                  <button
                    type="button"
                    disabled={currentPage === pageCount}
                    onClick={() => setPage(currentPage + 1)}
                    className="rounded-lg border border-[#D0D5DD] px-3 py-1.5 font-semibold disabled:opacity-40"
                  >
                    {t("recoveryQueue.next")}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {selectedSubscriber && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-3 sm:p-6"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeInvoices();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="recovery-invoices-title"
            className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <header className="flex items-start justify-between gap-4 border-b border-[#E4E7EC] p-4 sm:p-6">
              <div>
                <h2 id="recovery-invoices-title" className="text-lg font-black text-[#101828]">
                  {t("recoveryQueue.invoiceTitle", { name: selectedSubscriber.name })}
                </h2>
                <p className="mt-1 text-sm text-[#667085]">
                  {t("recoveryQueue.invoiceSummary", {
                    numab: selectedSubscriber.numab,
                    amount: formatAmount(Number(selectedSubscriber.montant_creance || 0), locale),
                  })}
                </p>
              </div>
              <button
                type="button"
                onClick={closeInvoices}
                className="rounded-lg p-2 text-[#667085] hover:bg-[#F2F4F7]"
                aria-label={t("recoveryQueue.closeInvoices")}
              >
                <X size={18} />
              </button>
            </header>
            <div className="max-h-[70vh] overflow-auto p-4 sm:p-6">
              {invoiceLoading ? (
                <p className="py-8 text-center text-sm text-[#667085]">{t("recoveryQueue.loadingInvoices")}</p>
              ) : invoiceError ? (
                <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{invoiceError}</p>
              ) : invoices.length === 0 ? (
                <p className="py-8 text-center text-sm text-[#667085]">{t("recoveryQueue.noInvoices")}</p>
              ) : (
                <table className="w-full min-w-[600px] text-start text-sm">
                  <thead className="bg-[#F9FAFB] text-xs text-[#667085]">
                    <tr>
                      <th className="px-3 py-2">{t("recoveryQueue.reference")}</th>
                      <th className="px-3 py-2">{t("recoveryQueue.period")}</th>
                      <th className="px-3 py-2">{t("recoveryQueue.date")}</th>
                      <th className="px-3 py-2 text-end">{t("recoveryQueue.amount")}</th>
                      <th className="px-3 py-2">{t("recoveryQueue.status")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F2F4F7]">
                    {invoices.map((invoice, index) => (
                      <tr key={`${invoice.NUMFACT || invoice.NUMFAC || "facture"}-${index}`}>
                        <td className="px-3 py-2">{invoice.NUMFACT || invoice.NUMFAC || "—"}</td>
                        <td className="px-3 py-2">{invoice.PERIODE || "—"}</td>
                        <td className="px-3 py-2">{formatDate(invoice.DATFACT)}</td>
                        <td className="px-3 py-2 text-end">
                          {formatAmount(Number(invoice.MONTTC || 0), locale)}
                        </td>
                        <td className="px-3 py-2">
                          {invoice.DATREG && !["00000000", "19000101"].includes(invoice.DATREG.trim())
                            ? t("recoveryQueue.paidOn", { date: formatDate(invoice.DATREG) })
                            : t("recoveryQueue.unpaid")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
