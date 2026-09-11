/**
 * POST /api/marketa/activation/candidates/[id]/admission-package —
 * generates and delivers the Constitutional Admission Package. Pins: reuses
 * the existing 'partner-operator' venture-lab role (never invents a new
 * one), the invitation code is returned once, and a failed invitation never
 * blocks the package itself from being returned (package generation and
 * delivery are separate concerns).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const mockGetActivePersona = vi.fn();
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (req: unknown) => mockGetActivePersona(req),
}));

const mockCreateAccessInvitation = vi.fn();
vi.mock('@/services/passport/participationAccess', () => ({
  createAccessInvitation: (...args: any[]) => mockCreateAccessInvitation(...args),
}));

function fakeSupabase(candidateRow: Record<string, unknown> | null) {
  return {
    schema: () => ({
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            single: async () => (candidateRow ? { data: candidateRow, error: null } : { data: null, error: { message: 'not found' } }),
          }),
        }),
        insert: () => Promise.resolve({ data: null, error: null }),
      }),
    }),
  };
}

const mockGetSupabaseServer = vi.fn();
vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => mockGetSupabaseServer(),
}));

import { POST } from '@/app/api/marketa/activation/candidates/[id]/admission-package/route';

function makeRequest(body: unknown): NextRequest {
  return {
    json: async () => body,
    nextUrl: new URL('http://localhost/api/marketa/activation/candidates/cand-1/admission-package'),
  } as unknown as NextRequest;
}

const params = Promise.resolve({ id: 'cand-1' });
const CANDIDATE_ROW = {
  id: 'cand-1',
  name: 'Aigent Nakamoto',
  capabilities: ['bitcoin'],
  registry_provider: 'horizen',
  registry_network: 'base-sepolia',
  on_chain_agent_id: '8798',
};

beforeEach(() => {
  mockGetActivePersona.mockReset();
  mockGetActivePersona.mockResolvedValue({ personaId: 'persona-steward' });
  mockCreateAccessInvitation.mockReset();
  mockGetSupabaseServer.mockReset();
  mockGetSupabaseServer.mockReturnValue(fakeSupabase(CANDIDATE_ROW));
});

describe('POST admission-package', () => {
  it('refuses when the candidate is not found', async () => {
    mockGetSupabaseServer.mockReturnValue(fakeSupabase(null));
    const res = await POST(makeRequest({}), { params });
    expect(res.status).toBe(404);
  });

  it('generates the package and delivers it via the existing partner-operator venture-lab role', async () => {
    mockCreateAccessInvitation.mockResolvedValue({ ok: true, rawCode: 'pinv-abc123', invitation: { id: 'inv-1' } });
    const res = await POST(makeRequest({ campaignId: 'pilot-01' }), { params });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(mockCreateAccessInvitation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ domain: 'venture-lab', role: 'partner-operator', campaignId: 'pilot-01' }),
    );
    expect(body.invitationCode).toBe('pinv-abc123');
    expect(body.package.operatorFacing.journeyLink).toContain('agentId=8798');
  });

  it('still returns the package when the invitation fails to create — generation and delivery are separate', async () => {
    mockCreateAccessInvitation.mockResolvedValue({ ok: false, error: 'role not defined' });
    const res = await POST(makeRequest({}), { params });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.invitationCode).toBeNull();
    expect(body.invitationError).toBe('role not defined');
    expect(body.package).toBeTruthy();
  });

  it('states plainly that package delivery creates no authority', async () => {
    mockCreateAccessInvitation.mockResolvedValue({ ok: true, rawCode: 'pinv-x', invitation: { id: 'inv-1' } });
    const res = await POST(makeRequest({}), { params });
    const body = await res.json();
    expect(body.note).toContain('creates no authority');
  });
});
