/**
 * GET /api/journey/moneypenny-horizen/verify/status — the Verify stage's
 * status check (2026-08-05, al's brief: "A Horizen /verify/authorize
 * timeout is a transport condition, not a constitutional state").
 *
 * Pins: no persisted authorization row -> 'not-started'; PREPARED/
 * AWAITING_SIGNATURE/SIGNED -> 'pending' (never a denial); SUBMITTED
 * re-attempts ONLY the reread, bounded by this route's own deadline, and a
 * timeout on that reread -> 'pending' (never 'denied', never a raw platform
 * 504); CONFIRMED -> 'complete'; REFUSED/QUARANTINED -> 'denied'; EXPIRED
 * -> 'expired', distinct from a partner denial.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const mockGetActivePersona = vi.fn();
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (req: unknown) => mockGetActivePersona(req),
}));

const mockGetSupabaseServer = vi.fn();
vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => mockGetSupabaseServer(),
}));

const mockResolveRegistrableAgent = vi.fn();
vi.mock('@/services/horizen/registrableAgents', () => ({
  resolveRegistrableAgent: (...args: any[]) => mockResolveRegistrableAgent(...args),
  DEFAULT_REGISTRABLE_AGENT_SLUG: 'moneypenny',
}));

const mockResolveHorizenRegistrationBinding = vi.fn();
vi.mock('@/services/horizen/agentRegistrationBinding', () => ({
  resolveHorizenRegistrationBinding: (...args: any[]) => mockResolveHorizenRegistrationBinding(...args),
}));

const mockGetPartnerAuthorizationRequest = vi.fn();
vi.mock('@/services/horizen/partnerAuthorizationStore', () => ({
  getPartnerAuthorizationRequest: (...args: any[]) => mockGetPartnerAuthorizationRequest(...args),
}));

const mockVerifyHorizenTransparencyActivation = vi.fn();
vi.mock('@/services/horizen/authorizationClient', () => ({
  verifyHorizenTransparencyActivation: (...args: any[]) => mockVerifyHorizenTransparencyActivation(...args),
  // The route imports this to widen the reread to locally-refused rows
  // (Al's change 3, 2026-08-06). Mirrors the real export's value — a mock that
  // omitted it would make `allowStates` silently undefined and stop this
  // suite from exercising the widening at all.
  RECONCILABLE_STATES: ['SUBMITTED', 'REFUSED', 'QUARANTINED', 'EXPIRED'],
}));

/**
 * A confirmation discovered by the refresh has to enrich the Agent Card too
 * (Al's change 3, item 4) — mocked so this suite can assert the call without
 * reaching Supabase.
 */
const mockEnrichAgentCard = vi.fn();
vi.mock('@/services/horizen/agentCardEnrichment', () => ({
  enrichAgentCardAfterHorizenAuthorization: (...args: any[]) => mockEnrichAgentCard(...args),
}));

const mockGetAgentAddresses = vi.fn();
vi.mock('@/services/identity/agentKeyService', () => ({
  AgentKeyService: class {
    getAgentAddresses(...args: any[]) {
      return mockGetAgentAddresses(...args);
    }
  },
}));

import { GET } from '@/app/api/journey/moneypenny-horizen/verify/status/route';

const AGENT = { slug: 'nakamoto', displayName: 'Aigent Nakamoto', runtimeAgentId: 'aigent-nakamoto', aigentQubeId: 'aigentqube-nakamoto', agentCardPath: '/x', fioHandle: 'nakamoto@aigent' };
const BINDING = { network: 'base-sepolia', token_id: '8798', registry_alias: null };

function makeRequest(agentSlug?: string): NextRequest {
  const url = new URL(`http://localhost/api/journey/moneypenny-horizen/verify/status${agentSlug ? `?agentSlug=${agentSlug}` : ''}`);
  return { nextUrl: url } as unknown as NextRequest;
}

