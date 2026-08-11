/**
 * services/dvn/activityReceiptDvnPipeline.ts — Aigent Me Phase 6.b Part 4.
 *
 * ─── CRITICAL INFRASTRUCTURE — DO NOT MODIFY WITHOUT OPERATOR APPROVAL ───
 * This file is protected under the CLAUDE.md DVN Pipeline Protection rule.
 * The ONLY permitted unilateral change is adding new action types to
 * ANCHORABLE_ACTION_TYPES. Any other modification to this file (state
 * machine logic, canister interaction, payload shape, hashing, identity
 * handling, error paths) requires explicit written approval from the
 * operator. DVN failures are escalated via console.error so they surface
 * in Amplify/CloudWatch logs immediately.
 * ──────────────────────────────────────────────────────────────────────────
 *
 * Anchors aigentMe activity_receipts to the DVN cross-chain service.
 * Mirrors the existing qubetalkReceiptPipeline pattern but targets the
 * activity_receipts table and its receipt_status state machine:
 *
 *   local → dvn_pending → dvn_recorded
 *                       ↘ dvn_failed
 *
 * Privacy contract (PRD §11 + CLAUDE.md):
 *   - personaId is T0; only its T2 form (cohortAliasCommitment, when
 *     available) ever flows on-chain. The DVN payload here uses a hashed
 *     persona reference so the receipt is correlatable to its persona
 *     without leaking the spine identifier.
 *   - Summary text + agents/tools/iqubes/context lists are T1-safe; they
 *     describe the action, not the person.
 *   - No PII, no FIO handles, no auth profile id. The route layer
 *     prevents these from landing in the receipt in the first place.
 *
 * Operational notes:
 *   - When CROSS_CHAIN_SERVICE_CANISTER_ID is unset (dev / alpha), the
 *     pipeline is a no-op that leaves the receipt as 'local'. This keeps
 *     local dev working without canister access.
 *   - Submission is fire-and-forget from the receipt-creation hot path so
 *     a slow canister never delays user-facing latency. The finalizer
 *     reconciles state asynchronously.
 */

import { getActor } from '@/services/ops/icAgent';
import { idlFactory as dvnIdl } from '@/services/ops/idl/cross_chain_service';
import { idlFactory as posIdl } from '@/services/ops/idl/proof_of_state';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { createHash } from 'crypto';
import type { ActivityReceiptRecord } from '@/services/receipts/activityReceiptService';
import { findLocalReceiptsPendingDvnAnchor } from '@/services/receipts/activityReceiptService';
import { computeReceiptCommitment, receiptCommitmentInput } from '@/services/receipts/receiptCommitment';

