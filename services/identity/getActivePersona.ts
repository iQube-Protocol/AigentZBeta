/**
 * getActivePersona — server-side resolver for the active persona context.
 *
 * Phase 1.1 of the unified identity-content-access foundation plan.
 * See: codexes/packs/agentiq/updates/2026-05-05_unified-identity-content-access-foundation-plan.md
 *
 * This is the SINGLE function that produces an ActivePersonaContext.
 * Returns the T0 server-internal shape (personaId, authProfileId, etc.).
 * Routes that produce JSON responses MUST strip this context and emit
 * only ActivePersonaSurface (T1) — see Phase 1.1.c.
 *
 * Composition (additive — no existing service is modified):
 *   1. Caller identity      → services/wallet/personaRepo.getCallerIdentityContext
 *   2. Linked auth profiles → services/wallet/multiEmailIdentity.getMergedLinkedAuthProfileIds
 *   3. Active persona pick  → URL/header/cookie/default chain (see resolveActivePersonaId)
 *   4. Ownership check      → personas.auth_profile_id ∈ { caller, linked... }
 *   5. Admin flag           → crm_admin_roles by caller email
 *
 * Existing identity resolution paths in routes are NOT modified by this
 * commit. Surface migration happens one route per commit per the
 * surgical-change protocol (plan §1.5).
 */

import type { NextRequest } from 'next/server';

import {
  getCallerIdentityContext,
  type CallerIdentityContext,
} from '@/services/wallet/personaRepo';
import { getMergedLinkedAuthProfileIds } from '@/services/wallet/multiEmailIdentity';
import {
  readTokenFromRequest,
  verifyPersonaSessionToken,
} from '@/services/identity/personaSessionToken';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

import type {
  ActivePersonaContext,
  Identifiability,
} from '@/types/access';

// ─────────────────────────────────────────────────────────────────────────
// Supabase client — timeout-guarded factory (8s in prod, 4s in dev) so a
// slow DB query doesn't hang to the Lambda 30s ceiling and 504. This was
// flagged in the Phase 2 backlog as a class-wide reliability issue; this
// service uses the canonical factory from day 1.
// ─────────────────────────────────────────────────────────────────────────

function getAdminClient() {
  const client = getSupabaseServer();
  if (!client) throw new Error('Supabase configuration missing for getActivePersona');
  return client;
}

// ─────────────────────────────────────────────────────────────────────────
// Active persona resolution — input source priority chain
// ─────────────────────────────────────────────────────────────────────────

/**
 * Source priority for the active personaId. First non-empty wins.
 *
 *   1. personaSessionToken (?pst= or x-persona-session-token header)
 *      — Phase 1.1.a; reserved hook, returns null today
 *   2. x-persona-id header — existing platform convention
 *   3. ?personaId= URL parameter — LEGACY; accepted with deprecation
 *      warning during the Phase 1 backward-compat window
 *   3.5. crm_auth_profiles.default_persona_id — caller's explicit
 *      preferred persona. Set when a user picks "make this my default"
 *      or when onboarding mints their first owned persona. Resolved
 *      against the caller AND every multi-email-merged linked profile.
 *   4. Default: first owned persona for the caller (deterministic order)
 */
async function resolveDefaultPersonaIdFromProfile(
  callerAuthProfileId: string,
  linkedAuthProfileIds: string[],
  ownedPersonaIds: string[],
): Promise<string | null> {
  try {
    const admin = getAdminClient();
    const candidates = Array.from(new Set([callerAuthProfileId, ...linkedAuthProfileIds]));
    if (candidates.length === 0) return null;
    const { data } = await admin
      .from('crm_auth_profiles')
      .select('id,default_persona_id')
      .in('id', candidates);
    const rows = (data || []) as Array<{ id: string; default_persona_id: string | null }>;
    // Prefer the caller's own row first, then merged profiles by listed order.
    const ordered = [
      ...rows.filter((r) => r.id === callerAuthProfileId),
      ...rows.filter((r) => r.id !== callerAuthProfileId),
    ];
    for (const row of ordered) {
      const candidate = row.default_persona_id;
      if (candidate && ownedPersonaIds.includes(candidate)) return candidate;
    }
    return null;
  } catch {
    return null;
  }
}

