/**
 * ACTIVITY-RECEIPTS FINALIZER MUST HAVE INDEPENDENT LIVENESS — closes
 * discrepancy-register finding O-2 (operator directive, 2026-08-08).
 *
 * ── THE DEFECT THIS CLOSES ─────────────────────────────────────────────────
 *
 * `finalizeReadyActivityReceipts()` (services/dvn/activityReceiptDvnPipeline.ts)
 * flips `activity_receipts.receipt_status` from `dvn_pending` -> `dvn_recorded`
 * once the DVN canister reports the message ready. Before this change it had
 * exactly one caller repo-wide: the manual admin route
 * `app/api/admin/activity-receipts/finalize`. Nobody clicking that button
 * meant DVN-minted evidence for the receipts the Horizen journey and
 * `ActivityReceiptCard` read sat at `dvn_pending` indefinitely — the same
 * "observability provides liveness" failure shape already closed for the
 * PoS/anchor tick by `.github/workflows/dvn-reconciler.yml`
 * (see tests/observability-does-not-provide-liveness.test.ts), just on a
 * different table.
 *
 * The fix adds a NEW cron-token-gated route
 * (`app/api/ops/dvn/finalize-activity-receipts`) that calls the SAME,
 * unmodified `finalizeReadyActivityReceipts()` — no second implementation —
 * plus a scheduled workflow that drives it independently of any browser or
 * admin click.
 *
 * Source-scan style, matching tests/observability-does-not-provide-liveness.test.ts.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function read(relPath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

describe('the activity-receipts finalizer has independent (scheduled) liveness', () => {
  const workflow = read('.github/workflows/activity-receipts-finalizer.yml');

  it('a scheduled workflow exists and drives the new finalize-activity-receipts route', () => {
    expect(workflow).toMatch(/schedule:/);
    expect(workflow).toMatch(/- cron:\s*'[^']+'/);
    expect(workflow).toContain('/api/ops/dvn/finalize-activity-receipts');
  });

  it('authenticates with CRON_TRIGGER_TOKEN — the same token cron-tick checks, no new secret', () => {
    expect(workflow).toContain('CRON_TRIGGER_TOKEN');
    expect(workflow).toMatch(/x-cron-token/);
  });

  it('serialises runs — two concurrent runs could double-process the same pending set', () => {
    expect(workflow).toMatch(/concurrency:/);
    expect(workflow).toMatch(/cancel-in-progress:\s*false/);
  });

  it('is manually dispatchable, so an operator can force a run without waiting for the schedule', () => {
    expect(workflow).toMatch(/workflow_dispatch:/);
  });
});

describe('the new route is a thin cron-gated caller — never a second finalizer implementation', () => {
  const routeSource = read('app/api/ops/dvn/finalize-activity-receipts/route.ts');

  it('imports and calls the EXISTING finalizeReadyActivityReceipts — no parallel logic', () => {
    expect(routeSource).toContain(
      "import { finalizeReadyActivityReceipts } from '@/services/dvn/activityReceiptDvnPipeline'",
    );
    expect(routeSource).toMatch(/await finalizeReadyActivityReceipts\(\)/);
    // Never touches activity_receipts directly — that would be exactly the
    // parallel-implementation defect (inv.engineering.036/037) this route
    // exists to avoid.
    expect(routeSource).not.toMatch(/\.from\(['"]activity_receipts['"]\)/);
  });

  it('authenticates with CRON_TRIGGER_TOKEN before calling the finalizer — infra-driven, no persona session', () => {
    expect(routeSource).toContain('process.env.CRON_TRIGGER_TOKEN');
    expect(routeSource).toMatch(/x-cron-token/);
    expect(routeSource).not.toMatch(/getActivePersona/);
  });

  it('refuses (401) when the provided token does not match, and 503s when unconfigured', () => {
    expect(routeSource).toMatch(/status:\s*401/);
    expect(routeSource).toMatch(/status:\s*503/);
  });
});
