/**
 * iQube lifecycle state machine.
 *
 * PRD v1.0 §6 + v1.1 §B.2 (published/canonized clarification) + Stage
 * 1→2 transition (ContentQube substate mapping). Stage 3 deliverable.
 *
 * Two enums, three roles:
 *   1. UNIVERSAL_INTERNAL — the canonical 9-state lifecycle. Source of
 *      truth for state-machine logic.
 *   2. CONTENT_QUBE_INTERNAL — ContentQube's richer 8-state column
 *      (lifecycle_state on content_qubes). Maps INTO universal_internal
 *      via mapContentQubeInternalToUniversal().
 *   3. SURFACE — the shipped legibility 5-state enum that agent-facing
 *      cards expose. Derived from universal_internal via
 *      internalToSurface(). Surface 'canonized' means "agent-discoverable
 *      authoritative" — does NOT distinguish governance-canonized from
 *      published. Internal published vs canonized remain distinct
 *      governance states.
 *
 * Transitions:
 *   - validateTransition(from, to)  — pure validator over the graph
 *   - transitionRule(from, to)      — per-transition table row (initiator,
 *     approval, receipt, chain, descriptor, payload-access, reversibility)
 *
 * The lifecycle module DOES NOT execute transitions. It validates +
 * describes. The canonization queue handler / mint saga / version
 * bumper invoke the state machine then perform the side effects
 * (DB write, DVN receipt, chain action, card refresh) in the caller.
 *
 * Authority rule (PRD v1.0 §3): this module never calls evaluateAccess,
 * never calls userOwnsAsset, never writes receipts. It describes.
 */

import type {
  IQubeInternalLifecycleState,
} from '@/types/registry-canonical';
import type { IQubeLifecycleState } from '@/types/iqube/legibility';

// ── ContentQube internal substates (mirror content_qubes.lifecycle_state CHECK) ──

export type ContentQubeInternalLifecycleState =
  | 'draft'
  | 'semi_minted'
  | 'review_ready'
  | 'canon_pending'
  | 'canonized'
  | 'chain_minted'
  | 'superseded'
  | 'archived';

// ── ContentQube → Universal mapping (operator-confirmed default per
//    Stage 1→2 transition doc) ─────────────────────────────────────────

export const CONTENT_QUBE_TO_UNIVERSAL_MAP: Record<
  ContentQubeInternalLifecycleState,
  IQubeInternalLifecycleState
> = {
  draft: 'draft',
  semi_minted: 'wip',
  review_ready: 'review_pending',
  canon_pending: 'review_pending',
  canonized: 'canonized',
  // chain_minted collapses to canonized at the UNIVERSAL layer. The
  // on-chain distinction is preserved via the chain_anchor field on the
  // canonical record (PRD v1.0 §5 chain_anchor block). The lifecycle
  // state machine treats chain_minted as canonized + a chain_anchor.
  chain_minted: 'canonized',
  // superseded → deprecated as the default. When a version bump is mid-
  // flight (new version still in review), the new_version_pending state
  // is set explicitly during the new-version transition; the old row's
  // 'superseded' DB value only appears AFTER the new version is canonized.
  superseded: 'deprecated',
  archived: 'abandoned',
};

export function mapContentQubeInternalToUniversal(
  raw: string | null | undefined,
): IQubeInternalLifecycleState {
  if (!raw) return 'draft';
  return CONTENT_QUBE_TO_UNIVERSAL_MAP[raw as ContentQubeInternalLifecycleState] ?? 'draft';
}

// ── Universal → Surface mapping (PRD v1.0 §4.3) ───────────────────────────

export const UNIVERSAL_TO_SURFACE_MAP: Record<
  IQubeInternalLifecycleState,
  IQubeLifecycleState
