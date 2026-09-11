/**
 * LOCAL RECEIPTS MUST HAVE INDEPENDENT LIVENESS INTO DVN SUBMISSION —
 * closes the "Receipt Created survivors" gap (Horizen Pilot Closure, "close
 * the DVN lifecycle completely", 2026-08-09).
 *
 * ── THE DEFECT THIS CLOSES ─────────────────────────────────────────────────
 *
 * `createActivityReceipt()` persists `receipt_status: 'local'` and then
 * invokes DVN submission through an UN-AWAITED background promise
 * (`enqueueActivityReceiptAnchor`) — latency-friendly for the hot path, but
 * not durable in a request/serverless environment: a receipt whose request
 * ended before that background work ran is stranded at `local` forever with
 * nothing left checking on it. Same "observability must not be the thing
 * providing liveness" failure shape as `finalizeReadyActivityReceipts`
 * closes one hop later (dvn_pending -> dvn_recorded) — see
 * tests/activity-receipts-finalizer-liveness.test.ts, whose exact pattern
 * this file mirrors for the local -> dvn_pending hop.
 *
 * The fix adds a NEW cron-token-gated route
 * (`app/api/ops/dvn/reconcile-local-receipts`) that calls the SAME,
 * unmodified `reconcileLocalReceiptsToDvn()` — which itself drives the
 * EXISTING `enqueueReceiptLeg` primitive, never a second submission
 * implementation — plus a scheduled workflow that drives it independently
 * of any request outliving its own background work.
 *
 * Source-scan style, matching tests/activity-receipts-finalizer-liveness.test.ts.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function read(relPath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

describe('the local-receipts DVN reconciler has independent (scheduled) liveness', () => {
  const workflow = read('.github/workflows/local-receipts-dvn-reconciler.yml');

  it('a scheduled workflow exists and drives the new reconcile-local-receipts route', () => {
    expect(workflow).toMatch(/schedule:/);
    expect(workflow).toMatch(/- cron:\s*'[^']+'/);
    expect(workflow).toContain('/api/ops/dvn/reconcile-local-receipts');
  });

  it('authenticates with CRON_TRIGGER_TOKEN — the same token every other /api/ops/* route checks, no new secret', () => {
    expect(workflow).toContain('CRON_TRIGGER_TOKEN');
    expect(workflow).toMatch(/x-cron-token/);
  });

  it('serialises runs — two concurrent runs could double-submit the same stranded receipt', () => {
    expect(workflow).toMatch(/concurrency:/);
    expect(workflow).toMatch(/cancel-in-progress:\s*false/);
  });

  it('is manually dispatchable, so an operator can force a run without waiting for the schedule', () => {
    expect(workflow).toMatch(/workflow_dispatch:/);
  });
});

describe('the new route is a thin cron-gated caller — never a second submission implementation', () => {
  const routeSource = read('app/api/ops/dvn/reconcile-local-receipts/route.ts');

  it('imports and calls the EXISTING reconcileLocalReceiptsToDvn — no parallel logic', () => {
    expect(routeSource).toContain(
      "import { reconcileLocalReceiptsToDvn } from '@/services/dvn/activityReceiptDvnPipeline'",
    );
    expect(routeSource).toMatch(/await reconcileLocalReceiptsToDvn\(\)/);
    // Never touches activity_receipts directly — that would be exactly the
    // parallel-implementation defect (inv.engineering.036/037) this route
    // exists to avoid.
    expect(routeSource).not.toMatch(/\.from\(['"]activity_receipts['"]\)/);
  });

  it('authenticates with CRON_TRIGGER_TOKEN before calling the reconciler — infra-driven, no persona session', () => {
    expect(routeSource).toContain('process.env.CRON_TRIGGER_TOKEN');
    expect(routeSource).toMatch(/x-cron-token/);
    expect(routeSource).not.toMatch(/getActivePersona/);
  });

  it('refuses (401) when the provided token does not match, and 503s when unconfigured', () => {
    expect(routeSource).toMatch(/status:\s*401/);
    expect(routeSource).toMatch(/status:\s*503/);
  });
});

describe('reconcileLocalReceiptsToDvn drives the EXISTING enqueueReceiptLeg primitive — never a second submit_dvn_message implementation', () => {
  const pipelineSource = read('services/dvn/activityReceiptDvnPipeline.ts');

  it('calls enqueueReceiptLeg(record, personaId, "dvn") — the same primitive the operator directive named', () => {
    const fnStart = pipelineSource.indexOf('export async function reconcileLocalReceiptsToDvn');
    expect(fnStart, 'reconcileLocalReceiptsToDvn is not defined').toBeGreaterThan(-1);
    const fnEnd = pipelineSource.indexOf('\n/**', fnStart + 10);
    const body = pipelineSource.slice(fnStart, fnEnd > -1 ? fnEnd : fnStart + 3000);
    expect(body).toMatch(/enqueueReceiptLeg\(record, personaId, 'dvn'\)/);
    // Never a second canister call in this function — submission stays
    // entirely inside the existing primitive.
    expect(body).not.toMatch(/submit_dvn_message/);
    expect(body).not.toMatch(/getActor</);
  });

  it('reads the local backlog via a dedicated finder — never a second raw query shape', () => {
    expect(pipelineSource).toContain('findLocalReceiptsPendingDvnAnchor');
  });
});
