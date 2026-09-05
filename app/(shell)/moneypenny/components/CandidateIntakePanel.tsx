/**
 * CandidateIntakePanel — MoneyPenny "Operate" capability, Factor/Aegis
 * candidate CASE workspace (operator directive 2026-09-05: upgrade from a
 * one-shot specialist consultation into a case-aware, conversational and
 * operational workflow).
 *
 * This panel is the ONE UI for Factor's candidate-intake case lifecycle and
 * Aegis's independent assessment lifecycle. It calls the REAL, existing
 * REST surfaces directly for every domain action:
 *   - app/api/moneypenny/factor/cases/**            (case lifecycle, evidence)
 *   - app/api/moneypenny/factor/authority-chains/**  (authority-chain status)
 *   - app/api/moneypenny/aegis/assessments/**        (assessment lifecycle, findings, ratify)
 *   - app/api/moneypenny/factor/cases/[id]/decide-admission (MoneyPenny's
 *     OWN admission decision — this panel lives inside the MoneyPenny
 *     cartridge, so rendering this action here IS MoneyPenny's admission
 *     authority surface, never Factor's or Aegis's)
 *
 * It never recreates any state machine client-side — every transition
 * button only OFFERS a target state the server's own FORWARD_TRANSITIONS
 * table (services/factor/factorCaseService.ts) already allows for the
 * CURRENT state; the server remains the sole enforcer and can still refuse.
 *
 * Generic, exploratory advice still goes through the SAME
 * /api/assistant/ask-agent path every other specialist consult in this
 * codebase uses (never forked) — via services/moneypenny/
 * caseContextConsultation.ts, a thin adapter that prefixes the operator's
 * question with a bounded case-context block so the advice is grounded.
 * This consult path is advisory only: it can never decide admission or
 * mutate case/assessment state, and every response rendered from it is
 * tagged "Advisory guidance" so it can never be confused with one of this
 * panel's real, REST-backed domain actions (requirement 7's "case-context
 * consultation adapter" separation).
 *
 * Conversation: no single existing chat-thread primitive fits this shape
 * (confirmed by direct investigation — SmartTriadCopilotLayer's own
 * SmartTriadMessage carries no specialist-attribution field and its append
 * logic is not exported/reusable outside that file; see this session's own
 * report). This panel keeps its OWN small, local, append-only `turns[]`
 * array rendered through the SAME SpecialistResponseCard every other
 * specialist response in this codebase renders with (confirmed
 * safe-to-repeat from its Props signature) — not a second card system, not
 * a second LLM-calling path, just the minimal ordering state needed to
 * stack that one existing card component into a scrollback.
 *
 * Spine-authenticated via personaFetch throughout (CLAUDE.md PARAMOUNT).
 * Shares its active case with the left-pane MoneyPenny copilot via
 * MoneyPennyNavigationContext (moneyPennyNavigation.tsx) so both panes
 * resolve to the same caseId (requirement 3).
 */

"use client";

import { useCallback, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, RotateCcw, ShieldAlert, ArrowRight } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";
import { SpecialistResponseCard, type SpecialistResponseData } from "@/components/metame/cards/SpecialistResponseCard";
import { useMoneyPennyNavigation, readAndClearPendingSpecialist } from "./moneyPennyNavigation";
import { askCaseContextSpecialist, type CaseConsultationContext } from "@/services/moneypenny/caseContextConsultation";

// ─────────────────────────────────────────────────────────────────────────
// Local type mirrors of the server's shapes (this codebase's established
// pattern — e.g. RiskEnvelopePanel.tsx does the same rather than importing
// types from a service file that also pulls in server-only modules).
// Keep in sync with services/factor/factorCaseService.ts and
// services/aegis/aegisAssessmentService.ts if either changes.
// ─────────────────────────────────────────────────────────────────────────

type FactorCaseState =
  | "discovered"
  | "preparing"
  | "assessment_pending"
  | "assessment_in_progress"
  | "evidence_remediation"
  | "assessment_complete"
  | "registry_ready"
  | "admission_pending"
  | "admitted"
  | "conditionally_admitted"
  | "rejected"
  | "activation_pending"
  | "active"
  | "paused";

interface FactorCaseRow {
  case_id: string;
  tenant_id: string;
  candidate_identity_key: string;
  candidate_display_name: string;
  candidate_agent_root_did: string | null;
  source: string;
  pathway: string;
  state: FactorCaseState;
  paused_from_state: string | null;
  authority_chain_id: string | null;
  created_at: string;
  updated_at: string;
}

type FactorEvidenceStatus = "missing" | "requested" | "supplied" | "stale" | "contradicted";

interface FactorEvidenceItem {
  evidence_item_id: string;
  kind: string;
  status: FactorEvidenceStatus;
  source_ref: string | null;
  created_at: string;
}

interface FactorCaseEvent {
  event_id: string;
  event_type: string;
  from_state: string | null;
  to_state: string | null;
  actor_persona_id: string;
  created_at: string;
}

type AegisAssessmentState = "draft" | "evidence_locked" | "running" | "review_required" | "ratified" | "failed";
type AegisDecision = "admissible" | "admissible_with_conditions" | "insufficient_evidence" | "not_admissible";
type AegisFindingResult = "pass" | "fail" | "inconclusive";

interface AegisAssessmentRow {
  assessment_id: string;
  subject_ref: string;
  state: AegisAssessmentState;
  decision: AegisDecision | null;
  requested_by_agent_ref: string;
  assessed_by_agent_ref: string;
  rationale: string | null;
  created_at: string;
  ratified_at: string | null;
}

interface AegisFinding {
  finding_id: string;
  dimension: string;
  claim: string;
  method: string;
  result: AegisFindingResult;
  confidence: number;
  falsification_condition: string;
  is_critical: boolean;
}

