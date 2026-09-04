/**
 * admissionAuthority — MoneyPenny's SOLE admission decision (PRD Journey C
 * steps 3-7, §2 hard invariant 3, acceptance criteria 9/10).
 *
 * This is the ONLY function in this codebase permitted to move a
 * factor_cases row into 'admitted' | 'conditionally_admitted' | 'rejected'.
 * services/factor/factorCaseService.ts's transitionCaseState() explicitly
 * refuses those three target states so that a Factor-side code path can
 * never reach this outcome directly (PRD §2 invariant 3: "MoneyPenny can
 * admit only under an accountable operator's authority").
 *
 * "Factor cannot alter the MoneyPenny decision" (Journey C step 7) —
 * enforced structurally: nothing here reads a "recommended decision" field
 * off the case and neither does anything else in services/factor/* have a
 * write path to this table's decision columns.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { FactorCaseRow } from '../factor/factorCaseService';
import { appendCaseEvent } from '../factor/factorCaseService';
import { recordFactorReceipt } from '../factor/receipts';
import { personaRef, assertNotRawPersonaId } from '../factor/identityRefs';
import { buildAdmissionPacket, type AdmissionPacket } from '../factor/admissionPacket';

export class AdmissionAuthorityError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AdmissionAuthorityError';
  }
}

export type AdmissionDecision = 'admitted' | 'conditionally_admitted' | 'rejected';

export interface DecideAdmissionInput {
  caseId: string;
  decision: AdmissionDecision;
  /** The accountable operator/MoneyPenny-attributed persona making this
   *  call — never Factor's own agent ref (PRD §2 invariant 3). */
  decidingPersonaId: string;
  conditions?: string[];
  reason?: string;
  idempotencyKey?: string;
}

export interface DecideAdmissionResult {
  case: FactorCaseRow;
  packet: AdmissionPacket;
  replay: boolean;
}

/**
 * Evaluates the packet against runtime policy and records the decision.
 * Policy applied here (0.1 scope — a fuller policy engine is a Phase 5+
 * concern, not invented here):
 *
 *   - the case MUST be in 'admission_pending' (server-side state-machine
 *     enforcement, same discipline as transitionCaseState)
 *   - 'admitted' or 'conditionally_admitted' REQUIRE a ratified Aegis
 *     assessment whose decision is 'admissible' or
 *     'admissible_with_conditions' respectively — MoneyPenny may still
 *     reject an admissible candidate (its judgment is not bound to
 *     Aegis's recommendation), but it may never ADMIT one Aegis has not
 *     found admissible (PRD §2 invariant 1-2: Aegis recommends, MoneyPenny
 *     decides, but a recommendation Aegis never made cannot be manufactured
 *     by MoneyPenny either — there is no "admit anyway" path in 0.1).
 *   - 'rejected' has no precondition — MoneyPenny may reject at any time
 *     from 'admission_pending'.
 */
export async function decideAdmission(admin: SupabaseClient, input: DecideAdmissionInput): Promise<DecideAdmissionResult> {
  assertNotRawPersonaId(personaRef(input.decidingPersonaId), 'decideAdmission (post-hash check)');

  // Idempotent replay: an admission decision already recorded under this
  // exact idempotency key returns the same outcome rather than
  // re-evaluating (PRD acceptance-criteria failure-path test "replayed
  // admission command").
  if (input.idempotencyKey) {
    const { data: existingEvent, error: evErr } = await admin
      .from('factor_case_events')
      .select('event_id, to_state')
      .eq('case_id', input.caseId)
      .eq('idempotency_key', input.idempotencyKey)
      .maybeSingle();
    if (evErr) throw new Error(`decideAdmission idempotency lookup failed: ${evErr.message}`);
    if (existingEvent) {
      const { data: caseRow, error: caseErr } = await admin.from('factor_cases').select('*').eq('case_id', input.caseId).single();
      if (caseErr) throw new Error(`decideAdmission replay case read failed: ${caseErr.message}`);
      const packet = await buildAdmissionPacket(admin, input.caseId);
      return { case: caseRow as FactorCaseRow, packet, replay: true };
    }
  }

  const { data: caseRow, error: caseErr } = await admin.from('factor_cases').select('*').eq('case_id', input.caseId).maybeSingle();
  if (caseErr) throw new Error(`decideAdmission case read failed: ${caseErr.message}`);
  if (!caseRow) throw new AdmissionAuthorityError('case-not-found', `No factor_cases row for case_id ${input.caseId}`);
  const c = caseRow as FactorCaseRow;

  if (c.state !== 'admission_pending') {
    throw new AdmissionAuthorityError(
      'not-admission-pending',
      `Case ${input.caseId} is '${c.state}', not 'admission_pending' — an admission decision may only be recorded from that state.`,
    );
  }

  const packet = await buildAdmissionPacket(admin, input.caseId);

  if (input.decision === 'admitted' || input.decision === 'conditionally_admitted') {
    const required = input.decision === 'admitted' ? 'admissible' : 'admissible_with_conditions';
    if (!packet.ratifiedAssessment.verified) {
      throw new AdmissionAuthorityError(
        'no-ratified-assessment',
        `Case ${input.caseId} has no ratified Aegis assessment — cannot ${input.decision}.`,
      );
    }
    if (packet.ratifiedAssessment.decision !== required && !(input.decision === 'conditionally_admitted' && packet.ratifiedAssessment.decision === 'admissible')) {
      throw new AdmissionAuthorityError(
        'assessment-does-not-support-decision',
        `Case ${input.caseId}'s ratified assessment decision ('${packet.ratifiedAssessment.decision}') does not support MoneyPenny admitting it as '${input.decision}'.`,
      );
    }
  }

  const { data: updated, error: updateErr } = await admin
    .from('factor_cases')
    .update({ state: input.decision, updated_at: new Date().toISOString() })
    .eq('case_id', input.caseId)
    .eq('state', 'admission_pending')
    .select('*')
    .maybeSingle();
  if (updateErr) throw new Error(`decideAdmission update failed: ${updateErr.message}`);
  if (!updated) {
    throw new AdmissionAuthorityError('concurrent-transition', `Case ${input.caseId} changed concurrently — retry the admission decision.`);
  }

  await appendCaseEvent(admin, {
    caseId: input.caseId,
    eventType: 'admission_decided',
    fromState: 'admission_pending',
    toState: input.decision,
    actorPersonaId: input.decidingPersonaId,
    payload: { conditions: input.conditions ?? [], reason: input.reason ?? null, assessmentHash: packet.ratifiedAssessment.assessmentHash },
    idempotencyKey: input.idempotencyKey,
  });

  await recordFactorReceipt(admin, {
    eventType: 'moneypenny_admission_decided',
    caseId: input.caseId,
    actorPersonaRef: personaRef(input.decidingPersonaId),
    fromRole: 'moneypenny',
    toRole: 'factor',
    metadata: {
      decision: input.decision,
      assessmentHash: packet.ratifiedAssessment.assessmentHash,
      registryReady: packet.registryReadiness.verified,
    },
  });

  return { case: updated as FactorCaseRow, packet, replay: false };
}
