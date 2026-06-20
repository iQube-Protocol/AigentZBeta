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

    const { data, error } = await admin
      .from('agent_root_identity')
      .select(AGENT_SELECT)
      .eq('sponsor_persona_id', persona.personaId)
      .eq('is_aigent_me', true)
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

    return NextResponse.json(
      { ok: true, agent: data ? projectAgent(data) : null },
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

    // Idempotent — return the existing aigentMe if one is already designated.
    const { data: existing, error: existingErr } = await admin
      .from('agent_root_identity')
      .select(AGENT_SELECT)
      .eq('sponsor_persona_id', persona.personaId)
      .eq('is_aigent_me', true)
      .maybeSingle();
    if (existingErr && !existingErr.message.includes('is_aigent_me')) {
      return NextResponse.json({ ok: false, error: existingErr.message }, { status: 500 });
    }
    if (existing) {
      return NextResponse.json({ ok: true, agent: projectAgent(existing), created: false });
    }

    // Resolve the caller's active Citizen Passport — the sponsoring credential.
    const { data: citizenRows, error: citizenErr } = await admin
      .from('polity_passport_records')
      .select('passport_id, citizen_status, issued_at')
      .eq('persona_id', persona.personaId)
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
            'An active Citizen Passport is required to create your aigentMe. Apply for your passport first.',
        },
        { status: 409 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as CreateBody;
    // Public, non-T0 slug. Random suffix keeps it unique without leaking the
    // persona id into a browser-visible value.
    const suffix = Math.random().toString(36).slice(2, 8);
    const slug = `aigentme-${suffix}`;

    const outcome = await sponsorPolityAgent({
      admin,
      sponsorPersonaId: persona.personaId,
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

    return NextResponse.json({
      ok: true,
      created: true,
      agent: outcome.agent,
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