async function resolveActivePersonaId(
  request: NextRequest,
  ownedPersonaIds: string[],
  callerAuthProfileId: string,
  linkedAuthProfileIds: string[],
): Promise<{ personaId: string | null; source: ActivePersonaContext['source'] }> {
  // 1) personaSessionToken (T1) — preferred input source
  const pst = readTokenFromRequest(request);
  if (pst) {
    const verified = verifyPersonaSessionToken(pst);
    if (verified.ok) {
      // The token's authProfileId must match the caller's session (or any
      // linked profile under multi-email merge). This rejects replay across
      // sessions while still honouring multi-email-merged personas.
      const allowedProfiles = new Set([callerAuthProfileId, ...linkedAuthProfileIds]);
      if (
        allowedProfiles.has(verified.data.authProfileId) &&
        ownedPersonaIds.includes(verified.data.personaId)
      ) {
        return { personaId: verified.data.personaId, source: 'session-token' };
      }
      // Token is cryptographically valid but does not bind to this caller;
      // do NOT fall through to weaker sources — refuse rather than silently
      // pick the default. This protects against PST mis-binding.
      return { personaId: null, source: 'session-token' };
    }
    // Verifier failure (expired / bad-signature / malformed): fall through
    // to weaker sources during the Phase 1 backward-compat window. After
    // the deprecation window closes (Phase 5), this becomes a hard reject.
  }

  // 2) x-persona-id header — existing convention
  const headerPersonaId = request.headers.get('x-persona-id')?.trim();
  if (headerPersonaId && ownedPersonaIds.includes(headerPersonaId)) {
    return { personaId: headerPersonaId, source: 'session-token' };
  }

  // 3) ?personaId= URL parameter — LEGACY (Phase 1 deprecation window)
  const urlPersonaId = (() => {
    try {
      return new URL(request.url).searchParams.get('personaId')?.trim() || null;
    } catch {
      return null;
    }
  })();
  if (urlPersonaId && ownedPersonaIds.includes(urlPersonaId)) {
    return { personaId: urlPersonaId, source: 'session-token' };
  }

  // 3.5) crm_auth_profiles.default_persona_id — caller's explicit
  //      preferred persona. Beats the oldest-by-created_at fallback so
  //      brand-new users don't inherit a shared agent persona on first
  //      load. Resolved across caller + multi-email-merged profiles.
  const defaultPersonaId = await resolveDefaultPersonaIdFromProfile(
    callerAuthProfileId,
    linkedAuthProfileIds,
    ownedPersonaIds,
  );
  if (defaultPersonaId) {
    return { personaId: defaultPersonaId, source: 'session-cookie' };
  }

  // 4) Default: first owned persona (deterministic — sorted at the query layer)
  if (ownedPersonaIds.length > 0) {
    return { personaId: ownedPersonaIds[0], source: 'session-cookie' };
  }

  return { personaId: null, source: 'session-cookie' };
}

// ─────────────────────────────────────────────────────────────────────────
// Owned persona enumeration (across linked auth profiles)
// ─────────────────────────────────────────────────────────────────────────

interface OwnedPersonaRow {
  id: string;
  default_identity_state: string | null;
  fio_handle: string | null;
}

