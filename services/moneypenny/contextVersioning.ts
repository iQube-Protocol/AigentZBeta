/**
 * SC-04 — task/context versioning for the MoneyPenny copilot-to-capsule
 * loop (Cartridge spec: "Both panes consume the same versioned task
 * context and correlated outcomes. Late responses cannot overwrite a
 * different task, agent, or environment.").
 *
 * A copilot response is STALE when the context that produced it — the
 * `groundContext` captured at request-dispatch via
 * `SmartTriadCopilotLayer`'s existing groundContext-at-POST-time mechanism
 * (`components/smarttriad/copilot/SmartTriadCopilotLayer.tsx`'s
 * `currentGroundContext`, echoed back through the additive `onRequestContext`
 * callback) — no longer matches the context that is CURRENT when the
 * response arrives. Three axes compose the version, matching the three
 * required test scenarios: the active panel (task), the financial-profile
 * revision (content within a task can go stale without the panel changing),
 * and the execution environment (simulation vs. live — C-11/C-12 have not
 * shipped a UI toggle yet, so `environment` is real state with a fixed
 * 'simulation' default in this slice, kept ready for that future work
 * rather than hardcoded away).
 *
 * This is pure, dependency-free logic so it is directly unit-testable
 * without mounting React or mocking fetch — see
 * tests/moneypenny-context-versioning.test.ts.
 */

export type MoneyPennyEnvironment = 'simulation' | 'live';

export interface MoneyPennyContextVersion {
  /** The active MoneyPennyPanelKey — proxy for "task" (Cartridge spec SC-04). */
  panel: string;
  /** The active persona — proxy for "agent." Undefined before persona resolution completes. */
  personaId: string | undefined;
  /** Execution environment — proxy for "environment." */
  environment: MoneyPennyEnvironment;
  /**
   * Monotonic counter bumped each time the financial-profile ground
   * snapshot is successfully refetched with new data. A profile revision
   * invalidates an in-flight request's response even when panel/persona/
   * environment are unchanged, since the response may have reasoned over
   * the now-superseded profile snapshot.
   */
  profileRevision: number;
}

/** Deterministic version key — same inputs always produce the same key. */
export function computeContextVersionKey(version: MoneyPennyContextVersion): string {
  return `${version.panel}::${version.personaId ?? ''}::${version.environment}::${version.profileRevision}`;
}

/**
 * A response is stale iff the context version embedded in the request that
 * produced it does not match the context that is current NOW.
 * `sentVersionKey` is `null` when no version was captured for the in-flight
 * request (e.g. `onRequestContext` never fired, or `groundContext` carried
 * no `contextVersion`) — treated as stale, fail-closed: an unattributable
 * response is never assumed current.
 */
export function isResponseContextStale(sentVersionKey: string | null, currentVersionKey: string): boolean {
  return sentVersionKey !== currentVersionKey;
}