// Matches services/aegis/aegisAssessmentService.ts's test-suite convention
// (tests/aegis-assessment-service.test.ts) — no exported policy-version
// constant exists yet in that service, so this is the closest thing to an
// established value rather than an invented one.
const AEGIS_POLICY_VERSION = "aegis-policy-v1";
const REQUESTING_AGENT_REF = "aigent-factor";
// No persona->tenant mapping exists yet in this codebase (see
// app/api/moneypenny/factor/_lib/respondError.ts's own comment) — every
// route defaults to this same literal, never fabricated per-persona here.
const TENANT_ID = "default";

// Client-side presentation labels for the server's own FORWARD_TRANSITIONS
// table (services/factor/factorCaseService.ts) — offers only the buttons
// the server would actually allow for the CURRENT state; the server alone
// enforces and can still refuse (concurrent-transition, terminal-state).
const CASE_ADVANCE_OPTIONS: Partial<Record<FactorCaseState, { to: FactorCaseState; label: string }[]>> = {
  discovered: [{ to: "preparing", label: "Begin preparing case" }],
  preparing: [{ to: "assessment_pending", label: "Mark ready for assessment" }],
  assessment_pending: [{ to: "assessment_in_progress", label: "Begin assessment intake" }],
  assessment_in_progress: [
    { to: "evidence_remediation", label: "Send back for evidence remediation" },
    { to: "assessment_complete", label: "Mark assessment complete" },
  ],
  evidence_remediation: [{ to: "assessment_pending", label: "Evidence resupplied — re-request assessment" }],
  assessment_complete: [{ to: "registry_ready", label: "Mark registry-ready" }],
  registry_ready: [{ to: "admission_pending", label: "Send to admission review" }],
  admitted: [{ to: "activation_pending", label: "Begin activation" }],
  conditionally_admitted: [{ to: "activation_pending", label: "Begin activation" }],
  activation_pending: [{ to: "active", label: "Mark active" }],
};

const CASE_STATE_LABELS: Record<FactorCaseState, string> = {
  discovered: "Discovered",
  preparing: "Preparing",
  assessment_pending: "Assessment pending",
  assessment_in_progress: "Assessment in progress",
  evidence_remediation: "Evidence remediation",
  assessment_complete: "Assessment complete",
  registry_ready: "Registry ready",
  admission_pending: "Admission pending",
  admitted: "Admitted",
  conditionally_admitted: "Conditionally admitted",
  rejected: "Rejected",
  activation_pending: "Activation pending",
  active: "Active",
  paused: "Paused",
};

// ─────────────────────────────────────────────────────────────────────────
// Six-state status vocabulary (requirement 6) — used everywhere this panel
// shows an outcome or a pending affordance, so "advisory" is never
// confused with "completed", "refused" with "blocked", etc.
// ─────────────────────────────────────────────────────────────────────────

type StatusKind = "advisory" | "proposed" | "approval" | "completed" | "refused" | "blocked" | "error";

const STATUS_META: Record<StatusKind, { label: string; className: string }> = {
  advisory: { label: "Advisory guidance", className: "border-sky-700/60 bg-sky-500/10 text-sky-200" },
  proposed: { label: "Proposed action", className: "border-slate-700 bg-slate-800/60 text-slate-300" },
  approval: { label: "Approval required", className: "border-amber-700/60 bg-amber-500/10 text-amber-200" },
  completed: { label: "Completed", className: "border-emerald-700/60 bg-emerald-500/10 text-emerald-200" },
  refused: { label: "Refused", className: "border-rose-700/60 bg-rose-500/10 text-rose-200" },
  blocked: { label: "Blocked", className: "border-orange-700/60 bg-orange-500/10 text-orange-200" },
  error: { label: "Error", className: "border-slate-600 bg-slate-800/60 text-slate-300" },
};

function StatusBadge({ kind }: { kind: StatusKind }) {
  const meta = STATUS_META[kind];
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.className}`}>
      {meta.label}
    </span>
  );
}

// Constitutional/structural refusal codes (services/factor/*, services/
// aegis/*, services/moneypenny/admissionAuthority.ts) vs. state/policy
// gates vs. plain errors — see each service file's own error `.code`
// values; this mapping decides ONLY which status badge best carries the
// meaning, it never re-derives the refusal reason itself (mirrors
// app/api/moneypenny/factor/_lib/respondError.ts's own HTTP-status mapping).
const REFUSED_CODES = new Set([
  "self-assessment-refused",
  "admission-requires-moneypenny-authority",
  "subdelegation-not-permitted",
  "no-active-delegation-grant",
  "cross-tenant-denied",
  "cross-principal-denied",
]);
const BLOCKED_CODES = new Set([
  "critical-failure-blocks-admission",
  "not-admission-pending",
  "no-ratified-assessment",
  "assessment-does-not-support-decision",
  "terminal-state",
  "invalid-transition",
  "assessment-closed",
  "concurrent-transition",
]);

function classifyApiError(code: string | null): StatusKind {
  if (code && REFUSED_CODES.has(code)) return "refused";
  if (code && BLOCKED_CODES.has(code)) return "blocked";
  return "error";
}

interface ApiOutcome {
  ok: boolean;
  data: Record<string, unknown> | null;
  code: string | null;
  detail: string;
}

async function callApi(url: string, init?: RequestInit): Promise<ApiOutcome> {
  try {
    const res = await personaFetch(url, init);
    const json = await res.json().catch(() => null);
    if (!res.ok || !json || (json as Record<string, unknown>).ok === false) {
      const code = json && typeof (json as Record<string, unknown>).error === "string" ? ((json as Record<string, unknown>).error as string) : null;
      const detail =
        json && typeof (json as Record<string, unknown>).detail === "string"
          ? ((json as Record<string, unknown>).detail as string)
          : (code ?? `Request failed (HTTP ${res.status}).`);
      return { ok: false, data: null, code, detail };
    }
    return { ok: true, data: json as Record<string, unknown>, code: null, detail: "" };
  } catch (err) {
    return { ok: false, data: null, code: null, detail: err instanceof Error ? err.message : String(err) };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Conversation — a plain, local, append-only turn list (see this file's
// own header for why no existing chat-thread primitive fits).
// ─────────────────────────────────────────────────────────────────────────

interface ConsultTurn {
  id: string;
  specialist: "factor" | "aegis";
  prompt: string;
  response: SpecialistResponseData | null;
  error: string | null;
  errorKind: StatusKind | null;
  loading: boolean;
  timestamp: string;
  /** true when routed through the case-context adapter (grounded in the
   *  active case); false for a plain generic consult. Both are advisory. */
  caseGrounded: boolean;
  /** Client-classified refusal — set when the operator's own prompt asked
   *  Factor to admit a candidate directly (requirement 5). Rendered as a
   *  Refused card with a typed "Refer to MoneyPenny" action, WITHOUT
   *  making a network call — Factor has no admission-write action to even
   *  ask the server for. */
  factorAdmissionRefusal: boolean;
}

const FACTOR_ADMIT_PATTERN = /\b(admit|approve|accept)\b.{0,30}\bcandidate\b|\badmit\s+(this|the)\s+candidate\b/i;

function newTurnId(): string {
  return `turn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────

