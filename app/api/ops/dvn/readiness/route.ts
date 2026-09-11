/**
 * GET /api/ops/dvn/readiness — is anchoring actually working, or only configured?
 *
 * WHY (operator ruling, 2026-07-27): *"Verify the canister and Autonomys
 * runtime configuration end to end and surface any local-only receipt state
 * explicitly… **A configured allowlist is not proof of a configured runtime.**
 * Add an operational canary that fails deployment readiness when ratification
 * receipts remain local because the anchoring destination is absent. It should
 * not block local development, but it must make the degraded state explicit."*
 *
 * THE DISTINCTION THIS ROUTE EXISTS TO MAKE. `activityReceiptDvnPipeline`
 * documents its own no-op: with `CROSS_CHAIN_SERVICE_CANISTER_ID` unset it
 * leaves every receipt at `local` and returns quietly, so local development
 * works without canister access. That is correct — and it is indistinguishable
 * at a glance from a deployment where anchoring is configured and silently
 * failing. Both look like "receipts exist, none are anchored".
 *
 * So the verdict is three-valued, never a boolean:
 *
 *   unconfigured — no anchoring destination. EXPECTED locally. Not a failure.
 *   degraded     — a destination IS configured and receipts are not reaching
 *                  it. A REAL failure, and the state the operator asked to be
 *                  made explicit.
 *   ready        — configured, identity parses, and nothing anchorable is
 *                  stuck behind the staleness window.
 *
 * Collapsing those into ok/not-ok would either cry wolf on every local machine
 * or stay silent on a broken production anchor. The three-valued verdict is the
 * whole point of the route.
 *
 * WHAT IT DOES NOT DO. It does not submit anything. Readiness must be safe to
 * poll — a check that writes to the chain to prove the chain works is not a
 * check. `/api/ops/dvn/debug/submit` remains the deliberate live test.
 *
 * Admin- or ops-token-gated, unlike its sibling debug routes under
 * `app/api/ops/dvn/**`, which carry no gate at all (flagged separately — those
 * predate this route and are not weakened here).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const dynamic = 'force-dynamic';

export type AnchoringVerdict = 'ready' | 'degraded' | 'unconfigured';

/**
 * How long an anchorable receipt may sit at `local` before it counts as stuck.
 * Submission is fire-and-forget and the finalizer is asynchronous, so a fresh
 * receipt at `local` is normal, not a fault.
 */
const STALE_LOCAL_MINUTES = 30;

/** The action types whose local-only state is a governance concern. */
const GOVERNANCE_ACTIONS = [
  'governance_decision_ratified',
  'governance_decision_amended',
  'governance_authority_exercised',
  'governance_escalation_triggered',
];

async function authorize(req: NextRequest): Promise<boolean> {
  const opsToken = process.env.ADMIN_OPS_TOKEN;
  if (opsToken) {
    const header = req.headers.get('authorization') ?? req.headers.get('Authorization') ?? '';
    if (header.startsWith('Bearer ') && header.slice(7) === opsToken) return true;
  }
  const persona = await getActivePersona(req);
  return persona?.cartridgeFlags?.isAdmin === true;
}

/** Does the configured PEM parse into a principal? Presence is not validity. */
async function resolveIdentity(): Promise<{ configured: boolean; parses: boolean; principal: string | null }> {
  const pem = process.env.DFX_IDENTITY_PEM;
  if (!pem) return { configured: false, parses: false, principal: null };
  try {
    const idMod = (await import('@dfinity/identity')) as unknown as Record<string, { fromPem?: (p: string) => { getPrincipal: () => { toText: () => string } } }>;
    for (const key of ['Ed25519KeyIdentity', 'Secp256k1KeyIdentity']) {
      const fromPem = idMod[key]?.fromPem;
      if (!fromPem) continue;
      try {
        const id = fromPem(pem);
        return { configured: true, parses: true, principal: id.getPrincipal().toText() };
      } catch {
        /* try the next curve */
      }
    }
  } catch {
    /* @dfinity/identity unavailable */
  }
  return { configured: true, parses: false, principal: null };
}