/** Action types worth anchoring on-chain. Low-value events stay local. */
const ANCHORABLE_ACTION_TYPES = new Set<string>([
  'approval_granted',
  'approval_rejected',
  'artifact_sent',
  'experience_model_updated',
  'passport_application_submitted',
  'passport_issued',
  'passport_status_changed',
  'passport_revoked',
  'passport_privilege_changed',
  'passport_infraction_recorded',
  // Governance (Operation Chrysalis Phase 0A)
  'governance_decision_ratified',
  'governance_decision_amended',
  'governance_authority_exercised',
  'governance_escalation_triggered',
  // Consumer task runner (Workstream C-b) — task-completion provenance
  'experience_task_completed',
  // Autonomous agent lifecycle (Option A) — revocation provenance
  'agent_revocation_state_changed',
  // Founder Office — Venture Blueprint handed to execution agents
  'venture_blueprint_handoff',
  // Standing signals — operator-logged work + proof-of-work documents. These
  // are the verified-progress provenance the grounded progress report reads.
  'operator_action_logged',
  'standing_document_added',
  // Foundational Validation Series — published experiment results carry a
  // sha256 content commitment in the summary; anchoring makes the commitment
  // tamper-evident (added per the permitted action-type-addition rule).
  'experiment_result_published',
  // Standing accrual — NVA-backed outcome credit anchored for audit trail
  'standing_accrued',
  // Partner agent evidence (metaProof × Horizen Labs pilot, operator ruling
  // 2026-07-28). The evidence carries an Agent Card sha256 commitment plus the
  // zkVerify attestation / adapter tx identifiers of an EXTERNAL proof;
  // anchoring makes our record of that external proof tamper-evident, which is
  // the whole point of ingesting someone else's attestation. (Added per the
  // permitted action-type-addition rule; no other part of this pipeline is
  // touched.)
  'partner_agent_evidence_recorded',
  // Attributable correction of Capability Standing under a superseded scoring
  // formula. A DOWNWARD write against a monotone personhood-bound ledger is
  // the one standing act most in need of tamper-evidence — if any receipt
  // must be anchorable, it is the one that says a citizen's score was lowered
  // and by whose authority. (Added per the permitted action-type-addition
  // rule; no other part of this pipeline is touched.)
  'standing_corrected',
  // Autonomous agent delegation lifecycle — provenance of who was delegated what
  'agent_delegated',
  'agent_delegation_revoked',
  // Plan subscription lifecycle — purchase / renewal provenance on-chain
  'plan_purchased',
  'plan_renewed',
  // Invariant lifecycle (Chrysalis Foundation Phase 1) — constitutional-
  // memory provenance for the invariant substrate (CFS-001 §7)
  'invariant_validated',
  'invariant_canonized',
  'invariant_superseded',
  // InvariantQube publication (Phase 2) — compressed-expertise provenance
  'invariant_qube_published',
  // Experiment Workspace administration (Horizen Phase 3) — Aigent Z's daily
  // and weekly report over a workspace. Anchoring makes the record of
  // programme state at a point in time tamper-evident, like every other
  // governance artifact above. (Action-type addition only — the one change
  // this file permits unilaterally.)
  'workspace_report_published',
  // VL-CT-001 venture substrate (charter R-6) — the nine consequential events
  // of the opportunity→liability→settlement chain. Anchoring matters most for
  // the refusal path: `venture_refusal_recorded` and the obligation events that
  // follow it are the tamper-evident record that a justified refusal was a
  // COMPLETED constitutional service that earned compensation, not a failed
  // trade. Without an anchor, that claim is a database row asserting its own
  // truth. Ordinary preparation-cost lines are NOT here — they are batch
  // checkpointed into a commitment (services/venture/trading/receipts.ts).
  // (Action-type addition only — the one change this file permits
  // unilaterally. Payload shape, state machine and hashPersonaRef untouched;
  // the R-8 compensation extension is built by the venture substrate and rides
  // inside the receipt it is attached to.)
  'venture_opportunity_opened',
  'venture_service_completed',
  'venture_completion_assessed',
  'venture_refusal_recorded',
  'venture_obligation_earned',
  'venture_obligation_approved',
  'venture_settlement_simulated',
  'venture_obligation_reversed',
  'venture_opportunity_closed',
  // QriptoCENT cross-denomination settlement (2026-07-29) — the twelve
  // consequential events of the inter-ledger settlement substrate. Anchoring
  // matters more here than almost anywhere: with no lock pool standing for
  // "this credit was backed", the receipt chain IS the evidence that a
  // destination credit followed a finalised source debit, and that a mint
  // followed a proven reserve. (Action-type addition only — the one change
  // this file permits unilaterally. Payload shape, state machine, principal
  // resolution and hashPersonaRef untouched.)
  'qriptocent_payment_instruction_accepted',
  'qriptocent_settlement_authority_verified',
  'qriptocent_source_debit_initiated',
  'qriptocent_source_debit_finalised',
  'qriptocent_settlement_message_verified',
  'qriptocent_destination_liquidity_reserved',
  'qriptocent_destination_credit_completed',
  'qriptocent_settlement_reconciled',
  'qriptocent_settlement_exception_recorded',
  'qriptocent_liquidity_proof_verified',
  'qriptocent_replenishment_authorised',
  'qriptocent_native_issuance_executed',
  // IRL-REVIEW-001 — completion of an independent review over an experiment
  // asset. Anchoring matters here for the same reason it matters for a
  // governance record: the review's reproducibility claim rests on WHICH models
  // adjudicated WHICH frozen package, and a tamper-evident anchor is what stops
  // that claim from being a database row asserting its own truth. (Added per
  // the permitted action-type-addition rule; no other part of this pipeline is
  // touched — payload shape, state machine, principal resolution and
  // hashPersonaRef are unchanged.)
  'independent_review_completed',
  // Consequence Operating Model (Phase 3) — forecast + flywheel evolution
  'consequence_forecast_recorded',
  'knowledge_evolved',
  'experience_render_validated',
  'implementation_pack_generated',
  // DCC implementation dispatch — the platform initiated implementation via
  // Claude Code in CI; anchoring the initiation record makes the development
  // provenance chain (pack → dispatch → PR → merge) tamper-evident. Added per
  // the permitted action-type-addition rule.
  'implementation_dispatched',
  'deployment_proposed',
  // Constitutional Development Environment (CFS-020 CDE) — constitutional
  // consequence-test + remediation + deployment-authorization provenance.
  'constitutional_validation_recorded',
  'remediation_recorded',
  'deployment_authorized',
  // Merge validation-gate override — an unvalidated deploy authorized by an
  // admin with a stated reason; anchoring makes the override tamper-evident
  // (added per the permitted action-type-addition rule).
  'validation_override_granted',
  // Constitutional Acceptance (CFS-032 §4/§5, 2026-07-16) — a shipped
  // capability admitted into the Capability Registry (the capability-level
  // equivalent of constitutional ratification), and its Standing-accrual
  // trigger (operational evidence in production). Anchoring makes the
  // acceptance + accrual chain tamper-evident. Added per the permitted
  // action-type-addition rule.
  'capability_registered',
  'capability_operationally_validated',
  // Capability lifecycle — Archive (SPEC-MMC-002 §6.3 Phase 3, 2026-07-24): a
  // registrant deprecated their own capability. Anchoring keeps the
  // acceptance→accrual→deprecation arc tamper-evident end to end. Added per
  // the permitted action-type-addition rule.
  'capability_deprecated',
  'research_lifecycle_transition',
  // Artifact Runtime (CFS-025 Phase 2) — a constitutional-tier artifact was
  // PUBLISHED; anchoring makes the publication commitment tamper-evident.
  'artifact_published',
  // Invariant Engine ratification (CFS-035 §11) — an Invariant Decision Node was
  // flipped shadow↔authoritative. The runtime now serves the projection (or
  // reverts); anchoring makes the operator-gated ratification tamper-evident.
  // Added per the permitted action-type-addition rule (operator-approved).
  'invariant_node_flipped',
  // Constitutional Agreement (CRP-003a N1 / CFI-002, 2026-07-17) — formation/
  // acceptance + authorization of a pre-execution agreement binding
  // intent→agent→authority. DVN is the constitutional anchor of record (x409/
  // Consenti is the acceptance-proof provider). Anchoring makes the agreement
  // trail tamper-evident. Added per the permitted action-type-addition rule
  // (operator-approved 2026-07-17).
  'agreement_formed',
  'agreement_authorized',
  // QubeTalk Peer Exchange (Phase 1 Increment 3, 2026-07-21) — consequential
  // peer-channel acts (artifact shared / opened / copied-to-locker). The
  // payload carries only T2-safe references (counterparty Polity Public
  // Reference + sha256/16 channel & artifact commitments), so anchoring the
  // provenance is chain-safe. Added per the permitted action-type-addition rule.
  'qubetalk_artifact_shared',
  'qubetalk_artifact_opened',
  'qubetalk_artifact_copied',
  // MoneyPenny Runtime (PRD-MPY-001 Phase 4, P4-4) — an authoritative
  // constitutional-service-pattern run on Domain 3 (Financial Intelligence).
  // Anchoring makes the execution trail tamper-evident. Added per the
  // permitted action-type-addition rule.
  'finance_authoritative_execution',
  // Bitcent (B¢) treasury etch (2026-07-30) — a real Bitcoin Runes etching
  // transaction, broadcast under the pilot treasury authority gate. Anchoring
  // makes the mandate/signatory/observer/tx-hash record tamper-evident, the
  // same rationale as every other treasury/issuance action type above. Added
  // per the permitted action-type-addition rule; no other part of this
  // pipeline is touched.
  'bitcent_treasury_etch_executed',
  // PRD-GJR-001 (Guided Journey Runtime) — the Horizen x MoneyPenny constitutional
  // admission pilot. Every stage of the journey's ten-step sequence (§3.5) must
  // produce a real, anchorable receipt so the closing evidence chain (§15.1,
  // §17) is tamper-evident, not merely a local database row — this is the exact
  // property the journey exists to demonstrate. Added per the permitted
  // action-type-addition rule; no other part of this pipeline is touched.
  'agent_card_discovered',
  'horizen_agent_registered',
  'horizen_pnl_transparency_enabled',
  'agent_card_enriched',
  'agent_control_proven',
  'marketa_eligibility_recommended',
  'operator_passport_validated',
  'agent_sponsorship_recorded',
  'agent_delegate_passport_issued',
  'aigentme_activated',
  'experienceqube_focus_disposition_recorded',
  'journey_completed',
  // GJR-VFY-001 Phase 1 (2026-07-31) — action-type addition only, the one
  // change this file permits unilaterally per CLAUDE.md.
  'horizen_pulse_authorized',
  // GJR-MKT-001 Phase 4 (2026-07-31) — same permitted addition-only change.
  'marketa_eligibility_assessed',
  'marketa_eligibility_refused',
  'marketa_eligibility_quarantined',
  // Wallet Signing Topology (operator ruling 2026-08-01), Register vertical
  // slice — same permitted addition-only change. Each is a step of the
  // ceremony's evidence chain and must be independently anchorable.
  'principal_registration_mandate_signed',
  'agent_registry_transaction_signed',
  'horizen_registration_submitted',
  'horizen_registration_confirmed',
  'agent_registry_binding_recorded',
  // Trust dimensions (operator ruling 2026-08-03) — same permitted
  // addition-only change. A trust-assessment change is audit-worthy by its
  // nature; see services/registry/trustDimensions.ts.
  'trust_dimension_incremented',
  // Governed capability invocation (Phase 4, 2026-08-06) — same permitted
  // addition-only change. Each is a constitutional decision (authorized/
  // refused) or its execution outcome (completed); 'requested' is
  // deliberately excluded — pre-decision, high volume by design, same
  // discipline as 'invariant_discovered' above. See
  // codexes/packs/agentiq/updates/2026-08-06_governed-capability-invocation-design.md §9.
  'capability_invocation_authorized',
  'capability_invocation_refused',
  'capability_invocation_completed',
  // Receipted constitutional state — first proven out for the Horizen
  // admission journey (operator directive, 2026-08-08: "verified external
  // fact + valid constitutional policy + DVN receipt = canonical
  // constitutional state transition"), then corrected the same day per the
  // operator: "the principle we have just established is clearly
  // protocol-level... I would not let the underlying reconciliation
  // architecture become Horizen-specific." `pulse_enrollment_verified`/
  // `pulse_commitment_verified` are Pulse-specific EVENT TYPES (a claim
  // about a specific external fact) and stay partner-scoped by design —
  // `writeConfirmedPulseActivation` issues them alongside the existing
  // `horizen_pulse_authorized` receipt, each carrying its own evidence
  // commitment. `reconciliation_discrepancy_recorded` is deliberately
  // NAMED WITHOUT A PARTNER PREFIX: the mechanism it belongs to — a later
  // external read disagreeing with already-receipted state produces a new,
  // anchored event rather than rewriting the receipted transition it
  // compares against — is protocol-level, not a Horizen invariant; a future
  // partner's reconciliation writes the same action type. (Action-type
  // addition only — the one change this file permits unilaterally. Payload
  // shape, state machine and hashPersonaRef untouched.)
  'pulse_enrollment_verified',
  'pulse_commitment_verified',
  'reconciliation_discrepancy_recorded',
  // P&L is an independent, asynchronous capability transition, deliberately
  // kept as its own state machine from Pulse admission (operator directive,
  // 2026-08-08). Issued ONLY when a read-only Horizen correlation
  // independently produces and attributes a genuine Verifiable-PnL record
  // for the exact agent/token/chain — see
  // services/horizen/pnlServiceVerification.ts. Additive alongside
  // horizen_pnl_transparency_enabled (a materially weaker "disclosure scope
  // authorized" claim) and partner_agent_evidence_recorded (a different
  // constitutional question, identity-binding attribution) — never replaces
  // either. (Action-type addition only.)
  'pnl_service_verified',
  // Threshold Journey — Orient stage (operator spec, 2026-08-09). The
  // operator's constitutional acknowledgment act belongs in tamper-evident
  // memory, same tier as the other constitutional-transition receipts above.
  'orientation_ritual_completed',
  // Horizen Pilot Closure, part C (2026-08-09) — Horizen's OWN Verifiable-PnL
  // onboarding succeeding (POST /v1/register) is a distinct constitutional
  // fact from both horizen_pnl_transparency_enabled (disclosure permission)
  // and pnl_service_verified (independently rediscovered proof evidence) —
  // see services/horizen/pnlOnboardingClient.ts. (Action-type addition only.)
  'pnl_service_registered',
  // Constitutional State Model Correction (2026-08-11) — an agent becoming
  // constitutionally active in the iQube Registry is a first-class
  // constitutional fact and belongs in tamper-evident memory, same tier as
  // the other admission-spine receipts above. (Action-type addition only —
  // the one change this file permits unilaterally. Payload shape, state
  // machine and hashPersonaRef untouched.)
  'agent_registry_activated',
]);

