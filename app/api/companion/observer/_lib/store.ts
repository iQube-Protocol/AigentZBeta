/**
 * companion_observer_grants — persistence mapping layer.
 *
 * PRD-MMC-IMPL-001 Increment 2 (server-side consent/grant API routes).
 * See: codexes/packs/agentiq/updates/2026-07-23_prd-mmc-impl-001-companion-phase2-implementation-plan.md §2.
 *
 * This module ONLY translates between DB rows and `ObserverGrantState`
 * (`types/companionObserver.ts`). It contains NO consent state-machine
 * logic — `grantCapability` / `revokeCapability` / `listActiveGrants`
 * (`services/companion/observerConsent.ts`, Increment 1, pure) remain the
 * single choke point for that. The two route files
 * (`app/api/companion/observer/grants/route.ts` and
 * `.../grants/[capability]/route.ts`) are a thin spine-authenticated shell
 * around those pure functions; this file is the thin DB shell underneath
 * them, shared because Next.js's routing requires the capability-scoped
 * DELETE to live in a separate dynamic-segment file from the list/create
 * GET+POST route, and both need the identical row<->state mapping.
 *
 * PERSISTENCE-SHAPE DECISION (stated explicitly per the implementation
 * plan's own instruction): this module is written against a REAL Supabase
 * client call shape — `.from('companion_observer_grants')` — mirroring the
 * exact pattern `app/api/polity-passport/wallet/route.ts` already uses
 * (`getSupabaseServer()` + `.eq('persona_id', ...)`). The table itself does
 * NOT exist yet — see the illustrative, NOT-run migration sketch at
 * `supabase/migrations/_sketch_companion_observer_grants.sql.example`. No
 * migration has been run in this pass (no `node_modules`, no live Supabase
 * connection in this sandbox, and the plan is docs-only for this file per
 * its own scope). Choosing the real call shape over an in-memory stub means
 * these routes are correct and ready the moment a human runs the real,
 * timestamped migration — no follow-up rewrite of the route logic needed.
 *
 * T0 discipline: every read/write here is scoped by `persona_id` (T0,
 * server-internal only — never returned to a caller). The mapped
 * `ObserverCapabilityGrant` rows returned to callers carry no persona
 * identifier at all (per `types/companionObserver.ts`'s own tier-law
 * header) — the route layer is the ONLY place `personaId` is used, purely
 * to scope the query, and it is never echoed into a response body.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  ObserverCapability,
  ObserverCapabilityGrant,
  ObserverCapabilityScope,
} from '@/types/companionObserver';
import { emptyObserverGrantState } from '@/types/companionObserver';
import type { ObserverGrantState } from '@/types/companionObserver';

export const COMPANION_OBSERVER_GRANTS_TABLE = 'companion_observer_grants';

interface GrantRow {
  capability: string;
  scope: string;
  site_domain: string | null;
  granted_at: string;
  revoked_at: string | null;
}

/**
 * Load the full grant state (active + revoked, mirroring
 * `emptyObserverGrantState()`'s "every capability has an array" shape) for
 * one persona. A DB error or missing table is treated as "no grants yet"
 * (empty state) rather than thrown — matching `resolveCartridgeMemberships`'s
 * own fail-closed-to-empty precedent in `services/identity/getActivePersona.ts`,
 * since a transient read failure must never be mistaken for a granted
 * capability.
 */
export async function loadGrantState(
  admin: SupabaseClient,
  personaId: string,
): Promise<ObserverGrantState> {
  const state = emptyObserverGrantState();

  const { data, error } = await admin
    .from(COMPANION_OBSERVER_GRANTS_TABLE)
    .select('capability, scope, site_domain, granted_at, revoked_at')
    .eq('persona_id', personaId);

  if (error || !Array.isArray(data)) return state;

  for (const row of data as GrantRow[]) {
    const capability = row.capability as ObserverCapability;
    if (!(capability in state)) continue; // unknown capability value — ignore defensively
    const scope = row.scope as ObserverCapabilityScope;
    const grant: ObserverCapabilityGrant = {
      capability,
      scope,
      ...(scope === 'site' && row.site_domain ? { siteDomain: row.site_domain } : {}),
      grantedAt: row.granted_at,
      ...(row.revoked_at ? { revokedAt: row.revoked_at } : {}),
    };
    state[capability] = [...state[capability], grant];
  }

  return state;
}

/** Persist one newly-created grant row. Called only when
 *  `grantCapability` (Increment 1) actually produced a new entry — never
 *  called for the idempotent "already active" no-op case. */
export async function insertGrantRow(
  admin: SupabaseClient,
  personaId: string,
  grant: ObserverCapabilityGrant,
): Promise<{ error: string | null }> {
  const { error } = await admin.from(COMPANION_OBSERVER_GRANTS_TABLE).insert({
    persona_id: personaId,
    capability: grant.capability,
    scope: grant.scope,
    site_domain: grant.scope === 'site' ? grant.siteDomain ?? null : null,
    granted_at: grant.grantedAt,
  });
  return { error: error?.message ?? null };
}

/**
 * Mark the matching, currently-active row's `revoked_at`. NEVER deletes the
 * row — mirrors `revokeCapability`'s (Increment 1) own audit-preserving
 * semantics at the persistence layer.
 */
export async function markRowRevoked(
  admin: SupabaseClient,
  personaId: string,
  capability: ObserverCapability,
  scope: ObserverCapabilityScope,
  siteDomain: string | undefined,
  revokedAt: string,
): Promise<{ error: string | null }> {
  let query = admin
    .from(COMPANION_OBSERVER_GRANTS_TABLE)
    .update({ revoked_at: revokedAt })
    .eq('persona_id', personaId)
    .eq('capability', capability)
    .eq('scope', scope)
    .is('revoked_at', null);

  query = scope === 'site' ? query.eq('site_domain', siteDomain ?? '') : query.is('site_domain', null);

  const { error } = await query;
  return { error: error?.message ?? null };
}
