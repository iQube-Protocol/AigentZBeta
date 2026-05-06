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
import {
  buildDebugBypassContext,
  isDebugBypassEnabled,
  logDebugBypass,
} from '@/services/access/debugBypass';

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

  let context = await getActivePersona(req);
  if (!context) {
    if (isDebugBypassEnabled()) {
      logDebugBypass('inspect');
      context = buildDebugBypassContext();
    } else {
      return NextResponse.json(
        { error: 'unauthenticated' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
      );
    }
  }

  // Lenient resolution: if the value passed under one key doesn't yield a
  // descriptor, try the other key with the same value. Operator shouldn't
  // need to know which column they're querying — assetIds (mk_ep*),
  // CIDs (Autonomys hash), and Supabase storage URLs all resolve through
  // this single endpoint.
  const primary = cid ?? assetId!;
  let descriptor = cid
    ? await getContentDescriptorByCid(cid)
    : await getContentDescriptor(assetId!);
  let resolvedVia: 'cid' | 'assetId' = cid ? 'cid' : 'assetId';
  if (!descriptor) {
    const fallback = cid
      ? await getContentDescriptor(primary)
      : await getContentDescriptorByCid(primary);
    if (fallback) {
      descriptor = fallback;
      resolvedVia = cid ? 'assetId' : 'cid';
    }
  }

  if (!descriptor) {
    // Self-help: when the lookup misses, surface a few nearby candidates so
    // the operator can tell whether the value was wrong (typo / stale CID)
    // versus genuinely unknown to the catalog. Fixed prefix length keeps
    // this cheap and bounded.
    const probe = primary.slice(0, 8);
    const nearby = await findNearbyAssetIds(probe);
    return NextResponse.json(
      {
        input: { cid, assetId, action },
        persona: summarisePersona(context),
        descriptor: null,
        decision: null,
        note:
          `No descriptor found by cid OR assetId fallback OR iq_blak_qubes.cid fallback. ` +
          `The value is unknown to master_content_qubes / codex_media_assets. ` +
          `Hint: assetIds look like 'mk_epNN_<type>_<tier>' or a UUID; CIDs are long Autonomys content hashes or full Supabase storage URLs.`,
        nearby,
      },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const decision = await evaluateAccess(context, descriptor, action);

  return NextResponse.json(
    {
      input: { cid, assetId, action, resolvedVia },
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

/**
 * Best-effort "did you mean?" — returns a handful of asset/master ids whose
 * own ids OR cid-bearing columns share a prefix with the missing value.
 * Self-help only; never throws.
 */
async function findNearbyAssetIds(probe: string): Promise<{
  byAssetIdPrefix: string[];
  byCidPrefix: string[];
}> {
  if (!probe || probe.length < 4) return { byAssetIdPrefix: [], byCidPrefix: [] };
  const out: { byAssetIdPrefix: string[]; byCidPrefix: string[] } = { byAssetIdPrefix: [], byCidPrefix: [] };
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return out;
    const sb = createClient(url, key);

    const { data: byMaster } = await sb
      .from('master_content_qubes')
      .select('id')
      .ilike('id', `${probe}%`)
      .limit(5);
    out.byAssetIdPrefix.push(...((byMaster || []) as Array<{ id: string }>).map((r) => r.id));

    const { data: byCidMaster } = await sb
      .from('master_content_qubes')
      .select('id')
      .ilike('auto_drive_cid', `${probe}%`)
      .limit(5);
    out.byCidPrefix.push(...((byCidMaster || []) as Array<{ id: string }>).map((r) => r.id));

    const { data: byCidAsset } = await sb
      .from('codex_media_assets')
      .select('id')
      .ilike('auto_drive_cid', `${probe}%`)
      .limit(5);
    out.byCidPrefix.push(...((byCidAsset || []) as Array<{ id: string }>).map((r) => r.id));
  } catch {
    // Self-help is best-effort; do not surface lookup failures to the caller.
  }
  return out;
}