export function shouldAnchorActionType(actionType: string): boolean {
  return ANCHORABLE_ACTION_TYPES.has(actionType);
}

/**
 * T2-safe persona reference. SHA-256 of the personaId, prefix-truncated
 * to 16 hex chars. Reversible only by someone who already knows the
 * personaId — i.e. the spine itself. Suitable for chain-bound payloads.
 */
function hashPersonaRef(personaId: string): string {
  return createHash('sha256').update(personaId).digest('hex').slice(0, 16);
}

export interface ActivityDvnSubmissionResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

/** Canister call timeout — 15 seconds. Prevents indefinite hangs. */
const DVN_CALL_TIMEOUT_MS = 15_000;

/**
 * Validate that the record carries the minimum fields required for a
 * well-formed DVN payload. Returns null when valid, an error string
 * describing the deficiency otherwise.
 */
function validateReceiptForDvn(record: ActivityReceiptRecord, personaId: string): string | null {
  if (!record.id) return 'record.id is empty';
  if (!personaId) return 'personaId is empty';
  if (!record.actionType) return 'record.actionType is empty';
  if (!record.summary) return 'record.summary is empty';
  if (!record.createdAt) return 'record.createdAt is empty';
  return null;
}

/**
 * Submit a single activity receipt to the DVN canister. Returns the
 * canister-assigned messageId on success so the caller can persist it
 * on the receipt row. Best-effort: when the canister env var is missing
 * or the call throws, returns ok:false and leaves the row untouched.
 *
 * Hardened: validates payload fields before calling, enforces a timeout
 * so a hung canister doesn't stall the Lambda indefinitely, and handles
 * both plain-string and Candid Variant responses.
 */
