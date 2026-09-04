/**
 * standingProposal — Factor proposes, never writes, standing (PRD §10,
 * failure-path test "standing proposal without consequence evidence").
 */
import { describe, it, expect } from 'vitest';
import { makeFakeAdmin } from './fixtures/fakeSupabase';
import { createStandingProposal, decideStandingProposal, StandingProposalError } from '../services/factor/standingProposal';

describe('standingProposal', () => {
  it('refuses a proposal with no veracity/contribution/risk evidence', async () => {
    const admin = makeFakeAdmin();
    await expect(
      createStandingProposal(admin, {
        subjectAgentRef: 'agent-ref-candidate',
        proposingPrincipalRef: 'agent-ref-factor',
        witnessedAction: 'settled a Bankr swap',
      }),
    ).rejects.toBeInstanceOf(StandingProposalError);
  });

  it('accepts a proposal carrying contribution evidence, and never mutates crm_persona_reputation', async () => {
    const admin = makeFakeAdmin();
    const { proposal_id } = await createStandingProposal(admin, {
      subjectAgentRef: 'agent-ref-candidate',
      proposingPrincipalRef: 'agent-ref-factor',
      witnessedAction: 'settled a Bankr swap within its bounded mandate',
      contributionEvidence: [{ receiptRef: 'r-1' }],
    });
    expect(proposal_id).toBeTruthy();

    const row = admin.table('factor_standing_proposals').find((r: any) => r.proposal_id === proposal_id);
    expect(row.status).toBe('pending');

    await decideStandingProposal(admin, proposal_id, 'accepted', 'persona-ref-reviewer', 'looks good');
    const decided = admin.table('factor_standing_proposals').find((r: any) => r.proposal_id === proposal_id);
    expect(decided.status).toBe('accepted');

    // This service must never touch the real standing-accrual tables.
    expect(admin.table('crm_persona_reputation')).toHaveLength(0);
    expect(admin.table('crm_reputation_events')).toHaveLength(0);
  });
});
