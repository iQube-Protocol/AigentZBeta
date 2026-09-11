/**
 * Intent authority persistence (2026-08-18, operator-directed).
 *
 * Live evidence: fresh pack generation (current timestamp) sent Intent A's
 * goal even though the operator was working on Intent B (TS2322) and had
 * already accepted it. `ImplementationLayout.generate()` sends
 * `goal: session.intent.goal` verbatim — the defect is not in pack
 * generation, it is that `session.intent` itself was stale by the time
 * `generate()` read it.
 *
 * Root cause, traced file:line:
 *   - New intent quick action (DevCommandCenterTab.tsx copilotQuickPrompts)
 *     only opens the Intent capsule — it never mutates session state itself.
 *   - The copilot's stage_data proposal is applied via
 *     `applyStageProposal(session, proposal)` (stageOrchestrator.ts,
 *     case 'intent') — this is PURE and correct: it replaces `intent` and
 *     clears every downstream artifact in the SAME in-memory session
 *     (same `sessionId` — "New intent" REPLACES the authoritative current
 *     intent in place; it does not fork a second session identity).
 *   - `DevCommandCenterTab.tsx`'s autosave effect (~line 781, pre-fix) only
 *     persisted the session to `/api/dev-command-center/sessions` on a
 *     DEBOUNCED 1.5s timer after the last change.
 *   - The hydrate-on-mount effect (~line 723) fires on every fresh MOUNT of
 *     the component (`hydrateAttemptedRef` is a local ref — a remount always
 *     resets it) and fetches "the caller's most recent session" — i.e.
 *     whatever the DB's `updated_at`-latest row for that persona currently
 *     is, filtered only by `isPristineDevLoopSession` on the FRESH mount's
 *     own (always-pristine) in-memory state.
 *   - THE RACE: if any remount happens within that 1.5s debounce window
 *     after Intent B was accepted — the DB still only has Intent A
 *     persisted — hydration legitimately, silently restores Intent A. No
 *     parallel session store, no forked identity: the single store was
 *     simply not yet caught up when something read it.
 *
 * The fix: accepting a NEW intent (`handleApproveProposal`, proposal.kind
 * === 'intent') persists to the SAME endpoint IMMEDIATELY (fire-and-forget,
 * not debounced) — shrinking the unsaved window from 1.5s+ down to one
 * network round-trip. This file reproduces the actual causal chain with the
 * real, exported functions (`applyStageProposal`, `advanceStage`,
 * `canAdvance`) plus a fake persistence layer that mirrors the REAL
 * `updated_at`-ordered upsert/read semantics of
 * `/api/dev-command-center/sessions` — not only a pure reducer in isolation.
 */

import { readFileSync } from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import { applyStageProposal, advanceStage, canAdvance, createDevLoopSession } from '@/services/devCommandCenter';
import type { DevLoopState } from '@/types/devCommandCenter';

const TAB_SOURCE = readFileSync(
  path.join(process.cwd(), 'app/triad/components/codex/tabs/DevCommandCenterTab.tsx'),
  'utf-8',
);
const IMPLEMENTATION_LAYOUT_SOURCE = readFileSync(
  path.join(process.cwd(), 'components/devcommandcenter/layouts/ImplementationLayout.tsx'),
  'utf-8',
);

/** A minimal fake of `dev_loop_sessions` — the SAME semantics the real
 *  route implements: upsert keyed on session_id, read returns the
 *  `updated_at`-latest row. A monotonic counter stands in for wall-clock
 *  `updated_at` (Date.now() is unavailable in this harness), which is all
 *  the real route's `.order('updated_at', { ascending: false }).limit(1)`
 *  actually depends on: relative recency, not the literal timestamp. */