export async function submitActivityReceiptToDvn(
  record: ActivityReceiptRecord,
  personaId: string,
  /**
   * The commitment computed ONCE by the caller and already persisted
   * (operator directive, 2026-08-08 item 1). Passing it explicitly is what
   * makes "the same H on both legs" a fact rather than a coincidence of two
   * derivations agreeing. Standalone callers that drive ONE leg (the retry
   * routes) may omit it; `computeReceiptCommitment` is deterministic, so
   * re-deriving yields the identical value — but the dual-leg path must never
   * rely on that.
   */
  precomputedCommitment?: string,
): Promise<ActivityDvnSubmissionResult> {
  try {
    // Pre-flight validation — catches corrupt/partial records before
    // paying the cost of an IC call.
    const validationErr = validateReceiptForDvn(record, personaId);
    if (validationErr) {
      return { ok: false, error: `Payload validation failed: ${validationErr}` };
    }

    const canisterId =
      process.env.CROSS_CHAIN_SERVICE_CANISTER_ID ||
      process.env.NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID;
    if (!canisterId) {
      return { ok: false, error: 'CROSS_CHAIN_SERVICE_CANISTER_ID not configured' };
    }
    const dvn = await getActor<{
      submit_dvn_message: (a: number, b: number, payload: number[], id: string) => Promise<string>;
    }>(canisterId, dvnIdl);

    /*
     * THE SHARED COMMITMENT (operator ruling, 2026-08-08). H is computed ONCE
     * from the receipt's immutable T2-safe projection and travels on BOTH
     * legs: it is the `data_hash` given to proof_of_state.issue_receipt (see
     * submitActivityReceiptToPos below) and it rides inside this DVN payload.
     * Two writes without it would be two unrelated facts that merely get
     * counted together — the exact defect this repairs. Computed from the same
     * `hashPersonaRef` value the payload has always carried, never a raw
     * personaId (T0).
     */
    const personaRef = hashPersonaRef(personaId);
    const commitmentHash =
      precomputedCommitment ?? computeReceiptCommitment(receiptCommitmentInput(record, personaRef));

    const payload = JSON.stringify({
      action: 'AIGENTME_ACTIVITY_RECEIPT',
      receiptId: record.id,
      commitmentHash, // the shared H — reconciles this leg with the PoS leg by identity
      personaRef, // T2-safe; never personaId
      activeCartridge: record.activeCartridge,
      actionType: record.actionType,
      summary: record.summary,
      agentsInvoked: record.agentsInvoked,
      toolsUsed: record.toolsUsed,
      iqubesUsed: record.iqubesUsed,
      contextShared: record.contextShared,
      artifactsCreated: record.artifactsCreated,
      approvalsGranted: record.approvalsGranted,
      timestamp: Date.parse(record.createdAt) || Date.now(),
    });
    const payloadBytes = Array.from(new TextEncoder().encode(payload));
    const messageId = `aigentme_receipt_${record.id}_${Date.now()}`;

    // Timeout-guarded canister call — prevents Lambda hanging on an
    // unresponsive replica.
    const response = await Promise.race([
      dvn.submit_dvn_message(0, 0, payloadBytes, messageId),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`DVN canister call timed out after ${DVN_CALL_TIMEOUT_MS}ms`)), DVN_CALL_TIMEOUT_MS),
      ),
    ]);

    // Canister may return a plain string OR a Candid Variant: { Ok: string } / { Err: string }
    if (typeof response === 'string') {
      return { ok: true, messageId: response };
    }
    const resp = response as Record<string, unknown> | null | undefined;
    if (resp && typeof resp === 'object') {
      if ('Ok' in resp && typeof resp.Ok === 'string') {
        return { ok: true, messageId: resp.Ok };
      }
      if ('Err' in resp && typeof resp.Err === 'string') {
        return { ok: false, error: `Canister Err variant: ${resp.Err}` };
      }
    }
    return { ok: false, error: `submit_dvn_message returned unexpected shape: ${JSON.stringify(response)}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

/**
 * THE POS / BITCOIN LEG (operator ruling, 2026-08-08) — the half of the spine
 * that had gone missing.
 *
 * `proof_of_state.issue_receipt(data_hash)` is the entry to the Merkle-batch
 * → Bitcoin-anchor path. Nothing in this repo had ever passed a constitutional
 * receipt to it: every caller was a test route, a mint, a QCT rekey, or
 * `sync/repair`'s synthetic filler. Proven live — 624 receipts in the PoS
 * canister's anchored batches, not one an activity receipt.
 *
 * `data_hash` is the SHARED COMMITMENT H, identical to the one carried in the
 * DVN payload. That identity is what makes the two legs reconcilable.
 *
 * ── RETRIES ARE NOT IDEMPOTENT. DO NOT DESCRIBE THEM AS SUCH ───────────────
 *
 * An earlier version of this comment called re-submission "idempotent in
 * intent" because the same act always commits to the same H. That was wrong,
 * and the canister source (read 2026-08-08 from
 * iQube-Protocol/iQubeBeta-Program, `canisters/proof_of_state/src/lib.rs`)
 * settles it:
 *
 *     pub fn issue_receipt(data_hash: String) -> String {
 *         let receipt_id = format!("receipt_{}", ic_cdk::api::time());
 *         ...
 *     }
 *
 * The receipt id is derived from the CLOCK, and there is no lookup of an
 * existing receipt by `data_hash` anywhere in the canister. Calling
 * `issue_receipt(H)` twice therefore produces TWO distinct receipts carrying
 * the same H — a duplicate constitutional entry, not a no-op. Until the
 * deployed canister deduplicates by `data_hash`, any retry driver MUST gate on
 * our OWN `pos_receipt_id` being absent and must never rely on the canister to
 * absorb a repeat. `enqueueReceiptLeg` below does exactly that.
 *
 * Deliberately mirrors `submitActivityReceiptToDvn`'s shape — same timeout
 * guard, same Candid string-or-variant handling — rather than inventing a
 * second convention for the sibling leg.
 */
export interface ActivityPosSubmissionResult {
  ok: boolean;
  posReceiptId?: string;
  commitmentHash?: string;
  error?: string;
  /**
   * True when the leg was deliberately NOT attempted (POS_LEG_SUBMISSION_ENABLED
   * is false). Distinct from a failure in every way that matters: it is not an
   * escalation, it does not mark `pos_status` failed, and it leaves the column
   * NULL — which the schema defines as "this leg has never been attempted".
   * Recording a policy decision as a canister error would be its own small lie.
   */
  withheld?: boolean;
}

/**
 * ── THE POS LEG IS NOT YET CONSTITUTIONAL EVIDENCE ─────────────────────────
 *
 * Established by READ-ONLY PROBE of the DEPLOYED canister n2hhv-aaaaa-aaaas-
 * qccza-cai on 2026-08-08 (`scripts/probe-pos-btc-anchoring.ts`), corroborated
 * by `canisters/proof_of_state/src/lib.rs` in iQube-Protocol/iQubeBeta-Program:
 *
 *   1. NO REAL BITCOIN TRANSACTION EXISTS. Every one of the 76 anchored
 *      batches carries `btc_anchor_txid = "mock_btc_txid_<root[..8]>"`. That is
 *      not 64 hex characters, so no Bitcoin network can contain it. `anchor()`
 *      discards the BTC signer's actual response (`Ok(_response)`) and returns
 *      a synthesised string on BOTH the success and error branches.
 *   2. `btc_block_height` is the hardcoded constant 800000 on every batch.
 *   3. THE ROOT DOES NOT COMMIT TO H. Recomputed locally over each batch's own
 *      receipts: 20 of 20 sampled satisfy root == sha256(concat receipt_ids),
 *      and 0 satisfy root == sha256(concat data_hashes). The id is
 *      `receipt_<clock>`, carrying no information about the act. So anchoring
 *      the root would prove nothing about the receipt even if the anchor were
 *      real.
 *   4. NO INCLUSION PROOF IS PRODUCIBLE. `merkle_proof` is empty on all 186
 *      receipts, and a single sequential SHA256 over concatenated ids is not a
 *      Merkle tree — it admits no per-leaf proof by construction.
 *
 * Consequence for this code: `pos_status` may reach 'pending' (we issued a PoS
 * receipt) but MUST NOT reach 'anchored' on the strength of a `btc_anchor_txid`
 * that is not a real Bitcoin txid. Writing 'anchored' here would manufacture
 * precisely the false green this whole investigation exists to remove — a
 * receipt claiming Bitcoin tamper-evidence it does not have.
 *
 * This predicate is the gate. It is deliberately strict: a txid must LOOK like
 * a Bitcoin txid before any code may treat it as one. Verifying that it also
 * EXISTS on-chain is a further step no code here performs.
 */
export function isRealBitcoinTxid(txid: string | null | undefined): boolean {
  return typeof txid === 'string' && /^[0-9a-f]{64}$/.test(txid);
}

/**
 * ── INTERIM POSTURE: THE POS LEG IS BUILT BUT NOT ENABLED ──────────────────
 * (operator ruling, 2026-08-08: "choose (c), with (a) as the interim
 * deployment posture… do not enable PoS submission and do not apply/deploy it
 * as a functioning anchoring path until the canister stack is evidentiary.")
 *
 * The shared-H structure above is correct and stays. What is withheld is the
 * SUBMISSION, because the substrate beneath it cannot produce evidence:
 *
 *   proof_of_state   root commits to receipt ids, not data_hash; merkle_proof
 *                    always empty; anchor() synthesises the txid on both
 *                    branches and hardcodes block height 800000
 *   btc_signer_psbt  `_op_return_script` is computed and DISCARDED (note the
 *                    underscore); outputs carry the literal strings
 *                    "OP_RETURN"/"change_address" as addresses; no Bitcoin
 *                    transaction is ever serialised; `txid` is the first 32
 *                    bytes of the SIGNATURE rather than the double-SHA256 of
 *                    the tx; `raw_tx` is the string "signed_tx_<hex>";
 *                    create_and_broadcast_anchor uses a zero-txid mock UTXO
 *
 * Issuing PoS receipts into that stack would mint `pos_receipt_id` values that
 * LOOK like Bitcoin provenance and are not — the precise false-green class
 * this whole investigation removed. And because `issue_receipt` never
 * deduplicates by data_hash, those entries could not be cleanly retracted
 * later either.
 *
 * A CONSTANT, DELIBERATELY NOT AN ENV VAR. Flipping this must be a reviewed
 * code change accompanied by the acceptance evidence in the repair plan
 * (codexes/packs/agentiq/updates/2026-08-08_canister-repair-plan.md), never an
 * environment toggle someone can set in a dashboard while the substrate is
 * still mock.
 *
 * The required chain before this becomes true:
 *   H → PoS leaf → real Merkle root/proof → valid BTC tx committing that root
 *     → real txid → confirmed block
 */
export const POS_LEG_SUBMISSION_ENABLED = false;

export async function submitActivityReceiptToPos(
  record: ActivityReceiptRecord,
  personaId: string,
  /** See `submitActivityReceiptToDvn`'s note — the caller computes H once. */
  precomputedCommitment?: string,
): Promise<ActivityPosSubmissionResult> {
  try {
    const validationErr = validateReceiptForDvn(record, personaId);
    if (validationErr) {
      return { ok: false, error: `Payload validation failed: ${validationErr}` };
    }

    /*
     * WITHHELD BY DESIGN — see POS_LEG_SUBMISSION_ENABLED. Returns a refusal
     * naming the reason rather than throwing or silently no-oping, so the
     * caller records `pos_status` accurately and the operator can see WHY the
     * leg is dark instead of inferring it from an absence.
     */
    if (!POS_LEG_SUBMISSION_ENABLED) {
      return {
        ok: false,
        withheld: true,
        error:
          'PoS submission is withheld: the proof_of_state / btc_signer_psbt stack cannot produce Bitcoin ' +
          'evidence (root commits to receipt ids not data_hash; merkle_proof always empty; txid and block ' +
          'height synthesised). Issuing receipts into it would create the appearance of anchoring without ' +
          'the substance. Re-enable only with the acceptance evidence in the canister repair plan.',
      };
    }

    const canisterId =
      process.env.PROOF_OF_STATE_CANISTER_ID || process.env.NEXT_PUBLIC_PROOF_OF_STATE_CANISTER_ID;
    if (!canisterId) {
      return { ok: false, error: 'PROOF_OF_STATE_CANISTER_ID not configured' };
    }

    const commitmentHash =
      precomputedCommitment ?? computeReceiptCommitment(receiptCommitmentInput(record, hashPersonaRef(personaId)));

    const pos = await getActor<{ issue_receipt: (dataHash: string) => Promise<string> }>(canisterId, posIdl);
    const response = await Promise.race([
      pos.issue_receipt(commitmentHash),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`PoS canister call timed out after ${DVN_CALL_TIMEOUT_MS}ms`)),
          DVN_CALL_TIMEOUT_MS,
        ),
      ),
    ]);

    if (typeof response === 'string') {
      return { ok: true, posReceiptId: response, commitmentHash };
    }
    const resp = response as Record<string, unknown> | null | undefined;
    if (resp && typeof resp === 'object') {
      if ('Ok' in resp && typeof resp.Ok === 'string') {
        return { ok: true, posReceiptId: resp.Ok, commitmentHash };
      }
      if ('Err' in resp && typeof resp.Err === 'string') {
        return { ok: false, error: `Canister Err variant: ${resp.Err}`, commitmentHash };
      }
    }
    return {
      ok: false,
      error: `issue_receipt returned unexpected shape: ${JSON.stringify(response)}`,
      commitmentHash,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * PER-LEG SUBMISSION FOR THE SCHEDULED RECONCILER (operator directive,
 * 2026-08-08 item 2).
 *
 * `enqueueActivityReceiptAnchor` is the hot-path, both-legs entry point and is
 * gated on `receipt_status === 'local'`. That gate is correct there (it stops
 * a second DVN message for the same receipt) but it makes the commonest
 * partial outcome — DVN ok, PoS failed — permanently unretryable, because the
 * row is no longer `local`.
 *
 * This is the entry point that fixes that: it drives ONE leg, and decides
 * eligibility from that leg's OWN durable evidence rather than from the legacy
 * flag. Because `proof_of_state.issue_receipt` does NOT deduplicate by
 * `data_hash` (see the note above), the PoS guard is `pos_receipt_id IS NULL`
 * — our own record of whether we already issued one. Nothing here trusts the
 * canister to absorb a repeat call.
 *
 * Returns what happened so a reconciler can log it; never throws.
 */
export async function enqueueReceiptLeg(
  record: ActivityReceiptRecord,
  personaId: string,
  leg: 'pos' | 'dvn',
): Promise<{ attempted: boolean; ok: boolean; detail: string }> {
  if (!shouldAnchorActionType(record.actionType)) {
    return { attempted: false, ok: false, detail: 'action type is not anchorable' };
  }
  const supabase = getSupabaseServer();
  if (!supabase) return { attempted: false, ok: false, detail: 'no Supabase client' };

  // Re-read the row's own leg columns — the caller's in-memory record may be
  // stale, and a duplicate submission is not recoverable once made.
  const { data: current } = await supabase
    .from('activity_receipts')
    .select('pos_receipt_id, dvn_receipt_id, commitment_hash')
    .eq('id', record.id)
    .maybeSingle();
  const row = (current ?? {}) as { pos_receipt_id?: string | null; dvn_receipt_id?: string | null; commitment_hash?: string | null };

  if (leg === 'pos' && row.pos_receipt_id) {
    return { attempted: false, ok: true, detail: `PoS leg already issued (${row.pos_receipt_id})` };
  }
  if (leg === 'dvn' && row.dvn_receipt_id) {
    return { attempted: false, ok: true, detail: `DVN leg already submitted (${row.dvn_receipt_id})` };
  }

  // H is recomputed only if the row does not already carry one — the persisted
  // value always wins, so a retry commits to exactly what the first attempt did.
  const commitmentHash =
    row.commitment_hash ?? computeReceiptCommitment(receiptCommitmentInput(record, hashPersonaRef(personaId)));
  if (!row.commitment_hash) {
    await supabase.from('activity_receipts').update({ commitment_hash: commitmentHash }).eq('id', record.id);
  }

  if (leg === 'pos') {
    const res = await submitActivityReceiptToPos(record, personaId, commitmentHash);
    if (res.withheld) {
      return { attempted: false, ok: false, detail: res.error ?? 'PoS submission withheld' };
    }
    if (res.ok && res.posReceiptId) {
      await supabase
        .from('activity_receipts')
        .update({ pos_receipt_id: res.posReceiptId, pos_status: 'pending' })
        .eq('id', record.id);
      return { attempted: true, ok: true, detail: `PoS receipt ${res.posReceiptId}` };
    }
    if (!res.error?.includes('not configured')) {
      console.error(`[DVN ESCALATION] Receipt ${record.id} PoS leg retry FAILED — error="${res.error ?? 'unknown'}"`);
      await supabase.from('activity_receipts').update({ pos_status: 'failed' }).eq('id', record.id);
    }
    return { attempted: true, ok: false, detail: res.error ?? 'unknown PoS failure' };
  }

  const res = await submitActivityReceiptToDvn(record, personaId, commitmentHash);
  if (res.ok && res.messageId) {
    await supabase
      .from('activity_receipts')
      .update({ receipt_status: 'dvn_pending', dvn_receipt_id: res.messageId, dvn_status: 'submitted' })
      .eq('id', record.id);
    return { attempted: true, ok: true, detail: `DVN message ${res.messageId}` };
  }
  if (!res.error?.includes('not configured')) {
    console.error(`[DVN ESCALATION] Receipt ${record.id} DVN leg retry FAILED — error="${res.error ?? 'unknown'}"`);
    await supabase
      .from('activity_receipts')
      .update({ receipt_status: 'dvn_failed', dvn_status: 'failed' })
      .eq('id', record.id);
  }
  return { attempted: true, ok: false, detail: res.error ?? 'unknown DVN failure' };
}

/**
 * DURABLE local → DVN-submitted RECONCILIATION (Horizen Pilot Closure, "close
 * the DVN lifecycle completely", 2026-08-09).
 *
 * ── THE GAP THIS CLOSES ─────────────────────────────────────────────────────
 *
 * `createActivityReceipt()` persists `receipt_status: 'local'` and then
 * invokes `enqueueActivityReceiptAnchor` through an UN-AWAITED background
 * promise — latency-friendly for the hot path, but not durable in a
 * request/serverless environment: if the request/lambda invocation ends
 * before that background work completes, the receipt is stranded at `local`
 * with nothing left checking on it. The reconciler-generated MoneyPenny
 * registration receipts demonstrated exactly this: the constitutional
 * receipt survived, but DVN submission did not outlive the request.
 *
 * Same defect class as `finalizeReadyActivityReceipts` above and
 * `services/horizen/registrationReconciliation.ts` — "observability must not
 * be the thing providing liveness." This is the SAME fix, one hop earlier in
 * the lifecycle: a scheduled reconciler drains the `local` backlog using the
 * EXISTING per-leg primitive (`enqueueReceiptLeg`), never a second
 * `submit_dvn_message` implementation, never a replacement receipt.
 *
 * The durable lifecycle this completes:
 *
 *   createActivityReceipt()
 *     → optimistic hot-path submission when it survives the request
 *     OR this scheduled recovery when it does not
 *     → dvn_pending
 *     → targeted finalizer (finalizeReadyActivityReceipts)
 *     → dvn_recorded / DVN Minted
 *
 * ── WHAT THIS DOES NOT DO ────────────────────────────────────────────────────
 *
 *   - It never reimplements `submit_dvn_message` — every DVN call still goes
 *     through `enqueueReceiptLeg` -> `submitActivityReceiptToDvn`.
 *   - It never submits a non-anchorable action type — `enqueueReceiptLeg`
 *     itself refuses via `shouldAnchorActionType`, checked again here so the
 *     count is accurate without a second submission attempt.
 *   - It never creates a replacement Activity Receipt — only ever promotes
 *     an EXISTING `local` row via its own leg columns.
 *   - It never changes commitment semantics — `enqueueReceiptLeg` recomputes
 *     H only when the row does not already carry one, same as always.
 *
 * EXCEPTION ISOLATION: one receipt's failed submission is isolated in its own
 * try/catch and must not stop the rest of the bounded batch.
 */
export interface LocalReceiptDvnReconciliationResult {
  ok: boolean;
  pendingChecked: number;
  submitted: number;
  alreadySubmitted: number;
  skippedNonAnchorable: number;
  failed: number;
  error?: string;
  /** True when the wall-clock safety budget stopped this run before the whole backlog was scanned — call again to continue from where it left off. */
  truncatedByTimeBudget?: boolean;
}

/** Mirrors registrationReconciliation.ts's MAX_ITEMS_PER_RUN — a backlog larger than this drains over successive scheduled runs. */
const LOCAL_RECONCILIATION_PAGE_SIZE = 50;

/**
 * Most `local` rows are legitimately NEVER anchored — the vast majority of
 * action types (intent_queued, specialist_consulted, artifact_created, ...)
 * are not in ANCHORABLE_ACTION_TYPES and correctly stay `local` forever. The
 * query is oldest-first (so a genuinely stranded anchorable receipt is never
 * skipped over in favor of a newer one), which means a long-lived run of
 * old, permanently-non-anchorable rows would otherwise re-fill the same page
 * on every scheduled invocation and starve any anchorable row behind it.
 * Paging forward (via `afterCreatedAt`) up to this many pages per invocation
 * — still one bounded run, still isolated per-row — fixes that without
 * changing what "anchorable" means or how a submission is made.
 */
const LOCAL_RECONCILIATION_MAX_PAGES = 20;

/**
 * Wall-clock safety valve (added after the FIRST live run against a
 * newly-repaired schema returned an empty HTTP response — the underlying
 * serverless route has its own hard execution limit this function cannot see
 * or extend, and each `enqueueReceiptLeg` call can itself take up to
 * `DVN_CALL_TIMEOUT_MS` (15s) if the canister is slow. Checked before EVERY
 * row, not just every page — a single page can contain up to
 * `LOCAL_RECONCILIATION_PAGE_SIZE` rows, and stopping only between pages would
 * not bound a slow page. Stopping cleanly and reporting `truncated: true`
 * beats letting the platform kill the request and discard the response body,
 * which is indistinguishable from "nothing happened" to a caller.
 */
const RECONCILIATION_TIME_BUDGET_MS = 20_000;

export async function reconcileLocalReceiptsToDvn(): Promise<LocalReceiptDvnReconciliationResult> {
  const result: LocalReceiptDvnReconciliationResult = {
    ok: false,
    pendingChecked: 0,
    submitted: 0,
    alreadySubmitted: 0,
    skippedNonAnchorable: 0,
    failed: 0,
  };
  const startedAt = Date.now();
  let truncated = false;

  let cursor: string | undefined;
  pageLoop: for (let page = 0; page < LOCAL_RECONCILIATION_MAX_PAGES; page++) {
    if (Date.now() - startedAt > RECONCILIATION_TIME_BUDGET_MS) {
      truncated = true;
      break;
    }
    let pending: Awaited<ReturnType<typeof findLocalReceiptsPendingDvnAnchor>>;
    try {
      pending = await findLocalReceiptsPendingDvnAnchor({ limit: LOCAL_RECONCILIATION_PAGE_SIZE, afterCreatedAt: cursor });
    } catch (err) {
      result.error = `could not read local activity_receipts: ${err instanceof Error ? err.message : String(err)}`;
      return result;
    }
    if (pending.length === 0) break;

    for (const { record, personaId } of pending) {
      if (Date.now() - startedAt > RECONCILIATION_TIME_BUDGET_MS) {
        truncated = true;
        break pageLoop;
      }
      result.pendingChecked += 1;
      if (!shouldAnchorActionType(record.actionType)) {
        result.skippedNonAnchorable += 1;
        continue;
      }
      try {
        const outcome = await enqueueReceiptLeg(record, personaId, 'dvn');
        if (outcome.ok) {
          if (outcome.attempted) result.submitted += 1;
          else result.alreadySubmitted += 1; // dvn_receipt_id already present — a no-op, not a fresh submission
        } else {
          result.failed += 1;
        }
      } catch (err) {
        // ONE receipt's exception must not stop the rest of the batch.
        result.failed += 1;
        console.error(`[DVN ESCALATION] Local-receipt DVN reconciliation threw for receipt ${record.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    cursor = pending[pending.length - 1].record.createdAt;
    if (pending.length < LOCAL_RECONCILIATION_PAGE_SIZE) break; // exhausted the backlog
  }

  result.ok = true;
  if (truncated) result.truncatedByTimeBudget = true;
  return result;
}

