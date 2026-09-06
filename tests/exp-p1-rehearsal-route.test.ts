/**
 * GET/POST /api/research/crystal/[experimentId]/rehearsal — HTTP-level tests
 * (2026-09-07 two-mode execution model).
 *
 * Pins: admin-gated on both methods; GET resolves the frozen substrate label
 * from `rehearsalEligibility` (never a hardcoded generation), always
 * includes 'awaiting external countersignature' plus the REGISTERED
 * protocol's own missing-artifact-kind labels (never an invented ontology),
 * and filters past runs to `internal-rehearsal` only; POST never accepts a
 * caller-supplied `runExecutionDesignation`/`confirmatoryEligible` (the
 * request body is ignored entirely — the runner fixes both unconditionally).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const mockGetActivePersona = vi.fn();
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (req: unknown) => mockGetActivePersona(req),
}));

const mockDeriveProtocolRatified = vi.fn();
const mockListExecutionRuns = vi.fn();
vi.mock('@/services/research/artifacts', () => ({
  deriveProtocolRatified: (...args: any[]) => mockDeriveProtocolRatified(...args),
  listExecutionRuns: (...args: any[]) => mockListExecutionRuns(...args),
}));

const mockRehearsalEligibility = vi.fn();
const mockRunExpP1Rehearsal = vi.fn();
vi.mock('@/services/research/expP1Rehearsal', () => ({
  rehearsalEligibility: (...args: any[]) => mockRehearsalEligibility(...args),
  runExpP1Rehearsal: (...args: any[]) => mockRunExpP1Rehearsal(...args),
}));

import { GET, POST } from '@/app/api/research/crystal/[experimentId]/rehearsal/route';

function makeGetRequest(): NextRequest {
  return { nextUrl: new URL('http://localhost/api/research/crystal/EXP-P1/rehearsal') } as unknown as NextRequest;
}
function makePostRequest(body: unknown = {}): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}
const params = (experimentId = 'EXP-P1') => Promise.resolve({ experimentId });

beforeEach(() => {
  mockGetActivePersona.mockReset();
  mockDeriveProtocolRatified.mockReset();
  mockListExecutionRuns.mockReset();
  mockRehearsalEligibility.mockReset();
  mockRunExpP1Rehearsal.mockReset();
});

describe('GET /rehearsal — auth', () => {
  it('401 without an authenticated persona', async () => {
    mockGetActivePersona.mockResolvedValue(null);
    const res = await GET(makeGetRequest(), { params: params() });
    expect(res.status).toBe(401);
  });

  it('403 without admin cartridge flags', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'persona-1', cartridgeFlags: { isAdmin: false } });
    const res = await GET(makeGetRequest(), { params: params() });
    expect(res.status).toBe(403);
  });
});

describe('GET /rehearsal — status body', () => {
  beforeEach(() => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'persona-1', cartridgeFlags: { isAdmin: true } });
  });

  it('resolves the frozen substrate label from eligibility, never a hardcoded generation', async () => {
    mockRehearsalEligibility.mockResolvedValue({
      eligible: true,
      frozenCrystalArtifactId: 'EXP-P1/crystal-vP2',
      frozenCrystalContentHash: 'hash-abc',
    });
    mockDeriveProtocolRatified.mockResolvedValue({ ready: false, missing: [], present: [] });
    mockListExecutionRuns.mockResolvedValue([]);
    const res = await GET(makeGetRequest(), { params: params() });
    const body = await res.json();
    expect(body.requestSucceeded).toBe(true);
    expect(body.frozenSubstrateLabel).toBe('Crystal vP2 · internal/pilot');
  });

  it('always includes "awaiting external countersignature" plus the registered protocol\'s missing-kind labels', async () => {
    mockRehearsalEligibility.mockResolvedValue({ eligible: true, frozenCrystalArtifactId: 'EXP-P1/crystal-vP2', frozenCrystalContentHash: 'hash-abc' });
    mockDeriveProtocolRatified.mockResolvedValue({
      ready: false,
      missing: ['task-set', 'arm-config'],
      present: ['crystal-version'],
    });
    mockListExecutionRuns.mockResolvedValue([]);
    const res = await GET(makeGetRequest(), { params: params() });
    const body = await res.json();
    expect(body.confirmatoryBlockers).toContain('awaiting external countersignature');
    expect(body.confirmatoryBlockers).toContain('awaiting sealed held-out task set');
    expect(body.confirmatoryBlockers).toContain('awaiting external Arm D prose');
  });

  it('filters past runs to internal-rehearsal only — a confirmatory run is never listed here', async () => {
    mockRehearsalEligibility.mockResolvedValue({ eligible: true, frozenCrystalArtifactId: 'EXP-P1/crystal-vP2', frozenCrystalContentHash: 'hash-abc' });
    mockDeriveProtocolRatified.mockResolvedValue({ ready: false, missing: [], present: [] });
    mockListExecutionRuns.mockResolvedValue([
      { id: 'run-1', frozenAt: 't1', taskSetId: 'ts-1', taskSetProvenance: 'provisional', armIds: ['A', 'B', 'C', 'D'], taskResults: [{}, {}], receiptId: 'r1', runExecutionDesignation: 'internal-rehearsal' },
      { id: 'run-2', frozenAt: 't2', taskSetId: 'ts-2', taskSetProvenance: 'external-held-out', armIds: ['A', 'B', 'C', 'D'], taskResults: [], receiptId: 'r2', runExecutionDesignation: 'confirmatory' },
    ]);
    const res = await GET(makeGetRequest(), { params: params() });
    const body = await res.json();
    expect(body.pastRehearsalRuns).toHaveLength(1);
    expect(body.pastRehearsalRuns[0].id).toBe('run-1');
    expect(body.pastRehearsalRuns[0].taskCount).toBe(2);
  });
});

describe('POST /rehearsal — auth', () => {
  it('401 without an authenticated persona', async () => {
    mockGetActivePersona.mockResolvedValue(null);
    const res = await POST(makePostRequest(), { params: params() });
    expect(res.status).toBe(401);
  });

  it('403 without admin cartridge flags', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'persona-1', cartridgeFlags: { isAdmin: false } });
    const res = await POST(makePostRequest(), { params: params() });
    expect(res.status).toBe(403);
  });
});

describe('POST /rehearsal — launches a run', () => {
  beforeEach(() => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'persona-1', cartridgeFlags: { isAdmin: true } });
  });

  it('calls runExpP1Rehearsal with the caller persona + experimentId, ignoring any request body', async () => {
    mockRunExpP1Rehearsal.mockResolvedValue({ ok: true, runId: 'run-1', receiptId: 'receipt-1', taskResults: [{}, {}] });
    const res = await POST(
      makePostRequest({ runExecutionDesignation: 'confirmatory', confirmatoryEligible: true }),
      { params: params() },
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.requestSucceeded).toBe(true);
    expect(body.runId).toBe('run-1');
    expect(body.note).toMatch(/NON-CONFIRMATORY/);
    expect(mockRunExpP1Rehearsal).toHaveBeenCalledWith({ personaId: 'persona-1', experimentId: 'EXP-P1' });
  });

  it('returns 409 with the runner\'s own error when refused', async () => {
    mockRunExpP1Rehearsal.mockResolvedValue({ ok: false, error: 'no frozen crystal-version generation exists yet' });
    const res = await POST(makePostRequest(), { params: params() });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.requestSucceeded).toBe(false);
    expect(body.error).toMatch(/no frozen crystal-version/);
  });
});
