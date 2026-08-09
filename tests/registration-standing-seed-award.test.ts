/**
 * services/journey/registrationStandingSeedAward.ts — the production wiring
 * for registrationStandingSeed.ts's documented settle-then-award contract
 * (Horizen Pilot Closure item 2, 2026-08-09). Every real dependency mocked;
 * exercises awardRegistrationStandingSeedIfEligible() directly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSettleFact = vi.fn();
const mockShouldAward = vi.fn();
vi.mock('@/services/journey/settledFacts', () => ({
  settleFact: (...args: any[]) => mockSettleFact(...args),
  shouldAwardRegistrationSeed: (...args: any[]) => mockShouldAward(...args),
}));

const mockCreateActivityReceipt = vi.fn(async (input: any) => ({ id: `receipt-${input.actionType}`, ...input }));
vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: (...args: any[]) => mockCreateActivityReceipt(...args),
}));

import { awardRegistrationStandingSeedIfEligible } from '@/services/journey/registrationStandingSeedAward';
import { REGISTRATION_SEED_STANDING, REGISTRATION_SEED_BASIS } from '@/services/journey/registrationStandingSeed';

const NAKAMOTO = {
  slug: 'nakamoto',
  displayName: 'Aigent Nakamoto',
  runtimeAgentId: 'aigent-nakamoto',
  aigentQubeId: 'aigentqube-nakamoto',
  agentCardPath: '/api/agents/nakamoto/agent-card.json',
  fioHandle: 'nakamoto@aigent',
};

const MONEYPENNY = {
  slug: 'moneypenny',
  displayName: 'Aigent MoneyPenny',
  runtimeAgentId: 'aigent-moneypenny',
  aigentQubeId: 'aigentqube-moneypenny',
  agentCardPath: '/api/agents/moneypenny/agent-card.json',
  fioHandle: 'moneypenny@aigent',
};

const admin = {} as any;

beforeEach(() => {
  mockSettleFact.mockReset();
  mockShouldAward.mockReset();
  mockCreateActivityReceipt.mockClear();
});

describe('awardRegistrationStandingSeedIfEligible', () => {
  it('skips, never calls settleFact, when already seeded', async () => {
    const outcome = await awardRegistrationStandingSeedIfEligible(admin, NAKAMOTO, 'persona-op-1', {
      alreadySeeded: true,
      factoryIngestedNow: true,
      evidenceReceiptIds: ['receipt-1'],
    });
    expect(outcome).toEqual({ awarded: false, alreadySettled: true, skippedReason: 'already-seeded', receiptId: null });
    expect(mockSettleFact).not.toHaveBeenCalled();
    expect(mockCreateActivityReceipt).not.toHaveBeenCalled();
  });

  it('skips, never calls settleFact, when not yet eligible', async () => {
    const outcome = await awardRegistrationStandingSeedIfEligible(admin, NAKAMOTO, 'persona-op-1', {
      alreadySeeded: false,
      factoryIngestedNow: false,
      evidenceReceiptIds: [],
    });
    expect(outcome.skippedReason).toBe('not-eligible');
    expect(mockSettleFact).not.toHaveBeenCalled();
  });

  it('on genuine first eligibility, settles then awards exactly one standing_accrued receipt, agent-generically', async () => {
    mockSettleFact.mockResolvedValue({ ok: true, alreadySettled: false, fact: { subject: 'aigent-nakamoto' } });
    mockShouldAward.mockReturnValue(true);

    const outcome = await awardRegistrationStandingSeedIfEligible(admin, NAKAMOTO, 'persona-op-1', {
      alreadySeeded: false,
      factoryIngestedNow: true,
      evidenceReceiptIds: ['receipt-capability-1'],
    });

    expect(mockSettleFact).toHaveBeenCalledWith(admin, 'aigentqube-nakamoto', expect.objectContaining({
      subject: 'aigent-nakamoto',
      predicate: 'registry_standing_seeded',
      object: { amount: REGISTRATION_SEED_STANDING, basis: REGISTRATION_SEED_BASIS, tier: 'initial' },
      evidenceRefs: ['receipt-capability-1'],
      resolutionAuthority: 'persona-op-1',
    }));

    expect(mockCreateActivityReceipt).toHaveBeenCalledTimes(1);
    const receiptInput = mockCreateActivityReceipt.mock.calls[0][0];
    expect(receiptInput.actionType).toBe('standing_accrued');
    expect(receiptInput.personaId).toBe('persona-op-1'); // attributed to the operator, not a static string
    expect(receiptInput.agentsInvoked).toEqual(['aigent-nakamoto']); // agent-generic, never hardcoded moneypenny
    expect(receiptInput.actionInput.amount).toBe(REGISTRATION_SEED_STANDING);
    expect(receiptInput.actionInput.basis).toBe(REGISTRATION_SEED_BASIS);
    expect(receiptInput.actionInput.impliesPerformance).toBe(false);

    expect(outcome.awarded).toBe(true);
    expect(outcome.receiptId).toBe('receipt-standing_accrued');
  });

  it('works identically for a second, different agent — nothing hardcodes moneypenny or nakamoto', async () => {
    mockSettleFact.mockResolvedValue({ ok: true, alreadySettled: false, fact: {} });
    mockShouldAward.mockReturnValue(true);

    await awardRegistrationStandingSeedIfEligible(admin, MONEYPENNY, 'persona-op-2', {
      alreadySeeded: false,
      factoryIngestedNow: true,
      evidenceReceiptIds: [],
    });

    expect(mockSettleFact).toHaveBeenCalledWith(admin, 'aigentqube-moneypenny', expect.objectContaining({ subject: 'aigent-moneypenny' }));
    const receiptInput = mockCreateActivityReceipt.mock.calls[0][0];
    expect(receiptInput.agentsInvoked).toEqual(['aigent-moneypenny']);
  });

  it('does not award when settleFact reports alreadySettled (a concurrent request won the race)', async () => {
    mockSettleFact.mockResolvedValue({ ok: true, alreadySettled: true, fact: {} });
    mockShouldAward.mockReturnValue(false); // real shouldAwardRegistrationSeed returns false when alreadySettled

    const outcome = await awardRegistrationStandingSeedIfEligible(admin, NAKAMOTO, 'persona-op-1', {
      alreadySeeded: false,
      factoryIngestedNow: true,
      evidenceReceiptIds: [],
    });

    expect(outcome.awarded).toBe(false);
    expect(outcome.alreadySettled).toBe(true);
    expect(mockCreateActivityReceipt).not.toHaveBeenCalled();
  });

  it('reports settle-failed rather than throwing when settleFact cannot write', async () => {
    mockSettleFact.mockResolvedValue({ ok: false, reason: 'no-write-target', detail: 'no registry_assets row' });

    const outcome = await awardRegistrationStandingSeedIfEligible(admin, NAKAMOTO, 'persona-op-1', {
      alreadySeeded: false,
      factoryIngestedNow: true,
      evidenceReceiptIds: [],
    });

    expect(outcome).toEqual({ awarded: false, alreadySettled: false, skippedReason: 'settle-failed', receiptId: null });
    expect(mockCreateActivityReceipt).not.toHaveBeenCalled();
  });

  it('never throws — a thrown settleFact is caught and reported as settle-failed', async () => {
    mockSettleFact.mockRejectedValue(new Error('supabase unreachable'));
    const outcome = await awardRegistrationStandingSeedIfEligible(admin, NAKAMOTO, 'persona-op-1', {
      alreadySeeded: false,
      factoryIngestedNow: true,
      evidenceReceiptIds: [],
    });
    expect(outcome.skippedReason).toBe('settle-failed');
  });
});
