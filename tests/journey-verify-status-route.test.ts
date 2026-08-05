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

  it('reports expired — distinct from a partner denial — for an EXPIRED row', async () => {
    mockGetPartnerAuthorizationRequest.mockResolvedValue({ state: 'EXPIRED' });
    const res = await GET(makeRequest('nakamoto'));
    const body = await res.json();
    expect(body.state).toBe('expired');
  });

  it.each(['REFUSED', 'QUARANTINED'])('reports denied for a %s row, carrying the refusal code and detail', async (state) => {
    mockGetPartnerAuthorizationRequest.mockResolvedValue({ state, refusalCode: 'HORIZEN_REREAD_NOT_CONFIRMED', refusalDetail: 'not confirmed' });
    const res = await GET(makeRequest('nakamoto'));
    const body = await res.json();
    expect(body.state).toBe('denied');
    expect(body.refusalCode).toBe('HORIZEN_REREAD_NOT_CONFIRMED');
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
      mockVerifyHorizenTransparencyActivation.mockResolvedValue({ ok: false, refusalCode: 'HORIZEN_REREAD_NOT_CONFIRMED', detail: 'not confirmed yet' });
      const res = await GET(makeRequest('nakamoto'));
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.state).toBe('denied');
      expect(body.refusalCode).toBe('HORIZEN_REREAD_NOT_CONFIRMED');
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