/**
 * Fire-and-forget anchor enqueue for the receipt-creation hot path.
 * Resolves immediately so the caller never blocks on DVN; the submission
 * runs in the background and updates the row's receipt_status when it
 * completes (or fails). Safe to call from any server context.
 *
 * ── BOTH LEGS, INDEPENDENTLY (operator ruling, 2026-08-08) ─────────────────
 *
 * This used to submit the DVN leg alone, which is how the PoS/Bitcoin half of
 * the spine went missing for the system's entire history. It now drives both,
 * and — critically — each leg's outcome is recorded on its OWN column
 * (`pos_status` / `dvn_status`), so one succeeding can never be mistaken for
 * the other. A receipt is not Bitcoin-anchored because its DVN message was
 * accepted, and not DVN-verified because its PoS receipt was issued.
 *
 * The legs run concurrently and are settled with `allSettled`: neither can
 * block or fail the other, matching the ruling that they are independently
 * tracked representations rather than a two-phase commit.
 *
 * `receipt_status` is still written exactly as before, from the DVN leg alone.
 * That is deliberate: every existing reader depends on it, and this change is
 * additive. It stops being the authority on "anchored" once the per-leg
 * projection replaces it — a separate, visible step, not a silent one.
 */
export function enqueueActivityReceiptAnchor(
  record: ActivityReceiptRecord,
  personaId: string,
): void {
  if (!shouldAnchorActionType(record.actionType)) return;
  /*
   * PER-LEG RETRY MUST NOT BE GATED BY THE LEGACY FLAG (operator directive,
   * 2026-08-08 item 2).
   *
   * `receipt_status` describes the DVN leg ONLY. Gating the whole enqueue on
   * `=== 'local'` means the commonest partial outcome — DVN succeeds, PoS
   * fails — flips the row to `dvn_pending` and thereby makes it permanently
   * ineligible for re-enqueue, stranding the PoS leg with no path back. The
   * scheduled reconciler must be able to drive either leg independently, which
   * is the entire point of tracking them separately.
   *
   * This guard is kept ONLY as a duplicate-submission check for the hot path
   * (a receipt that already has a DVN message id must not get a second one).
   * It is deliberately NOT a statement about the PoS leg: `enqueueReceiptLeg`
   * below is the per-leg entry point the reconciler uses, and it consults the
   * leg's OWN column.
   */
  if (record.receiptStatus !== 'local') return;
  // Background promise — intentionally not awaited.
  void (async () => {
    /*
     * H IS COMPUTED ONCE, BEFORE EITHER LEG, AND PERSISTED FIRST (operator
     * directive, 2026-08-08 item 1).
     *
     * The first version of this let each submitter derive H internally and
     * then persisted whatever `posResult` happened to carry. Two defects in
     * that: the identity shared by the legs was a coincidence of two
     * derivations agreeing rather than a fact, and — worse — if the PoS leg
     * threw before deriving anything, H was never persisted AT ALL even though
     * the DVN leg had already carried one on-chain. The row would then hold a
     * message committing to an H the database could not name, which is
     * unreconcilable by exactly the identity this design exists to establish.
     *
     * So: derive, persist, then hand the identical value to both legs.
     */
    const commitmentHash = computeReceiptCommitment(
      receiptCommitmentInput(record, hashPersonaRef(personaId)),
    );
    const supabaseForCommitment = getSupabaseServer();
    if (supabaseForCommitment) {
      await supabaseForCommitment
        .from('activity_receipts')
        .update({ commitment_hash: commitmentHash })
        .eq('id', record.id);
    }

    /*
     * BOTH LEGS, CONCURRENTLY, NEITHER BLOCKING THE OTHER. `allSettled` (not
     * `all`) because a PoS failure must never suppress a DVN submission that
     * would otherwise have succeeded, or vice versa — they are independently
     * tracked representations, not a transaction.
     */
    const [dvnSettled, posSettled] = await Promise.allSettled([
      submitActivityReceiptToDvn(record, personaId, commitmentHash),
      submitActivityReceiptToPos(record, personaId, commitmentHash),
    ]);
    const result: ActivityDvnSubmissionResult =
      dvnSettled.status === 'fulfilled'
        ? dvnSettled.value
        : { ok: false, error: dvnSettled.reason instanceof Error ? dvnSettled.reason.message : String(dvnSettled.reason) };
    const posResult: ActivityPosSubmissionResult =
      posSettled.status === 'fulfilled'
        ? posSettled.value
        : { ok: false, error: posSettled.reason instanceof Error ? posSettled.reason.message : String(posSettled.reason) };

    const supabase = getSupabaseServer();
    if (!supabase) return;

    /*
     * THE POS LEG IS RECORDED ON ITS OWN COLUMNS — never folded into
     * `receipt_status`, which describes the DVN leg alone. H is already
     * persisted above, so nothing here re-derives or re-writes it.
     */
    if (posResult.ok && posResult.posReceiptId) {
      await supabase
        .from('activity_receipts')
        .update({ pos_receipt_id: posResult.posReceiptId, pos_status: 'pending' })
        .eq('id', record.id);
    } else if (!posResult.withheld) {
      // A withheld leg is a policy posture, not an outcome: no escalation, no
      // 'failed' status, `pos_status` stays NULL per the schema's own meaning.
      const posUnreachable = !!posResult.error?.includes('not configured');
      if (!posUnreachable) {
        // Same escalation contract as the DVN leg: a PoS failure is a gap in
        // the Bitcoin half of the provenance trail and must be visible in
        // error-level logs, not swallowed.
        console.error(
          `[DVN ESCALATION] Activity receipt ${record.id} PoS leg FAILED — ` +
            `actionType=${record.actionType} error="${posResult.error ?? 'unknown'}"`,
        );
        await supabase.from('activity_receipts').update({ pos_status: 'failed' }).eq('id', record.id);
      }
    }

    if (result.ok && result.messageId) {
      await supabase
        .from('activity_receipts')
        .update({
          receipt_status: 'dvn_pending',
          dvn_receipt_id: result.messageId,
          dvn_status: 'submitted',
        })
        .eq('id', record.id);
    } else {
      // Stay 'local' so a future operator run can retry; only flip to
      // dvn_failed when the canister is reachable and returned an error.
      const isUnreachable = !!result.error?.includes('not configured');
      if (!isUnreachable) {
        // ESCALATION: DVN failures are critical — console.error ensures
        // they appear in CloudWatch/Amplify error-level logs so the
        // operator is alerted immediately.
        console.error(
          `[DVN ESCALATION] Activity receipt ${record.id} submission FAILED — ` +
            `actionType=${record.actionType} cartridge=${record.activeCartridge} ` +
            `error="${result.error ?? 'unknown'}"`,
        );
        await supabase
          .from('activity_receipts')
          .update({ receipt_status: 'dvn_failed', dvn_status: 'failed' })
          .eq('id', record.id);
      }
    }
  })().catch(() => undefined);
}

