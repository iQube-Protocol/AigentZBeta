/**
 * DCIR D3 — the Dynamic Affordance Service (CFS-020 §3, inv.interaction.117).
 *
 * A PURE, write-free recommendation layer: given the D1 event stream and the
 * D2 ConstitutionalStateSnapshot, it computes the AFFORDANCES the runtime
 * COULD surface next — "what should the operator do next". It never executes,
 * mutates, or reaches the network; it only derives candidates from what was
 * already observed. Consumers own activation (a chip click, or — under an
 * explicit opt-in policy — a bounded auto-act). This module decides only
 * WHICH affordances are live and WHETHER a given one is eligible to auto-act.
 *
 * RATIFIED AFFORDANCE POLICY (operator, 2026-07-07 — enforced in code here):
 *   1. SUGGEST-ONLY is the default and always-available posture. Every
 *      affordance is a suggestion the operator chooses to act on.
 *   2. Opt-in AUTO-ACT exists but ships OFF (`DEFAULT_AUTO_ACT_POLICY`), with
 *      two hard caveats:
 *        (a) It can be disabled instantly — `disableAutoAct()` is the trivial,
 *            synchronous kill switch (returns a disabled policy; no I/O).
 *        (b) A NOTIFICATION must accompany every auto-act change:
 *            `autoActPolicyChangeNotice()` when the setting flips, and
 *            `autoActNotice()` when an affordance is actually auto-executed.
 *   3. Auto-act is boundaried to a SINGLE class: `AUTO_ACTABLE_CLASSES =
 *      ['navigation']`. Only reversible, side-effect-free navigation (open a
 *      capsule, focus a card, switch a tab) may ever auto-act. Every other
 *      class (mutation, deployment, external, governance, informational) is
 *      suggest-only ALWAYS, even with auto-act enabled. `resolveAutoActable`
 *      is the single choke-point that enforces this boundary in code — not
 *      just documentation.
 *
 * COMPLETION / RELEVANCE CONTRACT (the "no pulsating done actions" rule the
 * downstream intelligent-buttons work depends on): an action already executed,
 * completed, or made irrelevant by observed events is NOT emitted. Every
 * affordance `generateAffordances` returns is LIVE (relevance > 0);
 * `isAffordanceLive` re-derives from observed state to answer "is action X
 * still a live affordance?" truthfully.
 *
 * CAPSULE CONTAINMENT (CLAUDE.md GOLDEN RULE; inv.interaction.117): every
 * affordance carries a non-empty `capsuleScope` — it emerges WITHIN the
 * operator's active context, never as orphan output.
 *
 * Relationship to the D0 contract's `Affordance` (types/dcir.ts §3): that type
 * is the eventual UI-SURFACE descriptor (kind + constitutionalBasis). This D3
 * `Affordance` is the RECOMMENDATION-LAYER candidate (class + rationale +
 * auto-act eligibility + relevance) the surface layer renders from. Distinct
 * concerns, deliberately not forked into one shape.
 *
 * Tier discipline: inputs are DcirEvents (T0 inexpressible by contract) and
 * the D2 snapshot (persona field is null on that seam). Outputs carry only
 * labels, rationales, capsule scopes, and relevance numbers derived from
 * T2-safe summaries — NEVER personaId / authProfileId / rootDid / fioHandle.
 *
 * Isomorphic: no fs, no DB, no React, no clock, no randomness — deterministic
 * and safe for both the chat route and client components.
 */

import type { ConstitutionalStateSnapshot, DcirEvent, DcirEventKind } from '@/types/dcir';

// ─── Affordance classes + the auto-act boundary (canary-pinned) ─────────────

/**
 * The recommendation-layer class of an affordance. Only `navigation` is ever
 * auto-actable (see AUTO_ACTABLE_CLASSES); the rest are suggest-only ALWAYS.
 */
export type AffordanceClass =
  | 'navigation'
  | 'mutation'
  | 'deployment'
  | 'external'
  | 'governance'
  | 'informational';

