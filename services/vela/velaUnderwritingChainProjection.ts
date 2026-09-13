/**
 * Constitutional Risk Flow chain-assembly service — Use Case Zero build-order
 * item 10a, READ-ONLY. Assembles the causal chain for one underwriting
 * request (Factor selection -> Aegis admission -> disclosure authorization ->
 * frozen envelope -> Vela execution -> underwriting quote -> settlement ->
 * causal receipts -> risk telemetry) from the SAME `activity_receipts` +
 * `golden_cycle_records` rows items 5-9 already write. This module writes
 * NOTHING — no new receipt type, no new table, no new write path — it only
 * reads and honestly reports what each upstream step's OWN evidence says.
 *
 * CRITICAL DISAMBIGUATION (read before touching anything named "Use Case
 * Zero", "Factor", "Aegis", or "MoneyPenny admission" in this codebase — the
 * SAME collisions items 7-9 already documented in their own file headers;
 * see `services/factor/factorSelectionArtifact.ts`'s header for the full
 * background):
 *  1. `services/factor/useCaseZeroOrchestrator.ts` /
 *     `useCaseZeroReadinessProjection.ts` / `useUseCaseZeroReadiness.ts` are
 *     a COMPLETELY DIFFERENT, case-scoped (`factor_cases`) agent-onboarding
 *     readiness state machine. This module does not import from, extend, or
 *     key on any of them, and its own name/UI surface is deliberately NOT a
 *     second `UseCaseZero*` symbol — it is named "Constitutional Risk Flow"
 *     (operator's own explicit naming instruction) so no future reader
 *     confuses the two systems.
 *  2. `services/moneypenny/admissionAuthority.ts` is a DIFFERENT, case-scoped
 *     MoneyPenny admission decision. Never imported here.
 *  3. `services/qubetalk/disclosurePolicy.ts` is a DIFFERENT, conversation-
 *     context disclosure concept. Never imported here.
 *
 * WHY READ-ONLY, WHY NO NEW WRITE PATH: this item is a VIEWER over the
 * evidence items 5-9 already produce — every fact it reports is either an
 * `activity_receipts.action_input` field already written by
 * `factorSelectionArtifact.ts` / `velaUnderwritingAdmissionEvidence.ts` /
 * `velaUnderwritingDisclosureAuthorization.ts` /
 * `velaUnderwritingCompositionGate.ts` / `velaUnderwritingProjection.ts`, or a
 * `golden_cycle_records` row `velaUnderwritingRiskTelemetry.ts` already
 * writes. Reads go through `listActivityReceiptsForPersona` — the EXISTING
 * canonical persona-scoped reader (`services/receipts/activityReceiptService
 * .ts`) — never a hand-rolled query for that table (CLAUDE.md
 * inv.engineering.036/037). The one query this file adds is the
 * `golden_cycle_records` lookup by `action_ref`, which has no existing
 * reader anywhere in this codebase to reuse (verified: `velaUnderwritingRisk
 * Telemetry.ts` is producer-only, by its own header's explicit "OUT OF
 * SCOPE" list — "any code that READS/aggregates golden_cycle_records").
 *
 * requestRef FILTERING: all five receipt action types this file reads carry
 * `requestRef` directly inside their own `action_input` (verified against
 * each file's real code, not assumed): `FactorSelectionArtifact.requestRef`,
 * `AegisAdmissionEvidence.requestRef`,
 * `VelaUnderwritingDisclosureAuthorization.requestRef`, the frozen-envelope
 * receipt's own `actionInput.requestRef`
 * (`submitFrozenUnderwritingEnvelope`'s literal `requestRef:
 * params.envelope.requestRef`), and `buildUnderwritingActionInput`'s own
 * `requestRef: input.requestRef` on `vela_underwriting_projection_completed`.
 * So one uniform `actionInput.requestRef === requestRef` filter, applied
 * per-action-type, is correct for every step — never a per-step-different
 * matching key.
 *
 * TELEMETRY LOOKUP KEY CHOICE (documented per the brief's own instruction to
 * justify whichever is picked): `golden_cycle_records.action_ref` is set,
 * verbatim, to the SAME `onChainRequestId` `recordVelaUnderwritingRiskTelemetry`
 * derives its unique, idempotent `record_key` from
 * (`'vela-underwriting:' + onChainRequestId`) — a real unique key, available
 * ONLY once the frozen-envelope receipt exists (that receipt is the one and
 * only place `onChainRequestId` is bound on this persona's own evidence
 * chain). Querying by `value_cycle->>'requestRef'` was considered and
 * REJECTED: `golden_cycle_records` carries no persona-scoping column at all
 * (see its migration), so a `requestRef`-only filter could not be safely
 * distinguished from a value another persona's own request happened to
 * reuse, whereas `action_ref = onChainRequestId` is exactly the same
 * concrete on-chain request this persona's OWN, already-persona-scoped
 * frozen-envelope receipt just named — safe to look up directly. When no
 * frozen-envelope receipt exists yet, there is no `onChainRequestId` to look
 * up by, so the Telemetry (and Settlement) steps honestly resolve
 * `'not_started'` rather than guessing at a different key.
 *
 * HONESTY DISCIPLINE (CLAUDE.md No-Guessing): a step whose own evidence was
 * not found is `'not_started'` — NEVER upgraded because a LATER step's
 * evidence exists. Each step reads its OWN receipt/record independently;
 * the presence of a downstream artifact is never treated as proof an
 * upstream step succeeded.
 *
 * THE STATE VOCABULARY, and what each value means for EVERY step:
 *   - 'not_started' — no matching evidence found for this step at all.
 *   - 'in_progress' — reserved for a step whose OWN evidence names an
 *     in-flight state. No step in this chain currently produces this from
 *     receipt data alone (every receipt here is written only once the act
 *     it records has already concluded — `runVelaUnderwritingProjection`
 *     itself polls to terminal before its receipt is written), so no step
 *     ever actually resolves to it today. Kept in the vocabulary (rather
 *     than omitted) so a future step with a genuine in-flight phase does
 *     not need a second, parallel vocabulary invented for it.
 *   - 'blocked' — a correctly-evidenced, terminal REFUSAL (Aegis REFUSED).
 *   - 'unresolved' — the step's own evidence explicitly could not decide
 *     (Aegis: no assessment / stale / ratified insufficient_evidence; Vela's
 *     own disposition resolved UNRESOLVED).
 *   - 'complete' — the step's own act concluded and produced a real,
 *     evidenced artifact. IMPORTANT: 'complete' describes ONLY that the step
 *     ran to conclusion and was recorded — it NEVER implies the recorded
 *     outcome was favourable. A Quote/Execute step reading 'complete' with
 *     `disposition: 'UNACCEPTABLE'` and `coverageEligible: false` is exactly
 *     as 'complete' as one reading ACCEPTABLE/eligible — the capsule renders
 *     the real fields either way, never suppressing or softening an
 *     unfavourable one.
 *
 * `AegisAdmissionStatus` mapping (Admit step): ADMITTED -> 'complete',
 * REFUSED -> 'blocked', UNRESOLVED -> 'unresolved'. No admission-evidence
 * receipt found at all -> 'not_started' (distinct from an UNRESOLVED
 * admission — the former means Aegis was never even consulted for this
 * request; the latter means Aegis was consulted and could not decide).
 *
 * SETTLEMENT (no dedicated receipt type exists in this chain today — verified
 * by reading `activityReceiptService.ts`'s full `ActivityActionType` union):
 * this file does NOT invent one, and builds no new write path. It DOES read
 * the one genuine, already-recorded settlement-adjacent fact this chain
 * produces today — `golden_cycle_records.execution_evidence.settlementOccurred`
 * (`velaUnderwritingRiskTelemetry.ts`'s own field, set from
 * `params.asset != null` at submission time) — because that is real,
 * already-authorized evidence, not a fabrication. When no telemetry row
 * exists, or `settlementOccurred` is `false`, Settle honestly resolves
 * `'not_started'` with a reason naming exactly why (no evidence exists, or
 * Vela ran as a no-funds path) — never a fabricated `'pending'`.
 *
 * Fail-closed, never throws: mirrors `velaUnderwritingRiskTelemetry.ts`'s own
 * discipline — a Supabase read failure (receipts or telemetry) is logged and
 * resolves the affected step(s) as `'not_started'`/absent evidence, never
 * propagated as an unhandled rejection into a UI render path.
 *
 * Server-side only (imports `listActivityReceiptsForPersona`/
 * `getSupabaseServer`, both server-only).
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import {
  listActivityReceiptsForPersona,
  type ActivityActionType,
  type ActivityReceiptRecord,
  type ReceiptStatus,
} from '@/services/receipts/activityReceiptService';
import type { FactorSelectionArtifact, FactorCandidateProviderMode } from '@/services/factor/factorSelectionArtifact';
import type { AegisAdmissionEvidence, AegisAdmissionStatus } from '@/services/vela/velaUnderwritingAdmissionEvidence';
import type { VelaUnderwritingDisclosureAuthorization } from '@/services/vela/velaUnderwritingDisclosureAuthorization';
import type { UnderwritingQuote, UnderwritingProviderMode } from '@/services/financialServices/providers/underwriting/underwritingProviderTypes';
import type { ConfidentialProjectionDisposition } from '@/types/confidentialProjection';

// ── State vocabulary ────────────────────────────────────────────────────────

export type ConstitutionalRiskFlowStepState =
  | 'not_started'
  | 'in_progress'
  | 'blocked'
  | 'unresolved'
  | 'complete';

export type ConstitutionalRiskFlowStepId =
  | 'select'
  | 'admit'
  | 'authorize'
  | 'freeze'
  | 'execute'
  | 'quote'
  | 'settle'
  | 'receipt'
  | 'telemetry';

export interface ConstitutionalRiskFlowReceiptRef {
  receiptId: string;
  actionType: ActivityActionType;
  receiptStatus: ReceiptStatus;
  createdAt: string;
}

// ── Per-step shapes — T1-safe summary fields + raw evidence refs only ──────

export interface ConstitutionalRiskFlowSelectStep {
  id: 'select';
  state: ConstitutionalRiskFlowStepState;
  reason: string;
  selectionRef: string | null;
  candidateAgentId: string | null;
  serviceId: string | null;
  counterpartyId: string | null;
  providerMode: FactorCandidateProviderMode | null;
  selectionReason: string | null;
  receiptId: string | null;
}

export interface ConstitutionalRiskFlowAdmitStep {
  id: 'admit';
  state: ConstitutionalRiskFlowStepState;
  reason: string;
  admissionRef: string | null;
  admissionStatus: AegisAdmissionStatus | null;
  assessmentRef: string | null;
  assessmentVersion: string | null;
  aegisAgentId: string | null;
  receiptId: string | null;
}

export interface ConstitutionalRiskFlowAuthorizeStep {
  id: 'authorize';
  state: ConstitutionalRiskFlowStepState;
  reason: string;
  authorizationRef: string | null;
  applicationId: string | null;
  authorizedByAgentRef: string | null;
  /** The FULL, real `VelaMultiPartyDisclosureScope` this authorization
   *  covers — grants array included verbatim so the UI layer can render the
   *  COMPUTE_WITH/DISCLOSE_TO distinction precisely (never collapsed here). */
  scope: VelaUnderwritingDisclosureAuthorization['scope'] | null;
  receiptId: string | null;
}

