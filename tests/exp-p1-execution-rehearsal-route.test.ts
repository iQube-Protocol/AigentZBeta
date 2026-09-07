/**
 * POST /api/research/crystal/[experimentId]/execution-rehearsal — HTTP-level
 * tests (2026-09-07 genuine execution rehearsal).
 *
 * Pins: admin-gated; selects the v4 (unseen) fixture by default and on any
 * unrecognized taskSetVersion — never a caller-supplied task-set content
 * injection; forwards persona/experimentId to the runner untouched.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const mockGetActivePersona = vi.fn();
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (req: unknown) => mockGetActivePersona(req),
}));

const mockRunExpP1ExecutionRehearsal = vi.fn();
const { FAKE_V4_TASK_SET } = vi.hoisted(() => ({
  FAKE_V4_TASK_SET: { id: 'EXP-P1/rehearsal-task-set-provisional-v4', provenance: 'provisional', tasks: new Array(16).fill({}) },
}));
vi.mock('@/services/research/expP1ExecutionRehearsal', () => ({
  runExpP1ExecutionRehearsal: (...args: unknown[]) => mockRunExpP1ExecutionRehearsal(...args),
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
  mockRunExpP1ExecutionRehearsal.mockReset();
  mockSummarizeRehearsalRun.mockReset();
  mockSummarizeRehearsalRun.mockReturnValue({ taskCounts: { total: 0, scored: 0, unscorable: 0 } });
});

describe('POST /execution-rehearsal — auth', () => {
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

describe('POST /execution-rehearsal — launches a run', () => {
  beforeEach(() => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'persona-1', cartridgeFlags: { isAdmin: true } });
  });

  it('defaults to the v4 (unseen) task set, forwarding persona + experimentId untouched', async () => {
    mockRunExpP1ExecutionRehearsal.mockResolvedValue({ ok: true, runId: 'run-1', receiptId: 'receipt-1', taskResults: [{}], run: { id: 'run-1' } });
    await POST(makePostRequest({}), { params: params() });
    expect(mockRunExpP1ExecutionRehearsal).toHaveBeenCalledWith({ personaId: 'persona-1', experimentId: 'EXP-P1', taskSet: FAKE_V4_TASK_SET });
  });

  it('falls back to v4 for an unrecognized taskSetVersion — never a caller-supplied task-set content injection', async () => {
    mockRunExpP1ExecutionRehearsal.mockResolvedValue({ ok: true, runId: 'run-2', receiptId: 'receipt-2', taskResults: [{}] });
    await POST(makePostRequest({ taskSetVersion: 'v99-does-not-exist' }), { params: params() });
    expect(mockRunExpP1ExecutionRehearsal).toHaveBeenCalledWith({ personaId: 'persona-1', experimentId: 'EXP-P1', taskSet: FAKE_V4_TASK_SET });
  });

  it('returns 409 with the runner error when the run is refused', async () => {
    mockRunExpP1ExecutionRehearsal.mockResolvedValue({ ok: false, error: 'selector version drift' });
    const res = await POST(makePostRequest({}), { params: params() });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/selector version drift/);
  });

  it('response note labels the run internal/non-confirmatory', async () => {
    mockRunExpP1ExecutionRehearsal.mockResolvedValue({ ok: true, runId: 'run-3', receiptId: 'receipt-3', taskResults: [{}], run: { id: 'run-3' } });
    const res = await POST(makePostRequest({}), { params: params() });
    const body = await res.json();
    expect(body.note).toMatch(/INTERNAL \/ NON-CONFIRMATORY/);
  });
});
