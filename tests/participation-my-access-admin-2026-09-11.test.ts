/**
 * GET /api/participation/my-access — isAdmin field (2026-09-11).
 *
 * Root-cause regression for the Progressive Surface pass: platform admin
 * authority is a `cartridgeFlags.isAdmin` flag, never an `access_grants` row.
 * Every consumer that inferred "onboarded"/"has access" purely from `grants`
 * (IRLWelcomeTab, AccessionProgressBar) silently read an admin as
 * not-yet-onboarded. This route must surface `isAdmin`, server-resolved from
 * the authenticated session only, so those consumers can treat admin
 * authority explicitly rather than each guessing at it independently.
 */
import { describe, it, expect, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const mockGetActivePersona = vi.fn();
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (req: unknown) => mockGetActivePersona(req),
}));

vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => ({}),
}));

vi.mock('@/services/passport/participationSelfView', () => ({
  resolveParticipationSelfView: async () => ({
    grants: [],
    passportIssued: false,
    delegationActive: false,
  }),
}));

import { GET } from '@/app/api/participation/my-access/route';

function makeRequest(): NextRequest {
  return { nextUrl: new URL('https://x.test/api/participation/my-access'), headers: new Headers() } as unknown as NextRequest;
}

describe('GET /api/participation/my-access — isAdmin', () => {
  it('reports isAdmin: true for a platform admin with NO access_grants row at all', async () => {
    mockGetActivePersona.mockResolvedValue({
      personaId: 'admin-1',
      authProfileId: 'auth-1',
      cartridgeFlags: { isAdmin: true },
    });
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.isAdmin).toBe(true);
    // The admin genuinely has zero grants — isAdmin must be reported
    // alongside that honest fact, never used to fabricate a grant.
    expect(body.grants).toEqual([]);
  });

  it('reports isAdmin: false for a non-admin persona', async () => {
    mockGetActivePersona.mockResolvedValue({
      personaId: 'p1',
      authProfileId: 'auth-2',
      cartridgeFlags: { isAdmin: false },
    });
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.isAdmin).toBe(false);
  });

  it('reports isAdmin: false (never undefined) when cartridgeFlags is absent', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'p2', authProfileId: 'auth-3' });
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.isAdmin).toBe(false);
  });
});
