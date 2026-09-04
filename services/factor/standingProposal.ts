/**
 * standingProposal — Factor PROPOSES standing events; it never writes
 * standing directly (PRD §10, invariant 18, acceptance criterion 18,
 * failure-path test "standing proposal without consequence evidence").
 *
 * This module writes ONLY to factor_standing_proposals. It never touches
 * `crm_persona_reputation` / `crm_reputation_events` (the existing
 * standing-accrual tables) — that write belongs to a human/operator
 * reviewer's separate, out-of-scope acceptance action, exactly as PRD §10
 * requires ("Factor may emit standing proposals, not standing awards").
 */

import type { SupabaseClient } from '@supabase/supabase-js';

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
  proposingPrincipalRef: string;
  witnessedAction: string;
  mandateAuthorityChainId?: string | null;
  expectedOutcome?: string;
  observedOutcome?: string;
  veracityEvidence?: unknown[];
  contributionEvidence?: unknown[];
  riskOfRepairEvidence?: unknown[];
  pulsePnlRefs?: unknown[];
  receiptRefs?: unknown[];
}

/**
 * PRD §10: "Positive economic outcome alone is insufficient... Failure,
 * remediation and responsible revocation may also be standing-relevant.
 * Preserve negative and contradictory evidence." Enforced here as a hard
 * gate: a proposal with NO evidence in any of the three evidence arrays is
 * refused outright — an unevidenced proposal is not a lesser proposal, it
 * is not a valid one (the acceptance-criteria failure-path test "standing
 * proposal without consequence evidence" names this exact case).
 */
export async function createStandingProposal(
  admin: SupabaseClient,
  input: CreateStandingProposalInput,
): Promise<{ proposal_id: string }> {
  const hasEvidence =
    (input.veracityEvidence?.length ?? 0) > 0 ||
    (input.contributionEvidence?.length ?? 0) > 0 ||
    (input.riskOfRepairEvidence?.length ?? 0) > 0;
  if (!hasEvidence) {
    throw new StandingProposalError(
      'no-consequence-evidence',
      'Refusing to create a standing proposal with no veracity, contribution, or risk-of-repair evidence — ' +
        'positive economic outcome alone is insufficient (PRD §10).',
    );
  }

  const { data, error } = await admin
    .from('factor_standing_proposals')
    .insert({
      case_id: input.caseId ?? null,
      subject_agent_ref: input.subjectAgentRef,
      proposing_principal_ref: input.proposingPrincipalRef,
      witnessed_action: input.witnessedAction,
      mandate_authority_chain_id: input.mandateAuthorityChainId ?? null,
      expected_outcome: input.expectedOutcome ?? null,
      observed_outcome: input.observedOutcome ?? null,
      veracity_evidence: input.veracityEvidence ?? [],
      contribution_evidence: input.contributionEvidence ?? [],
      risk_of_repair_evidence: input.riskOfRepairEvidence ?? [],
      pulse_pnl_refs: input.pulsePnlRefs ?? [],
      receipt_refs: input.receiptRefs ?? [],
    })
    .select('proposal_id')
    .single();
  if (error) throw new Error(`createStandingProposal failed: ${error.message}`);
  return data as { proposal_id: string };
}

/**
 * A human/operator reviewer's decision on the proposal. This function
 * ONLY flips factor_standing_proposals.status — it deliberately does NOT
 * write to crm_persona_reputation/crm_reputation_events. Carrying an
 * accepted proposal into an actual standing accrual is a separate,
 * out-of-scope step that must go through the existing accrual code path
 * (crm standing engine), never invented here.
 */
export async function decideStandingProposal(
  admin: SupabaseClient,
  proposalId: string,
  decision: 'accepted' | 'rejected',
  decidedByPersonaRef: string,
  notes?: string,
): Promise<void> {
  const { error } = await admin
    .from('factor_standing_proposals')
    .update({
      status: decision,
      decided_by_persona_ref: decidedByPersonaRef,
      decided_at: new Date().toISOString(),
      decision_notes: notes ?? null,
    })
    .eq('proposal_id', proposalId)
    .eq('status', 'pending');
  if (error) throw new Error(`decideStandingProposal failed: ${error.message}`);
}
