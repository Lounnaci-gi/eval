"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowUp, ArrowDown, ArrowUpDown, ClipboardCheck, Copy, RefreshCw } from "lucide-react";
import { apiUrl } from "../lib/api";

type TourneeStatus = 1 | 2 | 3 | 4 | 5;

type TourneeRow = {
  UNITE: string;
  CENTRE: string;
  TOURNEE: string;
  RELEVEUR: string;
  DATFACT: string;
  DATEPREVUE: string;
  DATERELEVE: string;
  DEB_SAISIE: string;
  EDITCTL: string;
  EDITFAC: string;
  jours_retard: number;
  code: TourneeStatus;
};

type AnalysisData = {
  date_systeme: string;
  active_datfact: string;
  available_datfacts: string[];
  total_tournees: number;
  tournees_periode_active: number;
  counts: Record<string, number>;
  tournees: TourneeRow[];
  bilan_tournees: string;
};

type TourneeColumnKey = keyof TourneeRow | "observation";
type TourneeSortKey = TourneeColumnKey | "code";

const statusLabels: Record<TourneeStatus, string> = {
  1: "Date prévue dépassée",
  2: "Relevé en attente de saisie",
  3: "Relevé en attente de contrôle",
  4: "En attente d’édition",
  5: "En attente de paiement",
};

const columns: { key: TourneeColumnKey; label: string }[] = [
  { key: "CENTRE", label: "Centre" },
  { key: "TOURNEE", label: "Tournée" },
  { key: "observation", label: "Observation" },
  { key: "DATEPREVUE", label: "Date prévue" },
  { key: "DATERELEVE", label: "Date relevé" },
  { key: "DEB_SAISIE", label: "Début saisie" },
  { key: "EDITCTL", label: "Édition contrôle" },
  { key: "EDITFAC", label: "Édition facture" },
];

const formatTourneeDate = (value: string) =>
  value.length === 8
    ? `${value.slice(6, 8)}/${value.slice(4, 6)}/${value.slice(0, 4)}`
    : "date inconnue";

const formatTourneeDelay = (days: number) =>
  `${days} jour${days === 1 ? "" : "s"}`;

const getTourneeObservation = (tour: TourneeRow) => {
  const delay = formatTourneeDelay(tour.jours_retard);
  switch (tour.code) {
    case 1:
      return `Relevé non effectué depuis la date prévue du ${formatTourneeDate(tour.DATEPREVUE)} (${delay}).`;
    case 2:
      return `Saisie en attente depuis le relevé du ${formatTourneeDate(tour.DATERELEVE)} (${delay}).`;
    case 3:
      return `Contrôle en attente depuis le début de saisie du ${formatTourneeDate(tour.DEB_SAISIE)} (${delay}).`;
    case 4:
      return `Édition en attente depuis le contrôle du ${formatTourneeDate(tour.EDITCTL)} (${delay}).`;
    case 5:
      return `Aucun paiement constaté pour le DATFACT ${tour.DATFACT} depuis l’édition du ${formatTourneeDate(tour.EDITFAC)} (${delay}).`;
  }
};

const getTourneeColumnValue = (tour: TourneeRow, key: TourneeColumnKey) =>
  key === "observation"
    ? getTourneeObservation(tour)
    : String(tour[key] || "—");

