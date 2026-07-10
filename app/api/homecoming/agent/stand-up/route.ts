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
import { provisionAgentPersona } from '@/services/agents/provisionAgentPersona';
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
  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Supabase configuration missing' }, { status: 500 });

  // Resolve the sponsor citizen passport SERVER-SIDE. The metaMe IRL embed can
  // resolve a DIFFERENT active persona than the Passport Bureau tab (both may
  // display the same label), so the active persona alone isn't reliable. Widen
  // to EVERY persona on the caller's auth account (ownership-safe: we only ever
  // consider personas with the caller's own auth_profile_id) and sponsor AS the
  // passport's owning persona. An explicit sponsorPassportId still overrides.
  let sponsorPassportId = body.sponsorPassportId?.trim();
  let sponsorPersonaId = persona.personaId;
  if (!sponsorPassportId) {
    // Candidate personas: the active one + all others on this auth account.
    let personaIds = [persona.personaId];
    if (persona.authProfileId) {
      const { data: acctPersonas } = await admin
        .from('personas')
        .select('id')
        .eq('auth_profile_id', persona.authProfileId);
      personaIds = Array.from(new Set([persona.personaId, ...(acctPersonas ?? []).map((p) => String(p.id))]));
    }
    const { data: citizenRows } = await admin
      .from('polity_passport_records')
      .select('passport_id, persona_id, citizen_status')
      .in('persona_id', personaIds)
      .eq('passport_class', 'citizen');
    const rows = citizenRows ?? [];
    const chosen = rows.find((r) => r.citizen_status === 'active') ?? rows[0];
    if (chosen) {
      sponsorPassportId = String(chosen.passport_id);
      sponsorPersonaId = String(chosen.persona_id); // sponsor as the passport HOLDER (genesis validates ownership)
    }
  }
  if (!sponsorPassportId) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'No citizen passport found on your account. Apply for an anonymous Citizen Passport in the Passport Bureau, then retry.',
      },
      { status: 400 },
    );
  }

  const result = await standUpDelegate({
    admin,
    sponsorPersonaId,
    sponsorPassportId,
    delegate,
    origin: resolveRequestOrigin(req),
    callerIsAdmin: true, // gated above
  });

  if ('error' in result) {
    const presence = await assessDelegate(admin, delegate).catch(() => null);
    return NextResponse.json({ ok: false, delegate, error: result.error, presence }, { status: result.status });
  }

  const { spec, agent, alreadySeeded } = result;

  // Chain the mechanical genesis follow-on: provision the agent persona (L2 —
  // reasoning-connected). This is a low-authority genesis step, safe to chain.
  // Best-effort — a persona failure does NOT undo the seeded RootDID (the row
  // persists at L1); it is reported honestly so the operator can retry.
  const personaOutcome = await provisionAgentPersona({
    admin,
    sponsorPersonaId, // the resolved passport-holder persona (matches the seeded sponsor)
    agentRootId: agent.agentRootId,
    // Reach L2 even when the sponsor's FIO-style root_did has no root_identity
    // row — provision un-anchored (NULL delegating root), flagged for backfill.
    allowUnanchored: true,
  }).catch((e) => ({ ok: false, status: 500, error: e instanceof Error ? e.message : 'persona provisioning failed' }));

  // Report presence AFTER both steps (best-effort — never fails the stand-up).
  const presence = await assessDelegate(admin, delegate).catch(() => null);

  return NextResponse.json({
    ok: true,
    delegate,
    alreadySeeded,
    agent,
    persona: personaOutcome.ok
      ? {
          provisioned: true,
          alreadyExists: 'alreadyExists' in personaOutcome ? Boolean(personaOutcome.alreadyExists) : false,
          agentPersona: 'agentPersona' in personaOutcome ? personaOutcome.agentPersona : undefined,
          delegationAnchored: 'delegationAnchored' in personaOutcome ? personaOutcome.delegationAnchored : undefined,
        }
      : { provisioned: false, error: personaOutcome.error },
    presence,
    reachedMechanicalCeiling: personaOutcome.ok, // L2 is the mechanical ceiling for a day-one delegate
    earnedBands: {
      note:
        'L3 (Studio) / L4 (Development) / L5 (Sovereign) are EARNED, not granted on demand. Bounded-delegation trust bands are reputation-gated (L3≥50, L4≥75, L5≥100). The delegate earns standing natively — that is the constitutional point of Homecoming.',
    },
    nextSteps: [
      `Passport: submit a Participant Passport at /api/polity-passport/submit with agent_card_url=${agent.agentCardUrl} — issuance is the Bureau's act (a component of L5).`,
      'Standing/reputation: as the delegate accrues Standing, its trust band rises, unlocking bounded-delegation scopes (L3 draft_document, L4 registry_submission_proposal) — grant them at /api/codex/chat/agentiq-os/delegation once the band is reached.',
    ],
    lawNote: `${spec.displayName} ${alreadySeeded ? 'already seeded' : 'stood up'} as ${agent.agentClass} — a bounded constitutional delegate; sovereignty is never delegated (delegation-framework v1). Mechanical climb complete to L2; L3→L5 are earned.`,
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    note: 'POST { delegate, sponsorPassportId } (admin) to seed a Homecoming delegate RootDID via the genesis core, then follow the passport + persona steps.',
    standable: Object.keys(HOMECOMING_DELEGATE_SPECS),
  });
}
