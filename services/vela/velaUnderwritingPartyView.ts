/**
 * Vela underwriting party view — Use Case Zero build-order item 10b. A PURE
 * redaction over `services/vela/velaUnderwritingChainProjection.ts`'s own
 * `ConstitutionalRiskFlowState` (imported as TYPES ONLY — this file never
 * touches that module's exports or logic, and does no I/O of its own: no
 * Supabase call, no receipt read).
 *
 * WHAT THIS IS: the per-party visibility model the operator's own acceptance
 * gates require, applied to an already-assembled chain state. Given a real
 * `ConstitutionalRiskFlowState` and a `partyLabel`, produces a
 * `ConstitutionalRiskFlowParticipantView` — the SAME nine steps, each now
 * carrying an explicit `visible: boolean`, with every substantive field
 * forced to `null` (and `reason` forced to a fixed, generic string) on any
 * step this party is not entitled to see.
 *
 * THE VISIBILITY MODEL — verbatim from the operator's own acceptance gates:
 *
 *  1. Select, Admit, Freeze, Receipt, Telemetry: ALWAYS `visible: true`, real
 *     fields passed through unchanged. These are process/constitutional
 *     evidence about the request AS A WHOLE (which candidate Factor
 *     selected, whether Aegis admitted it, whether the envelope froze,
 *     receipt/DVN status, telemetry recording) — not any one party's
 *     private operand — and every bound party has standing to see that the
 *     process ran. This is a documented design decision, not an oversight.
 *
 *  2. Authorize: `visible: true` always (a party can always see its OWN
 *     mandate/disclosure settings), but `scope.grants` is FILTERED to only
 *     grants where `grant.party === partyLabel OR grant.to === partyLabel`.
 *     The total original grant count is NEVER exposed anywhere in the
 *     returned shape (no length hint of any kind) — an empty filtered array
 *     must be indistinguishable, from the shape alone, from "this party
 *     genuinely has zero grants naming it" vs. "other grants exist that
 *     don't name this party".
 *
 *  3. Execute + Quote: a party P sees these ONLY when `scope.grants`
 *     contains at least one grant with `action === 'DISCLOSE_TO' AND to ===
 *     P`. `DISCLOSE_TO` controls whether another party's derived result is
 *     visible; a shared derived output can be shown to multiple parties only
 *     when the actual disclosure scope permits it. Being a `grant.party` on
 *     a `COMPUTE_WITH` grant does NOT by itself grant Execute/Quote
 *     visibility — only a matching `DISCLOSE_TO.to` does. When not entitled:
 *     `visible: false`, every substantive field `null`, `reason` is the
 *     FIXED generic string (never derived from the real disposition/
 *     premium/anything else — a differently-worded reason would itself leak
 *     information).
 *
 *  4. Settle: gated by the SAME `DISCLOSE_TO`-to-self check as Execute/Quote
 *     — settlement is part of the same derived-outcome disclosure, not a
 *     separate grant type.
 *
 *  5. Every step's `state` field is ALWAYS the real, un-redacted state (the
 *     step-state chip vocabulary itself is not confidential) — only
 *     substantive per-step FIELDS and the `reason` string are ever redacted.
 *     `reason` when `visible === false` is always the exact same fixed
 *     string, never interpolated with real evidence.
 *
 * WHY THIS EXTENDS, RATHER THAN PARALLEL-REDEFINES,
 * `velaUnderwritingChainProjection.ts`'s OWN PER-STEP INTERFACES (CLAUDE.md
 * inv.engineering.036/037 — reuse, don't duplicate): every field on every one
 * of that file's nine step interfaces is ALREADY nullable (this was verified
 * by reading that file in full), so a plain intersection with `{ visible:
 * boolean }` is sufficient to express "every substantive field is `| null`
 * and must be null when not visible" for every step — there is no need to
 * hand-redeclare each field. A future field added to any of those step
 * interfaces is automatically nullable-compatible here too, rather than
 * silently missing from a hand-copied parallel type.
 *
 * PURE: no I/O, no DB, no receipt, no network call. The route
 * (`app/api/moneypenny/constitutional-risk-flow/route.ts`) calls
 * `getConstitutionalRiskFlowState` exactly once, then this function exactly
 * once — never the reverse order, never twice.
 */

