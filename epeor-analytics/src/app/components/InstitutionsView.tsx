"use client";

import { useEffect, useState, useRef, useMemo, useCallback, Fragment } from "react";
import {
  ChevronRight, ChevronDown, Search, Printer, MapPin, Building2, Ban, FileSpreadsheet,
} from "lucide-react";
import { apiUrlObject } from "../lib/api";
import { appendSecteurParam } from "./utils";
import { SecteurDropdown, MultiSelectDropdown } from "./ui";

function getQuarterFromMonth(monthStr: string): number {
  const m = parseInt(monthStr, 10);
  if (isNaN(m)) return 1;
  if (m >= 1 && m <= 3) return 1;
  if (m >= 4 && m <= 6) return 2;
  if (m >= 7 && m <= 9) return 3;
  if (m >= 10 && m <= 12) return 4;
  return 1;
}

function computeRowQuarterAmounts(row: any): Record<string, number> {
  const raw: Record<string, number> = {};
  if (!row.factures || !Array.isArray(row.factures)) return raw;
  for (const f of row.factures) {
    const df = String(f.date_fact || '').trim();
    if (df.length !== 8) continue;
    const y = parseInt(df.substring(0, 4), 10);
    if (isNaN(y)) continue;
    const mStr = df.substring(4, 6);
    const amt = Number(f.montant) || 0;
    const periode = Number(f.periode) || 3;
    if (periode === 1) {
      raw[`${y}-M${mStr}`] = (raw[`${y}-M${mStr}`] || 0) + amt;
    } else {
      const q = getQuarterFromMonth(mStr);
      raw[`${y}-Q${q}`] = (raw[`${y}-Q${q}`] || 0) + amt;
    }
  }
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key.includes('-M')) {
      const [yearPart, monthPart] = key.split('-');
      const q = getQuarterFromMonth(monthPart.substring(1));
      const newKey = `${yearPart}-Q${q}`;
      result[newKey] = Math.round(((result[newKey] || 0) + value) * 100) / 100;
    } else {
      result[key] = Math.round(((result[key] || 0) + value) * 100) / 100;
    }
  }
  return result;
}

function getRefYearFromRows(rows: any[]): number {
  let maxDateStr = '';
  for (const r of rows) {
    if (!r.factures || !Array.isArray(r.factures)) continue;
    for (const f of r.factures) {
      const df = String(f.date_fact || '').trim();
      if (df.length === 8 && (!maxDateStr || df > maxDateStr)) maxDateStr = df;
    }
  }
  if (maxDateStr.length >= 4) {
    const y = parseInt(maxDateStr.substring(0, 4), 10);
    if (!isNaN(y)) return y;
  }
  return new Date().getFullYear();
}

function buildQuarterSearchOrder(refYear: number, yearsBack = 20): { year: number; q: number }[] {
  const order: { year: number; q: number }[] = [];
  for (let y = refYear; y >= refYear - yearsBack; y--) {
    for (let q = 1; q <= 4; q++) order.push({ year: y, q });
  }
  return order;
}

function formatQuarterLabel(year: number, q: number): string {
  const ordinals = ['', '1er', '2ème', '3ème', '4ème'];
  return `${ordinals[q]} trimestre ${year}`;
}

function parseAmountInput(input: string): number | null {
  const cleaned = input.trim().replace(/\s/g, '').replace(',', '.');
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  if (isNaN(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}



type QuarterPick = {
  numab: string;
  year: number;
  quarter: number;
  quarterKey: string;
  amount: number;
  amountCents: number;
  row: any;
  itemIndex: number;
};

type CombinationPriority = 1 | 2 | 3 | 4;

const PRIORITY_SECTIONS: Record<
  CombinationPriority,
  { title: string; description: string; headerClass: string; borderClass: string }
> = {
  1: {
    title: 'Priorité 1 — Même trimestre (même année)',
    description: 'Combinaisons limitées à un seul trimestre d\'une même année (ex. uniquement T1 2025).',
    headerClass: 'bg-brand-50 text-brand-900 border-brand-200',
    borderClass: 'border-brand-200',
  },
  2: {
    title: 'Priorité 2 — Multi-trimestres (même année)',
    description: 'Plusieurs trimestres d\'une même année (ex. T1 + T2 + T3 2025).',
    headerClass: 'bg-violet-50 text-violet-900 border-violet-200',
    borderClass: 'border-violet-200',
  },
  3: {
    title: 'Priorité 3 — Recherche mixte et inter-années progressive par nombre d\'années',
    description: 'Recherche progressive par nombre d\'années explorant ordonnément : Cas A (Même trimestre sur années distinctes), Cas C (Blocs complets de trimestres), Cas B (Mélange libre), et Cas D (Grand mix éloigné).',
    headerClass: 'bg-amber-50 text-amber-900 border-amber-200',
    borderClass: 'border-amber-200',
  },
  4: {
    title: 'Priorité 4 — Recherche élargie (purement aléatoire)',
    description: 'Recherche élargie sans contrainte de structure annuelle comme fallback final.',
    headerClass: 'bg-rose-50 text-rose-900 border-rose-200',
    borderClass: 'border-rose-200',
  },
};

function classifyCombinationPriority(picks: QuarterPick[]): CombinationPriority {
  const years = new Set(picks.map(p => p.year).filter(Boolean));
  const quarterKeys = new Set(picks.map(p => p.quarterKey).filter(Boolean));
  if (years.size === 1 && quarterKeys.size === 1) return 1;
  if (years.size === 1) return 2;
  return 3;
}

function combinationKeyFromPicks(picks: QuarterPick[]): string {
  return picks
    .map(p => p.itemIndex)
    .sort((a, b) => a - b)
    .join('|');
}



function shiftLeftBits(words: Uint32Array, shift: number, wordCount: number): Uint32Array {
  const out = new Uint32Array(wordCount);
  if (shift <= 0) {
    out.set(words.subarray(0, wordCount));
    return out;
  }
  const wordShift = shift >>> 5;
  const bitShift = shift & 31;
  for (let i = wordCount - 1; i >= 0; i--) {
    const src = i - wordShift;
    if (src < 0) continue;
    let val = words[src] >>> 0;
    if (bitShift > 0) {
      val = ((val << bitShift) >>> 0);
      if (src > 0) val |= (words[src - 1] >>> (32 - bitShift));
    }
    out[i] = val >>> 0;
  }
  return out;
}

function setSumBit(bits: Uint32Array, sum: number) {
  bits[sum >>> 5] |= 1 << (sum & 31);
}

function isSumReachable(reachable: Uint8Array, sum: number): boolean {
  return sum >= 0 && sum < reachable.length && reachable[sum] === 1;
}

function runBitsetSubsetSum(
  items: QuarterPick[],
  targetCents: number
): { reachable: Uint8Array; prevItemIdx: Int32Array; bits: Uint32Array } | null {
  if (items.length === 0 || targetCents <= 0) return null;

  const wordCount = (targetCents >>> 5) + 1;
  const bits = new Uint32Array(wordCount);
  bits[0] = 1;

  const reachable = new Uint8Array(targetCents + 1);
  reachable[0] = 1;

  const prevItemIdx = new Int32Array(targetCents + 1);
  prevItemIdx.fill(-1);

  for (let i = 0; i < items.length; i++) {
    const amt = items[i].amountCents;
    if (amt <= 0 || amt > targetCents) continue;

    const shifted = shiftLeftBits(bits, amt, wordCount);

    for (let wi = 0; wi < wordCount; wi++) {
      const newly = shifted[wi] & ~bits[wi];
      if (newly === 0) continue;
      for (let b = 0; b < 32; b++) {
        if (!(newly & (1 << b))) continue;
        const s = wi * 32 + b;
        if (s > targetCents) continue;
        const prev = s - amt;
        if (prev < 0 || !isSumReachable(reachable, prev)) continue;
        if (prevItemIdx[s] < 0) prevItemIdx[s] = i;
        reachable[s] = 1;
        setSumBit(bits, s);
      }
    }

    for (let wi = 0; wi < wordCount; wi++) {
      bits[wi] |= shifted[wi];
    }
  }

  return { reachable, prevItemIdx, bits };
}



const MAX_COMBINATIONS = 100;

async function findAllCombinationIndicesAsync(
  items: QuarterPick[],
  targetCents: number,
  maxResults = MAX_COMBINATIONS,
  callbacks?: {
    onProgress?: (ratio: number) => void;
    onFound?: (picks: QuarterPick[], foundCount: number) => void | Promise<void>;
    isAborted?: () => boolean;
  },
  seenGlobal?: Set<string>,
  acceptCombination?: (picks: QuarterPick[]) => boolean
): Promise<{ truncated: boolean; effectiveTarget: number | null; totalFound: number }> {
  // 1. Pré-filtrage par rapport au montant cible
  const filteredItems = items.filter(it => it.amountCents > 0 && it.amountCents <= targetCents);
  if (filteredItems.length === 0 || targetCents <= 0) {
    return { truncated: false, effectiveTarget: null, totalFound: 0 };
  }

  // 2. Tri par ordre décroissant pour le backtracking efficace
  const sortedItems = [...filteredItems].sort((a, b) => b.amountCents - a.amountCents);

  let effectiveTarget: number | null = null;
  for (const tryTarget of [targetCents, targetCents - 1, targetCents + 1]) {
    if (callbacks?.isAborted?.()) {
      return { truncated: false, effectiveTarget: null, totalFound: 0 };
    }
    if (tryTarget <= 0) continue;
    const bitset = runBitsetSubsetSum(sortedItems, tryTarget);
    if (bitset && isSumReachable(bitset.reachable, tryTarget)) {
      effectiveTarget = tryTarget;
      break;
    }
  }
  if (effectiveTarget === null) {
    return { truncated: false, effectiveTarget: null, totalFound: 0 };
  }

  // 3. Pré-calcul des sommes de suffixes pour l'élagage (pruning)
  const suffixSums = new Float64Array(sortedItems.length + 1);
  let runningSum = 0;
  for (let i = sortedItems.length - 1; i >= 0; i--) {
    runningSum += sortedItems[i].amountCents;
    suffixSums[i] = runningSum;
  }

  const results: number[][] = [];
  const seen = seenGlobal ?? new Set<string>();
  let steps = 0;

  async function dfs(start: number, remaining: number, path: number[]): Promise<void> {
    if (callbacks?.isAborted?.()) return;
    if (results.length >= maxResults) return;
    if (remaining === 0) {
      const picks = path.map(i => sortedItems[i]);
      if (acceptCombination && !acceptCombination(picks)) return;
      const key = combinationKeyFromPicks(picks);
      if (seen.has(key)) return;
      seen.add(key);
      const idxCopy = [...path];
      results.push(idxCopy);
      await callbacks?.onFound?.(picks, results.length);
      await new Promise<void>(resolve => setTimeout(resolve, 0));
      return;
    }

    if (start >= sortedItems.length || remaining < 0) return;

    // Élagage 1 : La somme cumulée maximale possible restante est insuffisante
    if (suffixSums[start] < remaining) return;

    // Élagage 2 : Le plus petit élément restant (global) est supérieur au reste cible
    const minVal = sortedItems[sortedItems.length - 1].amountCents;
    if (minVal > remaining) return;

    steps++;
    if (steps % 2500 === 0) {
      callbacks?.onProgress?.(Math.min(0.98, steps / (sortedItems.length * 500 + 1)));
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    }

    let lastAmt = -1; // Élagage 3 : Sauter les doublons de montant au même niveau
    for (let i = start; i < sortedItems.length; i++) {
      if (callbacks?.isAborted?.()) return;
      const amt = sortedItems[i].amountCents;

      // Élagage 3 : Si le montant courant est identique au précédent au même niveau,
      // la branche est équivalente → on la saute pour éviter les combinaisons dupliquées
      if (amt === lastAmt) continue;
      lastAmt = amt;

      // Le tableau est trié décroissant : si l'élément courant dépasse le reste cible,
      // les suivants (plus petits) peuvent encore correspondre → on continue
      if (amt > remaining) continue;

      path.push(i);
      await dfs(i + 1, remaining - amt, path);
      path.pop();
      if (results.length >= maxResults) return;
    }
  }

  await dfs(0, effectiveTarget, []);
  callbacks?.onProgress?.(1);
  return {
    truncated: results.length >= maxResults,
    effectiveTarget,
    totalFound: results.length,
  };
}


function buildInvoiceItemsFromRows(
  rowQuarterMaps: { row: any; quarters: Record<string, number> }[],
  refYear: number,
  yearsBack = 20
): QuarterPick[] {
  const minYear = refYear - yearsBack;
  const items: QuarterPick[] = [];
  for (const { row } of rowQuarterMaps) {
    if (!row.factures || !Array.isArray(row.factures)) continue;
    for (const f of row.factures) {
      const amt = Number(f.montant) || 0;
      if (amt <= 0) continue;
      const df = String(f.date_fact || '').trim();
      if (df.length !== 8) continue;
      const year = parseInt(df.substring(0, 4), 10);
      if (isNaN(year) || year < minYear) continue;
      const mStr = df.substring(4, 6);
      const quarter = getQuarterFromMonth(mStr);
      items.push({
        numab: row.numab,
        year,
        quarter,
        quarterKey: `${year}-Q${quarter}`,
        amount: Math.round(amt * 100) / 100,
        amountCents: Math.round(amt * 100),
        row,
        itemIndex: items.length,
      });
    }
  }
  const quarterOrder = buildQuarterSearchOrder(refYear, yearsBack);
  const orderIndex = new Map<string, number>();
  quarterOrder.forEach(({ year, q }, i) => orderIndex.set(`${year}-Q${q}`, i));
  items.sort((a, b) => {
    const oa = orderIndex.get(a.quarterKey) ?? 9999;
    const ob = orderIndex.get(b.quarterKey) ?? 9999;
    if (oa !== ob) return oa - ob;
    return b.amountCents - a.amountCents;
  });
  return items;
}

function picksToLines(picks: QuarterPick[]) {
  return picks
    .map(p => ({
      numab: p.numab,
      raisoc: p.row?.raisoc || '—',
      codinstit: p.row?.codinstit || '—',
      lib_instit: p.row?.lib_instit || '—',
      year: p.year,
      quarter: p.quarter,
      periodLabel: p.year ? formatQuarterLabel(p.year, p.quarter) : '—',
      amount: p.amount,
    }))
    .sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      if (a.quarter !== b.quarter) return a.quarter - b.quarter;
      return String(a.numab).localeCompare(String(b.numab), 'fr');
    });
}

