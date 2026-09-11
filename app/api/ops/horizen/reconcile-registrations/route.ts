import { NextRequest, NextResponse } from 'next/server';
import { reconcilePendingAgentRegistrations } from '@/services/horizen/registrationReconciliation';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/ops/horizen/reconcile-registrations
 *
 * Infra-scheduled counterpart to the interactive
 * /api/journey/moneypenny-horizen/register/status route. Calls the SAME
 * checkAgentRegistrationStatus() — no new confirmation logic, no rebroadcast.
 *
 * Exists because that check had exactly one caller repo-wide: a browser poll
 * capped at 160 seconds (RegisterAgentPanel.tsx). Once that poll gives up —
 * page close, disconnect, or a deploy mid-poll — a broadcast registration had
 * nothing left checking on it. Same defect class, and same fix, as the one
 * already closed for activity-receipts finalization by
 * .github/workflows/activity-receipts-finalizer.yml.
 *
 * Auth: CRON_TRIGGER_TOKEN, same convention and same secret as
 * /api/ops/dvn/finalize-activity-receipts and /api/ops/sync/cron-tick — this
 * route is infra-driven; the persona spine doesn't apply.
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

  const result = await reconcilePendingAgentRegistrations();
  return NextResponse.json(result, {
    status: result.ok ? 200 : 500,
    headers: { 'Cache-Control': 'no-store' },
  });
}

/** GET shows the last invocation's shape — handy for cron validation. */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      method: 'POST',
      description:
        'Infra-scheduled reconciler for pending Horizen agent registrations (horizen_registration_submitted ' +
        'with no matching horizen_agent_registered receipt yet). Requires x-cron-token header (CRON_TRIGGER_TOKEN).',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
