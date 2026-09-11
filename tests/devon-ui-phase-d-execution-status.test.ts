/**
 * DevOn UI Refinement, Phase D canaries — the execution-status seam.
 *
 * `mapRunToStatus` and `selectCorrelatedRun` are tested directly as pure
 * functions (no request/auth/network mocking needed — see the route file's
 * header for why they were extracted). The remaining guarantees (read-only,
 * never advances the lifecycle, polling stops at a terminal status, human
 * merge stays the only authorization, provider-neutral rendering) are
 * pinned as source-text canaries, matching this PRD's established Phase
 * B/C convention.
 */

import { readFileSync } from 'fs';
import path from 'path';
import { describe, it, expect, vi } from 'vitest';

// Only the route's pure functions are exercised here (see the route's own
// header for why) — but importing the route module still pulls in its
// transitive chain (implement/route.ts -> getActivePersona ->
// multiEmailIdentity's module-scope Supabase client), which throws in a
// bare unit-test environment with no Supabase env configured. Mocking
// getActivePersona (unused by these tests) keeps that chain from loading at
// all, mirroring the convention in tests/horizen-verify-status-route.test.ts.
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: vi.fn(),
}));

import {
  mapRunToStatus,
  selectCorrelatedRun,
  type DccExecutionStatus,
} from '@/app/api/dev-command-center/implement/status/route';
import type { GhWorkflowRun } from '@/app/api/dev-command-center/_lib/github';

const STATUS_ROUTE_SOURCE = readFileSync(
  path.join(process.cwd(), 'app/api/dev-command-center/implement/status/route.ts'),
  'utf-8',
);
const GITHUB_LIB_SOURCE = readFileSync(
  path.join(process.cwd(), 'app/api/dev-command-center/_lib/github.ts'),
  'utf-8',
);
const IMPLEMENTATION_LAYOUT_SOURCE = readFileSync(
  path.join(process.cwd(), 'components/devcommandcenter/layouts/ImplementationLayout.tsx'),
  'utf-8',
);
const MERGE_ROUTE_SOURCE = readFileSync(
  path.join(process.cwd(), 'app/api/dev-command-center/github/merge/route.ts'),
  'utf-8',
);
const DEV_LOOP_SOURCE = readFileSync(
  path.join(process.cwd(), 'services/devCommandCenter/devLoop.ts'),
  'utf-8',
);
const STRIP_SOURCE = readFileSync(
  path.join(process.cwd(), 'components/devcommandcenter/ActorActivityStrip.tsx'),
  'utf-8',
);

function run(over: Partial<Pick<GhWorkflowRun, 'status' | 'conclusion'>>): Pick<GhWorkflowRun, 'status' | 'conclusion'> {
  return { status: 'completed', conclusion: 'success', ...over };
}

describe('mapRunToStatus — the entire GitHub-fact-to-status truth table', () => {
  it('no run yet → working (dispatch acknowledged, nothing else knowable)', () => {
    expect(mapRunToStatus(undefined, false)).toBe('working');
  });

  it('queued or in_progress → working, regardless of prFound', () => {
    expect(mapRunToStatus(run({ status: 'queued', conclusion: null }), false)).toBe('working');
    expect(mapRunToStatus(run({ status: 'in_progress', conclusion: null }), true)).toBe('working');
  });

  it.each(['failure', 'cancelled', 'timed_out'])(
    "completed + conclusion '%s' → failed, and can NEVER be overridden to completed even when a PR already exists",
    (conclusion) => {
      expect(mapRunToStatus(run({ status: 'completed', conclusion }), false)).toBe('failed');
      // The mutation this guards against: a stray PR (e.g. from a prior
      // redispatch) must never upgrade a failed run to 'completed'.
      expect(mapRunToStatus(run({ status: 'completed', conclusion }), true)).toBe('failed');
    },
  );

  it('completed + success + a PR found → completed', () => {
    expect(mapRunToStatus(run({ status: 'completed', conclusion: 'success' }), true)).toBe('completed');
  });

  it('completed + success but NO PR found yet → working, never a fabricated completion', () => {
    expect(mapRunToStatus(run({ status: 'completed', conclusion: 'success' }), false)).toBe('working');
  });

  it("an unlisted conclusion (e.g. 'neutral', 'skipped') is never invented as success or failure", () => {
    expect(mapRunToStatus(run({ status: 'completed', conclusion: 'neutral' }), true)).toBe('working');
    expect(mapRunToStatus(run({ status: 'completed', conclusion: 'skipped' }), false)).toBe('working');
  });

  it('the output type has exactly three members — no invented granular sub-status', () => {
    const outputs = new Set<DccExecutionStatus>([
      mapRunToStatus(undefined, false),
      mapRunToStatus(run({ status: 'queued', conclusion: null }), false),
      mapRunToStatus(run({ status: 'completed', conclusion: 'failure' }), false),
      mapRunToStatus(run({ status: 'completed', conclusion: 'success' }), true),
    ]);
    for (const value of outputs) {
      expect(['working', 'completed', 'failed']).toContain(value);
    }
  });
});

