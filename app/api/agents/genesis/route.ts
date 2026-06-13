/**
 * POST /api/agents/genesis
 *
 * Sponsors a new polity_bound Agent — the genesis moment.
 *
 * Per the 2026-06-13 hackathon plan §Sprint 3. A Citizen creates an Agent
 * (e.g. Aletheon) as their bounded delegate. The genesis flow:
 *   1. Caller resolved through the spine. Must hold an active Citizen
 *      Passport (the sponsoring credential).
 *   2. Allocate a unique agent_card_slug and write the
 *      agent_root_identity row with:
 *        - agent_class = 'polity_bound'
 *        - sponsor_passport_id  = caller's citizen passport
 *        - sponsor_persona_id   = caller's persona_id (server-internal)
 *        - did_uri              = did:agent:root:<slug>
 *        - agent_card_url       = `${origin}/api/agents/<slug>/agent-card.json`
 *   3. Return the slug + card URL so the wizard can show "Genesis
 *      complete — Aletheon's Agent Card is live at <url>".
 *
 * Body shape:
 *   {
 *     slug: string,           // e.g. 'aletheon'
 *     displayName: string,    // 'Aletheon'
 *     description: string,
 *     agentClass?: 'polity_bound', // default; only admins can choose 'polity_autonomous'
 *     sponsorPassportId: string,   // the citizen passport sponsoring this genesis
 *   }
 *
 * T0 discipline: persona_id is selected and stored server-side only;
 * never serialised. Response only carries the public agent metadata.
 *
 * Note: this endpoint provisions the RootDID + Agent Card record. The
 * agent's Participant Passport is created by submitting through the
 * existing /api/polity-passport/submit flow with agent_card_url=<this
 * card url>. The agent's persona (agent_persona row) is created by the
 * follow-up /api/identity/persona/agent endpoint after the passport
 * is issued.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const dynamic = 'force-dynamic';

const SLUG_RE = /^[a-z][a-z0-9-]{2,40}$/;

interface GenesisBody {
  slug: string;
  displayName: string;
  description: string;
  agentClass?: 'polity_bound' | 'polity_autonomous';
  sponsorPassportId: string;
}

export async function POST(req: NextRequest) {
  try {
    const persona = await getActivePersona(req);
    if (!persona?.personaId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }

    const body = (await req.json()) as GenesisBody;
    const { slug, displayName, description, agentClass, sponsorPassportId } = body;

    if (!slug || !SLUG_RE.test(slug)) {
      return NextResponse.json(
        { ok: false, error: 'slug must be 3-41 chars, lowercase letters/digits/hyphens, starting with a letter' },
        { status: 400 },
      );
    }
    if (!displayName?.trim() || !description?.trim()) {
      return NextResponse.json(
        { ok: false, error: 'displayName and description are required' },
        { status: 400 },
      );
    }
    if (!sponsorPassportId?.trim()) {
      return NextResponse.json(
        { ok: false, error: 'sponsorPassportId is required — the citizen passport sponsoring this genesis' },
        { status: 400 },
      );
    }

    // polity_autonomous requires admin governance — Sprint 3 only ships
    // polity_bound from the citizen-facing wizard.
    const resolvedClass = agentClass === 'polity_autonomous' ? null : 'polity_bound';
    if (!resolvedClass) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'polity_autonomous requires admin governance decoupling — use POST /api/governance/agent/decouple (Phase B)',
        },
        { status: 403 },
      );
    }

    const admin = getSupabaseServer();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'Supabase configuration missing' }, { status: 500 });
    }

    // 1. Sponsor passport ownership check — caller must own the passport
    // they're using to sponsor.
    const { data: sponsorRow, error: sponsorErr } = await admin
      .from('polity_passport_records')
      .select('passport_id, persona_id, passport_class, citizen_status')
      .eq('passport_id', sponsorPassportId)
      .maybeSingle();

    if (sponsorErr) {
      return NextResponse.json({ ok: false, error: sponsorErr.message }, { status: 500 });
    }
    if (!sponsorRow) {
      return NextResponse.json({ ok: false, error: 'Sponsor passport not found' }, { status: 404 });
    }
    if (sponsorRow.persona_id && sponsorRow.persona_id !== persona.personaId) {
      return NextResponse.json(
        { ok: false, error: 'Caller does not own the sponsor passport' },
        { status: 403 },
      );
    }
    if (sponsorRow.passport_class !== 'citizen') {
      return NextResponse.json(
        { ok: false, error: 'Only citizen passports may sponsor agent genesis' },
        { status: 400 },
      );
    }

    // 2. Slug uniqueness check. Pre-flight so the unique index error doesn't
    // leak the existing row.
    const { data: existing, error: existingErr } = await admin
      .from('agent_root_identity')
      .select('agent_id')
      .eq('agent_card_slug', slug)
      .maybeSingle();

    if (existingErr && !existingErr.message.includes('agent_card_slug')) {
      return NextResponse.json({ ok: false, error: existingErr.message }, { status: 500 });
    }
    if (existing) {
      return NextResponse.json(
        { ok: false, error: `Slug '${slug}' already taken — choose another` },
        { status: 409 },
      );
    }

    // 3. Write the root identity. did_uri pattern matches the seeded
    // platform agents (did:agent:root:<slug>).
    const agentId = `polity-bound:${slug}`;
    const didUri = `did:agent:root:${slug}`;
    const origin = req.nextUrl.origin;
    const agentCardUrl = `${origin}/api/agents/${slug}/agent-card.json`;

    const { data: rootRow, error: rootErr } = await admin
      .from('agent_root_identity')
      .insert({
        agent_id: agentId,
        did_uri: didUri,
        agent_class: resolvedClass,
        display_name: displayName.trim(),
        description: description.trim(),
        sponsor_passport_id: sponsorPassportId,
        sponsor_persona_id: persona.personaId,
        agent_card_url: agentCardUrl,
        agent_card_slug: slug,
      })
      .select('id, agent_id, did_uri, agent_class, display_name, description, agent_card_url, agent_card_slug, created_at')
      .single();

    if (rootErr) {
      // Migration not applied yet.
      if (
        rootErr.message.includes('sponsor_passport_id') ||
        rootErr.message.includes('agent_card_slug') ||
        rootErr.message.includes('polity_bound')
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Pending migration: 20260613200000_agent_genesis_polity_bound.sql must be applied in Supabase before agent genesis can persist.',
          },
          { status: 503 },
        );
      }
      return NextResponse.json({ ok: false, error: rootErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      agent: {
        agentRootId: rootRow.id,
        agentId: rootRow.agent_id,
        didUri: rootRow.did_uri,
        agentClass: rootRow.agent_class,
        displayName: rootRow.display_name,
        description: rootRow.description,
        agentCardUrl: rootRow.agent_card_url,
        agentCardSlug: rootRow.agent_card_slug,
        sponsorPassportId,
        createdAt: rootRow.created_at,
      },
      nextSteps: [
        'Submit a Participant Passport application at /api/polity-passport/submit using agent_card_url=' + agentCardUrl,
        'Once issued, create the agent persona at POST /api/identity/persona/agent with agentRootId=' + rootRow.id,
        'The agent persona can then claim its Participant Passport VC via the existing claim flow.',
      ],
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Agent genesis failed' },
      { status: 500 },
    );
  }
}
