/**
 * POST /api/homecoming/agent/stand-up — Agent Homecoming (CFS-023, Workstream 2).
 *
 * Stand a named constitutional delegate up by running the platform's existing
 * genesis core (sponsorPolityAgent) for it, chained straight through to
 * agent-persona provisioning in the same call — the mechanical L0→L2
 * transition (card → seeded RootDID → reasoning-connected persona). Reports
 * the delegate's Constitutional Presence after the step, plus the passport +
 * standing follow-on steps (→ L3…L5) which run through their own existing
 * routes and require earned trust bands, never granted on demand.
 *
 * Body: { delegate: HomecomingDelegateId, sponsorPassportId: string }.
 * The sponsor persona (T0) is the caller's active persona; admin-gated.
 *
 * T0 discipline: sponsor_persona_id is written server-side, never returned.
 * The response carries only public delegate metadata + the presence rungs.
 *
 * A successful stand-up that freshly creates at least one of the two rows
 * emits a best-effort 'agent_delegate_stood_up' activity receipt (Aletheon
 * Homecoming Stage 1 preflight, operator-directed 2026-08-15) — see the
 * receipt-emission block below. The receipt describes the completed
 * transition; it never gates whether the state writes succeed.
 *
 * GET ?delegate=<id>&preflight=true — read-only sponsor-resolution preview
 * before calling POST (see GET_preflight below).
 */

import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { resolveRequestOrigin } from '@/app/api/agents/_lib/requestOrigin';
import { standUpDelegate, HOMECOMING_DELEGATE_SPECS } from '@/services/homecoming/agentHomecoming';
import { provisionAgentPersona } from '@/services/agents/provisionAgentPersona';
import { assessDelegate } from '@/services/homecoming/constitutionalPresence';
import { HOMECOMING_DELEGATES, type HomecomingDelegateId } from '@/types/homecoming';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import { getPersonaPlan } from '@/services/billing/personaPlan';

export const dynamic = 'force-dynamic';

interface ActivePersonaLike {
  personaId: string;
  authProfileId?: string | null;
}

/**
 * Resolve the sponsor citizen passport SERVER-SIDE. The metaMe IRL embed can
 * resolve a DIFFERENT active persona than the Passport Bureau tab (both may
 * display the same label), so the active persona alone isn't reliable. Widen
 * to EVERY persona on the caller's auth account (ownership-safe: we only ever
 * consider personas with the caller's own auth_profile_id) and sponsor AS the
 * passport's owning persona. An explicit override still wins.
 *
 * Single source of truth for this resolution — used by both the real POST
 * stand-up and the GET preflight below, so a preflight answer can never
 * diverge from what the real call would actually do.
 */
async function resolveSponsorForCaller(
  admin: SupabaseClient,
  persona: ActivePersonaLike,
  explicitSponsorPassportId?: string,
): Promise<{ sponsorPassportId: string | null; sponsorPersonaId: string }> {
  let sponsorPassportId = explicitSponsorPassportId?.trim();
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
  return { sponsorPassportId: sponsorPassportId ?? null, sponsorPersonaId };
}

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

  const { sponsorPassportId, sponsorPersonaId } = await resolveSponsorForCaller(admin, persona, body.sponsorPassportId);
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

  const { spec, agent, alreadySeeded, capacityOverride } = result;

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

  // Positive stand-up receipt (Aletheon Homecoming Stage 1 preflight,
  // operator-directed 2026-08-15). Fires ONLY when at least one of the two
  // rows was freshly created THIS call — an idempotent re-run where both
  // already existed is a no-op observation, not a second activation event.
  // Best-effort and STRICTLY AFTER both state writes: a receipt failure must
  // never roll back, retry, or otherwise touch the already-committed identity
  // state above. Agent-scoped identifiers only — no sponsor persona/passport
  // id in the summary or actionInput (T0 discipline).
  const personaFreshlyCreated =
    personaOutcome.ok && !('alreadyExists' in personaOutcome && personaOutcome.alreadyExists);
  const isFreshActivation = !alreadySeeded || personaFreshlyCreated;
  if (isFreshActivation) {
    try {
      await createActivityReceipt({
        personaId: persona.personaId,
        activeCartridge: 'agentiq',
        actionType: 'agent_delegate_stood_up',
        summary:
          `${spec.displayName} mechanically stood up (L0→L2) via Chrysalis Homecoming — ` +
          `${!alreadySeeded ? 'root identity seeded' : 'root identity already existed'}` +
          `${personaFreshlyCreated ? ', persona provisioned' : personaOutcome.ok ? ', persona already existed' : ', persona provisioning failed'}` +
          `${capacityOverride ? ` (sponsorship capacity override: ${capacityOverride.authority})` : ''}.`,
        agentsInvoked: [agent.agentId],
        actionInput: {
          delegate,
          agent_root_id: agent.agentRootId,
          agent_id: agent.agentId,
          agent_card_slug: agent.agentCardSlug,
          agent_class: agent.agentClass,
          root_freshly_created: !alreadySeeded,
          persona_freshly_created: personaFreshlyCreated,
          capacity_override: capacityOverride,
        },
      });
    } catch {
      // Receipt is best-effort — never fail or unwind the stand-up over the audit write.
    }
  }

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

/**
 * GET ?delegate=<id>&preflight=true[&sponsorPassportId=<id>] — read-only
 * sponsor-resolution preview (Aletheon Homecoming Stage 1 preflight,
 * operator-directed 2026-08-15). Reuses resolveSponsorForCaller (the SAME
 * resolution POST uses) so the preview can never diverge from what a real
 * stand-up call would do. Mirrors — never re-derives independently — the
 * read-only checks provisionAgentPersona/sponsorPolityAgent perform; it never
 * writes, and the real functions still re-run their own gates in full at
 * write time regardless of what this preview reports. Never returns a raw
 * persona id (T0 discipline, matching the POST handler's own convention of
 * never returning sponsor_persona_id) — sponsorPassportId is returned because
 * it is the caller's own resolved sponsor (self-view), not a T0 field.
 */
