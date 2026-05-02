/**
 * Admin API: Distribute Bundle Entitlements (fan-out)
 *
 * POST /api/admin/entitlements/distribute-bundle
 *   body: { personaId: string, skuId: string, dryRun?: boolean }
 *
 * Converts a single bundle entitlement (e.g. `knyt-codex-investor`) into
 * individual per-asset entitlements at distribution time. This is the
 * "claim individual items" stage promised at launch — the bundle entitlement
 * stays in place as the source-of-truth purchase record, and N child
 * entitlements are written for every asset the bundle covers.
 *
 * Idempotent: re-running for the same persona+sku will skip already-granted
 * assets and only write the missing ones. Returns counts of granted /
 * skipped / failed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getEntitlementService } from '@/services/rewards/entitlementService';
import { getOwnedAssetIds } from '@/services/rewards/assetOwnership';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function supa() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  let body: { personaId?: string; skuId?: string; dryRun?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { personaId, skuId, dryRun } = body;
  if (!personaId || !skuId) {
    return NextResponse.json({ error: 'personaId and skuId required' }, { status: 400 });
  }

  // Verify persona owns the bundle SKU as a direct entitlement
  const ents = await getEntitlementService().getPersonaEntitlements(personaId);
  const bundleEnt = ents.find((e) => e.assetId === skuId);
  if (!bundleEnt) {
    return NextResponse.json(
      { error: `Persona does not own bundle ${skuId}` },
      { status: 404 }
    );
  }

  // Compute the full asset set the bundle grants
  const expanded = await getOwnedAssetIds(personaId, 'metaKnyts');
  const allCovered = new Set([...expanded.expanded]);
  const alreadyDirect = new Set(expanded.direct);
  const toGrant = Array.from(allCovered).filter((id) => !alreadyDirect.has(id));

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      bundle: skuId,
      coveredCount: allCovered.size,
      alreadyDirectCount: alreadyDirect.size,
      wouldGrantCount: toGrant.length,
      wouldGrantSample: toGrant.slice(0, 10),
    });
  }

  // Fan out — write per-asset entitlements with bundle's purchase id as source
  const sourcePurchaseId = bundleEnt.sourcePurchaseId ?? null;
  let granted = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const assetId of toGrant) {
    try {
      const result = await getEntitlementService().grantEntitlement({
        personaId,
        assetId,
        sourcePurchaseId,
        metadata: { distributedFromBundle: skuId, distributedAt: new Date().toISOString() },
      });
      if (result.success) granted += 1;
      else { skipped += 1; if (result.error) errors.push(`${assetId}: ${result.error}`); }
    } catch (e) {
      failed += 1;
      errors.push(`${assetId}: ${(e as Error).message}`);
    }
  }

  // Mark the bundle entitlement so the operator can see distribution happened
  if (granted > 0) {
    await supa()
      .from('user_entitlements')
      .update({
        metadata: {
          ...(bundleEnt.metadata || {}),
          distributed_at: new Date().toISOString(),
          distributed_count: granted,
        },
      })
      .eq('id', bundleEnt.id);
  }

  return NextResponse.json({
    bundle: skuId,
    coveredCount: allCovered.size,
    alreadyDirectCount: alreadyDirect.size,
    granted,
    skipped,
    failed,
    errors: errors.slice(0, 20),
  });
}