import type {
  ConstitutionalRiskFlowState,
  ConstitutionalRiskFlowSelectStep,
  ConstitutionalRiskFlowAdmitStep,
  ConstitutionalRiskFlowAuthorizeStep,
  ConstitutionalRiskFlowFreezeStep,
  ConstitutionalRiskFlowExecuteStep,
  ConstitutionalRiskFlowQuoteStep,
  ConstitutionalRiskFlowSettleStep,
  ConstitutionalRiskFlowReceiptStep,
  ConstitutionalRiskFlowTelemetryStep,
} from './velaUnderwritingChainProjection';
import type { VelaMultiPartyDisclosureScope, VelaScopeGrant } from './velaMultiPartyProjection';

/** The ONE fixed reason string shown for every redacted (non-visible) step —
 *  never interpolated with real evidence (that would itself leak
 *  information). Exported so the UI layer renders the identical literal
 *  string rather than re-deriving its own copy. */
export const CONSTITUTIONAL_RISK_FLOW_REDACTED_REASON =
  'Confidential contribution present — not disclosed to this party.';

// ── Per-step participant shapes — extend the chain-projection's own
//    per-step interfaces (already fully nullable) with one added field. ────

export type ConstitutionalRiskFlowParticipantSelectStep = ConstitutionalRiskFlowSelectStep & { visible: boolean };
export type ConstitutionalRiskFlowParticipantAdmitStep = ConstitutionalRiskFlowAdmitStep & { visible: boolean };
export type ConstitutionalRiskFlowParticipantAuthorizeStep = ConstitutionalRiskFlowAuthorizeStep & { visible: boolean };
export type ConstitutionalRiskFlowParticipantFreezeStep = ConstitutionalRiskFlowFreezeStep & { visible: boolean };
export type ConstitutionalRiskFlowParticipantExecuteStep = ConstitutionalRiskFlowExecuteStep & { visible: boolean };
export type ConstitutionalRiskFlowParticipantQuoteStep = ConstitutionalRiskFlowQuoteStep & { visible: boolean };
export type ConstitutionalRiskFlowParticipantSettleStep = ConstitutionalRiskFlowSettleStep & { visible: boolean };
export type ConstitutionalRiskFlowParticipantReceiptStep = ConstitutionalRiskFlowReceiptStep & { visible: boolean };
export type ConstitutionalRiskFlowParticipantTelemetryStep = ConstitutionalRiskFlowTelemetryStep & { visible: boolean };

export interface ConstitutionalRiskFlowParticipantView {
  requestRef: string;
  /** The party label this view was redacted for — echoed back so a
   *  consumer never has to separately track which party a given view
   *  belongs to. */
  partyLabel: string;
  select: ConstitutionalRiskFlowParticipantSelectStep;
  admit: ConstitutionalRiskFlowParticipantAdmitStep;
  authorize: ConstitutionalRiskFlowParticipantAuthorizeStep;
  freeze: ConstitutionalRiskFlowParticipantFreezeStep;
  execute: ConstitutionalRiskFlowParticipantExecuteStep;
  quote: ConstitutionalRiskFlowParticipantQuoteStep;
  settle: ConstitutionalRiskFlowParticipantSettleStep;
  receipt: ConstitutionalRiskFlowParticipantReceiptStep;
  telemetry: ConstitutionalRiskFlowParticipantTelemetryStep;
}

