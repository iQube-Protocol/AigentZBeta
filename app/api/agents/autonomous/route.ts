/**
 * POST /api/agents/autonomous — deploy a polity_autonomous agent (Option A).
 *
 * Admin-only. Sovereignty stays human-only: the deployed agent carries no kybe
 * DID, is never a citizen, and is always identifiable as an agent. Its Agent
 * Passport binds to the current Constitution / Agent Charter / Delegation
 * Framework versions and names a revocation authority. All constraints are
 * enforced in the shared sponsorPolityAgent helper, which reads its rules from
 * the Polity Core constitution accessor.
 *
 * No orphaned agents: a sponsor passport (the admin's citizen passport, or a
 * bureau/org passport) is still required so every action traces to a
 * responsible sponsor.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { sponsorPolityAgent } from '@/services/agents/sponsorPolityAgent';
import { resolveRequestOrigin } from '@/app/api/agents/_lib/requestOrigin';
import { PASSPORT_BUREAU_CARTRIDGE_SLUG } from '@/services/passport/issuanceService';
import { getAgentPassportBinding } from '@/services/polity/constitution';

export const dynamic = 'force-dynamic';

interface AutonomousBody {
  slug: string;
  displayName: string;
  description: string;
  sponsorPassportId: string;
}

export async function POST(req: NextRequest) {
  try {
    const persona = await getActivePersona(req);
    if (!persona?.personaId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }
    const isAdmin =
      persona.cartridgeFlags.isAdmin ||
      persona.cartridgeFlags.adminCartridges.includes(PASSPORT_BUREAU_CARTRIDGE_SLUG);
    if (!isAdmin) {
      return NextResponse.json(
        { ok: false, code: 'autonomous_requires_admin', error: 'Autonomous agents may be deployed by platform administrators only.' },
        { status: 403 },
      );
    }

    const body = (await req.json()) as AutonomousBody;
    const admin = getSupabaseServer();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'Supabase configuration missing' }, { status: 500 });
    }

    const outcome = await sponsorPolityAgent({
      admin,
      sponsorPersonaId: persona.personaId,
      sponsorPassportId: body.sponsorPassportId,
      slug: body.slug,
      displayName: body.displayName,
      description: body.description,
      origin: resolveRequestOrigin(req),
      isAutonomous: true,
      callerIsAdmin: true,
    });

    if (!outcome.ok || !outcome.agent) {
      const { status, ...rest } = outcome;
      return NextResponse.json(rest, { status });
    }

    return NextResponse.json({
      ok: true,
      agent: outcome.agent,
      constitutionalBinding: getAgentPassportBinding(),
      nextSteps: [
        'Submit the agent Participant Passport at /api/polity-passport/submit using agent_card_url=' +
          outcome.agent.agentCardUrl,
        'Manage lifecycle (pause/suspend/revoke/quarantine/destroy) at POST /api/agents/' +
          outcome.agent.agentRootId + '/revoke',
      ],
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Autonomous agent deploy failed' },
      { status: 500 },
    );
  }
}
