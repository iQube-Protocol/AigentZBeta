/**
 * Vela underwriting risk telemetry — Use Case Zero build-order item 6, the
 * direct sequel to `velaUnderwritingProjection.ts` (item 5, merged
 * 2026-09-13).
 *
 * OPERATOR RULING THIS ITEM IMPLEMENTS (verbatim, 2026-09-13): "Its job
 * should be very small and additive: take the completed underwriting
 * activity receipt and emit a normalized telemetry record containing the
 * constitutional and actuarial observables we care about... The important
 * rule is that telemetry must use only already-authorized outputs / receipt
 * evidence, not reopen confidential raw party data. Invariant Intelligence
 * should learn from constitutional outcomes, not become a side channel
 * around the privacy boundary."
 *
 * WHY `golden_cycle_records`, NOT A NEW TABLE OR ANOTHER "Invariant
 * Intelligence" SYSTEM: a preflight search of this codebase turned up THREE
 * differently-shaped, unrelated systems that share vocabulary with this
 * item's own name, none of which are the destination:
 *  - `types/invariantIntelligence.ts` (CRP-002 IRL research programme) — an
 *    intent/knowledge-compression research contract, not an evidence sink
 *    for a settled business receipt.
 *  - `services/consequence/operatingModel.ts` (CFS-006a) — an intentRef-keyed
 *    invariant-grounding/knowledge-evolution loop; this item has no intentRef
 *    and no invariant-substrate grounding set to feed back into.
 *  - `services/venture/ventureOutcomeAccrual.ts` — venture outcome
 *    verification -> Standing credit; a different accrual concern entirely.
 * `supabase/migrations/20260912195402_golden_cycle_evidence_records.sql`
 * creates `public.golden_cycle_records`, an evidence substrate whose own
 * migration header names the canonical Horizen/Vela Use Case Zero spec
 * (`docs/vela/accelerator/constitutional-financial-services/
 * 05_ACCELERATOR_USE_CASE_ZERO_SPEC_v0.1.md`, Sec.12) as requiring exactly
 * this shape of evidence package, and states no such table previously
 * existed. Confirmed via grep that no service writes to this table before
 * this item — this module is the first writer. This item does NOT add a new
 * `ActivityActionType` or DVN-anchorable receipt: the existing
 * `vela_underwriting_projection_completed` receipt (item 5) remains the ONE
 * causal receipt; a `golden_cycle_records` row is additional evidence that
 * REFERENCES that receipt's id (`provenance.receiptId`), never a peer or
 * replacement of it.
 *
 * THE PRIVACY BOUNDARY THIS FILE HOLDS (mirrors
 * `underwritingProviderTypes.ts`'s own gate-1 structural proof exactly):
 * `VelaUnderwritingRiskTelemetryInput`'s own field set has NO PLACE for a
 * party's raw financial inputs (`currentExposure`/`proposedSpend`/
 * `privateSpendLimit`/`privateRiskLimit`, or any generic inputs/parties map),
 * no `recipientAddress`, and no T0 identifier. This is a structural
 * guarantee of the function's own signature, not merely a documented
 * discipline — there is nowhere for that data to travel through even if a
 * caller wanted to pass it. Every field here is already-authorized receipt
 * evidence: the same namespace refs, scope, disposition, and quote that
 * `buildUnderwritingActionInput` (`velaUnderwritingProjection.ts`) already
 * binds onto the causal receipt, plus timing/provenance facts local to this
 * item.
 *
 * FAIL-CLOSED, NEVER THROWS: mirrors `ventureOutcomeAccrual.ts`'s own
 * `getSupabaseServer()`-unavailable-returns-null discipline, and
 * `services/consequence/operatingModel.ts`'s own fire-and-forget
 * `.catch((err) => { console.error(...); return null; })` discipline for a
 * side-effect write that must never block or regress the caller's own
 * result. A telemetry failure is never allowed to change
 * `runVelaUnderwritingProjection`'s own resolved disposition/quote/receiptId
 * — see that file's composition of this function.
 *
 * HYPOTHESIS VS CANON (CLAUDE.md): `evidence_status` is stamped EXPLICITLY
 * `'operational_hypothesis_generating'` on every row this module writes —
 * never left to the column's own default — because the governing spec's own
 * Sec.12 states verbatim: "Operational telemetry remains
 * hypothesis-generating until registered scientifically." Every JSONB column
 * this item has no honest data for yet (`risk_cycle`,
 * `information_provenance`, `observed_outcome`, `repair_or_claim`,
 * `burden_bearer`, `calibration_error`, `constitutional_conditions`) is set
 * to an explicit empty object `{}` — never fabricated (No-Guessing rule).
 *
 * OUT OF SCOPE for this item (do not extend this file to cover these — see
 * the accompanying update doc): Factor/Aegis integration, any UI/demo
 * surface, any code that READS/aggregates `golden_cycle_records` into
 * invariant candidates (this module is producer-only), repair/claim outcome
 * modeling, any new `ActivityActionType` or Supabase migration.
 *
 * Server-side only (imports `getSupabaseServer`, server-only).
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import type { BuildVelaMultiPartyProjectionRequestParams } from './velaMultiPartyProjection';
import type { ConfidentialProjectionDisposition } from '@/types/confidentialProjection';
import type { UnderwritingQuote } from '@/services/financialServices/providers/underwriting/underwritingProviderTypes';

const GOLDEN_CYCLE_RECORDS_TABLE = 'golden_cycle_records';
const SOURCE_SURFACE = 'vela-use-case-zero-underwriting';
const PROTOCOL_REF =
  'docs/vela/accelerator/constitutional-financial-services/05_ACCELERATOR_USE_CASE_ZERO_SPEC_v0.1.md#12';
/** Set explicitly on every row this module writes — never relied on as the
 *  column's own default. See this file's header, "Hypothesis vs Canon". */