> = {
  draft: 'draft',
  wip: 'wip',
  // review_pending exposes as wip — surface enum doesn't carry a
  // distinct 'review' state because it's an operator-side concept.
  review_pending: 'wip',
  // published → canonized at the SURFACE because agents treat both as
  // 'authoritative + discoverable'. Internal governance distinction lives
  // on internal_lifecycle (admin / cartridge view exposes it; agent card
  // does not). PRD v1.1 §B.2 clarification.
  published: 'canonized',
  canonized: 'canonized',
  deprecated: 'deprecated',
  // revoked → archived at the surface — signals "no longer authoritative"
  // without implying the cause was abandonment.
  revoked: 'archived',
  // new_version_pending → wip until the new version reaches canonized;
  // the old row's surface remains canonized during the bump because
  // 'superseded' only triggers AFTER the new version publishes.
  new_version_pending: 'wip',
  abandoned: 'archived',
};

export function internalToSurface(
  internal: IQubeInternalLifecycleState,
): IQubeLifecycleState {
  return UNIVERSAL_TO_SURFACE_MAP[internal];
}

// ── Transition graph ─────────────────────────────────────────────────────

const ALLOWED_TRANSITIONS: Record<
  IQubeInternalLifecycleState,
  ReadonlyArray<IQubeInternalLifecycleState>
> = {
  draft: ['wip', 'abandoned'],
  wip: ['review_pending', 'abandoned'],
  review_pending: ['published', 'wip'],
  published: ['canonized', 'deprecated', 'revoked', 'new_version_pending'],
  canonized: ['deprecated', 'revoked', 'new_version_pending'],
  deprecated: ['revoked'],
  new_version_pending: ['canonized'],
  revoked: [],
  abandoned: [],
};

export function validateTransition(
  from: IQubeInternalLifecycleState,
  to: IQubeInternalLifecycleState,
): { allowed: true } | { allowed: false; reason: string } {
  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed) {
    return { allowed: false, reason: `Unknown source state '${from}'` };
  }
  if (!allowed.includes(to)) {
    return {
      allowed: false,
      reason: `Transition ${from} → ${to} is not in the allowed set (${allowed.join(', ') || 'terminal state — no transitions'})`,
    };
  }
  return { allowed: true };
}

export function isTerminalState(state: IQubeInternalLifecycleState): boolean {
  return ALLOWED_TRANSITIONS[state].length === 0;
}

export function allowedTransitionsFrom(
  state: IQubeInternalLifecycleState,
): ReadonlyArray<IQubeInternalLifecycleState> {
  return ALLOWED_TRANSITIONS[state] ?? [];
}

// ── Per-transition rules table (PRD v1.0 §6.1) ────────────────────────────

export type InitiatorRole =
  | 'creator'
  | 'creator_or_partner'
  | 'operator'
  | 'platform_admin'
  | 'system_auto';

export interface TransitionRule {
  from: IQubeInternalLifecycleState;
  to: IQubeInternalLifecycleState;
  /** Who can initiate this transition. */
  initiator: InitiatorRole;
  /**
   * Whether an explicit operator approval is required (gated by
   * iqube_canonization_requests workflow or equivalent).
   */
  human_approval_required: boolean;
  /**
   * DVN receipt requirement. action='none' means no receipt; mode='sync'
   * blocks the transition until receipt persists; 'async' fires-and-forget.
   */
  receipt: {
    action: 'none' | 'mint' | 'transfer' | 'policy-escalation' | 'disclosure' | 'canonize';
    mode: 'sync' | 'async' | 'none';
  };
  /**
   * True if the transition triggers a chain action (mint, transfer, etc).
   * Stage 5 mint saga executes the chain side; lifecycle only marks the
   * requirement.
   */
  chain_interaction: boolean;
  /**
   * What the legibility/descriptor surface does as a side effect.
   *   - 'no_change'           — card stays as-is
   *   - 'refresh'             — card's updated_at bumps; permissions recompute
   *   - 'mark_superseded_by'  — previous-version card gets superseded_by pointer
   *   - 'mark_supersedes'     — new card gets supersedes pointer
   *   - 'tombstone'           — card route emits 410 / tombstone shape
   *   - 'unpublish'           — card removed from catalog
   */
  descriptor_side_effect:
    | 'no_change'
    | 'refresh'
    | 'mark_superseded_by'
    | 'mark_supersedes'
    | 'tombstone'
    | 'unpublish';
  /**
   * Does this transition change the holder's payload access posture?
   * (mint/transfer change ownership ⇒ true; lifecycle bumps within an
   * owner ⇒ false.)
   */
  payload_access_change: boolean;
  /**
   * Reversibility note. 'one_way' = the only escape is forward (e.g.
   * canonized → deprecated → revoked, never back to wip). 'two_way' =
   * the inverse transition is legal (e.g. review_pending ↔ wip).
   */
  reversibility: 'one_way' | 'two_way';
}