function classifyP3SubCase(picks: QuarterPick[]): 'A' | 'B' | 'C' | 'D' | undefined {
  const years = [...new Set(picks.map(p => p.year).filter(Boolean))].sort((a, b) => a - b);
  if (years.length < 2) return undefined;

  const quarters = picks.map(p => p.quarter);
  const distinctQuarters = new Set(quarters);

  // Cas A : Même trimestre sur des années distinctes (ex. tous les picks sont de Q1)
  if (distinctQuarters.size === 1) {
    return 'A';
  }

  // Cas D : Grand mix multi-années éloignées (ex. >= 4 années distinctes, ou écart >= 5 ans)
  const minYear = years[0];
  const maxYear = years[years.length - 1];
  if (years.length >= 4 || (maxYear - minYear) >= 5) {
    return 'D';
  }

  // Cas C : Blocs complets de trimestres (ex. au moins une année a ses 4 trimestres représentés)
  let hasCompleteYear = false;
  for (const year of years) {
    const quartersInYear = new Set(picks.filter(p => p.year === year).map(p => p.quarter));
    if (quartersInYear.size === 4) {
      hasCompleteYear = true;
      break;
    }
  }
  if (hasCompleteYear) {
    return 'C';
  }

  // Cas B : Mélange libre de trimestres et d'années (par défaut)
  return 'B';
}

function buildCombinationResult(
  picks: QuarterPick[],
  id: number,
  priority: CombinationPriority
): QuarterCombinationResult {
  const lines = picksToLines(picks);
  const numabs = [...new Set(picks.map(p => p.numab))];
  const sum = Math.round(lines.reduce((a, l) => a + l.amount, 0) * 100) / 100;
  const quarterKeys = [...new Set(picks.map(p => p.quarterKey))];
  const years = [...new Set(picks.map(p => p.year))].sort((a, b) => a - b);
  
  let label: string;
  let p3SubCase: 'A' | 'B' | 'C' | 'D' | undefined;

  if (priority === 1) {
    label = formatQuarterLabel(picks[0].year, picks[0].quarter);
  } else if (priority === 2) {
    label = `Année ${years[0]} (${quarterKeys.length} trimestre${quarterKeys.length !== 1 ? 's' : ''})`;
  } else if (priority === 3) {
    p3SubCase = classifyP3SubCase(picks);
    const subLabels: Record<'A' | 'B' | 'C' | 'D', string> = {
      A: 'Même trimestre / années distinctes',
      B: 'Mélange libre de trimestres et d\'années',
      C: 'Blocs complets de trimestres',
      D: 'Grand mix multi-années éloignées',
    };
    const subText = p3SubCase ? ` [Cas ${p3SubCase} — ${subLabels[p3SubCase]}]` : '';
    label = `${years.join(' · ')} (${years.length} ans)${subText}`;
  } else {
    label = `${years.join(' · ')} (Recherche aléatoire)`;
  }

  const mode =
    priority === 1
      ? 'same_quarter'
      : priority === 2
      ? 'same_year'
      : priority === 3
      ? 'multi_quarter'
      : 'random';

  return {
    id,
    priority,
    p3SubCase,
    mode,
    label,
    numabs,
    sum,
    pickCount: picks.length,
    lines,
  };
}

type QuarterCombinationResult = {
  id: number;
  priority: CombinationPriority;
  p3SubCase?: 'A' | 'B' | 'C' | 'D';
  mode: 'same_quarter' | 'same_year' | 'multi_quarter' | 'random';
  label: string;
  numabs: string[];
  sum: number;
  pickCount: number;
  lines: {
    numab: string;
    raisoc: string;
    codinstit: string;
    lib_instit: string;
    year: number;
    quarter: number;
    periodLabel: string;
    amount: number;
  }[];
};

type InstitGroup = { codinstit: string; lib_instit: string; rows: any[] };

const compareRows = (a: any, b: any, sortKey: string, sortDir: 'asc' | 'desc') => {
  const av = a[sortKey];
  const bv = b[sortKey];
  if (sortKey === 'montant_creance' || sortKey === 'nombre_creance') {
    const na = Number(av) || 0;
    const nb = Number(bv) || 0;
    return sortDir === 'asc' ? na - nb : nb - na;
  }
  const sa = String(av ?? '').toLowerCase();
  const sb = String(bv ?? '').toLowerCase();
  const cmp = sa.localeCompare(sb, 'fr');
  return sortDir === 'asc' ? cmp : -cmp;
};

const groupTotals = (g: InstitGroup) => ({
  montant: g.rows.reduce((a, r) => a + (r.montant_creance || 0), 0),
  factures: g.rows.reduce((a, r) => a + (r.nombre_creance || 0), 0),
});

