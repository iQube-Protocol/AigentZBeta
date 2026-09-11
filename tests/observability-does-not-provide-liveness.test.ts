/**
 * OBSERVABILITY MUST NOT PROVIDE LIVENESS (operator ruling, 2026-08-08).
 *
 * ── THE DEFECT THIS CLOSES ─────────────────────────────────────────────────
 *
 * `hooks/ops/useSyncStatus.ts`'s `load()` used to trigger `repair('auto')` —
 * and through it `processLayerZero('process_pending')` — whenever it observed
 * `drift > 0 && !isLegitimate`. Because the hook mounts a timer on mount,
 * MERELY OPENING /ops reconciled the constitutional receipt spine, and closing
 * /ops stopped it. Observed live: 710 pending DVN messages / drift 710 with the
 * page closed, collapsing to 0 within minutes of opening it.
 *
 * It was worse than a poll: `repair()` and `processLayerZero()` each ended with
 * `await load()`, and `load()` re-triggered `repair()` — an unbounded mutual
 * recursion that drained the queue as fast as the network allowed. The drain
 * was an accidental side effect of a recursion bug, not designed reconciliation.
 *
 * Liveness now belongs to /api/ops/sync/cron-tick — an endpoint written for
 * exactly this purpose ("Replaces the client-driven auto-process loop in
 * hooks/ops/useSyncStatus.ts which only ran when a browser had /ops open") that
 * had been built, tested, and never given a scheduler.
 *
 * Source-scan style, matching this repo's existing canary convention (e.g.
 * tests/pulse-plnl-split-and-correlation-trace.test.ts) — no React rendering
 * harness is set up in this codebase.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { readSource, stripComments } from './_lib/sourceAuthority';

function read(relPath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

/**
 * CODE, NOT PROSE ABOUT CODE. Comments are stripped before matching — this
 * file's own subject matter means the source is full of doc comments that
 * QUOTE the very calls these canaries forbid (`await load()`, `repair(`), and
 * matching against raw text made an explanatory comment indistinguishable
 * from a reintroduced defect. `stripComments` is this repo's existing helper
 * for exactly that (tests/_lib/sourceAuthority.ts), used by
 * tests/register-ceremony.test.ts among others.
 */
const hookSource = stripComments(readSource('hooks/ops/useSyncStatus.ts'));

/** The body of `load()` alone — the function the mount timer calls. */
function loadBody(): string {
  const start = hookSource.indexOf('async function load()');
  expect(start, 'useSyncStatus must still declare load()').toBeGreaterThan(-1);
  // load() is followed by the repair() declaration; slice between them.
  const end = hookSource.indexOf('async function repair(', start);
  expect(end, 'repair() must follow load()').toBeGreaterThan(start);
  return hookSource.slice(start, end);
}

describe('useSyncStatus.load() is READ-ONLY — it never mutates the spine', () => {
  it('never calls repair(), the auto-repair trigger that made an open browser the reconciler', () => {
    expect(loadBody()).not.toMatch(/\brepair\s*\(/);
  });

  it('never calls processLayerZero(), which submits attestations to the DVN canister', () => {
    expect(loadBody()).not.toMatch(/\bprocessLayerZero\s*\(/);
  });

  it('never branches on drift/isLegitimate to decide whether to act — observing a drift is not authority to repair it', () => {
    const body = loadBody();
    expect(body).not.toMatch(/drift\s*>\s*0/);
    expect(body).not.toMatch(/isLegitimate/);
  });

  it('issues exactly one request, to the read-only status endpoint, and no POST', () => {
    const body = loadBody();
    const fetches = body.match(/fetch\(/g) ?? [];
    expect(fetches).toHaveLength(1);
    expect(body).toContain("/api/ops/sync/status");
    expect(body).not.toMatch(/method:\s*'POST'/);
  });
});

describe('the mutation helpers do not re-enter load() — the recursion is gone', () => {
  function bodyOf(fnDecl: string, nextDecl: string): string {
    const start = hookSource.indexOf(fnDecl);
    expect(start, `${fnDecl} must exist`).toBeGreaterThan(-1);
    const end = hookSource.indexOf(nextDecl, start);
    return hookSource.slice(start, end > start ? end : undefined);
  }

  it('repair() does not call load()', () => {
    // `load()` inside `repair()` re-entered the auto-repair branch, which
    // called `repair()` again — the unbounded loop. A manual caller that wants
    // a refreshed view calls refresh() itself (ops/page.tsx's handleRepair does).
    expect(bodyOf('async function repair(', 'async function processLayerZero(')).not.toMatch(/\bawait load\(\)/);
  });

  it('processLayerZero() does not call load()', () => {
    expect(bodyOf('async function processLayerZero(', 'useEffect(')).not.toMatch(/\bawait load\(\)/);
  });

  it('repair() and processLayerZero() are still EXPORTED — manual operator control is retained, only automatic invocation was removed', () => {
    // The ruling is that /ops may still manually stimulate recovery; it may
    // just never be the thing providing liveness. Removing these entirely
    // would over-correct and take away the operator's own controls.
    expect(hookSource).toMatch(/return\s*\{[\s\S]*\brepair\b[\s\S]*\}/);
    expect(hookSource).toMatch(/return\s*\{[\s\S]*\bprocessLayerZero\b[\s\S]*\}/);
  });
});

describe('the server-side reconciler has independent liveness', () => {
  const workflow = read('.github/workflows/dvn-reconciler.yml');

  it('a scheduled workflow exists and drives the EXISTING cron-tick endpoint — never a second DVN implementation', () => {
    expect(workflow).toMatch(/schedule:/);
    expect(workflow).toMatch(/- cron:\s*'[^']+'/);
    expect(workflow).toContain('/api/ops/sync/cron-tick');
  });

  it('authenticates with CRON_TRIGGER_TOKEN, the token cron-tick actually checks', () => {
    // cron-tick reads `x-cron-token` (or a Bearer authorization header) and
    // compares against process.env.CRON_TRIGGER_TOKEN.
    expect(workflow).toContain('CRON_TRIGGER_TOKEN');
    expect(workflow).toMatch(/x-cron-token/);
  });

  it('serialises ticks — two concurrent runs could double-batch the same pending set', () => {
    expect(workflow).toMatch(/concurrency:/);
    expect(workflow).toMatch(/cancel-in-progress:\s*false/);
  });

  it('is manually dispatchable, so an operator can force a tick without waiting for the schedule', () => {
    expect(workflow).toMatch(/workflow_dispatch:/);
  });
});
