/**
 * metaMe Companion — Observer consent state machine (PRD-MMC-001 §4, Phase 2;
 * PRD-MMC-IMPL-001 Increment 1, RATIFIED 2026-07-23).
 *
 * Pure functions over `ObserverGrantState` (`types/companionObserver.ts`) —
 * NO I/O, NO Supabase client, NO React, NO fetch. This is the single choke
 * point every grant/revoke/check operation runs through; the API routes
 * (Increment 2) are a thin spine-authenticated persistence shell AROUND
 * these functions, never a re-implementation of the state machine inline.
 *
 * Style precedent: `services/invariants/resolution.ts`'s own calibration
 * helpers (`calibrateStructural`, `calibrateOperational`) are pure,
 * node-drillable functions with no I/O — this module follows that same
 * shape, reused as a design pattern (not as code).
 */

import type {
  ObserverCapability,
  ObserverCapabilityGrant,
  ObserverCapabilityScope,
  ObserverGrantState,
} from '@/types/companionObserver';
import { SCOPE_SUPPORT } from '@/types/companionObserver';

/** True iff `scope` is one this `capability` actually supports (PRD §4.1's
 *  scope column, enforced via `SCOPE_SUPPORT` — never left to convention). */
export function scopeIsSupported(
  capability: ObserverCapability,
  scope: ObserverCapabilityScope,
): boolean {
  return SCOPE_SUPPORT[capability].includes(scope);
}

function matches(
  grant: ObserverCapabilityGrant,
  scope: ObserverCapabilityScope,
  siteDomain?: string,
): boolean {
  if (grant.scope !== scope) return false;
  if (scope === 'site') return grant.siteDomain === siteDomain;
  return true;
}

/**
 * Grant a capability. IDEMPOTENT: granting an already-granted, unrevoked
 * capability+scope(+site) returns the state unchanged (same input, same
 * result, no duplicate grant row) — mirroring the T2-safe-commitment
 * idempotency discipline CLAUDE.md's HMS section establishes for a
 * different identifier class, applied here to consent grants.
 *
 * Callers MUST check `scopeIsSupported` themselves before calling this (the
 * API route layer, Increment 2, returns 400 rather than silently coercing an
 * unsupported scope) — this function does not re-validate scope support, so
 * it stays a pure, unconditional state transition.
 */
export function grantCapability(
  state: ObserverGrantState,
  capability: ObserverCapability,
  scope: ObserverCapabilityScope,
  siteDomain?: string,
  grantedAt: string = new Date().toISOString(),
): ObserverGrantState {
  const existing = state[capability];
  const alreadyActive = existing.some(
    (g) => !g.revokedAt && matches(g, scope, siteDomain),
  );
  if (alreadyActive) return state;

  const grant: ObserverCapabilityGrant = {
    capability,
    scope,
    ...(scope === 'site' ? { siteDomain } : {}),
    grantedAt,
  };

  return {
    ...state,
    [capability]: [...existing, grant],
  };
}

/**
 * Revoke a capability. Marks the matching, currently-active grant's
 * `revokedAt` — NEVER deletes the row, preserving an audit trail (mirroring
 * the DVN pipeline's own "never silently drop, always record state"
 * discipline). A no-op (state returned unchanged) if no matching active
 * grant exists.
 */
export function revokeCapability(
  state: ObserverGrantState,
  capability: ObserverCapability,
  scope: ObserverCapabilityScope,
  siteDomain?: string,
  revokedAt: string = new Date().toISOString(),
): ObserverGrantState {
  const existing = state[capability];
  let changed = false;
  const next = existing.map((g) => {
    if (!g.revokedAt && matches(g, scope, siteDomain)) {
      changed = true;
      return { ...g, revokedAt };
    }
    return g;
  });
  if (!changed) return state;

  return {
    ...state,
    [capability]: next,
  };
}

/**
 * True only for a grant whose `revokedAt` is unset AND whose scope matches.
 * A `'site'`-scoped grant for `example.com` does NOT grant `other.com` — a
 * caller checking a specific site must pass `siteDomain`; a caller checking
 * whether ANY active grant exists for a global-only capability omits it.
 */
export function isCapabilityGranted(
  state: ObserverGrantState,
  capability: ObserverCapability,
  siteDomain?: string,
): boolean {
  const grants = state[capability];
  return grants.some((g) => {
    if (g.revokedAt) return false;
    if (g.scope === 'global') return true;
    return g.siteDomain === siteDomain;
  });
}

/** Every currently-active (unrevoked) grant across all capabilities. */
export function listActiveGrants(state: ObserverGrantState): ObserverCapabilityGrant[] {
  const out: ObserverCapabilityGrant[] = [];
  for (const grants of Object.values(state)) {
    for (const g of grants) {
      if (!g.revokedAt) out.push(g);
    }
  }
  return out;
}
