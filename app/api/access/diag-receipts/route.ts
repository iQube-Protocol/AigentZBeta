/**
 * Phase 3 diagnostic endpoint — surfaces the actual orchestration_events
 * insert error directly in the HTTP response so we can see what's
 * blocking receipt writes without CloudWatch access.
 *
 * Tries a service-role insert with a known-valid row shape; returns:
 *   - env-var presence checks (SERVICE_ROLE_KEY length, NOT the value)
 *   - the supabase insert response (data + error)
 *   - whether the row landed (separate select)
 *
 * Remove this endpoint after Phase 3 receipt emission is confirmed live.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  const env = {
    has_url: !!url,
    has_service_key: !!serviceKey,
    service_key_length: serviceKey.length,
    service_key_prefix: serviceKey.slice(0, 8),
    has_anon_key: !!anonKey,
    anon_key_length: anonKey.length,
    using_anon_fallback: !serviceKey && !!anonKey,
  };

  if (!url || (!serviceKey && !anonKey)) {
    return NextResponse.json({ env, error: 'env vars missing' }, { status: 500 });
  }

  const sb = createClient(url, serviceKey || anonKey, { auth: { persistSession: false } });
  const eventId = `diag_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const insertPayload = {
    event_id: eventId,
    event_type: 'access_decision',
    from_role: 'aigent-z',
    to_role: 'aigent-c',
    reason: 'phase3 diag',
    journey_stage: 'acolyte',
    active_cartridge: null,
    receipt_eligible: true,
    metadata: { diag: true },
    created_at: new Date().toISOString(),
    actor_alias_commitment: 'diag_test_alias',
    cohort_id: 'default',
    receipt_mode: 'async',
  };

  const { data: insertData, error: insertError } = await sb
    .from('orchestration_events')
    .insert(insertPayload)
    .select();

  const { data: selectData } = await sb
    .from('orchestration_events')
    .select('event_id, receipt_mode, actor_alias_commitment')
    .eq('event_id', eventId)
    .maybeSingle();

  // Cleanup the diagnostic row so we don't pollute the table
  if (selectData) {
    await sb.from('orchestration_events').delete().eq('event_id', eventId);
  }

  return NextResponse.json({
    env,
    insert: {
      ok: !insertError,
      error: insertError
        ? {
            code: (insertError as { code?: string }).code,
            message: insertError.message,
            details: (insertError as { details?: string }).details,
            hint: (insertError as { hint?: string }).hint,
          }
        : null,
      data: insertData,
    },
    select_after_insert: selectData,
  });
}
