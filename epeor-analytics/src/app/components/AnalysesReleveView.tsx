"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ClipboardCheck, RefreshCw } from "lucide-react";
import { apiUrl } from "../lib/api";

type TourneeStatus = 1 | 2 | 3 | 4;

type TourneeRow = {
  UNITE: string;
  CENTRE: string;
  TOURNEE: string;
  DATFACT: string;
  DATEPREVUE: string;
  DATERELEVE: string;
  DEB_SAISIE: string;
  EDITCTL: string;
  EDITFAC: string;
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
};

const statusLabels: Record<TourneeStatus, string> = {
  1: "Date prévue dépassée",
  2: "Relevé en attente de saisie",
  3: "Relevé en attente de contrôle",
  4: "En attente d’édition",
};

const columns: { key: keyof TourneeRow; label: string }[] = [
  { key: "UNITE", label: "Unité" },
  { key: "CENTRE", label: "Centre" },
  { key: "TOURNEE", label: "Tournée" },
  { key: "DATEPREVUE", label: "Date prévue" },
  { key: "DATERELEVE", label: "Date relevé" },
  { key: "DEB_SAISIE", label: "Début saisie" },
  { key: "EDITCTL", label: "Édition contrôle" },
  { key: "EDITFAC", label: "Édition facture" },
];

export function AnalysesReleveView({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<AnalysisData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedDatfact, setSelectedDatfact] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [filterPeriod, setFilterPeriod] = useState("all");

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

  const visibleTours = (data?.tournees ?? []).filter(
    (tour) => statusFilter === "all" || String(tour.code) === statusFilter,
  );
  const availableYears = [...new Set((data?.available_datfacts ?? []).map((period) => period.slice(0, 4)))];

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
            <h1 className="mt-1 text-2xl font-black text-[#101828] dark:text-slate-100">Analyses relève</h1>
            {data && (
              <p className="mt-2 text-sm text-[#667085] dark:text-slate-400">Date système : {data.date_systeme}</p>
            )}
          </div>
        </div>
      </header>

      {data && (
        <div className="flex flex-col md:flex-row md:items-end gap-4">
          <div className="space-y-2">
            <label htmlFor="releve-filter-year" className="text-[10px] font-bold text-[#98A2B3] uppercase px-1">Année</label>
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
                className="block w-full md:w-32 bg-[#F9FAFB] border border-[#E4E7EC] rounded-xl px-4 py-2.5 text-xs font-bold text-[#101828] outline-none hover:border-[#D0D5DD] transition-all"
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
                className="hidden md:inline-block px-3 py-2 rounded-xl text-[10px] font-black bg-white text-[#245A83] border border-[#E4E7EC]"
              >
                Toutes
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="releve-filter-period" className="text-[10px] font-bold text-[#98A2B3] uppercase px-1">Période</label>
            <select
              id="releve-filter-period"
              value={filterPeriod}
              onChange={(event) => {
                const nextPeriod = event.target.value;
                setFilterPeriod(nextPeriod);
                handleApplyPeriod(filterYear, nextPeriod);
              }}
              className="block w-full md:w-56 bg-[#F9FAFB] border border-[#E4E7EC] rounded-xl px-4 py-2.5 text-xs font-bold text-[#101828] outline-none hover:border-[#D0D5DD] transition-all"
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
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {([1, 2, 3, 4] as TourneeStatus[]).map((code) => (
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

          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-[#101828] dark:text-slate-100">Tournées concernées</h2>
            <label className="flex items-center gap-2 text-sm font-medium text-[#475467] dark:text-slate-300">
              État
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="min-h-10 border border-[#D0D5DD] bg-white px-3 text-sm text-[#101828] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="all">Tous les codes</option>
                {([1, 2, 3, 4] as TourneeStatus[]).map((code) => (
                  <option key={code} value={code}>Code {code} · {statusLabels[code]}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="overflow-x-auto border border-[#E4E7EC] bg-white dark:border-slate-700 dark:bg-slate-900">
            <table className="w-full min-w-[1050px] border-collapse text-start text-sm">
              <thead className="bg-[#F3F6F7] text-xs uppercase text-[#56636D] dark:bg-slate-800 dark:text-slate-300">
                <tr>
                  <th scope="col" className="px-3 py-3 text-start">État</th>
                  {columns.map((column) => (
                    <th key={column.key} scope="col" className="px-3 py-3 text-start">{column.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E7EC] dark:divide-slate-700">
                {visibleTours.map((tour) => (
                  <tr key={`${tour.UNITE}-${tour.CENTRE}-${tour.TOURNEE}-${tour.DATFACT}`} className="text-[#344054] dark:text-slate-200">
                    <td className="whitespace-nowrap px-3 py-3">
                      <span className="font-bold text-[#245A83]">{tour.code}</span>
                      <span className="ms-2 text-xs">{statusLabels[tour.code]}</span>
                    </td>
                    {columns.map((column) => (
                      <td key={column.key} className="whitespace-nowrap px-3 py-3 font-mono text-xs">
                        {tour[column.key] || "—"}
                      </td>
                    ))}
                  </tr>
                ))}
                {visibleTours.length === 0 && (
                  <tr>
                    <td colSpan={columns.length + 1} className="px-4 py-10 text-center text-sm text-[#667085]">
                      Aucune tournée pour ce code.
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