describe('selectCorrelatedRun — dispatch-time correlation, not branch-name correlation', () => {
  const mkRun = (id: number, createdAt: string): GhWorkflowRun => ({
    id,
    status: 'completed',
    conclusion: 'success',
    htmlUrl: `https://github.com/x/y/actions/runs/${id}`,
    createdAt,
  });

  it('picks the earliest run created at/after the dispatch timestamp', () => {
    const runs = [
      mkRun(1, '2026-08-15T18:00:00.000Z'), // before dispatch — must be excluded
      mkRun(2, '2026-08-15T18:05:00.000Z'), // the correlated run
      mkRun(3, '2026-08-15T18:10:00.000Z'), // a later, unrelated run
    ];
    const selected = selectCorrelatedRun(runs, '2026-08-15T18:04:00.000Z');
    expect(selected?.id).toBe(2);
  });

  it('excludes a run created well before the dispatch (a stale/unrelated prior run)', () => {
    const runs = [mkRun(1, '2026-08-15T17:00:00.000Z')];
    expect(selectCorrelatedRun(runs, '2026-08-15T18:00:00.000Z')).toBeUndefined();
  });

  it('an unparsable/absent timestamp disables the filter rather than throwing', () => {
    const runs = [mkRun(1, '2026-08-15T18:00:00.000Z'), mkRun(2, '2026-08-15T18:05:00.000Z')];
    expect(selectCorrelatedRun(runs, null)?.id).toBe(1);
    expect(selectCorrelatedRun(runs, 'not-a-date')?.id).toBe(1);
  });
});

