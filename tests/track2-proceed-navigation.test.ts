/**
 * services/research/track2ProceedNavigation.ts — behavioral tests for the
 * Research Copilot → Track 2 "Proceed" sequence (Defect 1, 2026-08-27
 * "Crystal freeze-gating continuation" review pass).
 *
 * Unlike the source-authority canaries elsewhere in this suite, this module
 * is plain, pure, dependency-injected TypeScript with no React and no real
 * network call — it can be exercised BEHAVIORALLY: real async deps, real
 * call-order assertions, real out-of-order resolution races. That is a
 * stronger proof than grepping the source for the right shape, so it is used
 * here.
 */
import { describe, it, expect, vi } from 'vitest';
import { proceedToTrack2Stage, type Track2ProceedDeps } from '@/services/research/track2ProceedNavigation';
import type { Track2DeepLink } from '@/services/research/track2Programme';

const DEEP_LINK: Track2DeepLink = {
  programmeId: 'track-2',
  experimentId: 'EXP-P1',
  stageId: 'run-readiness',
  stageLabel: 'Run Readiness',
  surfaceRef: {
    cartridgeTab: 'irl-experiment-lab',
    labTab: 'track2',
    anchorId: 'track2-stage-run-readiness',
  },
};

const STALE_DEEP_LINK: Track2DeepLink = {
  ...DEEP_LINK,
  stageId: 'review-and-admit',
  stageLabel: 'Ratify Domain Pillars',
  surfaceRef: { ...DEEP_LINK.surfaceRef, anchorId: 'track2-stage-review-and-admit' },
};

describe('proceedToTrack2Stage — ordering contract', () => {
  it('awaits advance() to completion BEFORE calling readPendingDeepLink() — required contract item 1+2', async () => {
    const order: string[] = [];
    const deps: Track2ProceedDeps = {
      advance: async () => {
        order.push('advance-start');
        await new Promise((r) => setTimeout(r, 5));
        order.push('advance-end');
      },
      readPendingDeepLink: async () => {
        order.push('read');
        return DEEP_LINK;
      },
      navigate: () => order.push('navigate'),
      navigateGeneric: () => order.push('navigate-generic'),
    };
    await proceedToTrack2Stage(deps);
    expect(order).toEqual(['advance-start', 'advance-end', 'read', 'navigate']);
  });

  it('navigates using ONLY the deep link the fresh read returned — never a value the caller supplied elsewhere (required contract item 3)', async () => {
    let navigatedWith: Track2DeepLink | null = null;
    const deps: Track2ProceedDeps = {
      advance: async () => {},
      readPendingDeepLink: async () => DEEP_LINK,
      navigate: (dl) => { navigatedWith = dl; },
      navigateGeneric: () => { throw new Error('must not take the generic path'); },
    };
    await proceedToTrack2Stage(deps);
    expect(navigatedWith).toBe(DEEP_LINK);
    expect(navigatedWith).not.toBe(STALE_DEEP_LINK);
  });

  it('never calls navigate before both advance and the read have resolved — destination state cannot be cached pre-run state (required contract item 4)', async () => {
    let navigated = false;
    let advanceResolved = false;
    let readResolved = false;
    const deps: Track2ProceedDeps = {
      advance: async () => {
        await new Promise((r) => setTimeout(r, 10));
        advanceResolved = true;
      },
      readPendingDeepLink: async () => {
        // If navigate() has already fired by the time the read even STARTS,
        // the sequence raced ahead of its own data — this is exactly the
        // regression under test.
        expect(navigated).toBe(false);
        await new Promise((r) => setTimeout(r, 10));
        readResolved = true;
        return DEEP_LINK;
      },
      navigate: () => {
        // navigate must never fire before BOTH prerequisite awaits resolved.
        expect(advanceResolved).toBe(true);
        expect(readResolved).toBe(true);
        navigated = true;
      },
      navigateGeneric: () => { throw new Error('must not take the generic path'); },
    };
    const outcome = await proceedToTrack2Stage(deps);
    expect(navigated).toBe(true);
    expect(outcome).toEqual({ kind: 'navigated', deepLink: DEEP_LINK });
  });

  it('a failed advance() never reaches readPendingDeepLink or navigate — no stale navigation on advance failure (required contract item 8)', async () => {
    const readPendingDeepLink = vi.fn();
    const navigate = vi.fn();
    const navigateGeneric = vi.fn();
    const outcome = await proceedToTrack2Stage({
      advance: async () => { throw new Error('advance refused'); },
      readPendingDeepLink,
      navigate,
      navigateGeneric,
    });
    expect(outcome).toEqual({ kind: 'advance-failed', error: 'advance refused' });
    expect(readPendingDeepLink).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(navigateGeneric).not.toHaveBeenCalled();
  });

  it('a failed refresh (readPendingDeepLink rejects) never navigates — offers a distinguishable outcome for Retry (required contract item 8)', async () => {
    const navigate = vi.fn();
    const navigateGeneric = vi.fn();
    const outcome = await proceedToTrack2Stage({
      advance: async () => {},
      readPendingDeepLink: async () => { throw new Error('network error'); },
      navigate,
      navigateGeneric,
    });
    expect(outcome).toEqual({ kind: 'refresh-failed' });
    expect(navigate).not.toHaveBeenCalled();
    expect(navigateGeneric).not.toHaveBeenCalled();
  });

  it('a read that resolves to undefined (a soft failure, not a thrown error) is ALSO treated as refresh-failed — never as "nothing pending"', async () => {
    const navigate = vi.fn();
    const navigateGeneric = vi.fn();
    const outcome = await proceedToTrack2Stage({
      advance: async () => {},
      readPendingDeepLink: async () => undefined,
      navigate,
      navigateGeneric,
    });
    expect(outcome).toEqual({ kind: 'refresh-failed' });
    expect(navigateGeneric).not.toHaveBeenCalled();
  });

  it('a fresh read that genuinely finds nothing pending falls back to the GENERIC navigation — never fabricates a deep link', async () => {
    const navigate = vi.fn();
    let navigatedGeneric = false;
    const outcome = await proceedToTrack2Stage({
      advance: async () => {},
      readPendingDeepLink: async () => null,
      navigate,
      navigateGeneric: () => { navigatedGeneric = true; },
    });
    expect(outcome).toEqual({ kind: 'navigated-generic' });
    expect(navigate).not.toHaveBeenCalled();
    expect(navigatedGeneric).toBe(true);
  });
});