export function AnalysesReleveView({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<AnalysisData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<Partial<Record<TourneeColumnKey, string>>>({});
  const [selectedDatfact, setSelectedDatfact] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [filterPeriod, setFilterPeriod] = useState("");
  const [sortKey, setSortKey] = useState<TourneeSortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [copyError, setCopyError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const periodQuery = selectedDatfact
      ? `?datfact=${encodeURIComponent(selectedDatfact)}`
      : "";
    fetch(apiUrl(`/api/analyses_releve${periodQuery}`), {
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.detail || "Le chargement des analyses a échoué.");
        }
        setData(result);
        setFilterYear((year) => year || result.active_datfact.slice(0, 4) || "all");
        setFilterPeriod((period) => period || result.active_datfact.slice(4, 6) || "all");
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "Une erreur est survenue.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [selectedDatfact]);

  const normalizedGlobalFilter = globalFilter.trim().toLowerCase();
  const visibleTours = (data?.tournees ?? []).filter((tour) => {
    if (statusFilter !== "all" && String(tour.code) !== statusFilter) return false;

    const columnValues = columns.map(({ key }) => getTourneeColumnValue(tour, key));
    const alertValue = `${tour.code} ${statusLabels[tour.code]}`;
    if (
      normalizedGlobalFilter &&
      ![alertValue, ...columnValues].join(" ").toLowerCase().includes(normalizedGlobalFilter)
    ) {
      return false;
    }

    return columns.every(({ key }, index) => {
      const filter = columnFilters[key]?.trim().toLowerCase();
      return !filter || columnValues[index].toLowerCase().includes(filter);
    });
  }).sort((left, right) => {
    if (!sortKey) return 0;

    const getSortValue = (tour: TourneeRow) => {
      if (sortKey === "code") return String(tour.code);
      if (sortKey === "observation") return getTourneeObservation(tour);
      return String(tour[sortKey] ?? "");
    };
    const leftValue = getSortValue(left);
    const rightValue = getSortValue(right);

    if (!leftValue && rightValue) return 1;
    if (leftValue && !rightValue) return -1;

    const comparison = leftValue.localeCompare(rightValue, "fr", {
      numeric: true,
      sensitivity: "base",
    });
    return sortDirection === "asc" ? comparison : -comparison;
  });

  const handleSort = (key: TourneeSortKey) => {
    if (sortKey === key) {
      setSortDirection((direction) => direction === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };
  const hasActiveFilters =
    statusFilter !== "all" ||
    normalizedGlobalFilter.length > 0 ||
    Object.values(columnFilters).some((filter) => Boolean(filter?.trim()));
  const availableYears = [...new Set((data?.available_datfacts ?? []).map((period) => period.slice(0, 4)))];

  const handleCopyBilan = async () => {
    setCopyError("");
    setCopied(false);
    try {
      await navigator.clipboard.writeText(data?.bilan_tournees ?? "");
      setCopied(true);
    } catch (cause) {
      setCopyError(
        cause instanceof Error
          ? `La copie du bilan a échoué : ${cause.message}`
          : "La copie du bilan a échoué.",
      );
    }
  };

  const handleApplyPeriod = (year = filterYear, periodFilter = filterPeriod) => {
    const periodsForYear = (data?.available_datfacts ?? []).filter(
      (period) => year === "all" || period.startsWith(year),
    );
    const matchingPeriods = periodsForYear.filter((period) => {
      const month = Number(period.slice(4, 6));
      if (periodFilter === "all") return true;
      if (periodFilter === "q1") return month >= 1 && month <= 3;
      if (periodFilter === "q2") return month >= 4 && month <= 6;
      if (periodFilter === "q3") return month >= 7 && month <= 9;
      if (periodFilter === "q4") return month >= 10 && month <= 12;
      return period.slice(4, 6) === periodFilter;
    });
    if (!matchingPeriods.length) {
      setError("Aucune période disponible pour cette sélection.");
      return;
    }
    setError("");
    setSelectedDatfact(matchingPeriods.join(","));
  };

  return (
    <section className="space-y-6 animate-in fade-in duration-300">
      <header className="border-b border-[#DDE5E8] pb-5 dark:border-slate-700">
        <button
          type="button"
          onClick={onBack}
          className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-[#56636D] hover:text-[#245A83] dark:text-slate-300"
        >
          <ArrowLeft size={16} aria-hidden="true" /> Retour
        </button>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase text-[#245A83]">Analyse opérationnelle</p>
            <h1 className="page-title mt-1 text-[#101828] dark:text-slate-100">Analyses relève</h1>
            {data && (
              <p className="mt-2 text-sm text-[#667085] dark:text-slate-400">Date système : {data.date_systeme}</p>
            )}
          </div>
        </div>
      </header>

      {data && (
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-0 flex-1 space-y-2 sm:min-w-[10rem] sm:flex-none">
            <label htmlFor="releve-filter-year" className="text-[11px] font-bold text-[#98A2B3] uppercase px-1">Année</label>
            <div className="flex items-center gap-2">
              <input
                id="releve-filter-year"
                list="releve-years-list"
                value={filterYear}
                onChange={(event) => setFilterYear(event.target.value)}
                onBlur={(event) => handleApplyPeriod(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleApplyPeriod(event.currentTarget.value);
                }}
                placeholder="Entrez une année ou choisissez"
                className="block w-full min-w-0 sm:w-32 bg-[#F9FAFB] border border-[#E4E7EC] rounded-xl px-4 py-2.5 text-sm sm:text-xs font-bold text-[#101828] outline-none hover:border-[#D0D5DD] transition-all"
              />
              <datalist id="releve-years-list">
                <option value="all">Toutes</option>
                {availableYears.map((year) => <option key={year} value={year} />)}
              </datalist>
              <button
                type="button"
                onClick={() => {
                  setFilterYear("all");
                  setFilterPeriod("all");
                  handleApplyPeriod("all", "all");
                }}
                className="hidden sm:inline-flex min-h-10 items-center px-3 py-2 rounded-xl text-xs font-black bg-white text-[#245A83] border border-[#E4E7EC]"
              >
                Toutes
              </button>
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-2 sm:min-w-[14rem] sm:flex-none">
            <label htmlFor="releve-filter-period" className="text-[11px] font-bold text-[#98A2B3] uppercase px-1">Période</label>
            <select
              id="releve-filter-period"
              value={filterPeriod}
              onChange={(event) => {
                const nextPeriod = event.target.value;
                setFilterPeriod(nextPeriod);
                handleApplyPeriod(filterYear, nextPeriod);
              }}
              className="block w-full min-w-0 sm:w-56 bg-[#F9FAFB] border border-[#E4E7EC] rounded-xl px-4 py-2.5 text-sm sm:text-xs font-bold text-[#101828] outline-none hover:border-[#D0D5DD] transition-all"
            >
              <option value="all">Année {filterYear === "all" ? "complète" : filterYear}</option>
              <optgroup label="Trimestres">
                <option value="q1">1er Trim {filterYear !== "all" ? filterYear : ""}</option>
                <option value="q2">2ème Trim {filterYear !== "all" ? filterYear : ""}</option>
                <option value="q3">3ème Trim {filterYear !== "all" ? filterYear : ""}</option>
                <option value="q4">4ème Trim {filterYear !== "all" ? filterYear : ""}</option>
              </optgroup>
              <optgroup label="Mois">
                {["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"].map((month, index) => (
                  <option key={month} value={(index + 1).toString().padStart(2, "0")}>
                    {month} {filterYear !== "all" ? filterYear : ""}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <p className="pb-2 text-sm font-medium text-[#56636D] dark:text-slate-300">
            {data.tournees.length} tournée(s) détectée(s) sur {data.tournees_periode_active}
          </p>
        </div>
      )}

      {error && (
        <div role="alert" className="border-s-4 border-rose-500 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-40 items-center justify-center gap-3 text-sm font-medium text-[#667085]">
          <RefreshCw size={18} className="animate-spin" aria-hidden="true" /> Lecture de TOURNEE.DBF…
        </div>
      ) : data ? (
        <>
          <section className="space-y-3 border border-[#E4E7EC] bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-[#101828] dark:text-slate-100">
                Bilan des tournées par centre
              </h2>
              <button
                type="button"
                onClick={handleCopyBilan}
                disabled={!data.bilan_tournees}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#245A83] px-4 py-2 text-sm font-bold text-white hover:bg-[#1D4B6D] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Copy size={15} aria-hidden="true" /> Copier le bilan
              </button>
            </div>
            {copied && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">Bilan copié.</p>}
            {copyError && <p role="alert" className="text-sm text-rose-700 dark:text-rose-400">{copyError}</p>}
          </section>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {([1, 2, 3, 4, 5] as TourneeStatus[]).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setStatusFilter(statusFilter === String(code) ? "all" : String(code))}
                aria-pressed={statusFilter === String(code)}
                className={`min-h-28 border p-4 text-start transition-colors dark:border-slate-700 ${
                  statusFilter === String(code)
                    ? "border-[#245A83] bg-[#EDF5F7] dark:bg-slate-800"
                    : "border-[#E4E7EC] bg-white hover:bg-[#F8FAFB] dark:bg-slate-900 dark:hover:bg-slate-800"
                }`}
              >
                <span className="flex items-center gap-2 text-xs font-bold text-[#667085] dark:text-slate-400">
                  <ClipboardCheck size={15} aria-hidden="true" /> Code {code}
                </span>
                <span className="mt-2 block text-2xl font-black text-[#101828] dark:text-slate-100">
                  {data.counts[String(code)] ?? 0}
                </span>
                <span className="mt-1 block text-xs font-medium text-[#56636D] dark:text-slate-300">
                  {statusLabels[code]}
                </span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-lg font-bold text-[#101828] dark:text-slate-100">Tournées concernées</h2>
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-xs font-medium text-[#475467] dark:text-slate-300">
                Recherche globale
                <input
                  type="search"
                  value={globalFilter}
                  onChange={(event) => setGlobalFilter(event.target.value)}
                  placeholder="Rechercher dans le tableau"
                  className="min-h-10 w-64 max-w-full border border-[#D0D5DD] bg-white px-3 text-sm text-[#101828] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-[#475467] dark:text-slate-300">
                État
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="min-h-10 border border-[#D0D5DD] bg-white px-3 text-sm text-[#101828] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="all">Tous les codes</option>
                  {([1, 2, 3, 4, 5] as TourneeStatus[]).map((code) => (
                    <option key={code} value={code}>Code {code} · {statusLabels[code]}</option>
                  ))}
                </select>
              </label>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setGlobalFilter("");
                    setColumnFilters({});
                    setStatusFilter("all");
                  }}
                  className="min-h-10 border border-[#D0D5DD] bg-white px-3 text-sm font-semibold text-[#475467] hover:bg-[#F9FAFB] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
                >
                  Effacer les filtres
                </button>
              )}
            </div>
          </div>

          <div className="table-scroll overflow-x-auto border border-[#E4E7EC] bg-white dark:border-slate-700 dark:bg-slate-900">
            <table className="w-full min-w-[1250px] border-collapse text-start text-sm">
              <thead className="bg-[#F3F6F7] text-xs uppercase text-[#56636D] dark:bg-slate-800 dark:text-slate-300">
                <tr>
                  {(() => {
                    const key = "code" as const;
                    const active = sortKey === key;
                    const Icon = active
                      ? sortDirection === "asc" ? ArrowUp : ArrowDown
                      : ArrowUpDown;
                    return (
                      <th
                        scope="col"
                        className="cursor-pointer select-none px-3 py-3 text-start"
                        onClick={() => handleSort(key)}
                        aria-sort={active ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                      >
                        <button type="button" className="inline-flex items-center gap-1 font-bold">
                          Alerte <Icon size={13} aria-hidden="true" />
                        </button>
                      </th>
                    );
                  })()}
                  {columns.map((column) => {
                    const active = sortKey === column.key;
                    const Icon = active
                      ? sortDirection === "asc" ? ArrowUp : ArrowDown
                      : ArrowUpDown;
                    return (
                      <th
                        key={column.key}
                        scope="col"
                        className="cursor-pointer select-none px-3 py-3 text-start"
                        onClick={() => handleSort(column.key)}
                        aria-sort={active ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                      >
                        <button type="button" className="inline-flex items-center gap-1 font-bold">
                          {column.label} <Icon size={13} aria-hidden="true" />
                        </button>
                      </th>
                    );
                  })}
                </tr>
                <tr className="bg-white dark:bg-slate-900">
                  <th scope="col" className="px-2 py-2">
                    <span className="sr-only">Filtrage des alertes via le filtre État</span>
                  </th>
                  {columns.map((column) => (
                    <th key={`filter-${column.key}`} scope="col" className="px-2 py-2">
                      <label className="sr-only" htmlFor={`releve-filter-${column.key}`}>
                        Filtrer par {column.label}
                      </label>
                      <input
                        id={`releve-filter-${column.key}`}
                        type="search"
                        value={columnFilters[column.key] ?? ""}
                        onChange={(event) =>
                          setColumnFilters((filters) => ({
                            ...filters,
                            [column.key]: event.target.value,
                          }))
                        }
                        placeholder={`Filtrer ${column.label.toLowerCase()}`}
                        className="min-h-9 w-full min-w-24 border border-[#D0D5DD] bg-white px-2 text-xs font-normal normal-case text-[#101828] placeholder:text-[#98A2B3] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E7EC] dark:divide-slate-700">
                {visibleTours.map((tour) => (
                  <tr key={`${tour.UNITE}-${tour.CENTRE}-${tour.TOURNEE}-${tour.DATFACT}`} className="text-[#344054] dark:text-slate-200">
                    <td className="whitespace-nowrap px-3 py-3">
                      <span className="font-bold text-[#245A83]">{tour.code} · {statusLabels[tour.code]}</span>
                    </td>
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={`px-3 py-3 text-xs ${column.key === "observation" ? "min-w-80" : "whitespace-nowrap font-mono"}`}
                      >
                        {column.key === "observation"
                          ? getTourneeObservation(tour)
                          : tour[column.key] || "—"}
                      </td>
                    ))}
                  </tr>
                ))}
                {visibleTours.length === 0 && (
                  <tr>
                    <td colSpan={columns.length + 1} className="px-4 py-10 text-center text-sm text-[#667085]">
                      Aucune tournée ne correspond aux filtres.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  );
}