/**
 * The ONLY class eligible for opt-in auto-act. Navigation is reversible,
 * non-destructive, and has no side effects (open a capsule, focus a card,
 * switch a tab). This boundary is non-negotiable and enforced by
 * `resolveAutoActable`. Extending it is a separate ratification, never a
 * rider on this module.
 */
export const AUTO_ACTABLE_CLASSES = ['navigation'] as const;

// ─── Relevance weights (deterministic; observe-mode partial-state honest) ────

/** A received-but-undecided proposal is the strongest "do this next" signal. */
export const AFFORDANCE_RELEVANCE_OPEN_PENDING = 0.8;
/** A stalled stage awaiting a fresh proposal. */
export const AFFORDANCE_RELEVANCE_PRODUCE_NEXT = 0.7;
/** A generated implementation pack awaiting a deployment proposal. */
export const AFFORDANCE_RELEVANCE_RECORD_DEPLOYMENT = 0.6;

// ─── The affordance shape ────────────────────────────────────────────────────

export interface Affordance {
  /** Deterministic id — stable for a given derivation so consumers can ask
   * `isAffordanceLive(id, …)` about a specific action. */
  id: string;
  class: AffordanceClass;
  /** Operator-facing label. */
  label: string;
  /** Why NOW — derived from observed events / snapshot state. */
  rationale: string;
  /** True iff `class ∈ AUTO_ACTABLE_CLASSES`. Necessary-but-not-sufficient:
   * `resolveAutoActable` still re-checks class + policy at the choke-point. */
  autoActable: boolean;
  /** 0..1 — how live/urgent this is. Emitted affordances are always > 0. */
  relevance: number;
  /** The capsule/context this affordance renders WITHIN — never empty
   * (Capsule Containment; an affordance with no scope is orphan output). */
  capsuleScope: string;
}

// ─── Auto-act policy (opt-in, OFF by default) ───────────────────────────────

export interface AutoActPolicy {
  /** OFF by default — suggest-only is the default posture. */
  enabled: boolean;
}

/** Ratified default: auto-act is OFF. Suggest-only until the operator opts in. */
export const DEFAULT_AUTO_ACT_POLICY: AutoActPolicy = { enabled: false };

/**
 * Caveat 2(a) — the kill switch. Trivial and synchronous: disabling auto-act
 * is always one pure call away, no I/O, no async.
 */
export function disableAutoAct(): AutoActPolicy {
  return { enabled: false };
}

/**
 * THE choke-point that enforces caveat 3. An affordance may auto-act ONLY
 * when the policy is enabled AND the affordance is flagged auto-actable AND
 * its class is in the allow-list. Any non-navigation class returns false even
 * with `policy.enabled === true`; any affordance returns false when the
 * policy is off. This is the single place the boundary is enforced in code.
 */
export function resolveAutoActable(aff: Affordance, policy: AutoActPolicy): boolean {
  return (
    policy.enabled &&
    aff.autoActable &&
    (AUTO_ACTABLE_CLASSES as readonly AffordanceClass[]).includes(aff.class)
  );
}

/**
 * Caveat 2(b), execution notice: the operator-facing text emitted whenever an
 * affordance is actually auto-executed. Names the action, its scope, and the
 * always-available disable path.
 */
export function autoActNotice(aff: Affordance): string {
  return `metaMe auto-acted a navigation affordance: "${aff.label}" [scope: ${aff.capsuleScope}]. Auto-act is ON — you can disable it instantly at any time.`;
}

/**
 * Caveat 2(b), setting-flip notice: the operator-facing text emitted whenever
 * the auto-act setting itself is changed (enabled or disabled).
 */
export function autoActPolicyChangeNotice(next: AutoActPolicy): string {
  return next.enabled
    ? 'Auto-act ENABLED. Only reversible navigation affordances (open a capsule, focus a card, switch a tab) will ever auto-act — everything else stays suggest-only. You can disable auto-act instantly at any time.'
    : 'Auto-act DISABLED. Every affordance is now suggest-only — the runtime will surface recommendations but never act on them for you.';
}

