/**
 * journeyReEvaluationTrigger — the re-evaluation trigger contract
 * (AEE-XP-001 §6 requirement 6), split out of journeyAeeOrchestrator.ts
 * (2026-09-01 incident fix) so it stays importable from CLIENT components.
 *
 * `journeyAeeOrchestrator.ts`'s `computeJourneyAeeOutcome` transitively
 * imports `journeySpineAdapter.ts` and `nativeProvider.ts`, both of which
 * import Node's `crypto` module. `JourneyRunSurface.tsx` (a `'use client'`
 * component) only ever needed this trigger contract — but importing it from
 * the orchestrator file meant webpack's client bundler had to statically
 * resolve the ENTIRE module graph, including `crypto`, the moment the
 * component imported anything from that file. Zero dependencies here,
 * deliberately — this file must never gain an import that isn't equally
 * client-safe.
 *
 * Deliberately not a new observation database: any of these facts changing
 * invalidates a previously-computed `JourneyAeeOutcome`; the correct
 * response is simply to call `computeJourneyAeeOutcome` again with fresh
 * inputs — there is no cached projection to invalidate in-place, since
 * nothing here holds state of its own. Consequential OBSERVATION (recording
 * that a trigger fired, for copilot narration) remains DCIR-owned
 * (services/dcir/*) — this type only names what a DCIR-observed change
 * should cause a caller to do.
 */
export type JourneyReEvaluationTrigger =
  | 'journey-state-change'
  | 'branch-intent-change'
  | 'stage-satisfaction-evidence-change'
  | 'exqube-experience-evidence-change'
  | 'authority-standing-change';

/** Every trigger in the contract warrants recomputation — no trigger is
 *  ever debounced/ignored here. Named as a function (not a boolean
 *  constant) so a future trigger-specific policy has one call site to
 *  extend, without callers needing to know the current answer is trivial. */
export function shouldReEvaluateAeeProjection(_trigger: JourneyReEvaluationTrigger): boolean {
  return true;
}
