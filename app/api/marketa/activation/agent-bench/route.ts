/**
 * GET /api/marketa/activation/agent-bench — Phase B (2026-08-05 canonical
 * Agent Bench plan, §5). Read-only: joins every candidate through
 * `buildAgentBenchRow` and returns rows grouped by lifecycle state
 * (candidate/invited/in-admission/service-ready/engaged). This route owns
 * none of the underlying state — every write still goes through its own
 * existing surface (the Journey, the Passport Review Queue, the Factory,
 * the admission-package route).
 */

import { NextRequest, NextResponse } from 'next/server';

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { dbToCandidate } from '@/services/marketa/activation/normalizers';
import { buildAgentBenchRow, type AgentBenchRow, type BenchLifecycleState } from '@/services/marketa/activation/agentBenchReadModel';

export const dynamic = 'force-dynamic';

function jsonError(error: string, status = 400, detail?: string) {
  return NextResponse.json({ ok: false, error, ...(detail ? { detail } : {}) }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(_request: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) return jsonError('DB unavailable', 503);

  const [candidatesResult, invitationsResult] = await Promise.all([
    supabase.schema('marketa').from('marketa_candidate_agents').select('*').order('updated_at', { ascending: false }).limit(200),
    supabase
      .from('access_invitations')
      .select('external_agent_ref')
      .not('external_agent_ref', 'is', null),
  ]);
  if (candidatesResult.error) return jsonError('candidates-load-failed', 500, candidatesResult.error.message);

  const invitedRefs = new Set((invitationsResult.data ?? []).map((r) => String((r as Record<string, unknown>).external_agent_ref)));
  const candidates = (candidatesResult.data ?? []).map((row) => dbToCandidate(row as Record<string, unknown>));

  const rows = await Promise.all(
    candidates.map((candidate) => {
      const ref = candidate.registryProvider && candidate.onChainAgentId
        ? `${candidate.registryProvider}:${candidate.registryNetwork ?? ''}:${candidate.onChainAgentId}`
        : null;
      return buildAgentBenchRow(supabase, candidate, { hasInvitation: ref !== null && invitedRefs.has(ref) });
    }),
  );

  const grouped: Record<BenchLifecycleState, AgentBenchRow[]> = {
    candidate: [],
    invited: [],
    'in-admission': [],
    'service-ready': [],
    engaged: [],
  };
  for (const row of rows) grouped[row.lifecycleState].push(row);

  return NextResponse.json(
    {
      ok: true,
      counts: {
        candidate: grouped.candidate.length,
        invited: grouped.invited.length,
        inAdmission: grouped['in-admission'].length,
        serviceReady: grouped['service-ready'].length,
        engaged: grouped.engaged.length,
      },
      rows: grouped,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