/**
 * Finalizer — flips activity_receipts from dvn_pending → dvn_recorded for
 * pending rows the DVN canister reports as individually ready. Designed to
 * be invoked from a cron / admin route on a schedule.
 *
 * ── READINESS-READ STRATEGY (operator-approved narrow modification,
 *    2026-08-09, "LIVE CLOSURE — MoneyPenny tokenId + DVN targeted
 *    finalization") ──────────────────────────────────────────────────────
 *
 * Previously called the canister's global `get_ready_messages()` — a
 * no-argument query enumerating EVERY ready message across the canister's
 * entire backlog. Live, this returned ~5.8 MB, exceeding the IC's 3 MiB
 * query-response cap (`IC0504`) and failing the finalizer outright.
 *
 * The fix targets only OUR OWN backlog instead of the canister's global
 * one: a bounded batch of `activity_receipts` rows already known to be
 * `dvn_pending` with a `dvn_receipt_id` on file, each checked individually
 * via the canister's existing `get_dvn_message` / `get_message_attestations`
 * targeted query methods (already declared in cross_chain_service's IDL —
 * no canister change, no IDL change). This changes ONLY the readiness READ;
 * everything else is untouched:
 *   - receipt commitment/hash semantics — untouched, not read or written here
 *   - DVN submission — untouched, lives in submitDvnAnchor above
 *   - the local → dvn_pending → dvn_recorded state machine — same states,
 *     same direction, still `.eq('receipt_status', 'dvn_pending')`-gated
 *   - Bitcoin/PoS logic — untouched, a fully separate leg (submitPosAnchor)
 *   - the definition of DVN Minted — still exactly `receipt_status ===
 *     'dvn_recorded'`; nothing here changes what that means
 *
 * READINESS SEMANTICS, PRESERVED EXACTLY: a message is ready when
 * `attestation_count >= REQUIRED_ATTESTATIONS` (the deployed canister's own
 * threshold, 2) — the same predicate `get_ready_messages()` applies
 * server-side, now evaluated per targeted message instead of over a global
 * enumeration. A message that no longer exists on the canister
 * (`get_dvn_message` returns None) cannot be ready by the same predicate
 * `get_ready_messages()` uses (a pruned/unknown message is never in its
 * result set either) — checked before counting attestations so a stale
 * `dvn_receipt_id` doesn't fabricate readiness from a coincidental empty
 * attestation list.
 *
 * EXCEPTION ISOLATION: each receipt's targeted read is independently
 * try/caught. One unavailable or slow message must not block the rest of
 * the batch from being checked and promoted.
 *
 * BOUNDED BATCH: `RECONCILIATION_BATCH_SIZE` limits one run to a fixed
 * number of pending receipts; a backlog larger than that drains over
 * successive scheduled runs — the same pattern already used by
 * `services/horizen/registrationReconciliation.ts`'s `MAX_ITEMS_PER_RUN`.
 *
 * NEVER RESUBMITS: this function only reads (`get_dvn_message` /
 * `get_message_attestations`) and promotes an EXISTING `dvn_pending` row —
 * it never calls `submit_dvn_message` or otherwise recreates a receipt
 * merely because it has not finalized yet.
 */