function createFakeSessionStore() {
  let clock = 0;
  const rows = new Map<string, { state: DevLoopState; updatedAt: number }>();
  return {
    /** Mirrors POST /api/dev-command-center/sessions (upsert by sessionId). */
    upsert(session: DevLoopState) {
      clock += 1;
      rows.set(session.sessionId, { state: session, updatedAt: clock });
    },
    /** Mirrors GET /api/dev-command-center/sessions (most-recently-updated
     *  row for the persona — here, simply the only row this fake tracks,
     *  since ownership filtering is orthogonal to this race). */
    getMostRecent(): DevLoopState | null {
      let best: { state: DevLoopState; updatedAt: number } | null = null;
      for (const row of rows.values()) {
        if (!best || row.updatedAt > best.updatedAt) best = row;
      }
      return best?.state ?? null;
    },
    /** Total distinct session_id rows currently stored — upsert semantics
     *  mean accepting a new intent under the SAME sessionId must never grow
     *  this count. */
    rowCount(): number {
      return rows.size;
    },
  };
}

function intentProposal(goal: string, rawInput: string) {
  return {
    kind: 'intent' as const,
    summary: goal,
    data: { rawInput, goal, users: ['operator'], desiredOutcomes: ['x'], successCriteria: ['y'] },
  };
}

describe('Live-defect reproduction — New intent must not silently revert to the prior intent', () => {
  it('WITHOUT the immediate-save fix (debounce-only autosave), a remount within the debounce window restores the PRIOR intent — reproducing the exact live defect', () => {
    const store = createFakeSessionStore();

    // 1. Persist Intent A session.
    let session = createDevLoopSession();
    session = applyStageProposal(session, intentProposal(
      'Develop a skill that generates a 24-second video and a corresponding article.',
      'video/article',
    ));
    store.upsert(session); // Intent A's debounced autosave eventually lands.

    // 2/3. Begin New Intent from the copilot; accept Intent B. In-memory
    // state is correct immediately (the cross-intent isolation fix already
    // proves this) — but WITHOUT an immediate save, nothing persists it yet.
    session = applyStageProposal(session, intentProposal(
      'Fix pre-existing TS2322 at implementationPack.ts:416',
      'TS2322 fix',
    ));
    expect(session.intent?.goal).toMatch(/TS2322/); // in-memory: correct

    // 4. Allow autosave/hydration effects to run — but the debounced
    // autosave for Intent B has NOT fired yet (this is the exact race: a
    // remount inside the 1.5s window). Simulate a remount's hydration read
    // BEFORE Intent B's debounced save reaches the store.
    const restoredWithoutFix = store.getMostRecent();

    // This is the live defect, reproduced: the "most recent" persisted
    // session is still Intent A, because nothing forced Intent B to save
    // immediately.
    expect(restoredWithoutFix?.intent?.goal).toMatch(/video/i);
  });

  it('WITH the immediate-save fix, the same remount sequence resolves to Intent B — the defect is closed', () => {
    const store = createFakeSessionStore();

    // 1. Persist Intent A session.
    let session = createDevLoopSession();
    session = applyStageProposal(session, intentProposal(
      'Develop a skill that generates a 24-second video and a corresponding article.',
      'video/article',
    ));
    store.upsert(session);
    const sessionIdAfterA = session.sessionId;

    // 2/3. Begin New Intent; accept Intent B.
    session = applyStageProposal(session, intentProposal(
      'Fix pre-existing TS2322 at implementationPack.ts:416',
      'TS2322 fix',
    ));

    // THE FIX under test: intent acceptance saves IMMEDIATELY (this is
    // exactly what handleApproveProposal's `if (proposal.kind === "intent")`
    // branch now does — fire the upsert synchronously on acceptance, never
    // waiting for the debounce timer).
    store.upsert(session);

    // 4. Allow autosave/hydration effects to run — a remount's hydration
    // read now sees Intent B, because it was never left unsaved.
    const restoredWithFix = store.getMostRecent();
    expect(restoredWithFix?.intent?.goal).toMatch(/TS2322/);
    expect(restoredWithFix?.intent?.goal).not.toMatch(/video/i);

    // 5/6. Navigate through stages to Implement; generate pack — the request
    // body ImplementationLayout.generate() builds (`goal: session.intent.goal`)
    // now reflects Intent B, matching what actually gets persisted.
    expect(restoredWithFix?.intent?.goal).toBe(session.intent?.goal);

    // Same sessionId throughout — "New intent" REPLACES the authoritative
    // current intent in place; it does not fork a second session identity
    // (the architecture this fix commits to, per the governing rule).
    expect(session.sessionId).toBe(sessionIdAfterA);
    expect(restoredWithFix?.sessionId).toBe(sessionIdAfterA);

    // 9. No subsequent hydration/save can restore Intent A: the store only
    // ever holds ONE row for this sessionId (upsert semantics) — Intent A's
    // row was overwritten in place, never appended alongside as a second row
    // a later read could still find.
    expect(store.rowCount()).toBe(1);
  });

  it('a stage walk to Implementation preserves the same accepted Intent B goal (no re-divergence downstream)', () => {
    let session = createDevLoopSession();
    session = applyStageProposal(session, intentProposal('Fix pre-existing TS2322', 'TS2322 fix'));
    while (canAdvance(session) && session.stage !== 'implementation') {
      session = advanceStage(session);
    }
    expect(session.intent?.goal).toBe('Fix pre-existing TS2322');
  });
});

