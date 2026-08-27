/**
 * POST /api/research/crystal/[experimentId]/freeze — HTTP-level tests
 * (2026-08-05, EXP PP1 Track 2 operator ruling: "Freeze must never accept a
 * domain boundary as operator input"). Prior coverage of this route was
 * source-text-canary only (source-of-truth-parity.test.ts greps the file's
 * text) — these tests actually invoke the real POST handler.
 *
 * Pins: the ratified Domain Declaration is read server-side and never
 * accepted from the request; `domainBoundary`/`namespace`/`scope` in the
 * body are refused with 400; `boundaryAcknowledged: true` is required
 * before a freeze proceeds; a missing ratified declaration blocks freeze
 * before anything else is even checked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const mockGetActivePersona = vi.fn();
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (req: unknown) => mockGetActivePersona(req),
}));

const mockFreezeArtifact = vi.fn();
const mockGetArtifactById = vi.fn();
const mockUpsertArtifact = vi.fn();
// Defaults to vP1 — matching this suite's prior fixed-id behavior — so every
// existing test below (none of which cares about lineage) is unaffected.
// Tests that DO care about generation resolution override this per-case.
const mockCurrentCrystalArtifactId = vi.fn().mockResolvedValue('EXP-P1/crystal-vP1');
vi.mock('@/services/research/artifacts', () => ({
  freezeArtifact: (...args: any[]) => mockFreezeArtifact(...args),
  getArtifactById: (...args: any[]) => mockGetArtifactById(...args),
  upsertArtifact: (...args: any[]) => mockUpsertArtifact(...args),
  currentCrystalArtifactId: (...args: any[]) => mockCurrentCrystalArtifactId(...args),
}));

const mockRunCrystalStatisticsReport = vi.fn();
vi.mock('@/services/research/crystalStatistics', () => ({
  runCrystalStatisticsReport: (...args: any[]) => mockRunCrystalStatisticsReport(...args),
}));

// crystalDomainForExperiment is left REAL and unmocked — the point of these
// tests is that the route reads the real ratified declaration, never a
// stand-in. 'EXP-P1' resolves it; anything else resolves null.
import { GET, POST } from '@/app/api/research/crystal/[experimentId]/freeze/route';

function makeRequest(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

function makeGetRequest(query: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/research/crystal/EXP-P1/freeze');
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return { nextUrl: url } as unknown as NextRequest;
}

const params = (experimentId: string) => Promise.resolve({ experimentId });

const VALID_FREEZE_BODY = {
  action: 'freeze',
  confirm: true,
  contentHash: 'hash-abc',
  signedBy: ['operator-ref-1'],
  freezeRationale: 'closing out Crystal v1',
  boundaryAcknowledged: true,
};

beforeEach(() => {
  mockGetActivePersona.mockReset();
  mockGetActivePersona.mockResolvedValue({ personaId: 'persona-1', cartridgeFlags: { isAdmin: true } });
  mockFreezeArtifact.mockReset();
  mockFreezeArtifact.mockResolvedValue({ ok: true, receiptId: 'receipt-1' });
  mockGetArtifactById.mockReset();
  mockUpsertArtifact.mockReset();
  mockCurrentCrystalArtifactId.mockReset();
  mockCurrentCrystalArtifactId.mockResolvedValue('EXP-P1/crystal-vP1');
  mockRunCrystalStatisticsReport.mockReset();
  mockRunCrystalStatisticsReport.mockResolvedValue({ frozenHash: 'hash-abc', invariantCount: 12, substrateError: null });
});

describe('POST freeze — domain boundary is never operator input', () => {
  it.each(['domainBoundary', 'namespace', 'scope'])('refuses with 400 when the body includes "%s"', async (field) => {
    const res = await POST(makeRequest({ ...VALID_FREEZE_BODY, [field]: 'something' }), { params: params('EXP-P1') });
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.requestSucceeded).toBe(false);
    expect(body.error).toContain(field);
    expect(body.error).toContain('formal amendment');
    // Refused BEFORE anything else ran.
    expect(mockFreezeArtifact).not.toHaveBeenCalled();
  });

  it('blocks freeze when no ratified Domain Declaration exists for the experiment', async () => {
    const res = await POST(makeRequest(VALID_FREEZE_BODY), { params: params('EXP-NO-DECLARATION') });
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.requestSucceeded).toBe(false);
    expect(body.error).toContain('no ratified Domain Declaration exists');
    expect(mockFreezeArtifact).not.toHaveBeenCalled();
  });

  it('blocks freeze when boundaryAcknowledged is not exactly true', async () => {
    for (const value of [false, undefined, 'true', 1]) {
      const res = await POST(
        makeRequest({ ...VALID_FREEZE_BODY, boundaryAcknowledged: value }),
        { params: params('EXP-P1') },
      );
      const body = await res.json();
      expect(res.status).toBe(400);
      expect(body.error).toContain('boundaryAcknowledged: true is required');
      // The ratified boundary is still echoed back, so the operator can act on the refusal.
      expect(typeof body.ratifiedBoundary).toBe('string');
      expect(body.ratifiedBoundary.length).toBeGreaterThan(0);
    }
    expect(mockFreezeArtifact).not.toHaveBeenCalled();
  });

  it('proceeds to freeze when boundaryAcknowledged is true and a ratified declaration exists — the server never re-derives or asks for the boundary text itself', async () => {
    const res = await POST(makeRequest(VALID_FREEZE_BODY), { params: params('EXP-P1') });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.requestSucceeded).toBe(true);
    expect(mockFreezeArtifact).toHaveBeenCalledTimes(1);
    // The freeze call itself never received a domainBoundary argument — the
    // route embeds the ratified boundary nowhere but its own refusal/response text.
    const callArgs = mockFreezeArtifact.mock.calls[0][0];
    expect(callArgs).not.toHaveProperty('domainBoundary');
  });
});

describe('GET freeze — read-only artifact lookup (2026-08-05, "freeze is a one-time constitutional act")', () => {
  /*
   * Added so the Freeze surface can render a post-freeze summary instead of
   * re-mounting the ceremony on every reload. Admin-gated the same as POST.
   */
  it('requires authentication', async () => {
    mockGetActivePersona.mockResolvedValue(null);
    const res = await GET(makeGetRequest(), { params: params('EXP-P1') });
    expect(res.status).toBe(401);
  });

  it('requires admin access', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'persona-1', cartridgeFlags: { isAdmin: false } });
    const res = await GET(makeGetRequest(), { params: params('EXP-P1') });
    expect(res.status).toBe(403);
  });

  it('returns the frozen artifact by default id when no crystalId is supplied', async () => {
    mockGetArtifactById.mockResolvedValue({
      id: 'EXP-P1/crystal-vP1',
      lifecycle: 'frozen',
      contentHash: 'hash-abc',
      commitmentHash: 'hash-abc',
      frozenAt: '2026-08-05T00:00:00.000Z',
      signedBy: ['operator-ref-1'],
      receiptId: 'receipt-1',
    });
    const res = await GET(makeGetRequest(), { params: params('EXP-P1') });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.requestSucceeded).toBe(true);
    expect(body.artifact.receiptId).toBe('receipt-1');
    expect(mockGetArtifactById).toHaveBeenCalledWith('EXP-P1/crystal-vP1');
  });

  it('returns artifact: null (not an error) when nothing has been provisioned yet', async () => {
    mockGetArtifactById.mockResolvedValue(null);
    const res = await GET(makeGetRequest(), { params: params('EXP-P1') });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.requestSucceeded).toBe(true);
    expect(body.artifact).toBeNull();
  });

  it('resolves the LINEAGE-AWARE default id, never a hardcoded vP1, once a successor generation is active (2026-08-27, "Crystal v1/v2 lineage collision")', async () => {
    // currentCrystalArtifactId is the single authority for "which generation
    // is current" — this route must defer to it rather than hardcoding
    // `${experimentId}/crystal-vP1`, which is exactly the defect that let a
    // frozen vP1 satisfy vP2's Freeze stage.
    mockCurrentCrystalArtifactId.mockResolvedValue('EXP-P1/crystal-vP2');
    mockGetArtifactById.mockResolvedValue(null);
    const res = await GET(makeGetRequest(), { params: params('EXP-P1') });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.requestSucceeded).toBe(true);
    expect(body.artifact).toBeNull();
    expect(mockGetArtifactById).toHaveBeenCalledWith('EXP-P1/crystal-vP2');
  });

  it('an explicitly supplied crystalId always overrides the lineage-aware default', async () => {
    mockCurrentCrystalArtifactId.mockResolvedValue('EXP-P1/crystal-vP2');
    mockGetArtifactById.mockResolvedValue(null);
    const res = await GET(makeGetRequest({ crystalId: 'EXP-P1/crystal-vP1' }), { params: params('EXP-P1') });
    expect(res.status).toBe(200);
    expect(mockGetArtifactById).toHaveBeenCalledWith('EXP-P1/crystal-vP1');
    expect(mockCurrentCrystalArtifactId).not.toHaveBeenCalled();
  });
});

