/**
 * services/research/track2DuplicateQueueSettle.ts — the Stage 9
 * duplicate-pair queue's authoritative post-merge refresh sequence (operator
 * ruling, 2026-08-27, "UI acceptance gap" pass). Pure orchestration, no DOM:
 * proves the exact call order and gating the panel's `settleDuplicateQueue`
 * wires real IO into — read, conditionally advance, resync, scroll.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { settleTrack2DuplicateQueue } from '@/services/research/track2DuplicateQueueSettle';

function makeDeps(overrides: Partial<Parameters<typeof settleTrack2DuplicateQueue>[0]> = {}) {
  return {
    readDuplicatePairCount: vi.fn().mockResolvedValue(0),
    advance: vi.fn().mockResolvedValue({ anchorId: 'track2-stage-freeze' }),
    resync: vi.fn().mockResolvedValue(undefined),
    scrollToAnchorId: vi.fn(),
    ...overrides,
  };
}

describe('settleTrack2DuplicateQueue — non-final merge (pairs remain)', () => {
  it('calls the authoritative read exactly once, never calls advance, resync, or scroll', async () => {
    const deps = makeDeps({ readDuplicatePairCount: vi.fn().mockResolvedValue(2) });
    const outcome = await settleTrack2DuplicateQueue(deps);
    expect(deps.readDuplicatePairCount).toHaveBeenCalledTimes(1);
    expect(deps.advance).not.toHaveBeenCalled();
    expect(deps.resync).not.toHaveBeenCalled();
    expect(deps.scrollToAnchorId).not.toHaveBeenCalled();
    expect(outcome).toEqual({ kind: 'pairs-remain', count: 2 });
  });
});

describe('settleTrack2DuplicateQueue — final merge (zero pairs remain)', () => {
  it('calls advance exactly once, resyncs, and scrolls using the advance response anchor verbatim', async () => {
    const deps = makeDeps({
      readDuplicatePairCount: vi.fn().mockResolvedValue(0),
      advance: vi.fn().mockResolvedValue({ anchorId: 'track2-stage-freeze' }),
    });
    const outcome = await settleTrack2DuplicateQueue(deps);
    expect(deps.readDuplicatePairCount).toHaveBeenCalledTimes(1);
    expect(deps.advance).toHaveBeenCalledTimes(1);
    expect(deps.resync).toHaveBeenCalledTimes(1);
    expect(deps.scrollToAnchorId).toHaveBeenCalledTimes(1);
    expect(deps.scrollToAnchorId).toHaveBeenCalledWith('track2-stage-freeze');
    expect(outcome).toEqual({ kind: 'advanced', anchorId: 'track2-stage-freeze' });
  });

  it('resync runs strictly AFTER advance (call order), not before and not skipped', async () => {
    const order: string[] = [];
    const deps = makeDeps({
      advance: vi.fn().mockImplementation(async () => {
        order.push('advance');
        return { anchorId: 'track2-stage-freeze' };
      }),
      resync: vi.fn().mockImplementation(async () => {
        order.push('resync');
      }),
    });
    await settleTrack2DuplicateQueue(deps);
    expect(order).toEqual(['advance', 'resync']);
  });

  it('never invents a destination when the advance response names no pending decision', async () => {
    const deps = makeDeps({ advance: vi.fn().mockResolvedValue({ anchorId: null }) });
    const outcome = await settleTrack2DuplicateQueue(deps);
    expect(deps.resync).toHaveBeenCalledTimes(1); // still re-syncs — the advance itself succeeded
    expect(deps.scrollToAnchorId).not.toHaveBeenCalled();
    expect(outcome).toEqual({ kind: 'advanced', anchorId: null });
  });
});

describe('settleTrack2DuplicateQueue — failure paths', () => {
  it('stops before advance when the authoritative read itself fails', async () => {
    const deps = makeDeps({ readDuplicatePairCount: vi.fn().mockResolvedValue(null) });
    const outcome = await settleTrack2DuplicateQueue(deps);
    expect(deps.advance).not.toHaveBeenCalled();
    expect(deps.resync).not.toHaveBeenCalled();
    expect(outcome).toEqual({ kind: 'read-failed' });
  });

  it('reports advance-failed and never resyncs or scrolls when advance itself rejects', async () => {
    const deps = makeDeps({ advance: vi.fn().mockRejectedValue(new Error('orchestrator refused')) });
    const outcome = await settleTrack2DuplicateQueue(deps);
    expect(deps.resync).not.toHaveBeenCalled();
    expect(deps.scrollToAnchorId).not.toHaveBeenCalled();
    expect(outcome).toEqual({ kind: 'advance-failed', error: 'orchestrator refused' });
  });
});

describe('settleTrack2DuplicateQueue — determinism / no local authority', () => {
  let calls: number[];
  beforeEach(() => {
    calls = [];
  });

  it('the outcome is driven entirely by what readDuplicatePairCount reports each call, never a remembered prior count', async () => {
    const counts = [3, 0];
    const deps = makeDeps({
      readDuplicatePairCount: vi.fn().mockImplementation(async () => {
        calls.push(counts.shift()!);
        return calls[calls.length - 1];
      }),
    });
    const first = await settleTrack2DuplicateQueue(deps);
    expect(first).toEqual({ kind: 'pairs-remain', count: 3 });
    const second = await settleTrack2DuplicateQueue(deps);
    expect(second.kind).toBe('advanced');
    expect(deps.advance).toHaveBeenCalledTimes(1); // only on the SECOND, freshly-zero call
  });
});
