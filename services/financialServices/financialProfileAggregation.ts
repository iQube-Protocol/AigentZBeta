/**
 * Financial Profile aggregation — MoneyPenny MPY2-2 (SPEC-MPY-002 §5).
 *
 * Pure derivation from ALREADY-PARSED statement rows (the shape
 * services/uploads/uploadIndexer.ts's CSV path already produces:
 * `Record<string, string>[]` keyed by raw header text) into the bounded
 * aggregates and candidate envelope §5's desired flow describes. No I/O, no
 * clock reliance beyond the dates present in the input rows themselves —
 * a run over the same rows always produces the same result.
 *
 * ── Hard constraint discipline (spec §5) ────────────────────────────────────
 *
 *   1. Never copies a donor's simplistic balance-derived formula as
 *      authoritative — every figure here is a plainly-documented, tunable
 *      heuristic, not asserted as financial advice.
 *   2. Produces DERIVED, BOUNDED aggregates only — never re-exports the raw
 *      row text; the caller never passes this module raw statement bytes,
 *      only the already-parsed rows.
 *   3. A statement whose column shape this module cannot recognize is
 *      reported unreadable, never silently coerced into a guess — the "no
 *      guessing" rule applies to bank statements exactly as it does to
 *      everything else in this repo.
 *   6. `candidateMaxNotional`/`candidateLossRiskBudget`/etc. are labelled
 *      CANDIDATE throughout — nothing here is authority to trade.
 *
 * ── Scope of this first slice ───────────────────────────────────────────────
 *
 * CSV-shaped statements only (the common bank/card export format: one row
 * per transaction, a date column, an amount or debit/credit pair, optionally
 * a balance and/or category column). A PDF-narrative statement's free text
 * (uploadIndexer's `contentMd`, no `contentJson`) is NOT parsed into
 * transactions here — reliably extracting transaction rows from arbitrary
 * PDF layouts without guessing is a genuinely separate, larger problem.
 * Such uploads are reported `unreadable` (counted honestly, never silently
 * dropped) rather than approximated.
 */

import type {
  FinancialProfileAggregates,
  FinancialProfileEnvelope,
  RecurringCommitment,
  ConcentrationCategory,
} from '@/services/iqube/financialProfileQube';

export interface StatementSourceRows {
  uploadId: string;
  /** null when the upload's parsed index carried no `contentJson.rows` —
   *  a non-CSV statement (see module header). */
  rows: Array<Record<string, string>> | null;
}

export interface FinancialProfileComputeResult {
  /** True when at least one upload contributed at least one valid,
   *  dated, amount-bearing row. */
  ok: boolean;
  aggregates?: FinancialProfileAggregates;
  envelope?: FinancialProfileEnvelope;
  computedFromMonths?: string[];
  readableUploadIds: string[];
  unreadableUploadIds: string[];
  /** Present when `ok` is false, or to note a partial degradation (e.g. no
   *  balance column found anywhere, so liquidityBufferDays is null). */
  notes: string[];
}

// ── Column recognition — case-insensitive header matching, never guessed
//    from cell CONTENT (only from the header the statement itself declares). ──

const DATE_HEADERS = /^(date|transaction date|posted date|trans date|txn date)$/i;
const DESCRIPTION_HEADERS = /^(description|memo|narrative|details|payee|merchant)$/i;
const AMOUNT_HEADERS = /^(amount|amt|value)$/i;
const DEBIT_HEADERS = /^(debit|withdrawal|money out|paid out|debit amount)$/i;
const CREDIT_HEADERS = /^(credit|deposit|money in|paid in|credit amount)$/i;
const BALANCE_HEADERS = /^(balance|running balance|closing balance|available balance)$/i;
const CATEGORY_HEADERS = /^(category|type|transaction type)$/i;

interface RecognizedColumns {
  date: string | null;
  description: string | null;
  amount: string | null;
  debit: string | null;
  credit: string | null;
  balance: string | null;
  category: string | null;
}

