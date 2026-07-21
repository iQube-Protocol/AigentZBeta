/**
 * /api/agents/aigentme — the citizen's primary personal delegate.
 *
 * GET  — returns the caller's aigentMe agent (agent_root_identity where
 *        sponsor_persona_id = caller AND is_aigent_me), or { agent: null }
 *        when they haven't created one yet.
 *
 * POST — idempotently creates the aigentMe. If one already exists it is
 *        returned unchanged. Otherwise the caller's active Citizen Passport is
 *        resolved as the sponsor and the shared genesis helper writes a
 *        polity_bound agent flagged is_aigent_me. The aigentMe consumes one of
 *        the citizen's base sponsorship-capacity slots (base 3).
 *
 * This is the one-click "Create my aigentMe" path behind delegate slot 1 — it
 * reuses /api/agents/genesis' core (sponsorPolityAgent) rather than forking it.
 *
 * T0 discipline: persona id is resolved through the spine and used only
 * server-side. Only public agent metadata is returned.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { sponsorPolityAgent } from '@/services/agents/sponsorPolityAgent';
import { provisionAigentMePersona } from '@/services/agents/provisionAigentMePersona';
import { listOwnedPersonaRows } from '@/services/identity/constitutionalContext';
import { resolveRequestOrigin } from '@/app/api/agents/_lib/requestOrigin';

export const dynamic = 'force-dynamic';

const AGENT_SELECT =
  'id, agent_id, did_uri, agent_class, display_name, description, agent_card_url, agent_card_slug, is_aigent_me, created_at';

function projectAgent(row: Record<string, unknown>) {
  return {
    agentRootId: row.id,
    agentId: row.agent_id,
    didUri: row.did_uri,
    agentClass: row.agent_class,
    displayName: row.display_name,
    description: row.description,
    agentCardUrl: row.agent_card_url,
    agentCardSlug: row.agent_card_slug,
    isAigentMe: Boolean(row.is_aigent_me),
    createdAt: row.created_at,
  };
}

export async function GET(req: NextRequest) {
  try {
    const persona = await getActivePersona(req);
    if (!persona?.personaId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }
    const admin = getSupabaseServer();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'Supabase configuration missing' }, { status: 500 });
    }

    // Person-scoped (CFS-024): the aigentMe belongs to the person, so look across
    // every persona the caller owns — not only the active one.
    const ownedRows = await listOwnedPersonaRows(persona.authProfileId);
    const ownedPersonaIds = Array.from(new Set([persona.personaId, ...ownedRows.map((r) => r.id)]));
    const { data, error } = await admin
      .from('agent_root_identity')
      .select(AGENT_SELECT)
      .in('sponsor_persona_id', ownedPersonaIds)
      .eq('is_aigent_me', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      // Pre-migration soft-fail — no aigentMe column yet.
      if (error.message.includes('is_aigent_me')) {
        return NextResponse.json(
          { ok: true, agent: null, migrationPending: '20260617000000_aigent_me_designation.sql' },
          { headers: { 'Cache-Control': 'no-store' } },
        );
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    // Self-heal: ensure the wallet persona exists for an already-designated
    // aigentMe (covers agents designated before provisioning shipped, or a
    // prior soft-failed provision). Idempotent — returns the existing row if
    // present. The persona then surfaces in /api/wallet/personas.
    let walletPersona = null;
    if (data) {
      walletPersona = await provisionAigentMePersona({
        admin,
        callerAuthProfileId: persona.authProfileId,
        agentRoot: {
          did_uri: String(data.did_uri),
          display_name: String(data.display_name),
          agent_card_slug: data.agent_card_slug ? String(data.agent_card_slug) : null,
        },
      });
    }

    return NextResponse.json(
      { ok: true, agent: data ? projectAgent(data) : null, walletPersona },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'aigentMe lookup failed' },
      { status: 500 },
    );
  }
}

interface CreateBody {
  displayName?: string;
  description?: string;
}

export async function POST(req: NextRequest) {
  try {
    const persona = await getActivePersona(req);
    if (!persona?.personaId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }
    const admin = getSupabaseServer();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'Supabase configuration missing' }, { status: 500 });
    }

    // CFS-024: an agent belongs to the PERSON, not the active persona. Resolve
    // the caller's full persona roster so both the idempotency check and the
    // Citizen-Passport sponsor lookup are person-scoped — otherwise creating an
    // aigentMe while an agent-persona (e.g. Aigent Z) is active fails with
    // "citizen passport required" even though the person HAS a citizen passport
    // on another persona.
    const ownedRows = await listOwnedPersonaRows(persona.authProfileId);
    const ownedPersonaIds = Array.from(new Set([persona.personaId, ...ownedRows.map((r) => r.id)]));

    // Idempotent — return the existing aigentMe if the PERSON already has one.
    const { data: existing, error: existingErr } = await admin
      .from('agent_root_identity')
      .select(AGENT_SELECT)
      .in('sponsor_persona_id', ownedPersonaIds)
      .eq('is_aigent_me', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingErr && !existingErr.message.includes('is_aigent_me')) {
      return NextResponse.json({ ok: false, error: existingErr.message }, { status: 500 });
    }
    if (existing) {
      return NextResponse.json({ ok: true, agent: projectAgent(existing), created: false });
    }

    // Resolve the caller's Citizen Passport across ALL their personas — the
    // sponsoring credential belongs to the person. Sponsor AS the persona that
    // holds it (not necessarily the active one).
    const { data: citizenRows, error: citizenErr } = await admin
      .from('polity_passport_records')
      .select('passport_id, persona_id, citizen_status, issued_at')
      .in('persona_id', ownedPersonaIds)
      .eq('passport_class', 'citizen')
      .in('citizen_status', ['active', 'renewal_due'])
      .order('issued_at', { ascending: false })
      .limit(1);
    if (citizenErr) {
      return NextResponse.json({ ok: false, error: citizenErr.message }, { status: 500 });
    }
    const citizen = citizenRows?.[0];
    if (!citizen?.passport_id) {
      return NextResponse.json(
        {
          ok: false,
          code: 'citizen_passport_required',
          error:
            'An active Citizen Passport is required to create your aigentMe. Apply for your Citizen Passport on any of your personas first.',
        },
        { status: 409 },
      );
    }
    const sponsorPersonaId = String(citizen.persona_id ?? persona.personaId);

    const body = (await req.json().catch(() => ({}))) as CreateBody;
    // Public, non-T0 slug. Random suffix keeps it unique without leaking the
    // persona id into a browser-visible value.
    const suffix = Math.random().toString(36).slice(2, 8);
    const slug = `aigentme-${suffix}`;

    const outcome = await sponsorPolityAgent({
      admin,
      sponsorPersonaId,
      sponsorPassportId: citizen.passport_id,
      slug,
      displayName: body.displayName?.trim() || 'aigentMe',
      description:
        body.description?.trim() ||
        'My personal bounded delegate — the agent that represents me across metaMe.',
      origin: resolveRequestOrigin(req),
      isAigentMe: true,
    });

    if (!outcome.ok || !outcome.agent) {
      const { status, ...rest } = outcome;
      return NextResponse.json(rest, { status });
    }

    // Close the loop — surface the aigentMe as a wallet persona (best-effort).
    const walletPersona = await provisionAigentMePersona({
      admin,
      callerAuthProfileId: persona.authProfileId,
      agentRoot: {
        did_uri: outcome.agent.didUri,
        display_name: outcome.agent.displayName,
        agent_card_slug: outcome.agent.agentCardSlug,
      },
    });

    return NextResponse.json({
      ok: true,
      created: true,
      agent: outcome.agent,
      walletPersona,
      nextSteps: [
        'Your aigentMe now appears in your wallet under AgentQubes and as delegate slot 1.',
        'Submit a Participant Passport application at /api/polity-passport/submit using agent_card_url=' +
          outcome.agent.agentCardUrl,
        'Once issued, create the agent persona at POST /api/identity/persona/agent with agentRootId=' +
          outcome.agent.agentRootId,
      ],
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'aigentMe creation failed' },
      { status: 500 },
    );
  }
}

interface PromoteBody {
  agentRootId?: string;
}

/**
 * PATCH — promote an EXISTING sponsored delegate (one the caller already
 * sponsors) to be their aigentMe. Carries that agent's card + bound passport
 * into the aigentMe role. The partial unique index guarantees one aigentMe per
 * persona, so a second promotion returns aigent_me_exists.
 */
