/**
 * GET /api/marketa/packs/queue
 *
 * Admin: returns all packs with proposed_by set, optionally filtered by status.
 * Used by MarketaApprovalQueueTab.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const dynamic = 'force-dynamic';

function getMarketaClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { db: { schema: 'marketa' } });
}

function safeParse<T>(val: unknown, fallback: T): T {
  if (typeof val === 'object' && val !== null) return val as T;
  if (typeof val === 'string') {
    try { return JSON.parse(val) as T; } catch { return fallback; }
  }
  return fallback;
}

export async function GET(req: NextRequest) {
  const marketaClient = getMarketaClient();
  if (!marketaClient) {
    return NextResponse.json({ ok: false, error: 'DB unavailable' }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get('status'); // optional

  try {
    let query = marketaClient
      .from('packs')
      .select('id, name, tagline, status, proposed_by, intent, objectives, milestones, copy_variants, reward_estimate, campaign_fit_score, admin_notes, created_at')
      .not('proposed_by', 'is', null)
      .order('created_at', { ascending: false });

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    const { data: packs, error } = await query;
    if (error) throw error;

    // Enrich with partner details from public schema
    const supabase = getSupabaseServer();
    const partnerIds = [...new Set((packs ?? []).map((p) => p.proposed_by).filter(Boolean))];

    const partnerMap: Record<string, { name: string; org: string }> = {};
    if (supabase && partnerIds.length) {
      const { data: partners } = await supabase
        .from('avl_partner_contacts')
        .select('id, name, org')
        .in('id', partnerIds);
      for (const p of partners ?? []) {
        partnerMap[p.id] = { name: p.name, org: p.org };
      }
    }

    const enriched = (packs ?? []).map((p) => ({
      ...p,
      partner_name:    partnerMap[p.proposed_by]?.name,
      partner_org:     partnerMap[p.proposed_by]?.org,
      objectives:      safeParse(p.objectives,      []),
      milestones:      safeParse(p.milestones,      []),
      copy_variants:   safeParse(p.copy_variants,   []),
      reward_estimate: safeParse(p.reward_estimate, null),
    }));

    return NextResponse.json({ ok: true, packs: enriched });
  } catch (err) {
    console.error('[packs/queue] error:', err);
    return NextResponse.json({ ok: false, error: 'Failed to load queue' }, { status: 500 });
  }
}
