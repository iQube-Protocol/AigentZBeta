/**
 * POST /api/research/crystal/[experimentId]/execution-rehearsal — HTTP-level
 * tests (2026-09-07 genuine execution rehearsal; start/step durability split
 * 2026-09-08 — see `services/research/expP1ExecutionRehearsal.ts`'s header
 * for the 504 execution-apparatus incident this route split addresses).
 *
 * Pins: admin-gated; selects the v4 (unseen) fixture by default and on any
 * unrecognized taskSetVersion — never a caller-supplied task-set content
 * injection; forwards persona/experimentId/runId to the runner untouched;
 * `action: 'start'` never calls the model-executing runner
 * (`stepExpP1ExecutionRehearsal`) and `action: 'step'` never calls the
 * run-creating one (`startExpP1ExecutionRehearsal`) — the two phases are
 * routed to two distinct functions, never one call doing double duty.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const mockGetActivePersona = vi.fn();
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (req: unknown) => mockGetActivePersona(req),
}));

const mockStartExpP1ExecutionRehearsal = vi.fn();
const mockStepExpP1ExecutionRehearsal = vi.fn();
const { FAKE_V4_TASK_SET } = vi.hoisted(() => ({
  FAKE_V4_TASK_SET: { id: 'EXP-P1/rehearsal-task-set-provisional-v4', provenance: 'provisional', tasks: new Array(16).fill({}) },
}));
vi.mock('@/services/research/expP1ExecutionRehearsal', () => ({
  startExpP1ExecutionRehearsal: (...args: unknown[]) => mockStartExpP1ExecutionRehearsal(...args),
  stepExpP1ExecutionRehearsal: (...args: unknown[]) => mockStepExpP1ExecutionRehearsal(...args),
  UNSEEN_EXECUTION_REHEARSAL_TASK_SET: FAKE_V4_TASK_SET,
}));

const mockSummarizeRehearsalRun = vi.fn();
vi.mock('@/services/research/expP1Rehearsal', () => ({
  summarizeRehearsalRun: (...args: unknown[]) => mockSummarizeRehearsalRun(...args),
}));

import { POST } from '@/app/api/research/crystal/[experimentId]/execution-rehearsal/route';

function makePostRequest(body: unknown = {}): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}
const params = (experimentId = 'EXP-P1') => Promise.resolve({ experimentId });

beforeEach(() => {
  mockGetActivePersona.mockReset();
  mockStartExpP1ExecutionRehearsal.mockReset();
  mockStepExpP1ExecutionRehearsal.mockReset();
  mockSummarizeRehearsalRun.mockReset();
  mockSummarizeRehearsalRun.mockReturnValue({ taskCounts: { total: 0, scored: 0, unscorable: 0 } });
});

describe('POST /execution-rehearsal — auth', () => {
  it('401 without an authenticated persona', async () => {
    mockGetActivePersona.mockResolvedValue(null);
    const res = await POST(makePostRequest({ action: 'start' }), { params: params() });
    expect(res.status).toBe(401);
  });

  it('403 without admin cartridge flags', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'persona-1', cartridgeFlags: { isAdmin: false } });
    const res = await POST(makePostRequest({ action: 'start' }), { params: params() });
    expect(res.status).toBe(403);
  });
});

describe("POST /execution-rehearsal — action: 'start'", () => {
  beforeEach(() => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'persona-1', cartridgeFlags: { isAdmin: true } });
  });

  it('defaults to the v4 (unseen) task set, forwarding persona + experimentId untouched, and never calls step', async () => {
    mockStartExpP1ExecutionRehearsal.mockResolvedValue({ ok: true, runId: 'run-1', taskSetId: FAKE_V4_TASK_SET.id, totalTasks: 16 });
    const res = await POST(makePostRequest({ action: 'start' }), { params: params() });
    expect(mockStartExpP1ExecutionRehearsal).toHaveBeenCalledWith({ personaId: 'persona-1', experimentId: 'EXP-P1', taskSet: FAKE_V4_TASK_SET });
    expect(mockStepExpP1ExecutionRehearsal).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.requestSucceeded).toBe(true);
    expect(body.runId).toBe('run-1');
    expect(body.totalTasks).toBe(16);
    expect(body.status).toBe('executing');
  });

  it('an omitted action defaults to start (never silently steps an unnamed run)', async () => {
    mockStartExpP1ExecutionRehearsal.mockResolvedValue({ ok: true, runId: 'run-1', taskSetId: FAKE_V4_TASK_SET.id, totalTasks: 16 });
    await POST(makePostRequest({}), { params: params() });
    expect(mockStartExpP1ExecutionRehearsal).toHaveBeenCalled();
    expect(mockStepExpP1ExecutionRehearsal).not.toHaveBeenCalled();
  });

  it('falls back to v4 for an unrecognized taskSetVersion — never a caller-supplied task-set content injection', async () => {
    mockStartExpP1ExecutionRehearsal.mockResolvedValue({ ok: true, runId: 'run-2', taskSetId: FAKE_V4_TASK_SET.id, totalTasks: 16 });
    await POST(makePostRequest({ action: 'start', taskSetVersion: 'v99-does-not-exist' }), { params: params() });
    expect(mockStartExpP1ExecutionRehearsal).toHaveBeenCalledWith({ personaId: 'persona-1', experimentId: 'EXP-P1', taskSet: FAKE_V4_TASK_SET });
  });

  it('returns 409 with the runner error when the run is refused', async () => {
    mockStartExpP1ExecutionRehearsal.mockResolvedValue({ ok: false, error: 'selector version drift' });
    const res = await POST(makePostRequest({ action: 'start' }), { params: params() });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/selector version drift/);
  });
});

describe("POST /execution-rehearsal — action: 'step'", () => {
  beforeEach(() => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'persona-1', cartridgeFlags: { isAdmin: true } });
  });

  it('requires a runId — 400 without one, and never calls start or step', async () => {
    const res = await POST(makePostRequest({ action: 'step' }), { params: params() });
    expect(res.status).toBe(400);
    expect(mockStartExpP1ExecutionRehearsal).not.toHaveBeenCalled();
    expect(mockStepExpP1ExecutionRehearsal).not.toHaveBeenCalled();
  });

  it('forwards personaId + runId untouched, and never calls start', async () => {
    mockStepExpP1ExecutionRehearsal.mockResolvedValue({ ok: true, status: 'executing', doneCount: 3, totalCount: 16, run: { id: 'run-1', taskResults: [], armIds: [] } });
    await POST(makePostRequest({ action: 'step', runId: 'run-1' }), { params: params() });
    expect(mockStepExpP1ExecutionRehearsal).toHaveBeenCalledWith({ personaId: 'persona-1', runId: 'run-1', taskSet: FAKE_V4_TASK_SET });
    expect(mockStartExpP1ExecutionRehearsal).not.toHaveBeenCalled();
  });

  it('returns 409 with the runner error when the step is refused', async () => {
    mockStepExpP1ExecutionRehearsal.mockResolvedValue({ ok: false, error: "no execution-run 'run-x' found" });
    const res = await POST(makePostRequest({ action: 'step', runId: 'run-x' }), { params: params() });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/no execution-run/);
  });

  it('response note labels the run internal/non-confirmatory and reports done/total counts', async () => {
    mockStepExpP1ExecutionRehearsal.mockResolvedValue({ ok: true, status: 'executed', doneCount: 16, totalCount: 16, run: { id: 'run-3', taskResults: [{}], armIds: ['A', 'B', 'C', 'D'] } });
    const res = await POST(makePostRequest({ action: 'step', runId: 'run-3' }), { params: params() });
    const body = await res.json();
    expect(body.note).toMatch(/INTERNAL \/ NON-CONFIRMATORY/);
    expect(body.status).toBe('executed');
    expect(body.doneCount).toBe(16);
    expect(body.totalCount).toBe(16);
  });
});
