/**
 * canManageRegistry — the SINGLE, swappable admin gate for the Experiment /
 * Constitutional / Invariant Registry (CFS-051, Strand 1 build 2026-07-24).
 *
 * Operator framing: "admin gated but stubbed for opening up to cohorts or
 * token gated access to enable public users to propose experiment or
 * constitutional principles." Today this returns platform-admin only. The
 * follow-on that widens eligibility to a CAS `research-lab` access grant
 * (services/passport/participationAccess.ts — the SAME mechanism CFS-044's
 * Open Lab reviewer engagement already composes) or a token-gate touches
 * ONLY this function — never the CRUD service (registryStore.ts) or the API
 * route's action dispatch. Mirrors the swappable-gate pattern already
 * requested for HMS/mobility work elsewhere in this codebase.
 */

export interface RegistryCallerPersona {
  cartridgeFlags?: { isAdmin?: boolean } | null;
}

/** Today: platform admin only. Extend here (not at call sites) when cohort/
 *  token-gated access ships — e.g. OR a `research-lab` access grant via
 *  `getGrantedExperiments`/`listAccessGrants` (services/passport/participationAccess.ts). */
export function canManageRegistry(persona: RegistryCallerPersona | null | undefined): boolean {
  return Boolean(persona?.cartridgeFlags?.isAdmin);
}
