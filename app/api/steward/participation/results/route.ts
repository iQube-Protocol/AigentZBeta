/**
 * /api/steward/participation/results — steward approval of participant result
 * publications (mirrors the myCanvas publish-approval pattern). Admin-gated.
 *
 * A participant saves experiment results private, then requests public
 * publication (visibility='pending'). A steward reviews the queue here and
 * approves (→ 'published', joins the canon) or rejects (→ back to 'private').
 *
 *   GET   → the pending-publication queue (T2-safe: hashes + commitments, no
 *           raw submitter persona id).
 *   PATCH { resultId, action: 'approve' | 'reject' }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const dynamic = 'force-dynamic';

async function requireSteward(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return { error: NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 }) };
  if (!persona.cartridgeFlags?.isAdmin) return { error: NextResponse.json({ ok: false, error: 'Steward access required' }, { status: 403 }) };
  return { persona };
}

export async function GET(req: NextRequest) {
  const gate = await requireSteward(req);
  if ('error' in gate) return gate.error;
  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Supabase configuration missing' }, { status: 500 });

  const { data, error } = await admin
    .from('experiment_results')
    .select('id, experiment, provider, model, content_hash, submitted_by_persona_id, created_at')
    .eq('visibility', 'pending')
    .order('created_at', { ascending: false });
  if (error) {
    if (error.message.includes('visibility')) {
      return NextResponse.json({ ok: true, pending: [], migrationPending: '20260727000000_access_allowed_experiments.sql' });
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json(
    {
      ok: true,
      pending: (data ?? []).map((r) => ({
        id: String(r.id),
        experiment: String(r.experiment),
        provider: String(r.provider),
        model: String(r.model),
        contentHash: String(r.content_hash),
        submitterRef: r.submitted_by_persona_id
          ? createHash('sha256').update(String(r.submitted_by_persona_id)).digest('hex').slice(0, 16)
          : null,
        createdAt: String(r.created_at),
      })),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function PATCH(req: NextRequest) {
  const gate = await requireSteward(req);
  if ('error' in gate) return gate.error;
  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Supabase configuration missing' }, { status: 500 });

  const body = (await req.json().catch(() => ({}))) as { resultId?: string; action?: string };
  if (!body.resultId || (body.action !== 'approve' && body.action !== 'reject')) {
    return NextResponse.json({ ok: false, error: "resultId and action:'approve'|'reject' required" }, { status: 400 });
  }

  const update =
    body.action === 'approve'
      ? { visibility: 'published', approved_by_persona_id: gate.persona.personaId, approved_at: new Date().toISOString() }
      : { visibility: 'private' };

  const { data, error } = await admin
    .from('experiment_results')
    .update(update)
    .eq('id', body.resultId)
    .eq('visibility', 'pending')
    .select('id');
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!data || data.length === 0) return NextResponse.json({ ok: false, error: 'No pending result with that id' }, { status: 404 });
  return NextResponse.json({ ok: true, action: body.action });
}