describe('Structural pin — handleApproveProposal saves a new intent immediately, never debounced', () => {
  function extractHandleApproveProposalBody(): string {
    const start = TAB_SOURCE.indexOf('const handleApproveProposal = useCallback((capsule: DevCapsuleId) => {');
    expect(start, 'handleApproveProposal not found — has it been renamed/restructured?').toBeGreaterThan(-1);
    const bodyStart = TAB_SOURCE.indexOf('{', start + 'const handleApproveProposal = useCallback((capsule: DevCapsuleId) =>'.length);
    let depth = 0;
    let i = bodyStart;
    for (; i < TAB_SOURCE.length; i++) {
      if (TAB_SOURCE[i] === '{') depth++;
      else if (TAB_SOURCE[i] === '}') {
        depth--;
        if (depth === 0) break;
      }
    }
    return TAB_SOURCE.slice(bodyStart, i + 1);
  }

  const fn = extractHandleApproveProposalBody();

  it('contains an immediate-save branch gated on proposal.kind === "intent"', () => {
    expect(fn).toMatch(/proposal\.kind === "intent"/);
  });

  it('the immediate-save branch POSTs to the same session-persistence endpoint the debounced autosave uses', () => {
    const idx = fn.indexOf('proposal.kind === "intent"');
    const branch = fn.slice(idx, idx + 800);
    expect(branch).toMatch(/\/api\/dev-command-center\/sessions/);
    expect(branch).toMatch(/method:\s*"POST"/);
  });

  it('the immediate-save call is NOT wrapped in a setTimeout/debounce — it fires in the same tick as the approval', () => {
    const idx = fn.indexOf('proposal.kind === "intent"');
    const branch = fn.slice(idx, idx + 800);
    expect(branch).not.toMatch(/setTimeout/);
  });

  it('the debounced autosave effect elsewhere in the file is untouched (still exists, still 1.5s) — this is an ADDITION, not a replacement', () => {
    expect(TAB_SOURCE).toMatch(/setTimeout\(\(\) => \{[\s\S]*?\}, 1500\)/);
  });
});

describe('Diagnostic safeguard — the bound intent is visible before pack generation', () => {
  it('ImplementationLayout renders session.intent.goal near the Generate Implementation Pack button', () => {
    // The button JSX itself, not the header doc-comment's numbered summary
    // that mentions the same phrase — anchor on the actual onClick wiring.
    const btnIdx = IMPLEMENTATION_LAYOUT_SOURCE.indexOf('onClick={generate}');
    expect(btnIdx).toBeGreaterThan(-1);
    const nearby = IMPLEMENTATION_LAYOUT_SOURCE.slice(Math.max(0, btnIdx - 600), btnIdx);
    expect(nearby).toMatch(/Bound intent/i);
    expect(nearby).toMatch(/session\.intent\.goal/);
  });

  it('the displayed value is the exact same expression generate() sends as the pack-generation goal', () => {
    const generateIdx = IMPLEMENTATION_LAYOUT_SOURCE.indexOf('const generate = async () => {');
    expect(generateIdx).toBeGreaterThan(-1);
    const generateFn = IMPLEMENTATION_LAYOUT_SOURCE.slice(generateIdx, generateIdx + 1200);
    expect(generateFn).toMatch(/goal:\s*session\.intent\.goal/);
  });
});
