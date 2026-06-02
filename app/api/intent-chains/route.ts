/**
 * GET /api/intent-chains — list chains.
 *
 * Query:
 *   ?status=active|waiting|completed|failed|cancelled   filter
 *   ?cartridge=...                                       filter
 *   ?template_id=...                                     filter
 *   ?limit=50                                            cap (default 50, max 500)
 *
 * Auth: spine. Returns only the caller's own chains unless caller is
 * admin (then any with ?persona_id=... param).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_STATUS = new Set(['active', 'waiting', 'completed', 'failed', 'cancelled']);

export async function GET(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const url = new URL(request.url);
  const status = url.searchParams.get('status') ?? '';
  const cartridge = url.searchParams.get('cartridge') ?? '';
  const template_id = url.searchParams.get('template_id') ?? '';
  const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get('limit') ?? '50', 10), 1), 500);

  // Admin-only override to list someone else's chains
  let target_persona_id = persona.personaId;
  const isAdmin = Boolean(persona.cartridgeFlags?.isAdmin);
  if (isAdmin) {
    const p = url.searchParams.get('persona_id');
    if (p && p.length >= 4) target_persona_id = p;
  }

  const sb = getSupabaseServer();
  if (!sb) return NextResponse.json({ error: 'storage_unavailable' }, { status: 503 });

  // T1-safe column list — never select initiated_by_persona_id
  let q = sb
    .from('intent_chains')
    .select(
      'chain_id, template_id, template_version, initiating_nbe_id, initiated_by_alias_commitment, cartridge, status, current_step_id, current_step_kind, current_step_started_at, scheduled_advance_at, wait_timeout_at, cost_qc, charge_status, started_at, terminated_at, termination_outcome, updated_at',
    )
    .eq('initiated_by_persona_id', target_persona_id)
    .order('started_at', { ascending: false })
    .limit(limit);

  if (status && VALID_STATUS.has(status)) q = q.eq('status', status);
  if (cartridge) q = q.eq('cartridge', cartridge);
  if (template_id) q = q.eq('template_id', template_id);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: 'query_failed', detail: error.message }, { status: 500 });

  return NextResponse.json({ chains: data ?? [], total: (data ?? []).length });
}
