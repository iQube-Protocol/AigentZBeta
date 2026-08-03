/**
 * Trust dimensions — decomposing `registry_assets.metadata.trust_composite`
 * into declared components instead of a single opaque number.
 *
 * ── THE OPERATOR'S MODEL (2026-08-03) ─────────────────────────────────────
 *
 *   > "Transparency should increase trust in proportion to the degree of
 *   >  exposure accepted and the evidence subsequently supplied, but
 *   >  willingness to disclose must not be mistaken for proven performance."
 *
 * Agreeing to Pulse visibility or P&L disclosure proves WILLINGNESS to
 * expose state — a consent, not a performance. Actual Pulse/P&L evidence,
 * received and staying accurate over time, proves BEHAVIOUR. Collapsing
 * these into one score would reward a promise as if it were a track record.
 *
 *   trust_composite = capability + transparency + evidenceAccuracy + operationalReliability
 *                      (capped at 100)
 *
 * `capability` is the formal trust assessment `trustScorerService.ts`
 * computes (or, for an asset never run through that pipeline, the legacy
 * static value already stored as `trust_composite`) — NEVER written by this
 * module. `trust_band`, `publication_status`, `policy_class`,
 * `wrapper_strategy` and `capabilities` are equally untouched here; nothing
 * in this file promotes the formal band. That promotion, if it is ever
 * warranted, is the scorer's decision alone, made under its own rules.
 *
 * ── AUDIT TRAIL ────────────────────────────────────────────────────────────
 *
 * Every increment is receipted (`trust_dimension_incremented`, DVN-anchored
 * — services/dvn/activityReceiptDvnPipeline.ts), never a silent metadata
 * write. The receipt's `actionInput` carries the signal type, the
 * authorization/evidence reference, the previous and new per-dimension
 * scores, and the rationale — reusing the canonical activity-receipt
 * pipeline rather than inventing a parallel log (inv.engineering.036/037).
 *
 * ── WHAT THIS MODULE DELIBERATELY DOES NOT DO ─────────────────────────────
 *
 * `evidenceAccuracy` (first valid Pulse/P&L proof) and
 * `operationalReliability` (sustained accurate evidence) are declared
 * dimensions with no caller wired yet — there is no live Pulse/P&L proof
 * feed anywhere in this codebase today to trigger them honestly. Inventing
 * a caller ahead of a real evidence source would be exactly the
 * reward-the-promise-as-performance mistake this model exists to prevent.
 * The next session should wire `recordTrustDimensionIncrement` with
 * `dimension: 'evidenceAccuracy'` the moment a real proof-ingestion path
 * exists, not before.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';

export interface TrustDimensions {
  /** The formal capability/trust assessment. Never modified by this module. */
  capability: number;
  /** Willingness to expose ongoing operational state (Pulse) and financial performance (P&L) — consent, not proof. */
  transparency: number;
  /** Accuracy demonstrated by evidence actually received and validated. Zero until a real proof lands. */
  evidenceAccuracy: number;
  /** Reliability demonstrated by SUSTAINED accurate evidence over time. Zero until a track record exists. */
  operationalReliability: number;
}

export type TrustDimensionSignal =
  | 'pulse_authorization_granted'
  | 'pnl_disclosure_authorization_granted'
  | 'evidence_first_valid_proof'
  | 'evidence_sustained_accuracy'
  | 'evidence_missing_or_contradictory';

/**
 * Modest, named, operator-tunable increments — never a magic number inline
 * at the call site. "Modest" is deliberate: authorization is a consent, not
 * a track record, so it earns a small transparency credit, not the uplift
 * evidence would earn.
 */
export const TRANSPARENCY_INCREMENT_PULSE_AUTHORIZED = 5;
export const TRANSPARENCY_INCREMENT_PNL_DISCLOSURE_AUTHORIZED = 5;

const DIMENSION_FLOOR = 0;
const DIMENSION_CEILING = 100;

function clampDimension(value: number): number {
  return Math.max(DIMENSION_FLOOR, Math.min(DIMENSION_CEILING, value));
}

function defaultDimensions(legacyCapability: number): TrustDimensions {
  return { capability: legacyCapability, transparency: 0, evidenceAccuracy: 0, operationalReliability: 0 };
}

/** `trust_composite` is DERIVED from here — never hard-coded at a call site. */
export function computeComposite(dimensions: TrustDimensions): number {
  const sum =
    dimensions.capability + dimensions.transparency + dimensions.evidenceAccuracy + dimensions.operationalReliability;
  return Math.round(clampDimension(sum) * 100) / 100;
}

export interface RecordTrustDimensionIncrementInput {
  admin: SupabaseClient;
  /** registry_assets.asset_id for the target agent. */
  assetId: string;
  /** The dimension this signal moves. Never `capability` — that is the formal scorer's exclusive concern. */
  dimension: Exclude<keyof TrustDimensions, 'capability'>;
  /** May be negative — `evidence_missing_or_contradictory` can reduce, per the operator's own ruling. */
  delta: number;
  signal: TrustDimensionSignal;
  /** The authorization id / proof ref this increment is evidenced by — never fabricated. */
  evidenceRef: string;
  rationale: string;
  /** The operator's own persona — recorded as the receipt's principal. */
  actorPersonaId: string;
  /** RUNTIME_AGENT_IDS entry for the target agent — recorded as the receipt's agentsInvoked. */
  runtimeAgentId: string;
  /** Display name for the receipt summary. */
  displayName: string;
}

export type RecordTrustDimensionIncrementResult =
  | { ok: true; previous: TrustDimensions; next: TrustDimensions; receiptId: string | null }
  | { ok: false; error: string };

export async function recordTrustDimensionIncrement(
  input: RecordTrustDimensionIncrementInput,
): Promise<RecordTrustDimensionIncrementResult> {
  const { admin, assetId, dimension, delta, signal, evidenceRef, rationale, actorPersonaId, runtimeAgentId, displayName } =
    input;

  const { data: row, error } = await admin
    .from('registry_assets')
    .select('metadata')
    .eq('asset_id', assetId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!row) return { ok: false, error: `no registry_assets row for "${assetId}"` };

  const metadata = (row.metadata ?? {}) as Record<string, unknown>;
  const legacyCapability = typeof metadata.trust_composite === 'number' ? metadata.trust_composite : 0;
  const existing = (metadata.trust_dimensions as TrustDimensions | undefined) ?? defaultDimensions(legacyCapability);

  const previous: TrustDimensions = { ...existing };
  const next: TrustDimensions = { ...existing, [dimension]: clampDimension(existing[dimension] + delta) };
  const previousComposite = computeComposite(previous);
  const nextComposite = computeComposite(next);

  const { error: updateError } = await admin
    .from('registry_assets')
    .update({
      metadata: { ...metadata, trust_dimensions: next, trust_composite: nextComposite },
      updated_at: new Date().toISOString(),
    })
    .eq('asset_id', assetId);
  if (updateError) return { ok: false, error: updateError.message };

  const receipt = await createActivityReceipt({
    personaId: actorPersonaId,
    activeCartridge: 'agentiq',
    actionType: 'trust_dimension_incremented',
    agentsInvoked: [runtimeAgentId],
    summary: `${displayName}'s ${dimension} trust dimension moved ${previous[dimension]} -> ${next[dimension]} (${signal})`,
    actionInput: {
      signal,
      dimension,
      evidenceRef,
      rationale,
      previousScore: previous[dimension],
      newScore: next[dimension],
      previousComposite,
      newComposite: nextComposite,
    },
  }).catch(() => null);

  return { ok: true, previous, next, receiptId: receipt?.id ?? null };
}