export interface ActivityReceiptFinalizationResult {
  ok: boolean;
  readyMessageCount: number;
  receiptsFinalized: number;
  /** How many dvn_pending receipts this run examined (bounded by RECONCILIATION_BATCH_SIZE). */
  pendingChecked?: number;
  /** Receipts whose targeted read failed/timed out this run — isolated, retried next run. */
  unresolvable?: number;
  error?: string;
}

/**
 * How many `dvn_pending` receipts one run will check. Mirrors
 * `services/horizen/registrationReconciliation.ts`'s `MAX_ITEMS_PER_RUN` —
 * a backlog larger than this drains over successive scheduled runs rather
 * than risking one run's wall-clock on an unbounded batch.
 */
const RECONCILIATION_BATCH_SIZE = 50;

/** The deployed canister's own readiness threshold — see module doc above. */
const REQUIRED_ATTESTATIONS = 2;

/** Per-targeted-call timeout — these are single-message query reads, far smaller than the global enumeration this replaces. */
const DVN_TARGETED_CALL_TIMEOUT_MS = 8_000;

interface TargetedDvnActor {
  get_dvn_message: (id: string) => Promise<Array<{ id: string }> | { id: string } | null>;
  get_message_attestations: (id: string) => Promise<Array<unknown>>;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ]);
}

