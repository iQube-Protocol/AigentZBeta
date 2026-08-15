/**
 * Context binding — the first internal Crystal 2.0 implementation
 * assignment. Homecoming III Phase 6 live dogfood.
 *
 * ── What this is, and is not ────────────────────────────────────────────────
 *
 * A CONTRACT STUB ONLY (the same "contract-first, façade-not-fork" pattern
 * `types/dcir.ts`, `types/invariantEnvelope.ts` and `types/devLoopLearning.ts`
 * already establish). It is NOT an enforcement runtime, NOT wired into
 * `DevLoopState` or any live surface, and NOT a persistence mechanism. It
 * exists so a future assignment has a named, reviewable place to attach
 * authorized context binding, per the design requirement recorded in
 * `RES-2026-08-15-SCOPE-CONTEXT-BINDING-AXIS-001` /
 * `CI-2026-08-15-SCOPE-CONTEXT-BINDING-AXIS-001`
 * (`codexes/packs/agentiq/updates/2026-08-15_scope-context-binding-axis-ruling.md`).
 *
 * ── Scope ≠ context binding (read this before extending either) ────────────
 *
 * `InvariantScope` (`types/invariantEnvelope.ts`) answers WHERE a causal
 * proposition applies. `ContextBindingLevel` below answers WHICH authorized
 * person's, developer's, or project's state is relevant to the present
 * resolution. These are orthogonal axes by explicit operator ruling — this
 * file imports NOTHING from `types/invariantEnvelope.ts` and must never be
 * merged with `InvariantScope`, however similar the two ladders look.
 *
 * ── T0/T2 discipline (unconditional) ────────────────────────────────────────
 *
 * No field here may hold a raw `personaId`, `authProfileId`, `rootDid`,
 * `fioHandle`, or `kybeAttestation` value — the same `DEV_LOOP_FORBIDDEN_STATE_KEYS`
 * guard `types/devLoopLearning.ts` already applies to `DevLoopState`. A future
 * enforcement layer must bind context using opaque references or T2-safe
 * derived context, never raw identity material.
 *
 * ── Not yet adopted ──────────────────────────────────────────────────────────
 *
 * Nothing in this codebase imports this module outside its own test. Its
 * existence is not its adoption — wiring it into a live surface is a
 * separate, later, reviewed decision.
 */

// ---------------------------------------------------------------------------
// Schema version — repo convention: <kebab-domain-slug>/v<major>.<minor>
// ---------------------------------------------------------------------------

export const CONTEXT_BINDING_SCHEMA_VERSION = 'context-binding/v1.0' as const;

// ---------------------------------------------------------------------------
// The axis — pinned, ordered, six rungs. A canary asserts this exact order.
// ---------------------------------------------------------------------------

export const CONTEXT_BINDING_LEVELS = [
  'platform',
  'workspace',
  'project',
  'developer',
  'principal-user',
  'session-intent',
] as const;

export type ContextBindingLevel = (typeof CONTEXT_BINDING_LEVELS)[number];

/** Runtime guard for untyped values — mirrors `isDevLoopStage` (`devLoop.ts`). */
export function isContextBindingLevel(value: unknown): value is ContextBindingLevel {
  return typeof value === 'string' && (CONTEXT_BINDING_LEVELS as readonly string[]).includes(value);
}
