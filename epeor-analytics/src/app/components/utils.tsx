"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ResponsiveContainer } from "recharts";
import { apiUrlObject } from "../lib/api";

// ─── Types partagés ──────────────────────────────────────────────────────────

export type DataPathInfo = {
  data_dir?: string;
  data_dir_exists?: boolean;
  primary_source_ready?: boolean;
  needs_configuration?: boolean;
  diagnostic?: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Masque les noms de fichiers / tables techniques dans les messages UI. */
export function sanitizeUserFacingMessage(message: string | undefined): string {
  if (!message) return "";
  return message
    .replace(/\b[A-Z][A-Z0-9_]*\.DBF\b/gi, "données")
    .replace(/\.dbf\b/gi, "")
    .trim();
}

export function isBackendConnectionError(stats: { error?: string } | null): boolean {
  const err = (stats?.error || "").toLowerCase();
  return err.includes("contacter") || err.includes("port 8000") || err.includes("réseau");
}

export function isDataPathConfigurationRequired(
  stats: any | null,
  dataPathInfo: DataPathInfo | null,
  backendReachable: boolean
): boolean {
  if (!backendReachable) return false;
  if (dataPathInfo?.needs_configuration === true) return true;
  if (dataPathInfo?.data_dir_exists === false) return true;
  const diag = (dataPathInfo?.diagnostic || "").toLowerCase();
  if (
    diag.includes("introuvable") ||
    diag.includes("absent") ||
    diag.includes("illisible")
  ) {
    return true;
  }
  if (!stats) return false;
  const msg = `${stats.message || ""} ${stats.error || ""}`.toLowerCase();
  if (stats.status !== "error" && !stats.error) return false;
  return (
    msg.includes("aucune donnée") ||
    msg.includes("introuvable") ||
    msg.includes("référentiel") ||
    msg.includes("absent") ||
    msg.includes("epeor_data_dir") ||
    msg.includes("dossier de données")
  );
}

export const formatDate = (dateStr: string) => {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
};

export function appendSecteurParam(url: URL, secteur: string) {
  const code = (secteur || "").trim();
  if (code) url.searchParams.set("secteur", code);
}

export function buildSubscribersUrl(quartier: string, options?: { etat?: string; secteur?: string }) {
  const url = apiUrlObject("/subscribers");
  url.searchParams.set("quartier", quartier);
  if (options?.etat) url.searchParams.set("etat", options.etat);
  appendSecteurParam(url, options?.secteur || "");
  return url.toString();
}

export type EvolutionRow = {
  period: string;
  count: number;
  new_registrations?: number;
  resigned_count?: number;
  stopped_count?: number;
};

/** Filtre les entrées invalides renvoyées par l'API évolution. */
export function sanitizeEvolutionRows(rows: unknown): EvolutionRow[] {
  if (!Array.isArray(rows)) return [];
  return rows.filter((row): row is EvolutionRow => {
    if (!row || typeof row !== "object") return false;
    const period = (row as EvolutionRow).period;
    return typeof period === "string" && /^\d{4}-\d{2}$/.test(period);
  });
}

import i18n from "../../lib/i18n";

export const MONTH_LABELS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

export function formatPeriodFrench(periodStr: string | undefined | null): string {
  if (!periodStr || typeof periodStr !== "string") return "";
  const [y, m] = periodStr.split("-");
  if (!y || !m) return periodStr;
  const mIdx = parseInt(m, 10);
  if (mIdx < 1 || mIdx > 12) return periodStr;
  const monthName = i18n.t(`months.${mIdx}`, { defaultValue: MONTH_LABELS_FR[mIdx - 1] });
  return `${monthName} ${y}`;
}

export function formatPeriodLabel(start: string, end: string) {
  const normalize = (value: string) => value.replace(/-/g, "").trim();
  const s = normalize(start);
  const e = normalize(end);
  const format = (raw: string) =>
    raw.length === 8
      ? `${raw.slice(6, 8)}/${raw.slice(4, 6)}/${raw.slice(0, 4)}`
      : raw;

  if (s && e) return i18n.t('period.fromTo', { from: format(s), to: format(e), defaultValue: `Période : du ${format(s)} au ${format(e)}` });
  if (s) return i18n.t('period.from', { from: format(s), defaultValue: `Période : à partir du ${format(s)}` });
  if (e) return i18n.t('period.to', { to: format(e), defaultValue: `Période : jusqu'au ${format(e)}` });
  return "";
}

// ─── ChartContainer ───────────────────────────────────────────────────────────

/** Évite les avertissements Recharts quand le conteneur n'a pas encore de taille (flex / onglets). */
export function ChartContainer({
  children,
  className = "h-[260px] sm:h-[320px] lg:h-[350px] w-full min-h-[180px] min-w-0",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setReady(el.clientWidth > 0 && el.clientHeight > 0);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} className={className} style={{ minWidth: 0, minHeight: 0 }}>
      {ready ? (
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          {children}
        </ResponsiveContainer>
      ) : null}
    </div>
  );
}
