/**
 * KNYT Correspondent — Elevation API
 *
 * Stewards/editors use this to elevate a contributor to correspondent status.
 *
 * POST — elevate a contributor
 *   body: { persona_id, elevated_by, notes? }
 *   - Writes 'knyt:correspondent' entitlement to crm_entitlements.
 *   - Creates a reward grant for LivingCanonCorrespondentElevation.
 *   - Writes an authoritative Order state record to knyt_publication_state_log
 *     (elevation is a rights-bearing change — Codex must record it).
 *
 * GET — check correspondent status
 *   ?persona_id=<id>
 *   Returns whether persona has 'knyt:correspondent' entitlement.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CORRESPONDENT_ENTITLEMENT = 'knyt:correspondent';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const personaId = searchParams.get('persona_id');

    if (!personaId) {
      return NextResponse.json({ error: 'persona_id is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('crm_entitlements')
      .select('id, granted_at, granted_by, metadata')
      .eq('persona_id', personaId)
      .eq('entitlement_type', CORRESPONDENT_ENTITLEMENT)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({
      persona_id: personaId,
      is_correspondent: !!data,
      entitlement: data ?? null,
    });
  } catch (err) {
    console.error('[correspondent GET] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { persona_id, elevated_by, notes } = body;

    if (typeof persona_id !== 'string' || !persona_id)
      return NextResponse.json({ error: 'persona_id is required' }, { status: 400 });
    if (typeof elevated_by !== 'string' || !elevated_by)
      return NextResponse.json({ error: 'elevated_by (steward persona_id) is required' }, { status: 400 });

    // 1. Check not already a correspondent
    const { data: existing } = await supabase
      .from('crm_entitlements')
      .select('id')
      .eq('persona_id', persona_id)
      .eq('entitlement_type', CORRESPONDENT_ENTITLEMENT)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'Persona is already a correspondent' }, { status: 409 });
    }

    const now = new Date().toISOString();

    // 2. Grant entitlement
    const { data: entitlement, error: entitlementErr } = await supabase
      .from('crm_entitlements')
      .insert({
        persona_id,
        entitlement_type: CORRESPONDENT_ENTITLEMENT,
        granted_by: elevated_by,
        granted_at: now,
        metadata: {
          world_id: '21sats',
          elevation_notes: notes ?? null,
          elevated_by,
        },
      })
      .select()
      .single();

    if (entitlementErr) throw entitlementErr;

    // 3. Emit elevation reward grant
    await supabase.from('knyt_reward_grants').insert({
      persona_id,
      task_type: 'LivingCanonCorrespondentElevation',
      amount_knyt: 1.5, // base amount from rewardService.ts
      base_amount_knyt: 1.5,
      rep_multiplier: 1.0,
      source_event_id: entitlement.id,
      metadata: { elevated_by, world_id: '21sats', notes: notes ?? null },
    }).catch((e) => console.warn('[correspondent] reward grant failed (non-fatal):', e));

    // 4. Record Order-affecting state change in publication state log
    //    This is a rights-bearing change — must be traceable via Codex.
    await supabase.from('knyt_publication_state_log').insert({
      publication_id: '00000000-0000-0000-0000-000000000000', // sentinel for persona-level events
      from_state: null,
      to_state: 'approved', // closest FSM state for entitlement grant
      actor_persona: elevated_by,
      reason: `Correspondent elevation granted${notes ? `: ${notes}` : ''}`,
      autodrive_cid: null, // CID written by separate Codex archival job
    }).catch((e) => console.warn('[correspondent] audit log failed (non-fatal):', e));

    return NextResponse.json({
      success: true,
      persona_id,
      entitlement,
      message: 'Correspondent status granted. Wallet entitlement active.',
    });
  } catch (err) {
    console.error('[correspondent POST] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
