/**
 * Entitlement Diagnostic — operator tool
 * GET  /api/wallet/knyt/diagnose-entitlements?personaId=<uuid>
 * GET  /api/wallet/knyt/diagnose-entitlements?fioHandle=<handle>
 * POST /api/wallet/knyt/diagnose-entitlements  (body: { personaId|fioHandle, repair: true })
 *
 * Purpose: when a buyer reports they purchased a bundle but don't see access
 * in the codex, this route surfaces every relevant row in one shot:
 *
 *   - personas row (canonical UUID, fio_handle)
 *   - wallet_balances row (DVN KNYT)
 *   - purchases rows (any successful purchases by this persona)
 *   - user_entitlements rows (what the codex queries)
 *   - store_skus row presence per entitlement (where the SKU expansion fails
 *     when missing — manifests as "I bought it but the codex shows no access")
 *
 * The POST repair mode iterates the persona's purchase history and re-grants
 * any missing entitlements. Idempotent: existing entitlements are left as-is.
 *
 * Auth: ADMIN_OPS_TOKEN bearer (same shape as /paypal/recover).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getEntitlementService } from '@/services/rewards/entitlementService';
import { BUNDLE_PRICING } from '@/types/knyt-store';

export const runtime = 'nodejs';

function supabaseSr() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

async function isAuthorized(request: NextRequest): Promise<boolean> {
  const adminToken = process.env.ADMIN_OPS_TOKEN;
  if (!adminToken) return false;
  const auth = request.headers.get('authorization') || '';
  return auth === `Bearer ${adminToken}`;
}

interface ResolvedPersona {
  id: string;
  fio_handle: string | null;
  display_name: string | null;
}

async function resolvePersona(
  sb: ReturnType<typeof supabaseSr>,
  query: { personaId?: string; fioHandle?: string },
): Promise<ResolvedPersona | null> {
  if (query.personaId) {
    const { data } = await sb
      .from('personas')
      .select('id, fio_handle, display_name')
      .eq('id', query.personaId)
      .maybeSingle();
    if (data) return data as ResolvedPersona;
  }
  if (query.fioHandle) {
    // Case-insensitive lookup — fio handles are stored lowercase
    const { data } = await sb
      .from('personas')
      .select('id, fio_handle, display_name')
      .ilike('fio_handle', query.fioHandle)
      .maybeSingle();
    if (data) return data as ResolvedPersona;
  }
  return null;
}

async function diagnose(personaId: string) {
  const sb = supabaseSr();

  const [
    balanceResult,
    purchasesResult,
    entitlementsResult,
  ] = await Promise.all([
    sb.from('wallet_balances')
      .select('asset_code, balance, updated_at')
      .eq('persona_id', personaId),
    sb.from('purchases')
      .select('id, product_id, product_type, payment_rail, amount, currency, status, created_at, completed_at, metadata')
      .eq('persona_id', personaId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(50),
    sb.from('user_entitlements')
      .select('id, asset_id, tier, entitlement_type, source_purchase_id, starts_at, expires_at, metadata')
      .eq('persona_id', personaId)
      .limit(200),
  ]);

  const entitlements = entitlementsResult.data ?? [];
  const purchases = purchasesResult.data ?? [];
  const balances = balanceResult.data ?? [];

  // For every entitlement, check if its asset_id matches a row in store_skus.
  // If NOT, the SKU expander (services/rewards/assetOwnership.getOwnedSkus)
  // returns nothing for that entitlement, so the bundle's contained content
  // never appears as accessible in the codex.
  const assetIds = Array.from(new Set(entitlements.map((e) => e.asset_id).filter(Boolean) as string[]));
  let skuMatches: Array<{ sku_id: string; name: string; is_active: boolean | null }> = [];
  if (assetIds.length > 0) {
    const { data } = await sb
      .from('store_skus')
      .select('sku_id, name, is_active')
      .in('sku_id', assetIds);
    skuMatches = (data ?? []) as typeof skuMatches;
  }
  const matchedSkuIds = new Set(skuMatches.map((s) => s.sku_id));
  const orphanedEntitlements = entitlements.filter((e) => e.asset_id && !matchedSkuIds.has(e.asset_id));

  // Cross-reference purchases against entitlements: any purchase row whose
  // primary asset (productType + assetIds in metadata, or product_id) has no
  // matching entitlement is a candidate for repair.
  const entitlementsByAsset = new Map<string, number>();
  entitlements.forEach((e) => {
    if (!e.asset_id) return;
    entitlementsByAsset.set(e.asset_id, (entitlementsByAsset.get(e.asset_id) ?? 0) + 1);
  });

  /**
   * Resolve the canonical bundle SKU id for a purchase row. The modal sends
   * assetIds with the bundle id (e.g. 'satoshi-knyt-investor'); processPurchase
   * stores them in purchases.metadata. For older purchase rows that don't have
   * assetIds in metadata, fall back to matching contentTitle against
   * BUNDLE_PRICING.label — that's how we recover fost@knyt's Satoshi entitlement
   * when the original grant failed and no assetIds were persisted.
   */
  function resolveBundleSkuId(p: typeof purchases[number]): string | null {
    const meta = (p.metadata as Record<string, unknown>) ?? {};
    const explicitBundleId = typeof meta.bundleSkuId === 'string' ? meta.bundleSkuId : null;
    if (explicitBundleId && BUNDLE_PRICING.some((b) => b.id === explicitBundleId)) {
      return explicitBundleId;
    }
    const fromAssetIds = Array.isArray(meta.assetIds) ? (meta.assetIds as unknown[])[0] : null;
    if (typeof fromAssetIds === 'string' && BUNDLE_PRICING.some((b) => b.id === fromAssetIds)) {
      return fromAssetIds;
    }
    const contentTitle = typeof meta.contentTitle === 'string' ? meta.contentTitle : null;
    if (contentTitle) {
      const match = BUNDLE_PRICING.find((b) => b.label === contentTitle);
      if (match) return match.id;
    }
    return null;
  }

  const purchasesWithoutEntitlement = purchases.filter((p) => {
    const bundleId = resolveBundleSkuId(p);
    if (bundleId) return !entitlementsByAsset.has(bundleId);
    const meta = (p.metadata as Record<string, unknown>) ?? {};
    const fallback = (meta.assetIds as string[] | undefined)?.[0] ?? p.product_id;
    return fallback && !entitlementsByAsset.has(fallback);
  });

  return {
    balances,
    purchases,
    entitlements,
    skuCatalog: {
      checked: assetIds.length,
      matched: skuMatches.length,
      orphaned: orphanedEntitlements.length,
      orphanedAssetIds: orphanedEntitlements.map((e) => e.asset_id),
    },
    repairCandidates: purchasesWithoutEntitlement.map((p) => {
      const meta = (p.metadata as Record<string, unknown>) ?? {};
      const bundleId = resolveBundleSkuId(p);
      const fallback = (meta.assetIds as string[] | undefined)?.[0] ?? p.product_id;
      return {
        purchaseId: p.id as string,
        productId: p.product_id as string,
        productType: p.product_type as string,
        amount: p.amount,
        currency: p.currency,
        // Prefer the resolved bundle SKU id (matches store_skus); fall back
        // to whatever was in assetIds or the product UUID as a last resort.
        candidateAssetId: (bundleId ?? fallback) as string,
        bundleSkuId: bundleId,
        contentTitle: typeof meta.contentTitle === 'string' ? meta.contentTitle : null,
        completedAt: p.completed_at,
      };
    }),
  };
}

