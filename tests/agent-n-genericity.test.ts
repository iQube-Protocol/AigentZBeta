/**
 * Agent-N genericity proof, part 1 — functions genuinely agent-generic BY
 * CONSTRUCTION (Horizen Pilot Closure item 10, 2026-08-09).
 *
 * Proves that a THIRD, synthetic, config-only agent — "Aigent Q" — is
 * handled correctly by registration Standing seed award, P&L verification
 * boundary, and journey narration templating — none of which accept a slug
 * or resolve an agent themselves; each takes a RegistrableAgentConfig
 * PARAMETER, so genuinely generic code has no reason to care where the
 * object came from. See tests/agent-n-genericity-resolution.test.ts for the
 * companion proof at the slug/runtimeAgentId RESOLUTION boundary
 * (preflight, registration reconciler) — split into its own file because
 * that half needs a mocked canonical registry, which would conflict with
 * this half's mocks of the same shared modules.
 *
 * Every assertion fails if production logic silently defaults to Nakamoto or
 * MoneyPenny instead of genuinely using the agent it was given.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RegistrableAgentConfig } from '@/services/horizen/registrableAgents';

const AGENT_Q: RegistrableAgentConfig = {
  slug: 'agent-q',
  displayName: 'Aigent Q',
  runtimeAgentId: 'aigent-agent-q',
  aigentQubeId: 'aigentqube-agent-q',
  agentCardPath: '/api/agents/agent-q/agent-card.json',
  fioHandle: 'agent-q@aigent',
  runtimeHealthPath: '/api/agents/agent-q/health',
};

const FORBIDDEN_NAMES = ['MoneyPenny', 'Nakamoto'];

function assertNamesOnlyAgentQ(value: unknown, label: string) {
  const text = JSON.stringify(value);
  for (const forbidden of FORBIDDEN_NAMES) {
    expect(text, `${label} unexpectedly mentions "${forbidden}" — a real agent name leaked into Agent Q's own result`).not.toContain(forbidden);
  }
}

const mockSettleFact = vi.fn();
vi.mock('@/services/journey/settledFacts', () => ({
  settleFact: (...args: any[]) => mockSettleFact(...args),
}));

const mockCreateActivityReceipt = vi.fn(async (input: any) => ({ id: 'receipt-agent-q-1', ...input }));
vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: (...args: any[]) => mockCreateActivityReceipt(...args),
}));

const mockDiscover = vi.fn();
vi.mock('@/services/horizen/pnlServiceVerification', () => ({
  discoverAndReceiptPnlServiceEvidence: (...args: any[]) => mockDiscover(...args),
}));

beforeEach(() => {
  mockSettleFact.mockReset().mockResolvedValue({ ok: true, alreadySettled: false, fact: {} });
  mockCreateActivityReceipt.mockClear();
  mockDiscover.mockReset().mockResolvedValue({ ok: true, verified: false, evidencePending: true, reason: 'NOT_FOUND', detail: 'x', openContractQuestion: 'q' });
});

describe('registration Standing seed award — generic by construction', () => {
  it('settles and awards keyed on Agent Q\'s OWN ids, naming only Agent Q', async () => {
    const { awardRegistrationStandingSeedIfEligible } = await import('@/services/journey/registrationStandingSeedAward');
    const outcome = await awardRegistrationStandingSeedIfEligible({} as any, AGENT_Q, 'persona-op-q', {
      alreadySeeded: false,
      factoryIngestedNow: true,
      evidenceReceiptIds: [],
    });
    expect(outcome.awarded).toBe(true);
    expect(mockSettleFact).toHaveBeenCalledWith({}, 'aigentqube-agent-q', expect.objectContaining({ subject: 'aigent-agent-q' }));
    const receiptInput = mockCreateActivityReceipt.mock.calls[0][0];
    expect(receiptInput.agentsInvoked).toEqual(['aigent-agent-q']);
    assertNamesOnlyAgentQ(receiptInput, 'standing seed receipt');
  });
});

describe('P&L verification boundary — generic by construction', () => {
  it('calls the correlator with Agent Q\'s own subject/network, never a hardcoded one', async () => {
    const { attemptPnlServiceVerificationIfEligible } = await import('@/services/horizen/pnlVerificationBoundary');
    await attemptPnlServiceVerificationIfEligible(
      AGENT_Q,
      { registered: true, tokenId: '999', registryAgentId: null, network: 'base-sepolia' },
      'persona-op-q',
    );
    expect(mockDiscover).toHaveBeenCalledWith(
      expect.objectContaining({ aigentQubeId: 'aigentqube-agent-q', runtimeAgentId: 'aigent-agent-q', subjectRegistryAlias: '999' }),
    );
  });
});

describe('journey narration templating — generic by construction', () => {
  it('renders every templated journey-copy string for Agent Q, mentioning only Agent Q', async () => {
    const { HORIZEN_MONEYPENNY_JOURNEY } = await import('@/services/journey/horizenMoneyPennyJourney');
    const { renderJourneyCopy, AGENT_DISPLAY_NAME_TOKEN } = await import('@/services/journey/journeyCopyTemplate');
    let sawAtLeastOneToken = false;
    for (const stage of HORIZEN_MONEYPENNY_JOURNEY.stages) {
      const companion = (stage as { companion?: { before?: string; complete?: string } }).companion;
      for (const raw of [stage.description, companion?.before, companion?.complete]) {
        if (typeof raw !== 'string' || !raw.includes(AGENT_DISPLAY_NAME_TOKEN)) continue;
        sawAtLeastOneToken = true;
        const rendered = renderJourneyCopy(raw, AGENT_Q);
        expect(rendered).toContain('Aigent Q');
        assertNamesOnlyAgentQ(rendered, `stage "${stage.id}" narration`);
      }
    }
    expect(sawAtLeastOneToken, 'no templated narration was found at all — this test would pass vacuously without item 5\'s fix').toBe(true);
  });

  it('the Companion intro text names Agent Q, mentioning only Agent Q', async () => {
    const { buildJourneyIntroText } = await import('@/services/journey/journeyCompanionTrigger');
    const intro = buildJourneyIntroText(AGENT_Q);
    expect(intro).toContain('Aigent Q');
    assertNamesOnlyAgentQ(intro, 'Companion intro text');
  });
});
