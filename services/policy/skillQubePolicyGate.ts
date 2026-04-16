/**
 * SkillQube Policy Gate — Venture Lab α
 *
 * Curated internal skill evaluation: gates SkillQube invocation access
 * to pre-vetted alpha skills only.
 *
 * Alpha posture (per 09-metame-template-spec.md):
 *   - Minimum trust band: L1_EXPERIMENTAL
 *   - Allowed policy classes: read_only, sandbox_exec, network_limited
 *   - Publication status must be 'published'
 *   - Optional cartridge overlay: skill must match caller's required cartridge
 *
 * Follows the same evaluation pattern as qubetalkPolicyGate.ts.
 */

import { TrustBand, PolicyClass, TRUST_BAND_ORDER } from "@/types/registryIngestion";

// ─── Alpha policy constants ───────────────────────────────────────────────────

/** Minimum trust band for alpha SkillQube invocation (inclusive). */
export const ALPHA_MIN_TRUST_BAND: TrustBand = "L1_EXPERIMENTAL";

/** Policy classes permitted in alpha. Secret-bound and browser/approval-gated
 *  skills are blocked until DVN finalisation infrastructure is in place. */
export const ALPHA_ALLOWED_POLICY_CLASSES: PolicyClass[] = [
  "read_only",
  "sandbox_exec",
  "network_limited",
];

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SkillQubePolicyContext {
  /** The asset_id of the SkillQube being evaluated. */
  skillId: string;
  /** trust_band from the SkillQube record (e.g. 'L1_EXPERIMENTAL'). */
  trustBand?: string;
  /** policy_class from the SkillQube record (e.g. 'read_only'). */
  policyClass?: string;
  /** publication_status from the SkillQube record. */
  publicationStatus?: string;
  /** metadata.cartridge value from the SkillQube record, if set. */
  cartridgeId?: string;
  /** Caller's required cartridge overlay — if provided, skill must belong to it. */
  requiredCartridge?: string;
  /** Invoking persona ID (for future persona-level policy). */
  personaId?: string;
  /** Tenant ID (for future tenant-level policy). */
  tenantId?: string;
}

export interface SkillQubePolicyEvaluation {
  /** True if the skill may be invoked under current alpha policy. */
  allowed: boolean;
  /** Human-readable reasons for any failed checks. Empty if allowed. */
  reasons: string[];
  publicationCheck: {
    required: "published";
    actual: string | undefined;
    met: boolean;
  };
  trustBandCheck: {
    minimum: TrustBand;
    actual: string | undefined;
    met: boolean;
  };
  policyClassCheck: {
    allowedClasses: PolicyClass[];
    actual: string | undefined;
    met: boolean;
  };
  cartridgeCheck: {
    required: string | undefined;
    actual: string | undefined;
    met: boolean;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function trustBandIndex(band: string | undefined): number {
  if (!band) return -1;
  return TRUST_BAND_ORDER.indexOf(band as TrustBand);
}

// ─── Evaluator ───────────────────────────────────────────────────────────────

/**
 * Evaluate whether a SkillQube invocation is permitted under alpha policy.
 *
 * @example
 * const result = evaluateSkillQubePolicy({
 *   skillId: asset.assetId,
 *   trustBand: asset.trustBand,
 *   policyClass: asset.policyClass,
 *   publicationStatus: asset.publicationStatus,
 *   cartridgeId: asset.metadata?.cartridge as string,
 * });
 * if (!result.allowed) throw new Error(result.reasons.join("; "));
 */
export function evaluateSkillQubePolicy(
  context: SkillQubePolicyContext
): SkillQubePolicyEvaluation {
  const reasons: string[] = [];

  // ── 1. Publication check ─────────────────────────────────────────────────
  const pubMet = context.publicationStatus === "published";
  if (!pubMet) {
    reasons.push(
      `Skill '${context.skillId}' is not published (status: ${context.publicationStatus ?? "unknown"})`
    );
  }

  // ── 2. Trust band check ──────────────────────────────────────────────────
  const minIdx = trustBandIndex(ALPHA_MIN_TRUST_BAND);
  const actualIdx = trustBandIndex(context.trustBand);
  const trustMet = actualIdx >= minIdx;
  if (!trustMet) {
    reasons.push(
      `Trust band '${context.trustBand ?? "none"}' is below alpha minimum '${ALPHA_MIN_TRUST_BAND}'`
    );
  }

  // ── 3. Policy class check ────────────────────────────────────────────────
  // Absence of a policy class defaults to allowed (read_only is implicit).
  const policyMet =
    !context.policyClass ||
    (ALPHA_ALLOWED_POLICY_CLASSES as string[]).includes(context.policyClass);
  if (!policyMet) {
    reasons.push(
      `Policy class '${context.policyClass}' is not permitted in alpha ` +
      `(allowed: ${ALPHA_ALLOWED_POLICY_CLASSES.join(", ")})`
    );
  }

  // ── 4. Cartridge overlay check ───────────────────────────────────────────
  // Only enforced if caller specified a requiredCartridge AND the skill has
  // a cartridge ID in its metadata. If either is absent, the check passes.
  const cartridgeMet =
    !context.requiredCartridge ||
    !context.cartridgeId ||
    context.cartridgeId === context.requiredCartridge;
  if (!cartridgeMet) {
    reasons.push(
      `Skill cartridge '${context.cartridgeId}' does not match ` +
      `required cartridge '${context.requiredCartridge}'`
    );
  }

  return {
    allowed: pubMet && trustMet && policyMet && cartridgeMet,
    reasons,
    publicationCheck: {
      required: "published",
      actual: context.publicationStatus,
      met: pubMet,
    },
    trustBandCheck: {
      minimum: ALPHA_MIN_TRUST_BAND,
      actual: context.trustBand,
      met: trustMet,
    },
    policyClassCheck: {
      allowedClasses: ALPHA_ALLOWED_POLICY_CLASSES,
      actual: context.policyClass,
      met: policyMet,
    },
    cartridgeCheck: {
      required: context.requiredCartridge,
      actual: context.cartridgeId,
      met: cartridgeMet,
    },
  };
}