export interface ConstitutionalRiskFlowFreezeStep {
  id: 'freeze';
  state: ConstitutionalRiskFlowStepState;
  reason: string;
  envelopeRef: string | null;
  applicationId: string | null;
  candidateAgentId: string | null;
  receiptId: string | null;
}

export interface ConstitutionalRiskFlowExecuteStep {
  id: 'execute';
  state: ConstitutionalRiskFlowStepState;
  reason: string;
  onChainRequestId: string | null;
  disposition: ConfidentialProjectionDisposition | null;
  providerMode: UnderwritingProviderMode | null;
  receiptId: string | null;
}

export interface ConstitutionalRiskFlowQuoteStep {
  id: 'quote';
  state: ConstitutionalRiskFlowStepState;
  reason: string;
  /** The FULL `UnderwritingQuote` (all nine fields), verbatim from
   *  `vela_underwriting_projection_completed` — the frozen-envelope receipt
   *  alone does not carry these (only `providerMode`), so this step reads
   *  the projection-completed receipt specifically for them. */
  quote: UnderwritingQuote | null;
  receiptId: string | null;
}

export interface ConstitutionalRiskFlowSettleStep {
  id: 'settle';
  state: ConstitutionalRiskFlowStepState;
  reason: string;
  /** `null` when no telemetry evidence exists to read this from at all —
   *  distinct from `false` (evidence exists; no asset-bearing settlement). */
  settlementOccurred: boolean | null;
}

