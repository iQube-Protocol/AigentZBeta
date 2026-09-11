/**
 * GET /api/persona/sponsored-agents
 *
 * Returns every Agent sponsored by the active persona's Citizen Passport.
 * Surfaces "Agents I sponsor" in the wallet drawer (per 2026-06-13
 * hackathon plan §Sprint 3 — answers "why don't I see Aletheon's
 * passport in my wallet?").
 *
 * Joins agent_root_identity to polity_passport_records via bound_passport_id
 * so each row carries:
 *   - the agent's identity (display_name, did_uri, slug, card url)
 *   - its passport state (claimed / claimable / pending issuance)
 *   - the underlying VC commitment refs (T1-safe)
 *
 * T0 discipline: agent's persona_id, sponsor_persona_id, and any other T0
 * id never serialise — only public refs and slugs travel.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { getCrmClient } from '@/services/crm/crmDataAccess';
import { provisionAigentMePersona } from '@/services/agents/provisionAigentMePersona';
import { resolveConstitutionalContext } from '@/services/identity/constitutionalContext';
import { resolveAgentSponsorshipCapacity } from '@/services/access/personaCapacity';

export const dynamic = 'force-dynamic';

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

    // currentAigentMe is resolved ONCE, authoritatively, by
    // resolveConstitutionalContext() (services/identity/constitutionalContext.ts)
    // — the CFS-024 single source of truth. This route no longer queries
    // agent_root_identity.is_aigent_me directly; that legacy column exists
    // only as resolveConstitutionalContext's own internal last-resort
    // fallback (Homecoming Phase II P1 Item 3, operator brief 2026-08-16).
    const ctx = await resolveConstitutionalContext(req);
    const currentAigentMe = ctx.currentAigentMe;

    const baseCols =
      'id, agent_id, did_uri, agent_class, display_name, description, agent_card_url, agent_card_slug, sponsor_passport_id, bound_passport_id, created_at';

    const { data: rows, error } = await admin
      .from('agent_root_identity')
      .select(baseCols)
      .eq('sponsor_persona_id', persona.personaId)
      .order('created_at', { ascending: false });

    if (error) {
      // Pre-migration soft-fail: return empty list rather than 500 so the
      // wallet doesn't break before the migration runs.
      if (error.message.includes('sponsor_persona_id') || error.message.includes('agent_card_slug')) {
        return NextResponse.json(
          {
            ok: true,
            agents: [],
            migrationPending: '20260613200000_agent_genesis_polity_bound.sql',
          },
          { headers: { 'Cache-Control': 'no-store' } },
        );
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    // aigentMe (the primary delegate) sorts first, then newest sponsorships —
    // resolved against ctx.currentAigentMe, never a raw column sort.
    const agentRows = (rows ?? []).slice().sort((a, b) => {
      const aIsAigentMe = a.id === currentAigentMe ? 1 : 0;
      const bIsAigentMe = b.id === currentAigentMe ? 1 : 0;
      return bIsAigentMe - aIsAigentMe;
    });

    type PassportRow = {
      passport_id: string;
      passport_class: string;
      passport_grade: string | null;
      citizen_status: string | null;
      participant_status: string | null;
      credential_claimed_at: string | null;
      persona_public_ref: string | null;
      kybe_did_public_ref: string | null;
      issued_at: string | null;
      world_id_verified_at: string | null;
    };
    const PASSPORT_COLS =
      'passport_id, passport_class, passport_grade, citizen_status, participant_status, credential_claimed_at, persona_public_ref, kybe_did_public_ref, issued_at, world_id_verified_at, application_id';

    // For each agent with a bound passport, fetch the passport row to surface
    // the credential state. Batched to a single in-query.
    const passportIds = agentRows
      .map((r) => r.bound_passport_id as string | null)
      .filter((p): p is string => typeof p === 'string' && p.length > 0);

    const passportById: Record<string, PassportRow> = {};

    if (passportIds.length > 0) {
      const { data: pps } = await admin
        .from('polity_passport_records')
        .select(PASSPORT_COLS)
        .in('passport_id', passportIds);
      for (const p of (pps ?? []) as PassportRow[]) {
        passportById[p.passport_id] = p;
      }
    }

    // bound_passport_id is only set when the agent's participant passport is
    // CLAIMED. An approved-but-unclaimed passport leaves bound_passport_id
    // null, which previously rendered as "Awaiting issuance" even though the
    // passport had been issued. Resolve those via the application linkage:
    //   agent_card_url → polity_passport_applications → application_id →
    //   polity_passport_records — so issued passports surface (claimable)
    //   before the claim binds them.
    const unboundCardUrls = agentRows
      .filter((r) => !(r.bound_passport_id as string | null) && (r.agent_card_url as string | null))
      .map((r) => r.agent_card_url as string);
    // agent_card_url → most-recent issued passport row
    const passportByCardUrl: Record<string, PassportRow> = {};
    if (unboundCardUrls.length > 0) {
      const { data: apps } = await admin
        .from('polity_passport_applications')
        .select('id, agent_card_url')
        .in('agent_card_url', unboundCardUrls);
      const appIdToCardUrl: Record<string, string> = {};
      for (const a of apps ?? []) {
        if (a.agent_card_url) appIdToCardUrl[String(a.id)] = String(a.agent_card_url);
      }
      const appIds = Object.keys(appIdToCardUrl);
      if (appIds.length > 0) {
        const { data: pps } = await admin
          .from('polity_passport_records')
          .select(PASSPORT_COLS)
          .in('application_id', appIds)
          .order('issued_at', { ascending: false });
        for (const p of (pps ?? []) as Array<PassportRow & { application_id: string | null }>) {
          const cardUrl = p.application_id ? appIdToCardUrl[String(p.application_id)] : undefined;
          // Keep the first (most-recent) issued passport per card url.
          if (cardUrl && !passportByCardUrl[cardUrl]) passportByCardUrl[cardUrl] = p;
        }
      }
    }

    const agents = agentRows.map((row) => {
      const boundPassportId = (row.bound_passport_id as string | null) ?? null;
      const cardUrl = (row.agent_card_url as string | null) ?? null;
      const passport =
        (boundPassportId ? passportById[boundPassportId] : undefined) ??
        (cardUrl ? passportByCardUrl[cardUrl] : undefined);
      const resolvedPassportId = boundPassportId ?? passport?.passport_id ?? null;
      return {
        agentRootId: row.id,
        agentId: row.agent_id,
        didUri: row.did_uri,
        agentClass: row.agent_class,
        displayName: row.display_name,
        description: row.description,
        agentCardUrl: row.agent_card_url,
        agentCardSlug: row.agent_card_slug,
        isAigentMe: row.id === currentAigentMe,
        sponsorPassportId: row.sponsor_passport_id,
        boundPassportId,
        passport: passport
          ? {
              passportId: resolvedPassportId,
              passportClass: passport.passport_class,
              passportGrade: passport.passport_grade,
              passportStatus: passport.citizen_status ?? passport.participant_status,
              issuedAt: passport.issued_at,
              claimedAt: passport.credential_claimed_at,
              personaPublicRef: passport.persona_public_ref,
              kybeDidPublicRef: passport.kybe_did_public_ref,
              worldIdVerified: Boolean(passport.world_id_verified_at),
            }
          : null,
        createdAt: row.created_at,
      };
    });

    // Sponsorship Capacity Protocol — resolved via the canonical resolver
    // (services/access/personaCapacity.ts), never re-derived here (capacity
    // remediation, 2026-09-05: this was a third hand-copied arithmetic block
    // computing the same number). An authenticated administrator is
    // unbounded, honestly (never a fabricated large number).
    const capacityState = await resolveAgentSponsorshipCapacity({
      admin,
      sponsorPersonaId: persona.personaId,
      callerIsAdmin: Boolean(persona.cartridgeFlags?.isAdmin),
    });
    const capacity = capacityState.bounded
      ? { bounded: true as const, base: capacityState.limit, earned: 0, used: capacityState.used, remaining: capacityState.remaining, overCapacity: capacityState.overCapacity }
      : { bounded: false as const, base: null, earned: null, used: capacityState.used, remaining: null, source: capacityState.source };

    // Self-heal: ensure the aigentMe (if any) has its wallet persona so it
    // surfaces in the persona switcher. Idempotent + best-effort — covers
    // aigentMe agents designated before wallet-persona provisioning shipped.
    const aigentMeRow = agentRows.find((r) => r.id === currentAigentMe);
    if (aigentMeRow) {
      await provisionAigentMePersona({
        admin,
        callerAuthProfileId: persona.authProfileId,
        agentRoot: {
          did_uri: String(aigentMeRow.did_uri),
          display_name: String(aigentMeRow.display_name),
          agent_card_slug: aigentMeRow.agent_card_slug ? String(aigentMeRow.agent_card_slug) : null,
        },
      });
    }

    // Sprint 4 — enrich aigentMe with Standing lanes. The standing numbers are
    // T1-safe aggregate scores; only the internal CRM persona ID stays server-side.
    // Resolution chain: agent_root_identity.agent_id → crm_personas.identity_persona_id
    // → crm_persona_reputation.{standing_personal/delegated/stewardship/overall/bucket}.
    const standingByAgentId: Record<
      string,
      {
        personal: number;
        delegated: number;
        stewardship: number;
        overall: number;
        bucket: number;
      }
    > = {};

    const aigentMeAgents = agentRows.filter((r) => r.id === currentAigentMe && r.agent_id);
    if (aigentMeAgents.length > 0) {
      try {
        const crm = getCrmClient();
        const agentIdentityIds = aigentMeAgents.map((r) => String(r.agent_id));
        const { data: crmRows } = await crm
          .from('crm_personas')
          .select('id, identity_persona_id')
          .in('identity_persona_id', agentIdentityIds);

        if (crmRows && crmRows.length > 0) {
          const crmIdToIdentityId: Record<string, string> = {};
          for (const cr of crmRows) {
            if (cr.id && cr.identity_persona_id) {
              crmIdToIdentityId[String(cr.id)] = String(cr.identity_persona_id);
            }
          }
          const crmIds = Object.keys(crmIdToIdentityId);
          if (crmIds.length > 0) {
            const { data: repRows } = await crm
              .from('crm_persona_reputation')
              .select('persona_id, standing_personal, standing_delegated, standing_stewardship, standing_overall, standing_bucket')
              .in('persona_id', crmIds);
            for (const rep of repRows ?? []) {
              const identityId = crmIdToIdentityId[String(rep.persona_id)];
              if (identityId) {
                standingByAgentId[identityId] = {
                  personal: Number(rep.standing_personal ?? 0),
                  delegated: Number(rep.standing_delegated ?? 0),
                  stewardship: Number(rep.standing_stewardship ?? 0),
                  overall: Number(rep.standing_overall ?? 0),
                  bucket: Number(rep.standing_bucket ?? 0),
                };
              }
            }
          }
        }
      } catch {
        // Best-effort — standing is informational, never blocks agent listing.
      }
    }

    const agentsWithStanding = agents.map((a) => ({
      ...a,
      standing: a.isAigentMe && (a.agentId as string | null)
        ? (standingByAgentId[String(a.agentId)] ?? null)
        : null,
    }));

    return NextResponse.json(
      { ok: true, agents: agentsWithStanding, capacity },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Lookup failed' },
      { status: 500 },
    );
  }
}
