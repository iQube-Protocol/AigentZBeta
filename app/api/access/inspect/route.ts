/**
 * GET /api/access/inspect?cid=…  (or ?assetId=…)
 *
 * Operator/dev convenience endpoint for inspecting what the spine would
 * decide for the active persona against a given content asset, without
 * needing to read server logs.
 *
 * Returns a single JSON document containing:
 *   - persona summary (T1-safe — no rootDid / authProfileId / fioHandle)
 *   - content descriptor (state, gating, iqube envelope summary)
 *   - decision (allow, reason, deliveryMode, receipt mode)
 *
 * Both ?cid=… and ?assetId=… are accepted. CID resolves via
 * getContentDescriptorByCid (master_content_qubes / codex_media_assets
 * lookup); assetId resolves via getContentDescriptor directly.
 *
 * Auth: returns 401 if no caller. Otherwise 200 with the inspection payload.
 *
 * Privacy: this endpoint is for the AUTHENTICATED caller only. It returns
 * the decision the caller's own persona would receive — never another
 * persona's. The descriptor is identity-agnostic (safe to expose) and
 * the decision is bound to the caller's session.
 *
 * Phase 1.4 helper. Useful while shadow-log mode is active and before
 * ACCESS_SPINE_ENFORCE=1 is flipped, to verify ALLOW/DENY behaviour
 * without scanning server logs.
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

  const context = await getActivePersona(req);
  if (!context) {
    return NextResponse.json(
      { error: 'unauthenticated' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const descriptor = cid
    ? await getContentDescriptorByCid(cid)
    : await getContentDescriptor(assetId!);

  if (!descriptor) {
    return NextResponse.json(
      {
        input: { cid, assetId, action },
        persona: summarisePersona(context),
        descriptor: null,
        decision: null,
        note: 'No descriptor found. The asset is unknown to master_content_qubes / codex_media_assets.',
      },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const decision = await evaluateAccess(context, descriptor, action);

  return NextResponse.json(
    {
      input: { cid, assetId, action },
      persona: summarisePersona(context),
      descriptor: {
        assetId: descriptor.assetId,
        contentClass: descriptor.contentClass,
        state: descriptor.state,
        gating: descriptor.gating,
        receiptEligible: descriptor.receiptEligible,
        iqube: descriptor.iqube
          ? {
              metaQubeId: descriptor.iqube.metaQubeId,
              blakQubeId: descriptor.iqube.blakQubeId,
              tokenQubeId: descriptor.iqube.tokenQubeId,
              encryption: descriptor.iqube.encryption
                ? { alg: descriptor.iqube.encryption.alg }
                : undefined,
              storage: descriptor.iqube.storage,
              onChain: descriptor.iqube.onChain,
            }
          : null,
      },
      decision: {
        allow: decision.allow,
        reason: decision.reason,
        deliveryMode: decision.deliveryMode,
        receipt: {
          mode: decision.receipt.mode,
          aliasCommitment: decision.receipt.aliasCommitment,
          cohortId: decision.receipt.cohortId,
        },
      },
      enforceFlag: process.env.ACCESS_SPINE_ENFORCE === '1',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

/**
 * Privacy-safe summary of the active persona context. Strips T0
 * identifiers (personaId, authProfileId) before returning.
 */
function summarisePersona(ctx: {
  identifiability: string;
  cartridgeFlags: { isAdmin: boolean; isPartner: boolean };
  cohortMemberships: string[];
  source: string;
}) {
  return {
    identifiability: ctx.identifiability,
    cartridgeFlags: ctx.cartridgeFlags,
    cohortMemberships: ctx.cohortMemberships,
    source: ctx.source,
  };
}
