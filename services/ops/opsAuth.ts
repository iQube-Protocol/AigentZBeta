import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';

export interface OpsAuthResult {
  ok: boolean;
  via?: 'cron-token' | 'admin-persona';
  response?: NextResponse;
}

/**
 * Dual-path auth for the small set of /api/ops/** routes that are called
 * BOTH by an infra scheduler AND directly from the operator /ops console
 * (Horizen Pilot Closure — Final Standing + DVN Closure, Part B2,
 * 2026-08-09: "secure /api/ops/layerzero/process and /api/ops/dvn/attest...
 * preserve operator UI use, require admin-auth or CRON_TRIGGER_TOKEN as
 * appropriate").
 *
 * This is deliberately NOT the same convention as the cron-token-ONLY
 * routes (cron-tick, finalize-activity-receipts, reconcile-local-receipts,
 * agent-forensics, correct-premature-standing-seed) — those are never
 * called from a browser, so a persona-session fallback would be pointless
 * surface area. `process` and `attest` are different: they are the two
 * DVN-mutating routes the operator /ops console calls directly, and before
 * this change they had NO auth gate at all.
 *
 * Accepts EITHER:
 *   - a valid CRON_TRIGGER_TOKEN (x-cron-token header, or Bearer) — the
 *     existing infra convention, unchanged; or
 *   - an authenticated admin persona (`getActivePersona` ->
 *     `cartridgeFlags.isAdmin`) — the SAME check
 *     `app/api/admin/dvn-retry-all/route.ts` already uses for a comparable
 *     DVN-mutating admin action.
 *
 * Never grants access when CRON_TRIGGER_TOKEN is unconfigured and no
 * header was sent — `expected` must be truthy AND match exactly.
 */
export async function requireOpsAuth(request: NextRequest): Promise<OpsAuthResult> {
  const expected = process.env.CRON_TRIGGER_TOKEN;
  const provided =
    request.headers.get('x-cron-token') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (expected && provided === expected) {
    return { ok: true, via: 'cron-token' };
  }

  const persona = await getActivePersona(request).catch(() => null);
  if (persona?.cartridgeFlags?.isAdmin) {
    return { ok: true, via: 'admin-persona' };
  }

  return {
    ok: false,
    response: NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } }),
  };
}
