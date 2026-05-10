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
import { emitDecisionReceipt } from '@/services/access/receiptEmitter';
import type {
  ActivePersonaContext,
  ContentAccessDescriptor,
  AccessDecision,
} from '@/types/access';

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

  // ─── Test 1: direct insert (same as before) ─────────────────────────
  const directEventId = `diag_direct_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const directInsert = await sb.from('orchestration_events').insert({
    event_id: directEventId,
    event_type: 'access_decision',
    from_role: 'aigent-z',
    to_role: 'aigent-c',
    reason: 'phase3 diag direct',
    journey_stage: 'acolyte',
    receipt_eligible: true,
    metadata: { diag: true },
    created_at: new Date().toISOString(),
    actor_alias_commitment: 'diag_test_alias',
    cohort_id: 'default',
    receipt_mode: 'async',
  }).select();

  // ─── Test 2: through emitDecisionReceipt (the real call path) ────────
  const emitTestPersona: ActivePersonaContext = {
    personaId: '__diag_test_persona__',
    authProfileId: '__diag_test_authprofile__',
    identifiability: 'pseudo',
    cartridgeFlags: { isAdmin: false, isPartner: false },
    cohortMemberships: [],
    fioHandle: null,
    source: 'session-token',
  };
  const emitTestDescriptor: ContentAccessDescriptor = {
    assetId: '__diag_test_asset__',
    contentClass: 'other',
    state: 'A_open_unqubed',
    gating: { kind: 'free' },
    receiptEligible: true,
    iqube: {
      metaQubeId: '',
      blakQubeId: '',
      encryption: { alg: 'AES-256-GCM' },
      storage: { backend: 'supabase', pointer: '' },
    },
  };
  const emitTestDecision: AccessDecision = {
    allow: true,
    reason: 'free',
    deliveryMode: 'plain-redirect',
    receipt: {
      mode: 'async',
      aliasCommitment: 'diag_emitDecisionReceipt_test',
      cohortId: 'default',
    },
  };

  let emitError: string | null = null;
  try {
    await emitDecisionReceipt({
      context: emitTestPersona,
      descriptor: emitTestDescriptor,
      action: 'read',
      decision: emitTestDecision,
    });
  } catch (e) {
    emitError = e instanceof Error ? e.message : String(e);
  }

  const { data: emitRow } = await sb
    .from('orchestration_events')
    .select('event_id, actor_alias_commitment, created_at')
    .eq('actor_alias_commitment', 'diag_emitDecisionReceipt_test')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Cleanup
  await sb.from('orchestration_events').delete().eq('event_id', directEventId);
  if (emitRow) {
    await sb.from('orchestration_events').delete().eq('event_id', emitRow.event_id);
  }

  return NextResponse.json({
    env,
    direct_insert: {
      ok: !directInsert.error,
      error: directInsert.error
        ? {
            code: (directInsert.error as { code?: string }).code,
            message: directInsert.error.message,
            details: (directInsert.error as { details?: string }).details,
          }
        : null,
    },
    emit_decision_receipt: {
      thrown: emitError,
      row_landed: !!emitRow,
      row: emitRow,
    },
  });
}
