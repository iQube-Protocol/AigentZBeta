/**
 * GET /api/marketa/packs/partner/[partner_id]
 *
 * Returns all packs for a specific partner (My Packs tab).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getMarketaClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { db: { schema: 'marketa' } });
}

export async function GET(_req: NextRequest, props: { params: Promise<{ partner_id: string }> }) {
  const params = await props.params;
  const marketaClient = getMarketaClient();
  if (!marketaClient) {
    return NextResponse.json({ ok: false, error: 'DB unavailable' }, { status: 503 });
  }

  const { partner_id } = params;
  if (!partner_id) return NextResponse.json({ ok: false, error: 'partner_id required' }, { status: 400 });

  try {
    const { data, error } = await marketaClient
      .from('packs')
      .select('id, name, tagline, status, objectives, copy_variants, reward_estimate, campaign_fit_score, admin_notes, created_at, approved_at')
      .eq('proposed_by', partner_id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const packs = (data ?? []).map((p) => ({
      ...p,
      objectives:      safeParse(p.objectives,      []),
      copy_variants:   safeParse(p.copy_variants,   []),
      reward_estimate: safeParse(p.reward_estimate, null),
    }));

    return NextResponse.json({ ok: true, packs });
  } catch (err) {
    console.error('[packs/partner] error:', err);
    return NextResponse.json({ ok: false, error: 'Failed to load packs' }, { status: 500 });
  }
}

function safeParse<T>(val: unknown, fallback: T): T {
  if (typeof val === 'object' && val !== null) return val as T;
  if (typeof val === 'string') {
    try { return JSON.parse(val) as T; } catch { return fallback; }
  }
  return fallback;
}