async function listOwnedPersonas(
  authProfileId: string,
): Promise<{ personas: OwnedPersonaRow[]; linkedAuthProfileIds: string[] }> {
  const admin = getAdminClient();
  const linkedAuthProfileIds = await getMergedLinkedAuthProfileIds(authProfileId).catch(() => []);
  const visibleAuthProfileIds = Array.from(new Set([authProfileId, ...linkedAuthProfileIds]));

  const { data, error } = await admin
    .from('personas')
    .select('id,default_identity_state,fio_handle,created_at')
    .in('auth_profile_id', visibleAuthProfileIds)
    .eq('status', 'active')
    .order('created_at', { ascending: true });

  if (error) return { personas: [], linkedAuthProfileIds };
  const rows = (data || []) as Array<{ id: string; default_identity_state: string | null; fio_handle: string | null }>;
  return {
    personas: rows.map((row) => ({
      id: String(row.id),
      default_identity_state: row.default_identity_state ?? null,
      fio_handle: row.fio_handle ?? null,
    })),
    linkedAuthProfileIds,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Cartridge flags
// ─────────────────────────────────────────────────────────────────────────

async function resolveAdminFlag(
  authProfileId: string,
  linkedAuthProfileIds: string[],
  callerEmail: string | null,
): Promise<boolean> {
  try {
    const admin = getAdminClient();

    // 1) Direct lookup against the canonical authProfileId + every multi-
    //    email-merged linked profile in a single IN query. This matches the
    //    behaviour of getCallerIdentityContext which has already resolved
    //    the canonical id; we should not redo the email lookup ourselves.
    const candidateProfileIds = Array.from(
      new Set([authProfileId, ...linkedAuthProfileIds]),
    );
    if (candidateProfileIds.length > 0) {
      const { data } = await admin
        .from('crm_admin_roles')
        .select('id')
        .in('auth_profile_id', candidateProfileIds)
        .eq('is_active', true)
        .limit(1);
      if (Array.isArray(data) && data.length > 0) return true;
    }

    // 2) Fallback via the alias table — covers the case where the admin
    //    role was granted against an auth_profile_id that the merge view
    //    hasn't linked yet, but the email IS registered on it. Same path
    //    /api/codex/admin-check uses.
    if (callerEmail) {
      const email = callerEmail.trim().toLowerCase();
      const { data: aliasRows } = await admin
        .from('crm_auth_profile_emails')
        .select('auth_profile_id')
        .eq('email_normalized', email)
        .eq('status', 'active');
      const aliasProfileIds = ((aliasRows || []) as Array<{ auth_profile_id?: string }>)
        .map((r) => r.auth_profile_id)
        .filter((id): id is string => !!id && !candidateProfileIds.includes(id));
      if (aliasProfileIds.length > 0) {
        const { data } = await admin
          .from('crm_admin_roles')
          .select('id')
          .in('auth_profile_id', aliasProfileIds)
          .eq('is_active', true)
          .limit(1);
        if (Array.isArray(data) && data.length > 0) return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

// Partner flag is not yet a first-class platform concept; default false until
// the partner-roles table lands (tracked in CLAUDE.md and the cohort backlog).
function resolvePartnerFlag(): boolean {
  return false;
}

// ─────────────────────────────────────────────────────────────────────────
// Identifiability
// ─────────────────────────────────────────────────────────────────────────

const IDENTIFIABILITY_VALUES: ReadonlySet<Identifiability> = new Set([
  'anonymous',
  'semi_anonymous',
  'semi_identifiable',
  'identifiable',
]);

function normaliseIdentifiability(raw: string | null | undefined): Identifiability {
  if (raw && IDENTIFIABILITY_VALUES.has(raw as Identifiability)) {
    return raw as Identifiability;
  }
  // Default floor — privacy-first
  return 'semi_anonymous';
}

// ─────────────────────────────────────────────────────────────────────────
// Public entry point
// ─────────────────────────────────────────────────────────────────────────

export async function getActivePersona(
  request: NextRequest,
): Promise<ActivePersonaContext | null> {
  // 1. Caller identity
  const caller: CallerIdentityContext | null = await getCallerIdentityContext(request);
  if (!caller?.authProfileId) return null;

  // 2. Owned personas (across merged auth profiles)
  const { personas: owned, linkedAuthProfileIds } = await listOwnedPersonas(
    caller.authProfileId,
  );
  const ownedIds = owned.map((p) => p.id);

  // 3. Active persona pick
  const { personaId, source } = await resolveActivePersonaId(
    request,
    ownedIds,
    caller.authProfileId,
    linkedAuthProfileIds,
  );
  if (!personaId) return null;

  // 4. Identifiability — read from the persona row, not invented.
  //
  //    EXTENSION POINT (plan §11.d backlog): when `personaRow` belongs to
  //    an agent persona, clamp this value to the FLOOR of (agent declared,
  //    operator current). Most-restrictive wins. Walks
  //    agent_persona -> owner_root_identity -> active human persona.
  //    Not implemented in Phase 1 because delegation paths are not yet
  //    routine in production traffic; landing now would add regression
  //    risk against an untested path. The contract here does not change
  //    when the clamp lands — `identifiability` remains a single value.
  const personaRow = owned.find((p) => p.id === personaId);
  const identifiability = normaliseIdentifiability(personaRow?.default_identity_state ?? null);

  // 5. Cartridge flags
  const [isAdmin, isPartner] = await Promise.all([
    resolveAdminFlag(caller.authProfileId, linkedAuthProfileIds, caller.email ?? null),
    Promise.resolve(resolvePartnerFlag()),
  ]);

  // 6. Cohort memberships — table not yet built (cohort backlog Phase 3 wire-up).
  //    Return empty list rather than guess. Consumers must not infer cohort
  //    membership from any other signal.
  const cohortMemberships: string[] = [];

  return {
    personaId,
    authProfileId: caller.authProfileId,
    identifiability,
    cartridgeFlags: {
      isAdmin,
      isPartner,
    },
    cohortMemberships,
    fioHandle: personaRow?.fio_handle ?? null,
    source,
  };
}
