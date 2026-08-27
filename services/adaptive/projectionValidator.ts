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
 * Checks 6-7 (operator ruling, 2026-08-27, Differ FS pilot reconciliation):
 * enforce `CapabilityProjectionRef.disposition` — the three independent
 * permissions (externalRenderAllowed / externalExecuteAllowed /
 * nativeHandoffAllowed). Correcting the earlier "NATIVE_ONLY = never
 * offerable" conflation: a NATIVE_ONLY capability (render:false,
 * execute:false) may still be legitimately offered — but ONLY as a
 * `handoffOffered: true` entry, and ONLY when its own disposition explicitly
 * permits `nativeHandoffAllowed`. A capability's disposition is looked up
 * once per validation via `capabilityDisposition` and defaults to the most
 * restrictive shape (nothing allowed) when a referenced capability carries no
 * disposition at all — fail closed, never silently permissive, mirroring
 * `tierForCheck`'s "unregistered gates" discipline elsewhere in this repo.
 *
 * Checks NOT implemented in this pass (named honestly, not silently
 * skipped): disclosure-policy field-level redaction verification and
 * host-renderer surface-support negotiation — both require a real second
 * provider (Differ) to be meaningful to test against, and none exists yet
 * (Phase 0 audit). Revisit when Phase B begins.
 */

import type {
  AdaptiveCapabilityDisposition,
  AdaptiveInteractionContext,
  CapabilityProjectionRef,
  ExperienceProjection,
  ProjectionActionRef,
  ProjectionValidationResult,
} from '@/types/adaptiveExperience';

const NOTHING_ALLOWED: AdaptiveCapabilityDisposition = {
  externalRenderAllowed: false,
  externalExecuteAllowed: false,
  nativeHandoffAllowed: false,
};

function capabilityDisposition(
  capabilityId: string,
  byId: Map<string, CapabilityProjectionRef>,
): AdaptiveCapabilityDisposition {
  return byId.get(capabilityId)?.disposition ?? NOTHING_ALLOWED;
}

export function validateProjection(
  projection: ExperienceProjection,
  context: AdaptiveInteractionContext,
): ProjectionValidationResult {
  const violations: string[] = [];

  const capabilitiesById = new Map(context.capabilityRefs.map((c) => [c.capabilityId, c] as const));
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

  // Checks 6-7 apply only to a projection an EXTERNAL provider produced.
  // `disposition.externalRenderAllowed`/`externalExecuteAllowed` govern
  // crossing the provider boundary — the native provider crosses no
  // boundary at all (the platform itself IS the host for `provider:
  // 'native'`), so gating it here would risk rejecting the deterministic
  // fallback SPEC-AEE-001 §16 requires to ALWAYS succeed. A native
  // projection selecting a NATIVE_ONLY capability is native custody by
  // construction, not an external-render violation.
  const isExternalProviderOutput = projection.provider !== 'native';

  // Check 6 — a capability whose disposition forbids external render must
  // not appear as a directly rendered surface. Offering it via a NATIVE
  // HANDOFF is explicitly fine (that is the mechanism's entire purpose) —
  // but ONLY when the surface is marked `handoffOffered: true` AND the
  // capability's own disposition permits `nativeHandoffAllowed`.
  if (isExternalProviderOutput) {
    for (const surface of projection.surfaces) {
      const disposition = capabilityDisposition(surface.capabilityId, capabilitiesById);
      if (disposition.externalRenderAllowed) continue;
      if (surface.handoffOffered && disposition.nativeHandoffAllowed) continue;
      violations.push(
        `surface "${surface.capabilityId}" has externalRenderAllowed: false and is not a permitted ` +
          `nativeHandoffAllowed handoff offer (handoffOffered: ${Boolean(surface.handoffOffered)}, ` +
          `nativeHandoffAllowed: ${disposition.nativeHandoffAllowed}) — it must not render externally.`,
      );
    }
  }

  // Check 7 — same rule for primaryAction/secondaryActions, using
  // externalExecuteAllowed (offering an action IS offering it as directly
  // actionable, which is the "execute" side of the disposition, distinct
  // from merely rendering a surface).
  const checkAction = (action: ProjectionActionRef | undefined, label: string) => {
    if (!isExternalProviderOutput || !action) return;
    const disposition = capabilityDisposition(action.capabilityId, capabilitiesById);
    if (disposition.externalExecuteAllowed) return;
    if (action.handoffOffered && disposition.nativeHandoffAllowed) return;
    violations.push(
      `${label} "${action.capabilityId}" has externalExecuteAllowed: false and is not a permitted ` +
        `nativeHandoffAllowed handoff offer (handoffOffered: ${Boolean(action.handoffOffered)}, ` +
        `nativeHandoffAllowed: ${disposition.nativeHandoffAllowed}) — it must not be offered as directly actionable.`,
    );
  };
  checkAction(projection.primaryAction, 'primaryAction');
  for (const action of projection.secondaryActions ?? []) checkAction(action, 'secondaryAction');

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
