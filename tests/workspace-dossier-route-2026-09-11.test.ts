/**
 * GET /api/participation/workspace-dossier — the ONE route behind both the
 * human dossier UI (ExperimentDossierPanel) and any machine/delegated-agent
 * JSON consumer (2026-09-11). Mirrors workspace-state/route.ts's own test
 * shape: `resolveExperimentDossier` is already unit-tested on its own
 * (tests/experiment-dossier-2026-09-11.test.ts), so this file verifies only
 * what the ROUTE is responsible for — auth gate, param validation, and
 * faithfully forwarding the resolver's ok/denied/not-found verdict without
 * reshaping the payload (the human/machine parity invariant: whatever this
 * route returns IS the object the React panel renders, field for field).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const mockGetActivePersona = vi.fn();
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (req: unknown) => mockGetActivePersona(req),
}));

vi.mock('@/app/api/agents/_lib/requestOrigin', () => ({
  resolveRequestOrigin: () => 'https://x.test',
}));

vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => ({}),
}));

const mockResolveExperimentDossier = vi.fn();
vi.mock('@/services/research/experimentDossier', () => ({
  resolveExperimentDossier: (...args: unknown[]) => mockResolveExperimentDossier(...args),
}));

import { GET } from '@/app/api/participation/workspace-dossier/route';

function makeRequest(url: string): NextRequest {
  const parsed = new URL(url);
  return { nextUrl: parsed, headers: new Headers() } as unknown as NextRequest;
}

beforeEach(() => {
  mockGetActivePersona.mockReset();
  mockResolveExperimentDossier.mockReset();
});

describe('GET /api/participation/workspace-dossier', () => {
  it('401s an anonymous caller before ever calling the resolver', async () => {
    mockGetActivePersona.mockResolvedValue(null);
    const res = await GET(makeRequest('https://x.test/api/participation/workspace-dossier?workspaceId=ws-1'));
    expect(res.status).toBe(401);
    expect(mockResolveExperimentDossier).not.toHaveBeenCalled();
  });

  it('400s a missing workspaceId', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'p-1', cartridgeFlags: {} });
    const res = await GET(makeRequest('https://x.test/api/participation/workspace-dossier'));
    expect(res.status).toBe(400);
    expect(mockResolveExperimentDossier).not.toHaveBeenCalled();
  });

  it('404s an unknown workspace', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'p-1', cartridgeFlags: {} });
    mockResolveExperimentDossier.mockResolvedValue({ ok: false, reason: 'not-found' });
    const res = await GET(makeRequest('https://x.test/api/participation/workspace-dossier?workspaceId=ws-1'));
    expect(res.status).toBe(404);
  });

  it('403s a wrong-scope caller — never leaks a dossier shape on denial', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'p-1', cartridgeFlags: {} });
    mockResolveExperimentDossier.mockResolvedValue({ ok: false, reason: 'denied' });
    const res = await GET(makeRequest('https://x.test/api/participation/workspace-dossier?workspaceId=ws-1'));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.dossier).toBeUndefined();
  });

  it('forwards isAdmin from cartridgeFlags and returns the resolver dossier VERBATIM (parity by construction)', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'p-1', cartridgeFlags: { isAdmin: true } });
    const dossier = { schemaVersion: 'research.dossier.v1', workspaceId: 'ws-1', experimentId: 'EXP-P1' };
    mockResolveExperimentDossier.mockResolvedValue({ ok: true, dossier });
    const res = await GET(makeRequest('https://x.test/api/participation/workspace-dossier?workspaceId=ws-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, dossier });
    expect(mockResolveExperimentDossier).toHaveBeenCalledWith(expect.anything(), { personaId: 'p-1', isAdmin: true }, 'ws-1', 'https://x.test');
  });
});
