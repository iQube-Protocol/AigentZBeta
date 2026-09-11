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
 * response arrives.
 *
 * 2026-09-02 revision — a bare (panel, personaId, environment,
 * profileRevision) TUPLE, compared by value equality, has two real defects
 * a monotonic identifier is needed to close:
 *
 * 1. TWO TASKS ON THE SAME PANEL are indistinguishable by that tuple alone
 *    — if the operator asks two different questions without navigating
 *    away, both requests carry the identical tuple, so a late response to
 *    the FIRST question cannot be told apart from a fresh response to the
 *    SECOND.
 * 2. THE A -> B -> A PROBLEM — value-equality on a tuple that can revisit
 *    a prior state (leave panel A, visit B, return to A) makes an old,
 *    still-in-flight response from the FIRST visit to A look identical to
 *    the CURRENT state after returning to A, because the tuple's values
 *    repeat. A response must never become valid again just because the
 *    operator's context happens to cycle back to a value it already held.
 *
 * `generation` closes both: a single counter, monotonically incremented
 * by the host on every context-relevant event — a new request dispatch
 * (distinguishes same-panel tasks), a panel/persona/environment change, or
 * a profile revision (distinguishes A -> B -> A, since leaving and
 * returning to A each bump it, so the generation captured on the FIRST
 * visit can never equal the CURRENT generation after a round trip). Panel/
 * persona/environment/profileRevision are kept in the version too — not
 * for uniqueness (generation alone already guarantees that) but as
 * human-readable, independently-testable provenance for WHY a generation
 * changed.
 *
 * Pure, dependency-free logic — directly unit-testable without mounting
 * React or mocking fetch. See tests/moneypenny-context-versioning.test.ts.
 * The only import is the shared `MoneyPennyProviderMode` TYPE (erased at
 * runtime) — reused rather than duplicated, so the role selector's
 * Advisor/Architect/Runtime vocabulary can never drift from every other
 * MoneyPenny surface that already uses it (per-item mode badges in
 * moneypennyCapabilities.ts, the Architect/Runtime API routes).
 */

import type { MoneyPennyProviderMode } from '@/types/financialServices';

export type MoneyPennyEnvironment = 'simulation' | 'live';

export interface MoneyPennyContextVersion {
  /**
   * Monotonic counter — the actual source of uniqueness/staleness. Bumped
   * by the host on every request dispatch (task identity) and every
   * panel/persona/environment/role/profile-revision change (context
   * identity). Never decreases, never repeats a prior value.
   */
  generation: number;
  /** The active MoneyPennyPanelKey — proxy for "task" (Cartridge spec SC-04). Provenance only. */
  panel: string;
  /** The active persona — proxy for "agent." Provenance only. */
  personaId: string | undefined;
  /** Execution environment — proxy for "environment." Provenance only. */
  environment: MoneyPennyEnvironment;
  /**
   * The selected Advisor/Architect/Runtime role (experience-coherence
   * correction, 2026-09-03) — provenance only, same as every other field
   * here; `generation` alone guarantees uniqueness. A role change is a
   * context-relevant event (the operator directive: "Include role changes
   * in stale-response invalidation"), so the host bumps `generation` when
   * it changes, same discipline as panel/persona/environment.
   */
  role: MoneyPennyProviderMode;
  /** The financial-profile revision counter at the moment this version was computed. Provenance only. */
  profileRevision: number;
}

/**
 * Deterministic version key. `generation` leads the key — since it is
 * monotonic and host-managed, two DIFFERENT MoneyPennyContextVersion
 * instances are guaranteed to produce different keys whenever anything
 * meaningfully changed, even if panel/personaId/environment/role/
 * profileRevision happen to repeat (the A -> B -> A case).
 */
export function computeContextVersionKey(version: MoneyPennyContextVersion): string {
  return `${version.generation}::${version.panel}::${version.personaId ?? ''}::${version.environment}::${version.role}::${version.profileRevision}`;
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
