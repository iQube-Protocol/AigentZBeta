/**
 * GET /api/avl/partners/[id]
 *
 * Returns a single partner contact by ID. Used by partner-facing tabs
 * to load the current partner's own record.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'DB unavailable' }, { status: 503 });
  }

  const { id } = params;
  if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });

  try {
    const { data, error } = await supabase
      .from('avl_partner_contacts')
      .select('id, name, org, wave, contact_email, outreach_status, bd_stage, notes, strategic_value_tier')
      .eq('id', id)
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error('[avl/partners/[id]] error:', err);
    return NextResponse.json({ ok: false, error: 'Partner not found' }, { status: 404 });
  }
}
