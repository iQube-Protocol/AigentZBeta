/**
 * sponsorPolityAgent — shared genesis core for citizen-sponsored agents.
 *
 * Both the citizen-facing genesis route (/api/agents/genesis) and the
 * one-click aigentMe route (/api/agents/aigentme) funnel through this helper
 * so the sponsor-ownership check, Sponsorship Capacity Protocol enforcement,
 * slug uniqueness, and the agent_root_identity insert live in exactly one
 * place (Extend-Don't-Duplicate).
 *
 * T0 discipline: sponsorPersonaId is server-internal — it is written to the
 * row and used for capacity counting, never returned to the browser. Callers
 * project only the public agent metadata.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export const SLUG_RE = /^[a-z][a-z0-9-]{2,40}$/;

export interface SponsorAgentInput {
  admin: SupabaseClient;
  /** Active persona id (T0) — sponsor + capacity owner. */
  sponsorPersonaId: string;
  /** Citizen passport sponsoring this genesis. */
  sponsorPassportId: string;
  slug: string;
  displayName: string;
  description: string;
  /** Public origin for the agent card URL, e.g. https://dev-beta.aigentz.me */
  origin: string;
  agentClass?: 'polity_bound' | 'polity_autonomous';
  /** Marks this as the citizen's primary personal delegate (aigentMe). */
  isAigentMe?: boolean;
}

export interface SponsoredAgentResult {
  agentRootId: string;
  agentId: string;
  didUri: string;
  agentClass: string;
  displayName: string;
  description: string;
  agentCardUrl: string;
  agentCardSlug: string;
  isAigentMe: boolean;
  sponsorPassportId: string;
  createdAt: string;
}

export interface SponsorAgentOutcome {
  ok: boolean;
  status: number;
  agent?: SponsoredAgentResult;
  error?: string;
  code?: string;
  capacity?: { base: number; earned: number; used: number; remaining: number };
}

/**
 * Performs the full genesis: validate sponsor ownership, enforce capacity,
 * check slug uniqueness, insert the root identity. Returns a structured
 * outcome the route translates into an HTTP response.
 */
