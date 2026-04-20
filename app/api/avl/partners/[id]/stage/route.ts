/**
 * POST /api/avl/partners/[id]/stage
 *
 * Records a BD stage transition for a partner contact.
 * Updates bd_stage on the contact and inserts a row into avl_partner_stage_events.
 *
 * Body: { to_stage: string, changed_by?: string, notes?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const dynamic = 'force-dynamic';

const VALID_STAGES = [
  'uncontacted',
  'first_contact',
  'responded',
  'active',
  'co_activation_agreed',
  'integration_scoped',
  'integration_active',
  'live_partner',
  'low_signal',
];

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'DB unavailable' }, { status: 503 });
  }

  const { id } = params;
  if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });

  let body: { to_stage?: string; changed_by?: string; notes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { to_stage, changed_by, notes } = body;
  if (!to_stage || !VALID_STAGES.includes(to_stage)) {
    return NextResponse.json(
      { ok: false, error: `to_stage must be one of: ${VALID_STAGES.join(', ')}` },
      { status: 400 },
    );
  }

  try {
    const { data: current, error: fetchErr } = await supabase
      .from('avl_partner_contacts')
      .select('bd_stage')
      .eq('id', id)
      .single();

    if (fetchErr || !current) {
      return NextResponse.json({ ok: false, error: 'Partner not found' }, { status: 404 });
    }

    const from_stage = (current as { bd_stage: string }).bd_stage;

    const updateFields: Record<string, unknown> = { bd_stage: to_stage };
    if (to_stage !== 'uncontacted' && !['low_signal'].includes(to_stage)) {
      updateFields.last_contact_at = new Date().toISOString();
      if (from_stage === 'uncontacted') {
        updateFields.first_contact_at = new Date().toISOString();
        updateFields.outreach_status = 'contacted';
      }
    }
    if (['responded', 'active', 'co_activation_agreed', 'integration_scoped', 'integration_active', 'live_partner'].includes(to_stage)) {
      updateFields.outreach_status = 'responded';
    }

    const [{ error: updateErr }, { error: eventErr }] = await Promise.all([
      supabase.from('avl_partner_contacts').update(updateFields).eq('id', id),
      supabase.from('avl_partner_stage_events').insert({
        partner_id: id,
        from_stage,
        to_stage,
        changed_by: changed_by ?? 'operator',
        notes: notes ?? null,
      }),
    ]);

    if (updateErr) throw updateErr;
    if (eventErr) throw eventErr;

    return NextResponse.json({ ok: true, from_stage, to_stage });
  } catch (err) {
    console.error('[avl/partners/[id]/stage] error:', err);
    return NextResponse.json({ ok: false, error: 'Stage transition failed' }, { status: 500 });
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'DB unavailable' }, { status: 503 });
  }

  try {
    const { data, error } = await supabase
      .from('avl_partner_stage_events')
      .select('*')
      .eq('partner_id', params.id)
      .order('changed_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ ok: true, data: data ?? [] });
  } catch (err) {
    console.error('[avl/partners/[id]/stage GET] error:', err);
    return NextResponse.json({ ok: false, error: 'Failed to load stage history' }, { status: 500 });
  }
}
