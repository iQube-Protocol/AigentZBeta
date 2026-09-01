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

/**
 * Server-safe (no `window` access) — parses the `?activatedBranches=`
 * query param a state route reads (`branch:intent,branch2:intent2`) into
 * the `Record<branch, intent>` shape `resolveJourneyState` accepts
 * (types/journey.ts's `JourneyRuntimeState.activatedBranches`, XP-1
 * AEE-XP-001 §6). This is how a real client gesture — declared via
 * `activateJourneyBranch` above — reaches the server honestly: relayed by
 * the client that already holds it, never re-derived or guessed
 * server-side.
 */
export function parseActivatedBranchesParam(raw: string | null | undefined): Record<string, string> | undefined {
  if (!raw) return undefined;
  const result: Record<string, string> = {};
  for (const pair of raw.split(',')) {
    const [branch, intent] = pair.split(':');
    if (branch?.trim() && intent?.trim()) result[branch.trim()] = intent.trim();
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Client-only — the inverse of `parseActivatedBranchesParam`: serializes
 * every branch this journey declares that is CURRENTLY activated (per
 * sessionStorage) into the query-param string a state-route fetch should
 * append. Empty string when nothing is activated — callers should omit the
 * param entirely rather than send `?activatedBranches=`.
 */
export function serializeActivatedBranchesForJourney(journey: {
  id: string;
  stages: Array<{ activationBranch?: string }>;
}): string {
  const branches = new Set(
    journey.stages.map((s) => s.activationBranch).filter((b): b is string => Boolean(b)),
  );
  const pairs: string[] = [];
  for (const branch of branches) {
    if (!isJourneyBranchActivated(journey.id, branch)) continue;
    const intent = getJourneyBranchIntent(journey.id, branch);
    if (intent) pairs.push(`${branch}:${intent}`);
  }
  return pairs.join(',');
}