interface ActionOutcome {
  kind: StatusKind;
  message: string;
}

export function CandidateIntakePanel() {
  const { setActiveCase: setSharedActiveCase } = useMoneyPennyNavigation();

  // No-case empty state / find-or-open / create.
  const [candidateKey, setCandidateKey] = useState("");
  const [candidateName, setCandidateName] = useState("");
  const [openCaseBusy, setOpenCaseBusy] = useState(false);
  const [openCaseError, setOpenCaseError] = useState<string | null>(null);
  const [openCaseNote, setOpenCaseNote] = useState<string | null>(null);

  // Active case + its dependent state.
  const [activeCase, setActiveCaseState] = useState<FactorCaseRow | null>(null);
  const [evidence, setEvidence] = useState<FactorEvidenceItem[]>([]);
  const [events, setEvents] = useState<FactorCaseEvent[]>([]);
  const [assessment, setAssessment] = useState<AegisAssessmentRow | null>(null);
  const [findings, setFindings] = useState<AegisFinding[]>([]);
  const [caseBusy, setCaseBusy] = useState(false);
  const [caseError, setCaseError] = useState<string | null>(null);

  // Per-action transient outcome, keyed by a stable action id.
  const [actionBusy, setActionBusy] = useState<Record<string, boolean>>({});
  const [actionOutcome, setActionOutcome] = useState<Record<string, ActionOutcome | null>>({});
  const [confirming, setConfirming] = useState<string | null>(null);

  // Evidence add/update form.
  const [evidenceKind, setEvidenceKind] = useState("");
  const [evidenceStatus, setEvidenceStatus] = useState<FactorEvidenceStatus>("supplied");

  // Finding add form.
  const [findingDimension, setFindingDimension] = useState("");
  const [findingClaim, setFindingClaim] = useState("");
  const [findingMethod, setFindingMethod] = useState("");
  const [findingResult, setFindingResult] = useState<AegisFindingResult>("pass");
  const [findingCritical, setFindingCritical] = useState(false);
  const [findingFalsification, setFindingFalsification] = useState("");

  // Ratify form.
  const [ratifyDecision, setRatifyDecision] = useState<AegisDecision>("admissible");
  const [ratifyRationale, setRatifyRationale] = useState("");

  // Conversation. Defaults to "factor" unless a Home specialist card just
  // navigated here with a specific selection (requirement 2, 2026-09-05) —
  // read once, on this panel's own mount, then cleared, never re-read on a
  // later re-render of this same mount (that read-once-then-clear is what
  // readAndClearPendingSpecialist itself already guarantees).
  const [specialist, setSpecialist] = useState<"factor" | "aegis">(() =>
    readAndClearPendingSpecialist() === "aegis" ? "aegis" : "factor",
  );
  const [turns, setTurns] = useState<ConsultTurn[]>([]);
  const [composerText, setComposerText] = useState("");
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const admissionSectionRef = useRef<HTMLDivElement | null>(null);

  const caseId = activeCase?.case_id ?? null;

  // ── Refresh — the ONE function that reloads canonical state for the
  // active case (case, evidence, current assessment+findings, activity
  // events), restoring state on reopen/refresh (requirement 8). ──────────
  const refreshCase = useCallback(async (targetCaseId: string) => {
    setCaseBusy(true);
    setCaseError(null);
    try {
      const [caseRes, eventsRes] = await Promise.all([
        callApi(`/api/moneypenny/factor/cases/${targetCaseId}?tenantId=${TENANT_ID}`),
        callApi(`/api/moneypenny/factor/cases/${targetCaseId}/events?tenantId=${TENANT_ID}`),
      ]);
      if (!caseRes.ok) {
        setCaseError(caseRes.detail);
        return;
      }
      const c = caseRes.data!.case as FactorCaseRow;
      setActiveCaseState(c);
      setEvidence((caseRes.data!.evidence as FactorEvidenceItem[]) ?? []);
      const a = (caseRes.data!.assessment as AegisAssessmentRow | null) ?? null;
      setAssessment(a);
      setFindings((caseRes.data!.findings as AegisFinding[]) ?? []);
      setEvents(eventsRes.ok ? ((eventsRes.data!.events as FactorCaseEvent[]) ?? []) : []);
      setSharedActiveCase({
        caseId: c.case_id,
        candidateDisplayName: c.candidate_display_name,
        state: c.state,
        currentAegisDecision: a?.decision ?? null,
      });
    } finally {
      setCaseBusy(false);
    }
  }, [setSharedActiveCase]);

  const openOrCreateCase = useCallback(async () => {
    const key = candidateKey.trim();
    const name = candidateName.trim();
    if (!key || !name) {
      setOpenCaseError("Both a candidate identifier and a display name are required.");
      return;
    }
    setOpenCaseBusy(true);
    setOpenCaseError(null);
    setOpenCaseNote(null);
    const result = await callApi("/api/moneypenny/factor/cases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId: TENANT_ID, candidateIdentityKey: key, candidateDisplayName: name }),
    });
    setOpenCaseBusy(false);
    if (!result.ok) {
      setOpenCaseError(result.detail);
      return;
    }
    const c = result.data!.case as FactorCaseRow;
    setOpenCaseNote(result.data!.created ? `Created a new candidate case for ${c.candidate_display_name}.` : `Resumed the existing case for ${c.candidate_display_name}.`);
    await refreshCase(c.case_id);
  }, [candidateKey, candidateName, refreshCase]);

  const closeCase = useCallback(() => {
    setActiveCaseState(null);
    setEvidence([]);
    setEvents([]);
    setAssessment(null);
    setFindings([]);
    setSharedActiveCase(null);
    setCandidateKey("");
    setCandidateName("");
    setOpenCaseNote(null);
    setActionBusy({});
    setActionOutcome({});
    setConfirming(null);
    setTurns([]);
  }, [setSharedActiveCase]);

  // ── Generic action runner: sets per-action loading, classifies the
  // outcome into the six-state vocabulary, refreshes case state on
  // success. Never renders a control this can't actually reach — every
  // caller below only invokes this from a button that already checked its
  // own preconditions (case state, assessment state). ────────────────────
  // Returns whether the action succeeded — callers that gate a confirm
  // step on this action (ratify, decide-admission) must only dismiss that
  // step on success; dismissing it unconditionally would unmount the very
  // ActionButton that renders this action's Refused/Blocked outcome badge
  // before the operator ever sees it.
  const runAction = useCallback(
    async (actionId: string, request: () => Promise<ApiOutcome>, successMessage: string): Promise<boolean> => {
      setActionBusy((s) => ({ ...s, [actionId]: true }));
      setActionOutcome((s) => ({ ...s, [actionId]: null }));
      const result = await request();
      setActionBusy((s) => ({ ...s, [actionId]: false }));
      if (!result.ok) {
        setActionOutcome((s) => ({ ...s, [actionId]: { kind: classifyApiError(result.code), message: result.detail } }));
        return false;
      }
      setActionOutcome((s) => ({ ...s, [actionId]: { kind: "completed", message: successMessage } }));
      if (caseId) await refreshCase(caseId);
      return true;
    },
    [caseId, refreshCase],
  );

  const advanceCase = useCallback(
    (toState: FactorCaseState, label: string) => {
      if (!caseId) return;
      void runAction(
        `advance-${toState}`,
        () =>
          callApi(`/api/moneypenny/factor/cases/${caseId}/transition`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tenantId: TENANT_ID, action: "advance", toState }),
          }),
        `${label} — done.`,
      );
    },
    [caseId, runAction],
  );

  const pauseOrResumeCase = useCallback(
    (action: "pause" | "resume") => {
      if (!caseId) return;
      void runAction(
        action,
        () =>
          callApi(`/api/moneypenny/factor/cases/${caseId}/transition`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tenantId: TENANT_ID, action }),
          }),
        action === "pause" ? "Case paused." : "Case resumed.",
      );
    },
    [caseId, runAction],
  );

  const addEvidence = useCallback(() => {
    if (!caseId || !evidenceKind.trim()) return;
    void runAction(
      "add-evidence",
      () =>
        callApi(`/api/moneypenny/factor/cases/${caseId}/evidence`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenantId: TENANT_ID, kind: evidenceKind.trim(), status: evidenceStatus }),
        }),
      `Evidence "${evidenceKind.trim()}" recorded.`,
    );
    setEvidenceKind("");
  }, [caseId, evidenceKind, evidenceStatus, runAction]);

  const revokeAuthorityChain = useCallback(() => {
    if (!activeCase?.authority_chain_id) return;
    void runAction(
      "revoke-chain",
      () =>
        callApi(`/api/moneypenny/factor/authority-chains/${activeCase.authority_chain_id}/revoke`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "revoked from Candidate Intake workspace" }),
        }),
      "Authority chain revoked.",
    );
  }, [activeCase, runAction]);

  const requestAssessment = useCallback(() => {
    if (!caseId || !activeCase) return;
    void runAction(
      "request-assessment",
      () =>
        callApi("/api/moneypenny/aegis/assessments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subjectType: "factor_case",
            subjectRef: caseId,
            caseId,
            policyVersion: AEGIS_POLICY_VERSION,
            // Structural, never free-text-derived (requirement 5): the
            // requester is ALWAYS Factor's own agent ref, the subject is
            // ALWAYS the case id — these can never collide, so the
            // self-assessment refusal cannot fire from this button by
            // construction. It remains wired (see classifyApiError) as
            // defense-in-depth and is proven by a direct API-level test.
            requestedByAgentRef: REQUESTING_AGENT_REF,
            evidenceSnapshot: { items: evidence.map((e) => ({ kind: e.kind, status: e.status, sourceRef: e.source_ref })) },
          }),
        }),
      "Independent Aegis assessment requested.",
    );
  }, [caseId, activeCase, evidence, runAction]);

  const transitionAssessment = useCallback(
    (action: "begin-running" | "require-review" | "fail") => {
      if (!assessment) return;
      void runAction(
        `assessment-${action}`,
        () =>
          callApi(`/api/moneypenny/aegis/assessments/${assessment.assessment_id}/transition`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action, reason: action === "fail" ? "failed from Candidate Intake workspace" : undefined }),
          }),
        action === "begin-running" ? "Assessment running." : action === "require-review" ? "Assessment sent for review." : "Assessment failed.",
      );
    },
    [assessment, runAction],
  );

  const addFinding = useCallback(() => {
    if (!assessment || !findingDimension.trim() || !findingClaim.trim() || !findingMethod.trim() || !findingFalsification.trim()) return;
    void runAction(
      "add-finding",
      () =>
        callApi(`/api/moneypenny/aegis/assessments/${assessment.assessment_id}/findings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dimension: findingDimension.trim(),
            claim: findingClaim.trim(),
            method: findingMethod.trim(),
            result: findingResult,
            confidence: 0.8,
            falsificationCondition: findingFalsification.trim(),
            isCritical: findingCritical,
          }),
        }),
      `Finding "${findingDimension.trim()}" recorded.`,
    );
    setFindingDimension("");
    setFindingClaim("");
    setFindingMethod("");
    setFindingFalsification("");
    setFindingCritical(false);
    setFindingResult("pass");
  }, [assessment, findingDimension, findingClaim, findingMethod, findingResult, findingCritical, findingFalsification, runAction]);

  const ratifyAssessment = useCallback(async () => {
    if (!assessment) return;
    const succeeded = await runAction(
      "ratify",
      () =>
        callApi(`/api/moneypenny/aegis/assessments/${assessment.assessment_id}/ratify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision: ratifyDecision, rationale: ratifyRationale.trim() || undefined }),
        }),
      `Assessment ratified: ${ratifyDecision}.`,
    );
    // Only dismiss the confirm step on success — a refusal/block must stay
    // visible (see runAction's own comment) so the operator sees why.
    if (succeeded) setConfirming(null);
  }, [assessment, ratifyDecision, ratifyRationale, runAction]);

  const decideAdmission = useCallback(
    async (decision: "admitted" | "conditionally_admitted" | "rejected") => {
      if (!caseId) return;
      const succeeded = await runAction(
        `decide-${decision}`,
        () =>
          callApi(`/api/moneypenny/factor/cases/${caseId}/decide-admission`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tenantId: TENANT_ID, decision }),
          }),
        `MoneyPenny decided: ${decision.replace(/_/g, " ")}.`,
      );
      if (succeeded) setConfirming(null);
    },
    [caseId, runAction],
  );

  // ── Conversation ────────────────────────────────────────────────────────

  const scrollToAdmission = useCallback(() => {
    admissionSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const runConsult = useCallback(
    async (turnId: string, spec: "factor" | "aegis", prompt: string, caseGrounded: boolean) => {
      setTurns((prev) => prev.map((t) => (t.id === turnId ? { ...t, loading: true, error: null } : t)));
      let data: SpecialistResponseData | null = null;
      let error: string | null = null;
      if (caseGrounded && activeCase) {
        const ctx: CaseConsultationContext = {
          caseId: activeCase.case_id,
          candidateDisplayName: activeCase.candidate_display_name,
          state: activeCase.state,
          currentAssessmentId: assessment?.assessment_id ?? null,
          currentAegisDecision: assessment?.decision ?? null,
        };
        const result = await askCaseContextSpecialist(spec, prompt, ctx);
        data = result.data;
        error = result.error;
      } else {
        const result = await callApi("/api/assistant/ask-agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ specialistId: spec, prompt, cartridge: "moneypenny" }),
        });
        data = result.ok ? (result.data as unknown as SpecialistResponseData) : null;
        error = result.ok ? null : result.detail;
      }
      setTurns((prev) => prev.map((t) => (t.id === turnId ? { ...t, loading: false, response: data, error, errorKind: error ? "error" : null } : t)));
    },
    [activeCase, assessment],
  );

  const submitComposer = useCallback(() => {
    const text = composerText.trim();
    if (!text) return;
    const factorAdmissionRefusal = specialist === "factor" && FACTOR_ADMIT_PATTERN.test(text);
    const turnId = newTurnId();
    const turn: ConsultTurn = {
      id: turnId,
      specialist,
      prompt: text,
      response: null,
      error: null,
      errorKind: null,
      loading: !factorAdmissionRefusal,
      timestamp: new Date().toISOString(),
      caseGrounded: Boolean(activeCase),
      factorAdmissionRefusal,
    };
    setTurns((prev) => [...prev, turn]);
    setComposerText("");
    if (!factorAdmissionRefusal) {
      void runConsult(turnId, specialist, text, Boolean(activeCase));
    }
  }, [composerText, specialist, activeCase, runConsult]);

  const retryTurn = useCallback(
    (turnId: string) => {
      const turn = turns.find((t) => t.id === turnId);
      if (!turn) return;
      void runConsult(turnId, turn.specialist, turn.prompt, turn.caseGrounded);
    },
    [turns, runConsult],
  );

  const newConversation = useCallback(() => setTurns([]), []);

  const askFollowUp = useCallback(() => {
    composerRef.current?.focus();
  }, []);

  const onComposerKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submitComposer();
      }
    },
    [submitComposer],
  );

  const advanceOptions = useMemo(() => (activeCase ? (CASE_ADVANCE_OPTIONS[activeCase.state] ?? []) : []), [activeCase]);

  // ── Render ───────────────────────────────────────────────────────────────

  if (!activeCase) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <Card className="bg-slate-900/40 border-slate-800">
          <CardHeader>
            <CardTitle className="text-slate-100">Candidate Intake — Aigent Factor &amp; Aegis</CardTitle>
            <CardDescription className="text-slate-400">
              No candidate case is open. Find an existing case by its candidate identifier, or open a new one — the same
              action resumes an existing case for that identifier instead of duplicating it.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm text-slate-300">
              Candidate identifier
              <input
                value={candidateKey}
                onChange={(e) => setCandidateKey(e.target.value)}
                placeholder="e.g. did:example:candidate-42 or an internal key"
                className="rounded-lg border border-slate-800 bg-slate-900/60 p-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-500/60 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-300">
              Candidate display name
              <input
                value={candidateName}
                onChange={(e) => setCandidateName(e.target.value)}
                placeholder="e.g. Nakamoto Relay Agent"
                className="rounded-lg border border-slate-800 bg-slate-900/60 p-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-500/60 focus:outline-none"
              />
            </label>
            <div>
              <button
                type="button"
                onClick={openOrCreateCase}
                disabled={openCaseBusy}
                className="inline-flex items-center gap-2 rounded-full border border-violet-500/70 bg-violet-500/10 px-4 py-1.5 text-sm text-violet-100 hover:bg-violet-500/20 disabled:opacity-50"
              >
                {openCaseBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                Find or open case
              </button>
            </div>
            {openCaseError && <p className="text-sm text-rose-300">{openCaseError}</p>}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {openCaseNote && <p className="text-xs text-emerald-300">{openCaseNote}</p>}

      {/* Active case summary */}
      <Card className="bg-slate-900/40 border-slate-800">
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-slate-100">{activeCase.candidate_display_name}</CardTitle>
            <CardDescription className="text-slate-400">
              Case {activeCase.case_id.slice(0, 8)}… · identifier {activeCase.candidate_identity_key}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="border-violet-700/60 bg-violet-500/10 text-violet-200">{CASE_STATE_LABELS[activeCase.state]}</Badge>
            <button type="button" onClick={closeCase} className="text-xs text-slate-400 hover:text-slate-200">
              Close case
            </button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {caseError && <p className="text-sm text-rose-300">{caseError}</p>}

          {/* Real, typed case actions — pause/resume/advance. */}
          <div className="flex flex-wrap items-center gap-2">
            {activeCase.state !== "paused" && activeCase.state !== "rejected" && activeCase.state !== "active" && (
              <ActionButton id="pause" label="Pause case" busy={actionBusy} outcome={actionOutcome} onClick={() => pauseOrResumeCase("pause")} />
            )}
            {activeCase.state === "paused" && <ActionButton id="resume" label="Resume case" busy={actionBusy} outcome={actionOutcome} onClick={() => pauseOrResumeCase("resume")} />}
            {advanceOptions.map((opt) => (
              <ActionButton key={opt.to} id={`advance-${opt.to}`} label={opt.label} busy={actionBusy} outcome={actionOutcome} onClick={() => advanceCase(opt.to, opt.label)} />
            ))}
          </div>

          {/* Evidence checklist */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-3">
            <h4 className="mb-2 text-sm font-medium text-slate-200">
              Evidence checklist <span className="text-slate-500">({evidence.length})</span>
            </h4>
            {evidence.length === 0 ? (
              <p className="text-xs text-slate-500">No evidence recorded yet.</p>
            ) : (
              <ul className="mb-2 flex flex-col gap-1">
                {evidence.map((e) => (
                  <li key={e.evidence_item_id} className="flex items-center justify-between text-xs text-slate-300">
                    <span>{e.kind}</span>
                    <Badge className="border-slate-700 bg-slate-800/60 text-slate-300">{e.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={evidenceKind}
                onChange={(e) => setEvidenceKind(e.target.value)}
                placeholder="Evidence kind (e.g. capability_declaration)"
                className="min-w-[220px] flex-1 rounded-lg border border-slate-800 bg-slate-900/60 p-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-violet-500/60 focus:outline-none"
              />
              <select
                value={evidenceStatus}
                onChange={(e) => setEvidenceStatus(e.target.value as FactorEvidenceStatus)}
                className="rounded-lg border border-slate-800 bg-slate-900/60 p-1.5 text-xs text-slate-100"
              >
                {(["missing", "requested", "supplied", "stale", "contradicted"] as FactorEvidenceStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <ActionButton id="add-evidence" label="Add / update evidence" busy={actionBusy} outcome={actionOutcome} onClick={addEvidence} disabled={!evidenceKind.trim()} />
            </div>
          </div>

          {/* Authority-chain status */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-3">
            <h4 className="mb-1 text-sm font-medium text-slate-200">Authority chain</h4>
            {activeCase.authority_chain_id ? (
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>Chain {activeCase.authority_chain_id.slice(0, 8)}… active</span>
                <ActionButton id="revoke-chain" label="Revoke chain" busy={actionBusy} outcome={actionOutcome} onClick={revokeAuthorityChain} />
              </div>
            ) : (
              <p className="text-xs text-slate-500">No authority chain established for this case yet.</p>
            )}
          </div>

          {/* Aegis assessment + findings */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-3">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-medium text-slate-200">Aegis assessment</h4>
              {!assessment && <ActionButton id="request-assessment" label="Request independent Aegis assessment" busy={actionBusy} outcome={actionOutcome} onClick={requestAssessment} />}
            </div>
            {!assessment ? (
              <p className="text-xs text-slate-500">No assessment requested yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <span>State: {assessment.state}</span>
                  {assessment.decision && <Badge className="border-violet-700/60 bg-violet-500/10 text-violet-200">{assessment.decision}</Badge>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {assessment.state === "evidence_locked" && (
                    <ActionButton id="assessment-begin-running" label="Begin assessment" busy={actionBusy} outcome={actionOutcome} onClick={() => transitionAssessment("begin-running")} />
                  )}
                  {assessment.state === "running" && (
                    <>
                      <ActionButton id="assessment-require-review" label="Send for review" busy={actionBusy} outcome={actionOutcome} onClick={() => transitionAssessment("require-review")} />
                      <ActionButton id="assessment-fail" label="Fail assessment" busy={actionBusy} outcome={actionOutcome} onClick={() => transitionAssessment("fail")} />
                    </>
                  )}
                </div>

                {(assessment.state === "running" || assessment.state === "review_required") && (
                  <div className="rounded-md border border-slate-800 bg-slate-950/40 p-2">
                    <h5 className="mb-1 text-xs font-medium text-slate-300">
                      Findings <span className="text-slate-500">({findings.length})</span>
                    </h5>
                    <ul className="mb-2 flex flex-col gap-1">
                      {findings.map((f) => (
                        <li key={f.finding_id} className="flex items-center justify-between text-xs text-slate-300">
                          <span>
                            {f.dimension} — {f.result}
                            {f.is_critical && <span className="ml-1 text-rose-300">(critical)</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {findings.some((f) => f.is_critical && f.result === "fail") && (
                      <p className="mb-2 flex items-center gap-1 text-xs text-orange-300">
                        <ShieldAlert className="h-3 w-3" /> A critical finding has failed — an admissible ratification will be refused.
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-1.5">
                      <input value={findingDimension} onChange={(e) => setFindingDimension(e.target.value)} placeholder="Dimension" className="col-span-2 rounded border border-slate-800 bg-slate-900/60 p-1 text-xs text-slate-100" />
                      <input value={findingClaim} onChange={(e) => setFindingClaim(e.target.value)} placeholder="Claim" className="col-span-2 rounded border border-slate-800 bg-slate-900/60 p-1 text-xs text-slate-100" />
                      <input value={findingMethod} onChange={(e) => setFindingMethod(e.target.value)} placeholder="Method" className="rounded border border-slate-800 bg-slate-900/60 p-1 text-xs text-slate-100" />
                      <select value={findingResult} onChange={(e) => setFindingResult(e.target.value as AegisFindingResult)} className="rounded border border-slate-800 bg-slate-900/60 p-1 text-xs text-slate-100">
                        {(["pass", "fail", "inconclusive"] as AegisFindingResult[]).map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                      <input
                        value={findingFalsification}
                        onChange={(e) => setFindingFalsification(e.target.value)}
                        placeholder="Falsification condition"
                        className="col-span-2 rounded border border-slate-800 bg-slate-900/60 p-1 text-xs text-slate-100"
                      />
                      <label className="col-span-2 flex items-center gap-1.5 text-xs text-slate-300">
                        <input type="checkbox" checked={findingCritical} onChange={(e) => setFindingCritical(e.target.checked)} /> Critical
                      </label>
                      <div className="col-span-2">
                        <ActionButton
                          id="add-finding"
                          label="Add finding"
                          busy={actionBusy}
                          outcome={actionOutcome}
                          onClick={addFinding}
                          disabled={!findingDimension.trim() || !findingClaim.trim() || !findingMethod.trim() || !findingFalsification.trim()}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {assessment.state === "review_required" && (
                  <div className="rounded-md border border-slate-800 bg-slate-950/40 p-2">
                    <h5 className="mb-1 text-xs font-medium text-slate-300">Ratify assessment</h5>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <select value={ratifyDecision} onChange={(e) => setRatifyDecision(e.target.value as AegisDecision)} className="rounded border border-slate-800 bg-slate-900/60 p-1 text-xs text-slate-100">
                        {(["admissible", "admissible_with_conditions", "insufficient_evidence", "not_admissible"] as AegisDecision[]).map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                      <input value={ratifyRationale} onChange={(e) => setRatifyRationale(e.target.value)} placeholder="Rationale (optional)" className="min-w-[160px] flex-1 rounded border border-slate-800 bg-slate-900/60 p-1 text-xs text-slate-100" />
                      {confirming === "ratify" ? (
                        <>
                          <StatusBadge kind="approval" />
                          <ActionButton id="ratify" label="Confirm ratify" busy={actionBusy} outcome={actionOutcome} onClick={ratifyAssessment} />
                          <button type="button" onClick={() => setConfirming(null)} className="text-xs text-slate-400 hover:text-slate-200">
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirming("ratify")}
                          className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-violet-500/50"
                        >
                          Ratify assessment
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* MoneyPenny admission decision — this IS MoneyPenny's own
              admission-authority surface (this panel lives inside the
              MoneyPenny cartridge); never Factor's, never Aegis's. */}
          <div ref={admissionSectionRef} className="rounded-lg border border-slate-800 bg-slate-900/30 p-3">
            <h4 className="mb-1 text-sm font-medium text-slate-200">MoneyPenny admission decision</h4>
            {activeCase.state !== "admission_pending" ? (
              <p className="text-xs text-slate-500">This case must reach &ldquo;Admission pending&rdquo; before MoneyPenny can decide.</p>
            ) : confirming?.startsWith("decide-") ? (
              <div className="flex items-center gap-2">
                <StatusBadge kind="approval" />
                <ActionButton id={confirming} label={`Confirm: ${confirming.replace("decide-", "").replace(/_/g, " ")}`} busy={actionBusy} outcome={actionOutcome} onClick={() => decideAdmission(confirming.replace("decide-", "") as "admitted" | "conditionally_admitted" | "rejected")} />
                <button type="button" onClick={() => setConfirming(null)} className="text-xs text-slate-400 hover:text-slate-200">
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => setConfirming("decide-admitted")} className="rounded-full border border-emerald-700/60 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200 hover:bg-emerald-500/20">
                  Admit
                </button>
                <button type="button" onClick={() => setConfirming("decide-conditionally_admitted")} className="rounded-full border border-amber-700/60 bg-amber-500/10 px-3 py-1 text-xs text-amber-200 hover:bg-amber-500/20">
                  Conditionally admit
                </button>
                <button type="button" onClick={() => setConfirming("decide-rejected")} className="rounded-full border border-rose-700/60 bg-rose-500/10 px-3 py-1 text-xs text-rose-200 hover:bg-rose-500/20">
                  Reject
                </button>
              </div>
            )}
          </div>

          {/* Case activity timeline */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-3">
            <h4 className="mb-2 text-sm font-medium text-slate-200">Case activity</h4>
            {caseBusy && events.length === 0 ? (
              <p className="text-xs text-slate-500">Loading…</p>
            ) : events.length === 0 ? (
              <p className="text-xs text-slate-500">No activity recorded yet.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {events
                  .slice()
                  .reverse()
                  .map((ev) => (
                    <li key={ev.event_id} className="text-xs text-slate-400">
                      <span className="text-slate-300">{ev.event_type}</span>
                      {ev.to_state && <span> → {ev.to_state}</span>}
                      <span className="ml-2 text-slate-600">{new Date(ev.created_at).toLocaleString()}</span>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Persistent conversation */}
      <Card className="bg-slate-900/40 border-slate-800">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-slate-100">Conversation</CardTitle>
            <CardDescription className="text-slate-400">
              Exploratory questions to Aigent Factor or Aegis — grounded in this case. Advisory only: this consult can never decide
              admission or ever mutate case/assessment state.
            </CardDescription>
          </div>
          {turns.length > 0 && (
            <button type="button" onClick={newConversation} className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200">
              <RotateCcw className="h-3 w-3" /> New conversation
            </button>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex gap-2" role="tablist" aria-label="Specialist">
            {(["factor", "aegis"] as const).map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={specialist === id}
                onClick={() => setSpecialist(id)}
                className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                  specialist === id ? "border-violet-500/70 bg-violet-500/10 text-violet-100" : "border-slate-800 text-slate-300 hover:border-violet-500/40"
                }`}
              >
                {id === "factor" ? "Aigent Factor" : "Aegis"}
              </button>
            ))}
          </div>

          <div className="flex max-h-[480px] flex-col gap-3 overflow-y-auto">
            {turns.map((turn) => (
              <div key={turn.id} className="flex flex-col gap-1.5">
                <div className="self-end rounded-lg bg-violet-500/10 px-3 py-2 text-sm text-violet-100">{turn.prompt}</div>
                {turn.factorAdmissionRefusal ? (
                  <div className="flex flex-col gap-2 rounded-lg border border-rose-800/60 bg-rose-500/10 p-3">
                    <StatusBadge kind="refused" />
                    <p className="text-sm text-rose-100">
                      Aigent Factor cannot decide admission — that authority belongs to MoneyPenny alone. Aigent Factor facilitates intake and evidence; it never assesses or admits.
                    </p>
                    <button type="button" onClick={scrollToAdmission} className="inline-flex w-fit items-center gap-1 rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-violet-500/50">
                      Refer to MoneyPenny <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <StatusBadge kind="advisory" />
                    </div>
                    <SpecialistResponseCard data={turn.response} loading={turn.loading} error={turn.error} theme="dark" />
                    {turn.error && (
                      <button type="button" onClick={() => retryTurn(turn.id)} className="inline-flex w-fit items-center gap-1 text-xs text-slate-400 hover:text-slate-200">
                        <RotateCcw className="h-3 w-3" /> Retry
                      </button>
                    )}
                  </div>
                )}
                {!turn.loading && (
                  <button type="button" onClick={askFollowUp} className="self-start text-xs text-slate-500 hover:text-slate-300">
                    Ask a follow-up
                  </button>
                )}
              </div>
            ))}
          </div>

          <textarea
            ref={composerRef}
            value={composerText}
            onChange={(e) => setComposerText(e.target.value)}
            onKeyDown={onComposerKeyDown}
            placeholder={`Ask ${specialist === "factor" ? "Aigent Factor" : "Aegis"} about this case…`}
            rows={2}
            className="w-full rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-500/60 focus:outline-none"
          />
          <div>
            <button
              type="button"
              onClick={submitComposer}
              disabled={!composerText.trim()}
              className="inline-flex items-center gap-2 rounded-full border border-violet-500/70 bg-violet-500/10 px-4 py-1.5 text-sm text-violet-100 hover:bg-violet-500/20 disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// ActionButton — one real, typed action. Renders its own busy/outcome
// state; never renders when its handler has no real target (every caller
// guards its own preconditions before including this button at all).
// ─────────────────────────────────────────────────────────────────────────

function ActionButton({
  id,
  label,
  busy,
  outcome,
  onClick,
  disabled,
}: {
  id: string;
  label: string;
  busy: Record<string, boolean>;
  outcome: Record<string, ActionOutcome | null>;
  onClick: () => void;
  disabled?: boolean;
}) {
  const isBusy = Boolean(busy[id]);
  const result = outcome[id];
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={isBusy || disabled}
        className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-violet-500/50 disabled:opacity-50"
      >
        {isBusy && <Loader2 className="h-3 w-3 animate-spin" />}
        {label}
      </button>
      {!isBusy && result && <StatusBadge kind={result.kind} />}
      {!isBusy && result && result.kind !== "completed" && <span className="text-xs text-slate-400">{result.message}</span>}
    </div>
  );
}
