/**
 * ActorEvent — DevOn UI Refinement Phase C.
 *
 * The smallest additive representation of "who is acting, what they are
 * doing, what happened" inside the left-pane DevOn stream. Deliberately
 * smaller than the PRD's original illustrative sketch — no `stage`, no
 * `artifactRefs`/`receiptRefs`, no structured `execution` object — because
 * nothing yet consumes those fields. Extend when a real consumer needs them,
 * not in advance of one (the same discipline `ProofOfRisk`'s `evidenceRefs`
 * and `RiskObservation`'s design already follow elsewhere in this codebase).
 *
 * ── Why this is NOT DCIR, NOT DevLoopState, NOT a persisted store ──────────
 *
 * DCIR (`types/dcir.ts`) answers "what was observed" and is constitutionally
 * forbidden from carrying provider/actor identity (CANARY-09,
 * `services/dcir/eventStream.ts`) — an event's kind/summary must depend only
 * on WHAT happened, never WHICH actor produced it. `ActorEvent` answers the
 * different question DCIR must never answer: WHO is acting. The two may
 * describe the same underlying action (e.g. a dispatch) without either
 * becoming the other's carrier.
 *
 * `DevLoopState` (`types/devCommandCenter.ts`) is the persisted, DB-bound
 * development-session record. Actor activity is honestly transient —
 * "Claude Code is currently working" is a fact about THIS browser tab right
 * now, not a fact about the development cycle worth persisting. It is held
 * as plain component state in `DevCommandCenterTab.tsx`, the same posture
 * `pendingProposals`/`capsuleSuggestions` already take, and is never folded
 * into `DevLoopState` (mirrors the T0-isolation discipline
 * `DEV_LOOP_FORBIDDEN_STATE_KEYS`, `services/devCommandCenter/devLoop.ts`,
 * already applies for a different reason).
 *
 * ── Provider-neutral by construction ────────────────────────────────────
 *
 * `actorId`/`actorName` are plain strings. Nothing in this module — or in
 * the renderer that consumes it (`ActorActivityStrip.tsx`) — branches on a
 * specific value (no `if (actorId === 'claude-code')`). Claude Code is the
 * first WIRED producer, not the ontology; the same shape renders
 * `Security Reviewer · Reviewing` identically.
 *
 * ── The authorization boundary is a distinct action, not a status flag ────
 *
 * `completed` means implementation EXECUTION completed — it does not mean
 * development completed. `awaiting-authorization` is a SEPARATE, later
 * action (typically raised by DevOn itself once an actor completes) so the
 * human PR-merge gate stays visible in the stream rather than collapsing
 * into "done".
 */

export const ACTOR_EVENT_ACTIONS = [
  'invoked',
  'working',
  'completed',
  'failed',
  'awaiting-authorization',
] as const;
export type ActorEventAction = (typeof ACTOR_EVENT_ACTIONS)[number];

/**
 * The generic, action-derived verb the renderer falls back to when a caller
 * supplies no `actionLabel`. Kept here (not in the renderer) so the
 * provider-neutral default is a single, testable source rather than
 * something the component computes ad hoc.
 */
export const DEFAULT_ACTION_LABEL: Record<ActorEventAction, string> = {
  invoked: 'Invoked',
  working: 'Working',
  completed: 'Complete',
  failed: 'Failed',
  'awaiting-authorization': 'Awaiting authorization',
};

export interface ActorEvent {
  id: string;
  /** Opaque identifier — 'claude-code', 'aigent-z', 'security-reviewer', ... */
  actorId: string;
  /** Display name — 'Claude Code', 'Aigent Z', 'Security Reviewer', ... */
  actorName: string;
  action: ActorEventAction;
  /**
   * The verb shown next to `actorName` (e.g. "Implementing", "Reviewing").
   * Caller-supplied DATA, never actor-specific branching in the renderer —
   * this is what lets `Claude Code · Implementing` and
   * `Security Reviewer · Reviewing` render through the identical component.
   * Falls back to `DEFAULT_ACTION_LABEL[action]` when omitted.
   */
  actionLabel?: string | null;
  /** One line — what happened, e.g. "Implementation Pack dispatched". */
  summary: string;
  /** Optional second line — e.g. a branch name or PR reference. */
  detail?: string | null;
  occurredAt: string;
}

export type ActorEventInput = Omit<ActorEvent, 'id' | 'occurredAt'> & {
  id?: string;
  occurredAt?: string;
};

/** Ring-buffer cap — mirrors DCIR's own session-local buffer discipline
 *  (`DCIR_EVENT_BUFFER_CAP`, `services/dcir/eventStream.ts`). */
export const ACTOR_EVENT_BUFFER_CAP = 20;

/**
 * Append one actor event, capped. Pure — the caller supplies `occurredAt`
 * (this module reads no clock), matching every other pure function in this
 * directory.
 */
export function appendActorEvent(
  events: readonly ActorEvent[],
  input: ActorEventInput,
): ActorEvent[] {
  const event: ActorEvent = {
    id: input.id ?? `ae-${events.length}-${input.actorId}-${input.action}`,
    actorId: input.actorId,
    actorName: input.actorName,
    action: input.action,
    actionLabel: input.actionLabel ?? null,
    summary: input.summary,
    detail: input.detail ?? null,
    occurredAt: input.occurredAt ?? '',
  };
  return [...events, event].slice(-ACTOR_EVENT_BUFFER_CAP);
}

/**
 * The current state per actor — what the strip actually renders. A `Map`
 * keyed on `actorId`, so a later event for an already-seen actor UPDATES its
 * entry in place rather than appending a second row; iteration order stays
 * "first time this actor was seen", so an actor's card does not jump
 * position in the strip every time its own status changes.
 */
export function latestPerActor(events: readonly ActorEvent[]): ActorEvent[] {
  const byActor = new Map<string, ActorEvent>();
  for (const event of events) byActor.set(event.actorId, event);
  return [...byActor.values()];
}
