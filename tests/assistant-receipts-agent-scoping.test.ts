/**
 * GET /api/assistant/receipts — agentsInvoked scoping (operator directive,
 * 2026-08-08).
 *
 * ── THE DEFECT THIS CLOSES ─────────────────────────────────────────────────
 *
 * This route filtered only by `actionType` and the ACTING persona (the
 * operator), never by the receipt's SUBJECT agent. StageReceiptsDrawer
 * (the Guided Journey Runtime's Evidence Receipts panel) called this route
 * with no agent scoping at all, so an operator who had acted on multiple
 * agents (e.g. registering both Aigent Nakamoto and Aigent MoneyPenny) saw
 * EVERY agent's receipts of a given type while viewing ANY agent's stage —
 * observed live: MoneyPenny's `pending_registration` Register stage
 * displaying Aigent Nakamoto's `HORIZEN_AGENT_REGISTERED` receipt.
 *
 * Every real dependency mocked; exercises the handler directly, mirroring
 * tests/aigentme-disposition-agent-scoping.test.ts's own pattern.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const mockGetActivePersona = vi.fn();
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (req: unknown) => mockGetActivePersona(req),
}));

const mockListActivityReceiptsForPersona = vi.fn();
vi.mock('@/services/receipts/activityReceiptService', () => ({
  listActivityReceiptsForPersona: (...args: any[]) => mockListActivityReceiptsForPersona(...args),
}));

import { GET } from '@/app/api/assistant/receipts/route';

function makeRequest(query: Record<string, string> = {}): NextRequest {
  const searchParams = new URLSearchParams(query);
  return { nextUrl: { searchParams } } as unknown as NextRequest;
}

beforeEach(() => {
  mockGetActivePersona.mockReset();
  mockGetActivePersona.mockResolvedValue({ personaId: 'persona-arkagent' });
  mockListActivityReceiptsForPersona.mockReset();
  mockListActivityReceiptsForPersona.mockResolvedValue([]);
});

describe('GET /api/assistant/receipts — agentsInvoked scoping', () => {
  it('threads a single agentsInvoked value through to listActivityReceiptsForPersona', async () => {
    await GET(makeRequest({ actionType: 'horizen_agent_registered', agentsInvoked: 'aigent-moneypenny' }));

    expect(mockListActivityReceiptsForPersona).toHaveBeenCalledWith(
      'persona-arkagent',
      expect.objectContaining({ agentsInvoked: ['aigent-moneypenny'] }),
    );
  });

  it('threads multiple comma-separated agentsInvoked values, trimmed', async () => {
    await GET(makeRequest({ actionType: 'horizen_agent_registered', agentsInvoked: 'aigent-moneypenny, aigent-nakamoto' }));

    expect(mockListActivityReceiptsForPersona).toHaveBeenCalledWith(
      'persona-arkagent',
      expect.objectContaining({ agentsInvoked: ['aigent-moneypenny', 'aigent-nakamoto'] }),
    );
  });

  it('omits agentsInvoked entirely when the query param is absent — unfiltered behavior is unchanged for existing callers', async () => {
    await GET(makeRequest({ actionType: 'horizen_agent_registered' }));

    const call = mockListActivityReceiptsForPersona.mock.calls[0];
    expect(call[1]).not.toHaveProperty('agentsInvoked');
  });

  it('an empty agentsInvoked query param omits the filter rather than passing an empty array', async () => {
    await GET(makeRequest({ actionType: 'horizen_agent_registered', agentsInvoked: '' }));

    const call = mockListActivityReceiptsForPersona.mock.calls[0];
    expect(call[1]).not.toHaveProperty('agentsInvoked');
  });
});

describe('GET /api/assistant/receipts — cross-agent isolation regression (operator directive, 2026-08-08)', () => {
  it('two agents with the same action type: a query scoped to one never returns receipts naming only the other', async () => {
    // The fake store honors the SAME .contains() semantics
    // listActivityReceiptsForPersona uses — an overlap match against
    // agents_invoked — so this proves the route-level contract, not just
    // that the mock was called with the right shape.
    const allReceipts = [
      { id: 'receipt-nakamoto', actionType: 'horizen_agent_registered', agentsInvoked: ['aigent-nakamoto'] },
      { id: 'receipt-moneypenny', actionType: 'horizen_agent_registered', agentsInvoked: ['aigent-moneypenny'] },
    ];
    mockListActivityReceiptsForPersona.mockImplementation(async (_personaId: string, options: any) => {
      let rows = allReceipts;
      if (options?.actionTypes?.length) rows = rows.filter((r) => options.actionTypes.includes(r.actionType));
      if (options?.agentsInvoked?.length) {
        rows = rows.filter((r) => r.agentsInvoked.some((a) => options.agentsInvoked.includes(a)));
      }
      return rows;
    });

    const moneypennyRes = await GET(
      makeRequest({ actionType: 'horizen_agent_registered', agentsInvoked: 'aigent-moneypenny' }),
    );
    const moneypennyJson = await moneypennyRes.json();
    expect(moneypennyJson.receipts.map((r: any) => r.id)).toEqual(['receipt-moneypenny']);
    expect(moneypennyJson.receipts.map((r: any) => r.id)).not.toContain('receipt-nakamoto');

    const nakamotoRes = await GET(
      makeRequest({ actionType: 'horizen_agent_registered', agentsInvoked: 'aigent-nakamoto' }),
    );
    const nakamotoJson = await nakamotoRes.json();
    expect(nakamotoJson.receipts.map((r: any) => r.id)).toEqual(['receipt-nakamoto']);
    expect(nakamotoJson.receipts.map((r: any) => r.id)).not.toContain('receipt-moneypenny');
  });
});
