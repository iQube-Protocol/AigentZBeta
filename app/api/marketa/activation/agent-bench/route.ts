/**
 * GET /api/marketa/activation/agent-bench — Phase B (2026-08-05 canonical
 * Agent Bench plan, §5; extended 2026-08-05 per the "Agent Bench —
 * Canonical Agent Lifecycle Brief"). Read-only: joins every candidate
 * through `buildAgentBenchRow` and returns rows grouped by lifecycle state
 * (candidate/invited/in-admission/service-ready/engaged). This route owns
 * none of the underlying state — every write still goes through its own
 * existing surface (the Journey, the Passport Review Queue, the Factory,
 * the admission-package route).
 *
 * The row set is the UNION of Marketa candidates AND every
 * `RegistrableAgentConfig` (services/horizen/registrableAgents.ts) not
 * already linked to one — never a second admission process, and never
 * synthetic data. Aigent Nakamoto has no Marketa candidate row (she
 * predates Marketa's discovery pipeline), so she is included via this
 * union, projected entirely from her own real records. A registrable
 * agent already linked to a Marketa candidate (via `runtimeAgentId`) is
 * covered ONCE, through that candidate's row — never duplicated.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { dbToCandidate } from '@/services/marketa/activation/normalizers';
import { listRegistrableAgents } from '@/services/horizen/registrableAgents';
import {
  buildAgentBenchRow,
  type AgentBenchRow,
  type BenchLifecycleState,
  type BenchSubject,
} from '@/services/marketa/activation/agentBenchReadModel';

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
  const linkedRuntimeIds = new Set(candidates.map((c) => c.runtimeAgentId).filter((id): id is string => !!id));

  const subjects: BenchSubject[] = [
    ...candidates.map((candidate): BenchSubject => ({ kind: 'marketa', candidate })),
    // Registrable agents with no linked Marketa candidate yet — e.g. Aigent
    // Nakamoto, admitted before Marketa's discovery pipeline existed. Never
    // a duplicate of a linked candidate's row.
    ...listRegistrableAgents()
      .filter((agent) => !linkedRuntimeIds.has(agent.runtimeAgentId))
      .map((agent): BenchSubject => ({ kind: 'registrable-agent', agent })),
  ];

  const rows = await Promise.all(
    subjects.map((subject) => {
      if (subject.kind === 'marketa') {
        const { candidate } = subject;
        const ref = candidate.registryProvider && candidate.onChainAgentId
          ? `${candidate.registryProvider}:${candidate.registryNetwork ?? ''}:${candidate.onChainAgentId}`
          : null;
        return buildAgentBenchRow(supabase, subject, { hasInvitation: ref !== null && invitedRefs.has(ref) });
      }
      // A registrable-agent-only row predates the Admission Package /
      // Access & Invitations mechanism — it is never mid-invitation by this
      // route's own doing, and its real admission facts (resolved inside
      // buildAgentBenchRow) already determine its lifecycle regardless.
      return buildAgentBenchRow(supabase, subject, { hasInvitation: false });
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
