/**
 * PATCH /api/vsp/facts/[factId]
 *
 * Approve, reject, or correct a VSP fact.
 * Cannot modify locked facts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, props: { params: Promise<{ factId: string }> }) {
  const params = await props.params;
  try {
    const persona = await getActivePersona(req);
    if (!persona?.personaId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }
    const supabase = getSupabaseServer();
    const isAdmin = persona.cartridgeFlags?.isAdmin === true;

    // Fetch fact + profile ownership in one join
    const { data: fact, error: factErr } = await supabase
      .from('vsp_facts')
      .select('id, profile_id, locked_at, status')
      .eq('id', params.factId)
      .single();

    if (factErr || !fact) {
      return NextResponse.json({ ok: false, error: 'Fact not found' }, { status: 404 });
    }

    // Verify ownership
    if (!isAdmin) {
      const { data: profile } = await supabase
        .from('vsp_profiles')
        .select('id')
        .eq('id', fact.profile_id)
        .eq('owner_persona_id', persona.personaId)
        .maybeSingle();
      if (!profile) {
        return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
      }
    }

    if (fact.locked_at) {
      return NextResponse.json({ ok: false, error: 'Fact is locked and cannot be modified' }, { status: 409 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      action?: 'approve' | 'reject' | 'correct';
      corrected_value?: string;
    };

    if (!body.action || !['approve','reject','correct'].includes(body.action)) {
      return NextResponse.json({ ok: false, error: 'action must be approve, reject, or correct' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (body.action === 'approve') {
      updates.status = 'approved';
      updates.approved_at = new Date().toISOString();
    } else if (body.action === 'reject') {
      updates.status = 'rejected';
    } else if (body.action === 'correct') {
      if (!body.corrected_value) {
        return NextResponse.json({ ok: false, error: 'corrected_value required for correct action' }, { status: 400 });
      }
      updates.status = 'corrected';
      updates.principal_value = body.corrected_value;
      updates.confidence = 'PRINCIPAL_VERIFIED';
      updates.approved_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('vsp_facts')
      .update(updates)
      .eq('id', params.factId)
      .select('id, domain, field, label, extracted_value, confidence, status, principal_value, approved_at, locked_at')
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, fact: data });
  } catch (err) {
    console.error('[vsp/facts/[factId] PATCH]', err);
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}
