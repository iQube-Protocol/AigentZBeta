/**
 * GET/POST /api/journey/moneypenny-horizen/aigentme/disposition —
 * agent-selectable scoping (al, 2026-08-04).
 *
 * ── THE DEFECT THIS CLOSES ─────────────────────────────────────────────────
 *
 * This route hardcoded `agentsInvoked: ['aigent-moneypenny']` regardless of
 * which agent's journey was actually in progress. The aigentMe stage observer
 * (app/api/journey/moneypenny-horizen/state/route.ts) requires
 * `findAgentReceiptRefs(agent.runtimeAgentId, ...)` to find a matching
 * receipt — so a principal genuinely recording a disposition for a
 * DIFFERENT agent (e.g. Nakamoto) could never have it register as complete,
 * however honestly they answered. This is the ONE real write path for the
 * aigentMe recognition act; there is no other route that can produce a
 * genuine receipt for it.
 *
 * Every real dependency mocked; exercises the handler directly, never a
 * live network/DB call. Mirrors the pattern in
 * tests/claim-prove-control-route.test.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const mockGetActivePersona = vi.fn();
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (req: unknown) => mockGetActivePersona(req),
}));

const mockCreateActivityReceipt = vi.fn(async (input: any) => ({ id: `receipt-${input.actionType}`, ...input }));
const mockListActivityReceiptsForPersona = vi.fn();
vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: (...args: any[]) => mockCreateActivityReceipt(...args),
  listActivityReceiptsForPersona: (...args: any[]) => mockListActivityReceiptsForPersona(...args),
}));

import { GET, POST } from '@/app/api/journey/moneypenny-horizen/aigentme/disposition/route';

function makeGetRequest(query: Record<string, string> = {}): NextRequest {
  const searchParams = new URLSearchParams(query);
  return { nextUrl: { searchParams } } as unknown as NextRequest;
}

function makePostRequest(body: Record<string, unknown>): NextRequest {
  return {
    nextUrl: { searchParams: new URLSearchParams() },
    json: async () => body,
  } as unknown as NextRequest;
}

beforeEach(() => {
  mockGetActivePersona.mockReset();
  mockGetActivePersona.mockResolvedValue({ personaId: 'persona-arkagent' });
  mockCreateActivityReceipt.mockClear();
  mockListActivityReceiptsForPersona.mockReset();
  mockListActivityReceiptsForPersona.mockResolvedValue([]);
});

describe('POST aigentme/disposition — agentSlug scoping', () => {
  it('selected journey agent = nakamoto → both receipts carry aigent-nakamoto, never aigent-moneypenny', async () => {
    const res = await POST(makePostRequest({ disposition: 'secondary', agentSlug: 'nakamoto' }));
    expect(res.status).toBe(200);

    const calls = mockCreateActivityReceipt.mock.calls.map((c) => c[0]);
    expect(calls).toHaveLength(2); // aigentme_activated + experienceqube_focus_disposition_recorded

    for (const call of calls) {
      expect(call.agentsInvoked).toEqual(['aigent-nakamoto']);
      expect(call.agentsInvoked).not.toContain('aigent-moneypenny');
    }

    const activation = calls.find((c) => c.actionType === 'aigentme_activated');
    const disposition = calls.find((c) => c.actionType === 'experienceqube_focus_disposition_recorded');
    expect(activation).toBeTruthy();
    expect(disposition).toBeTruthy();
    expect(disposition.actionInput.disposition).toBe('secondary');
  });

  it('legacy caller with no agentSlug still defaults to aigent-moneypenny', async () => {
    const res = await POST(makePostRequest({ disposition: 'central' }));
    expect(res.status).toBe(200);

    const calls = mockCreateActivityReceipt.mock.calls.map((c) => c[0]);
    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect(call.agentsInvoked).toEqual(['aigent-moneypenny']);
    }
  });

  it('activation is idempotent PER AGENT — an existing moneypenny activation does not suppress a fresh nakamoto one', async () => {
    // Simulate: a prior aigentme_activated receipt exists, but only when the
    // query is scoped to aigent-moneypenny (i.e. this persona already
    // activated aigentMe once, for a different agent).
    mockListActivityReceiptsForPersona.mockImplementation(async (_personaId: string, opts: any) => {
      if (opts?.actionTypes?.includes('aigentme_activated') && opts?.agentsInvoked?.includes('aigent-nakamoto')) {
        return []; // nothing recorded yet for Nakamoto specifically
      }
      return [];
    });

    const res = await POST(makePostRequest({ disposition: 'central', agentSlug: 'nakamoto' }));
    expect(res.status).toBe(200);

    const activationCalls = mockCreateActivityReceipt.mock.calls
      .map((c) => c[0])
      .filter((c) => c.actionType === 'aigentme_activated');
    // A fresh activation receipt IS written for Nakamoto — not suppressed by
    // a different agent's prior activation.
    expect(activationCalls).toHaveLength(1);
    expect(activationCalls[0].agentsInvoked).toEqual(['aigent-nakamoto']);
  });
});

describe('GET aigentme/disposition — agentSlug scoping', () => {
  it('reads are filtered by the resolved agent, defaulting to moneypenny when agentSlug is absent', async () => {
    await GET(makeGetRequest());
    expect(mockListActivityReceiptsForPersona).toHaveBeenCalledWith(
      'persona-arkagent',
      expect.objectContaining({ agentsInvoked: ['aigent-moneypenny'] }),
    );

    mockListActivityReceiptsForPersona.mockClear();
    await GET(makeGetRequest({ agentSlug: 'nakamoto' }));
    expect(mockListActivityReceiptsForPersona).toHaveBeenCalledWith(
      'persona-arkagent',
      expect.objectContaining({ agentsInvoked: ['aigent-nakamoto'] }),
    );
  });
});
