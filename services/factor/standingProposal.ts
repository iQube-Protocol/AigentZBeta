/**
 * standingProposal — Factor PROPOSES standing events; it never writes
 * standing directly (PRD §10, invariant "Factor may emit standing
 * proposals, not standing awards"), reconciled onto spec/moneypenny-mpy2-3.
 *
 * This module writes ONLY to factor_standing_proposals. It never touches
 * `services/crm/standingAccrualService.ts` — the CURRENT tree's real
 * standing-accrual write path — nor the standing tables it owns. Carrying
 * an accepted proposal into an actual standing accrual is a separate,
 * out-of-scope human/operator-reviewed step that must go through that
 * existing accrual code path, never invented here.
 */

import { randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';

export class StandingProposalError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'StandingProposalError';
  }
}

export interface CreateStandingProposalInput {
  caseId?: string | null;
  subjectAgentRef: string;
  standingPersonaId?: string | null;
  proposedEventKind: string;
  rationale: string;
  proposedByPersonaId: string;
  veracityEvidenceRefs?: unknown[];
  contributionEvidenceRefs?: unknown[];
  riskOfRepairEvidenceRefs?: unknown[];
  pulsePnlRefs?: unknown[];
}

/**
 * PRD §10: "Positive economic outcome alone is insufficient." Enforced
 * here as a hard gate (mirrored at the DB layer by
 * chk_factor_standing_proposals_evidence): a proposal with NO evidence in
 * any of the three evidence arrays is refused outright.
 */
export async function createStandingProposal(admin: SupabaseClient, input: CreateStandingProposalInput): Promise<{ proposal_id: string }> {
  const hasEvidence =
    (input.veracityEvidenceRefs?.length ?? 0) > 0 || (input.contributionEvidenceRefs?.length ?? 0) > 0 || (input.riskOfRepairEvidenceRefs?.length ?? 0) > 0;
  if (!hasEvidence) {
    throw new StandingProposalError(
      'no-consequence-evidence',
      'Refusing to create a standing proposal with no veracity, contribution, or risk-of-repair evidence — positive economic outcome alone is insufficient (PRD §10).',
    );
  }

  const proposalId = randomUUID();
  const { data, error } = await admin
    .from('factor_standing_proposals')
    .insert({
      proposal_id: proposalId,
      case_id: input.caseId ?? null,
      subject_agent_ref: input.subjectAgentRef,
      standing_persona_id: input.standingPersonaId ?? null,
      proposed_event_kind: input.proposedEventKind,
      rationale: input.rationale,
      proposed_by_persona_id: input.proposedByPersonaId,
      veracity_evidence_refs: input.veracityEvidenceRefs ?? [],
      contribution_evidence_refs: input.contributionEvidenceRefs ?? [],
      risk_of_repair_evidence_refs: input.riskOfRepairEvidenceRefs ?? [],
      pulse_pnl_refs: input.pulsePnlRefs ?? [],
    })
    .select('proposal_id')
    .single();
  if (error) throw new Error(`createStandingProposal failed: ${error.message}`);

  const receipt = await createActivityReceipt({
    personaId: input.proposedByPersonaId,
    activeCartridge: 'moneypenny',
    actionType: 'factor_standing_proposed',
    summary: `Factor proposed a standing event for ${input.subjectAgentRef}: ${input.proposedEventKind}`,
    agentsInvoked: ['aigent-factor'],
    actionInput: { proposalId, subjectAgentRef: input.subjectAgentRef, proposedEventKind: input.proposedEventKind },
  });
  if (receipt?.id) await admin.from('factor_standing_proposals').update({ receipt_ref: receipt.id }).eq('proposal_id', proposalId);

  return data as { proposal_id: string };
}

/**
 * A human/operator reviewer's decision on the proposal. This function
 * ONLY flips factor_standing_proposals.status — it deliberately does NOT
 * write to any standing-accrual table.
 */
export async function decideStandingProposal(admin: SupabaseClient, proposalId: string, decision: 'accepted' | 'rejected', decidedByPersonaId: string): Promise<void> {
  const { error } = await admin
    .from('factor_standing_proposals')
    .update({ status: decision, decided_by_persona_id: decidedByPersonaId, decided_at: new Date().toISOString() })
    .eq('proposal_id', proposalId)
    .eq('status', 'proposed');
  if (error) throw new Error(`decideStandingProposal failed: ${error.message}`);
}
