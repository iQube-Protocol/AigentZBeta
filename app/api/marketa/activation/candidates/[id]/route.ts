import { NextRequest, NextResponse } from 'next/server';

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { candidatePatchToDb, dbToCandidate } from '@/services/marketa/activation/normalizers';

export const dynamic = 'force-dynamic';

function jsonError(error: string, status = 400, detail?: string) {
  return NextResponse.json({ ok: false, error, ...(detail ? { detail } : {}) }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = getSupabaseServer();
  if (!supabase) return jsonError('DB unavailable', 503);

  const [{ data, error }, eventsResult, opportunitiesResult] = await Promise.all([
    supabase.schema('marketa').from('marketa_candidate_agents').select('*').eq('id', params.id).single(),
    supabase.schema('marketa').from('marketa_activation_events').select('*').eq('candidate_agent_id', params.id).order('created_at', { ascending: false }).limit(50),
    supabase.schema('marketa').from('marketa_candidate_opportunities').select('*').eq('candidate_agent_id', params.id).order('updated_at', { ascending: false }),
  ]);

  if (error) return jsonError('candidate-not-found', 404, error.message);

  return NextResponse.json({
    ok: true,
    candidate: dbToCandidate(data as Record<string, unknown>),
    events: eventsResult.data ?? [],
    opportunities: opportunitiesResult.data ?? [],
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = getSupabaseServer();
  if (!supabase) return jsonError('DB unavailable', 503);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonError('invalid-json');
  }

  const patch = candidatePatchToDb(raw);
  if (Object.keys(patch).length <= 1) return jsonError('empty-patch');

  const { data, error } = await supabase
    .schema('marketa')
    .from('marketa_candidate_agents')
    .update(patch)
    .eq('id', params.id)
    .select('*')
    .single();

  if (error) return jsonError('candidate-update-failed', 500, error.message);

  const candidate = dbToCandidate(data as Record<string, unknown>);
  await supabase
    .schema('marketa')
    .from('marketa_activation_events')
    .insert({
      candidate_agent_id: candidate.id,
      event_type: 'candidate_updated',
      summary: `Candidate updated: ${candidate.name}`,
      actor: 'marketa',
      metadata: { fields: Object.keys(patch).filter((key) => key !== 'updated_at') },
    });

  return NextResponse.json({ ok: true, candidate }, { headers: { 'Cache-Control': 'no-store' } });
}
