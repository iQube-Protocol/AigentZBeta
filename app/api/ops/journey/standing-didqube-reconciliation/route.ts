import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { requireAdminPersona } from '@/app/api/_lib/requireAdmin';
import { reconcileStandingDiDQubeResolution } from '@/services/standing/didQubeReconciliation';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/ops/journey/standing-didqube-reconciliation
 *
 * DiDQube Phase 4 item 5 (2026-09-07, execution plan) — Standing/reputation's
 * REQUIRED dry-run reconciliation, exposed as an on-demand, READ-ONLY admin
 * route (mirroring the existing reconcile-provider-standing-attribution
 * route's own dual-auth shape). Never writes anything: reports, for every
 * canonical agent Standing identity (personas rows with
 * app_origin='aigent-canonical-standing'), whether its underlying
 * agent_root_identity anchor cleanly resolves through resolveDiDQube.
 *
 * "The highest-care item in this phase: must preserve existing attribution
 * exactly... Build and run a dry-run reconciliation report before writing
 * anything, and get explicit operator sign-off on any row where the report
 * shows a discrepancy." This route IS that dry-run report, runnable at any
 * time by an operator — it does not itself decide what to do about a
 * discrepancy; it only surfaces one honestly.
 *
 * Auth: same dual path as reconcile-provider-standing-attribution — either
 * an x-cron-token/Bearer CRON_TRIGGER_TOKEN header (headless/automation) or
 * an authenticated admin persona session via requireAdminPersona.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const cronExpected = process.env.CRON_TRIGGER_TOKEN;
  const cronProvided =
    request.headers.get('x-cron-token') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const isCronAuthorized = Boolean(cronExpected) && cronProvided === cronExpected;

  if (!isCronAuthorized) {
    const isAdmin = await requireAdminPersona(request);
    if (!isAdmin) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 403 });
    }
  }

  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json({ error: 'db unavailable' }, { status: 503 });
  }

  try {
    const report = await reconcileStandingDiDQubeResolution(admin);
    return NextResponse.json({ ok: true, report }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
