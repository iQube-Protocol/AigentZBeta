/**
 * journeyBranchActivation — declares/reads whether a dormant journey branch
 * (`JourneyStageDefinition.activationBranch`, types/journey.ts) has been
 * entered for the current visit, and which intent triggered it (AEE-XP-001
 * §4, Main Spine correction, 2026-09-01).
 *
 * `sessionStorage`, not a server round-trip: this is a UX-reactivity/reveal
 * decision (CLAUDE.md "State Management Boundaries" — localStorage/
 * sessionStorage for UX reactivity only), never a constitutional gate. The
 * branch's stages still enforce their own real prerequisites/completion
 * evidence via `resolveJourneyState`, completely independent of this module;
 * a person who deep-links directly to a branch stage id is never blocked —
 * only the ambient stepper listing (and which entry stage a trigger CTA
 * lands on) is decided here. Same per-visit persistence class already used
 * by `experienceHandoffService.ts`'s own agent-candidate sessionStorage key
 * in `FinancialSovereigntyPrepareCrossStage.tsx` — not a new pattern.
 */

const BRANCH_ACTIVATED_KEY_PREFIX = 'journeyBranchActivated:';
const BRANCH_INTENT_KEY_PREFIX = 'journeyBranchIntent:';

function branchActivatedKey(journeyId: string, branch: string): string {
  return `${BRANCH_ACTIVATED_KEY_PREFIX}${journeyId}:${branch}`;
}

function branchIntentKey(journeyId: string, branch: string): string {
  return `${BRANCH_INTENT_KEY_PREFIX}${journeyId}:${branch}`;
}

/**
 * Declares a branch entered, records which intent triggered it, and selects
 * the branch's entry stage — the "Apply to join Financial Services" style
 * affordance's one call. Non-fatal if `sessionStorage`/`window` are
 * unavailable (SSR, storage disabled): the stage selection still fires.
 */
export function activateJourneyBranch(
  journeyId: string,
  branch: string,
  intent: string,
  entryStageId: string,
): void {
  try {
    window.sessionStorage.setItem(branchActivatedKey(journeyId, branch), '1');
    window.sessionStorage.setItem(branchIntentKey(journeyId, branch), intent);
  } catch {
    /* non-fatal — the branch simply won't persist across a reload this visit */
  }
  try {
    window.dispatchEvent(new CustomEvent('journey:select-stage', { detail: { stageId: entryStageId } }));
  } catch {
    /* non-fatal */
  }
}

/** Whether `branch` has been declared entered for `journeyId` this visit. */
export function isJourneyBranchActivated(journeyId: string, branch: string): boolean {
  try {
    return window.sessionStorage.getItem(branchActivatedKey(journeyId, branch)) === '1';
  } catch {
    return false;
  }
}

/** The intent that activated `branch` for `journeyId`, or `null` if none/unavailable. */
export function getJourneyBranchIntent(journeyId: string, branch: string): string | null {
  try {
    return window.sessionStorage.getItem(branchIntentKey(journeyId, branch));
  } catch {
    return null;
  }
}
