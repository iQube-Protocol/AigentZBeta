import { NextRequest, NextResponse } from 'next/server';
import { getDvnCanisterActor, countDvnPendingMessages, processPendingDvnAttestations } from '@/services/ops/dvnAttestationProcessor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/ops/dvn/attestation-processor-cron
 *
 * Closes the structural gap Horizen Pilot Closure Part B2 (2026-08-09)
 * names explicitly: the ONLY code path that calls `dvn.submit_attestation`
 * (the `process_pending` action, now `processPendingDvnAttestations` in
 * services/ops/dvnAttestationProcessor.ts) had ZERO scheduled trigger.
 * `.github/workflows/dvn-reconciler.yml` -> `/api/ops/sync/cron-tick` is a
 * DIFFERENT, PoS/Bitcoin-anchor-only reconciler — it reads
 * `dvn.get_pending_messages()` solely to compute drift for telemetry and
 * decides its own "idle" branch purely from `pos.get_pending_count() === 0`.
 * It never calls `submit_attestation`. That is why hundreds of DVN-pending
 * messages could sit unattested indefinitely alongside a healthy,
 * successfully-ticking cron-tick — the historically-only path that drained
 * them was the removed client-side /ops auto-repair loop (see
 * hooks/ops/useSyncStatus.ts's own note).
 *
 * This route gives that EXISTING, unmodified processor its own liveness,
 * driven from DVN pending state — never PoS pending count, per the
 * operator's explicit instruction. It is a thin cron-gated caller, not a
 * second implementation: all submit_attestation logic lives in
 * dvnAttestationProcessor.ts and is shared with the operator-UI route
 * (app/api/ops/layerzero/process).
 *
 * ── SEQUENCING (Part B3 — confirmed, 2026-08-09) ─────────────────────────
 *
 * Nothing about validatorId generation, signature generation, batch size,
 * or attestation semantics changed here. The operator ran one bounded
 * workflow_dispatch pass against the live canister first
 * ({"processed":10,"rejected":0,"failed":0,"canisterErrors":[]}) before the
 * corresponding workflow (.github/workflows/dvn-attestation-processor.yml)
 * was given a `schedule:` trigger — see that workflow's own header for the
 * observed response.
 *
 * The current validator/signature substrate is test-grade
 * (`validator_<ts>_<id>` / `sig_<id>_<ts>` bytes) — the dev/pilot
 * validator substrate, not production independent-validator cryptography.
 * This route does not change that; it only gives the existing substrate
 * scheduled liveness once confirmed acceptable.
 *
 * Auth: CRON_TRIGGER_TOKEN, same convention as cron-tick and the
 * finalizer — this route is infra-driven, never called from the browser.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const expected = process.env.CRON_TRIGGER_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: 'cron_token_not_configured' }, { status: 503 });
  }
  const provided =
    request.headers.get('x-cron-token') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (provided !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const dvn = await getDvnCanisterActor();
    const pendingCount = await countDvnPendingMessages(dvn);

    if (pendingCount === 0) {
      return NextResponse.json(
        { ok: true, idle: true, pendingBeforeRun: 0, at: new Date().toISOString() },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const result = await processPendingDvnAttestations(dvn);
    return NextResponse.json(
      { ...result, idle: false, pendingBeforeRun: pendingCount },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

/** GET shows what this route does — handy for verification without a POST. */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      method: 'POST',
      description:
        'Cron-driven DVN attestation processor. Checks dvn.get_pending_messages() count (never PoS pending) and, ' +
        'if non-zero, calls the SAME processPendingDvnAttestations() the operator /ops console\'s "Process via ' +
        'LayerZero" button uses. Requires x-cron-token header (CRON_TRIGGER_TOKEN).',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
