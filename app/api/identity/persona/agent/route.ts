/**
 * POST /api/identity/persona/agent
 *
 * Phase 1 / G2 — agent persona genesis. After a citizen sponsors an agent via
 * POST /api/agents/genesis (which writes the agent_root_identity row), this
 * endpoint provisions the agent's persona-layer row in agent_persona, bound to
 * the sponsoring citizen under the bounded-delegation model (agent_class
 * 'polity_bound'). It is the follow-up the genesis route documents in its
 * nextSteps.
 *
 * Why a separate row: agent_persona is the persona layer for agent identities
 * (parallel to did_persona for humans). Delegated Standing (Phase 2) and the
 * locker grant flow read delegation_persona_id off this row; until it exists
 * those paths fall back to the sponsor persona as a placeholder.
 *
 * FK resolution (spine-critical, T0):
 *   - delegation_user_root_id → root_identity(id): resolved from the sponsor's
 *     personas.root_did → root_identity.did_uri (the reliable link bind writes;
 *     NOT via authProfileId, which is the multi-email-merged id and may differ
 *     from root_identity.auth_user_id).
 *   - delegation_persona_id → did_persona(id): the sponsor's Bureau did_persona
 *     (root_id + app_origin='polity-passport-bureau'); nullable if absent.
 *
 * T0 discipline: the caller's personaId and the resolved root_identity /
 * did_persona ids are used server-side only and never serialised. The response
 * carries the agent's own DID + persona id (agent-tier identifiers) and
 * booleans describing what was anchored.
 *
 * Authorisation: caller must be the agent's sponsor
 * (agent_root_identity.sponsor_persona_id === caller persona).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { provisionAgentPersona } from '@/services/agents/provisionAgentPersona';

export const dynamic = 'force-dynamic';

interface AgentPersonaBody {
  agentRootId: string;
  personaRole?: string;
}

export async function POST(req: NextRequest) {
  try {
    const persona = await getActivePersona(req);
    if (!persona?.personaId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as AgentPersonaBody;
    const admin = getSupabaseServer();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'Supabase configuration missing' }, { status: 500 });
    }

    const { status, ...outcome } = await provisionAgentPersona({
      admin,
      sponsorPersonaId: persona.personaId,
      agentRootId: body.agentRootId?.trim() ?? '',
      personaRole: body.personaRole,
    });
    return NextResponse.json(outcome, { status });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Agent persona genesis failed' },
      { status: 500 },
    );
  }
}
