/**
 * GET/POST /api/journey/constitutional-internet-bridge/act/connect-agent
 *
 * Verifies: unauthenticated callers are refused; a POST records exactly one
 * campaign_events-shaped write via recordCampaignEvent (never a fabricated
 * delegation/authority claim); a GET reflects a prior connection back.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const mockGetActivePersona = vi.fn();
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (req: unknown) => mockGetActivePersona(req),
}));

const mockRecordCampaignEvent = vi.fn(async () => ({ eventId: 'evt-1', stateView: null }));
vi.mock('@/services/campaign/campaignService', () => ({
  recordCampaignEvent: (...args: any[]) => mockRecordCampaignEvent(...args),
}));

let mockConnectRows: Array<{ id: string; metadata: Record<string, unknown> | null }> = [];
vi.mock('@/app/api/community-content/_lib/personaContext', () => ({
  getCommunityContentSupabase: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              limit: async () => ({ data: mockConnectRows }),
            }),
          }),
        }),
      }),
    }),
  }),
}));

import { GET, POST } from '@/app/api/journey/constitutional-internet-bridge/act/connect-agent/route';

function makeRequest(body?: Record<string, unknown>): NextRequest {
  return {
    nextUrl: { searchParams: new URLSearchParams() },
    json: async () => body ?? {},
  } as unknown as NextRequest;
}

beforeEach(() => {
  mockGetActivePersona.mockReset();
  mockGetActivePersona.mockResolvedValue({ personaId: 'persona-visitor' });
  mockRecordCampaignEvent.mockClear();
  mockConnectRows = [];
});

describe('POST connect-agent', () => {
  it('unauthenticated caller is refused, no event recorded', async () => {
    mockGetActivePersona.mockResolvedValue(null);
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
    expect(mockRecordCampaignEvent).not.toHaveBeenCalled();
  });

  it('records a self-report campaign event, never claiming delegation/authority', async () => {
    const res = await POST(makeRequest({ agent: 'claude' }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.agentRelationshipStarted).toBe(true);
    // What the response does NOT claim is as load-bearing as what it does:
    expect(json).not.toHaveProperty('delegated');
    expect(json).not.toHaveProperty('mandate');
    expect(json).not.toHaveProperty('standing');

    expect(mockRecordCampaignEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        campaignId: 'constitutional-internet-bridge',
        eventType: 'external_agent_connected',
        personaId: 'persona-visitor',
        metadata: { agent: 'claude' },
      }),
    );
  });

  it('defaults metadata.agent to claude when the body omits it', async () => {
    await POST(makeRequest());
    expect(mockRecordCampaignEvent).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { agent: 'claude' } }),
    );
  });
});

describe('GET connect-agent', () => {
  it('reports not connected when no prior event exists', async () => {
    const res = await GET(makeRequest());
    const json = await res.json();
    expect(json.connected).toBe(false);
  });

  it('reports connected when a prior event exists', async () => {
    mockConnectRows = [{ id: 'evt-1', metadata: { agent: 'claude' } }];
    const res = await GET(makeRequest());
    const json = await res.json();
    expect(json.connected).toBe(true);
    expect(json.agent).toBe('claude');
  });
});
