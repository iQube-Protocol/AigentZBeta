/**
 * ConstitutionalRiskFlowPanel — Use Case Zero build-order item 10a. Renders
 * the causal chain for one private multi-party underwriting request (Factor
 * selection -> Aegis admission -> disclosure authorization -> frozen
 * envelope -> Vela execution -> quote -> settlement -> causal receipts ->
 * risk telemetry) by calling `GET /api/moneypenny/constitutional-risk-flow`
 * (`services/vela/velaUnderwritingChainProjection.ts`'s read-only assembly).
 *
 * CRITICAL DISAMBIGUATION (read before touching anything named "Use Case
 * Zero" in this codebase): `components/moneypenny/useCaseZero/
 * UseCaseZeroReadinessCapsule.tsx` (backed by `services/factor/
 * useUseCaseZeroReadiness.ts` / `useCaseZeroReadinessProjection.ts` /
 * `useCaseZeroOrchestrator.ts`) is a COMPLETELY DIFFERENT, case-scoped
 * (`factor_cases`) AGENT-ONBOARDING READINESS state machine — already
 * mounted inside `FactorPanel.tsx`/`AegisPanel.tsx`. This component does
 * NOT touch, extend, or import from any of those files. This surface is
 * named "Constitutional Risk Flow" throughout — never "Use Case Zero
 * anything" — precisely so no future reader confuses the two systems
 * (operator's own explicit naming instruction). See
 * `services/vela/velaUnderwritingChainProjection.ts`'s own header for the
 * full disambiguation this file inherits.
 *
 * No "list my requests" surface exists anywhere in this codebase yet, so
 * this panel takes a plain `requestRef` text input — the honest empty state
 * says exactly that, rather than inventing a request picker with no real
 * data behind it.
 *
 * Spine-authenticated via `personaFetch` (CLAUDE.md PARAMOUNT), same pattern
 * as `RiskEnvelopePanel.tsx` / `FinancialProfilePanel.tsx`.
 *
 * Writes the loaded `requestRef` into the shared
 * `MoneyPennyNavigationContext` (`activeRiskFlowRequestRef`) on a successful
 * load, so `MoneyPennyCopilotWorkspace` can fold a bounded ground-context
 * summary into the copilot — mirroring the existing Factor/Aegis
 * `activeCase` pattern exactly (one writer here, one reader there).
 *
 * PARTICIPANT VIEW (item 10b, additive): an optional `party` text input
 * alongside `requestRef` — the same honest "no picker exists" pattern (a
 * participant must already know their own party label). When filled in, the
 * SAME route is called with `&party=<value>`, which returns a
 * `ConstitutionalRiskFlowParticipantView`
 * (`services/vela/velaUnderwritingPartyView.ts`) instead of the full owner
 * state. That shape is a STRUCTURAL SUPERSET of `ConstitutionalRiskFlowState`
 * (every participant step type is that step's own operator-view interface
 * intersected with `{ visible: boolean }`), so every capsule below renders
 * it via the exact same field accesses with no branching required — EXCEPT
 * the Settlement capsule, which special-cased `settlementOccurred === null`
 * to a fixed operator-facing message that would otherwise silently swallow
 * the participant redaction's own fixed reason string; that one spot checks
 * `visible` explicitly (byte-identical behavior when `visible` is absent,
 * i.e. the operator/global view). A 403 (wrong/no binding) surfaces through
 * the EXISTING `RiskFlowErrorNote` with the route's own generic message —
 * never a stack trace, never route-specific detail beyond that message. When
 * `party` is left blank, behavior is byte-for-byte unchanged.
 */

"use client";