const EVIDENCE_STATUS_OPERATIONAL_HYPOTHESIS_GENERATING = 'operational_hypothesis_generating';

/**
 * Exactly the already-authorized-only field set — see this file's header.
 * NOT `Record<string, unknown>`, NOT a passthrough of an untyped object: an
 * explicit interface so a caller attempting to pass a party's raw financial
 * inputs fails to typecheck (proven by a `@ts-expect-error` gate test in
 * `tests/vela-underwriting-risk-telemetry.test.ts`, mirroring
 * `underwritingProviderTypes.ts`'s own gate-1 proof).
 */
export interface VelaUnderwritingRiskTelemetryInput {
  requestRef: string;
  onChainRequestId: string;
  applicationId: string;
  partyNamespaceRefs: string[];
  requestingPartyNamespaceRef?: string | null;
  /** Reused verbatim from the multi-party substrate's own type — never
   *  redefined here. */
  scopeBinding: BuildVelaMultiPartyProjectionRequestParams['scope']['binding'];
  scopeGrants: BuildVelaMultiPartyProjectionRequestParams['scope']['grants'];
  disposition: ConfidentialProjectionDisposition;
  quote: UnderwritingQuote;
  /** The causal receipt this evidence row references — `null` only when the
   *  receipt write itself was skipped/unavailable (mirrors
   *  `VelaUnderwritingProjectionResult.receiptId`'s own contract). */
  receiptId: string | null;
  policyVersion: string;
  settlementOccurred: boolean;
  timeToCompletionMs: number;
}

/**
 * Records ONE `golden_cycle_records` row for a completed underwriting
 * projection. Idempotent by construction: `record_key` is deterministically
 * derived from `onChainRequestId`, and the write is an upsert on that key —
 * a retried emission for the same on-chain request updates the same row
 * rather than creating a duplicate.
 *
 * Fail-closed: resolves `null` (never throws) whenever the database is
 * unavailable or the write itself errors — see this file's header.
 */
export async function recordVelaUnderwritingRiskTelemetry(
  input: VelaUnderwritingRiskTelemetryInput,
): Promise<{ id: string } | null> {
  const admin = getSupabaseServer();
  if (!admin) return null;

  const recordKey = `vela-underwriting:${input.onChainRequestId}`;

  try {
    const { data, error } = await admin
      .from(GOLDEN_CYCLE_RECORDS_TABLE)
      .upsert(
        {
          record_key: recordKey,
          source_surface: SOURCE_SURFACE,
          protocol_ref: PROTOCOL_REF,
          evidence_status: EVIDENCE_STATUS_OPERATIONAL_HYPOTHESIS_GENERATING,
          principal_ref: null,
          action_ref: input.onChainRequestId,
          value_cycle: {
            requestRef: input.requestRef,
            applicationId: input.applicationId,
            partyNamespaceRefs: input.partyNamespaceRefs,
            requestingPartyNamespaceRef: input.requestingPartyNamespaceRef ?? null,
          },
          // No risk-of-repair/reversibility/downside allocation model exists
          // yet for this slice — out of scope, never fabricated.
          risk_cycle: {},
          // No external-fact provenance chain exists in this slice.
          information_provenance: {},
          time_to_value: {
            timeToCompletionMs: input.timeToCompletionMs,
          },
          risk_prediction: {
            disposition: input.disposition,
            riskBand: input.quote.riskBand,
            estimatedExposure: input.quote.estimatedExposure,
            riskOfRepair: input.quote.riskOfRepair,
            confidence: input.quote.confidence,
          },
          premium_terms: {
            premium: input.quote.premium,
            coverageLimit: input.quote.coverageLimit,
            conditions: input.quote.conditions,
          },
          coverage_decision: {
            coverageEligible: input.quote.coverageEligible,
            providerMode: input.quote.providerMode,
          },
          action_authorization: {
            scopeBinding: input.scopeBinding,
            scopeGrants: input.scopeGrants,
          },
          execution_evidence: {
            settlementOccurred: input.settlementOccurred,
          },
          // No repair/claim outcome exists yet — deferred per the operator's
          // own words: "later, when one exists".
          observed_outcome: {},
          repair_or_claim: {},
          // No risk-bearer allocation model in this slice — out of scope.
          burden_bearer: {},
          // Requires an observed outcome to compute against; none exists.
          calibration_error: {},
          // Distinct from `action_authorization` — reserved for a future
          // constitutional-gate concept this slice does not yet have; left
          // empty rather than duplicating scopeBinding/scopeGrants here.
          constitutional_conditions: {},
          provenance: {
            receiptId: input.receiptId,
            policyVersion: input.policyVersion,
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'record_key' },
      )
      .select('id')
      .single();

    if (error || !data) {
      console.error('[vela-underwriting-telemetry] upsert failed:', error?.message ?? 'no row returned');
      return null;
    }
    return { id: String(data.id) };
  } catch (err) {
    console.error(
      '[vela-underwriting-telemetry] unexpected error:',
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}
