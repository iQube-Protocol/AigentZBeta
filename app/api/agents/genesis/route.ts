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
import { sponsorPolityAgent } from '@/services/agents/sponsorPolityAgent';
import { resolveRequestOrigin } from '@/app/api/agents/_lib/requestOrigin';

export const dynamic = 'force-dynamic';

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

    const admin = getSupabaseServer();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'Supabase configuration missing' }, { status: 500 });
    }

    const outcome = await sponsorPolityAgent({
      admin,
      sponsorPersonaId: persona.personaId,
      sponsorPassportId,
      slug,
      displayName,
      description,
      agentClass,
      origin: resolveRequestOrigin(req),
    });

    if (!outcome.ok || !outcome.agent) {
      const { status, ...rest } = outcome;
      return NextResponse.json(rest, { status });
    }

    const { agentCardUrl, agentRootId } = outcome.agent;
    return NextResponse.json({
      ok: true,
      agent: outcome.agent,
      nextSteps: [
        'Submit a Participant Passport application at /api/polity-passport/submit using agent_card_url=' + agentCardUrl,
        'Once issued, create the agent persona at POST /api/identity/persona/agent with agentRootId=' + agentRootId,
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