export async function sponsorPolityAgent(input: SponsorAgentInput): Promise<SponsorAgentOutcome> {
  const {
    admin,
    sponsorPersonaId,
    sponsorPassportId,
    slug,
    displayName,
    description,
    origin,
    agentClass,
    isAigentMe = false,
  } = input;

  if (!slug || !SLUG_RE.test(slug)) {
    return {
      ok: false,
      status: 400,
      error: 'slug must be 3-41 chars, lowercase letters/digits/hyphens, starting with a letter',
    };
  }
  if (!displayName?.trim() || !description?.trim()) {
    return { ok: false, status: 400, error: 'displayName and description are required' };
  }
  if (!sponsorPassportId?.trim()) {
    return {
      ok: false,
      status: 400,
      error: 'sponsorPassportId is required — the citizen passport sponsoring this genesis',
    };
  }

  // polity_autonomous requires admin governance decoupling.
  const resolvedClass = agentClass === 'polity_autonomous' ? null : 'polity_bound';
  if (!resolvedClass) {
    return {
      ok: false,
      status: 403,
      error:
        'polity_autonomous requires admin governance decoupling — use POST /api/governance/agent/decouple (Phase B)',
    };
  }

  // 1. Sponsor passport ownership — caller must own the citizen passport.
  const { data: sponsorRow, error: sponsorErr } = await admin
    .from('polity_passport_records')
    .select('passport_id, persona_id, passport_class, citizen_status')
    .eq('passport_id', sponsorPassportId)
    .maybeSingle();
  if (sponsorErr) return { ok: false, status: 500, error: sponsorErr.message };
  if (!sponsorRow) return { ok: false, status: 404, error: 'Sponsor passport not found' };
  if (sponsorRow.persona_id && sponsorRow.persona_id !== sponsorPersonaId) {
    return { ok: false, status: 403, error: 'Caller does not own the sponsor passport' };
  }
  if (sponsorRow.passport_class !== 'citizen') {
    return { ok: false, status: 400, error: 'Only citizen passports may sponsor agent genesis' };
  }

  // 1b. Sponsorship Capacity Protocol (Phase 3). Soft-fail if the capacity
  // migration hasn't been applied yet (treats capacity as unbounded).
  const { data: capacityRow, error: capacityErr } = await admin
    .from('personas')
    .select('sponsorship_capacity_base, sponsorship_capacity_earned')
    .eq('id', sponsorPersonaId)
    .maybeSingle();
  if (
    capacityErr &&
    !capacityErr.message.includes('sponsorship_capacity_base') &&
    !capacityErr.message.includes('sponsorship_capacity_earned')
  ) {
    return { ok: false, status: 500, error: capacityErr.message };
  }
  if (capacityRow?.sponsorship_capacity_base != null) {
    const base = Number(capacityRow.sponsorship_capacity_base);
    const earned = Number(capacityRow.sponsorship_capacity_earned ?? 0);
    const { count: usedCount } = await admin
      .from('agent_root_identity')
      .select('id', { count: 'exact', head: true })
      .eq('sponsor_persona_id', sponsorPersonaId);
    const used = usedCount ?? 0;
    const remaining = base + earned - used;
    if (remaining <= 0) {
      return {
        ok: false,
        status: 409,
        code: 'sponsorship_capacity_exhausted',
        error:
          'Sponsorship capacity exhausted. Earn additional capacity when a sponsored participant reaches Standing.',
        capacity: { base, earned, used, remaining: 0 },
      };
    }
  }

  // 2. Slug uniqueness — pre-flight so the unique index error doesn't leak.
  const { data: existing, error: existingErr } = await admin
    .from('agent_root_identity')
    .select('agent_id')
    .eq('agent_card_slug', slug)
    .maybeSingle();
  if (existingErr && !existingErr.message.includes('agent_card_slug')) {
    return { ok: false, status: 500, error: existingErr.message };
  }
  if (existing) {
    return { ok: false, status: 409, error: `Slug '${slug}' already taken — choose another` };
  }

  // 3. Write the root identity.
  const agentId = `polity-bound:${slug}`;
  const didUri = `did:agent:root:${slug}`;
  const agentCardUrl = `${origin}/api/agents/${slug}/agent-card.json`;

  const insertRow: Record<string, unknown> = {
    agent_id: agentId,
    did_uri: didUri,
    agent_class: resolvedClass,
    display_name: displayName.trim(),
    description: description.trim(),
    sponsor_passport_id: sponsorPassportId,
    sponsor_persona_id: sponsorPersonaId,
    agent_card_url: agentCardUrl,
    agent_card_slug: slug,
  };
  if (isAigentMe) insertRow.is_aigent_me = true;

  const { data: rootRow, error: rootErr } = await admin
    .from('agent_root_identity')
    .insert(insertRow)
    .select(
      'id, agent_id, did_uri, agent_class, display_name, description, agent_card_url, agent_card_slug, is_aigent_me, created_at',
    )
    .single();

  if (rootErr) {
    if (
      rootErr.message.includes('sponsor_passport_id') ||
      rootErr.message.includes('agent_card_slug') ||
      rootErr.message.includes('polity_bound')
    ) {
      return {
        ok: false,
        status: 503,
        error:
          'Pending migration: 20260613200000_agent_genesis_polity_bound.sql must be applied in Supabase before agent genesis can persist.',
      };
    }
    // is_aigent_me column missing → aigentMe designation migration pending.
    if (rootErr.message.includes('is_aigent_me')) {
      return {
        ok: false,
        status: 503,
        error:
          'Pending migration: 20260617000000_aigent_me_designation.sql must be applied before aigentMe agents can be designated.',
      };
    }
    // Partial unique index violation → an aigentMe already exists for this persona.
    if (rootErr.message.includes('uq_agent_root_aigent_me_per_persona')) {
      return {
        ok: false,
        status: 409,
        code: 'aigent_me_exists',
        error: 'An aigentMe agent already exists for this persona.',
      };
    }
    return { ok: false, status: 500, error: rootErr.message };
  }

  return {
    ok: true,
    status: 200,
    agent: {
      agentRootId: rootRow.id,
      agentId: rootRow.agent_id,
      didUri: rootRow.did_uri,
      agentClass: rootRow.agent_class,
      displayName: rootRow.display_name,
      description: rootRow.description,
      agentCardUrl: rootRow.agent_card_url,
      agentCardSlug: rootRow.agent_card_slug,
      isAigentMe: Boolean(rootRow.is_aigent_me),
      sponsorPassportId,
      createdAt: rootRow.created_at,
    },
  };
}
