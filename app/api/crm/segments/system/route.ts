/**
 * CRM System Segments API
 *
 * GET /api/crm/segments/system?tenantId=xxx
 * Returns Order of Metaiye and reputation tier segments with live counts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

const ORDER_TIERS = ['KETA', 'KEJI', 'FIRST', 'ZERO', 'SAT'] as const;
const REP_TIERS = ['R0_KETA', 'R1_KEJI', 'R2_FIRST', 'R3_ZERO', 'R4_SAT'] as const;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Supabase not configured' },
        { status: 500 }
      );
    }

    const orderCounts = new Map<string, number>();
    const repCounts = new Map<string, number>();
    const pageSize = 1000;
    let offset = 0;

    while (true) {
      const { data: personas, error } = await supabase
        .from('personas')
        .select('order_tier, reputation_tier')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: true })
        .range(offset, offset + pageSize - 1);

      if (error) throw error;

      (personas || []).forEach((row: any) => {
        if (row.order_tier) {
          orderCounts.set(row.order_tier, (orderCounts.get(row.order_tier) || 0) + 1);
        }
        if (row.reputation_tier) {
          repCounts.set(row.reputation_tier, (repCounts.get(row.reputation_tier) || 0) + 1);
        }
      });

      if (!personas || personas.length < pageSize) break;
      offset += pageSize;
    }

    const now = new Date().toISOString();
    const segments = [
      ...ORDER_TIERS.map((tier) => ({
        id: `order-${tier.toLowerCase()}`,
        name: `Order of Metaiye: ${tier}`,
        description: `Members with Order tier ${tier}.`,
        memberCount: orderCounts.get(tier) || 0,
        isDynamic: true,
        ruleDefinition: { orderTier: tier },
        createdAt: now,
        updatedAt: now,
      })),
      ...REP_TIERS.map((tier) => ({
        id: `rep-${tier.toLowerCase()}`,
        name: `Reputation Tier: ${tier}`,
        description: `Members with reputation tier ${tier}.`,
        memberCount: repCounts.get(tier) || 0,
        isDynamic: true,
        ruleDefinition: { reputationTier: tier },
        createdAt: now,
        updatedAt: now,
      })),
    ];

    return NextResponse.json({
      success: true,
      data: segments,
    });
  } catch (error: any) {
    console.error('[CRM API] GET /segments/system error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch system segments' },
      { status: 500 }
    );
  }
}
