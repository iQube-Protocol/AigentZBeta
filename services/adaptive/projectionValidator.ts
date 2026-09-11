/**
 * Adaptive Experience Engine — postflight projection validator
 * (SPEC-AEE-001 Part VIII §17).
 *
 * Every provider output passes this validator before projection/rendering.
 * A rejected projection falls back to native (SPEC-AEE-001 §16) — see
 * services/adaptive/adaptiveExperienceEngine.ts. This module is pure: no
 * I/O, no network, so it can run identically for native and any future
 * verified Differ output.
 *
 * Checks implemented, matching SPEC-AEE-001 §17 exactly:
 *   1. every capability/action reference exists (in the context's own
 *      capabilityRefs — the provider cannot reference a capability the
 *      context never declared);
 *   2. no blocked/unauthorized action is presented as executable
 *      (a capability whose id is in the journey's blockedStageIds must not
 *      be surfaced with emphasis 'primary' or 'secondary' — only
 *      'suppressed' or absent);
 *   3. mandatory journey states are not omitted in a way that falsely
 *      implies completion (a sensitive/required capability must not be
 *      silently dropped from surfaces while claiming journeyRef completion);
 *   4. principal-only acts are not delegated by presentation (a capability
 *      marked actor: 'principal' must not carry a companionCue whose intent
 *      is a sovereign act — structurally impossible per CompanionCue's own
 *      type, checked here defensively anyway);
 *   5. projection schema is structurally valid (level/layout/surfaces present).
 *
 * Checks NOT implemented in this pass (named honestly, not silently
 * skipped): disclosure-policy field-level redaction verification and
 * host-renderer surface-support negotiation — both require a real second
 * provider (Differ) to be meaningful to test against, and none exists yet
 * (Phase 0 audit). Revisit when Phase B begins.
 */

import type {
  AdaptiveInteractionContext,
  ExperienceProjection,
  ProjectionValidationResult,
} from '@/types/adaptiveExperience';

export function validateProjection(
  projection: ExperienceProjection,
  context: AdaptiveInteractionContext,
): ProjectionValidationResult {
  const violations: string[] = [];

  const knownCapabilityIds = new Set(context.capabilityRefs.map((c) => c.capabilityId));
  const blockedIds = new Set(context.journey?.blockedStageIds ?? []);
  const sensitiveIds = new Set(
    context.capabilityRefs.filter((c) => c.sensitive).map((c) => c.capabilityId),
  );

  // Check 1 — every capability/action reference exists.
  for (const surface of projection.surfaces) {
    if (!knownCapabilityIds.has(surface.capabilityId)) {
      violations.push(
        `surface references unknown capabilityId "${surface.capabilityId}" not present in context.capabilityRefs`,
      );
    }
  }
  if (projection.primaryAction && !knownCapabilityIds.has(projection.primaryAction.capabilityId)) {
    violations.push(
      `primaryAction references unknown capabilityId "${projection.primaryAction.capabilityId}"`,
    );
  }
  for (const action of projection.secondaryActions ?? []) {
    if (!knownCapabilityIds.has(action.capabilityId)) {
      violations.push(`secondaryAction references unknown capabilityId "${action.capabilityId}"`);
    }
  }

  // Check 2 — no blocked action presented as executable (primary/secondary).
  for (const surface of projection.surfaces) {
    if (blockedIds.has(surface.capabilityId) && surface.emphasis !== 'suppressed') {
      violations.push(
        `capability "${surface.capabilityId}" is BLOCKED in journey state but surfaced with emphasis "${surface.emphasis}" instead of "suppressed"`,
      );
    }
  }
  if (projection.primaryAction && blockedIds.has(projection.primaryAction.capabilityId)) {
    violations.push(
      `primaryAction "${projection.primaryAction.capabilityId}" is BLOCKED in journey state and must not be primary`,
    );
  }

  // Check 3 — sensitive capabilities must not be silently dropped while the
  // projection implies the journey/target is otherwise fully handled. We
  // check this narrowly: a sensitive capability that is READY (not blocked,
  // not future) must appear SOMEWHERE in surfaces if any surface is emitted
  // at all — never silently vanish from a non-empty projection.
  if (projection.surfaces.length > 0) {
    const readyIds = new Set(context.journey?.readyStageIds ?? []);
    const surfacedIds = new Set(projection.surfaces.map((s) => s.capabilityId));
    for (const id of sensitiveIds) {
      if (readyIds.has(id) && !surfacedIds.has(id)) {
        violations.push(
          `sensitive capability "${id}" is READY but omitted from a non-empty projection — this could falsely imply completion`,
        );
      }
    }
  }

  // Check 4 — principal-only acts are not delegated by presentation.
  // CompanionCue's type has no sovereign-act intent variant, so this can
  // only fail if a future edit widens that union — checked defensively.
  const SOVEREIGN_INTENTS = new Set(['REQUEST_SOVEREIGN_ACTION', 'AUTHORIZE', 'SIGN', 'EXECUTE']);
  if (projection.companionCue && SOVEREIGN_INTENTS.has(projection.companionCue.intent)) {
    violations.push(
      `companionCue intent "${projection.companionCue.intent}" would delegate a sovereign act by presentation — not permitted`,
    );
  }

  // Check 5 — projection schema is structurally valid.
  if (![0, 1, 2, 3].includes(projection.level)) {
    violations.push(`projection.level "${projection.level}" is not a valid ProjectionLevel`);
  }
  if (!projection.layout || !projection.layout.mode || !projection.layout.density) {
    violations.push('projection.layout is missing mode or density');
  }
  if (!Array.isArray(projection.surfaces)) {
    violations.push('projection.surfaces is not an array');
  }
  if (projection.contextId !== context.contextId) {
    violations.push(
      `projection.contextId "${projection.contextId}" does not match the requesting context "${context.contextId}"`,
    );
  }

  return { valid: violations.length === 0, violations };
}
