/**
 * GET /api/mvl/partners/by-email?email=...
 *
 * Lightweight identity check — returns the MVL partner record whose
 * contact_email matches the supplied email address.
 *
 * Used by CodexPanelDynamic to auto-resolve isPartner + partnerId
 * when the Marketa cartridge loads with a personaId that looks like
 * an email.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email')?.trim().toLowerCase();

  if (!email || !email.includes('@')) {
    return NextResponse.json({ ok: false, partner: null });
  }

  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'DB unavailable' }, { status: 503 });
  }

  try {
    const { data, error } = await supabase
      .from('avl_partner_contacts')
      .select('id, name, org, wave, outreach_status')
      .ilike('contact_email', email)
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return NextResponse.json({ ok: true, partner: null });
    }

    return NextResponse.json({ ok: true, partner: data });
  } catch (err) {
    console.error('[mvl/partners/by-email] error:', err);
    return NextResponse.json({ ok: false, error: 'Lookup failed' }, { status: 500 });
  }
}
