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

    // Pull all sponsored agents for this persona. The aigentMe designation
    // (is_aigent_me) is a later migration than genesis — if that column isn't
    // present yet we fall back to the pre-aigentMe query so sponsored agents
    // keep rendering rather than vanishing.
    const baseCols =
      'id, agent_id, did_uri, agent_class, display_name, description, agent_card_url, agent_card_slug, sponsor_passport_id, bound_passport_id, created_at';

    let rows: Record<string, unknown>[] | null = null;
    let error: { message: string } | null = null;

    const enriched = await admin
      .from('agent_root_identity')
      .select(`${baseCols}, is_aigent_me`)
      .eq('sponsor_persona_id', persona.personaId)
      // aigentMe (the primary delegate) sorts first, then newest sponsorships.
      .order('is_aigent_me', { ascending: false })
      .order('created_at', { ascending: false });

    if (enriched.error && enriched.error.message.includes('is_aigent_me')) {
      // aigentMe migration pending — retry without the column/order.
      const fallback = await admin
        .from('agent_root_identity')
        .select(baseCols)
        .eq('sponsor_persona_id', persona.personaId)
        .order('created_at', { ascending: false });
      rows = fallback.data;
      error = fallback.error;
    } else {
      rows = enriched.data;
      error = enriched.error;
    }

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

    const agentRows = rows ?? [];

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
        isAigentMe: Boolean(row.is_aigent_me),
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

    // Sponsorship Capacity Protocol (Phase 3). base + earned = total slots;
    // used = active sponsorships (already-fetched agentRows). Soft-fail if the
    // capacity migration hasn't been applied yet — clients render the section
    // without capacity rather than breaking.
    let capacity: { base: number; earned: number; used: number; remaining: number } | null = null;
    const { data: capacityRow, error: capacityErr } = await admin
      .from('personas')
      .select('sponsorship_capacity_base, sponsorship_capacity_earned')
      .eq('id', persona.personaId)
      .maybeSingle();
    if (!capacityErr && capacityRow?.sponsorship_capacity_base != null) {
      const base = Number(capacityRow.sponsorship_capacity_base);
      const earned = Number(capacityRow.sponsorship_capacity_earned ?? 0);
      const used = agentRows.length;
      capacity = { base, earned, used, remaining: Math.max(0, base + earned - used) };
    }

    return NextResponse.json(
      { ok: true, agents, capacity },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Lookup failed' },
      { status: 500 },
    );
  }
}
