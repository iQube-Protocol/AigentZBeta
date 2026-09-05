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
import {
  getAgentPassportBinding,
  checkAgentClassConstraints,
} from '@/services/polity/constitution';
import { resolveAgentSponsorshipCapacity } from '@/services/access/personaCapacity';

export const SLUG_RE = /^[a-z][a-z0-9-]{2,40}$/;

/**
 * A governed exception to the ordinary sponsorship cap. Recorded so the act is
 * auditable AS an override rather than appearing as ordinary capacity.
 */
export interface SponsorshipCapacityOverride {
  authority: 'administrator' | 'migrated_agent_passport_issuance' | 'platform';
  /** The constitutional basis relied upon — stated, never inferred. */
  basis: string;
  /** What ordinary capacity actually was at the moment of override. */
  ordinaryCapacityAtOverride: { base: number; earned: number; used: number; remaining: number };
}

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
  /**
   * Option A — deploy a polity_autonomous agent. Requires callerIsAdmin. Stamps
   * the constitutional binding (Constitution / Agent Charter / Delegation
   * Framework versions + revocation authority) onto the agent and enforces the
   * ADID constraints (no kybe DID, never human, never a citizen passport).
   */
  isAutonomous?: boolean;
  /** Whether the caller holds platform admin authority (gates autonomous). */
  callerIsAdmin?: boolean;
  /**
   * Set ONLY when minting the RootDID for an agent that already has an
   * identity elsewhere in the platform (e.g. `agent_keys.agent_id` /
   * `runtimeAgentId` from the Horizen registrable-agent config) — an agent
   * MIGRATED into the constitutional admission journey rather than born in
   * it. When present, this identity is used verbatim instead of deriving
   * `agent_id`/`did_uri` from `slug` (which would mint a SECOND, disagreeing
   * identifier for the same agent — the exact defect class this override
   * exists to avoid). `agentCardUrl` must match the agent's already-served
   * card, since the platform anchors participant identity on that URL.
   */
  existingIdentity?: { agentId: string; didUri: string; agentCardUrl: string };
  /**
   * Set ONLY to complete an act a steward has ALREADY approved (a Delegate
   * Passport application decided `approved`) for a migrated agent that has
   * no RootDID yet. This is not a request for NEW sponsorship capacity —
   * the sponsoring act already happened at Passport approval; minting the
   * RootDID here is projecting that approval, not making a fresh capacity
   * decision. Bypasses the ordinary-capacity block (never `callerIsAdmin`,
   * which implies a live administrator in the request) and records the
   * override with `authority: 'migrated_agent_passport_issuance'` so it is
   * auditable as a distinct, narrow reason rather than silent or
   * indistinguishable from an admin's own capacity override.
   */
  migratedAgentApprovedPassportId?: string;
  /**
   * Set ONLY by a route that has already authenticated a platform-level
   * credential (e.g. CRON_TRIGGER_TOKEN) with no human persona/session
   * involved at all — the platform-agent provisioning path (Factor/Aegis-
   * style stand-ups). Grants the SAME unbounded capacity treatment as
   * `callerIsAdmin`, recorded distinctly as `authority: 'platform'` so it is
   * auditable as its own narrow reason. NEVER set from a persona-derived
   * flag, a request body, or client input — see
   * services/access/personaCapacity.ts's `isPlatformAuthority`.
   */
  isPlatformAuthority?: boolean;
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
  /** Present only when a canonical admin proceeded past an exhausted cap. */
  capacityOverride?: SponsorshipCapacityOverride | null;
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
    isAutonomous = false,
    callerIsAdmin = false,
    existingIdentity,
    migratedAgentApprovedPassportId,
    isPlatformAuthority = false,
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

  // Class resolution. polity_autonomous (Option A) is admin-only and binds to
  // the current constitution; everything else is polity_bound.
  const wantsAutonomous = isAutonomous || agentClass === 'polity_autonomous';
  if (wantsAutonomous && !callerIsAdmin) {
    return {
      ok: false,
      status: 403,
      code: 'autonomous_requires_admin',
      error: 'Autonomous agents (Option A) may be deployed by platform administrators only.',
    };
  }
  const resolvedClass = wantsAutonomous ? 'polity_autonomous' : 'polity_bound';

  // ADID constraints (Agent Charter): an autonomous agent carries no kybe DID,
  // never presents as human, and can never hold a citizen passport.
  if (wantsAutonomous) {
    const violations = checkAgentClassConstraints({
      hasKybeDid: false,
      isHuman: false,
      passportClass: 'agent_participant',
    });
    if (violations.length > 0) {
      return {
        ok: false,
        status: 422,
        code: 'agent_class_constraint_violation',
        error: `Autonomous agent constraint violation: ${violations.join(', ')}`,
      };
    }
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

  // 1b. Bounded-delegate capacity — resolved ONCE via the canonical
  // resolveAgentSponsorshipCapacity (services/access/personaCapacity.ts),
  // never re-derived inline here (Extend-Don't-Duplicate — this exact
  // arithmetic used to be hand-copied into this file AND the Homecoming
  // stand-up route's GET preflight; capacity remediation, 2026-09-05).
  // Computed as though the caller were NOT an admin/platform authority
  // first, purely to know whether an override is actually being exercised
  // (see below) — never to gate a real admin/platform caller, who is
  // unconditionally unbounded per the resolver's own rules.
  const ordinary = await resolveAgentSponsorshipCapacity({ admin, sponsorPersonaId, callerIsAdmin: false });
  /**
   * Set ONLY when a canonical administrator, a platform-authenticated
   * caller, or an already-approved migrated-agent passport proceeded past
   * an exhausted ORDINARY capacity. Null on every ordinary sponsorship, so a
   * consumer can tell an exercised exception from ordinary headroom without
   * inspecting numbers.
   */
  let capacityOverride: SponsorshipCapacityOverride | null = null;

  if (ordinary.bounded && ordinary.remaining <= 0) {
    /*
     * ── ADMINISTRATOR / PLATFORM CAPACITY OVERRIDE (operator-authorised,
     *    2026-08-03; extended to platform-agent provisioning 2026-09-05) ──
     *
     *   > "Administrative authority may override ordinary sponsorship
     *   >  capacity, but it does not bypass Passport ownership,
     *   >  authentication, agent-control, or personhood requirements."
     *   > "Factor and Aegis are platform agents provisioned under
     *   >  authenticated administrative/platform authority. Their creation
     *   >  must not consume or be blocked by an ordinary retail-user quota."
     *
     * DELIBERATELY NARROW, and placed HERE rather than earlier: every gate
     * above this point has already run and must still pass. A canonical
     * admin/platform caller arriving here has a valid sponsoring Passport,
     * an authenticated persona (or an already-authenticated platform
     * credential), and a proven agent binding — the override relieves ONE
     * constraint, the numeric cap, and nothing else.
     *
     * `callerIsAdmin` is resolved server-side by the spine
     * (getActivePersona: `isAdmin || adminGrants.isGlobalAdmin`), never from
     * a client hint or an account label. `isPlatformAuthority` is set ONLY
     * by a route that has already validated a platform-level credential
     * (e.g. CRON_TRIGGER_TOKEN) — never inferred, never client-supplied.
     *
     * THE ORDINARY CAPACITY IS NOT REWRITTEN. `ordinaryCapacityAtOverride`
     * still reports `remaining: 0` — honestly, because it IS zero — and the
     * override is carried as its own field. Inflating the number would make
     * an exercised exception indistinguishable from ordinary headroom, which
     * is exactly what the operator ruled against: "do not rewrite the
     * displayed ordinary capacity as positive."
     */
    if (migratedAgentApprovedPassportId) {
      capacityOverride = {
        authority: 'migrated_agent_passport_issuance',
        basis:
          `completing RootDID projection for an already-approved Delegate Passport ` +
          `(${migratedAgentApprovedPassportId}) — the sponsoring act happened at steward ` +
          'approval, not here; this is not a new capacity decision',
        ordinaryCapacityAtOverride: { base: ordinary.limit, earned: 0, used: ordinary.used, remaining: 0 },
      };
    } else if (isPlatformAuthority) {
      capacityOverride = {
        authority: 'platform',
        basis:
          'platform-agent provisioning under an authenticated platform-level credential ' +
          '(e.g. CRON_TRIGGER_TOKEN) — capacity limit only, never a retail-user quota',
        ordinaryCapacityAtOverride: { base: ordinary.limit, earned: 0, used: ordinary.used, remaining: 0 },
      };
    } else if (!callerIsAdmin) {
      return {
        ok: false,
        status: 409,
        code: 'sponsorship_capacity_exhausted',
        error:
          `Bounded delegate capacity reached for your plan (${ordinary.limit}). Upgrade your tier, ` +
          'or earn additional capacity when a sponsored participant reaches Standing.',
        capacity: { base: ordinary.limit, earned: 0, used: ordinary.used, remaining: 0 },
      };
    } else {
      capacityOverride = {
        authority: 'administrator',
        basis: 'canonical admin authority (persona.cartridgeFlags.isAdmin) — capacity limit only',
        ordinaryCapacityAtOverride: { base: ordinary.limit, earned: 0, used: ordinary.used, remaining: 0 },
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

  // 3. Write the root identity. A migrated agent keeps the identity it
  // already has everywhere else on the platform (agent_keys.agent_id /
  // runtimeAgentId) rather than a freshly-derived one — see
  // `existingIdentity` above.
  const agentIdPrefix = resolvedClass === 'polity_autonomous' ? 'polity-autonomous' : 'polity-bound';
  const agentId = existingIdentity?.agentId ?? `${agentIdPrefix}:${slug}`;
  const didUri = existingIdentity?.didUri ?? `did:agent:root:${slug}`;
  const agentCardUrl = existingIdentity?.agentCardUrl ?? `${origin}/api/agents/${slug}/agent-card.json`;

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
  // Option A — stamp the constitutional binding + revocation authority.
  if (resolvedClass === 'polity_autonomous') {
    const binding = getAgentPassportBinding();
    insertRow.constitution_version = binding.constitutionVersion;
    insertRow.agent_charter_version = binding.agentCharterVersion;
    insertRow.delegation_framework_version = binding.delegationFrameworkVersion;
    insertRow.revocation_authority_persona_id = sponsorPersonaId;
    insertRow.revocation_state = 'active';
  }

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
    // Constitutional binding columns missing → Option A migration pending.
    if (
      rootErr.message.includes('constitution_version') ||
      rootErr.message.includes('revocation_state') ||
      rootErr.message.includes('revocation_authority_persona_id')
    ) {
      return {
        ok: false,
        status: 503,
        error:
          'Pending migration: 20260617100000_agent_constitutional_binding.sql must be applied before autonomous agents can be deployed.',
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
    /*
     * Carried on the SUCCESS outcome so the caller can receipt the act AS an
     * override and label the surface "Sponsorship permitted by administrator
     * override". Null on every ordinary sponsorship — its presence, not a
     * number, is what distinguishes an exercised exception.
     */
    capacityOverride,
  };
}
