/**
 * FinancialProfileQube service — per-persona governed container for
 * MoneyPenny's Financial Profile capability (SPEC-MPY-002 §5, work package
 * MPY2-2).
 *
 * Mirrors services/iqube/experienceQube.ts's meta/blak split exactly — that
 * is the canonical per-persona BlakQube pattern this repo already has
 * (docs/platform-ontology.md: BlakQube = the highest-confidentiality
 * compartment). No new pattern is introduced.
 *
 * Two slices:
 *   - meta — public-safe (T1). Whether a profile exists, when it was last
 *     computed, how many source documents contributed. Surfaces to the
 *     browser for any caller.
 *   - blak — private payload (T0). The actual derived aggregates and
 *     candidate envelope. Only this service may read it; routes emit it
 *     ONLY to the authenticated OWNER (self-view), never to a receipt,
 *     chain-bound payload, or external AEE/rendering provider
 *     (SPEC-MPY-002 §5 hard constraint 4).
 *
 * What this service does NOT store: the raw bank statement. The source
 * document (and its parsed text/rows) stays in persona_uploads /
 * persona_upload_index (services/uploads/*, use_kind 'financial_document')
 * — the one truth store for the document. This qube holds only what
 * services/financialServices/financialProfileAggregation.ts derives from
 * it. That split is what keeps this a single canonical financial-state
 * model rather than a second `bank_statements` store (constraint 2).
 *
 * Server-only — never imported from a browser bundle.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

// ─────────────────────────────────────────────────────────────────────────
// Types — meta (T1) vs blak (T0).
// ─────────────────────────────────────────────────────────────────────────

/** Public-safe slice — surfaces to the browser. T1. Never the aggregates
 *  themselves — only whether/when/how-many. */
export interface FinancialProfileQubeMeta {
  hasProfile: boolean;
  lastComputedAt: string | null;
  sourceUploadCount: number;
  unreadableUploadCount: number;
}

export interface RecurringCommitment {
  label: string;
  monthlyAmount: number;
  /** How many statement months this commitment was observed in — the
   *  aggregator's own confidence signal, never a fabricated one. */
  observedMonths: number;
}

export interface ConcentrationCategory {
  category: string;
  monthlyAmount: number;
  shareOfExpenditure: number;
}

export interface FinancialProfileAggregates {
  incomeMonthly: number;
  expenditureMonthly: number;
  availableSurplusMonthly: number;
  /**
   * Coefficient of variation of monthly net cash flow across the observed
   * months. `null` when fewer than 2 distinct months are observed — a
   * volatility figure computed from one data point would be a fabrication,
   * never a real 0.
   */
  cashFlowVolatility: number | null;
  /**
   * Estimated days the most recent observed balance would cover average
   * monthly expenditure. `null` when no statement in the batch carried a
   * running/ending balance column — never guessed from transaction totals
   * alone, which is not the same fact.
   */
  liquidityBufferDays: number | null;
  recurringCommitments: RecurringCommitment[];
  topCategories: ConcentrationCategory[];
}

export interface FinancialProfileEnvelope {
  /** A recommendation, never authority to trade (constraint 6). Any later
   *  Runtime enforcement requires the canonical authority/delegation/CTP
   *  path for the consequential act (constraint 7) — this qube grants
   *  none of that itself. */
  candidateMaxNotional: number;
  candidateLossRiskBudget: number;
  liquidityReserve: number;
  concentrationLimits: string[];
  strategyConstraints: string[];
}

/**
 * SPEC-MPY-002 MPY2-3 (2026-09-01) — the Risk Envelope. Distinct from
 * `FinancialProfileEnvelope` above (MPY2-2's cheap inline heuristic,
 * unchanged, still shown on the Financial Profile panel): this is the
 * named-risk-factor assessment plus the refined limit set MoneyPenny's
 * Risk & Limits capability derives FROM the same aggregates — never a
 * second copy of the raw statement, never a second financial-state model.
 * See services/financialServices/riskEnvelope.ts for the derivation.
 */
export type RiskCategory = 'liquidity' | 'concentration' | 'volatility' | 'commitment-coverage';
export type RiskSeverity = 'low' | 'moderate' | 'elevated' | 'high';

export interface RiskFactor {
  category: RiskCategory;
  severity: RiskSeverity;
  rationale: string;
  /** Which aggregate field(s) this factor was derived from — the "why do
   *  you say that" trail, never an unexplained score. */
  derivedFrom: string;
}

