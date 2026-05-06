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
import { createClient } from '@supabase/supabase-js';

import {
  getCallerIdentityContext,
  type CallerIdentityContext,
} from '@/services/wallet/personaRepo';
import { getMergedLinkedAuthProfileIds } from '@/services/wallet/multiEmailIdentity';

import type {
  ActivePersonaContext,
  Identifiability,
} from '@/types/access';

// ─────────────────────────────────────────────────────────────────────────
// Internal Supabase admin client (read-only access for resolution).
// Server-side only; never imported into client bundles.
// ─────────────────────────────────────────────────────────────────────────

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase configuration missing for getActivePersona');
  return createClient(url, key);
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
 *   4. Default: first owned persona for the caller (deterministic order)
 */
async function resolveActivePersonaId(
  request: NextRequest,
  ownedPersonaIds: string[],
): Promise<{ personaId: string | null; source: ActivePersonaContext['source'] }> {
  // 1) personaSessionToken (T1) — Phase 1.1.a hook
  const pstFromQuery = (() => {
    try {
      return new URL(request.url).searchParams.get('pst');
    } catch {
      return null;
    }
  })();
  const pstFromHeader = request.headers.get('x-persona-session-token');
  const pst = pstFromQuery || pstFromHeader;
  if (pst) {
    // TODO Phase 1.1.a: services/identity/personaSessionToken.verify(pst)
    // For now, the hook is reserved; verifier returns null until Phase 1.1.a ships.
    // Do NOT silently fall through if a PST was presented but the verifier is
    // unavailable — that would be a privacy regression. Log and continue.
    // (Logger omitted; this branch is dormant until 1.1.a wires the verifier.)
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
}

async function listOwnedPersonas(
  authProfileId: string,
): Promise<OwnedPersonaRow[]> {
  const admin = getAdminClient();
  const linked = await getMergedLinkedAuthProfileIds(authProfileId).catch(() => []);
  const visibleAuthProfileIds = Array.from(new Set([authProfileId, ...linked]));

  const { data, error } = await admin
    .from('personas')
    .select('id,default_identity_state,created_at')
    .in('auth_profile_id', visibleAuthProfileIds)
    .eq('status', 'active')
    .order('created_at', { ascending: true });

  if (error) return [];
  const rows = (data || []) as Array<{ id: string; default_identity_state: string | null }>;
  return rows.map((row) => ({
    id: String(row.id),
    default_identity_state: row.default_identity_state ?? null,
  }));
}

// ─────────────────────────────────────────────────────────────────────────
// Cartridge flags
// ─────────────────────────────────────────────────────────────────────────

async function resolveAdminFlag(callerEmail: string | null): Promise<boolean> {
  if (!callerEmail) return false;
  try {
    const admin = getAdminClient();
    const email = callerEmail.trim().toLowerCase();

    // Locate the auth profile id for this email (handles multi-email merge).
    const { data: profile } = await admin
      .from('crm_auth_profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    const authProfileId = profile?.id;
    if (!authProfileId) return false;

    const { data: roles } = await admin
      .from('crm_admin_roles')
      .select('id,is_active')
      .eq('auth_profile_id', authProfileId)
      .eq('is_active', true)
      .limit(1);
    return Array.isArray(roles) && roles.length > 0;
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
  const owned = await listOwnedPersonas(caller.authProfileId);
  const ownedIds = owned.map((p) => p.id);

  // 3. Active persona pick
  const { personaId, source } = await resolveActivePersonaId(request, ownedIds);
  if (!personaId) return null;

  // 4. Identifiability — read from the persona row, not invented
  const personaRow = owned.find((p) => p.id === personaId);
  const identifiability = normaliseIdentifiability(personaRow?.default_identity_state ?? null);

  // 5. Cartridge flags
  const [isAdmin, isPartner] = await Promise.all([
    resolveAdminFlag(caller.email ?? null),
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
    source,
  };
}