/** Gate 2/3's own filter, exported so a test can assert its exact output
 *  independently of the full redaction: a grant is visible to `partyLabel`
 *  when that party is either the grant's discloser (`party`) or its
 *  recipient (`to`). Deliberately does NOT expose the original array's
 *  length anywhere else in the returned shape. */
function filterGrantsForParty(grants: VelaScopeGrant[], partyLabel: string): VelaScopeGrant[] {
  return grants.filter((g) => g.party === partyLabel || g.to === partyLabel);
}

/**
 * True iff `partyLabel` is the `to` of at least one `DISCLOSE_TO` grant in
 * `scope` — gate 3/4's own entitlement check for Execute/Quote/Settle. A
 * `null` scope (no authorization exists yet) never entitles anyone.
 */
function isDisclosedToParty(scope: VelaMultiPartyDisclosureScope | null, partyLabel: string): boolean {
  if (!scope) return false;
  return scope.grants.some((g) => g.action === 'DISCLOSE_TO' && g.to === partyLabel);
}

/**
 * Redacts a full `ConstitutionalRiskFlowState` into the participant view for
 * exactly one `partyLabel`. Pure — see this file's header.
 */
export function redactConstitutionalRiskFlowStateForParty(
  state: ConstitutionalRiskFlowState,
  partyLabel: string,
): ConstitutionalRiskFlowParticipantView {
  const entitledToDerivedResult = isDisclosedToParty(state.authorize.scope, partyLabel);

  // ── Gate 1: always-visible process/constitutional evidence ──
  const select: ConstitutionalRiskFlowParticipantSelectStep = { ...state.select, visible: true };
  const admit: ConstitutionalRiskFlowParticipantAdmitStep = { ...state.admit, visible: true };
  const freeze: ConstitutionalRiskFlowParticipantFreezeStep = { ...state.freeze, visible: true };
  const receipt: ConstitutionalRiskFlowParticipantReceiptStep = { ...state.receipt, visible: true };
  const telemetry: ConstitutionalRiskFlowParticipantTelemetryStep = { ...state.telemetry, visible: true };

  // ── Gate 2: Authorize always visible, grants filtered to this party ──
  const authorize: ConstitutionalRiskFlowParticipantAuthorizeStep = {
    ...state.authorize,
    visible: true,
    scope: state.authorize.scope
      ? { binding: state.authorize.scope.binding, grants: filterGrantsForParty(state.authorize.scope.grants, partyLabel) }
      : null,
  };

  // ── Gate 3: Execute/Quote gated by DISCLOSE_TO-to-self ──
  const execute: ConstitutionalRiskFlowParticipantExecuteStep = entitledToDerivedResult
    ? { ...state.execute, visible: true }
    : {
        id: 'execute',
        state: state.execute.state,
        reason: CONSTITUTIONAL_RISK_FLOW_REDACTED_REASON,
        visible: false,
        onChainRequestId: null,
        disposition: null,
        providerMode: null,
        receiptId: null,
      };

  const quote: ConstitutionalRiskFlowParticipantQuoteStep = entitledToDerivedResult
    ? { ...state.quote, visible: true }
    : {
        id: 'quote',
        state: state.quote.state,
        reason: CONSTITUTIONAL_RISK_FLOW_REDACTED_REASON,
        visible: false,
        quote: null,
        receiptId: null,
      };

  // ── Gate 4: Settle gated by the SAME DISCLOSE_TO-to-self check ──
  const settle: ConstitutionalRiskFlowParticipantSettleStep = entitledToDerivedResult
    ? { ...state.settle, visible: true }
    : {
        id: 'settle',
        state: state.settle.state,
        reason: CONSTITUTIONAL_RISK_FLOW_REDACTED_REASON,
        visible: false,
        settlementOccurred: null,
      };

  return {
    requestRef: state.requestRef,
    partyLabel,
    select,
    admit,
    authorize,
    freeze,
    execute,
    quote,
    settle,
    receipt,
    telemetry,
  };
}
