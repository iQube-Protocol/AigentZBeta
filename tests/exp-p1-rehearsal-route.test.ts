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
const mockGetExecutionRun = vi.fn();
vi.mock('@/services/research/artifacts', () => ({
  deriveProtocolRatified: (...args: any[]) => mockDeriveProtocolRatified(...args),
  listExecutionRuns: (...args: any[]) => mockListExecutionRuns(...args),
  getExecutionRun: (...args: any[]) => mockGetExecutionRun(...args),
}));

const mockRehearsalEligibility = vi.fn();
const mockRunExpP1Rehearsal = vi.fn();
const mockSummarizeRehearsalRun = vi.fn();
vi.mock('@/services/research/expP1Rehearsal', () => ({
  rehearsalEligibility: (...args: any[]) => mockRehearsalEligibility(...args),
  runExpP1Rehearsal: (...args: any[]) => mockRunExpP1Rehearsal(...args),
  summarizeRehearsalRun: (...args: any[]) => mockSummarizeRehearsalRun(...args),
}));

import { GET, POST } from '@/app/api/research/crystal/[experimentId]/rehearsal/route';

function makeGetRequest(query: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/research/crystal/EXP-P1/rehearsal');
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return { nextUrl: url } as unknown as NextRequest;
}
function makePostRequest(body: unknown = {}): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}
const params = (experimentId = 'EXP-P1') => Promise.resolve({ experimentId });

beforeEach(() => {
  mockGetActivePersona.mockReset();
  mockDeriveProtocolRatified.mockReset();
  mockListExecutionRuns.mockReset();
  mockGetExecutionRun.mockReset();
  mockRehearsalEligibility.mockReset();
  mockRunExpP1Rehearsal.mockReset();
  mockSummarizeRehearsalRun.mockReset();
  mockSummarizeRehearsalRun.mockReturnValue({
    taskCounts: { total: 0, scored: 0, unscorable: 0 },
    unscorableTaskIds: [],
    perArm: [],
    frozenPopulationSize: null,
    armBAvailableSetSize: null,
    armBSelectedSetSize: null,
    armCFixedSliceSize: null,
    instrumentCaveat: 'INTERNAL REHEARSAL — INSTRUMENT VALIDATION ONLY, NOT A SCIENTIFIC RESULT.',
  });
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
    // No `run` in the runner's result -> no summary computed.
    expect(body.summary).toBeNull();
    expect(mockSummarizeRehearsalRun).not.toHaveBeenCalled();
  });

  it('computes the proper rehearsal summary from the runner\'s returned `run` when present', async () => {
    const run = { id: 'run-1', taskResults: [{}, {}] };
    mockRunExpP1Rehearsal.mockResolvedValue({ ok: true, runId: 'run-1', receiptId: 'receipt-1', taskResults: [{}, {}], run });
    const res = await POST(makePostRequest({}), { params: params() });
    const body = await res.json();
    expect(mockSummarizeRehearsalRun).toHaveBeenCalledWith(run);
    expect(body.summary).toBeDefined();
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

describe('GET /rehearsal?runId=... — the "View results" affordance (2026-09-07)', () => {
  beforeEach(() => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'persona-1', cartridgeFlags: { isAdmin: true } });
  });

  it('returns the full run detail (including taskResults) for a matching internal-rehearsal run', async () => {
    const run = {
      id: 'EXP-P1/execution-run/internal-rehearsal/x',
      experimentId: 'EXP-P1',
      runExecutionDesignation: 'internal-rehearsal',
      taskResults: [{ taskId: 'rehearsal-001', taskKind: 'recall', groundTruthInvariantIds: [], armResults: [] }],
    };
    mockGetExecutionRun.mockResolvedValue(run);
    const res = await GET(makeGetRequest({ runId: 'EXP-P1/execution-run/internal-rehearsal/x' }), { params: params() });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.requestSucceeded).toBe(true);
    expect(body.run).toEqual(run);
    expect(mockGetExecutionRun).toHaveBeenCalledWith('EXP-P1/execution-run/internal-rehearsal/x');
    // The proper rehearsal summary (2026-09-07) is computed from the SAME run.
    expect(mockSummarizeRehearsalRun).toHaveBeenCalledWith(run);
    expect(body.summary).toBeDefined();
    // The status-summary fields are never computed on this path.
    expect(mockRehearsalEligibility).not.toHaveBeenCalled();
  });

  it('404s when the run does not exist', async () => {
    mockGetExecutionRun.mockResolvedValue(null);
    const res = await GET(makeGetRequest({ runId: 'does-not-exist' }), { params: params() });
    expect(res.status).toBe(404);
  });

  it("404s when the run belongs to a DIFFERENT experiment — never leaks another experiment's run by id guess", async () => {
    mockGetExecutionRun.mockResolvedValue({
      id: 'EXP-OTHER/execution-run/internal-rehearsal/x',
      experimentId: 'EXP-OTHER',
      runExecutionDesignation: 'internal-rehearsal',
      taskResults: [],
    });
    const res = await GET(makeGetRequest({ runId: 'EXP-OTHER/execution-run/internal-rehearsal/x' }), { params: params('EXP-P1') });
    expect(res.status).toBe(404);
  });

  it('404s when the run is not internal-rehearsal-designated (never surfaces a confirmatory run through this surface)', async () => {
    mockGetExecutionRun.mockResolvedValue({
      id: 'EXP-P1/execution-run/confirmatory/x',
      experimentId: 'EXP-P1',
      runExecutionDesignation: 'confirmatory',
      taskResults: [],
    });
    const res = await GET(makeGetRequest({ runId: 'EXP-P1/execution-run/confirmatory/x' }), { params: params() });
    expect(res.status).toBe(404);
  });
});