async function repair(personaId: string) {
  const diag = await diagnose(personaId);
  const ent = getEntitlementService();
  const granted: Array<{ assetId: string; entitlementId: string; alreadyExists?: boolean }> = [];
  const failed: Array<{ assetId: string; error: string }> = [];

  for (const candidate of diag.repairCandidates) {
    const result = await ent.grantEntitlement({
      personaId,
      assetId: candidate.candidateAssetId,
      sourcePurchaseId: candidate.purchaseId,
      metadata: {
        repaired: true,
        repairedAt: new Date().toISOString(),
        productType: candidate.productType,
      },
    });
    if (result.success) {
      granted.push({
        assetId: candidate.candidateAssetId,
        entitlementId: result.entitlementId!,
        alreadyExists: result.alreadyExists,
      });
    } else {
      failed.push({ assetId: candidate.candidateAssetId, error: result.error || 'unknown' });
    }
  }

  return { granted, failed, repairedCount: granted.filter((g) => !g.alreadyExists).length };
}

export async function GET(request: NextRequest) {
  if (!await isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const personaId = searchParams.get('personaId') || undefined;
  const fioHandle = searchParams.get('fioHandle') || undefined;
  if (!personaId && !fioHandle) {
    return NextResponse.json({ error: 'personaId or fioHandle required' }, { status: 400 });
  }

  const sb = supabaseSr();
  const persona = await resolvePersona(sb, { personaId, fioHandle });
  if (!persona) {
    return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
  }

  const diag = await diagnose(persona.id);
  return NextResponse.json({ persona, ...diag });
}

export async function POST(request: NextRequest) {
  if (!await isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json() as {
      personaId?: string;
      fioHandle?: string;
      repair?: boolean;
    };
    const sb = supabaseSr();
    const persona = await resolvePersona(sb, { personaId: body.personaId, fioHandle: body.fioHandle });
    if (!persona) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
    }

    if (body.repair) {
      const result = await repair(persona.id);
      const diag = await diagnose(persona.id);
      return NextResponse.json({ persona, repair: result, ...diag });
    }

    const diag = await diagnose(persona.id);
    return NextResponse.json({ persona, ...diag });
  } catch (err) {
    console.error('[diagnose-entitlements] Error:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