async function GET_preflight(req: NextRequest, delegate: HomecomingDelegateId) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) return NextResponse.json({ ok: false, error: 'Admin access required' }, { status: 403 });

  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Supabase configuration missing' }, { status: 500 });

  const explicitSponsorPassportId = new URL(req.url).searchParams.get('sponsorPassportId') ?? undefined;
  const { sponsorPassportId, sponsorPersonaId } = await resolveSponsorForCaller(admin, persona, explicitSponsorPassportId);

  if (!sponsorPassportId) {
    return NextResponse.json({
      ok: true,
      delegate,
      preflight: true,
      sponsorResolved: false,
      reason: 'No citizen passport found on your account. Apply for an anonymous Citizen Passport in the Passport Bureau, then retry.',
    });
  }

  const { data: passportRow } = await admin
    .from('polity_passport_records')
    .select('passport_id, passport_class, citizen_status')
    .eq('passport_id', sponsorPassportId)
    .maybeSingle();
  const citizenStatus: string | null = passportRow?.citizen_status ?? null;
  // "Owns an ACTIVE citizen passport" — passport_class alone is not enough;
  // a revoked/suspended citizen passport must not read as a valid sponsor.
  const passportValid = Boolean(passportRow) && passportRow?.passport_class === 'citizen' && citizenStatus === 'active';

  // Mirrors provisionAgentPersona's read-only root/did_persona resolution —
  // preview only, never writes. See that file for the authoritative version
  // exercised at actual persona-provisioning time.
  const { data: sponsorPersonaRow } = await admin.from('personas').select('root_did').eq('id', sponsorPersonaId).maybeSingle();
  const sponsorRootDid = sponsorPersonaRow?.root_did ?? null;
  let sponsorRootResolvable = false;
  if (sponsorRootDid) {
    const { data: rootRow } = await admin.from('root_identity').select('id').eq('did_uri', sponsorRootDid).maybeSingle();
    sponsorRootResolvable = Boolean(rootRow);
  }

  // Mirrors sponsorPolityAgent's read-only capacity computation — preview
  // only, never writes or gates. The real function re-runs this in full.
  const sponsorPlan = await getPersonaPlan(admin, sponsorPersonaId);
  const { data: capacityRow } = await admin
    .from('personas')
    .select('sponsorship_capacity_base, sponsorship_capacity_earned')
    .eq('id', sponsorPersonaId)
    .maybeSingle();
  const storedBase = Number(capacityRow?.sponsorship_capacity_base ?? 0);
  const earned = Number(capacityRow?.sponsorship_capacity_earned ?? 0);
  const base = Math.max(sponsorPlan.boundedDelegateLimit, storedBase);
  const { count: usedCount } = await admin
    .from('agent_root_identity')
    .select('id', { count: 'exact', head: true })
    .eq('sponsor_persona_id', sponsorPersonaId);
  const used = usedCount ?? 0;
  const remaining = base + earned - used;

  const spec = HOMECOMING_DELEGATE_SPECS[delegate];
  let alreadySeeded = false;
  if (spec) {
    const { data: existingRoot } = await admin
      .from('agent_root_identity')
      .select('id')
      .eq('agent_card_slug', spec.slug)
      .maybeSingle();
    alreadySeeded = Boolean(existingRoot);
  }

  return NextResponse.json({
    ok: true,
    delegate,
    preflight: true,
    sponsorResolved: true,
    // The resolved sponsor is reported relationally (T0-safe), not by raw
    // persona UUID: is this the caller's OWN currently-authenticated persona,
    // or a different persona on the same auth account (resolveSponsorForCaller
    // widens across every persona on the caller's authProfileId)?
    sponsorIsCallersAuthenticatedPersona: sponsorPersonaId === persona.personaId,
    sponsorPassportId, // caller's own resolved sponsor (self-view) — never sponsorPersonaId (T0)
    citizenStatus,
    passportValid,
    sponsorRootResolvable,
    wouldWriteDelegationUserRoot: sponsorRootResolvable,
    capacity: { base, earned, used, remaining },
    requiresAdminOverride: remaining <= 0,
    alreadySeeded,
    note: alreadySeeded
      ? 'agent_root_identity already exists for this delegate — a stand-up call would be idempotent (alreadySeeded: true).'
      : sponsorRootResolvable
        ? 'Sponsor root resolves — a stand-up call would write a real delegation_user_root_id, not an unanchored persona.'
        : 'Sponsor root does NOT resolve — a stand-up call would create an UNANCHORED persona (delegation_user_root_id: null) unless this is repaired first.',
  });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const delegateParam = url.searchParams.get('delegate');
  const preflight = url.searchParams.get('preflight') === 'true';

  if (preflight && delegateParam && (HOMECOMING_DELEGATES as readonly string[]).includes(delegateParam)) {
    return GET_preflight(req, delegateParam as HomecomingDelegateId);
  }

  return NextResponse.json({
    ok: true,
    note:
      'POST { delegate, sponsorPassportId } (admin) to seed a Homecoming delegate RootDID via the genesis core, then follow the passport + persona steps. ' +
      'GET ?delegate=<id>&preflight=true (admin) for a read-only sponsor-resolution preview before stand-up.',
    standable: Object.keys(HOMECOMING_DELEGATE_SPECS),
  });
}