export interface ConstitutionalRiskFlowReceiptStep {
  id: 'receipt';
  state: ConstitutionalRiskFlowStepState;
  reason: string;
  receipts: ConstitutionalRiskFlowReceiptRef[];
}

export interface ConstitutionalRiskFlowTelemetryStep {
  id: 'telemetry';
  state: ConstitutionalRiskFlowStepState;
  reason: string;
  telemetryRecordId: string | null;
}

export interface ConstitutionalRiskFlowState {
  requestRef: string;
  select: ConstitutionalRiskFlowSelectStep;
  admit: ConstitutionalRiskFlowAdmitStep;
  authorize: ConstitutionalRiskFlowAuthorizeStep;
  freeze: ConstitutionalRiskFlowFreezeStep;
  execute: ConstitutionalRiskFlowExecuteStep;
  quote: ConstitutionalRiskFlowQuoteStep;
  settle: ConstitutionalRiskFlowSettleStep;
  receipt: ConstitutionalRiskFlowReceiptStep;
  telemetry: ConstitutionalRiskFlowTelemetryStep;
}

// ── Internal helpers ────────────────────────────────────────────────────────

type UnknownRecord = Record<string, unknown>;

/** Same `asRecord` pattern used elsewhere in this repo (e.g.
 *  `velaMultiPartyProjection.ts`) — never exported past this file, redefined
 *  locally per CLAUDE.md's existing convention. */
