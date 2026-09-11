/**
 * Protected-file manifest — the single, structured extraction of CLAUDE.md's
 * "Files you MUST NOT modify without operator approval" lists (Phase F
 * bounded-execution repair, operator-directed 2026-08-16).
 *
 * CLAUDE.md remains the governed, human-authored source of truth — this
 * module is a VERBATIM transcription of its two protected-file enumerations
 * (Identity & Access Spine section; DVN Pipeline Protection section), so an
 * Implementation Pack can carry `forbiddenFiles` WITHOUT an implementation
 * actor re-reading 1,778 lines of prose to reconstruct the same boundary.
 *
 * inv.engineering.036/037 (one authoritative location, never a parallel one)
 * applies here in the only way it CAN across a prose document and a data
 * structure: this list must be updated in the SAME change that updates either
 * CLAUDE.md section it mirrors. It is not a second policy — it is the first
 * policy's own list, made machine-readable.
 *
 * Never edit a protected file listed here without the same operator approval
 * CLAUDE.md itself requires — this module enforces the boundary; it does not
 * relax it.
 */

/**
 * Verbatim from CLAUDE.md § "Identity & Access Spine — CANONICAL SoT" →
 * "Files you MUST NOT modify without operator approval".
 */
const IDENTITY_SPINE_PROTECTED_FILES = [
  'services/identity/getActivePersona.ts',
  'services/identity/personaSessionToken.ts',
  'services/access/evaluateAccess.ts',
  'services/access/policyResolvers.ts',
  'services/content/getContentDescriptor.ts',
  'services/content/encryption.ts',
  'services/content/stateCDelivery.ts',
  'types/access.ts',
] as const;

/**
 * Verbatim from CLAUDE.md § "DVN Pipeline Protection — CRITICAL
 * INFRASTRUCTURE" → "Files you MUST NOT modify without explicit operator
 * approval".
 */
const DVN_PIPELINE_PROTECTED_FILES = [
  'services/dvn/activityReceiptDvnPipeline.ts',
  'services/ops/icAgent.ts',
  'services/ops/idl/cross_chain_service.ts',
] as const;

/** The full protected-file manifest — every path an ordinary Implementation
 *  Pack's `forbiddenFiles` must include by default. */
export const PROTECTED_FILE_PATTERNS: readonly string[] = [
  ...IDENTITY_SPINE_PROTECTED_FILES,
  ...DVN_PIPELINE_PROTECTED_FILES,
];

export function isProtectedFile(path: string): boolean {
  return PROTECTED_FILE_PATTERNS.includes(path);
}

/**
 * The `forbiddenFiles` an Implementation Pack ships with. Defaults to the
 * FULL protected manifest — maximally protective. `authorizedProtectedFiles`
 * narrows it only when an operator has explicitly approved touching a
 * specific protected file for THIS pack (set at pack-generation time, never
 * inferred, never settable by the implementation actor itself).
 */
export function deriveForbiddenFiles(authorizedProtectedFiles: readonly string[] = []): string[] {
  return PROTECTED_FILE_PATTERNS.filter((p) => !authorizedProtectedFiles.includes(p));
}
