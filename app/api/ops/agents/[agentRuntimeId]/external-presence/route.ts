import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { requireAdminPersona } from '@/app/api/_lib/requireAdmin';
import { resolveRegistrableAgentByRuntimeId } from '@/services/horizen/registrableAgents';
import { resolveAgentAdmissionState } from '@/services/journey/agentAdmissionState';
import { resolveAgentExternalPresence } from '@/services/horizen/agentDiDQubeExternalPresence';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/ops/agents/[agentRuntimeId]/external-presence
 *
 * DiDQube Phase 4 item 7's first real caller (2026-09-08 follow-up to the
 * execution plan's "the seam exists for the next real caller to use" —
 * `services/horizen/agentDiDQubeExternalPresence.ts::resolveAgentExternalPresence`
 * was implemented and tested but had no route/UI consumer). This is a
 * read-only, admin/ops diagnostic surface — never a gating decision — that
 * reports a named agent's Horizen registration + iQube Registry presence
 * ONLY behind the DiDQube-first ordering the seam enforces: an unresolved,
 * conflicted, or ambiguous DiDQube short-circuits before either external
 * read runs, so a Horizen tokenId or Registry asset id can never be reported
 * as if it were itself sufficient to establish this agent's identity.
 *
 * Deliberately does NOT replace any existing display surface (e.g. Agent
 * Bench's `buildAgentBenchRow`, which reads Horizen/Registry state directly
 * for descriptive dashboard rendering — not a gating decision, so it was not
 * force-migrated onto this seam per the execution plan's own instruction not
 * to force an unrelated refactor of an already-working consumer). This route
 * is new and additive: an operator/ops surface for confirming the
 * DiDQube-vs-external-identifier ordering holds for a specific agent,
 * on demand.
 *
 * Auth: same dual path as `standing-didqube-reconciliation` — either an
 * x-cron-token/Bearer CRON_TRIGGER_TOKEN header (headless/automation) or an
 * authenticated admin persona session via `requireAdminPersona`.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ agentRuntimeId: string }> },
): Promise<NextResponse> {
  const cronExpected = process.env.CRON_TRIGGER_TOKEN;
  const cronProvided =
    request.headers.get('x-cron-token') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const isCronAuthorized = Boolean(cronExpected) && cronProvided === cronExpected;

  if (!isCronAuthorized) {
    const isAdmin = await requireAdminPersona(request);
    if (!isAdmin) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 403 });
    }
  }

  const { agentRuntimeId } = await context.params;
  const agent = resolveRegistrableAgentByRuntimeId(agentRuntimeId);
  if (!agent) {
    return NextResponse.json({ error: `'${agentRuntimeId}' is not a canonical registrable agent` }, { status: 400 });
  }

  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json({ error: 'db unavailable' }, { status: 503 });
  }

  try {
    // agentRootId (not agentRootDid) is what resolveAgentExternalPresence
    // needs — it re-resolves the DiDQube from the agent_root_identity row's
    // OWN id via resolveDiDQube, never from the caller-supplied did_uri
    // string, so this route can never smuggle in an unverified identity.
    const admission = await resolveAgentAdmissionState(admin, agent);
    if (!admission.agentRootId) {
      return NextResponse.json(
        {
          ok: true,
          agentRuntimeId,
          agentDisplayName: agent.displayName,
          externalPresence: {
            didqubeResolved: false,
            reason: 'no agent_root_identity row for this agent yet',
          },
        },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const externalPresence = await resolveAgentExternalPresence(admin, admission.agentRootId, agent);
    return NextResponse.json(
      { ok: true, agentRuntimeId, agentDisplayName: agent.displayName, externalPresence },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
