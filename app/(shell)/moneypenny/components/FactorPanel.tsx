/**
 * FactorPanel — Aigent Factor's own first-class MoneyPenny specialist
 * surface (specialist-surfaces separation, operator directive 2026-09-05).
 *
 * Replaces the prior combined CandidateIntakePanel, which presented
 * "Aigent Factor & Aegis" as one surface, required a candidate identifier
 * before any consultation was possible, and made Aegis appear subordinate
 * to candidate intake. This panel's DEFAULT state is a direct consultation
 * (SpecialistWorkspace, no case required) — the existing candidate-intake
 * case workflow now opens as a MODE within this panel ("Start candidate
 * intake" / "Find/open candidate case"), never a second, parallel
 * destination.
 *
 * Aigent Factor may facilitate candidate intake but never assesses a
 * candidate (that is Aegis's, via a handoff carrying only the bounded
 * caseId — never a copied private thread) and never decides admission
 * (that is MoneyPenny's alone, rendered here because this panel lives
 * inside the MoneyPenny cartridge, exactly as the prior combined panel's
 * own header already established).
 *
 * Case-lifecycle logic (state-machine buttons, evidence checklist,
 * authority chain, admission decision, activity timeline) is carried over
 * unchanged from the prior CandidateIntakePanel — the server remains the
 * sole enforcer of every transition; this panel only ever offers a button
 * the server's own FORWARD_TRANSITIONS table (services/factor/
 * factorCaseService.ts) would actually allow for the current state.
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldAlert, ArrowRight } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";
import { SpecialistWorkspace, type SpecialistPromptSuggestion } from "./specialistWorkspace/SpecialistWorkspace";
import { useMoneyPennyNavigation, readAndClearPendingCaseId } from "./moneyPennyNavigation";
import { buildCaseContextPrompt, type CaseConsultationContext } from "@/services/moneypenny/caseContextConsultation";
import { FACTOR_CAPABILITIES, getFactorCapability, type FactorCapabilityId } from "@/services/factor/factorCapabilityManifest";

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

type AegisDecision = "admissible" | "admissible_with_conditions" | "insufficient_evidence" | "not_admissible";

interface AegisAssessmentSummary {
  assessment_id: string;
  state: string;
  decision: AegisDecision | null;
}

const TENANT_ID = "default";

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

interface ActionOutcome {
  kind: StatusKind;
  message: string;
}

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

const FACTOR_ADMIT_PATTERN = /\b(admit|approve|accept)\b.{0,30}\bcandidate\b|\badmit\s+(this|the)\s+candidate\b/i;

// Capability discovery is the empty-state default — Factor's capability
// model, not candidate intake, is the panel's governing identity (Factor
// cognitive-runtime fix, 2026-09-05). "Start candidate intake" / "Find/open
// candidate case" above remain the dedicated path into the case workflow.
//
// Carries the explicit capabilityId (capability-runtime contract closure,
// 2026-09-05) so clicking this button sends 'general_orientation' verbatim
// — never rediscovered by re-classifying the label text.
const FACTOR_EMPTY_STATE_PROMPT: SpecialistPromptSuggestion = {
  label: getFactorCapability("general_orientation").examples[0],
  capabilityId: "general_orientation",
};

// Workstream chips — DERIVED from the capability manifest (one authoritative
// list, never a hand-duplicated set of chip labels), excluding the three
// capabilities that already have a dedicated affordance elsewhere in this
// panel (general_orientation is the empty-state default; candidate_intake
// has its own "Start candidate intake" button; aegis_referral is reached
// via "Request an independent Aegis assessment" once a case is open). Each
// chip carries its capabilityId explicitly — selecting it is a capability
// SELECTION, not a free-text question for the classifier to rediscover.
const FACTOR_WORKSTREAM_IDS: FactorCapabilityId[] = [
  "agent_service_discovery",
  "horizen_journey_spine",
  "identity_wallet_settlement",
  "authority_chain",
  "financial_service_composition",
  "pulse_pnl",
  "standing_proposal",
];
const FACTOR_FOLLOWUPS: SpecialistPromptSuggestion[] = FACTOR_CAPABILITIES.filter((c) => FACTOR_WORKSTREAM_IDS.includes(c.id)).map((c) => ({
  label: c.examples[0],
  capabilityId: c.id,
}));

export function FactorPanel() {
  const { setActiveCase: setSharedActiveCase, navigate } = useMoneyPennyNavigation();

  const [mode, setMode] = useState<"consult" | "case">("consult");

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
  const [assessment, setAssessment] = useState<AegisAssessmentSummary | null>(null);
  const [caseBusy, setCaseBusy] = useState(false);
  const [caseError, setCaseError] = useState<string | null>(null);

  const [actionBusy, setActionBusy] = useState<Record<string, boolean>>({});
  const [actionOutcome, setActionOutcome] = useState<Record<string, ActionOutcome | null>>({});
  const [confirming, setConfirming] = useState<string | null>(null);

  const [evidenceKind, setEvidenceKind] = useState("");
  const [evidenceStatus, setEvidenceStatus] = useState<FactorEvidenceStatus>("supplied");
  const admissionSectionRef = useRef<HTMLDivElement | null>(null);

  const caseId = activeCase?.case_id ?? null;

  const refreshCase = useCallback(
    async (targetCaseId: string) => {
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
        const a = (caseRes.data!.assessment as AegisAssessmentSummary | null) ?? null;
        setAssessment(a);
        setEvents(eventsRes.ok ? ((eventsRes.data!.events as FactorCaseEvent[]) ?? []) : []);
        setSharedActiveCase({
          caseId: c.case_id,
          candidateDisplayName: c.candidate_display_name,
          state: c.state,
          currentAegisDecision: a?.decision ?? null,
        });
        setMode("case");
      } finally {
        setCaseBusy(false);
      }
    },
    [setSharedActiveCase],
  );

  // A Factor->Aegis->back handoff, or a direct deep-link, can hand this
  // panel a bounded caseId to resume — read once, on mount, then cleared
  // (the same one-shot idiom writePendingSpecialist already established).
  useEffect(() => {
    const pending = readAndClearPendingCaseId();
    if (pending) void refreshCase(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setSharedActiveCase(null);
    setCandidateKey("");
    setCandidateName("");
    setOpenCaseNote(null);
    setActionBusy({});
    setActionOutcome({});
    setConfirming(null);
    setMode("consult");
  }, [setSharedActiveCase]);

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
          body: JSON.stringify({ reason: "revoked from Aigent Factor workspace" }),
        }),
      "Authority chain revoked.",
    );
  }, [activeCase, runAction]);

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

  // Handoff to Aegis — carries ONLY the bounded caseId, never a copied
  // private thread (requirement 5). Aegis's own panel fetches the case's
  // current evidence fresh from the real REST route.
  const handoffToAegis = useCallback(() => {
    if (!caseId) return;
    navigate({ panel: "aegis", specialistId: "aegis", activeCaseId: caseId });
  }, [caseId, navigate]);

  const advanceOptions = useMemo(() => (activeCase ? (CASE_ADVANCE_OPTIONS[activeCase.state] ?? []) : []), [activeCase]);

  const scrollToAdmission = useCallback(() => {
    admissionSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const classifyRefusal = useCallback((prompt: string) => {
    if (FACTOR_ADMIT_PATTERN.test(prompt)) {
      return "Aigent Factor cannot decide admission — that authority belongs to MoneyPenny alone. Aigent Factor facilitates intake and evidence; it never assesses or admits.";
    }
    return null;
  }, []);

  const groundContextBlock = useMemo(() => {
    if (!activeCase) return null;
    const ctx: CaseConsultationContext = {
      caseId: activeCase.case_id,
      candidateDisplayName: activeCase.candidate_display_name,
      state: activeCase.state,
      currentAssessmentId: assessment?.assessment_id ?? null,
      currentAegisDecision: assessment?.decision ?? null,
    };
    // buildCaseContextPrompt's own prefix line, minus the trailing prompt —
    // SpecialistWorkspace appends the live prompt itself.
    return buildCaseContextPrompt("", ctx).split("\n\n")[0];
  }, [activeCase, assessment]);

  return (
    <div className="flex flex-col gap-4 p-4">
      <Card className="bg-slate-900/40 border-slate-800">
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-slate-100">Aigent Factor</CardTitle>
            <CardDescription className="text-slate-400">
              MoneyPenny&rsquo;s constitutional economic activation and ecosystem-catalysis specialist — agent and
              service discovery, registry/Horizen facilitation, authority chains, standing proposals, and
              candidate-intake case facilitation as one workstream among these. Never assesses or admits.
            </CardDescription>
          </div>
          {mode === "case" && activeCase && (
            <div className="flex items-center gap-2">
              <Badge className="border-violet-700/60 bg-violet-500/10 text-violet-200">{CASE_STATE_LABELS[activeCase.state]}</Badge>
              <button type="button" onClick={closeCase} className="text-xs text-slate-400 hover:text-slate-200">
                Close case
              </button>
            </div>
          )}
        </CardHeader>
        {mode === "consult" && (
          <CardContent className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setMode("case")}
              className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/70 bg-violet-500/10 px-3 py-1 text-xs text-violet-100 hover:bg-violet-500/20"
            >
              Start candidate intake
            </button>
            <button
              type="button"
              onClick={() => setMode("case")}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-violet-500/50"
            >
              Find/open candidate case
            </button>
          </CardContent>
        )}
      </Card>

      {mode === "consult" && (
        <Card className="bg-slate-900/40 border-slate-800">
          <CardContent className="pt-4">
            <SpecialistWorkspace
              specialistId="factor"
              specialistLabel="Aigent Factor"
              emptyStatePrompt={FACTOR_EMPTY_STATE_PROMPT}
              placeholder="Ask Aigent Factor about agent readiness, registration, evidence, standing…"
              suggestedFollowups={FACTOR_FOLLOWUPS}
              scopeId={null}
              classifyRefusal={classifyRefusal}
            />
          </CardContent>
        </Card>
      )}

      {mode === "case" && !activeCase && (
        <Card className="bg-slate-900/40 border-slate-800">
          <CardHeader>
            <CardTitle className="text-slate-100">Candidate intake</CardTitle>
            <CardDescription className="text-slate-400">
              Find an existing case by its candidate identifier, or open a new one — the same action resumes an existing
              case for that identifier instead of duplicating it.
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
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={openOrCreateCase}
                disabled={openCaseBusy}
                className="inline-flex items-center gap-2 rounded-full border border-violet-500/70 bg-violet-500/10 px-4 py-1.5 text-sm text-violet-100 hover:bg-violet-500/20 disabled:opacity-50"
              >
                {openCaseBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                Find or open case
              </button>
              <button type="button" onClick={() => setMode("consult")} className="text-xs text-slate-400 hover:text-slate-200">
                Back to consultation
              </button>
            </div>
            {openCaseError && <p className="text-sm text-rose-300">{openCaseError}</p>}
          </CardContent>
        </Card>
      )}

      {mode === "case" && activeCase && (
        <>
          {openCaseNote && <p className="text-xs text-emerald-300">{openCaseNote}</p>}
          <Card className="bg-slate-900/40 border-slate-800">
            <CardHeader>
              <CardTitle className="text-slate-100">{activeCase.candidate_display_name}</CardTitle>
              <CardDescription className="text-slate-400">
                Case {activeCase.case_id.slice(0, 8)}… · identifier {activeCase.candidate_identity_key}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {caseError && <p className="text-sm text-rose-300">{caseError}</p>}

              <div className="flex flex-wrap items-center gap-2">
                {activeCase.state !== "paused" && activeCase.state !== "rejected" && activeCase.state !== "active" && (
                  <ActionButton id="pause" label="Pause case" busy={actionBusy} outcome={actionOutcome} onClick={() => pauseOrResumeCase("pause")} />
                )}
                {activeCase.state === "paused" && <ActionButton id="resume" label="Resume case" busy={actionBusy} outcome={actionOutcome} onClick={() => pauseOrResumeCase("resume")} />}
                {advanceOptions.map((opt) => (
                  <ActionButton key={opt.to} id={`advance-${opt.to}`} label={opt.label} busy={actionBusy} outcome={actionOutcome} onClick={() => advanceCase(opt.to, opt.label)} />
                ))}
              </div>

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

              {/* Aegis assessment — read-only summary + handoff. The
                  assessment itself (findings, ratify) lives in Aegis's own
                  panel — never re-rendered here (single authority per
                  surface). */}
              <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-3">
                <div className="mb-1 flex items-center justify-between">
                  <h4 className="text-sm font-medium text-slate-200">Aegis assessment</h4>
                  <button
                    type="button"
                    onClick={handoffToAegis}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-violet-500/50"
                  >
                    {assessment ? "Open in Aegis" : "Request an independent Aegis assessment"} <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
                {assessment ? (
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <span>State: {assessment.state}</span>
                    {assessment.decision && <Badge className="border-violet-700/60 bg-violet-500/10 text-violet-200">{assessment.decision}</Badge>}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">No assessment requested yet.</p>
                )}
              </div>

              <div ref={admissionSectionRef} className="rounded-lg border border-slate-800 bg-slate-900/30 p-3">
                <h4 className="mb-1 text-sm font-medium text-slate-200">MoneyPenny admission decision</h4>
                {activeCase.state !== "admission_pending" ? (
                  <p className="text-xs text-slate-500">This case must reach &ldquo;Admission pending&rdquo; before MoneyPenny can decide.</p>
                ) : confirming?.startsWith("decide-") ? (
                  <div className="flex items-center gap-2">
                    <StatusBadge kind="approval" />
                    <ActionButton
                      id={confirming}
                      label={`Confirm: ${confirming.replace("decide-", "").replace(/_/g, " ")}`}
                      busy={actionBusy}
                      outcome={actionOutcome}
                      onClick={() => decideAdmission(confirming.replace("decide-", "") as "admitted" | "conditionally_admitted" | "rejected")}
                    />
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
                {activeCase.state === "admission_pending" && !assessment?.decision && (
                  <p className="mt-2 flex items-center gap-1 text-xs text-orange-300">
                    <ShieldAlert className="h-3 w-3" /> No ratified Aegis assessment yet — MoneyPenny will refuse admit/conditionally-admit without one.
                  </p>
                )}
              </div>

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

          <Card className="bg-slate-900/40 border-slate-800">
            <CardHeader>
              <CardTitle className="text-slate-100">Conversation</CardTitle>
              <CardDescription className="text-slate-400">
                Exploratory questions to Aigent Factor, grounded in this case. Advisory only — this consult can never
                mutate case state.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SpecialistWorkspace
                specialistId="factor"
                specialistLabel="Aigent Factor"
                emptyStatePrompt="Ask Aigent Factor about this candidate's readiness for the next step."
                placeholder="Ask Aigent Factor about this case…"
                suggestedFollowups={FACTOR_FOLLOWUPS}
                scopeId={activeCase.case_id}
                groundContextBlock={groundContextBlock}
                factorScope={{ caseId: activeCase.case_id }}
                classifyRefusal={classifyRefusal}
                refusalActionLabel="Refer to MoneyPenny"
                onRefusalAction={scrollToAdmission}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export default FactorPanel;