function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : null;
}

function readActionInput<T>(receipt: ActivityReceiptRecord | null): T | null {
  if (!receipt) return null;
  const record = asRecord(receipt.actionInput);
  return record ? (record as unknown as T) : null;
}

function mapAdmissionStatusToStepState(status: AegisAdmissionStatus): ConstitutionalRiskFlowStepState {
  if (status === 'ADMITTED') return 'complete';
  if (status === 'REFUSED') return 'blocked';
  return 'unresolved';
}

const CHAIN_ACTION_TYPES: ActivityActionType[] = [
  'factor_selection_proposed',
  'vela_underwriting_admission_evidence_composed',
  'vela_underwriting_disclosure_authorized',
  'vela_underwriting_envelope_frozen',
  'vela_underwriting_projection_completed',
];

/** The frozen-envelope receipt's own `actionInput` shape — mirrors
 *  `submitFrozenUnderwritingEnvelope`'s literal object in
 *  `velaUnderwritingCompositionGate.ts` field-for-field. Not exported by
 *  that file as a type, so redefined here from its real, verified shape
 *  rather than guessed. */
interface FrozenEnvelopeActionInput {
  envelopeRef: string;
  selectionRef: string;
  admissionRef: string;
  disclosureAuthorizationRef: string;
  requestRef: string;
  applicationId: string;
  candidateAgentId: string;
  onChainRequestId: string;
  disposition: ConfidentialProjectionDisposition;
  providerMode: UnderwritingProviderMode;
  veloProjectionReceiptId: string | null;
  telemetryRecordId: string | null;
}

