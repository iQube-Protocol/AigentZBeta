/**
 * Action vocabulary mapping — internal `AccessAction` (spine) ↔ surface
 * `IQubeAgentAction` (legibility card).
 *
 * Source: PRD v1.0 §4.3 + Stage 0 audit Deliverable 4 (gap closure).
 *
 * Why two vocabularies?
 *   - `AccessAction` (from types/access.ts) is the input to evaluateAccess()
 *     and the receipt taxonomy in policyResolvers.ts. It describes
 *     internal policy decisions: read/watch/listen/invoke/connect/remix/
 *     mint/transfer/payment-settle/policy-escalation/disclosure.
 *   - `IQubeAgentAction` (from types/iqube/legibility.ts) is the verb an
 *     agent sees on an iQube card. It includes surface-only passive verbs
 *     (discover, read_meta, read_summary, cite, derive_summary, etc.) that
 *     do not correspond to internal access decisions.
 *
 * Rules:
 *   - Every AccessAction MUST map to an IQubeAgentAction OR be marked
 *     `internal_only`. CI test asserts coverage.
 *   - Every non-passive IQubeAgentAction SHOULD have an inverse mapping in
 *     SURFACE_INTERNAL_MAP. Passive surface verbs are listed in
 *     PASSIVE_SURFACE_VERBS — they never round-trip to an AccessAction
 *     because they're descriptive or routed to non-access subsystems.
 *
 * Any addition to either vocabulary MUST update this file AND pass the CI
 * completeness tests. Review gate lives in the iQube Registry cartridge
 * admin tab (PRD v1.1 §A.6); merges without an updated mapping fail.
 */

import type { AccessAction } from '@/types/access';
import type { IQubeAgentAction } from '@/types/iqube/legibility';

// ── internal → surface ────────────────────────────────────────────────────

/**
 * Every value in `AccessAction` is keyed here. `internal_only` marks
 * actions that have no agent-facing surface verb (the action exists in the
 * spine but is not exposed on cards or via the /actions menu).
 */
export const ACTION_SURFACE_MAP: Record<AccessAction, IQubeAgentAction | 'internal_only'> = {
  // Reads — collapse to read_payload at the surface. The card builder may
  // choose to render `read_summary` instead when the descriptor advertises
  // payload_disclosure='summary_only'; that choice is presentational, not
  // an internal action distinction.
  read: 'read_payload',
  watch: 'read_payload',
  listen: 'read_payload',

  // Invocation — surface verb depends on primitive. ToolQube cards render
  // `transform`; ContentQube cards render `derive_summary` (where the
  // adapter declares the invocation produces a derived view). Both map to
  // internal `invoke`. The card builder picks the surface verb per primitive.
  invoke: 'transform',

  // Access requests — surface verb is `request_access`. The handler runs
  // evaluateAccess and may emit a sync DVN receipt per policyResolvers.
  connect: 'request_access',

  // Derivative / fork — both `remix` and `mint` (which produces a derivative
  // iQube) collapse to surface `mint_derivative`. ContentQube + DataQube
  // adapters expose this; ToolQube/AigentQube do not by default.
  remix: 'mint_derivative',
  mint: 'mint_derivative',

  // Internal-only — transfers and payment-settle are receipt-bearing
  // internal events. The surface communicates ownership change indirectly
  // (mint_derivative on the receiving side, revoke_access on the sender)
  // but does not expose the raw verbs.
  transfer: 'internal_only',
  'payment-settle': 'internal_only',

  // Policy escalation surfaces as revoke_access on the card. Used for
  // operator revocations + automatic policy-escalation events.
  'policy-escalation': 'revoke_access',

  // Disclosure events (audit-state requests, reputation disclosure) surface
  // as audit_state. The handler must enforce the discloseCredential path.
  disclosure: 'audit_state',
};

// ── surface → internal ────────────────────────────────────────────────────

/**
 * Inverse of ACTION_SURFACE_MAP for non-`internal_only` entries.
 * `derive_summary` maps to `invoke` (ContentQube derivation runs through
 * the same gate as ToolQube invocation, just with a different output).
 *
 * Passive verbs (see PASSIVE_SURFACE_VERBS) intentionally have no entry
 * here — they do not round-trip to an internal AccessAction.
 */
export const SURFACE_INTERNAL_MAP: Partial<Record<IQubeAgentAction, AccessAction>> = {
  read_payload: 'read',
  transform: 'invoke',
  derive_summary: 'invoke',
  request_access: 'connect',
  mint_derivative: 'mint',
  revoke_access: 'policy-escalation',
  audit_state: 'disclosure',
};

// ── passive surface verbs ─────────────────────────────────────────────────

/**
 * Surface verbs that do not correspond to an internal AccessAction.
 *
 * These verbs are EITHER:
 *   - purely descriptive (discover, read_meta, cite — the agent learns
 *     about the iQube without invoking a policy gate), OR
 *   - routed to non-access subsystems (propose_update → suggestion queue;
 *     fork → ingestion factory intake; record_receipt → passive, the
 *     receipt has already been emitted by the mutating handler).
 *
 * `read_summary` is passive because the card itself carries the summary
 * (metaqube.summary is T1-safe). If the route ever generates a summary
 * server-side it should use `derive_summary` (internal `invoke`) instead.
 *
 * Adding a new IQubeAgentAction REQUIRES either an entry in
 * SURFACE_INTERNAL_MAP or membership in this set. CI test enforces this.
 */
export const PASSIVE_SURFACE_VERBS: ReadonlySet<IQubeAgentAction> = new Set([
  'discover',
  'read_meta',
  'read_summary',
  'cite',
  'propose_update',
  'fork',
  'record_receipt',
]);

// ── mutating surface verbs (consumer convenience) ─────────────────────────

/**
 * Surface verbs that mutate state. Drives the card's `requires_authentication`
 * + `requires_dvn_receipt` flags via cardBuilder.ts. Kept here so the rules
 * live next to the action map rather than hardcoded inside cardBuilder.
 *
 * `record_receipt` is mutating in the sense that it writes a passive log
 * entry, but is treated as passive at the surface (the meaningful mutation
 * already happened in the underlying handler).
 *
 * `audit_state` is mutating because its internal action (`disclosure`)
 * routes through the discloseCredential path — auth-requiring and
 * receipt-bearing — even though the card transport for the verb is GET.
 */
export const MUTATING_SURFACE_VERBS: ReadonlySet<IQubeAgentAction> = new Set([
  'request_access',
  'read_payload',
  'derive_summary',
  'transform',
  'mint_derivative',
  'fork',
  'propose_update',
  'revoke_access',
  'record_receipt',
  'audit_state',
]);

// ── derived helpers ───────────────────────────────────────────────────────

export function isPassiveSurfaceVerb(verb: IQubeAgentAction): boolean {
  return PASSIVE_SURFACE_VERBS.has(verb);
}

export function isMutatingSurfaceVerb(verb: IQubeAgentAction): boolean {
  return MUTATING_SURFACE_VERBS.has(verb);
}

export function surfaceForAccessAction(action: AccessAction): IQubeAgentAction | null {
  const mapped = ACTION_SURFACE_MAP[action];
  return mapped === 'internal_only' ? null : mapped;
}

export function accessActionForSurfaceVerb(verb: IQubeAgentAction): AccessAction | null {
  return SURFACE_INTERNAL_MAP[verb] ?? null;
}