export interface RiskAssessment {
  factors: RiskFactor[];
  /** A risk category the assessor could not evaluate because the
   *  underlying aggregate is null/absent (e.g. no liquidity risk factor
   *  when `liquidityBufferDays` is null) — reported explicitly, never
   *  silently dropped and never defaulted to 'low'. */
  unassessed: Array<{ category: RiskCategory; reason: string }>;
}

export interface ConcentrationLimit {
  category: string;
  /** Maximum recommended share of monthly expenditure for this category. */
  limitShare: number;
  rationale: string;
}

export interface RiskLimits {
  /** The refined successor to FinancialProfileEnvelope's flat multiplier —
   *  each figure here cites the risk factor(s) that produced it. */
  positionNotionalLimit: number;
  lossRiskBudget: number;
  drawdownLimit: number;
  liquidityReserve: number;
  concentrationLimits: ConcentrationLimit[];
  /**
   * ALWAYS 'PROPOSAL' — reuses `types/financialServices.ts`'s existing
   * `FinancialServiceConsequenceClass` vocabulary rather than inventing a
   * parallel one (the same three-rung Advisor/Architect/Runtime axis every
   * other MoneyPenny service already declares itself against). A Risk
   * Envelope is Architect-tier: it proposes limits, it never enforces them.
   * Real enforcement of any limit against a real order requires an
   * authorized agreement through the EXISTING Runtime/
   * services/constitutional/constitutionalAgreement.ts gate (the canonical
   * authority/delegation/CTP path) — this qube grants none of that itself.
   */
  serviceClass: 'PROPOSAL';
  rationale: string[];
}

/** Private payload — server-side only. T0. */
export interface FinancialProfileQubeBlak {
  aggregates?: FinancialProfileAggregates;
  envelope?: FinancialProfileEnvelope;
  riskAssessment?: RiskAssessment;
  riskLimits?: RiskLimits;
  sourceUploadIds?: string[];
  /** Which statement periods contributed, in the aggregator's own labels
   *  (e.g. '2026-07') — for the owner's own review, never asserted as
   *  complete coverage. */
  computedFromMonths?: string[];
  /**
   * MPY2-2c (2026-09-02) — which input path produced this compute pass.
   * Absent on rows written before this field existed; callers must treat
   * absent the same as `'uploaded_statements'` (the only path that existed
   * then), never as unknown. Surfaced to the owner so a self-reported
   * estimate is never mistaken for statement-derived precision.
   */
  inputSource?: 'uploaded_statements' | 'manual_entry';
}

export interface FinancialProfileQubeRecord {
  id: string;
  meta: FinancialProfileQubeMeta;
  /** NEVER serialise this in a route response except the owner's own
   *  authenticated self-view. */
  blak: FinancialProfileQubeBlak;
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────
// Internal — DB row shape.
// ─────────────────────────────────────────────────────────────────────────

interface DbRow {
  id: string;
  persona_id: string;
  has_profile: boolean;
  last_computed_at: string | null;
  source_upload_count: number;
  unreadable_upload_count: number;
  blak_qube: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

function rowToRecord(row: DbRow): FinancialProfileQubeRecord {
  return {
    id: row.id,
    meta: {
      hasProfile: row.has_profile,
      lastComputedAt: row.last_computed_at,
      sourceUploadCount: row.source_upload_count,
      unreadableUploadCount: row.unreadable_upload_count,
    },
    blak: (row.blak_qube ?? {}) as FinancialProfileQubeBlak,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getAdminClient() {
  const client = getSupabaseServer();
  if (!client) throw new Error('Supabase configuration missing for FinancialProfileQube service');
  return client;
}

const DB_TIMEOUT_MS = Number(process.env.FINANCIAL_PROFILE_QUBE_DB_TIMEOUT_MS) || 6000;

// `PromiseLike<T>`, not `Promise<T>` — the Supabase query builder is
// thenable but not nominally a Promise, which trips this under the
// project's TS/supabase-js version pairing (the same shape as an existing
// baseline quirk in experienceQube.ts). `Promise.resolve` normalizes it
// without changing behavior.
function withTimeout<T>(promise: PromiseLike<T>, op: string): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              `[FinancialProfileQube] ${op} timed out after ${DB_TIMEOUT_MS}ms. ` +
                `Check that the financial_profile_qubes migration has been applied ` +
                `(supabase/migrations/20260930180000_financial_profile_qubes.sql) ` +
                `and that the Supabase project is reachable.`,
            ),
          ),
        DB_TIMEOUT_MS,
      ),
    ),
  ]);
}

/** Same detection as experienceQube.ts's isMissingTable — a genuinely
 *  missing table degrades to "no profile yet", never a false uncertainty. */
function isMissingTable(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === '42P01') return true;
  if (error.code === 'PGRST205') return true;
  if (typeof error.message === 'string' && /relation .* does not exist/i.test(error.message)) return true;
  return false;
}

