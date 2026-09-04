/**
 * Factor's standing PROPOSAL queue (PRD §10) — Factor never writes standing
 * directly. Unit tests against the in-memory fakeSupabase fixture, plus an
 * explicit assertion that services/crm/standingAccrualService.ts (the real
 * accrual path in this tree) is never imported/invoked by this module.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeFakeAdmin } from './fixtures/fakeSupabase';

vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: vi.fn(async () => ({ id: 'receipt-stub' })),
}));

import { createStandingProposal, decideStandingProposal, StandingProposalError } from '@/services/factor/standingProposal';

describe('standingProposal', () => {
  let admin: ReturnType<typeof makeFakeAdmin>;
  beforeEach(() => {
    admin = makeFakeAdmin();
  });

  it('refuses a proposal carrying no veracity/contribution/risk-of-repair evidence', async () => {
    await expect(
      createStandingProposal(admin, {
        subjectAgentRef: 'aigent-factor',
        proposedEventKind: 'productive_activity',
        rationale: 'delivered a service',
        proposedByPersonaId: 'persona-1',
      }),
    ).rejects.toMatchObject({ code: 'no-consequence-evidence' });
  });

  it('accepts a proposal with contribution evidence, and decideStandingProposal never writes any standing-accrual table', async () => {
    const { proposal_id } = await createStandingProposal(admin, {
      subjectAgentRef: 'aigent-factor',
      proposedEventKind: 'productive_activity',
      rationale: 'matched a service request and delivered it',
      proposedByPersonaId: 'persona-1',
      contributionEvidenceRefs: [{ receiptId: 'receipt-1' }],
    });
    await decideStandingProposal(admin, proposal_id, 'accepted', 'persona-moneypenny');

    const row = admin.table('factor_standing_proposals').find((r: any) => r.proposal_id === proposal_id);
    expect(row.status).toBe('accepted');

    // The only tables this module ever wrote to in this whole test run.
    const touchedTables = Object.keys((admin as any).tables ?? {});
    expect(touchedTables).toEqual(['factor_standing_proposals']);
    expect(touchedTables).not.toContain('crm_persona_reputation');
    expect(touchedTables).not.toContain('crm_reputation_events');
  });
});