// ─── Observed-event predicates (the D1 vocabulary, read-only) ────────────────

/** Decision-class events (a proposal/artefact was accepted or rejected). */
const DECISION_KINDS: readonly DcirEventKind[] = [
  'RecommendationAccepted',
  'RecommendationRejected',
  'ArtifactApproved',
  'ArtifactRejected',
];

function isDecision(e: DcirEvent): boolean {
  return DECISION_KINDS.includes(e.kind);
}

/** aigentZ produced a structured stage proposal (devStageProposalReceivedEvent). */
function isProposalReceived(e: DcirEvent): boolean {
  return e.kind === 'ToolOutputProduced' && e.summary.startsWith('stage proposal received:');
}

/** An implementation pack was generated (devImplementationPackGeneratedEvent). */
function isImplementationPackGenerated(e: DcirEvent): boolean {
  return e.kind === 'DocumentCreated' && e.summary.startsWith('implementation pack generated');
}

/** A deployment was proposed (devDeploymentProposedEvent). */
function isDeploymentProposed(e: DcirEvent): boolean {
  return e.kind === 'SystemEvent' && e.summary.startsWith('deployment proposed');
}

// ─── Small pure utilities (inlined — no cross-module private forks) ──────────

/** Deterministic id-safe token. Inlined (stateEngine's slugify is private and
 * this module must not modify stateEngine.ts). */
function idSafe(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/** Isomorphic last-matching-index (no reliance on Array.findLastIndex). */
function lastIndexWhere(events: readonly DcirEvent[], predicate: (e: DcirEvent) => boolean): number {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    if (predicate(events[i])) return i;
  }
  return -1;
}

/**
 * Defensive read of the D2 snapshot's workflow position. The D0 contract types
 * `workflow` as `unknown` (D2 owns the shape); buildStateSnapshot populates
 * `{ surface, stage, activeCapsule }`. We read it defensively rather than
 * assume the shape — malformed input yields nulls, never a throw.
 */
function readWorkflow(snapshot: ConstitutionalStateSnapshot): {
  stage: string | null;
  activeCapsule: string | null;
} {
  const w = snapshot?.workflow;
  if (!w || typeof w !== 'object' || Array.isArray(w)) return { stage: null, activeCapsule: null };
  const rec = w as Record<string, unknown>;
  return {
    stage: typeof rec.stage === 'string' ? rec.stage : null,
    activeCapsule: typeof rec.activeCapsule === 'string' ? rec.activeCapsule : null,
  };
}

// ─── Affordance generation (pure; completion-aware) ──────────────────────────

/** Stable ordering: auto-actable first (navigation), then by relevance desc,
 * then by id — same input always yields the same order. */
function compareAffordances(a: Affordance, b: Affordance): number {
  if (a.autoActable !== b.autoActable) return a.autoActable ? -1 : 1;
  if (a.relevance !== b.relevance) return b.relevance - a.relevance;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Derive the LIVE affordances from the observed event stream + D2 snapshot.
 * Pure and deterministic (no clock, no randomness). Completion-aware: an
 * action already done or no longer relevant is NOT emitted (the "no pulsating
 * done actions" contract). Every returned affordance has relevance > 0 and a
 * non-empty capsuleScope.
 *
 * Derivations (each grounded in observed events, never invented):
 *   A) navigation — a proposal was RECEIVED for a capsule and has NOT been
 *      decided since, and that capsule is not already open → "open the X
 *      capsule". Auto-actable (reversible navigation).
 *   B) deployment — an implementation pack was generated and NO deployment
 *      has been proposed since → "record a deployment proposal". Suggest-only.
 *   C) mutation — the workflow is on a stage, the most recent decision was a
 *      dismissal, and no fresh proposal has arrived since → "produce the next
 *      proposal". Suggest-only.
 */
