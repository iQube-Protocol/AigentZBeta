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
 *
 * ── PDF fallback: a rough, honestly-labeled balance estimate (MPY2-2d, 2026-09-06) ──
 *
 * When NO upload in the batch yields usable transaction rows, but at least
 * one PDF-narrative statement's raw text contains a matchable closing-
 * balance figure, `computeFinancialProfile` falls back to
 * `estimateBalanceFromStatementText` — harvested verbatim (formula and all)
 * from the MoneyPenny002 donor repo at the operator's explicit direction,
 * 2026-09-06: "port it, honestly labeled as an estimate." This is NOT
 * transaction-level derivation and must never be presented as one — see
 * that function's own header for exactly what it can and cannot claim.
 * Reported via the separate `balanceEstimate` field (never merged into
 * `aggregates`, whose fields document a stronger guarantee this estimate
 * cannot honestly make) and `inputSource: 'estimated_from_statement_balance'`.
 * A statement that yields neither usable rows nor a matchable balance is
 * still reported `unreadable` (counted honestly, never silently dropped).
 */

import type {
  FinancialProfileAggregates,
  FinancialProfileEnvelope,
  FinancialProfileBalanceEstimate,
  RecurringCommitment,
  ConcentrationCategory,
} from '@/services/iqube/financialProfileQube';

export interface StatementSourceRows {
  uploadId: string;
  /** null when the upload's parsed index carried no `contentJson.rows` —
   *  a non-CSV statement (see module header). */
  rows: Array<Record<string, string>> | null;
  /**
   * The upload's raw indexed text (uploadIndexer's `contentMd`), when it
   * has any — a PDF-narrative statement carries this even though `rows` is
   * null. Used ONLY as the balance-estimate fallback's input when no
   * source in the batch has usable rows; ignored entirely otherwise. `null`
   * for an upload with no indexed text (e.g. a CSV, which already has
   * `rows`, or a failed parse).
   */
  text: string | null;
}

export interface FinancialProfileComputeResult {
  /** True when at least one upload contributed at least one valid,
   *  dated, amount-bearing row, OR a balance estimate was derived. */
  ok: boolean;
  aggregates?: FinancialProfileAggregates;
  /** MPY2-2d fallback result — see module header. Mutually exclusive with
   *  `aggregates` in practice. */
  balanceEstimate?: FinancialProfileBalanceEstimate;
  envelope?: FinancialProfileEnvelope;
  computedFromMonths?: string[];
  readableUploadIds: string[];
  unreadableUploadIds: string[];
  /** Present when `ok` is false, or to note a partial degradation (e.g. no
   *  balance column found anywhere, so liquidityBufferDays is null). */
  notes: string[];
  /** Set only on the balance-estimate fallback path — the normal
   *  transaction-row path leaves this undefined and the caller defaults to
   *  'uploaded_statements' (unchanged behavior). */
  inputSource?: 'estimated_from_statement_balance';
}

// ── Balance-only estimate (MPY2-2d) — harvested from MoneyPenny002 ──────────

const BALANCE_PATTERNS = [
  /(?:closing|ending|final)\s+balance[:\s]+\$?\s*([\d,]+\.?\d*)/i,
  /balance[:\s]+\$?\s*([\d,]+\.?\d*)/i,
  /\$\s*([\d,]+\.?\d*)\s+(?:closing|ending)/i,
];

const STATEMENT_PERIOD_PATTERNS = [
  /(?:statement\s+period|period)[:\s]+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\s*(?:to|through|-)\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
  /(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\s*(?:to|through|-)\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
];

/**
 * Harvested verbatim from MoneyPenny002's `banking-document-parser` edge
 * function (`parseAggregatesFromText`/`computeAggregates`), operator-
 * directed 2026-09-06. This is a REGEX GUESS over a PDF statement's raw
 * text, not real transaction extraction:
 *   - `estimatedAvgDailySurplus` is literally `closingBalance / 30` — it has
 *     no relationship to actual income or spending, only the one balance
 *     figure the regex happened to match.
 *   - `estimatedSurplusVolatility` is a fixed `0.35` multiplier of that
 *     figure — not a computed variance of anything.
 * Never merged into `FinancialProfileAggregates` (see module header) and
 * never presented in the UI without the "estimated from statement balance,
 * not itemized transactions" qualification. Returns `null` — never a
 * fabricated zero — when no balance pattern matches at all.
 */
export function estimateBalanceFromStatementText(text: string): FinancialProfileBalanceEstimate | null {
  let closingBalance: number | null = null;
  for (const pattern of BALANCE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const parsed = Number(match[1].replace(/,/g, ''));
      if (Number.isFinite(parsed)) {
        closingBalance = parsed;
        break;
      }
    }
  }
  if (closingBalance === null || closingBalance <= 0) return null;

  let periodStart: string | null = null;
  let periodEnd: string | null = null;
  for (const pattern of STATEMENT_PERIOD_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      periodStart = match[1];
      periodEnd = match[2];
      break;
    }
  }

  const estimatedAvgDailySurplus = Math.round((closingBalance / 30) * 100) / 100;
  const estimatedSurplusVolatility = Math.round(estimatedAvgDailySurplus * 0.35 * 100) / 100;
  const estimatedCashBufferDays =
    estimatedAvgDailySurplus !== 0
      ? Math.round((closingBalance / Math.abs(estimatedAvgDailySurplus)) * 10) / 10
      : null;

  return {
    estimatedClosingBalance: Math.round(closingBalance * 100) / 100,
    estimatedAvgDailySurplus,
    estimatedSurplusVolatility,
    estimatedCashBufferDays,
    periodStart,
    periodEnd,
  };
}

