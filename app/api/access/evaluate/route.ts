/**
 * GET /api/access/evaluate?cid=…  (or ?assetId=…)
 *
 * Production-facing access check. Composes:
 *   getActivePersona  +  getContentDescriptor(ByCid)  +  evaluateAccess
 *
 * Returns the decision payload only (no descriptor metadata, no debug
 * fluff). Designed to be the canonical client-callable gate check.
 *
 *   { allow: boolean
 *   , reason: string
 *   , deliveryMode: string
 *   , expiresAt?: string  }
 *
 * Difference vs /api/access/inspect:
 *   inspect  — debug-flavored; returns descriptor + persona summary +
 *              decision + nearby suggestions on miss. Verbose.
 *              Used by /access-inspect debug page.
 *   evaluate — minimal payload; no descriptor leakage; cacheable in
 *              principle (though we set no-store today). Used by UI
 *              consumers (SmartContentActionContext, RemixDialog,
 *              KnytTab) to gate user actions.
 *
 * Auth: requires Authorization: Bearer <jwt>. The TEMPORARY DEBUG bypass
 * (services/access/debugBypass.ts) does NOT extend to this endpoint —
 * production gates remain strict. UI surfaces are expected to send the
 * bearer token like every other authenticated client call (see
 * PersonaSelector.tsx:getAuthHeaders pattern).
 *
 * 401 unauthenticated. 404 if neither cid nor assetId resolves to a
 * descriptor. 200 otherwise with the decision payload.
 *
 * Phase 1.3 / 1.4 of the unified IAM foundation plan.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import {
  getContentDescriptor,
  getContentDescriptorByCid,
} from '@/services/content/getContentDescriptor';
import { evaluateAccess } from '@/services/access/evaluateAccess';

import type { AccessAction } from '@/types/access';

export const dynamic = 'force-dynamic';

const VALID_ACTIONS: ReadonlySet<AccessAction> = new Set<AccessAction>([
  'read',
  'watch',
  'listen',
  'invoke',
  'connect',
  'remix',
  'mint',
  'transfer',
  'payment-settle',
  'policy-escalation',
  'disclosure',
]);

export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const cid = url.searchParams.get('cid');
  const assetId = url.searchParams.get('assetId');
  const actionParam = url.searchParams.get('action') as AccessAction | null;
  const action: AccessAction =
    actionParam && VALID_ACTIONS.has(actionParam) ? actionParam : 'read';

  if (!cid && !assetId) {
    return NextResponse.json(
      { error: "missing 'cid' or 'assetId' query parameter" },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // Production gate — strict auth (no debug bypass on this endpoint).
  const ctx = await getActivePersona(req);
  if (!ctx) {
    return NextResponse.json(
      { error: 'unauthenticated' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // Lenient cid/assetId resolution — same fallback chain as inspect.
  const primary = cid ?? assetId!;
  let descriptor = cid
    ? await getContentDescriptorByCid(cid)
    : await getContentDescriptor(assetId!);
  if (!descriptor) {
    descriptor = cid
      ? await getContentDescriptor(primary)
      : await getContentDescriptorByCid(primary);
  }

  if (!descriptor) {
    return NextResponse.json(
      { error: 'descriptor-not-found' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const decision = await evaluateAccess(ctx, descriptor, action);

  return NextResponse.json(
    {
      allow: decision.allow,
      reason: decision.reason,
      deliveryMode: decision.deliveryMode,
      expiresAt: decision.expiresAt,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