function recognizeColumns(columns: string[]): RecognizedColumns {
  const find = (re: RegExp) => columns.find((c) => re.test(c.trim())) ?? null;
  return {
    date: find(DATE_HEADERS),
    description: find(DESCRIPTION_HEADERS),
    amount: find(AMOUNT_HEADERS),
    debit: find(DEBIT_HEADERS),
    credit: find(CREDIT_HEADERS),
    balance: find(BALANCE_HEADERS),
    category: find(CATEGORY_HEADERS),
  };
}

/** A statement is usable when it has a date AND (a signed amount column OR
 *  a debit/credit pair). Description/balance/category are optional
 *  enrichments, not requirements. */
function isUsable(cols: RecognizedColumns): boolean {
  return Boolean(cols.date && (cols.amount || cols.debit || cols.credit));
}

function parseAmount(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[,$£€\s]/g, '').replace(/^\((.*)\)$/, '-$1'); // "(50.00)" -> "-50.00"
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Returns `{monthKey: 'YYYY-MM', isoDate}` or null when the cell does not
 *  parse as a date — never a guessed date. */
function parseDate(raw: string | undefined): { monthKey: string; isoDate: string } | null {
  if (!raw) return null;
  const t = Date.parse(raw.trim());
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  const monthKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  return { monthKey, isoDate: d.toISOString().slice(0, 10) };
}

/** Bounded, deterministic normalization for grouping recurring
 *  commitments/fallback categories — strips digits/punctuation so
 *  "NETFLIX.COM #4471" and "Netflix.com #8823" group together, never a
 *  fuzzy/ML match. */
function normalizeDescription(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[0-9]+/g, '')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface ParsedRow {
  uploadId: string;
  monthKey: string;
  isoDate: string;
  amount: number; // signed: positive = credit/income, negative = debit/expenditure
  description: string;
  category: string | null;
  balance: number | null;
}

function parseUsableRows(uploadId: string, columns: string[], rows: Array<Record<string, string>>): ParsedRow[] {
  const cols = recognizeColumns(columns);
  if (!isUsable(cols)) return [];
  const out: ParsedRow[] = [];
  for (const row of rows) {
    const date = parseDate(cols.date ? row[cols.date] : undefined);
    if (!date) continue;

    let amount: number | null = null;
    if (cols.amount) {
      amount = parseAmount(row[cols.amount]);
    } else if (cols.debit || cols.credit) {
      const debit = cols.debit ? parseAmount(row[cols.debit]) : null;
      const credit = cols.credit ? parseAmount(row[cols.credit]) : null;
      if (debit !== null || credit !== null) {
        amount = (credit ?? 0) - Math.abs(debit ?? 0);
      }
    }
    if (amount === null || amount === 0) continue;

    out.push({
      uploadId,
      monthKey: date.monthKey,
      isoDate: date.isoDate,
      amount,
      description: cols.description ? row[cols.description] ?? '' : '',
      category: cols.category ? row[cols.category] ?? null : null,
      balance: cols.balance ? parseAmount(row[cols.balance]) : null,
    });
  }
  return out;
}

function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: number[], avg: number): number {
  if (values.length < 2) return 0;
  const variance = mean(values.map((v) => (v - avg) ** 2));
  return Math.sqrt(variance);
}

/**
 * Tunable envelope multipliers (SPEC-MPY-002 §5 desired-flow terms). Named
 * and documented, not magic numbers — the same discipline
 * admissionRecommendation.ts's CONFIDENCE_* constants use. Conservative by
 * design: the candidate envelope should never exceed a small fraction of
 * observed surplus.
 */
const CANDIDATE_MAX_NOTIONAL_MONTHS = 3; // months of surplus
const CANDIDATE_LOSS_RISK_BUDGET_FRACTION = 0.2; // of monthly surplus
const LIQUIDITY_RESERVE_MONTHS = 3; // months of expenditure