export async function GET(req: NextRequest) {
  if (!(await authorize(req))) {
    return NextResponse.json({ ok: false, error: 'Admin or ops-token access required' }, { status: 403 });
  }

  const canisterId =
    process.env.CROSS_CHAIN_SERVICE_CANISTER_ID ||
    process.env.NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID ||
    null;
  const identity = await resolveIdentity();
  const autonomysConfigured = Boolean(process.env.AUTONOMYS_API_KEY);

  // Receipt state — the only evidence that configuration TRANSLATED into
  // anchoring. Counts only; no receipt bodies, no persona identifiers.
  const admin = getSupabaseServer();
  const cutoff = new Date(Date.now() - STALE_LOCAL_MINUTES * 60_000).toISOString();
  let stuckLocal: number | null = null;
  let failed: number | null = null;
  let anchored: number | null = null;
  let receiptReadError: string | null = null;

  if (admin) {
    try {
      const [localRes, failedRes, anchoredRes] = await Promise.all([
        admin
          .from('activity_receipts')
          .select('id', { count: 'exact', head: true })
          .in('action_type', GOVERNANCE_ACTIONS)
          .eq('receipt_status', 'local')
          .lt('created_at', cutoff),
        admin
          .from('activity_receipts')
          .select('id', { count: 'exact', head: true })
          .in('action_type', GOVERNANCE_ACTIONS)
          .eq('receipt_status', 'dvn_failed'),
        admin
          .from('activity_receipts')
          .select('id', { count: 'exact', head: true })
          .in('action_type', GOVERNANCE_ACTIONS)
          .eq('receipt_status', 'dvn_recorded'),
      ]);
      stuckLocal = localRes.count ?? 0;
      failed = failedRes.count ?? 0;
      anchored = anchoredRes.count ?? 0;
    } catch (e) {
      receiptReadError = e instanceof Error ? e.message : String(e);
    }
  }

  // The verdict. Order matters: no destination is UNCONFIGURED (expected
  // locally), never degraded — otherwise every developer machine reports a
  // failure and the signal is learned-ignored within a day.
  let verdict: AnchoringVerdict;
  const reasons: string[] = [];

  if (!canisterId) {
    verdict = 'unconfigured';
    reasons.push(
      'CROSS_CHAIN_SERVICE_CANISTER_ID is not set — the DVN pipeline is a documented no-op and every receipt stays local. Expected in local development; a fault in a deployed environment.',
    );
  } else {
    verdict = 'ready';
    if (!identity.configured) {
      verdict = 'degraded';
      reasons.push('DFX_IDENTITY_PEM is not set — submissions run anonymous and the canister will refuse them.');
    } else if (!identity.parses) {
      verdict = 'degraded';
      reasons.push('DFX_IDENTITY_PEM is set but does not parse as an Ed25519 or Secp256k1 identity.');
    }
    if ((stuckLocal ?? 0) > 0) {
      verdict = 'degraded';
      reasons.push(
        `${stuckLocal} governance receipt(s) have sat at 'local' for over ${STALE_LOCAL_MINUTES} minutes with a destination configured — the act was recorded and never anchored.`,
      );
    }
    if ((failed ?? 0) > 0) {
      verdict = 'degraded';
      reasons.push(`${failed} governance receipt(s) are at 'dvn_failed' and need a retry.`);
    }
    if (receiptReadError) {
      verdict = 'degraded';
      reasons.push(`receipt state could not be read: ${receiptReadError}`);
    }
  }

  return NextResponse.json(
    {
      ok: verdict !== 'degraded',
      verdict,
      reasons,
      anchoring: {
        canisterConfigured: Boolean(canisterId),
        identityConfigured: identity.configured,
        identityParses: identity.parses,
        principal: identity.principal,
      },
      // Autodrive publication is a SEPARATE immutability path. Its absence
      // never degrades anchoring — the operator's rule that anchoring must not
      // silently depend on publication succeeding, made structural.
      publication: { autonomysConfigured },
      governanceReceipts: { anchored, stuckLocal, failed, staleAfterMinutes: STALE_LOCAL_MINUTES },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
