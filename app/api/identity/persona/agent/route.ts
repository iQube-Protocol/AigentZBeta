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

export const dynamic = 'force-dynamic';

const BUREAU_APP_ORIGIN = 'polity-passport-bureau';

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
    const agentRootId = body.agentRootId?.trim();
    if (!agentRootId) {
      return NextResponse.json(
        { ok: false, error: 'agentRootId is required — the id returned by /api/agents/genesis' },
        { status: 400 },
      );
    }

    const admin = getSupabaseServer();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'Supabase configuration missing' }, { status: 500 });
    }

    // 1. Load the agent root identity and verify the caller sponsors it.
    const { data: agentRoot, error: agentErr } = await admin
      .from('agent_root_identity')
      .select('id, agent_id, did_uri, agent_class, agent_card_slug, sponsor_persona_id, sponsor_passport_id, display_name')
      .eq('id', agentRootId)
      .maybeSingle();

    if (agentErr) {
      if (agentErr.message.includes('sponsor_persona_id') || agentErr.message.includes('agent_card_slug')) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Pending migration: 20260613200000_agent_genesis_polity_bound.sql must be applied before agent persona genesis.',
          },
          { status: 503 },
        );
      }
      return NextResponse.json({ ok: false, error: agentErr.message }, { status: 500 });
    }
    if (!agentRoot) {
      return NextResponse.json({ ok: false, error: 'Agent root identity not found' }, { status: 404 });
    }
    if (agentRoot.sponsor_persona_id !== persona.personaId) {
      return NextResponse.json(
        { ok: false, error: 'Caller does not sponsor this agent' },
        { status: 403 },
      );
    }
    if (!agentRoot.agent_card_slug) {
      return NextResponse.json(
        { ok: false, error: 'Agent has no card slug — re-run genesis before creating its persona' },
        { status: 409 },
      );
    }

    // 2. Idempotency — one production persona per agent root. Return the
    //    existing row rather than minting a duplicate.
    const { data: existing } = await admin
      .from('agent_persona')
      .select('id, did_uri, agent_root_id, persona_role, max_identifiability, created_at')
      .eq('agent_root_id', agentRootId)
      .limit(1);
    if (existing && existing.length > 0) {
      const row = existing[0];
      return NextResponse.json({
        ok: true,
        alreadyExists: true,
        agentPersona: {
          agentPersonaId: String(row.id),
          didUri: String(row.did_uri),
          agentRootId: String(row.agent_root_id),
          personaRole: row.persona_role ?? null,
          maxIdentifiability: String(row.max_identifiability),
          createdAt: row.created_at,
        },
      });
    }

    // 3. Resolve the sponsor's root_identity via personas.root_did →
    //    root_identity.did_uri (the link bindBureauIdentity writes). This is
    //    the reliable mapping; authProfileId is the merged caller id and may
    //    not equal root_identity.auth_user_id.
    const { data: sponsorPersona, error: sponsorPersonaErr } = await admin
      .from('personas')
      .select('root_did')
      .eq('id', persona.personaId)
      .maybeSingle();
    if (sponsorPersonaErr) {
      return NextResponse.json({ ok: false, error: sponsorPersonaErr.message }, { status: 500 });
    }
    const sponsorRootDid = sponsorPersona?.root_did;
    if (!sponsorRootDid) {
      return NextResponse.json(
        { ok: false, error: 'Sponsor persona has no root DID — cannot anchor bounded delegation' },
        { status: 409 },
      );
    }

    const { data: rootRow, error: rootErr } = await admin
      .from('root_identity')
      .select('id')
      .eq('did_uri', sponsorRootDid)
      .maybeSingle();
    if (rootErr) {
      return NextResponse.json({ ok: false, error: rootErr.message }, { status: 500 });
    }
    const sponsorRootId = rootRow?.id ?? null;
    if (!sponsorRootId) {
      return NextResponse.json(
        { ok: false, error: 'Sponsor root identity not found — cannot anchor bounded delegation' },
        { status: 409 },
      );
    }

    // 4. Resolve the sponsor's Bureau did_persona (nullable — finer-grained
    //    delegation target; not required for the binding to be valid).
    const { data: didPersonaRows } = await admin
      .from('did_persona')
      .select('id')
      .eq('root_id', sponsorRootId)
      .eq('app_origin', BUREAU_APP_ORIGIN)
      .limit(1);
    const sponsorDidPersonaId = didPersonaRows && didPersonaRows.length > 0
      ? String(didPersonaRows[0].id)
      : null;

    // 5. Provision the agent persona. did:agent:persona:<slug>:production
    //    mirrors the seeded did:agent:root:<id> convention.
    const didUri = `did:agent:persona:${agentRoot.agent_card_slug}:production`;
    const personaRole = body.personaRole?.trim() || 'polity_bound_delegate';

    const { data: created, error: createErr } = await admin
      .from('agent_persona')
      .insert({
        agent_root_id: agentRootId,
        did_uri: didUri,
        persona_role: personaRole,
        delegation_user_root_id: sponsorRootId,
        delegation_persona_id: sponsorDidPersonaId,
        max_identifiability: 'anonymous',
        delegation_scopes: {},
      })
      .select('id, did_uri, agent_root_id, persona_role, max_identifiability, created_at')
      .single();

    if (createErr) {
      if (createErr.message.includes('agent_persona')) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Pending migration: 20260427000001_agent_did_schema.sql must be applied before agent persona genesis.',
          },
          { status: 503 },
        );
      }
      return NextResponse.json({ ok: false, error: createErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      agentPersona: {
        agentPersonaId: String(created.id),
        didUri: String(created.did_uri),
        agentRootId: String(created.agent_root_id),
        personaRole: created.persona_role ?? null,
        maxIdentifiability: String(created.max_identifiability),
        createdAt: created.created_at,
      },
      delegationAnchored: {
        sponsorRootResolved: true,
        sponsorDidPersonaResolved: sponsorDidPersonaId !== null,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Agent persona genesis failed' },
      { status: 500 },
    );
  }
}
