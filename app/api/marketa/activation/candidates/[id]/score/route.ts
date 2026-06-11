import { NextRequest, NextResponse } from 'next/server';

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { classifyCandidate } from '@/services/marketa/activation/classification';
import { cleanRevenueScreen } from '@/services/marketa/activation/policy';
import { scoreCandidate } from '@/services/marketa/activation/scoring';
import { dbToCandidate } from '@/services/marketa/activation/normalizers';
import type { CandidateAgentInput } from '@/services/marketa/activation/types';

export const dynamic = 'force-dynamic';

function jsonError(error: string, status = 400, detail?: string) {
  return NextResponse.json({ ok: false, error, ...(detail ? { detail } : {}) }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabaseServer();
  if (!supabase) return jsonError('DB unavailable', 503);

  const { data: row, error: fetchError } = await supabase
    .schema('marketa')
    .from('marketa_candidate_agents')
    .select('*')
    .eq('id', params.id)
    .single();
  if (fetchError || !row) return jsonError('candidate-not-found', 404, fetchError?.message);

  const candidate = dbToCandidate(row as Record<string, unknown>);
  const input: CandidateAgentInput = {
    name: candidate.name,
    description: candidate.description,
    sourceType: candidate.sourceType,
    sourceUrl: candidate.sourceUrl,
    agentCardUrl: candidate.agentCardUrl,
    mcpServerUrl: candidate.mcpServerUrl,
    openapiUrl: candidate.openapiUrl,
    repositoryUrl: candidate.repositoryUrl,
    websiteUrl: candidate.websiteUrl,
    operatorName: candidate.operatorName,
    operatorType: candidate.operatorType,
    capabilities: candidate.capabilities,
    targetUsers: candidate.targetUsers,
    strategicLanes: candidate.strategicLanes,
    verticals: candidate.verticals,
    legalTrack: candidate.legalTrack,
    topBottomRelevance: candidate.topBottomRelevance,
  };
  const classification = classifyCandidate(input);
  const screen = cleanRevenueScreen(input);
  const scores = scoreCandidate(input);

  const update = {
    strategic_lanes: classification.strategicLanes,
    verticals: classification.verticals,
    legal_track: classification.legalTrack,
    top_bottom_relevance: classification.topBottomRelevance,
    scores,
    risk_flags: screen.riskFlags,
    policy_flags: screen.policyFlags,
    activation_status: screen.status === 'likely_clean' ? 'scored' : 'needs_review',
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .schema('marketa')
    .from('marketa_candidate_agents')
    .update(update)
    .eq('id', params.id)
    .select('*')
    .single();
  if (error) return jsonError('candidate-score-failed', 500, error.message);

  const scored = dbToCandidate(data as Record<string, unknown>);
  await supabase
    .schema('marketa')
    .from('marketa_activation_events')
    .insert({
      candidate_agent_id: scored.id,
      event_type: 'candidate_scored',
      summary: `Candidate scored: ${scored.name} (${scores.overallPriorityScore})`,
      actor: 'marketa',
      metadata: { scores, riskFlags: screen.riskFlags, policyFlags: screen.policyFlags },
    });

  return NextResponse.json({ ok: true, candidate: scored }, { headers: { 'Cache-Control': 'no-store' } });
}