export function generateAffordances(
  events: readonly DcirEvent[],
  snapshot: ConstitutionalStateSnapshot,
): Affordance[] {
  const out: Affordance[] = [];
  const { stage, activeCapsule } = readWorkflow(snapshot);

  // A) Pending proposals → navigation "open the <capsule>" (auto-actable).
  const byCapsule = new Map<string, DcirEvent[]>();
  events.forEach((e) => {
    if (!isProposalReceived(e) || !e.capsuleScope) return;
    const group = byCapsule.get(e.capsuleScope) ?? [];
    group.push(e);
    byCapsule.set(e.capsuleScope, group);
  });
  for (const capsule of [...byCapsule.keys()].sort()) {
    const group = byCapsule.get(capsule) ?? [];
    const latest = group[group.length - 1];
    const latestIndex = events.indexOf(latest);
    // Decided since the newest proposal for this capsule → handled, not live.
    const decidedSince = events.some(
      (e, i) => i > latestIndex && e.capsuleScope === capsule && isDecision(e),
    );
    if (decidedSince) continue;
    // Already the open capsule → opening it is a no-op / irrelevant.
    if (activeCapsule === capsule) continue;
    out.push({
      id: `aff-open-capsule-${idSafe(capsule)}`,
      class: 'navigation',
      label: `Open the ${capsule} capsule`,
      rationale: `A proposal was received for ${capsule} and has not been reviewed yet — open the capsule to decide on it.`,
      autoActable: true,
      relevance: AFFORDANCE_RELEVANCE_OPEN_PENDING,
      capsuleScope: capsule,
    });
  }

  // B) Implementation pack generated + no deployment proposed since →
  //    deployment affordance (suggest-only ALWAYS).
  const packIndex = lastIndexWhere(events, isImplementationPackGenerated);
  if (packIndex >= 0) {
    const deploymentProposedSince = events.some((e, i) => i > packIndex && isDeploymentProposed(e));
    if (!deploymentProposedSince) {
      out.push({
        id: 'aff-record-deployment',
        class: 'deployment',
        label: 'Record a deployment proposal',
        rationale:
          'An implementation pack was generated this session but no deployment has been proposed since — record a deployment provenance receipt when ready.',
        autoActable: false,
        relevance: AFFORDANCE_RELEVANCE_RECORD_DEPLOYMENT,
        capsuleScope: 'implementation',
      });
    }
  }

  // C) Stalled stage → mutation "produce the next proposal" (suggest-only).
  if (stage) {
    const lastDecisionIndex = lastIndexWhere(events, isDecision);
    const dismissedLast =
      lastDecisionIndex >= 0 && events[lastDecisionIndex].kind === 'RecommendationRejected';
    const proposalSinceDismissal =
      dismissedLast && events.some((e, i) => i > lastDecisionIndex && isProposalReceived(e));
    if (dismissedLast && !proposalSinceDismissal) {
      out.push({
        id: `aff-produce-next-${idSafe(stage)}`,
        class: 'mutation',
        label: `Produce the next proposal for ${stage}`,
        rationale: `The last proposal was dismissed and no replacement has been produced — generate a fresh proposal for the ${stage} stage.`,
        autoActable: false,
        relevance: AFFORDANCE_RELEVANCE_PRODUCE_NEXT,
        capsuleScope: activeCapsule ?? stage,
      });
    }
  }

  return out.sort(compareAffordances);
}

/**
 * Truthful "is action X still a live affordance?" — re-derives from observed
 * state and reports whether an affordance with the given id is still emitted
 * (i.e. not completed / not irrelevant). This is the choke-point the
 * downstream intelligent-buttons layer asks so a button never pulses for an
 * action that is already done.
 */
export function isAffordanceLive(
  id: string,
  events: readonly DcirEvent[],
  snapshot: ConstitutionalStateSnapshot,
): boolean {
  return generateAffordances(events, snapshot).some((a) => a.id === id && a.relevance > 0);
}
