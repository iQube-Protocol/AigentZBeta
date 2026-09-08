/**
 * GET /api/ops/journey/standing-didqube-reconciliation (DiDQube Phase 4 item 5,
 * 2026-09-07). Route-level: proves the dual-auth gate (mirroring
 * reconcile-provider-standing-attribution's own shape) and that the route is
 * a thin, read-only pass-through to reconcileStandingDiDQubeResolution — the
 * reconciliation logic itself is covered separately in
 * tests/standing-didqube-reconciliation.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

process.env.CRON_TRIGGER_TOKEN = 'test-cron-token';

const mockReconcile = vi.fn();
vi.mock('@/services/standing/didQubeReconciliation', () => ({
  reconcileStandingDiDQubeResolution: (...args: unknown[]) => mockReconcile(...args),
}));

const mockGetActivePersona = vi.fn();
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (req: unknown) => mockGetActivePersona(req),
}));

vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => ({}),
}));

import { GET } from '@/app/api/ops/journey/standing-didqube-reconciliation/route';

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request('https://dev-beta.aigentz.me/api/ops/journey/standing-didqube-reconciliation', { headers });
}

beforeEach(() => {
  mockReconcile.mockReset();
  mockGetActivePersona.mockReset();
  mockReconcile.mockResolvedValue({ totalCanonicalStandingPersonas: 5, resolvedCount: 5, discrepancyCount: 0, rows: [] });
});

describe('GET /api/ops/journey/standing-didqube-reconciliation', () => {
  it('refuses 403 with neither a cron token nor an authenticated admin persona', async () => {
    mockGetActivePersona.mockResolvedValue(null);
    const res = await GET(makeRequest() as never);
    expect(res.status).toBe(403);
    expect(mockReconcile).not.toHaveBeenCalled();
  });

  it('the headless x-cron-token path runs the report without needing a persona', async () => {
    const res = await GET(makeRequest({ 'x-cron-token': 'test-cron-token' }) as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.report.discrepancyCount).toBe(0);
    expect(mockReconcile).toHaveBeenCalledTimes(1);
  });

  it('an authenticated admin persona session runs the report', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'persona-admin', cartridgeFlags: { isAdmin: true } });
    const res = await GET(makeRequest() as never);
    expect(res.status).toBe(200);
    expect(mockReconcile).toHaveBeenCalledTimes(1);
  });

  it('surfaces discrepancies honestly rather than hiding them in a 200', async () => {
    mockReconcile.mockResolvedValue({
      totalCanonicalStandingPersonas: 5,
      resolvedCount: 4,
      discrepancyCount: 1,
      rows: [{ personaId: 'p-1', displayName: 'X', rootDid: 'did:x', resolved: false, didqubeId: null, discrepancyReason: 'didqube_unresolved', detail: 'no binding' }],
    });
    const res = await GET(makeRequest({ 'x-cron-token': 'test-cron-token' }) as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.report.discrepancyCount).toBe(1);
    expect(json.report.rows[0].discrepancyReason).toBe('didqube_unresolved');
  });
});
