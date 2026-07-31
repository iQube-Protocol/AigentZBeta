import { NextRequest, NextResponse } from 'next/server';

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { candidateInputToDb, dbToCandidate, normalizeCandidateInput } from '@/services/marketa/activation/normalizers';

export const dynamic = 'force-dynamic';

function jsonError(error: string, status = 400, detail?: string) {
  return NextResponse.json({ ok: false, error, ...(detail ? { detail } : {}) }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(request: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) return jsonError('DB unavailable', 503);

  const { searchParams } = request.nextUrl;
  const lane = searchParams.get('lane');
  const vertical = searchParams.get('vertical');
  const activationStatus = searchParams.get('activationStatus');
  const legalTrack = searchParams.get('legalTrack');
  const mobility = searchParams.get('mobility');
  const search = searchParams.get('q');
  const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? '50') || 50, 1), 200);

  let query = supabase
    .schema('marketa')
    .from('marketa_candidate_agents')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (activationStatus) query = query.eq('activation_status', activationStatus);
  if (legalTrack) query = query.eq('legal_track', legalTrack);
  if (lane) query = query.contains('strategic_lanes', [lane]);
  if (vertical) query = query.contains('verticals', [vertical]);
  if (mobility) query = query.eq('top_bottom_relevance->>mobilityReferenceTag', mobility);
  if (search) query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,operator_name.ilike.%${search}%`);

  const { data, error } = await query;
  if (error) return jsonError('candidate-list-failed', 500, error.message);

  return NextResponse.json({
    ok: true,
    candidates: (data ?? []).map((row) => dbToCandidate(row as Record<string, unknown>)),
    count: data?.length ?? 0,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) return jsonError('DB unavailable', 503);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonError('invalid-json');
  }

  let input;
  try {
    input = normalizeCandidateInput(raw);
  } catch (err) {
    return jsonError('invalid-candidate', 400, err instanceof Error ? err.message : String(err));
  }

  const insert = candidateInputToDb(input);
  const { data, error } = await supabase
    .schema('marketa')
    .from('marketa_candidate_agents')
    .insert(insert)
    .select('*')
    .single();

  if (error) return jsonError('candidate-create-failed', 500, error.message);

  const candidate = dbToCandidate(data as Record<string, unknown>);
  await supabase
    .schema('marketa')
    .from('marketa_activation_events')
    .insert({
      candidate_agent_id: candidate.id,
      event_type: 'candidate_created',
      summary: `Candidate created: ${candidate.name}`,
      actor: 'marketa',
      metadata: { sourceType: candidate.sourceType },
    });

  return NextResponse.json({ ok: true, candidate }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}