export function CreancesInstitutionsView({
  onBack,
  selectedSecteur = '',
  sectors = [],
  uniteLabel = '',
  onSecteurChange,
  sectorsLoading = false,
}: any) {
  const secteurLabel = selectedSecteur
    ? (sectors.find((s: { code: string; libelle: string }) => s.code === selectedSecteur)?.libelle ?? selectedSecteur)
    : null;

  const [rows, setRows] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [targetMontantSearch, setTargetMontantSearch] = useState('');
  const [combinationResults, setCombinationResults] = useState<QuarterCombinationResult[]>([]);
  const [combinationTruncated, setCombinationTruncated] = useState(false);
  const [combinationMessage, setCombinationMessage] = useState<string | null>(null);
  const [combinationSearching, setCombinationSearching] = useState(false);
  const [combinationProgress, setCombinationProgress] = useState(0);
  const [combinationCurrentPriority, setCombinationCurrentPriority] = useState<CombinationPriority | null>(null);
  const [filterCodInstit, setFilterCodInstit] = useState<string[]>([]);
  const [filterTypeAbonInst, setFilterTypeAbonInst] = useState<string[]>([]);
  const [filterEtatCptInst, setFilterEtatCptInst] = useState<string[]>([]);
  const [filterTourneeInst, setFilterTourneeInst] = useState<string[]>([]);
  const [filterInstitution, setFilterInstitution] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState('codinstit');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selectedNumabsInst, setSelectedNumabsInst] = useState<string[]>([]);
  const searchAbortedRef = useRef(false);

  const abortSearchQuarterCombination = () => {
    searchAbortedRef.current = true;
  };

  const [expandedComboIds, setExpandedComboIds] = useState<Record<number, boolean>>({});

  const toggleComboExpand = (id: number) => {
    setExpandedComboIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const PAGE_SIZE = 15;

  const fmt = (n: number) =>
    new Intl.NumberFormat('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      .format(n).replace(/[\u202F\u00A0]/g, ' ') + ' DA';

  const loadData = useCallback(async () => {
    setDataLoading(true);
    setError(null);
    setRows([]);
    setSelectedNumabsInst([]);
    setCombinationResults([]);
    setCombinationTruncated(false);
    setCombinationMessage(null);
    try {
      const url = apiUrlObject('/creances_institutions');
      appendSecteurParam(url, selectedSecteur);
      const res = await fetch(url.toString());
      if (res.status === 404) {
        setError(
          'Route API introuvable (404). Fermez la fenêtre « EPEOR Backend » et relancez start.bat pour charger la dernière version du serveur.'
        );
        setRows([]);
        return;
      }
      const data = await res.json();
      if (data.status === 'loading') {
        setError(data.message || 'Chargement des données en cours… Réessayez dans quelques secondes.');
        setRows([]);
      } else if (data.error) {
        setError(data.error);
        setRows([]);
      } else {
        setRows(data.rows || []);
      }
    } catch {
      setError('Impossible de contacter le serveur backend. Vérifiez qu\'il tourne sur le port 8000.');
      setRows([]);
    } finally {
      setDataLoading(false);
    }
  }, [selectedSecteur]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r: any) => {
      if (filterCodInstit.length > 0 && !filterCodInstit.includes(String(r.codinstit || ''))) return false;
      if (filterTypeAbonInst.length > 0 && !filterTypeAbonInst.includes(String(r.type_abon || ''))) return false;
      if (filterEtatCptInst.length > 0 && !filterEtatCptInst.includes(String(r.etat_cpt || ''))) return false;
      if (filterTourneeInst.length > 0 && !filterTourneeInst.includes(String(r.tournee || ''))) return false;
      if (filterInstitution.length > 0 && !filterInstitution.includes(String(r.lib_instit || ''))) return false;
      if (!q) return true;
      return [r.codinstit, r.lib_instit, r.numab, r.raisoc, r.adresse, r.tournee]
        .some((v: string) => String(v || '').toLowerCase().includes(q));
    });
  }, [rows, search, filterCodInstit, filterTypeAbonInst, filterEtatCptInst, filterTourneeInst, filterInstitution]);

  const filterOptions = useMemo(() => {
    const codinstit = [...new Set(rows.map(r => String(r.codinstit || '')).filter(v => v))].sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }));
    const types = [...new Set(rows.map(r => String(r.type_abon || '')).filter(v => v))].sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }));
    const etats = [...new Set(rows.map(r => String(r.etat_cpt || '')).filter(v => v))].sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }));
    const tournees = [...new Set(rows.map(r => String(r.tournee || '')).filter(v => v))].sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }));
    const institutions = [...new Set(rows.map(r => String(r.lib_instit || '')).filter(v => v))].sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }));
    return { codinstit, types, etats, tournees, institutions };
  }, [rows]);

  const groups = useMemo(() => {
    const map = new Map<string, InstitGroup>();
    for (const r of filtered) {
      const key = String(r.codinstit || '—');
      let g = map.get(key);
      if (!g) {
        g = { codinstit: key, lib_instit: r.lib_instit || '—', rows: [] };
        map.set(key, g);
      }
      g.rows.push(r);
    }
    const list = Array.from(map.values());
    for (const g of list) {
      g.rows.sort((a, b) => compareRows(a, b, sortKey, sortDir));
    }
    list.sort((a, b) => {
      if (sortKey === 'codinstit') {
        const cmp = a.codinstit.localeCompare(b.codinstit, 'fr');
        return sortDir === 'asc' ? cmp : -cmp;
      }
      if (sortKey === 'lib_instit') {
        const cmp = a.lib_instit.localeCompare(b.lib_instit, 'fr');
        return sortDir === 'asc' ? cmp : -cmp;
      }
      if (sortKey === 'montant_creance' || sortKey === 'nombre_creance') {
        const field = sortKey as 'montant_creance' | 'nombre_creance';
        const ta = a.rows.reduce((s, r) => s + (Number(r[field]) || 0), 0);
        const tb = b.rows.reduce((s, r) => s + (Number(r[field]) || 0), 0);
        return sortDir === 'asc' ? ta - tb : tb - ta;
      }
      const ta = groupTotals(a).montant;
      const tb = groupTotals(b).montant;
      return sortDir === 'asc' ? ta - tb : tb - ta;
    });
    return list;
  }, [filtered, sortKey, sortDir]);

  const flatRows = useMemo(() => groups.flatMap(g => g.rows), [groups]);

  const totalPages = Math.max(1, Math.ceil(groups.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedGroups = groups.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const visibleNumabsInst = pagedGroups.flatMap(g => g.rows).map(r => r.numab).filter(Boolean as any);
  const allVisibleSelectedInst = visibleNumabsInst.length > 0 && visibleNumabsInst.every((id: any) => selectedNumabsInst.includes(id));
  const selectedCountInst = selectedNumabsInst.length;
  const selectedRowsInst = useMemo(() => selectedCountInst > 0 ? flatRows.filter((r: any) => selectedNumabsInst.includes(r.numab)) : flatRows, [selectedCountInst, selectedNumabsInst, flatRows]);

  const tableTotals = useMemo(() => ({
    institutions: groups.length,
    count: flatRows.length,
    montant: flatRows.reduce((a, r) => a + (r.montant_creance || 0), 0),
    factures: flatRows.reduce((a, r) => a + (r.nombre_creance || 0), 0),
  }), [groups, flatRows]);

  const comboHighlightNumabs = useMemo(() => {
    const set = new Set<string>();
    for (const combo of combinationResults) {
      for (const numab of combo.numabs) set.add(numab);
    }
    return set;
  }, [combinationResults]);

  const combinationByPriority = useMemo(() => ({
    1: combinationResults.filter(c => c.priority === 1),
    2: combinationResults.filter(c => c.priority === 2),
    3: combinationResults.filter(c => c.priority === 3),
    4: combinationResults.filter(c => c.priority === 4),
  }), [combinationResults]);

  const searchQuarterCombination = async () => {
    searchAbortedRef.current = false;
    setCombinationResults([]);
    setCombinationTruncated(false);
    setCombinationMessage(null);
    setCombinationCurrentPriority(null);
    setExpandedComboIds({});
    if (selectedCountInst === 0) {
      setCombinationMessage('Sélectionnez au moins un abonné dans le tableau.');
      return;
    }
    const target = parseAmountInput(targetMontantSearch);
    if (target === null) {
      setCombinationMessage('Saisissez un montant cible valide (ex. 225105,63).');
      return;
    }
    const targetCents = Math.round(target * 100);
    const sourceRows = flatRows.filter((r: any) => selectedNumabsInst.includes(r.numab));
    const refYear = getRefYearFromRows(sourceRows);
    const rowQuarterMaps = sourceRows.map((row: any) => ({
      row,
      quarters: computeRowQuarterAmounts(row),
    }));

    setCombinationSearching(true);
    setCombinationProgress(0);

    try {
      const allItems = buildInvoiceItemsFromRows(rowQuarterMaps, refYear);
      if (allItems.length === 0) {
        setCombinationMessage('Aucune facture impayée trouvée pour les abonnés sélectionnés.');
        return;
      }

      // Pré-filtrage strict des données pour exclure les factures supérieures au montant cible
      const filteredAllItems = allItems.filter(item => item.amountCents <= targetCents);
      if (filteredAllItems.length === 0) {
        const availableTotal = allItems.reduce((a, it) => a + it.amountCents, 0) / 100;
        setCombinationMessage(
          `Aucune facture impayée n'est inférieure ou égale au montant cible (${fmt(target)}). Toutes les factures dépassent individuellement cette cible (total disponible : ${fmt(availableTotal)}).`
        );
        return;
      }

      const seenGlobal = new Set<string>();
      let nextComboId = 1;
      let remaining = MAX_COMBINATIONS;
      let truncated = false;
      let effectiveTarget: number | null = null;
      let totalFound = 0;

      const emitFound = async (picks: QuarterPick[], priority: CombinationPriority) => {
        const combo = buildCombinationResult(picks, nextComboId++, priority);
        setCombinationResults(prev => [...prev, combo]);
        setCombinationCurrentPriority(priority);
      };

      const runPhase = async (
        priority: CombinationPriority,
        items: QuarterPick[],
        accept?: (picks: QuarterPick[]) => boolean,
        progressBase = 0,
        progressSpan = 0.33
      ) => {
        if (searchAbortedRef.current) return;
        if (remaining <= 0 || items.length === 0) return;
        setCombinationCurrentPriority(priority);
        const r = await findAllCombinationIndicesAsync(
          items,
          targetCents,
          remaining,
          {
            onProgress: ratio =>
              setCombinationProgress(progressBase + ratio * progressSpan),
            onFound: async (picks) => {
              await emitFound(picks, priority);
            },
            isAborted: () => searchAbortedRef.current,
          },
          seenGlobal,
          accept
        );
        if (effectiveTarget === null && r.effectiveTarget !== null) {
          effectiveTarget = r.effectiveTarget;
        }
        totalFound += r.totalFound;
        remaining -= r.totalFound;
        truncated = truncated || r.truncated;
      };

      // Priorité 1 : un seul trimestre d'une même année
      const quarterOrder = buildQuarterSearchOrder(refYear);
      const p1Groups = quarterOrder
        .map(({ year, q }) => ({
          year,
          q,
          items: filteredAllItems.filter(i => i.year === year && i.quarter === q),
        }))
        .filter(g => g.items.length > 0);
      for (let gi = 0; gi < p1Groups.length; gi++) {
        if (searchAbortedRef.current) break;
        await new Promise<void>(resolve => setTimeout(resolve, 0));
        await runPhase(
          1,
          p1Groups[gi].items,
          undefined,
          (gi / p1Groups.length) * 0.25,
          0.25 / Math.max(p1Groups.length, 1)
        );
      }

      // Priorité 2 : multi-trimestres, même année uniquement (si P1 n'a rien trouvé)
      if (totalFound === 0 && !searchAbortedRef.current) {
        const yearsDesc = [...new Set(filteredAllItems.map(i => i.year))].sort((a, b) => b - a);
        for (let yi = 0; yi < yearsDesc.length; yi++) {
          if (searchAbortedRef.current) break;
          await new Promise<void>(resolve => setTimeout(resolve, 0));
          const year = yearsDesc[yi];
          const yearItems = filteredAllItems.filter(i => i.year === year);
          await runPhase(
            2,
            yearItems,
            picks => classifyCombinationPriority(picks) === 2,
            0.25 + (yi / yearsDesc.length) * 0.25,
            0.25 / Math.max(yearsDesc.length, 1)
          );
        }
      }

      // Priorité 3 : recherche mixte progressive par nombre d'années (si P1 & P2 n'ont rien trouvé)
      if (totalFound === 0 && !searchAbortedRef.current) {
        const distinctYearsInItems = [...new Set(filteredAllItems.map(i => i.year))].filter(Boolean).sort((a, b) => b - a);
        const maxY = distinctYearsInItems.length;

        // Helper pour générer les combinaisons mathématiques de taille k
        function getCombinations<T>(array: T[], k: number): T[][] {
          const result: T[][] = [];
          function helper(start: number, path: T[]) {
            if (path.length === k) {
              result.push([...path]);
              return;
            }
            for (let i = start; i < array.length; i++) {
              path.push(array[i]);
              helper(i + 1, path);
              path.pop();
            }
          }
          helper(0, []);
          return result;
        }
        
        const limitYears = Math.min(5, maxY);
        for (let numYears = 2; numYears <= limitYears; numYears++) {
          if (searchAbortedRef.current || totalFound > 0) break;

          // On génère toutes les combinaisons de exactly `numYears` années
          const yearCombos = getCombinations(distinctYearsInItems, numYears);

          // On boucle sur chaque groupe d'années cible (ex. [2024, 2022])
          for (let yci = 0; yci < yearCombos.length; yci++) {
            if (searchAbortedRef.current || totalFound > 0) break;
            
            // Permet de libérer le thread principal et d'éviter que le navigateur ne se fige
            await new Promise<void>(resolve => setTimeout(resolve, 0));

            const targetYears = yearCombos[yci];
            
            // Pré-filtrage strict des items pour ne garder UNIQUE que ces années (réduit la taille matricielle à une poignée d'éléments)
            const subsetItems = filteredAllItems.filter(i => targetYears.includes(i.year));
            if (subsetItems.length === 0) continue;

            // 1. Sous-priorité A : Même trimestre sur des années distinctes
            if (!searchAbortedRef.current && totalFound === 0) {
              // Dans le cas A, on peut filtrer trimestre par trimestre pour accélérer encore plus !
              for (let q = 1; q <= 4; q++) {
                if (searchAbortedRef.current || totalFound > 0) break;
                const qSubsetItems = subsetItems.filter(i => i.quarter === q);
                if (qSubsetItems.length === 0) continue;

                await runPhase(
                  3,
                  qSubsetItems,
                  picks => {
                    const pickedYears = new Set(picks.map(p => p.year).filter(Boolean));
                    if (pickedYears.size !== numYears) return false;
                    const quarters = new Set(picks.map(p => p.quarter));
                    return quarters.size === 1;
                  },
                  0.50 + ((numYears - 2) / Math.max(maxY - 1, 1)) * 0.25,
                  (0.25 / Math.max(maxY - 1, 1)) * 0.25 / 4
                );
              }
            }

            // 2. Sous-priorité C : Blocs complets de trimestres sur plusieurs années
            if (!searchAbortedRef.current && totalFound === 0) {
              await runPhase(
                3,
                subsetItems,
                picks => {
                  const pickedYears = [...new Set(picks.map(p => p.year).filter(Boolean))].sort((a, b) => a - b);
                  if (pickedYears.length !== numYears) return false;
                  const quarters = new Set(picks.map(p => p.quarter));
                  if (quarters.size === 1) return false; // Exclure Cas A
                  let hasCompleteYear = false;
                  for (const year of pickedYears) {
                    const quartersInYear = new Set(picks.filter(p => p.year === year).map(p => p.quarter));
                    if (quartersInYear.size === 4) {
                      hasCompleteYear = true;
                      break;
                    }
                  }
                  return hasCompleteYear;
                },
                0.50 + ((numYears - 2) / Math.max(maxY - 1, 1)) * 0.25 + (0.25 / Math.max(maxY - 1, 1)) * 0.25,
                (0.25 / Math.max(maxY - 1, 1)) * 0.25 / Math.max(yearCombos.length, 1)
              );
            }

            // 3. Sous-priorité B : Mélange libre de trimestres et d'années
            if (!searchAbortedRef.current && totalFound === 0) {
              await runPhase(
                3,
                subsetItems,
                picks => {
                  const pickedYears = [...new Set(picks.map(p => p.year).filter(Boolean))].sort((a, b) => a - b);
                  if (pickedYears.length !== numYears) return false;
                  const quarters = new Set(picks.map(p => p.quarter));
                  if (quarters.size === 1) return false; // Exclure Cas A
                  let hasCompleteYear = false;
                  for (const year of pickedYears) {
                    const quartersInYear = new Set(picks.filter(p => p.year === year).map(p => p.quarter));
                    if (quartersInYear.size === 4) {
                      hasCompleteYear = true;
                      break;
                    }
                  }
                  if (hasCompleteYear) return false; // Exclure Cas C
                  const minYear = pickedYears[0];
                  const maxYear = pickedYears[pickedYears.length - 1];
                  const isCasD = pickedYears.length >= 4 || (maxYear - minYear) >= 5;
                  return !isCasD;
                },
                0.50 + ((numYears - 2) / Math.max(maxY - 1, 1)) * 0.25 + (0.25 / Math.max(maxY - 1, 1)) * 0.50,
                (0.25 / Math.max(maxY - 1, 1)) * 0.25 / Math.max(yearCombos.length, 1)
              );
            }

            // 4. Sous-priorité D : Grand mix multi-années éloignées
            if (!searchAbortedRef.current && totalFound === 0) {
              await runPhase(
                3,
                subsetItems,
                picks => {
                  const pickedYears = [...new Set(picks.map(p => p.year).filter(Boolean))].sort((a, b) => a - b);
                  if (pickedYears.length !== numYears) return false;
                  const quarters = new Set(picks.map(p => p.quarter));
                  if (quarters.size === 1) return false; // Exclure Cas A
                  let hasCompleteYear = false;
                  for (const year of pickedYears) {
                    const quartersInYear = new Set(picks.filter(p => p.year === year).map(p => p.quarter));
                    if (quartersInYear.size === 4) {
                      hasCompleteYear = true;
                      break;
                    }
                  }
                  if (hasCompleteYear) return false; // Exclure Cas C
                  const minYear = pickedYears[0];
                  const maxYear = pickedYears[pickedYears.length - 1];
                  return pickedYears.length >= 4 || (maxYear - minYear) >= 5;
                },
                0.50 + ((numYears - 2) / Math.max(maxY - 1, 1)) * 0.25 + (0.25 / Math.max(maxY - 1, 1)) * 0.75,
                (0.25 / Math.max(maxY - 1, 1)) * 0.25 / Math.max(yearCombos.length, 1)
              );
            }
          }
        }
      }

      // Priorité 4 : recherche élargie et purement aléatoire (si tout le reste est épuisé)
      if (totalFound === 0 && !searchAbortedRef.current) {
        const shuffledItems = [...filteredAllItems].sort(() => Math.random() - 0.5);
        await runPhase(
          4,
          shuffledItems,
          undefined,
          0.75,
          0.25
        );
      }

      if (searchAbortedRef.current) {
        setCombinationMessage(
          `Recherche arrêtée par l'utilisateur. ${nextComboId - 1} combinaison(s) gelée(s) à l'écran.`
        );
        return;
      }

      if (effectiveTarget === null || totalFound === 0) {
        const availableTotal = allItems.reduce((a, it) => a + it.amountCents, 0) / 100;
        setCombinationMessage(
          `Aucune combinaison trouvée pour ${fmt(target)} parmi ${selectedCountInst} abonné(s) et ${allItems.length} facture(s) (total disponible : ${fmt(availableTotal)}).`
        );
        return;
      }

      setCombinationTruncated(truncated);
      if (truncated) {
        setCombinationMessage(
          `${MAX_COMBINATIONS} combinaisons affichées — d'autres solutions peuvent exister.`
        );
      } else if (effectiveTarget !== targetCents) {
        setCombinationMessage(
          `Tolérance de 0,01 DA appliquée (montant effectif : ${fmt(effectiveTarget / 100)}).`
        );
      } else {
        setCombinationMessage(null);
      }
    } finally {
      setCombinationSearching(false);
      setCombinationProgress(0);
      setCombinationCurrentPriority(null);
    }
  };

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
    setPage(1);
  };

  const SortTh = ({ label, col }: { label: string; col: string }) => (
    <th
      className="px-4 py-4 cursor-pointer hover:bg-[#F2F4F7] transition-colors select-none"
      onClick={() => handleSort(col)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === col && <span className="text-brand-600">{sortDir === 'asc' ? '↑' : '↓'}</span>}
      </span>
    </th>
  );

  const exportCSV = () => {
    const headers = [
      'Code Institution', 'Libellé Institution', 'Code Abonné', 'Raison sociale',
      'Adresse', 'Bloc', 'N° Dom', 'Type', 'État Cpt', 'N° Série', 'Tournée',
      'Factures impayées', 'Montant créance', 'Dernier paiement',
    ];
    const lines = selectedRowsInst.flatMap((r: any) =>
      [
        r.codinstit, r.lib_instit, r.numab, r.raisoc, r.adresse, r.bloc, r.ndom,
        r.type_abon, r.etat_cpt, r.numser, r.tournee,
        r.nombre_creance, r.montant_creance, r.derniere_date_paiement,
      ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')
    );
    const blob = new Blob(['\ufeff' + [headers.join(';'), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `creances_institutions_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintCreances = () => {
    if (selectedRowsInst.length === 0 && flatRows.length === 0) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Veuillez autoriser les fenêtres pop-up pour pouvoir imprimer.");
      return;
    }

    const filterTexts = [];
    if (filterCodInstit.length > 0) filterTexts.push(`Code inst. : ${filterCodInstit.join(', ')}`);
    if (filterInstitution.length > 0) filterTexts.push(`Institution : ${filterInstitution.join(', ')}`);
    if (filterTypeAbonInst.length > 0) filterTexts.push(`Type : ${filterTypeAbonInst.join(', ')}`);
    if (filterEtatCptInst.length > 0) filterTexts.push(`État Cpt : ${filterEtatCptInst.join(', ')}`);
    if (filterTourneeInst.length > 0) filterTexts.push(`Tournée : ${filterTourneeInst.join(', ')}`);
    if (search.trim()) filterTexts.push(`Recherche : ${search}`);

    const sourceRows = selectedRowsInst.length > 0 ? selectedRowsInst : flatRows;

    const printTotals = {
      institutions: new Set(sourceRows.map((r: any) => String(r.codinstit || ''))).size,
      count: sourceRows.length,
      montant: sourceRows.reduce((a: number, r: any) => a + (r.montant_creance || 0), 0),
      factures: sourceRows.reduce((a: number, r: any) => a + (r.nombre_creance || 0), 0),
    };

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Créance Institutions</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap');
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              color: #101828;
              margin: 40px;
              font-size: 10px;
              line-height: 1.5;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #F2F4F7;
              padding-bottom: 20px;
              margin-bottom: 25px;
            }
            .logo-section {
              display: flex;
              align-items: center;
              gap: 12px;
            }
            .logo-text {
              font-size: 14px;
              font-weight: 900;
              color: #0D83DE;
              letter-spacing: -0.5px;
              margin-bottom: 2px;
            }
            .company-name {
              font-size: 9px;
              font-weight: 700;
              color: #667085;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .title-section {
              text-align: right;
            }
            .title {
              font-size: 18px;
              font-weight: 900;
              color: #101828;
              margin: 0;
              letter-spacing: -0.5px;
            }
            .subtitle {
              font-size: 10px;
              color: #667085;
              margin: 4px 0 0 0;
              font-weight: 500;
            }
            .filters {
              background-color: #F9FAFB;
              border: 1px solid #E4E7EC;
              border-radius: 12px;
              padding: 12px 20px;
              margin-bottom: 20px;
              font-size: 9px;
            }
            .filter-item {
              margin-bottom: 6px;
            }
            .filter-label {
              font-weight: 700;
              color: #98A2B3;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .filter-value {
              color: #344054;
              margin-left: 8px;
            }
            .meta-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 15px;
              background-color: #F9FAFB;
              border: 1px solid #E4E7EC;
              border-radius: 12px;
              padding: 12px 20px;
              margin-bottom: 30px;
            }
            .meta-item {
              display: flex;
              flex-direction: column;
            }
            .meta-label {
              font-size: 8px;
              font-weight: 700;
              color: #98A2B3;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 3px;
            }
            .meta-value {
              font-size: 11px;
              font-weight: 700;
              color: #344054;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
            }
            thead {
              display: table-header-group;
            }
            tr {
              page-break-inside: avoid;
            }
            th {
              background-color: #F9FAFB;
              color: #475467;
              font-size: 8px;
              text-transform: uppercase;
              font-weight: 700;
              letter-spacing: 0.5px;
              border-bottom: 2px solid #EAECF0;
              padding: 8px 10px;
              text-align: left;
            }
            td {
              border-bottom: 1px solid #EAECF0;
              padding: 8px 10px;
              text-align: left;
              color: #475467;
            }
            .font-bold-black {
              font-weight: 700;
              color: #101828;
            }
            .amount-right {
              text-align: right;
              font-weight: 700;
            }
            @media print {
              body {
                margin: 20px;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo-section">
              <img src="${window.location.origin}/ade.png" alt="ADE Logo" style="height: 40px; width: auto;" />
              <div style="display: flex; flex-direction: column;">
                <span class="logo-text">EPEOR Analytics</span>
                <span class="company-name">Algérienne Des Eaux</span>
              </div>
            </div>
            <div class="title-section">
              <h1 class="title">Créance Institutions</h1>
              <p class="subtitle">Créances des organismes payeurs — liens institutionnels</p>
            </div>
          </div>

          ${filterTexts.length > 0 ? `<div class="filters">${filterTexts.map(t => `<div class="filter-item"><span class="filter-label">Filtres appliqués :</span> ${t}</div>`).join('')}</div>` : ''}

          <div class="meta-grid">
            <div class="meta-item">
              <span class="meta-label">Total Institutions</span>
              <span class="meta-value">${printTotals.institutions}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Total Abonnés</span>
              <span class="meta-value">${printTotals.count}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Montant Total</span>
              <span class="meta-value">${fmt(printTotals.montant)}</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 8%">Code Inst.</th>
                <th style="width: 15%">Institution</th>
                <th style="width: 10%">Code Abonn.</th>
                <th style="width: 15%">Raison Sociale</th>
                <th style="width: 12%">Type</th>
                <th style="width: 8%">État Cpt</th>
                <th style="width: 8%">Tournée</th>
                <th style="width: 6%; text-align: center;">Fact.</th>
                <th style="width: 12%; text-align: right;">Montant Créance</th>
              </tr>
            </thead>
            <tbody>
              ${sourceRows.map(r => `
                <tr>
                  <td class="font-bold-black">${r.codinstit || '—'}</td>
                  <td>${r.lib_instit || '—'}</td>
                  <td class="font-bold-black">${r.numab || '—'}</td>
                  <td>${r.raisoc || '—'}</td>
                  <td>${r.type_abon || '—'}</td>
                  <td>${r.etat_cpt || '—'}</td>
                  <td>${r.tournee ? `T-${r.tournee}` : '—'}</td>
                  <td style="text-align: center;">${r.nombre_creance || 0}</td>
                  <td class="amount-right">${fmt(r.montant_creance || 0)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                setTimeout(function() { window.close(); }, 500);
              }, 300);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handlePrintQuarterlyCreances = () => {
    if (selectedRowsInst.length === 0 && flatRows.length === 0) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Veuillez autoriser les fenêtres pop-up pour pouvoir imprimer.");
      return;
    }

    // determine source rows (selected or all)
    const sourceRows = selectedRowsInst.length > 0 ? selectedRowsInst : flatRows;

    // 1. Find the latest bill date to establish the reference year
    let maxDateStr = "";
    for (const r of sourceRows) {
      if (r.factures && Array.isArray(r.factures)) {
        for (const f of r.factures) {
          const df = String(f.date_fact || "").trim();
          if (df && df.length === 8) {
            if (!maxDateStr || df > maxDateStr) {
              maxDateStr = df;
            }
          }
        }
      }
    }

    // If no date found or date is invalid, default to current local time's year (2026)
    let refYear = 2026;
    if (maxDateStr && maxDateStr.length >= 4) {
      const parsedYear = parseInt(maxDateStr.substring(0, 4), 10);
      if (!isNaN(parsedYear)) {
        refYear = parsedYear;
      }
    }

    // 2. Generate the 11 years (from refYear - 10 to refYear)
    const startYear = refYear - 10;
    const endYear = refYear;
    const antecedentYear = startYear - 1;
    const years: number[] = [];
    for (let y = startYear; y <= endYear; y++) {
      years.push(y);
    }

    // 3. Detect if any subscriber has older debts prior to startYear
    let hasAntecedents = false;
    for (const r of sourceRows) {
      if (r.factures && Array.isArray(r.factures)) {
        for (const f of r.factures) {
          const df = String(f.date_fact || "").trim();
          if (df.length === 8) {
            const y = parseInt(df.substring(0, 4), 10);
            if (y < startYear) {
              hasAntecedents = true;
              break;
            }
          }
        }
      }
      if (hasAntecedents) break;
    }

    // 4. Prepare filters text
    const filterTexts = [];
    if (filterCodInstit.length > 0) filterTexts.push(`Code inst. : ${filterCodInstit.join(', ')}`);
    if (filterInstitution.length > 0) filterTexts.push(`Institution : ${filterInstitution.join(', ')}`);
    if (filterTypeAbonInst.length > 0) filterTexts.push(`Type : ${filterTypeAbonInst.join(', ')}`);
    if (filterEtatCptInst.length > 0) filterTexts.push(`État Cpt : ${filterEtatCptInst.join(', ')}`);
    if (filterTourneeInst.length > 0) filterTexts.push(`Tournée : ${filterTourneeInst.join(', ')}`);
    if (search.trim()) filterTexts.push(`Recherche : ${search}`);

    // Helpers
    const getQuarter = (monthStr: string): number => {
      const m = parseInt(monthStr, 10);
      if (isNaN(m)) return 1;
      if (m >= 1 && m <= 3) return 1;
      if (m >= 4 && m <= 6) return 2;
      if (m >= 7 && m <= 9) return 3;
      if (m >= 10 && m <= 12) return 4;
      return 1;
    };

    // Calculate amounts for each row, handling both monthly (PERIODE=1) and quarterly (PERIODE=3) invoices
    const matrixRows = sourceRows.map((r: any) => {
      const cellAmounts: { [key: string]: number } = {};
      let subscriberTotal = 0;
      let hasMonthly = false;
      let hasQuarterly = false;

      if (r.factures && Array.isArray(r.factures)) {
        for (const f of r.factures) {
          const df = String(f.date_fact || "").trim();
          if (df.length === 8) {
            const y = parseInt(df.substring(0, 4), 10);
            const mStr = df.substring(4, 6);
            const amt = Number(f.montant) || 0;
            const periode = Number(f.periode) || 3; // Default to quarterly

            // Detect invoice type
            if (periode === 1) hasMonthly = true;
            if (periode === 3) hasQuarterly = true;

            // Store amount based on period type
            if (y >= startYear && y <= endYear) {
              if (periode === 1) {
                // Monthly invoice
                const key = `${y}-M${mStr}`;
                cellAmounts[key] = (cellAmounts[key] || 0) + amt;
              } else {
                // Quarterly invoice
                const q = getQuarter(mStr);
                const key = `${y}-Q${q}`;
                cellAmounts[key] = (cellAmounts[key] || 0) + amt;
              }
              subscriberTotal += amt;
            } else if (y < startYear) {
              if (periode === 1) {
                const key = `Ant-M${mStr}`;
                cellAmounts[key] = (cellAmounts[key] || 0) + amt;
              } else {
                const q = getQuarter(mStr);
                const key = `Ant-Q${q}`;
                cellAmounts[key] = (cellAmounts[key] || 0) + amt;
              }
              subscriberTotal += amt;
            }
          }
        }
      }

      // If subscriber has both monthly and quarterly, convert monthly to quarterly
      let finalCellAmounts = cellAmounts;
      if (hasMonthly && hasQuarterly) {
        finalCellAmounts = {};
        for (const [key, value] of Object.entries(cellAmounts)) {
          if (key.includes('-M')) {
            // Convert monthly key to quarterly
            const [yearPart, monthPart] = key.split('-');
            const monthNum = monthPart.substring(1);
            const q = getQuarter(monthNum);
            const newKey = `${yearPart}-Q${q}`;
            finalCellAmounts[newKey] = (finalCellAmounts[newKey] || 0) + (value as number);
          } else {
            // Keep quarterly as-is, summing if key already exists
            finalCellAmounts[key] = (finalCellAmounts[key] || 0) + (value as number);
          }
        }
      }

      return {
        ...r,
        cellAmounts: finalCellAmounts,
        subscriberTotal,
        hasMonthly,
        hasQuarterly,
        isMonthlySolo: hasMonthly && !hasQuarterly
      };
    });

    // Calculate column totals (total per year and grand total)
    const columnTotals: { [key: number]: number } = {};
    let antecedentColumnTotal = 0;
    let grandTotal = 0;

    for (const y of years) {
      columnTotals[y] = 0;
      for (const mr of matrixRows) {
        // Sum both quarterly and monthly amounts
        let yearSum = 0;
        for (let q = 1; q <= 4; q++) {
          yearSum += mr.cellAmounts[`${y}-Q${q}`] || 0;
        }
        for (let m = 1; m <= 12; m++) {
          yearSum += mr.cellAmounts[`${y}-M${String(m).padStart(2, '0')}`] || 0;
        }
        columnTotals[y] += yearSum;
      }
      grandTotal += columnTotals[y];
    }

    if (hasAntecedents) {
      for (const mr of matrixRows) {
        let antSum = 0;
        for (let q = 1; q <= 4; q++) {
          antSum += mr.cellAmounts[`Ant-Q${q}`] || 0;
        }
        for (let m = 1; m <= 12; m++) {
          antSum += mr.cellAmounts[`Ant-M${String(m).padStart(2, '0')}`] || 0;
        }
        antecedentColumnTotal += antSum;
      }
      grandTotal += antecedentColumnTotal;
    }

    const fmtClean = (n: number) => {
      if (n === 0) return "—";
      return new Intl.NumberFormat('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        .format(n).replace(/[\u202F\u00A0]/g, ' ') + ' DA';
    };

    const fmtCleanTotal = (n: number) => {
      return new Intl.NumberFormat('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        .format(n).replace(/[\u202F\u00A0]/g, ' ') + ' DA';
    };

    // Construct print html content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Détails des Créances par Facture et Trimestre (10 ans)</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap');
            @page {
              size: landscape;
              margin: 6mm 6mm;
            }
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              color: #101828;
              margin: 10px;
              font-size: 8px;
              line-height: 1.2;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #F2F4F7;
              padding-bottom: 8px;
              margin-bottom: 10px;
            }
            .logo-section {
              display: flex;
              align-items: center;
              gap: 8px;
            }
            .logo-text {
              font-size: 11px;
              font-weight: 900;
              color: #0D83DE;
              letter-spacing: -0.5px;
              margin-bottom: 1px;
            }
            .company-name {
              font-size: 7px;
              font-weight: 700;
              color: #667085;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .title-section {
              text-align: right;
            }
            .title {
              font-size: 13px;
              font-weight: 900;
              color: #101828;
              margin: 0;
              letter-spacing: -0.5px;
            }
            .subtitle {
              font-size: 8px;
              color: #667085;
              margin: 2px 0 0 0;
              font-weight: 500;
            }
            .filters {
              background-color: #F9FAFB;
              border: 1px solid #E4E7EC;
              border-radius: 6px;
              padding: 6px 12px;
              margin-bottom: 8px;
              font-size: 7px;
            }
            .filter-item {
              margin-bottom: 2px;
            }
            .filter-label {
              font-weight: 700;
              color: #98A2B3;
              text-transform: uppercase;
            }
            .filter-value {
              color: #344054;
              margin-left: 4px;
            }
            .meta-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 10px;
              background-color: #F9FAFB;
              border: 1px solid #E4E7EC;
              border-radius: 6px;
              padding: 6px 12px;
              margin-bottom: 10px;
            }
            .meta-item {
              display: flex;
              flex-direction: column;
            }
            .meta-label {
              font-size: 7px;
              font-weight: 700;
              color: #98A2B3;
              text-transform: uppercase;
              margin-bottom: 1px;
            }
            .meta-value {
              font-size: 9px;
              font-weight: 700;
              color: #344054;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 5px;
            }
            thead {
              display: table-header-group;
            }
            tr {
              page-break-inside: avoid;
            }
            th {
              background-color: #F9FAFB;
              color: #475467;
              font-size: 7.5px;
              text-transform: uppercase;
              font-weight: 700;
              border: 1px solid #EAECF0;
              padding: 4px 6px;
              text-align: center;
            }
            td {
              border: 1px solid #EAECF0;
              padding: 4px 6px;
              text-align: center;
              color: #475467;
              font-size: 7.5px;
            }
            .year-col {
              background-color: #F8F9FC;
              font-weight: 700;
              width: 6.5%;
            }
            .info-cell {
              text-align: center;
              line-height: 1.3;
              width: 10%;
              min-width: 100px;
              font-size: 7.5px;
              background-color: #FFFFFF;
              font-weight: 500;
              vertical-align: middle;
              padding: 4px 6px;
            }
            .info-cell.resilie {
              color: #B91C1C;
              font-weight: 900;
            }
            .info-cell.resilie strong {
              color: #B91C1C;
            }
            .q-label-cell {
              font-weight: 700;
              text-align: left;
              background-color: #F9FAFB;
              font-size: 7.5px;
              color: #344054;
            }
            .order-cell {
              text-align: center;
              vertical-align: middle;
              font-weight: 700;
              width: 4%;
              font-size: 7.5px;
              background-color: #FFFFFF;
            }
            .amount-val {
              font-family: monospace;
              font-size: 7px;
              text-align: center;
              white-space: nowrap;
            }
            .total-cell {
              font-weight: 900;
              font-family: monospace;
              font-size: 7px;
              text-align: center;
            }
            .resilie-row td,
            .resilie-row .total-cell {
              color: #B91C1C !important;
              font-weight: 900;
            }
            .has-value {
              background-color: #FEF3C7; /* amber-100 light highlights for quarterly unpaid bills */
              font-weight: 700;
              color: #B45309;
            }
            .has-value-ant {
              background-color: #FFF5F5; /* light red highlight for antecedents */
              font-weight: 700;
              color: #B91C1C;
            }
            .has-value-ant-subtotal {
              background-color: #FEE2E2; /* sky-100 style red for year subtotals */
              color: #991B1B;
            }
            .has-value-subtotal {
              background-color: #E0F2FE; /* sky-100 for year subtotals */
              color: #0369A1;
            }
            .total-cell {
              font-weight: 900;
              font-family: monospace;
              font-size: 7px;
              text-align: center;
              background-color: #E5E7EB !important;
              color: #111827 !important;
            }
            .subtotal-row {
              background-color: #F3F4F6;
              font-weight: 900;
            }
            .footer-row {
              background-color: #E5E7EB !important;
              color: #111827 !important;
              font-weight: 900;
            }
            .footer-row td {
              border-color: #D1D5DB;
              color: #111827 !important;
              padding: 6px 8px;
            }
            .footer-row .total-sum {
              background-color: #E5E7EB !important;
              color: #111827 !important;
              font-family: monospace;
              font-size: 7.5px;
              text-align: right;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo-section">
              <img src="${window.location.origin}/ade.png" alt="ADE Logo" style="height: 25px; width: auto;" />
              <div style="display: flex; flex-direction: column;">
                <span class="logo-text">EPEOR Analytics</span>
                <span class="company-name">Algérienne Des Eaux</span>
              </div>
            </div>
            <div class="title-section">
              <h1 class="title">Créance Institutions — Impression par Facture</h1>
              <p class="subtitle">Détails des factures impayées (mensuelles et/ou trimestrielles) sur 10 ans (${startYear} - ${endYear})</p>
            </div>
          </div>

          ${filterTexts.length > 0 ? `<div class="filters">${filterTexts.map(t => `<div class="filter-item"><span class="filter-label">Filtres appliqués :</span> ${t}</div>`).join('')}</div>` : ''}

          <div class="meta-grid">
            <div class="meta-item">
              <span class="meta-label">Total Abonnés</span>
              <span class="meta-value">${tableTotals.count}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Période d'Analyse</span>
              <span class="meta-value">10 ans (${startYear} à ${endYear})</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Montant Total Créance Table</span>
              <span class="meta-value">${fmtCleanTotal(grandTotal)}</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 4%">N° Ordre</th>
                <th style="width: 14%; text-align: left;">Informations</th>
                <th style="width: 8%; text-align: left;">Période</th>
                ${hasAntecedents ? `<th class="year-col" style="background-color: #FEE2E2; color: #991B1B;">Ant. ${antecedentYear}</th>` : ''}
                ${years.map(y => `<th class="year-col">${y}</th>`).join('')}
                <th style="width: 10%; background-color: #E5E7EB; color: #111827;">Total Créance</th>
              </tr>
            </thead>
            <tbody>
              ${matrixRows.map((mr, mi) => {
                const monthLabels = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
                const resilieClass = mr.etat_cpt === 'RESILIE' ? 'resilie-row' : '';
                const infoCellClass = mr.etat_cpt === 'RESILIE' ? 'info-cell resilie' : 'info-cell';
                const orderNumber = String(mi + 1).padStart(2, '0');

                let periodsToShow: { label: string; keys: string[] }[] = [];
                let rowSpan = 5;

                if (mr.isMonthlySolo) {
                  // Show 12 months
                  periodsToShow = monthLabels.map((label, idx) => ({
                    label,
                    keys: [String(idx + 1).padStart(2, '0')]
                  }));
                  rowSpan = 13; // 12 months + 1 total row
                } else {
                  // Show 4 quarters
                  periodsToShow = [
                    { label: "1° Trim", keys: ["01", "02", "03"] },
                    { label: "2° Trim", keys: ["04", "05", "06"] },
                    { label: "3° Trim", keys: ["07", "08", "09"] },
                    { label: "4° Trim", keys: ["10", "11", "12"] }
                  ];
                  rowSpan = 5;
                }

                const periodsHtml = periodsToShow.map((period, idx) => {
                  const orderCellHtml = idx === 0 ? `
                    <td rowspan="${rowSpan}" class="order-cell">${orderNumber}</td>
                  ` : '';

                  const infoCellHtml = idx === 0 ? `
                    <td rowspan="${rowSpan}" class="${infoCellClass}">
                      <strong>Code:</strong> ${mr.numab || '—'}<br/>
                      <strong>Nom:</strong> ${mr.raisoc || '—'}<br/>
                      <strong>Adresse:</strong> ${mr.adresse || '—'}<br/>
                      <strong>N° Série:</strong> ${mr.numser || '—'}<br/>
                      <strong>État:</strong> ${mr.etat_cpt || '—'}
                    </td>
                  ` : '';

                  // For monthly: sum the month, for quarterly: sum by quarter

                  // Antecedent cell
                  const antCellHtml = hasAntecedents ? (() => {
                    let antVal = 0;
                    if (mr.isMonthlySolo) {
                      antVal = mr.cellAmounts[`Ant-M${period.keys[0]}`] || 0;
                    } else {
                      const q = parseInt(period.label.charAt(0));
                      antVal = mr.cellAmounts[`Ant-Q${q}`] || 0;
                    }
                    const hasVal = antVal >= 0.01;
                    return `<td class="amount-val ${hasVal ? 'has-value-ant' : ''} ${resilieClass}" style="background-color: #FFF5F5;">${fmtClean(antVal)}</td>`;
                  })() : '';

                  // Year cells
                  const yearCellsHtml = years.map(y => {
                    let val = 0;
                    if (mr.isMonthlySolo) {
                      val = mr.cellAmounts[`${y}-M${period.keys[0]}`] || 0;
                    } else {
                      const q = parseInt(period.label.charAt(0));
                      val = mr.cellAmounts[`${y}-Q${q}`] || 0;
                    }
                    const hasVal = val >= 0.01;
                    return `<td class="amount-val ${hasVal ? 'has-value' : ''} ${resilieClass}">${fmtClean(val)}</td>`;
                  }).join('');

                  // Grand total cell: only on first row, spans all period rows
                  const grandTotalCellHtml = idx === 0 ? `
                    <td rowspan="${rowSpan}" class="total-cell ${resilieClass}" style="
                      background-color: #E5E7EB;
                      color: #111827;
                      font-size: 9px;
                      font-weight: 900;
                      text-align: center;
                      vertical-align: middle;
                      font-family: monospace;
                      white-space: nowrap;
                      border: 2px solid #D1D5DB;
                    ">${fmtCleanTotal(mr.subscriberTotal)}</td>
                  ` : '';

                  return `
                    <tr class="${resilieClass}">
                      ${orderCellHtml}
                      ${infoCellHtml}
                      <td class="q-label-cell">${period.label}</td>
                      ${antCellHtml}
                      ${yearCellsHtml}
                      ${grandTotalCellHtml}
                    </tr>
                  `;
                }).join('');

                // Generate the TOTAL row
                const antTotalCellHtml = hasAntecedents ? (() => {
                  let antTotal = 0;
                  if (mr.isMonthlySolo) {
                    for (let m = 1; m <= 12; m++) {
                      antTotal += mr.cellAmounts[`Ant-M${String(m).padStart(2, '0')}`] || 0;
                    }
                  } else {
                    for (let q = 1; q <= 4; q++) {
                      antTotal += mr.cellAmounts[`Ant-Q${q}`] || 0;
                    }
                  }
                  const hasVal = antTotal >= 0.01;
                  return `<td class="amount-val ${hasVal ? 'has-value-ant-subtotal' : ''}" style="font-weight: 900; background-color: #FEE2E2;">${fmtClean(antTotal)}</td>`;
                })() : '';

                const subTotalYearCellsHtml = years.map(y => {
                  let yearTotal = 0;
                  if (mr.isMonthlySolo) {
                    for (let m = 1; m <= 12; m++) {
                      yearTotal += mr.cellAmounts[`${y}-M${String(m).padStart(2, '0')}`] || 0;
                    }
                  } else {
                    for (let q = 1; q <= 4; q++) {
                      yearTotal += mr.cellAmounts[`${y}-Q${q}`] || 0;
                    }
                  }
                  const hasVal = yearTotal >= 0.01;
                  return `<td class="amount-val ${hasVal ? 'has-value-subtotal' : ''}" style="font-weight: 900;">${fmtClean(yearTotal)}</td>`;
                }).join('');

                const totalRowHtml = `
                  <tr class="subtotal-row ${resilieClass}">
                    <td class="q-label-cell" style="background-color: #EAECF0;">TOTAL</td>
                    ${antTotalCellHtml}
                    ${subTotalYearCellsHtml}
                  </tr>
                `;

                return periodsHtml + totalRowHtml;
              }).join('')}

              <tr class="footer-row">
                <td colspan="3" style="text-align: left;">TOTAL GÉNÉRAL</td>
                ${hasAntecedents ? `<td class="total-sum" style="background-color: #E5E7EB !important; color: #111827 !important; text-align: right;">${fmtCleanTotal(antecedentColumnTotal)}</td>` : ''}
                ${years.map(y => `<td class="total-sum">${fmtCleanTotal(columnTotals[y] || 0)}</td>`).join('')}
                <td class="total-sum" style="background-color: #E5E7EB !important; color: #111827 !important;">${fmtCleanTotal(grandTotal)}</td>
              </tr>
            </tbody>
          </table>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                setTimeout(function() { window.close(); }, 500);
              }, 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handlePrintCombination = (combo: QuarterCombinationResult) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Veuillez autoriser les fenêtres pop-up pour pouvoir imprimer.");
      return;
    }

    const priorityText = PRIORITY_SECTIONS[combo.priority].title;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Impression Combinaison - ${combo.label}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap');
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              color: #101828;
              margin: 40px;
              font-size: 10px;
              line-height: 1.5;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #F2F4F7;
              padding-bottom: 20px;
              margin-bottom: 25px;
            }
            .logo-section {
              display: flex;
              align-items: center;
              gap: 12px;
            }
            .logo-text {
              font-size: 14px;
              font-weight: 900;
              color: #0D83DE;
              letter-spacing: -0.5px;
              margin-bottom: 2px;
            }
            .company-name {
              font-size: 9px;
              font-weight: 700;
              color: #667085;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .title-section {
              text-align: right;
            }
            .title {
              font-size: 18px;
              font-weight: 900;
              color: #101828;
              margin: 0;
              letter-spacing: -0.5px;
            }
            .subtitle {
              font-size: 10px;
              color: #667085;
              margin: 4px 0 0 0;
              font-weight: 500;
            }
            .meta-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 15px;
              background-color: #F9FAFB;
              border: 1px solid #E4E7EC;
              border-radius: 12px;
              padding: 12px 20px;
              margin-bottom: 30px;
            }
            .meta-item {
              display: flex;
              flex-direction: column;
            }
            .meta-label {
              font-size: 8px;
              font-weight: 700;
              color: #98A2B3;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 3px;
            }
            .meta-value {
              font-size: 11px;
              font-weight: 700;
              color: #344054;
            }
            .comb-banner {
              background-color: #F8F9FA;
              border-left: 4px solid #0D83DE;
              padding: 12px 16px;
              border-radius: 0 8px 8px 0;
              margin-bottom: 20px;
            }
            .comb-banner-title {
              font-size: 11px;
              font-weight: 700;
              color: #101828;
            }
            .comb-banner-desc {
              font-size: 9px;
              color: #475467;
              margin-top: 2px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
            }
            thead {
              display: table-header-group;
            }
            tr {
              page-break-inside: avoid;
            }
            th {
              background-color: #F9FAFB;
              color: #475467;
              font-size: 8px;
              text-transform: uppercase;
              font-weight: 700;
              letter-spacing: 0.5px;
              border-bottom: 2px solid #EAECF0;
              padding: 8px 10px;
              text-align: left;
            }
            td {
              border-bottom: 1px solid #EAECF0;
              padding: 8px 10px;
              text-align: left;
              color: #475467;
            }
            .font-bold-black {
              font-weight: 700;
              color: #101828;
            }
            .amount-right {
              text-align: right;
              font-weight: 700;
            }
            .total-row td {
              border-top: 2px solid #EAECF0;
              border-bottom: none;
              font-weight: 900;
              color: #101828;
              background-color: #F9FAFB;
            }
            @media print {
              body {
                margin: 20px;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo-section">
              <img src="${window.location.origin}/ade.png" alt="ADE Logo" style="height: 40px; width: auto;" />
              <div style="display: flex; flex-direction: column;">
                <span class="logo-text">EPEOR Analytics</span>
                <span class="company-name">Algérienne Des Eaux</span>
              </div>
            </div>
            <div class="title-section">
              <h1 class="title">Détails de la combinaison</h1>
              <p class="subtitle">Recherche de combinaison par trimestre</p>
            </div>
          </div>

          <div class="comb-banner">
            <div class="comb-banner-title">Priorité de la combinaison : ${priorityText}</div>
            <div class="comb-banner-desc">${PRIORITY_SECTIONS[combo.priority].description}</div>
          </div>

          <div class="meta-grid">
            <div class="meta-item">
              <span class="meta-label">Label Période</span>
              <span class="meta-value">${combo.label}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Abonnés uniques</span>
              <span class="meta-value">${combo.numabs.length}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Montant Total</span>
              <span class="meta-value">${fmt(combo.sum)}</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 5%">N°</th>
                <th style="width: 15%">Code Abonné</th>
                <th style="width: 25%">Raison Sociale</th>
                <th style="width: 25%">Institution</th>
                <th style="width: 15%">Période</th>
                <th style="width: 15%; text-align: right;">Montant</th>
              </tr>
            </thead>
            <tbody>
              ${combo.lines.map((line, idx) => `
                <tr>
                  <td class="font-bold-black">${String(idx + 1).padStart(2, '0')}</td>
                  <td class="font-bold-black">${line.numab || '—'}</td>
                  <td>${line.raisoc || '—'}</td>
                  <td>
                    ${line.codinstit || '—'}
                    ${line.lib_instit !== '—' ? `<br/><span style="font-size: 8px; color: #667085;">${line.lib_instit}</span>` : ''}
                  </td>
                  <td class="font-bold-black">${line.periodLabel}</td>
                  <td class="amount-right">${fmt(line.amount)}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td colspan="5" style="text-align: right; text-transform: uppercase; font-size: 8px; letter-spacing: 0.5px; padding: 10px;">Total combinaison</td>
                <td class="amount-right" style="color: #E11D48; font-size: 11px; padding: 10px;">${fmt(combo.sum)}</td>
              </tr>
            </tbody>
          </table>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                setTimeout(function() { window.close(); }, 500);
              }, 300);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const inputCls = 'pl-8 pr-4 py-2 bg-[#F9FAFB] border border-[#E4E7EC] rounded-xl text-xs font-bold text-[#101828] placeholder:text-[#98A2B3] outline-none focus:border-brand-300 transition-all w-72';
 

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] p-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-bold text-[#667085] hover:text-[#101828] mb-4 transition-colors"
        >
          <ChevronRight className="rotate-180" size={16} /> Retour au tableau de bord
        </button>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <h2 className="text-3xl font-black tracking-tight text-[#101828]">Créance institutions</h2>
            <p className="text-sm text-[#667085] mt-1 font-medium">
              {secteurLabel
                ? `Créances institutionnelles du centre ${secteurLabel}`
                : 'Créances des organismes payeurs — toute l\'unité (factures impayées)'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <SecteurDropdown
              sectors={sectors}
              selectedSecteur={selectedSecteur}
              onSelect={(code: string) => onSecteurChange?.(code)}
              uniteLabel={uniteLabel}
              loading={sectorsLoading}
            />
            {!dataLoading && rows.length > 0 && (
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-2 rounded-full border border-emerald-100">
                {rows.length} lien{rows.length !== 1 ? 's' : ''} institutionnel{rows.length !== 1 ? 's' : ''}
              </span>
            )}
            {dataLoading && (
              <span className="text-xs font-bold text-[#667085] bg-[#F9FAFB] px-3 py-2 rounded-full border border-[#E4E7EC]">
                Chargement…
              </span>
            )}
          </div>
        </div>

        {secteurLabel && !dataLoading && (
          <div className="flex items-center gap-3 mt-6 px-5 py-3.5 bg-blue-50 border border-blue-100 rounded-2xl text-xs font-bold text-[#0D83DE]">
            <MapPin size={16} className="shrink-0" />
            <span>
              Données limitées au centre <strong className="font-black">{secteurLabel}</strong>
              {uniteLabel ? ` (${uniteLabel})` : ''}. Changez de centre pour recharger le tableau.
            </span>
          </div>
        )}

        <div className="mt-6 p-5 bg-[#F9FAFB] border border-[#E4E7EC] rounded-2xl">
          <p className="text-xs font-black text-[#344054] uppercase tracking-wide mb-1">
            Recherche de combinaison par trimestre
          </p>
          <p className="text-xs text-[#667085] font-medium mb-4">
            Sélectionnez des abonnés, saisissez un montant cible, puis lancez la recherche.
            Les combinaisons s&apos;affichent au fur et à mesure, classées par priorité :
            (1) même trimestre, (2) multi-trimestres d&apos;une même année, (3) mixte inter-années.
          </p>
          <div className="flex flex-col sm:flex-row sm:items-end gap-3 flex-wrap">
            <div>
              <label className="block text-[10px] font-bold text-[#667085] uppercase mb-1.5">
                Montant cible (DA)
              </label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="225105,63"
                value={targetMontantSearch}
                onChange={e => { setTargetMontantSearch(e.target.value); setCombinationResults([]); setCombinationTruncated(false); setCombinationMessage(null); setCombinationCurrentPriority(null); }}
                onKeyDown={e => { if (e.key === 'Enter' && !combinationSearching) searchQuarterCombination(); }}
                disabled={combinationSearching}
                className="py-2.5 px-4 bg-white border border-[#E4E7EC] rounded-xl text-sm font-bold text-[#101828] outline-none focus:border-brand-300 w-full sm:w-48 disabled:opacity-50"
              />
            </div>
            <button
              onClick={searchQuarterCombination}
              disabled={selectedCountInst === 0 || dataLoading || combinationSearching}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white rounded-xl text-xs font-black hover:bg-brand-700 disabled:opacity-50 transition-all active:scale-95"
            >
              {combinationSearching ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Recherche… {Math.round(combinationProgress * 100)}%
                </>
              ) : (
                <>
                  <Search size={13} /> Rechercher
                </>
              )}
            </button>
            {combinationSearching && (
              <button
                onClick={abortSearchQuarterCombination}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-600 text-white rounded-xl text-xs font-black hover:bg-rose-700 transition-all active:scale-95 animate-pulse"
              >
                <Ban size={13} /> Arrêter la recherche
              </button>
            )}
            {combinationResults.length > 0 && (
              <button
                onClick={() => { setCombinationResults([]); setCombinationTruncated(false); setCombinationMessage(null); setCombinationCurrentPriority(null); setExpandedComboIds({}); }}
                className="px-4 py-2.5 bg-white border border-[#E4E7EC] rounded-xl text-xs font-black text-[#475467] hover:bg-[#F9FAFB]"
              >
                Effacer
              </button>
            )}
            {selectedCountInst > 0 && (
              <span className="text-xs font-bold text-[#667085] sm:ml-auto">
                {selectedCountInst} abonné{selectedCountInst !== 1 ? 's' : ''} sélectionné{selectedCountInst !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {(combinationSearching || combinationResults.length > 0) && (
            <div className="mt-4 space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <p className="text-sm font-black text-emerald-800">
                  {combinationResults.length} combinaison{combinationResults.length !== 1 ? 's' : ''} trouvée{combinationResults.length !== 1 ? 's' : ''}
                  {combinationTruncated ? ` (limite : ${MAX_COMBINATIONS} affichées)` : ''}
                </p>
                {combinationSearching && (
                  <span className="inline-flex items-center gap-2 text-xs font-bold text-brand-700">
                    <span className="w-3 h-3 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
                    {combinationCurrentPriority
                      ? `${PRIORITY_SECTIONS[combinationCurrentPriority].title}…`
                      : 'Recherche en cours…'}{' '}
                    {Math.round(combinationProgress * 100)}%
                  </span>
                )}
              </div>

              {combinationSearching && combinationResults.length === 0 && (
                <p className="text-xs text-[#667085] font-medium">
                  Priorité 1 en cours — puis priorité 2, puis priorité 3 (progressive), et enfin priorité 4 si nécessaire.
                </p>
              )}

              {([1, 2, 3, 4] as CombinationPriority[]).map(priority => {
                const combos = combinationByPriority[priority];
                const section = PRIORITY_SECTIONS[priority];
                const isActive = combinationSearching && combinationCurrentPriority === priority;
                if (combos.length === 0 && !isActive) return null;
                return (
                  <div
                    key={priority}
                    className={`rounded-xl border ${section.borderClass} overflow-hidden`}
                  >
                    <div className={`px-4 py-3 border-b ${section.headerClass}`}>
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <p className="text-xs font-black">{section.title}</p>
                          <p className="text-[10px] font-medium mt-0.5 opacity-90">{section.description}</p>
                        </div>
                        <div className="text-right text-[10px] font-bold">
                          {isActive && (
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                              En cours…
                            </span>
                          )}
                          {!isActive && combos.length > 0 && (
                            <span>{combos.length} combinaison{combos.length !== 1 ? 's' : ''}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="p-3 space-y-3 bg-white/40">
                      {combos.length === 0 && isActive && (
                        <p className="text-xs text-[#667085] font-medium px-1">Analyse en cours…</p>
                      )}
                       {combos.map((combo, comboIdx) => {
                        const isExpanded = !!expandedComboIds[combo.id];
                        return (
                          <div
                            key={combo.id}
                            className="p-4 bg-white border border-[#E4E7EC] rounded-xl animate-in fade-in slide-in-from-bottom-2 duration-300 shadow-sm"
                          >
                            <div
                              onClick={() => toggleComboExpand(combo.id)}
                              className="flex items-center justify-between gap-4 cursor-pointer select-none hover:bg-slate-50/50 p-1.5 rounded-lg -m-1.5 transition-colors"
                              title="Cliquer pour afficher ou masquer les détails de la combinaison"
                            >
                              <div>
                                <p className="text-xs font-black text-[#101828]">
                                  Combinaison {comboIdx + 1} — {combo.label}
                                </p>
                                <p className="text-xs text-[#667085] font-bold mt-1">
                                  {combo.numabs.length} abonné{combo.numabs.length !== 1 ? 's' : ''}
                                  {' · '}{combo.pickCount} ligne{combo.pickCount !== 1 ? 's' : ''}
                                  {' · '}Total : {fmt(combo.sum)}
                                </p>
                              </div>
                              <button
                                type="button"
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-[#F2F4F7] border border-[#D0D5DD] text-[#475467] hover:bg-[#E4E7EC] hover:text-[#101828] rounded-lg text-[10px] font-black transition-colors"
                              >
                                {isExpanded ? (
                                  <>
                                    <ChevronDown className="rotate-180 transition-transform duration-200" size={12} />
                                    Masquer les détails
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="transition-transform duration-200" size={12} />
                                    Afficher les détails
                                  </>
                                )}
                              </button>
                            </div>

                            {isExpanded && (
                              <div className="mt-3 overflow-x-auto animate-in fade-in slide-in-from-top-1 duration-200">
                                <table className="w-full text-xs border border-[#E4E7EC] rounded-xl overflow-hidden">
                                  <thead>
                                    <tr className="text-[10px] uppercase text-[#475467] font-bold bg-[#F9FAFB]">
                                      <th className="text-left py-2 px-3 w-10">N°</th>
                                      <th className="text-left py-2 px-3">Code abonné</th>
                                      <th className="text-left py-2 px-3">Raison sociale</th>
                                      <th className="text-left py-2 px-3">Institution</th>
                                      <th className="text-left py-2 px-3">Période</th>
                                      <th className="text-right py-2 px-3">Montant</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {combo.lines.map((line, idx) => (
                                      <tr key={`${combo.id}-${line.numab}-${line.year}-Q${line.quarter}-${idx}`} className="border-t border-[#F2F4F7]">
                                        <td className="py-2 px-3 font-black text-[#344054]">{String(idx + 1).padStart(2, '0')}</td>
                                        <td className="py-2 px-3 font-mono font-bold">{line.numab}</td>
                                        <td className="py-2 px-3">{line.raisoc}</td>
                                        <td className="py-2 px-3">
                                          <span className="font-mono text-[10px] text-[#667085]">{line.codinstit}</span>
                                          {line.lib_instit !== '—' && (
                                            <span className="block text-[10px] text-[#98A2B3]">{line.lib_instit}</span>
                                          )}
                                        </td>
                                        <td className="py-2 px-3 font-bold text-[#344054]">{line.periodLabel}</td>
                                        <td className="py-2 px-3 text-right font-black text-rose-600 whitespace-nowrap">{fmt(line.amount)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                  <tfoot>
                                    <tr className="bg-[#F9FAFB] text-[#101828] font-black border-t-2 border-[#E4E7EC]">
                                      <td colSpan={5} className="py-2 px-3 text-right uppercase text-[10px] tracking-wide">
                                        Total combinaison
                                      </td>
                                      <td className="py-2 px-3 text-right text-rose-700 whitespace-nowrap">{fmt(combo.sum)}</td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                            )}

                            <div className="mt-3 flex items-center gap-2 flex-wrap">
                              <button
                                onClick={() => setSelectedNumabsInst(combo.numabs)}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-[#101828] text-white rounded-xl text-xs font-black hover:bg-[#344054] transition-all active:scale-95"
                              >
                                Appliquer cette sélection ({combo.numabs.length})
                              </button>
                              <button
                                onClick={() => handlePrintCombination(combo)}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-[#D0D5DD] text-[#344054] rounded-xl text-xs font-black hover:bg-[#F9FAFB] hover:text-[#101828] transition-all active:scale-95"
                              >
                                <Printer size={13} /> Imprimer la combinaison
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {combinationMessage && (
            <p className={`mt-3 text-xs font-bold rounded-xl px-4 py-3 border ${
              combinationResults.length > 0
                ? 'text-amber-700 bg-amber-50 border-amber-200'
                : 'text-amber-700 bg-amber-50 border-amber-200'
            }`}>
              {combinationMessage}
            </p>
          )}
        </div>
      </div>

      <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-4 px-8 py-5 border-b border-[#F2F4F7] bg-slate-50/30">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#98A2B3]" />
              <input
                type="text"
                placeholder="Code inst., nom, abonné…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className={inputCls}
              />
            </div>
            <button
              onClick={exportCSV}
              disabled={selectedRowsInst.length === 0 && flatRows.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black hover:bg-emerald-700 disabled:opacity-50 transition-all"
            >
              <FileSpreadsheet size={13} /> CSV
            </button>
            <button
              onClick={handlePrintCreances}
              disabled={selectedRowsInst.length === 0 && flatRows.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-700 border border-rose-100 rounded-xl text-xs font-black hover:bg-rose-100 disabled:opacity-50 transition-all"
              title="Imprimer avec les filtres appliqués"
            >
              <Printer size={13} /> Imprimer
            </button>
            <button
              onClick={handlePrintQuarterlyCreances}
              disabled={selectedRowsInst.length === 0 && flatRows.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-50 text-brand-700 border border-brand-100 rounded-xl text-xs font-black hover:bg-brand-100 disabled:opacity-50 transition-all"
              title="Imprimer le tableau comparatif trimestriel sur 10 ans"
            >
              <Printer size={13} /> Imprimer par Facture (Trimestres)
            </button>
            <button
              onClick={loadData}
              className="px-4 py-2 bg-white border border-[#E4E7EC] rounded-xl text-xs font-black text-[#475467] hover:bg-[#F9FAFB]"
            >
              Actualiser
            </button>
          </div>
        </div>
        <div className="px-8 py-4 border-b border-[#F2F4F7] bg-[#FAFBFC] flex items-center gap-4 overflow-x-auto">
          <div className="min-w-[220px]">
            <MultiSelectDropdown
              label="Code inst."
              options={filterOptions.codinstit}
              selected={filterCodInstit}
              onChange={vals => { setFilterCodInstit(vals); setPage(1); }}
            />
          </div>
          <div className="min-w-[220px]">
            <MultiSelectDropdown
              label="Institution"
              options={filterOptions.institutions}
              selected={filterInstitution}
              onChange={vals => { setFilterInstitution(vals); setPage(1); }}
            />
          </div>
          <div className="min-w-[220px]">
            <MultiSelectDropdown
              label="Type"
              options={filterOptions.types}
              selected={filterTypeAbonInst}
              onChange={vals => { setFilterTypeAbonInst(vals); setPage(1); }}
            />
          </div>
          <div className="min-w-[220px]">
            <MultiSelectDropdown
              label="État Cpt"
              options={filterOptions.etats}
              selected={filterEtatCptInst}
              onChange={vals => { setFilterEtatCptInst(vals); setPage(1); }}
            />
          </div>
          <div className="min-w-[220px]">
            <MultiSelectDropdown
              label="Tournée"
              options={filterOptions.tournees}
              selected={filterTourneeInst}
              onChange={vals => { setFilterTourneeInst(vals); setPage(1); }}
            />
          </div>
        </div>

        {dataLoading ? (
          <div className="flex items-center justify-center gap-3 py-20">
            <div className="w-8 h-8 border-4 border-brand-100 border-t-brand-600 rounded-full animate-spin" />
            <p className="text-sm font-bold text-[#667085]">Calcul des créances institutions…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-16 px-8">
            <p className="text-sm font-bold text-rose-600 text-center">{error}</p>
            <button onClick={loadData} className="px-4 py-2 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-xs font-bold">
              Réessayer
            </button>
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <Building2 size={32} className="text-[#D0D5DD]" />
            <p className="text-sm font-black text-[#667085]">Aucune créance institutionnelle trouvée</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#F9FAFB] text-[#475467] text-[10px] uppercase tracking-wider font-bold border-b border-[#E4E7EC]">
                    <th className="px-4 py-4 w-10">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-[#D0D5DD] text-brand-600"
                        checked={allVisibleSelectedInst}
                        onChange={() => {
                          if (allVisibleSelectedInst) {
                            setSelectedNumabsInst(prev => prev.filter(id => !visibleNumabsInst.includes(id)));
                          } else {
                            setSelectedNumabsInst(prev => Array.from(new Set([...prev, ...visibleNumabsInst])));
                          }
                        }}
                      />
                    </th>
                    <SortTh label="Code Inst." col="codinstit" />
                    <SortTh label="Institution" col="lib_instit" />
                    <SortTh label="Code Abonné" col="numab" />
                    <SortTh label="Raison sociale" col="raisoc" />
                    <SortTh label="Adresse" col="adresse" />
                    <SortTh label="Bloc" col="bloc" />
                    <SortTh label="N° Dom" col="ndom" />
                    <SortTh label="Type" col="type_abon" />
                    <SortTh label="État Cpt" col="etat_cpt" />
                    <SortTh label="N° Série" col="numser" />
                    <SortTh label="Tournée" col="tournee" />
                    <SortTh label="Fact." col="nombre_creance" />
                    <SortTh label="Montant créance" col="montant_creance" />
                    <SortTh label="Dernier paiement" col="derniere_date_paiement" />
                  </tr>
                </thead>
                <tbody>
                  {pagedGroups.map((g: InstitGroup) => {
                    const gt = groupTotals(g);
                    return (
                      <Fragment key={g.codinstit}>
                        <tr className="bg-brand-50 border-t-2 border-brand-200">
                          <td className="px-4 py-3" />
                          <td className="px-4 py-3 font-mono font-black text-brand-900 whitespace-nowrap">
                            {g.codinstit}
                          </td>
                          <td className="px-4 py-3 font-black text-brand-900 max-w-[220px]">
                            {g.lib_instit}
                            <span className="ml-2 text-[10px] font-bold text-brand-600">
                              ({g.rows.length} abonné{g.rows.length !== 1 ? 's' : ''})
                            </span>
                          </td>
                          <td className="px-4 py-3" colSpan={10} />
                          <td className="px-4 py-3 text-center font-black text-brand-900">
                            {gt.factures.toLocaleString('fr-FR')}
                          </td>
                          <td className="px-4 py-3 text-right font-black text-rose-600 whitespace-nowrap">
                            {fmt(gt.montant)}
                          </td>
                          <td className="px-4 py-3" />
                        </tr>
                        {g.rows.map((r: any, i: number) => {
                          const isComboMatch = comboHighlightNumabs.has(r.numab);
                          return (
                          <tr key={`${g.codinstit}-${r.numab}-${i}`} className={`hover:bg-[#F9FAFB] border-b border-[#F2F4F7] ${isComboMatch ? 'bg-emerald-50 ring-1 ring-inset ring-emerald-200' : ''}`}>
                            <td className="px-4 py-2 text-center">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-[#D0D5DD] text-brand-600"
                                checked={selectedNumabsInst.includes(r.numab)}
                                onChange={() => setSelectedNumabsInst(prev => prev.includes(r.numab) ? prev.filter(id => id !== r.numab) : [...prev, r.numab])}
                              />
                            </td>
                            <td className="px-4 py-2" colSpan={2} />
                            <td className="px-4 py-2 font-mono font-bold">{r.numab}</td>
                            <td className="px-4 py-2 font-bold text-[#101828] max-w-[200px]">{r.raisoc}</td>
                            <td className="px-4 py-2 text-[#475467] max-w-[160px]">{r.adresse}</td>
                            <td className="px-4 py-2">{r.bloc}</td>
                            <td className="px-4 py-2">{r.ndom}</td>
                            <td className="px-4 py-2">{r.type_abon}</td>
                            <td className="px-4 py-2">{r.etat_cpt}</td>
                            <td className="px-4 py-2 font-mono text-[10px]">{r.numser}</td>
                            <td className="px-4 py-2 font-bold text-blue-600">{r.tournee}</td>
                            <td className="px-4 py-2 text-center font-bold">{r.nombre_creance}</td>
                            <td className="px-4 py-2 text-right font-black text-rose-600 whitespace-nowrap">{fmt(r.montant_creance)}</td>
                            <td className="px-4 py-2 whitespace-nowrap">{r.derniere_date_paiement}</td>
                          </tr>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-[#0F172A] text-white text-xs font-bold">
                    <td colSpan={11} className="px-4 py-3 uppercase tracking-wide">
                      Total — {tableTotals.institutions} institutions · {tableTotals.count} abonnés
                    </td>
                    <td className="px-4 py-3 text-center">{tableTotals.factures.toLocaleString('fr-FR')}</td>
                    <td className="px-4 py-3 text-right text-rose-300 whitespace-nowrap">{fmt(tableTotals.montant)}</td>
                    <td className="px-4 py-3" />
                  </tr>
                </tfoot>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex justify-between items-center px-8 py-4 border-t border-[#F2F4F7] bg-[#F9FAFB]">
                <p className="text-xs font-bold text-[#667085]">
                  Page {safePage} / {totalPages} · {pagedGroups.length} institutions affichées
                </p>
                <div className="flex gap-2">
                  <button disabled={safePage <= 1} onClick={() => setPage(p => p - 1)}
                    className="px-3.5 py-2 rounded-xl text-xs font-black border border-[#E4E7EC] bg-white disabled:opacity-40">
                    ← Préc.
                  </button>
                  <button disabled={safePage >= totalPages} onClick={() => setPage(p => p + 1)}
                    className="px-3.5 py-2 rounded-xl text-xs font-black border border-[#E4E7EC] bg-white disabled:opacity-40">
                    Suiv. →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