/** The `vela_underwriting_projection_completed` receipt's own `actionInput`
 *  shape — mirrors `buildUnderwritingActionInput`'s literal return object in
 *  `velaUnderwritingProjection.ts` field-for-field. */
interface ProjectionCompletedActionInput {
  requestRef: string;
  onChainRequestId: string;
  applicationId: string;
  partyNamespaceRefs: string[];
  requestingPartyNamespaceRef: string | null;
  scopeBinding: unknown;
  scopeGrants: unknown;
  disposition: ConfidentialProjectionDisposition;
  payloadCommitment: string;
  attestationMode: string;
  quote: UnderwritingQuote;
  providerMode: UnderwritingProviderMode;
}

interface GoldenCycleTelemetryRow {
  id: string;
  execution_evidence: UnknownRecord | null;
}

/**
 * Reads the one `golden_cycle_records` row for this exact `onChainRequestId`
 * (see this file's header, "TELEMETRY LOOKUP KEY CHOICE"). Fail-closed: a
 * missing admin client or a query error resolves `null`, never a throw.
 */
async function fetchGoldenCycleRecordByActionRef(
  onChainRequestId: string,
): Promise<GoldenCycleTelemetryRow | null> {
  const admin = getSupabaseServer();
  if (!admin) return null;
  try {
    const { data, error } = await admin
      .from('golden_cycle_records')
      .select('id, execution_evidence')
      .eq('action_ref', onChainRequestId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error('[constitutional-risk-flow] telemetry read failed:', error.message ?? error);
      return null;
    }
    if (!data) return null;
    return data as unknown as GoldenCycleTelemetryRow;
  } catch (err) {
    console.error(
      '[constitutional-risk-flow] telemetry read threw:',
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

export interface GetConstitutionalRiskFlowStateParams {
  personaId: string;
  requestRef: string;
}

/**
 * Assembles the Constitutional Risk Flow state for one (personaId,
 * requestRef) pair. Never throws — a read failure degrades the affected
 * step(s) to their honest absent-evidence state rather than propagating.
 */
export async function getConstitutionalRiskFlowState(
  params: GetConstitutionalRiskFlowStateParams,
): Promise<ConstitutionalRiskFlowState> {
  const { personaId, requestRef } = params;

  let receipts: ActivityReceiptRecord[] = [];
  try {
    receipts = await listActivityReceiptsForPersona(personaId, {
      actionTypes: CHAIN_ACTION_TYPES,
      limit: 100,
    });
  } catch (err) {
    console.error(
      '[constitutional-risk-flow] receipt read failed:',
      err instanceof Error ? err.message : String(err),
    );
    receipts = [];
  }

  // Most-recent-first per action type, for this exact requestRef — reads
  // each step's OWN evidence independently (this file's header, "HONESTY
  // DISCIPLINE"). listActivityReceiptsForPersona already orders by
  // created_at desc, so the FIRST match per type is the most recent.
  const matchFor = (actionType: ActivityActionType): ActivityReceiptRecord | null =>
    receipts.find((r) => r.actionType === actionType && asRecord(r.actionInput)?.requestRef === requestRef) ?? null;

  const selectionReceipt = matchFor('factor_selection_proposed');
  const admissionReceipt = matchFor('vela_underwriting_admission_evidence_composed');
  const authorizationReceipt = matchFor('vela_underwriting_disclosure_authorized');
  const freezeReceipt = matchFor('vela_underwriting_envelope_frozen');
  const projectionReceipt = matchFor('vela_underwriting_projection_completed');

  // ── Select ──
  const selectInput = readActionInput<FactorSelectionArtifact>(selectionReceipt);
  const select: ConstitutionalRiskFlowSelectStep = selectInput
    ? {
        id: 'select',
        state: 'complete',
        reason: `Factor proposed candidate ${selectInput.candidateAgentId} (${selectInput.providerMode}).`,
        selectionRef: selectInput.selectionRef,
        candidateAgentId: selectInput.candidateAgentId,
        serviceId: selectInput.serviceId,
        counterpartyId: selectInput.counterpartyId,
        providerMode: selectInput.providerMode,
        selectionReason: selectInput.selectionReason,
        receiptId: selectionReceipt!.id,
      }
    : {
        id: 'select',
        state: 'not_started',
        reason: 'Factor has not proposed a candidate selection for this request.',
        selectionRef: null,
        candidateAgentId: null,
        serviceId: null,
        counterpartyId: null,
        providerMode: null,
        selectionReason: null,
        receiptId: null,
      };

  // ── Admit ──
  const admissionInput = readActionInput<AegisAdmissionEvidence>(admissionReceipt);
  const admit: ConstitutionalRiskFlowAdmitStep = admissionInput
    ? {
        id: 'admit',
        state: mapAdmissionStatusToStepState(admissionInput.admissionStatus),
        reason: admissionInput.reason,
        admissionRef: admissionInput.admissionRef,
        admissionStatus: admissionInput.admissionStatus,
        assessmentRef: admissionInput.assessmentRef,
        assessmentVersion: admissionInput.assessmentVersion,
        aegisAgentId: admissionInput.aegisAgentId,
        receiptId: admissionReceipt!.id,
      }
    : {
        id: 'admit',
        state: 'not_started',
        reason: 'Aegis has not composed admission evidence for this request.',
        admissionRef: null,
        admissionStatus: null,
        assessmentRef: null,
        assessmentVersion: null,
        aegisAgentId: null,
        receiptId: null,
      };

  // ── Authorize ──
  const authorizationInput = readActionInput<VelaUnderwritingDisclosureAuthorization>(authorizationReceipt);
  const authorize: ConstitutionalRiskFlowAuthorizeStep = authorizationInput
    ? {
        id: 'authorize',
        state: 'complete',
        reason: `Disclosure authorized by ${authorizationInput.authorizedByAgentRef}.`,
        authorizationRef: authorizationInput.authorizationRef,
        applicationId: authorizationInput.applicationId,
        authorizedByAgentRef: authorizationInput.authorizedByAgentRef,
        scope: authorizationInput.scope,
        receiptId: authorizationReceipt!.id,
      }
    : {
        id: 'authorize',
        state: 'not_started',
        reason: 'No disclosure authorization exists for this request.',
        authorizationRef: null,
        applicationId: null,
        authorizedByAgentRef: null,
        scope: null,
        receiptId: null,
      };

  // ── Freeze ──
  const freezeInput = readActionInput<FrozenEnvelopeActionInput>(freezeReceipt);
  const freeze: ConstitutionalRiskFlowFreezeStep = freezeInput
    ? {
        id: 'freeze',
        state: 'complete',
        reason: `Envelope ${freezeInput.envelopeRef} was frozen and submitted to Vela.`,
        envelopeRef: freezeInput.envelopeRef,
        applicationId: freezeInput.applicationId,
        candidateAgentId: freezeInput.candidateAgentId,
        receiptId: freezeReceipt!.id,
      }
    : {
        id: 'freeze',
        state: 'not_started',
        reason:
          admissionInput && admissionInput.admissionStatus !== 'ADMITTED'
            ? `No envelope was frozen — Aegis admission resolved ${admissionInput.admissionStatus}, not ADMITTED.`
            : 'No envelope has been frozen for this request yet.',
        envelopeRef: null,
        applicationId: null,
        candidateAgentId: null,
        receiptId: null,
      };

  // ── Execute (Vela) ──
  // 'complete' here means the projection ran to a resolved disposition
  // (ACCEPTABLE or UNACCEPTABLE) — never that the outcome was favourable.
  // 'unresolved' is reserved for the case Vela itself could not decide.
  const execute: ConstitutionalRiskFlowExecuteStep = freezeInput
    ? {
        id: 'execute',
        state: freezeInput.disposition === 'UNRESOLVED' ? 'unresolved' : 'complete',
        reason: `Vela resolved ${freezeInput.disposition} (${freezeInput.providerMode}).`,
        onChainRequestId: freezeInput.onChainRequestId,
        disposition: freezeInput.disposition,
        providerMode: freezeInput.providerMode,
        receiptId: freezeReceipt!.id,
      }
    : {
        id: 'execute',
        state: 'not_started',
        reason: 'Vela has not been submitted for this request.',
        onChainRequestId: null,
        disposition: null,
        providerMode: null,
        receiptId: null,
      };

  // ── Quote ──
  const projectionInput = readActionInput<ProjectionCompletedActionInput>(projectionReceipt);
  const quote: ConstitutionalRiskFlowQuoteStep = projectionInput
    ? {
        id: 'quote',
        // See this file's header — 'complete' never implies approval.
        state: projectionInput.disposition === 'UNRESOLVED' ? 'unresolved' : 'complete',
        reason: `Underwriting quote computed (${projectionInput.quote.providerMode}): ${projectionInput.disposition}.`,
        quote: projectionInput.quote,
        receiptId: projectionReceipt!.id,
      }
    : {
        id: 'quote',
        state: 'not_started',
        reason: 'No underwriting quote has been computed for this request.',
        quote: null,
        receiptId: null,
      };

  // ── Settle + Telemetry (both keyed on onChainRequestId, see header) ──
  const telemetryRow = freezeInput ? await fetchGoldenCycleRecordByActionRef(freezeInput.onChainRequestId) : null;

  const settlementOccurred = telemetryRow
    ? Boolean(telemetryRow.execution_evidence?.settlementOccurred)
    : null;
  const settle: ConstitutionalRiskFlowSettleStep = !freezeInput
    ? {
        id: 'settle',
        state: 'not_started',
        reason: 'No settlement can be evaluated — Vela has not been submitted for this request.',
        settlementOccurred: null,
      }
    : !telemetryRow
      ? {
          id: 'settle',
          state: 'not_started',
          reason: 'No settlement evidence exists for this request.',
          settlementOccurred: null,
        }
      : settlementOccurred
        ? {
            id: 'settle',
            state: 'complete',
            reason: 'An asset-bearing settlement rode along with this Vela submission.',
            settlementOccurred: true,
          }
        : {
            id: 'settle',
            state: 'not_started',
            reason: 'Vela ran as a no-funds path — no asset-bearing settlement was submitted with this request.',
            settlementOccurred: false,
          };

  const telemetry: ConstitutionalRiskFlowTelemetryStep = telemetryRow
    ? {
        id: 'telemetry',
        state: 'complete',
        reason: 'Risk-invariant telemetry recorded in golden_cycle_records.',
        telemetryRecordId: telemetryRow.id,
      }
    : {
        id: 'telemetry',
        state: 'not_started',
        reason: freezeInput
          ? "No telemetry row was found for this request's onChainRequestId."
          : 'No telemetry can exist yet — Vela has not been submitted for this request.',
        telemetryRecordId: null,
      };

  // ── Receipt (rollup of every receipt actually found across the chain) ──
  const foundReceipts = [selectionReceipt, admissionReceipt, authorizationReceipt, freezeReceipt, projectionReceipt].filter(
    (r): r is ActivityReceiptRecord => r !== null,
  );
  const receiptRefs: ConstitutionalRiskFlowReceiptRef[] = foundReceipts.map((r) => ({
    receiptId: r.id,
    actionType: r.actionType,
    receiptStatus: r.receiptStatus,
    createdAt: r.createdAt,
  }));
  const receipt: ConstitutionalRiskFlowReceiptStep =
    receiptRefs.length > 0
      ? {
          id: 'receipt',
          state: 'complete',
          reason: `${receiptRefs.length} causal receipt(s) found for this request.`,
          receipts: receiptRefs,
        }
      : {
          id: 'receipt',
          state: 'not_started',
          reason: 'No causal receipts exist yet for this request.',
          receipts: [],
        };

  return { requestRef, select, admit, authorize, freeze, execute, quote, settle, receipt, telemetry };
}