/**
 * The candidate envelope for a balance-only estimate — the SAME multiplier
 * formula MoneyPenny002's `generateRecommendations` uses (harvested
 * verbatim, 2026-09-06), mapped onto this repo's own `FinancialProfileEnvelope`
 * shape (candidateMaxNotional/candidateLossRiskBudget/liquidityReserve) so
 * the panel renders it through the SAME "Suggested Trading Policy" card the
 * transaction-derived path uses — never a second envelope shape. Still
 * labelled CANDIDATE throughout (constraint 6); `concentrationLimits` is
 * always empty here (no per-category data exists from a single balance
 * figure) and `strategyConstraints` states the estimate's own limits
 * explicitly rather than silently omitting them.
 */
function buildCandidateEnvelopeFromBalanceEstimate(estimate: FinancialProfileBalanceEstimate): FinancialProfileEnvelope {
  const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
  const candidateMaxNotional =
    Math.round(clamp(0.35 * estimate.estimatedAvgDailySurplus, 25, 0.2 * estimate.estimatedClosingBalance) * 100) / 100;
  const candidateLossRiskBudget = Math.round(3 * estimate.estimatedSurplusVolatility * 100) / 100;
  const liquidityReserve = Math.round(estimate.estimatedClosingBalance * 0.2 * 100) / 100;

  return {
    candidateMaxNotional,
    candidateLossRiskBudget,
    liquidityReserve,
    concentrationLimits: [],
    strategyConstraints: [
      'Recommendation only — review before acting; MoneyPenny holds no authority to trade on this envelope.',
      `Derived from a rough balance-only estimate (avg daily surplus = closing balance ÷ 30), not itemized transactions — upload a CSV export for a fully-derived envelope.`,
    ],
  };
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

/**
 * Builds the candidate envelope from already-derived income/expenditure/
 * volatility/concentration figures — the SAME rule regardless of whether
 * those figures came from parsed statement rows or a manual estimate
 * (constraint 6 applies identically to both input paths; there is no
 * second envelope policy). Never proposed when surplus is non-positive
 * (see computeFinancialProfile's original comment, preserved here).
 */
function buildCandidateEnvelope(
  aggregates: Pick<FinancialProfileAggregates, 'availableSurplusMonthly' | 'expenditureMonthly' | 'cashFlowVolatility' | 'topCategories'>,
  notes: string[],
): FinancialProfileEnvelope | undefined {
  const { availableSurplusMonthly, expenditureMonthly, cashFlowVolatility, topCategories } = aggregates;
  if (availableSurplusMonthly <= 0) {
    notes.push('Average monthly expenditure meets or exceeds average monthly income across the observed months — no candidate trading envelope is proposed.');
    return undefined;
  }
  return {
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
}

/**
 * Manual entry — MoneyPenny MPY2-2c (2026-09-02). The person's own
 * self-reported monthly figures, for someone who has no bank-statement
 * export handy but can still describe their finances well enough to be
 * "prepared" (the standing distinction between a reviewed financial
 * profile and supported manual preparation — never navigation alone).
 *
 * Produces the SAME `FinancialProfileAggregates`/`FinancialProfileEnvelope`
 * shapes `computeFinancialProfile` does — never a second financial-state
 * model — but honestly cannot populate the fields that require
 * transaction-level, multi-month observed data: `cashFlowVolatility` stays
 * null (a single point estimate has no variance to measure) and
 * `recurringCommitments`/`topCategories` stay empty (no transaction
 * descriptions exist to group). Both are reported via `notes`, never
 * silently left blank as if nothing was checked.
 */
export interface ManualFinancialProfileInput {
  incomeMonthly: number;
  expenditureMonthly: number;
  /** Optional — the person's own estimate of how many days their current
   *  balance would cover expenditure. Omitted/null when they don't know. */
  liquidityBufferDays?: number | null;
}

export function computeManualFinancialProfile(input: ManualFinancialProfileInput): FinancialProfileComputeResult {
  const notes: string[] = [
    'Self-reported estimate — not derived from uploaded transaction data. Cash-flow volatility, recurring commitments, and expenditure concentration are not available from a single manual entry.',
  ];

  const incomeMonthly = Math.round(input.incomeMonthly * 100) / 100;
  const expenditureMonthly = Math.round(input.expenditureMonthly * 100) / 100;
  const availableSurplusMonthly = Math.round((incomeMonthly - expenditureMonthly) * 100) / 100;
  const liquidityBufferDays =
    typeof input.liquidityBufferDays === 'number' && Number.isFinite(input.liquidityBufferDays)
      ? Math.round(input.liquidityBufferDays * 10) / 10
      : null;

  const aggregates: FinancialProfileAggregates = {
    incomeMonthly,
    expenditureMonthly,
    availableSurplusMonthly,
    cashFlowVolatility: null,
    liquidityBufferDays,
    recurringCommitments: [],
    topCategories: [],
  };

  const envelope = buildCandidateEnvelope(aggregates, notes);

  return {
    ok: true,
    aggregates,
    envelope,
    computedFromMonths: [],
    readableUploadIds: [],
    unreadableUploadIds: [],
    notes,
  };
}

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

  if (allRows.length === 0) {
    // MPY2-2d fallback (2026-09-06): no upload yielded usable transaction
    // rows. Before giving up, see whether any unreadable source at least
    // carries raw text with a matchable closing-balance figure — the
    // balance-only estimate ported from MoneyPenny002 (see module header).
    // This can "rescue" some of the uploads just counted unreadable above,
    // so the readable/unreadable split and note are computed here, not
    // duplicated with the transaction-row path's own bookkeeping.
    const estimateReadableIds: string[] = [];
    const estimateUnreadableIds: string[] = [];
    let balanceEstimate: FinancialProfileBalanceEstimate | null = null;
    for (const source of sources) {
      if (source.rows) continue; // already counted unreadable above (had rows but none parsed) — leave as-is
      if (!balanceEstimate && source.text) {
        const estimate = estimateBalanceFromStatementText(source.text);
        if (estimate) {
          balanceEstimate = estimate;
          estimateReadableIds.push(source.uploadId);
          continue;
        }
      }
      estimateUnreadableIds.push(source.uploadId);
    }

    if (balanceEstimate) {
      const fallbackNotes = [
        `${estimateReadableIds.length} source document(s) yielded a rough balance-only estimate — no itemized ` +
          'transaction data was recognized, so this is derived from a single closing-balance figure, not actual ' +
          'income/spending. Upload a CSV export for a fully-derived envelope.',
      ];
      if (estimateUnreadableIds.length > 0) {
        fallbackNotes.push(
          `${estimateUnreadableIds.length} source document(s) could not be read at all — no recognized ` +
            'date+amount column shape, not a CSV export, and no matchable balance figure. Excluded, never guessed.',
        );
      }
      return {
        ok: true,
        balanceEstimate,
        envelope: buildCandidateEnvelopeFromBalanceEstimate(balanceEstimate),
        inputSource: 'estimated_from_statement_balance',
        readableUploadIds: estimateReadableIds,
        unreadableUploadIds: estimateUnreadableIds,
        notes: fallbackNotes,
      };
    }

    return {
      ok: false,
      readableUploadIds,
      unreadableUploadIds: [...unreadableUploadIds],
      notes: [
        ...notes,
        `${unreadableUploadIds.length} source document(s) could not be read as transaction data — no recognized ` +
          'date+amount column shape, or not a CSV export. Excluded from the aggregates below, never guessed.',
        'No usable transaction rows across any uploaded document, and no matchable balance figure either.',
      ],
    };
  }

  if (unreadableUploadIds.length > 0) {
    notes.push(
      `${unreadableUploadIds.length} source document(s) could not be read as transaction data — no recognized ` +
        'date+amount column shape, or not a CSV export. Excluded from the aggregates below, never guessed.',
    );
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
  // analysis" overreach constraint 1 forbids. Shared with the manual-entry
  // path via buildCandidateEnvelope — one envelope policy, not two.
  const envelope = buildCandidateEnvelope(aggregates, notes);

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
