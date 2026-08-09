/**
 * DVN ATTESTATION PROCESSING MUST HAVE INDEPENDENT LIVENESS, DRIVEN FROM DVN
 * PENDING STATE — closes the gap named explicitly in Horizen Pilot Closure,
 * Part B2 (operator directive, 2026-08-09).
 *
 * ── THE DEFECT THIS CLOSES ─────────────────────────────────────────────────
 *
 * `.github/workflows/dvn-reconciler.yml` -> `/api/ops/sync/cron-tick` is a
 * PoS/Bitcoin-anchor reconciler. It reads `dvn.get_pending_messages()` only
 * to compute drift for telemetry, and its "idle" branch is driven purely by
 * `pos.get_pending_count() === 0` — it never calls
 * `dvn.submit_attestation()`. The ONLY code path that does
 * (`processPendingDvnAttestations`, services/ops/dvnAttestationProcessor.ts,
 * extracted from the former inline `process_pending` action in
 * app/api/ops/layerzero/process/route.ts) had ZERO scheduled trigger before
 * this workflow — hundreds of DVN-pending messages could accumulate
 * indefinitely alongside a healthy, successfully-ticking dvn-reconciler.
 *
 * Source-scan style, matching tests/activity-receipts-finalizer-liveness.test.ts.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function read(relPath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

describe('the DVN attestation processor is reachable via a dedicated cron-gated route', () => {
  const routeSource = read('app/api/ops/dvn/attestation-processor-cron/route.ts');

  // Code lines only — the module header legitimately explains the defect
  // in prose (naming `submit_attestation` and `get_pending_count`) while
  // documenting why this route never calls them directly.
  const codeLines = routeSource
    .split('\n')
    .filter((line) => !line.trim().startsWith('*') && !line.trim().startsWith('//'));
  const codeOnly = codeLines.join('\n');

  it('imports and calls the EXISTING shared processor — no parallel submit_attestation implementation', () => {
    expect(routeSource).toContain(
      "import { getDvnCanisterActor, countDvnPendingMessages, processPendingDvnAttestations } from '@/services/ops/dvnAttestationProcessor'",
    );
    expect(routeSource).toMatch(/await processPendingDvnAttestations\(dvn\)/);
    expect(codeOnly).not.toMatch(/submit_attestation/);
  });

  it('decides liveness from DVN pending count, never PoS', () => {
    expect(routeSource).toMatch(/await countDvnPendingMessages\(dvn\)/);
    expect(codeOnly).not.toMatch(/get_pending_count/);
  });

  it('authenticates with CRON_TRIGGER_TOKEN — infra-driven, never a persona session', () => {
    expect(routeSource).toContain('process.env.CRON_TRIGGER_TOKEN');
    expect(routeSource).toMatch(/x-cron-token/);
    expect(routeSource).not.toMatch(/getActivePersona/);
  });

  it('refuses (401) when the provided token does not match, and 503s when unconfigured', () => {
    expect(routeSource).toMatch(/status:\s*401/);
    expect(routeSource).toMatch(/status:\s*503/);
  });
});

describe('the shared processor is the ONE place submit_attestation is called', () => {
  const serviceSource = read('services/ops/dvnAttestationProcessor.ts');
  const opsRouteSource = read('app/api/ops/layerzero/process/route.ts');

  it('the service owns submit_attestation; the operator-UI route delegates to it rather than reimplementing it', () => {
    expect(serviceSource).toMatch(/await dvn\.submit_attestation\(/);
    expect(opsRouteSource).not.toMatch(/dvn\.submit_attestation/);
    expect(opsRouteSource).toContain(
      "import { processPendingDvnAttestations } from '@/services/ops/dvnAttestationProcessor'",
    );
    expect(opsRouteSource).toMatch(/await processPendingDvnAttestations\(dvn\)/);
  });

  it('the extraction did not change validatorId/signature generation or batch size', () => {
    expect(serviceSource).toMatch(/`validator_\$\{Date\.now\(\)\}_\$\{messageId\}`/);
    expect(serviceSource).toMatch(/`sig_\$\{messageId\}_\$\{Date\.now\(\)\}`/);
    expect(serviceSource).toMatch(/DVN_ATTESTATION_BATCH_SIZE\s*=\s*10/);
  });
});

describe('the workflow gives the processor liveness, without pre-emptively scheduling it', () => {
  const workflow = read('.github/workflows/dvn-attestation-processor.yml');

  it('drives the new attestation-processor-cron route with CRON_TRIGGER_TOKEN', () => {
    expect(workflow).toContain('/api/ops/dvn/attestation-processor-cron');
    expect(workflow).toContain('CRON_TRIGGER_TOKEN');
    expect(workflow).toMatch(/x-cron-token/);
  });

  it('is manually dispatchable, so the operator can run the required B3 bounded pass', () => {
    expect(workflow).toMatch(/workflow_dispatch:/);
  });

  it('serialises runs — two concurrent passes could double-submit against the same pending set', () => {
    expect(workflow).toMatch(/concurrency:/);
    expect(workflow).toMatch(/cancel-in-progress:\s*false/);
  });
});

describe('the two DVN-mutating operator-UI routes are no longer unauthenticated', () => {
  it('/api/ops/layerzero/process gates on requireOpsAuth', () => {
    const src = read('app/api/ops/layerzero/process/route.ts');
    expect(src).toContain("import { requireOpsAuth } from '@/services/ops/opsAuth'");
    expect(src).toMatch(/const auth = await requireOpsAuth\(request\)/);
    expect(src).toMatch(/if \(!auth\.ok\) return auth\.response!;/);
  });

  it('/api/ops/dvn/attest gates on requireOpsAuth', () => {
    const src = read('app/api/ops/dvn/attest/route.ts');
    expect(src).toContain("import { requireOpsAuth } from '@/services/ops/opsAuth'");
    expect(src).toMatch(/const auth = await requireOpsAuth\(req\)/);
    expect(src).toMatch(/if \(!auth\.ok\) return auth\.response!;/);
  });

  it('opsAuth accepts cron-token OR admin persona, and never grants access with neither', () => {
    const src = read('services/ops/opsAuth.ts');
    expect(src).toContain('CRON_TRIGGER_TOKEN');
    expect(src).toContain('cartridgeFlags?.isAdmin');
    // The cron-token branch must require `expected` to be truthy — an
    // unconfigured secret must never silently authorise every caller.
    expect(src).toMatch(/if \(expected && provided === expected\)/);
  });
});
