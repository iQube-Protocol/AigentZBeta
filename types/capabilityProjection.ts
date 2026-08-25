/**
 * Shared surface-independent capability projection contract.
 *
 * Originally ratified for QubeTalk alone (2026-08-25 — see
 * types/qubetalk.ts's own header and
 * services/qubetalk/projection.ts). The ContactGraph fast-follow
 * generalizes the SAME seam rather than building a second projection
 * framework, per the operator's explicit instruction:
 *
 *   "Prefer: shared projection contract |- capability: qubetalk
 *    `- capability: contacts   over two unrelated projection frameworks."
 *
 * Every capability projection obeys the same formula:
 *   principal ∩ persona ∩ surface ∩ requested projection ∩ requested scope
 *   ∩ delegation ∩ disclosure policy = visible/invocable capability
 *
 * `types/qubetalk.ts` re-exports `QUBETALK_PROJECTION_PROFILES` as an alias
 * of `CAPABILITY_PROJECTION_PROFILES` (same values, unchanged shape) so
 * existing QubeTalk callers are unaffected by this extraction.
 */

export const CAPABILITY_PROJECTION_PROFILES = ['full', 'ambient', 'contextual'] as const;
export type CapabilityProjectionProfile = (typeof CAPABILITY_PROJECTION_PROFILES)[number];

/** Fields common to every capability's projection request. A concrete
 *  capability (QubeTalkProjectionRequest, ContactGraphProjectionRequest)
 *  adds its own `capability` discriminant, `projection`, and `scope` shape
 *  on top of this. */
export interface CapabilityProjectionRequestBase {
  /** Which surface is asking (e.g. 'metame-runtime', 'companion',
   *  'cartridge:horizon') — recorded on the result for surface-continuity
   *  provenance, NEVER used to grant additional access (surface
   *  non-ownership: a surface's own identity carries no scope of its own). */
  requestingSurface: string;
  /** Present only when an Agent (not the principal directly) is the actual
   *  requester — every capability's projection implementation intersects
   *  the granted scope with that agent's resolved delegation policy. */
  actingAgentRootDid?: string | null;
}

/** Fields common to every capability's projection result. */
export interface CapabilityProjectionResultBase {
  profile: CapabilityProjectionProfile;
  requestingSurface: string;
}
