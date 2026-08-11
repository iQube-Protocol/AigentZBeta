/**
 * GET/POST /api/journey/constitutional-internet-bridge/act/disposition
 *
 * Mirrors tests/aigentme-disposition-agent-scoping.test.ts's structure and
 * mocking pattern. Verifies:
 *   - both required fields (role, actionMode) are validated — no default,
 *     no partial write;
 *   - receipts are written with agentsInvoked=['aigent-z'], never
 *     'aigent-moneypenny'/'aigent-nakamoto' — so a CI Bridge disposition can
 *     never be read back by the Horizen route, or vice versa;
 *   - the actionInput carries the CI-specific context tag.
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

import { GET, POST } from '@/app/api/journey/constitutional-internet-bridge/act/disposition/route';

function makeGetRequest(): NextRequest {
  return { nextUrl: { searchParams: new URLSearchParams() } } as unknown as NextRequest;
}

function makePostRequest(body: Record<string, unknown>): NextRequest {
  return {
    nextUrl: { searchParams: new URLSearchParams() },
    json: async () => body,
  } as unknown as NextRequest;
}

beforeEach(() => {
  mockGetActivePersona.mockReset();
  mockGetActivePersona.mockResolvedValue({ personaId: 'persona-visitor' });
  mockCreateActivityReceipt.mockClear();
  mockListActivityReceiptsForPersona.mockReset();
  mockListActivityReceiptsForPersona.mockResolvedValue([]);
});

describe('POST ci-bridge/act/disposition — required choices, agent scoping', () => {
  it('rejects a missing role', async () => {
    const res = await POST(makePostRequest({ actionMode: 'advise' }));
    expect(res.status).toBe(400);
    expect(mockCreateActivityReceipt).not.toHaveBeenCalled();
  });

  it('rejects a missing actionMode', async () => {
    const res = await POST(makePostRequest({ role: 'guide' }));
    expect(res.status).toBe(400);
    expect(mockCreateActivityReceipt).not.toHaveBeenCalled();
  });

  it('both choices present: writes two receipts scoped to aigent-z, never a Horizen agent', async () => {
    const res = await POST(makePostRequest({ role: 'guide', actionMode: 'ask-before-acting' }));
    expect(res.status).toBe(200);

    const calls = mockCreateActivityReceipt.mock.calls.map((c) => c[0]);
    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect(call.agentsInvoked).toEqual(['aigent-z']);
      expect(call.agentsInvoked).not.toContain('aigent-moneypenny');
      expect(call.agentsInvoked).not.toContain('aigent-nakamoto');
    }

    const disposition = calls.find((c) => c.actionType === 'experienceqube_focus_disposition_recorded');
    expect(disposition.actionInput).toEqual({
      role: 'guide',
      actionMode: 'ask-before-acting',
      context: 'constitutional-internet-bridge-act',
    });
  });

  it('unauthenticated caller gets 401, no write attempted', async () => {
    mockGetActivePersona.mockResolvedValue(null);
    const res = await POST(makePostRequest({ role: 'guide', actionMode: 'advise' }));
    expect(res.status).toBe(401);
    expect(mockCreateActivityReceipt).not.toHaveBeenCalled();
  });
});

describe('GET ci-bridge/act/disposition — reads scoped to aigent-z and this context only', () => {
  it('only reports a disposition whose actionInput.context matches this journey', async () => {
    mockListActivityReceiptsForPersona.mockResolvedValue([
      {
        actionType: 'experienceqube_focus_disposition_recorded',
        actionInput: { disposition: 'central', domainFocus: 'financial-services' }, // a Horizen-shaped receipt, no context tag
      },
    ]);
    const res = await GET(makeGetRequest());
    const json = await res.json();
    expect(json.role).toBeNull();
    expect(json.actionMode).toBeNull();
  });

  it('reports role/actionMode when the context tag matches', async () => {
    mockListActivityReceiptsForPersona.mockResolvedValue([
      {
        actionType: 'experienceqube_focus_disposition_recorded',
        actionInput: { role: 'researcher', actionMode: 'prepare', context: 'constitutional-internet-bridge-act' },
      },
    ]);
    const res = await GET(makeGetRequest());
    const json = await res.json();
    expect(json.role).toBe('researcher');
    expect(json.actionMode).toBe('prepare');
  });
});