describe('POST provision — targets the current (successor) generation, never a frozen predecessor', () => {
  it('provisions the successor generation id once currentCrystalArtifactId reports it as current', async () => {
    mockCurrentCrystalArtifactId.mockResolvedValue('EXP-P1/crystal-vP2');
    mockGetArtifactById.mockResolvedValue(null); // vP2 not yet provisioned
    mockUpsertArtifact.mockResolvedValue({ ok: true });
    const res = await POST(makeRequest({ action: 'provision' }), { params: params('EXP-P1') });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.crystalId).toBe('EXP-P1/crystal-vP2');
    expect(mockUpsertArtifact).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'EXP-P1/crystal-vP2', kind: 'crystal-version' }),
    );
  });

  it('refuses to reset an already-frozen generation, and never silently falls back to it', async () => {
    // A caller that explicitly names the frozen predecessor still gets the
    // existing one-time-freeze refusal — this is unchanged, deliberate
    // behavior; only the DEFAULT id changed.
    mockGetArtifactById.mockResolvedValue({ id: 'EXP-P1/crystal-vP1', lifecycle: 'frozen' });
    const res = await POST(
      makeRequest({ action: 'provision', crystalId: 'EXP-P1/crystal-vP1' }),
      { params: params('EXP-P1') },
    );
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.requestSucceeded).toBe(false);
    expect(mockCurrentCrystalArtifactId).not.toHaveBeenCalled();
  });
});