export const TRANSITION_RULES: ReadonlyArray<TransitionRule> = [
  // ── draft → wip ───────────────────────────────────────────────────
  {
    from: 'draft',
    to: 'wip',
    initiator: 'creator',
    human_approval_required: false,
    receipt: { action: 'none', mode: 'none' },
    chain_interaction: false,
    descriptor_side_effect: 'no_change',
    payload_access_change: false,
    reversibility: 'one_way',
  },
  // ── draft → abandoned ─────────────────────────────────────────────
  {
    from: 'draft',
    to: 'abandoned',
    initiator: 'creator',
    human_approval_required: false,
    receipt: { action: 'none', mode: 'none' },
    chain_interaction: false,
    descriptor_side_effect: 'unpublish',
    payload_access_change: false,
    reversibility: 'one_way',
  },
  // ── wip → review_pending ──────────────────────────────────────────
  {
    from: 'wip',
    to: 'review_pending',
    initiator: 'creator',
    human_approval_required: false,
    receipt: { action: 'none', mode: 'none' },
    chain_interaction: false,
    descriptor_side_effect: 'refresh',
    payload_access_change: false,
    reversibility: 'two_way',
  },
  // ── wip → abandoned ───────────────────────────────────────────────
  {
    from: 'wip',
    to: 'abandoned',
    initiator: 'creator',
    human_approval_required: false,
    receipt: { action: 'none', mode: 'none' },
    chain_interaction: false,
    descriptor_side_effect: 'unpublish',
    payload_access_change: false,
    reversibility: 'one_way',
  },
  // ── review_pending → published ────────────────────────────────────
  // Operator approval gate. After this, the iQube is agent-discoverable
  // but NOT yet governance-canonized. published is the soft-publish state.
  {
    from: 'review_pending',
    to: 'published',
    initiator: 'operator',
    human_approval_required: true,
    receipt: { action: 'disclosure', mode: 'sync' },
    chain_interaction: false,
    descriptor_side_effect: 'refresh',
    payload_access_change: false,
    reversibility: 'one_way',
  },
  // ── review_pending → wip (rejection / resubmit) ───────────────────
  {
    from: 'review_pending',
    to: 'wip',
    initiator: 'operator',
    human_approval_required: false,
    receipt: { action: 'policy-escalation', mode: 'sync' },
    chain_interaction: false,
    descriptor_side_effect: 'refresh',
    payload_access_change: false,
    reversibility: 'two_way',
  },
  // ── published → canonized (the governance act) ────────────────────
  // PRD v1.0 §6.2: canonization is a governance act, not a status flip.
  // Operator approval, sync DVN receipt, descriptor refresh. May trigger
  // chain mint if the qube has unminted canonical editions (Stage 5
  // saga decides; lifecycle only marks the requirement).
  {
    from: 'published',
    to: 'canonized',
    initiator: 'operator',
    human_approval_required: true,
    receipt: { action: 'canonize', mode: 'sync' },
    chain_interaction: true,
    descriptor_side_effect: 'refresh',
    payload_access_change: false,
    reversibility: 'one_way',
  },
  // ── published → deprecated ────────────────────────────────────────
  {
    from: 'published',
    to: 'deprecated',
    initiator: 'operator',
    human_approval_required: true,
    receipt: { action: 'policy-escalation', mode: 'sync' },
    chain_interaction: false,
    descriptor_side_effect: 'tombstone',
    payload_access_change: false,
    reversibility: 'one_way',
  },
  // ── published → revoked ───────────────────────────────────────────
  {
    from: 'published',
    to: 'revoked',
    initiator: 'platform_admin',
    human_approval_required: true,
    receipt: { action: 'policy-escalation', mode: 'sync' },
    chain_interaction: false,
    descriptor_side_effect: 'tombstone',
    payload_access_change: true,
    reversibility: 'one_way',
  },
  // ── published → new_version_pending ───────────────────────────────
  {
    from: 'published',
    to: 'new_version_pending',
    initiator: 'creator_or_partner',
    human_approval_required: false,
    receipt: { action: 'disclosure', mode: 'async' },
    chain_interaction: false,
    descriptor_side_effect: 'refresh',
    payload_access_change: false,
    reversibility: 'one_way',
  },
  // ── canonized → deprecated ────────────────────────────────────────
  {
    from: 'canonized',
    to: 'deprecated',
    initiator: 'operator',
    human_approval_required: true,
    receipt: { action: 'policy-escalation', mode: 'sync' },
    chain_interaction: false,
    descriptor_side_effect: 'tombstone',
    payload_access_change: false,
    reversibility: 'one_way',
  },
  // ── canonized → revoked ───────────────────────────────────────────
  // Critical governance act. Cannot 'uncanonize' — the only forward path
  // from canonized is deprecated or revoked (or new_version_pending for
  // a version bump).
  {
    from: 'canonized',
    to: 'revoked',
    initiator: 'platform_admin',
    human_approval_required: true,
    receipt: { action: 'policy-escalation', mode: 'sync' },
    chain_interaction: true,
    descriptor_side_effect: 'tombstone',
    payload_access_change: true,
    reversibility: 'one_way',
  },
  // ── canonized → new_version_pending ───────────────────────────────
  {
    from: 'canonized',
    to: 'new_version_pending',
    initiator: 'creator_or_partner',
    human_approval_required: false,
    receipt: { action: 'disclosure', mode: 'async' },
    chain_interaction: false,
    descriptor_side_effect: 'refresh',
    payload_access_change: false,
    reversibility: 'one_way',
  },
  // ── deprecated → revoked ──────────────────────────────────────────
  {
    from: 'deprecated',
    to: 'revoked',
    initiator: 'platform_admin',
    human_approval_required: true,
    receipt: { action: 'policy-escalation', mode: 'sync' },
    chain_interaction: false,
    descriptor_side_effect: 'tombstone',
    payload_access_change: true,
    reversibility: 'one_way',
  },
  // ── new_version_pending → canonized ───────────────────────────────
  // The terminal step of a version bump. New version canonizes; old
  // version's descriptor gets mark_supersedes (the operator runs a
  // separate transition on the OLD version row, typically published →
  // deprecated, to complete the bump).
  {
    from: 'new_version_pending',
    to: 'canonized',
    initiator: 'operator',
    human_approval_required: true,
    receipt: { action: 'canonize', mode: 'sync' },
    chain_interaction: true,
    descriptor_side_effect: 'mark_supersedes',
    payload_access_change: false,
    reversibility: 'one_way',
  },
];

const RULES_BY_PAIR: ReadonlyMap<string, TransitionRule> = new Map(
  TRANSITION_RULES.map((r) => [`${r.from}|${r.to}`, r]),
);

export function transitionRule(
  from: IQubeInternalLifecycleState,
  to: IQubeInternalLifecycleState,
): TransitionRule | null {
  return RULES_BY_PAIR.get(`${from}|${to}`) ?? null;
}

// ── Composite helper: validate + return rule in one call ──────────────────

export type TransitionDecision =
  | { allowed: true; rule: TransitionRule; surface_after: IQubeLifecycleState }
  | { allowed: false; reason: string };

export function decideTransition(
  from: IQubeInternalLifecycleState,
  to: IQubeInternalLifecycleState,
): TransitionDecision {
  const v = validateTransition(from, to);
  if (!v.allowed) return { allowed: false, reason: v.reason };
  const rule = transitionRule(from, to);
  if (!rule) {
    return {
      allowed: false,
      reason: `Transition ${from} → ${to} is in the allowed graph but has no rule entry — fix TRANSITION_RULES`,
    };
  }
  return {
    allowed: true,
    rule,
    surface_after: internalToSurface(to),
  };
}