export async function PATCH(req: NextRequest) {
  try {
    const persona = await getActivePersona(req);
    if (!persona?.personaId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }
    const admin = getSupabaseServer();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'Supabase configuration missing' }, { status: 500 });
    }

    const body = (await req.json().catch(() => ({}))) as PromoteBody;
    const agentRootId = body.agentRootId?.trim();
    if (!agentRootId) {
      return NextResponse.json({ ok: false, error: 'agentRootId is required' }, { status: 400 });
    }

    // Caller must already sponsor the target agent.
    const { data: target, error: targetErr } = await admin
      .from('agent_root_identity')
      .select(`${AGENT_SELECT}, sponsor_persona_id`)
      .eq('id', agentRootId)
      .maybeSingle();
    if (targetErr) {
      if (targetErr.message.includes('is_aigent_me')) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Pending migration: 20260617000000_aigent_me_designation.sql must be applied before an agent can be designated aigentMe.',
          },
          { status: 503 },
        );
      }
      return NextResponse.json({ ok: false, error: targetErr.message }, { status: 500 });
    }
    if (!target) {
      return NextResponse.json({ ok: false, error: 'Agent not found' }, { status: 404 });
    }
    if (target.sponsor_persona_id !== persona.personaId) {
      return NextResponse.json(
        { ok: false, error: 'You do not sponsor this agent' },
        { status: 403 },
      );
    }
    if (target.is_aigent_me) {
      return NextResponse.json({ ok: true, agent: projectAgent(target), promoted: false });
    }

    // One aigentMe per persona — block if another is already designated.
    const { data: existing } = await admin
      .from('agent_root_identity')
      .select('id')
      .eq('sponsor_persona_id', persona.personaId)
      .eq('is_aigent_me', true)
      .maybeSingle();
    if (existing?.id) {
      return NextResponse.json(
        {
          ok: false,
          code: 'aigent_me_exists',
          error: 'You already have an aigentMe. Only one aigentMe is allowed per persona.',
        },
        { status: 409 },
      );
    }

    const { data: updated, error: updateErr } = await admin
      .from('agent_root_identity')
      .update({ is_aigent_me: true })
      .eq('id', agentRootId)
      .eq('sponsor_persona_id', persona.personaId)
      .select(AGENT_SELECT)
      .single();
    if (updateErr) {
      if (updateErr.message.includes('uq_agent_root_aigent_me_per_persona')) {
        return NextResponse.json(
          {
            ok: false,
            code: 'aigent_me_exists',
            error: 'You already have an aigentMe. Only one aigentMe is allowed per persona.',
          },
          { status: 409 },
        );
      }
      return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 });
    }

    // Close the loop — surface the promoted aigentMe as a wallet persona.
    const promoted = projectAgent(updated);
    const walletPersona = await provisionAigentMePersona({
      admin,
      callerAuthProfileId: persona.authProfileId,
      agentRoot: {
        did_uri: promoted.didUri,
        display_name: promoted.displayName,
        agent_card_slug: promoted.agentCardSlug,
      },
    });

    return NextResponse.json({ ok: true, promoted: true, agent: promoted, walletPersona });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'aigentMe promotion failed' },
      { status: 500 },
    );
  }
}