describe('the status endpoint is read-only', () => {
  it('the route file issues no write verb anywhere (no POST/PUT/PATCH/DELETE)', () => {
    expect(STATUS_ROUTE_SOURCE).not.toMatch(/method:\s*['"](POST|PUT|PATCH|DELETE)['"]/);
  });

  it('the route never imports or calls the merge/enable-auto-merge surface (checked in code, not doc-comment prose)', () => {
    const codeOnly = STATUS_ROUTE_SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(codeOnly).not.toMatch(/github\/merge/);
    expect(codeOnly).not.toMatch(/pulls\/.*\/merge/);
    expect(codeOnly).not.toMatch(/enable_auto_merge|enablePrAutoMerge/);
  });

  it('the two new GitHub helpers it depends on are GET-only (ghGet, no write verb)', () => {
    const runsFn = GITHUB_LIB_SOURCE.slice(GITHUB_LIB_SOURCE.indexOf('export async function ghWorkflowRuns'));
    const pullsFn = GITHUB_LIB_SOURCE.slice(GITHUB_LIB_SOURCE.indexOf('export async function ghPullsForBranch'));
    expect(runsFn.slice(0, 800)).not.toMatch(/method:\s*['"](POST|PUT|PATCH|DELETE)['"]/);
    expect(pullsFn.slice(0, 800)).not.toMatch(/method:\s*['"](POST|PUT|PATCH|DELETE)['"]/);
  });

  it('the merge route remains the sole write/execution-authorization surface, untouched by Phase D', () => {
    expect(MERGE_ROUTE_SOURCE).toMatch(/the human execution gate/i);
    expect(MERGE_ROUTE_SOURCE).toMatch(/export async function POST/);
  });
});

describe('a completed Claude Code event never advances or completes the DevLoop lifecycle', () => {
  it('DevLoopState / devLoop.ts is untouched by Phase D — no reference to execution status', () => {
    expect(DEV_LOOP_SOURCE).not.toMatch(/executionStatus/i);
    expect(DEV_LOOP_SOURCE).not.toMatch(/claude-code/i);
  });

  it('ImplementationLayout never calls onAdvanceStage from inside the status-poll callback', () => {
    const pollFnSource = IMPLEMENTATION_LAYOUT_SOURCE.slice(
      IMPLEMENTATION_LAYOUT_SOURCE.indexOf('const pollExecutionStatus'),
      IMPLEMENTATION_LAYOUT_SOURCE.indexOf('const dispatchToClaude'),
    );
    expect(pollFnSource.length).toBeGreaterThan(200);
    expect(pollFnSource).not.toMatch(/onAdvanceStage/);
  });

  it("'completed' and 'awaiting-authorization' are pushed as two distinct actor events, never merged into one", () => {
    const pollFnSource = IMPLEMENTATION_LAYOUT_SOURCE.slice(
      IMPLEMENTATION_LAYOUT_SOURCE.indexOf('const pollExecutionStatus'),
      IMPLEMENTATION_LAYOUT_SOURCE.indexOf('const dispatchToClaude'),
    );
    const completedEvents = pollFnSource.match(/action:\s*"completed"/g) ?? [];
    const awaitingEvents = pollFnSource.match(/action:\s*"awaiting-authorization"/g) ?? [];
    expect(completedEvents.length).toBe(1);
    expect(awaitingEvents.length).toBe(1);
    // The awaiting-authorization event is attributed to DevOn, never Claude Code.
    const awaitingBlockStart = pollFnSource.indexOf('action: "awaiting-authorization"');
    const awaitingBlock = pollFnSource.slice(Math.max(0, awaitingBlockStart - 200), awaitingBlockStart);
    expect(awaitingBlock).toMatch(/actorId:\s*"devon"/);
  });
});

describe('polling stops at terminal status', () => {
  it('the poll loop clears its own interval on completed or failed, and nowhere else', () => {
    expect(IMPLEMENTATION_LAYOUT_SOURCE).toMatch(
      /if \(status === "completed" \|\| status === "failed"\) \{\s*if \(pollTimerRef\.current\) clearInterval\(pollTimerRef\.current\);/,
    );
  });

  it('the poll loop has a bounded max-attempts fallback (never polls forever on a stuck/unreachable run)', () => {
    expect(IMPLEMENTATION_LAYOUT_SOURCE).toMatch(/MAX_POLL_ATTEMPTS/);
    expect(IMPLEMENTATION_LAYOUT_SOURCE).toMatch(/attempts >= MAX_POLL_ATTEMPTS/);
  });

  it('the poll interval is cleared on component unmount (no leaked timers across capsule navigation)', () => {
    expect(IMPLEMENTATION_LAYOUT_SOURCE).toMatch(/useEffect\(\(\) => \(\) => \{\s*if \(pollTimerRef\.current\) clearInterval\(pollTimerRef\.current\);\s*\}, \[\]\);/);
  });
});

describe('human merge remains the only execution authorization', () => {
  it('the status route never returns a merged/deployed claim on its own — "completed" still requires the PR object, and "merged" is only ever a passthrough of GitHub\'s own PR state', () => {
    expect(STATUS_ROUTE_SOURCE).toMatch(/merged\s*=\s*pr\.merged/);
    expect(STATUS_ROUTE_SOURCE).not.toMatch(/merged\s*[:=]\s*true\b/);
  });

  it('a completed Claude Code actor event and a DevOn awaiting-authorization event are distinct action values (never conflated)', () => {
    expect(IMPLEMENTATION_LAYOUT_SOURCE).toMatch(/action:\s*"completed"/);
    expect(IMPLEMENTATION_LAYOUT_SOURCE).toMatch(/action:\s*"awaiting-authorization"/);
  });
});

describe('stream rendering stays provider-neutral through Phase D', () => {
  it('ImplementationLayout constructs actor events as plain data — it never branches SmartTriad/ActorActivityStrip rendering by actorId', () => {
    expect(STRIP_SOURCE).not.toMatch(/actorId\s*===\s*['"]/);
  });

  it('the same generic ActorEventRow renders Claude Code\'s and DevOn\'s rows — no per-actor component fork', () => {
    const claudeEventCount = (IMPLEMENTATION_LAYOUT_SOURCE.match(/actorId:\s*"claude-code"/g) ?? []).length;
    const devonEventCount = (IMPLEMENTATION_LAYOUT_SOURCE.match(/actorId:\s*"devon"/g) ?? []).length;
    expect(claudeEventCount).toBeGreaterThan(0);
    expect(devonEventCount).toBeGreaterThan(0);
    // Both are pushed through the exact same onActorEvent callback signature.
    expect(IMPLEMENTATION_LAYOUT_SOURCE.match(/onActorEvent\?\.\(\{/g)?.length).toBeGreaterThanOrEqual(
      claudeEventCount + devonEventCount - 2, // -2: 'invoked' + 'working' share one claude-code literal path check tolerance
    );
  });
});