export function computeFinancialProfile(sources: readonly StatementSourceRows[]): FinancialProfileComputeResult {
  const readableUploadIds: string[] = [];
  const unreadableUploadIds: string[] = [];
  const notes: string[] = [];
  const allRows: ParsedRow[] = [];

  for (const source of sources) {
    if (!source.rows) {
      unreadableUploadIds.push(source.uploadId);
      continue;
    }
    // Recover the column list from the rows themselves (uploadIndexer's
    // schemaMeta.columns is the authoritative source when the caller has
    // it; falling back to the first row's own keys keeps this function
    // usable with either).
    const columns = source.rows.length > 0 ? Object.keys(source.rows[0]) : [];
    const parsed = parseUsableRows(source.uploadId, columns, source.rows);
    if (parsed.length === 0) {
      unreadableUploadIds.push(source.uploadId);
      continue;
    }
    readableUploadIds.push(source.uploadId);
    allRows.push(...parsed);
  }

  if (unreadableUploadIds.length > 0) {
    notes.push(
      `${unreadableUploadIds.length} source document(s) could not be read as transaction data — no recognized ` +
        'date+amount column shape, or not a CSV export. Excluded from the aggregates below, never guessed.',
    );
  }

  if (allRows.length === 0) {
    return { ok: false, readableUploadIds, unreadableUploadIds, notes: [...notes, 'No usable transaction rows across any uploaded document.'] };
  }

  const byMonth = new Map<string, ParsedRow[]>();
  for (const row of allRows) {
    const list = byMonth.get(row.monthKey) ?? [];
    list.push(row);
    byMonth.set(row.monthKey, list);
  }
  const months = [...byMonth.keys()].sort();

  const monthlyIncome: number[] = [];
  const monthlyExpenditure: number[] = [];
  const monthlyNet: number[] = [];
  for (const month of months) {
    const rows = byMonth.get(month)!;
    const income = rows.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0);
    const expenditure = rows.filter((r) => r.amount < 0).reduce((s, r) => s + Math.abs(r.amount), 0);
    monthlyIncome.push(income);
    monthlyExpenditure.push(expenditure);
    monthlyNet.push(income - expenditure);
  }

  const incomeMonthly = mean(monthlyIncome);
  const expenditureMonthly = mean(monthlyExpenditure);
  const availableSurplusMonthly = incomeMonthly - expenditureMonthly;

  const netMean = mean(monthlyNet);
  const cashFlowVolatility =
    months.length >= 2 && netMean !== 0 ? Math.abs(stdDev(monthlyNet, netMean) / netMean) : null;
  if (months.length < 2) {
    notes.push('Only one statement month observed — cashFlowVolatility is not computable from a single month, reported as null rather than 0.');
  }

  // Liquidity buffer — from the LATEST row (by isoDate) that carried a
  // balance value, across every upload. Null when no upload had a balance
  // column at all.
  const rowsWithBalance = allRows.filter((r) => r.balance !== null);
  let liquidityBufferDays: number | null = null;
  if (rowsWithBalance.length > 0 && expenditureMonthly > 0) {
    const latest = [...rowsWithBalance].sort((a, b) => (a.isoDate < b.isoDate ? 1 : -1))[0];
    liquidityBufferDays = Math.round((latest.balance! / (expenditureMonthly / 30)) * 10) / 10;
  } else if (rowsWithBalance.length === 0) {
    notes.push('No uploaded statement carried a balance column — liquidityBufferDays is not computable, reported as null rather than guessed.');
  }

  // Recurring commitments — expenditure rows grouped by normalized
  // description, kept only when observed in >=2 distinct months (a single
  // occurrence is a one-off expense, not a recurring commitment).
  const expenditureRows = allRows.filter((r) => r.amount < 0 && r.description);
  const byNormalizedDescription = new Map<string, ParsedRow[]>();
  for (const row of expenditureRows) {
    const key = normalizeDescription(row.description);
    if (!key) continue;
    const list = byNormalizedDescription.get(key) ?? [];
    list.push(row);
    byNormalizedDescription.set(key, list);
  }
  const recurringCommitments: RecurringCommitment[] = [];
  for (const [key, rows] of byNormalizedDescription) {
    const monthsObserved = new Set(rows.map((r) => r.monthKey)).size;
    if (monthsObserved < 2) continue;
    const total = rows.reduce((s, r) => s + Math.abs(r.amount), 0);
    recurringCommitments.push({
      label: rows[0].description.trim() || key,
      monthlyAmount: Math.round((total / monthsObserved) * 100) / 100,
      observedMonths: monthsObserved,
    });
  }
  recurringCommitments.sort((a, b) => b.monthlyAmount - a.monthlyAmount);

  // Concentration — by category column when any upload declared one,
  // otherwise by the same normalized-description grouping as above
  // (documented fallback, never a fabricated category taxonomy).
  const hasCategoryColumn = allRows.some((r) => r.category);
  const byGroup = new Map<string, number>();
  for (const row of expenditureRows) {
    const key = hasCategoryColumn ? (row.category?.trim() || 'Uncategorized') : normalizeDescription(row.description) || 'Uncategorized';
    byGroup.set(key, (byGroup.get(key) ?? 0) + Math.abs(row.amount));
  }
  const monthCount = months.length;
  const topCategories: ConcentrationCategory[] = [...byGroup.entries()]
    .map(([category, total]) => ({
      category,
      monthlyAmount: Math.round((total / monthCount) * 100) / 100,
      shareOfExpenditure: expenditureMonthly > 0 ? Math.round((total / monthCount / expenditureMonthly) * 1000) / 1000 : 0,
    }))
    .sort((a, b) => b.monthlyAmount - a.monthlyAmount)
    .slice(0, 5);

  const aggregates: FinancialProfileAggregates = {
    incomeMonthly: Math.round(incomeMonthly * 100) / 100,
    expenditureMonthly: Math.round(expenditureMonthly * 100) / 100,
    availableSurplusMonthly: Math.round(availableSurplusMonthly * 100) / 100,
    cashFlowVolatility: cashFlowVolatility === null ? null : Math.round(cashFlowVolatility * 1000) / 1000,
    liquidityBufferDays,
    recurringCommitments,
    topCategories,
  };

  // Envelope — CANDIDATE only (constraint 6). Never proposed when surplus
  // is non-positive: a recommendation to risk money the profile shows the
  // person does not have would be exactly the "authoritative financial
  // analysis" overreach constraint 1 forbids.
  let envelope: FinancialProfileEnvelope | undefined;
  if (availableSurplusMonthly > 0) {
    envelope = {
      candidateMaxNotional: Math.round(availableSurplusMonthly * CANDIDATE_MAX_NOTIONAL_MONTHS * 100) / 100,
      candidateLossRiskBudget: Math.round(availableSurplusMonthly * CANDIDATE_LOSS_RISK_BUDGET_FRACTION * 100) / 100,
      liquidityReserve: Math.round(expenditureMonthly * LIQUIDITY_RESERVE_MONTHS * 100) / 100,
      concentrationLimits: topCategories
        .filter((c) => c.shareOfExpenditure > 0.3)
        .map((c) => `${c.category}: currently ${(c.shareOfExpenditure * 100).toFixed(0)}% of monthly expenditure — consider a concentration limit here`),
      strategyConstraints: [
        'Recommendation only — review before acting; MoneyPenny holds no authority to trade on this envelope.',
        ...(cashFlowVolatility !== null && cashFlowVolatility > 0.5 ? ['Cash flow is highly variable month to month — consider a smaller notional until more months of data are observed.'] : []),
      ],
    };
  } else {
    notes.push('Average monthly expenditure meets or exceeds average monthly income across the observed months — no candidate trading envelope is proposed.');
  }

  return {
    ok: true,
    aggregates,
    envelope,
    computedFromMonths: months,
    readableUploadIds,
    unreadableUploadIds,
    notes,
  };
}