/** Candid `opt` decodes as `[]` (none) or `[value]` (some) — normalized to a plain nullable. */
function unwrapOpt<T>(value: Array<T> | T | null | undefined): T | null {
  if (Array.isArray(value)) return value.length > 0 ? value[0] : null;
  return value ?? null;
}

export async function finalizeReadyActivityReceipts(): Promise<ActivityReceiptFinalizationResult> {
  const result: ActivityReceiptFinalizationResult = {
    ok: false,
    readyMessageCount: 0,
    receiptsFinalized: 0,
  };
  const canisterId =
    process.env.CROSS_CHAIN_SERVICE_CANISTER_ID ||
    process.env.NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID;
  if (!canisterId) {
    result.error = 'CROSS_CHAIN_SERVICE_CANISTER_ID not configured';
    return result;
  }
  const supabase = getSupabaseServer();
  if (!supabase) {
    result.error = 'Supabase unavailable';
    return result;
  }

  // OUR OWN bounded backlog — never the canister's global enumeration.
  const { data: pending, error: pendingError } = await supabase
    .from('activity_receipts')
    .select('id, dvn_receipt_id')
    .eq('receipt_status', 'dvn_pending')
    .not('dvn_receipt_id', 'is', null)
    .limit(RECONCILIATION_BATCH_SIZE);
  if (pendingError) {
    result.error = `activity_receipts read failed: ${pendingError.message}`;
    return result;
  }
  const pendingRows = (pending ?? []) as Array<{ id: string; dvn_receipt_id: string }>;
  result.pendingChecked = pendingRows.length;
  if (pendingRows.length === 0) {
    result.ok = true;
    return result;
  }

  let dvn: TargetedDvnActor;
  try {
    dvn = await getActor<TargetedDvnActor>(canisterId, dvnIdl);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[DVN ESCALATION] Finalizer canister actor FAILED: ${errMsg}`);
    result.error = `Canister actor failed: ${errMsg}`;
    return result;
  }

  let unresolvable = 0;
  const readyReceiptIds: string[] = [];
  await Promise.all(
    pendingRows.map(async (row) => {
      try {
        const message = unwrapOpt(
          await withTimeout(dvn.get_dvn_message(row.dvn_receipt_id), DVN_TARGETED_CALL_TIMEOUT_MS, `get_dvn_message(${row.dvn_receipt_id})`),
        );
        // No message on the canister → cannot be in get_ready_messages()'s
        // result set either (the same predicate this replaces never
        // considers a message that doesn't exist). Not an error: retried
        // next run in case of eventual consistency, never promoted now.
        if (!message) return;

        const attestations = await withTimeout(
          dvn.get_message_attestations(row.dvn_receipt_id),
          DVN_TARGETED_CALL_TIMEOUT_MS,
          `get_message_attestations(${row.dvn_receipt_id})`,
        );
        const attestationCount = Array.isArray(attestations) ? attestations.length : 0;
        if (attestationCount >= REQUIRED_ATTESTATIONS) {
          readyReceiptIds.push(row.id);
        }
      } catch (err) {
        // ONE unavailable/slow message must not block the rest of the batch —
        // isolated here, reported in the count, retried on the next run.
        unresolvable += 1;
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`[DVN ESCALATION] Finalizer targeted read failed for receipt ${row.id} (dvnReceiptId=${row.dvn_receipt_id}): ${errMsg}`);
      }
    }),
  );
  result.unresolvable = unresolvable;
  result.readyMessageCount = readyReceiptIds.length;

  if (readyReceiptIds.length === 0) {
    result.ok = true;
    return result;
  }

  const { data, error } = await supabase
    .from('activity_receipts')
    .update({ receipt_status: 'dvn_recorded' })
    .in('id', readyReceiptIds)
    .eq('receipt_status', 'dvn_pending')
    .select('id');
  if (error) {
    result.error = `activity_receipts update failed: ${error.message}`;
    return result;
  }
  result.receiptsFinalized = data?.length ?? 0;
  result.ok = true;
  return result;
}
