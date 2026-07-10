/**
 * POST /api/homecoming/agent/stand-up — Agent Homecoming (CFS-023, Workstream 2).
 *
 * Stand a named constitutional delegate up by running the platform's existing
 * genesis core (sponsorPolityAgent) for it — seeding its RootDID and moving it
 * from card-only archetype (L0) to a persisted registry identity (L1). Reports
 * the delegate's Constitutional Presence after the step, plus the passport +
 * persona follow-on steps (→ L2…L5) which run through their own existing routes.
 *
 * Body: { delegate: HomecomingDelegateId, sponsorPassportId: string }.
 * The sponsor persona (T0) is the caller's active persona; admin-gated.
 *
 * T0 discipline: sponsor_persona_id is written server-side, never returned.
 * The response carries only public delegate metadata + the presence rungs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { resolveRequestOrigin } from '@/app/api/agents/_lib/requestOrigin';
import { standUpDelegate, HOMECOMING_DELEGATE_SPECS } from '@/services/homecoming/agentHomecoming';
import { assessDelegate } from '@/services/homecoming/constitutionalPresence';
import { HOMECOMING_DELEGATES, type HomecomingDelegateId } from '@/types/homecoming';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) return NextResponse.json({ ok: false, error: 'Admin access required' }, { status: 403 });

  let body: { delegate?: string; sponsorPassportId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const delegate = body.delegate as HomecomingDelegateId;
  if (!delegate || !(HOMECOMING_DELEGATES as readonly string[]).includes(delegate)) {
    return NextResponse.json(
      { ok: false, error: `delegate must be one of: ${HOMECOMING_DELEGATES.join(', ')}` },
      { status: 400 },
    );
  }
  if (!body.sponsorPassportId?.trim()) {
    return NextResponse.json(
      { ok: false, error: 'sponsorPassportId is required — your citizen passport sponsors the delegate genesis' },
      { status: 400 },
    );
  }

  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Supabase configuration missing' }, { status: 500 });

  const result = await standUpDelegate({
    admin,
    sponsorPersonaId: persona.personaId,
    sponsorPassportId: body.sponsorPassportId,
    delegate,
    origin: resolveRequestOrigin(req),
    callerIsAdmin: true, // gated above
  });

  if ('error' in result) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  const { spec, outcome } = result;
  // Report presence AFTER the step (best-effort — never fails the stand-up).
  const presence = await assessDelegate(admin, delegate).catch(() => null);

  if (!outcome.ok || !outcome.agent) {
    // e.g. slug already taken (already seeded) — honest, with current presence.
    return NextResponse.json(
      { ok: false, delegate, error: outcome.error, code: outcome.code, presence },
      { status: outcome.status },
    );
  }

  return NextResponse.json({
    ok: true,
    delegate,
    agent: outcome.agent,
    presence,
    nextSteps: [
      `Submit a Participant Passport at /api/polity-passport/submit with agent_card_url=${outcome.agent.agentCardUrl} (→ sets bound_passport_id, advances toward L5).`,
      `Provision the agent persona at POST /api/identity/persona/agent with agentRootId=${outcome.agent.agentRootId} (→ L2 reasoning-connected).`,
      'Grant bounded delegation (draft_document → L3 Studio; registry_submission_proposal → L4 Development).',
    ],
    lawNote: `${spec.displayName} stood up as ${outcome.agent.agentClass} — a bounded constitutional delegate; sovereignty is never delegated (delegation-framework v1).`,
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    note: 'POST { delegate, sponsorPassportId } (admin) to seed a Homecoming delegate RootDID via the genesis core, then follow the passport + persona steps.',
    standable: Object.keys(HOMECOMING_DELEGATE_SPECS),
  });
}