import { useCallback, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";
import { useMoneyPennyNavigation } from "./moneyPennyNavigation";
import type {
  ConstitutionalRiskFlowState,
  ConstitutionalRiskFlowStepId,
  ConstitutionalRiskFlowStepState,
} from "@/services/vela/velaUnderwritingChainProjection";
import {
  RiskFlowSection,
  RiskFlowCapsule,
  RiskFlowStepChip,
  RiskFlowBadge,
  RiskFlowEmptyState,
  RiskFlowErrorNote,
  RiskFlowFieldRow,
  RiskFlowProviderModeBadge,
  classifyProviderMode,
} from "./constitutionalRiskFlow/riskFlowSurfaceKit";

interface RiskFlowStateResponse {
  ok: boolean;
  state?: ConstitutionalRiskFlowState;
  error?: string;
}

const STEP_LABELS: Record<ConstitutionalRiskFlowStepId, string> = {
  select: "Select",
  admit: "Admit",
  authorize: "Authorize",
  freeze: "Freeze",
  execute: "Execute",
  quote: "Quote",
  settle: "Settle",
  receipt: "Receipt",
  telemetry: "Telemetry",
};

const STEP_ORDER: ConstitutionalRiskFlowStepId[] = [
  "select", "admit", "authorize", "freeze", "execute", "quote", "settle", "receipt", "telemetry",
];

/**
 * Per-step chip label — derived STRICTLY from the fields the service already
 * returned for that step, never invented at render time. Where the brief's
 * own suggested vocabulary (e.g. "Disclosure: Partial/Blocked",
 * "Settlement: Pending") names a value this chain's real evidence cannot
 * currently produce, the honest actually-derivable label is used instead
 * (documented inline) rather than fabricating a state no code path emits.
 */
function stepChipLabel(state: ConstitutionalRiskFlowState, id: ConstitutionalRiskFlowStepId): string | undefined {
  switch (id) {
    case "select":
      return state.select.state === "complete" ? "Selected" : undefined;
    case "admit":
      // Verbatim AegisAdmissionStatus when known — the real chain vocabulary
      // (ADMITTED/REFUSED/UNRESOLVED), never a paraphrase.
      return state.admit.admissionStatus ?? undefined;
    case "authorize":
      // No "Partial" concept exists on VelaUnderwritingDisclosureAuthorization
      // — a scope is authorized as one whole artifact. Never fabricated.
      return state.authorize.state === "complete" ? "Authorized" : undefined;
    case "freeze":
      return state.freeze.state === "complete" ? "Frozen" : undefined;
    case "execute":
      if (state.execute.state === "not_started") return "Ready";
      if (state.execute.state === "in_progress") return "Executing";
      if (state.execute.state === "unresolved") return "Unresolved";
      return "Complete";
    case "quote": {
      const mode = classifyProviderMode(state.quote.quote?.providerMode ?? null);
      return mode === "unavailable" ? undefined : mode;
    }
    case "settle":
      // Never "Pending" — no code path in this chain produces a genuine
      // in-flight settlement fact today; that would be a fabrication.
      return state.settle.state === "complete" ? "Complete" : "None";
    case "receipt": {
      const statuses = state.receipt.receipts.map((r) => r.receiptStatus);
      if (statuses.includes("dvn_recorded")) return "Anchored";
      if (statuses.includes("dvn_pending")) return "Pending anchor";
      if (statuses.includes("dvn_failed")) return "Anchor failed";
      if (statuses.length > 0) return "Recorded (local)";
      return undefined;
    }
    case "telemetry":
      return state.telemetry.state === "complete" ? "Recorded" : undefined;
    default:
      return undefined;
  }
}

function stepState(state: ConstitutionalRiskFlowState, id: ConstitutionalRiskFlowStepId): ConstitutionalRiskFlowStepState {
  return state[id].state;
}

export function ConstitutionalRiskFlowPanel() {
  const { setActiveRiskFlowRequestRef } = useMoneyPennyNavigation();
  const [requestRefInput, setRequestRefInput] = useState("");
  const [partyInput, setPartyInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<ConstitutionalRiskFlowState | null>(null);

  const load = useCallback(async () => {
    const requestRef = requestRefInput.trim();
    if (!requestRef) return;
    const party = partyInput.trim();
    setLoading(true);
    setError(null);
    try {
      const url = party
        ? `/api/moneypenny/constitutional-risk-flow?requestRef=${encodeURIComponent(requestRef)}&party=${encodeURIComponent(party)}`
        : `/api/moneypenny/constitutional-risk-flow?requestRef=${encodeURIComponent(requestRef)}`;
      const res = await personaFetch(url, { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as RiskFlowStateResponse | null;
      if (!res.ok || !json?.ok || !json.state) {
        throw new Error(json?.error ?? `Failed to load (${res.status})`);
      }
      setState(json.state);
      // Owner ground-context wiring only applies to the caller's OWN chain
      // state — a participant view is scoped to another persona's evidence
      // and must never be folded into this caller's own ground context.
      if (!party) setActiveRiskFlowRequestRef(requestRef);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState(null);
    } finally {
      setLoading(false);
    }
  }, [requestRefInput, partyInput, setActiveRiskFlowRequestRef]);

  return (
    <div className="space-y-4 p-4">
      <RiskFlowSection title="Constitutional Risk Flow">
        <p className="text-xs text-slate-400">
          The causal chain for a private multi-party underwriting request — Factor selection, Aegis
          admission, disclosure authorization, frozen envelope, private Vela execution, quote, settlement,
          receipt and telemetry.
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <input
            type="text"
            value={requestRefInput}
            onChange={(e) => setRequestRefInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void load();
            }}
            placeholder="requestRef"
            className="w-full min-w-[10rem] flex-1 rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:border-emerald-600 focus:outline-none"
          />
          <input
            type="text"
            value={partyInput}
            onChange={(e) => setPartyInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void load();
            }}
            placeholder="party (optional — view as this party)"
            className="w-full min-w-[14rem] flex-1 rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:border-emerald-600 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading || !requestRefInput.trim()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/25 transition disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
            {loading ? "Loading…" : "Load"}
          </button>
        </div>
        {partyInput.trim() && (
          <p className="text-[11px] text-slate-500">
            Viewing as party <span className="text-slate-300">{partyInput.trim()}</span> — confidential
            contributions not disclosed to this party render as a redacted notice rather than their real fields.
          </p>
        )}
        <RiskFlowErrorNote message={error} />
      </RiskFlowSection>

      {!state && !loading && !error && (
        <RiskFlowEmptyState>Enter a request reference to view its constitutional risk flow.</RiskFlowEmptyState>
      )}

      {state && (
        <>
          {/* Journey spine — clickable chip strip, one per step. Wraps at
              narrow widths rather than scrolling the page horizontally. */}
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/40 p-3">
            {STEP_ORDER.map((id, i) => (
              <a key={id} href={`#risk-flow-step-${id}`} className="flex items-center gap-2 text-xs text-slate-300 hover:text-slate-100">
                <span className="text-slate-500">{i + 1}.</span>
                <span>{STEP_LABELS[id]}</span>
                <RiskFlowStepChip state={stepState(state, id)} label={stepChipLabel(state, id)} />
                {i < STEP_ORDER.length - 1 && <span className="text-slate-700">→</span>}
              </a>
            ))}
          </div>

          <div className="space-y-2">
            <div id="risk-flow-step-select">
              <RiskFlowCapsule
                title="Participants & Services"
                badge={<RiskFlowStepChip state={state.select.state} label={stepChipLabel(state, "select")} />}
                defaultOpen
              >
                <p className="text-xs text-slate-400">{state.select.reason}</p>
                {state.select.selectionRef && (
                  <div className="space-y-1">
                    <RiskFlowFieldRow label="Selection ref" value={state.select.selectionRef} />
                    <RiskFlowFieldRow label="Candidate agent" value={state.select.candidateAgentId} />
                    <RiskFlowFieldRow label="Service" value={state.select.serviceId ?? "—"} />
                    <RiskFlowFieldRow label="Counterparty" value={state.select.counterpartyId ?? "—"} />
                    <RiskFlowFieldRow label="Provider mode" value={state.select.providerMode ?? "—"} />
                    {state.select.selectionReason && (
                      <p className="pt-1 text-[11px] text-slate-500">{state.select.selectionReason}</p>
                    )}
                  </div>
                )}
              </RiskFlowCapsule>
            </div>

            <div id="risk-flow-step-admit">
              <RiskFlowCapsule
                title="Admission Evidence"
                badge={<RiskFlowStepChip state={state.admit.state} label={stepChipLabel(state, "admit")} />}
              >
                <p className="text-xs text-slate-400">{state.admit.reason}</p>
                {state.admit.admissionRef && (
                  <div className="space-y-1">
                    <RiskFlowFieldRow label="Admission ref" value={state.admit.admissionRef} />
                    <RiskFlowFieldRow label="Assessment ref" value={state.admit.assessmentRef ?? "—"} />
                    <RiskFlowFieldRow label="Assessment version" value={state.admit.assessmentVersion ?? "—"} />
                    <RiskFlowFieldRow label="Aegis agent" value={state.admit.aegisAgentId ?? "—"} />
                  </div>
                )}
              </RiskFlowCapsule>
            </div>

            <div id="risk-flow-step-authorize">
              <RiskFlowCapsule
                title="Disclosure Scope"
                badge={<RiskFlowStepChip state={state.authorize.state} label={stepChipLabel(state, "authorize")} />}
              >
                <p className="text-xs text-slate-400">{state.authorize.reason}</p>
                {state.authorize.scope && (
                  <div className="space-y-2">
                    <RiskFlowFieldRow label="Authorization ref" value={state.authorize.authorizationRef ?? "—"} />
                    <RiskFlowFieldRow label="Application" value={state.authorize.applicationId ?? "—"} />
                    <RiskFlowFieldRow label="Authorized by" value={state.authorize.authorizedByAgentRef ?? "—"} />
                    <p className="rounded border border-slate-800 bg-slate-950 px-2.5 py-2 text-[11px] text-slate-400">
                      Raw party inputs remain confidential. Only the authorized derived result may be disclosed to
                      a permitted party — never any party&apos;s raw operands.
                    </p>
                    <div className="space-y-1">
                      {state.authorize.scope.grants.map((g, i) => (
                        <div key={i} className="flex items-center gap-2 text-[11px]">
                          <RiskFlowBadge
                            label={g.action === "COMPUTE_WITH" ? "Compute with" : "Disclose to"}
                            tone={g.action === "COMPUTE_WITH" ? "info" : "warn"}
                          />
                          <span className="text-slate-300">{g.party}</span>
                          {g.to && (
                            <>
                              <span className="text-slate-600">→</span>
                              <span className="text-slate-300">{g.to}</span>
                            </>
                          )}
                        </div>
                      ))}
                      {state.authorize.scope.grants.length === 0 && (
                        <p className="text-[11px] text-slate-500">No combination is authorized for this scope.</p>
                      )}
                    </div>
                  </div>
                )}
              </RiskFlowCapsule>
            </div>

            <div id="risk-flow-step-freeze">
              <RiskFlowCapsule
                title="Frozen Envelope"
                badge={<RiskFlowStepChip state={state.freeze.state} label={stepChipLabel(state, "freeze")} />}
              >
                <p className="text-xs text-slate-400">{state.freeze.reason}</p>
                {state.freeze.envelopeRef && (
                  <div className="space-y-1">
                    <RiskFlowFieldRow label="Envelope ref" value={state.freeze.envelopeRef} />
                    <RiskFlowFieldRow label="Application" value={state.freeze.applicationId ?? "—"} />
                    <RiskFlowFieldRow label="Candidate agent" value={state.freeze.candidateAgentId ?? "—"} />
                  </div>
                )}
              </RiskFlowCapsule>
            </div>

            <div id="risk-flow-step-execute">
              <RiskFlowCapsule
                title="Vela Execution"
                badge={<RiskFlowStepChip state={state.execute.state} label={stepChipLabel(state, "execute")} />}
              >
                <p className="text-xs text-slate-400">{state.execute.reason}</p>
                {state.execute.onChainRequestId && (
                  <div className="space-y-3">
                    <div className="space-y-1 rounded border border-slate-800 bg-slate-950 px-2.5 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">Constitutional evidence (MoneyPenny&apos;s own authorization trail)</p>
                      <RiskFlowFieldRow label="Selection ref" value={state.select.selectionRef ?? "—"} />
                      <RiskFlowFieldRow label="Admission ref" value={state.admit.admissionRef ?? "—"} />
                      <RiskFlowFieldRow label="Disclosure authorization ref" value={state.authorize.authorizationRef ?? "—"} />
                      <RiskFlowFieldRow label="Envelope ref" value={state.freeze.envelopeRef ?? "—"} />
                    </div>
                    <div className="space-y-1 rounded border border-slate-800 bg-slate-950 px-2.5 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">Vela execution evidence</p>
                      <RiskFlowFieldRow label="On-chain request id" value={state.execute.onChainRequestId} />
                      <RiskFlowFieldRow label="Disposition" value={state.execute.disposition ?? "—"} />
                      <RiskFlowFieldRow
                        label="Provider mode"
                        value={<RiskFlowProviderModeBadge mode={classifyProviderMode(state.execute.providerMode)} />}
                      />
                      <p className="pt-1 text-[11px] text-slate-500">
                        No environment-trust/attestation evidence field exists on this receipt today — this
                        codebase carries none for this seam yet, so none is shown here rather than a fabricated
                        badge.
                      </p>
                    </div>
                  </div>
                )}
              </RiskFlowCapsule>
            </div>

            <div id="risk-flow-step-quote">
              <RiskFlowCapsule
                title="Risk & Coverage Quote"
                badge={<RiskFlowStepChip state={state.quote.state} label={stepChipLabel(state, "quote")} />}
              >
                <p className="text-xs text-slate-400">{state.quote.reason}</p>
                {state.quote.quote && (
                  <div className="space-y-2">
                    <RiskFlowProviderModeBadge mode={classifyProviderMode(state.quote.quote.providerMode)} />
                    <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                      <RiskFlowFieldRow label="Risk band" value={state.quote.quote.riskBand} />
                      <RiskFlowFieldRow label="Risk of repair" value={state.quote.quote.riskOfRepair} />
                      <RiskFlowFieldRow label="Estimated exposure" value={state.quote.quote.estimatedExposure ?? "—"} />
                      <RiskFlowFieldRow label="Coverage eligible" value={state.quote.quote.coverageEligible ? "Yes" : "No"} />
                      <RiskFlowFieldRow label="Coverage limit" value={state.quote.quote.coverageLimit} />
                      <RiskFlowFieldRow label="Premium" value={state.quote.quote.premium} />
                      <RiskFlowFieldRow label="Confidence" value={state.quote.quote.confidence} />
                    </div>
                    {state.quote.quote.conditions.length > 0 && (
                      <div className="space-y-0.5">
                        {state.quote.quote.conditions.map((c, i) => (
                          <p key={i} className="text-[11px] text-slate-500">· {c}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </RiskFlowCapsule>
            </div>

            <div id="risk-flow-step-settle">
              <RiskFlowCapsule
                title="Settlement"
                badge={<RiskFlowStepChip state={state.settle.state} label={stepChipLabel(state, "settle")} />}
              >
                <p className="text-xs text-slate-400">
                  {/* Participant view carries an explicit `visible` field the
                      operator/global state never has — check it FIRST so a
                      redacted step's own fixed reason string (item 10b) is
                      never swallowed by the settlementOccurred===null
                      fallback below, which exists only for the honest
                      "no evidence yet" operator-view case. Byte-identical to
                      the pre-10b behavior when `visible` is absent. */}
                  {"visible" in state.settle && state.settle.visible === false
                    ? state.settle.reason
                    : state.settle.settlementOccurred === null
                      ? "No settlement receipt exists for this request."
                      : state.settle.reason}
                </p>
              </RiskFlowCapsule>
            </div>

            <div id="risk-flow-step-receipt">
              <RiskFlowCapsule
                title="Causal Receipt"
                badge={<RiskFlowStepChip state={state.receipt.state} label={stepChipLabel(state, "receipt")} />}
              >
                <p className="text-xs text-slate-400">{state.receipt.reason}</p>
                {state.receipt.receipts.length > 0 && (
                  <div className="space-y-1">
                    {state.receipt.receipts.map((r) => (
                      <div key={r.receiptId} className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="text-slate-400">{r.actionType}</span>
                        <RiskFlowBadge
                          label={r.receiptStatus}
                          tone={
                            r.receiptStatus === "dvn_recorded"
                              ? "good"
                              : r.receiptStatus === "dvn_failed"
                                ? "bad"
                                : r.receiptStatus === "dvn_pending"
                                  ? "warn"
                                  : "neutral"
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}
              </RiskFlowCapsule>
            </div>

            <div id="risk-flow-step-telemetry">
              <RiskFlowCapsule
                title="Constitutional Risk Telemetry"
                badge={<RiskFlowStepChip state={state.telemetry.state} label={stepChipLabel(state, "telemetry")} />}
              >
                <p className="text-xs text-slate-400">{state.telemetry.reason}</p>
                {state.telemetry.telemetryRecordId && (
                  <RiskFlowFieldRow label="Telemetry record" value={state.telemetry.telemetryRecordId} />
                )}
              </RiskFlowCapsule>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default ConstitutionalRiskFlowPanel;