beforeEach(() => {
  mockGetActivePersona.mockReset();
  mockGetActivePersona.mockResolvedValue({ personaId: 'persona-1' });
  mockGetSupabaseServer.mockReset();
  mockGetSupabaseServer.mockReturnValue({ fake: 'admin' });
  mockResolveRegistrableAgent.mockReset();
  mockResolveRegistrableAgent.mockReturnValue(AGENT);
  mockResolveHorizenRegistrationBinding.mockReset();
  mockResolveHorizenRegistrationBinding.mockResolvedValue({ binding: BINDING });
  mockGetPartnerAuthorizationRequest.mockReset();
  mockVerifyHorizenTransparencyActivation.mockReset();
  mockGetAgentAddresses.mockReset();
  mockGetAgentAddresses.mockResolvedValue({ evmAddress: '0xabc' });
  mockEnrichAgentCard.mockReset();
  mockEnrichAgentCard.mockResolvedValue({ ok: true, receiptRefs: ['receipt-enrich-1'] });
});

describe('GET verify/status', () => {
  it('reports not-started when Register has not completed (no tokenId)', async () => {
    mockResolveHorizenRegistrationBinding.mockResolvedValue({ binding: null });
    const res = await GET(makeRequest('nakamoto'));
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.state).toBe('not-started');
  });

  it('reports not-started when no authorization row exists yet', async () => {
    mockGetPartnerAuthorizationRequest.mockResolvedValue(null);
    const res = await GET(makeRequest('nakamoto'));
    const body = await res.json();
    expect(body.state).toBe('not-started');
    expect(mockVerifyHorizenTransparencyActivation).not.toHaveBeenCalled();
  });

  it.each(['PREPARED', 'AWAITING_SIGNATURE', 'SIGNED'])('reports pending — never denied — for a %s row (the ceremony started but never reached Horizen)', async (state) => {
    mockGetPartnerAuthorizationRequest.mockResolvedValue({ state, refusalCode: null, refusalDetail: null, receiptRef: null });
    const res = await GET(makeRequest('nakamoto'));
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.state).toBe('pending');
    expect(mockVerifyHorizenTransparencyActivation).not.toHaveBeenCalled();
  });

  it('reports complete for a CONFIRMED row without re-contacting Horizen', async () => {
    mockGetPartnerAuthorizationRequest.mockResolvedValue({ state: 'CONFIRMED', receiptRef: 'receipt-1' });
    const res = await GET(makeRequest('nakamoto'));
    const body = await res.json();
    expect(body.state).toBe('complete');
    expect(body.receiptRef).toBe('receipt-1');
    expect(mockVerifyHorizenTransparencyActivation).not.toHaveBeenCalled();
  });

  it('reports expired — distinct from a partner denial — for an EXPIRED row, after re-checking the partner', async () => {
    mockGetPartnerAuthorizationRequest.mockResolvedValue({ state: 'EXPIRED' });
    mockVerifyHorizenTransparencyActivation.mockResolvedValue({ ok: false, refusalCode: 'PARTNER_STATE_UNRESOLVED', detail: 'not enabled' });
    const res = await GET(makeRequest('nakamoto'));
    const body = await res.json();
    // PARTNER_STATE_UNRESOLVED reads as pending, never a denial (see its own
    // doc comment) — an EXPIRED row whose partner state is simply unknown must
    // not be reported as though Horizen had refused it.
    expect(body.state).toBe('pending');
  });

  it('an EXPIRED row whose partner reread is inconclusive-but-terminal still reports expired, not denied', async () => {
    mockGetPartnerAuthorizationRequest.mockResolvedValue({ state: 'EXPIRED' });
    mockVerifyHorizenTransparencyActivation.mockResolvedValue({ ok: false, refusalCode: 'HORIZEN_REREAD_NOT_CONFIRMED', detail: 'no' });
    const res = await GET(makeRequest('nakamoto'));
    const body = await res.json();
    expect(body.state).toBe('expired');
  });

  /*
   * A LOCALLY-REFUSED ROW IS NOW RECONCILED AGAINST THE PARTNER (Al's change
   * 3, 2026-08-06: "The button must not merely reload the current local
   * authorization row… Do not silently do nothing.").
   *
   * This is the defect the operator hit: a local decision refused a submission
   * Horizen may have accepted, and "Refresh partner status" then only re-read
   * that local refusal back — so the button appeared to do nothing and the
   * stale verdict was unfalsifiable from the UI.
   */
  it.each(['REFUSED', 'QUARANTINED'])('reconciles a %s row against Horizen and reports denied only when the partner still does not confirm', async (state) => {
    mockGetPartnerAuthorizationRequest.mockResolvedValue({ state, refusalCode: 'HORIZEN_SUBMISSION_REJECTED', refusalDetail: 'invalid signature' });
    mockVerifyHorizenTransparencyActivation.mockResolvedValue({ ok: false, refusalCode: 'HORIZEN_REREAD_NOT_CONFIRMED', detail: 'still not enabled' });
    const res = await GET(makeRequest('nakamoto'));
    const body = await res.json();
    expect(mockVerifyHorizenTransparencyActivation).toHaveBeenCalledTimes(1);
    expect(body.state).toBe('denied');
    // The ORIGINAL refusal is reported, not overwritten by the reread's wording.
    expect(body.refusalCode).toBe('HORIZEN_SUBMISSION_REJECTED');
    expect(body.refusalDetail).toBe('invalid signature');
    expect(body.note).toContain('Re-checked against Horizen');
  });

  it.each(['REFUSED', 'QUARANTINED'])('a %s row that the partner reports as ENABLED is reconciled to complete — partner state overrides a local refusal', async (state) => {
    mockGetPartnerAuthorizationRequest.mockResolvedValue({ state, refusalCode: 'HORIZEN_SUBMISSION_REJECTED', refusalDetail: 'no submission ref', receiptRef: 'receipt-9' });
    mockVerifyHorizenTransparencyActivation.mockResolvedValue({ ok: true, value: { confirmed: true } });
    const res = await GET(makeRequest('nakamoto'));
    const body = await res.json();
    expect(body.state).toBe('complete');
    expect(body.reconciledFrom).toBe(state);
    // And the Agent Card is enriched, or the Verify surface would stay grey
    // while the authorization is confirmed.
    expect(mockEnrichAgentCard).toHaveBeenCalledTimes(1);
    expect(body.receiptRefs).toEqual(['receipt-enrich-1']);
  });

  it('the reread is widened to reconcilable states — never left as SUBMITTED-only, or a refused row could never be reconciled', async () => {
    mockGetPartnerAuthorizationRequest.mockResolvedValue({ state: 'REFUSED', refusalCode: 'X', refusalDetail: 'y' });
    mockVerifyHorizenTransparencyActivation.mockResolvedValue({ ok: false, refusalCode: 'HORIZEN_REREAD_NOT_CONFIRMED', detail: 'no' });
    await GET(makeRequest('nakamoto'));
    const args = mockVerifyHorizenTransparencyActivation.mock.calls[0][1];
    expect(args.allowStates).toContain('REFUSED');
    expect(args.allowStates).toContain('SUBMITTED');
  });

  describe('SUBMITTED — re-attempts ONLY the authoritative reread', () => {
    it('reports complete when the bounded reread confirms', async () => {
      mockGetPartnerAuthorizationRequest.mockResolvedValue({ state: 'SUBMITTED' });
      mockVerifyHorizenTransparencyActivation.mockResolvedValue({ ok: true, value: { confirmed: true } });
      const res = await GET(makeRequest('nakamoto'));
      const body = await res.json();
      expect(body.state).toBe('complete');
      expect(mockVerifyHorizenTransparencyActivation).toHaveBeenCalledTimes(1);
    });

    it('reports denied when the reread comes back with a real refusal (not a timeout)', async () => {
      mockGetPartnerAuthorizationRequest.mockResolvedValue({ state: 'SUBMITTED' });
      mockVerifyHorizenTransparencyActivation.mockResolvedValue({ ok: false, refusalCode: 'REGISTRY_OWNER_MISMATCH', detail: 'wrong owner' });
      const res = await GET(makeRequest('nakamoto'));
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.state).toBe('denied');
      expect(body.refusalCode).toBe('REGISTRY_OWNER_MISMATCH');
    });

    /*
     * PARTNER_STATE_UNRESOLVED IS NOT A DENIAL (Al's brief, 2026-08-06). A
     * reread that has not converged must keep the surface polling, never tell
     * the operator the authorization was refused and never ask them to
     * re-authorize — the same principle already applied to transport timeouts.
     */
    it('reports pending — NEVER denied — when the reread has not converged (PARTNER_STATE_UNRESOLVED)', async () => {
      mockGetPartnerAuthorizationRequest.mockResolvedValue({ state: 'SUBMITTED' });
      mockVerifyHorizenTransparencyActivation.mockResolvedValue({
        ok: false,
        refusalCode: 'PARTNER_STATE_UNRESOLVED',
        detail: 'the submission response itself reported success, so this is very likely convergence lag',
      });
      const res = await GET(makeRequest('nakamoto'));
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.state).toBe('pending');
      expect(body.note).toContain('convergence lag');
      expect(JSON.stringify(body)).not.toMatch(/re-?authoriz/i);
    });

    it('enriches the Agent Card when the reread confirms — a confirmation found by refresh must not leave Verify grey', async () => {
      mockGetPartnerAuthorizationRequest.mockResolvedValue({ state: 'SUBMITTED', receiptRef: 'receipt-3' });
      mockVerifyHorizenTransparencyActivation.mockResolvedValue({ ok: true, value: { confirmed: true } });
      const res = await GET(makeRequest('nakamoto'));
      const body = await res.json();
      expect(body.state).toBe('complete');
      expect(mockEnrichAgentCard).toHaveBeenCalledTimes(1);
      expect(mockEnrichAgentCard.mock.calls[0][0]).toMatchObject({
        aigentQubeId: AGENT.aigentQubeId,
        runtimeAgentId: AGENT.runtimeAgentId,
        tokenId: BINDING.token_id,
        network: BINDING.network,
      });
    });

    it('still reports complete when enrichment fails — the authorization is confirmed regardless of a projection step', async () => {
      mockGetPartnerAuthorizationRequest.mockResolvedValue({ state: 'SUBMITTED' });
      mockVerifyHorizenTransparencyActivation.mockResolvedValue({ ok: true, value: { confirmed: true } });
      mockEnrichAgentCard.mockResolvedValue({ ok: false, refusalCode: 'NO_MATCHING_BINDING', detail: 'no binding' });
      const res = await GET(makeRequest('nakamoto'));
      const body = await res.json();
      expect(body.state).toBe('complete');
      expect(body.enrichmentRefusalCode).toBe('NO_MATCHING_BINDING');
    });

    it('reports pending — NEVER denied — when the reread itself times out', async () => {
      mockGetPartnerAuthorizationRequest.mockResolvedValue({ state: 'SUBMITTED' });
      // Never resolves — the route's own 25s deadline must win the race.
      // Fake timers so this test does not actually wait 25 real seconds.
      vi.useFakeTimers();
      mockVerifyHorizenTransparencyActivation.mockImplementation(() => new Promise(() => {}));
      try {
        const pending = GET(makeRequest('nakamoto'));
        await vi.advanceTimersByTimeAsync(26_000);
        const res = await pending;
        const body = await res.json();
        expect(res.status).toBe(504);
        expect(body.ok).toBe(false);
        expect(body.state).toBe('pending');
        expect(body.error).toContain('did not answer');
        expect(body.error).not.toMatch(/denied|failed|please.*authorize/i);
      } finally {
        vi.useRealTimers();
      }
    });

    it('reports pending when the controller wallet cannot be re-resolved — the submitted authorization is unaffected', async () => {
      mockGetPartnerAuthorizationRequest.mockResolvedValue({ state: 'SUBMITTED' });
      mockGetAgentAddresses.mockResolvedValue(null);
      const res = await GET(makeRequest('nakamoto'));
      const body = await res.json();
      expect(body.state).toBe('pending');
      expect(mockVerifyHorizenTransparencyActivation).not.toHaveBeenCalled();
    });
  });

  it('answers with a named JSON refusal, never an empty body, when something throws unexpectedly', async () => {
    mockResolveRegistrableAgent.mockImplementation(() => {
      throw new Error('boom');
    });
    const res = await GET(makeRequest('nakamoto'));
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.ok).toBe(false);
    expect(body.refusalCode).toBe('UNHANDLED_ROUTE_ERROR');
  });
});