/**
 * Thrown by `upsertFinancialProfileQube` (2026-09-02 migration-honesty fix)
 * when `financial_profile_qubes` does not exist yet — distinct from every
 * other write failure so a WRITE attempt (compute/manual entry) can surface
 * "this feature isn't set up in this environment yet" instead of a generic
 * crash. The READ path (`getFinancialProfileQube`) keeps degrading silently
 * to `null` on the same condition — a passive read seeing "no profile" is
 * the same honest degrade this codebase uses everywhere else (getPlacement,
 * getPlacementsForSection); it is an ACTIVE write that deserves a distinct,
 * named signal, because "your action failed" and "no data exists yet" are
 * different facts a user acting on the result needs told apart.
 */
export class FinancialProfileTableMissingError extends Error {
  constructor() {
    super(
      'financial_profile_qubes does not exist in this environment yet — apply ' +
        'supabase/migrations/20260930180000_financial_profile_qubes.sql before this feature can save a profile.',
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Reads.
// ─────────────────────────────────────────────────────────────────────────

/** Read the persona's FinancialProfileQube. Returns null when no profile
 *  has been computed yet (or the migration hasn't landed) — the canonical
 *  reader every MoneyPenny Financial Profile surface calls. */
export async function getFinancialProfileQube(personaId: string): Promise<FinancialProfileQubeRecord | null> {
  const admin = getAdminClient();
  const result = await withTimeout(
    admin.from('financial_profile_qubes').select('*').eq('persona_id', personaId).maybeSingle(),
    'getFinancialProfileQube',
  );
  const { data, error } = result as { data: unknown; error: { code?: string; message?: string } | null };
  if (error) {
    if (isMissingTable(error)) {
      console.warn(
        '[FinancialProfileQube] financial_profile_qubes table missing — returning null. ' +
          'Apply supabase/migrations/20260930180000_financial_profile_qubes.sql.',
      );
      return null;
    }
    throw new Error(`getFinancialProfileQube failed: ${error.message ?? 'unknown error'}`);
  }
  if (!data) return null;
  return rowToRecord(data as DbRow);
}

// ─────────────────────────────────────────────────────────────────────────
// Writes — upsert on the persona-id unique key. The compute route is the
// ONLY caller: this qube's blak is always REPLACED wholesale by a fresh
// compute pass, never patched field-by-field like ExperienceQube's — a
// financial profile has no meaning as a partial merge of two different
// compute runs.
// ─────────────────────────────────────────────────────────────────────────

export interface FinancialProfileQubeUpsertInput {
  sourceUploadCount: number;
  unreadableUploadCount: number;
  blak: FinancialProfileQubeBlak;
}

/** Create-or-replace the persona's FinancialProfileQube from a fresh
 *  compute pass. Single canonical writer. */
export async function upsertFinancialProfileQube(
  personaId: string,
  input: FinancialProfileQubeUpsertInput,
): Promise<FinancialProfileQubeRecord> {
  if (!personaId || typeof personaId !== 'string') {
    throw new Error('upsertFinancialProfileQube: personaId is required');
  }
  const admin = getAdminClient();

  const row = {
    persona_id: personaId,
    // A compute/manual-entry PASS is not the same as a real profile — an
    // upload pass where every statement was unreadable (computeFinancialProfile
    // returns no `aggregates`) must not earn "prepared" evidence (operator
    // directive, Turn D 2026-09-02: "an empty profile must not earn
    // 'financial profile prepared' evidence" — hasPreparedFinancialProfile()
    // in services/journey/financialSovereigntyEvidence.ts reads exactly this
    // flag). Manual entry always produces aggregates (even income=0/
    // expenditure=0 is a real self-reported figure), so this only ever
    // withholds the flag on a genuinely empty upload pass.
    has_profile: Boolean(input.blak.aggregates),
    last_computed_at: new Date().toISOString(),
    source_upload_count: input.sourceUploadCount,
    unreadable_upload_count: input.unreadableUploadCount,
    blak_qube: input.blak,
  };

  const result = await withTimeout(
    admin.from('financial_profile_qubes').upsert(row, { onConflict: 'persona_id' }).select('*').single(),
    'upsertFinancialProfileQube',
  );
  const { data, error } = result as { data: unknown; error: { code?: string; message?: string } | null };
  if (error) {
    if (isMissingTable(error)) throw new FinancialProfileTableMissingError();
    throw new Error(`upsertFinancialProfileQube failed: ${error.message ?? 'unknown error'}`);
  }
  return rowToRecord(data as DbRow);
}
