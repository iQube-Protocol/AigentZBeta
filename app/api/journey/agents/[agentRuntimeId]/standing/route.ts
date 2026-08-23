import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { getCrmClient } from '@/services/crm/crmDataAccess';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { resolveRegistrableAgentByRuntimeId } from '@/services/horizen/registrableAgents';
import { resolveAgentAdmissionState } from '@/services/journey/agentAdmissionState';
import { resolveAgentStandingPersonaId } from '@/services/standing/agentStandingPersona';
import { listActivityReceiptsForAgent } from '@/services/receipts/activityReceiptService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/journey/agents/[agentRuntimeId]/standing
 *
 * 2026-08-23 operator directive, "Horizen Journey — Standing observer + DVN
 * liveness closure", part 2: `ParticipationStandingTab` reads `/api/wallet/
 * tasks` and `/api/assistant/receipts`, which resolve the AUTHENTICATED
 * HUMAN CALLER's own Standing/receipts — correct for the standalone
 * participation surface, wrong when a Horizen Journey stage mounts the same
 * component to show a SELECTED AGENT's Standing. Rendering the operator's
 * own human Standing under Nakamoto/Kn0w1/MoneyPenny's Journey view is
 * exactly the defect this route closes.
 *
 * This route ALWAYS resolves the named agent's OWN canonical Standing —
 * never the caller's — using the SAME resolution chain as
 * `resolveAgentStandingPersonaId` (services/standing/agentStandingPersona.ts)
 * and the SAME `agents_invoked`-containment evidence read every other
 * agent-scoped observer in this codebase already uses
 * (`resolveStandingEvidence`, `findAgentReceiptRefs`). The caller must still
 * be an authenticated persona (this is an operator-facing Journey surface,
 * never a public one) — but authentication only GATES access; it never
 * changes WHOSE Standing is returned.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ agentRuntimeId: string }> }): Promise<NextResponse> {
  const { agentRuntimeId } = await context.params;

  const activePersona = await getActivePersona(request);
  if (!activePersona) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const agent = resolveRegistrableAgentByRuntimeId(agentRuntimeId);
  if (!agent) {
    return NextResponse.json({ error: `'${agentRuntimeId}' is not a canonical registrable agent` }, { status: 400 });
  }

  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json({ error: 'db unavailable' }, { status: 503 });
  }

  try {
    const admission = await resolveAgentAdmissionState(admin, agent);
    const agentRootDid = admission?.agentRootDid;
    const standingPersonaId = await resolveAgentStandingPersonaId(admin, agent, agentRootDid);

    let standing: Record<string, number> | null = null;
    let reputation: Record<string, number> | null = null;
    if (standingPersonaId) {
      const crm = getCrmClient();
      const { data: row } = await crm
        .from('crm_persona_reputation')
        .select(
          'standing_personal, standing_delegated, standing_stewardship, standing_capability, standing_overall, standing_bucket, rep_overall, lifetime_cvs, total_tasks_completed',
        )
        .eq('persona_id', standingPersonaId)
        .maybeSingle();
      if (row) {
        standing = {
          personal: Number(row.standing_personal) || 0,
          delegated: Number(row.standing_delegated) || 0,
          stewardship: Number(row.standing_stewardship) || 0,
          capability: Number((row as Record<string, unknown>).standing_capability) || 0,
          overall: Number(row.standing_overall) || 0,
          bucket: Number(row.standing_bucket) || 0,
        };
        reputation = {
          overall: Number((row as Record<string, unknown>).rep_overall) || 0,
          lifetimeCvs: Number((row as Record<string, unknown>).lifetime_cvs) || 0,
          totalTasksCompleted: Number((row as Record<string, unknown>).total_tasks_completed) || 0,
        };
      }
    }

    const receipts = await listActivityReceiptsForAgent(agentRuntimeId, { limit: 25 });

    return NextResponse.json(
      {
        agentRuntimeId,
        agentDisplayName: agent.displayName,
        standingPersonaId: standingPersonaId ?? null,
        standing,
        reputation,
        receipts,
        personaDisplayLabel: agent.displayName,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
