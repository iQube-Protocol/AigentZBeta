/**
 * GET /api/wallet/knyt/sku-supply?ids=bundle-id-1,bundle-id-2
 *
 * Returns per-bundle inventory: how many completed purchases exist for each
 * limited-supply SKU and how many remain. Used by KnytStoreInvestorTab to
 * decrement the "21 left" badge as Satoshi KNYT (and any other isLimited
 * bundle) sells units. Public read — no balances, no persona-scoped data.
 *
 * Counting strategy (handles both old + new purchase rows):
 *   - New rows (post 2026-05-10) have metadata.bundleSkuId set explicitly.
 *   - Old rows only have metadata.contentTitle (e.g. "Satoshi KNYT Collection")
 *     which uniquely matches BUNDLE_PRICING.label for limited bundles.
 *   - Union and dedupe by purchase id so we don't double-count rows that
 *     happen to have both fields.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { BUNDLE_PRICING } from '@/types/knyt-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SupplyRow {
  bundleId: string;
  sold: number;
  limitedSupply: number | null;
  remaining: number | null;
  isLimited: boolean;
}

export async function GET(request: NextRequest) {
  const idsParam = request.nextUrl.searchParams.get('ids') || '';
  const requestedIds = idsParam.split(',').map((s) => s.trim()).filter(Boolean);
  if (requestedIds.length === 0) {
    return NextResponse.json({ supply: {} });
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const out: Record<string, SupplyRow> = {};

  for (const bundleId of requestedIds) {
    const bundle = BUNDLE_PRICING.find((b) => b.id === bundleId);
    if (!bundle) continue;

    const purchaseIds = new Set<string>();

    // 1) Match by new canonical metadata.bundleSkuId
    const byId = await sb
      .from('purchases')
      .select('id')
      .eq('status', 'completed')
      .filter('metadata->>bundleSkuId', 'eq', bundleId);
    (byId.data ?? []).forEach((r) => purchaseIds.add(r.id as string));

    // 2) Match by legacy metadata.contentTitle (pre-bundleSkuId rows). Only
    //    safe because BUNDLE_PRICING labels are unique among limited SKUs.
    const byTitle = await sb
      .from('purchases')
      .select('id')
      .eq('status', 'completed')
      .filter('metadata->>contentTitle', 'eq', bundle.label);
    (byTitle.data ?? []).forEach((r) => purchaseIds.add(r.id as string));

    const sold = purchaseIds.size;
    const limitedSupply = bundle.isLimited ? (bundle.limitedSupply ?? null) : null;
    const remaining = limitedSupply !== null ? Math.max(0, limitedSupply - sold) : null;

    out[bundleId] = {
      bundleId,
      sold,
      limitedSupply,
      remaining,
      isLimited: !!bundle.isLimited,
    };
  }

  return NextResponse.json({ supply: out });
}
