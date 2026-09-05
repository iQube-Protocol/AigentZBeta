/**
 * AegisPanel — Aegis's own first-class MoneyPenny specialist surface
 * (specialist-surfaces separation, operator directive 2026-09-05).
 *
 * Replaces Aegis's prior subordinate position inside the combined
 * CandidateIntakePanel ("Aigent Factor & Aegis" as one surface, a second
 * tab within Factor's own case workspace). This panel's DEFAULT state is a
 * direct consultation (SpecialistWorkspace, no assessment required) —
 * Aegis's independent-assessment workflow (create/run/findings/ratify)
 * opens as a MODE within this panel.
 *
 * Aegis supports subjects broader than the iQube Registry and Factor cases
 * (subjectType 'agent', a free-text subjectRef — any external agent,
 * system, provider, or model) — never assuming every assessment has a
 * caseId. When reached via a Factor handoff (a bounded caseId only, never
 * a copied private thread), this panel fetches that case's OWN evidence
 * fresh from the real REST route to build the locked evidence context; when
 * reached directly, it never fabricates a Factor case.
 *
 * Aegis structurally refuses self-assessment and never decides admission —
 * both enforced server-side (services/aegis/aegisAssessmentService.ts);
 * this panel only ever surfaces the server's own refusal, never re-derives
 * it. Ratifying an assessment sets ONLY the assessment's own decision —
 * MoneyPenny's admission decision lives in Aigent Factor's own panel
 * (FactorPanel.tsx), never duplicated here.
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldAlert } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";
import { SpecialistWorkspace } from "./specialistWorkspace/SpecialistWorkspace";
import { readAndClearPendingCaseId } from "./moneyPennyNavigation";
import { buildAssessmentContextPrompt, type AssessmentConsultationContext } from "@/services/moneypenny/caseContextConsultation";

type AegisAssessmentState = "draft" | "evidence_locked" | "running" | "review_required" | "ratified" | "failed";
type AegisDecision = "admissible" | "admissible_with_conditions" | "insufficient_evidence" | "not_admissible";
type AegisFindingResult = "pass" | "fail" | "inconclusive";

interface AegisAssessmentRow {
  assessment_id: string;
  subject_type: "factor_case" | "agent";
  subject_ref: string;
  case_id: string | null;
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

interface FactorEvidenceItem {
  kind: string;
  status: string;
  source_ref: string | null;
}

const AEGIS_POLICY_VERSION = "aegis-policy-v1";
const REQUESTING_AGENT_REF = "aigent-factor";

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

const REFUSED_CODES = new Set(["self-assessment-refused", "cross-tenant-denied", "cross-principal-denied"]);
const BLOCKED_CODES = new Set(["assessment-closed", "concurrent-transition", "invalid-transition", "critical-failure-blocks-admission"]);

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

const AEGIS_EMPTY_STATE_PROMPT =
  "Ask Aegis about trusted intelligence, constitutional risk, agents, models, providers, harnesses, or independent assessment.";

const AEGIS_FOLLOWUPS = ["Review Trusted Intelligence criteria"];

export function AegisPanel() {
  const [mode, setMode] = useState<"consult" | "assessment">("consult");

  // Referral from Aigent Factor — a bounded caseId only.
  const [referralCaseId, setReferralCaseId] = useState<string | null>(null);
  const [referralEvidence, setReferralEvidence] = useState<FactorEvidenceItem[] | null>(null);
  const [referralBusy, setReferralBusy] = useState(false);
  const [referralError, setReferralError] = useState<string | null>(null);

  // Direct/external subject form.
  const [subjectType, setSubjectType] = useState<"factor_case" | "agent">("agent");
  const [subjectRef, setSubjectRef] = useState("");
  const [openAssessmentId, setOpenAssessmentId] = useState("");

  const [assessment, setAssessment] = useState<AegisAssessmentRow | null>(null);
  const [findings, setFindings] = useState<AegisFinding[]>([]);
  const [assessmentBusy, setAssessmentBusy] = useState(false);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);

  const [actionBusy, setActionBusy] = useState<Record<string, boolean>>({});
  const [actionOutcome, setActionOutcome] = useState<Record<string, ActionOutcome | null>>({});
  const [confirming, setConfirming] = useState<string | null>(null);

  const [findingDimension, setFindingDimension] = useState("");
  const [findingClaim, setFindingClaim] = useState("");
  const [findingMethod, setFindingMethod] = useState("");
  const [findingResult, setFindingResult] = useState<AegisFindingResult>("pass");
  const [findingCritical, setFindingCritical] = useState(false);
  const [findingFalsification, setFindingFalsification] = useState("");

  const [ratifyDecision, setRatifyDecision] = useState<AegisDecision>("admissible");
  const [ratifyRationale, setRatifyRationale] = useState("");

  const refreshAssessment = useCallback(async (assessmentId: string) => {
    setAssessmentBusy(true);
    setAssessmentError(null);
    const result = await callApi(`/api/moneypenny/aegis/assessments/${assessmentId}`);
    setAssessmentBusy(false);
    if (!result.ok) {
      setAssessmentError(result.detail);
      return;
    }
    setAssessment(result.data!.assessment as AegisAssessmentRow);
    setFindings((result.data!.findings as AegisFinding[]) ?? []);
    setMode("assessment");
  }, []);

  // A Factor handoff hands this panel ONLY the bounded caseId (never a
  // copied private thread) — read once, on mount, then cleared.
  useEffect(() => {
    const pending = readAndClearPendingCaseId();
    if (!pending) return;
    setReferralCaseId(pending);
    setMode("assessment");
    setReferralBusy(true);
    void (async () => {
      const result = await callApi(`/api/moneypenny/factor/cases/${pending}?tenantId=default`);
      setReferralBusy(false);
      if (!result.ok) {
        setReferralError(result.detail);
        return;
      }
      setReferralEvidence((result.data!.evidence as FactorEvidenceItem[]) ?? []);
      const existing = result.data!.assessment as AegisAssessmentRow | null;
      if (existing) {
        setAssessment(existing);
        void refreshAssessment(existing.assessment_id);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAssessment = useCallback(() => {
    const id = openAssessmentId.trim();
    if (!id) return;
    void refreshAssessment(id);
  }, [openAssessmentId, refreshAssessment]);

  const createAssessment = useCallback(
    async (input: { subjectType: "factor_case" | "agent"; subjectRef: string; caseId: string | null; evidenceSnapshot: Record<string, unknown> }) => {
      setAssessmentBusy(true);
      setAssessmentError(null);
      const result = await callApi("/api/moneypenny/aegis/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectType: input.subjectType,
          subjectRef: input.subjectRef,
          caseId: input.caseId,
          policyVersion: AEGIS_POLICY_VERSION,
          requestedByAgentRef: REQUESTING_AGENT_REF,
          evidenceSnapshot: input.evidenceSnapshot,
        }),
      });
      setAssessmentBusy(false);
      if (!result.ok) {
        setAssessmentError(result.detail);
        return;
      }
      const a = result.data!.assessment as AegisAssessmentRow;
      setAssessment(a);
      setFindings([]);
      setMode("assessment");
    },
    [],
  );

  const acceptReferral = useCallback(() => {
    if (!referralCaseId) return;
    void createAssessment({
      subjectType: "factor_case",
      subjectRef: referralCaseId,
      caseId: referralCaseId,
      evidenceSnapshot: { items: (referralEvidence ?? []).map((e) => ({ kind: e.kind, status: e.status, sourceRef: e.source_ref })) },
    });
  }, [referralCaseId, referralEvidence, createAssessment]);

  const startExternalAssessment = useCallback(() => {
    const ref = subjectRef.trim();
    if (!ref) return;
    // A direct external-subject assessment never carries a caseId — this
    // must never fabricate a Factor case (requirement 9).
    void createAssessment({ subjectType, subjectRef: ref, caseId: null, evidenceSnapshot: {} });
  }, [subjectType, subjectRef, createAssessment]);

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
      if (assessment) await refreshAssessment(assessment.assessment_id);
      return true;
    },
    [assessment, refreshAssessment],
  );

  const transitionAssessment = useCallback(
    (action: "begin-running" | "require-review" | "fail") => {
      if (!assessment) return;
      void runAction(
        `assessment-${action}`,
        () =>
          callApi(`/api/moneypenny/aegis/assessments/${assessment.assessment_id}/transition`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action, reason: action === "fail" ? "failed from Aegis workspace" : undefined }),
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
    if (succeeded) setConfirming(null);
  }, [assessment, ratifyDecision, ratifyRationale, runAction]);

  const closeAssessment = useCallback(() => {
    setAssessment(null);
    setFindings([]);
    setReferralCaseId(null);
    setReferralEvidence(null);
    setReferralError(null);
    setOpenAssessmentId("");
    setSubjectRef("");
    setActionBusy({});
    setActionOutcome({});
    setConfirming(null);
    setMode("consult");
  }, []);

  const classifyRefusal = useCallback((prompt: string) => {
    if (/\bassess\s+(yourself|itself|aegis)\b/i.test(prompt)) {
      return "Aegis cannot assess itself — the requester and the subject can never be the same agent. This is enforced structurally, not just by policy.";
    }
    return null;
  }, []);

  const groundContextBlock = useMemo(() => {
    if (!assessment) return null;
    const ctx: AssessmentConsultationContext = {
      assessmentId: assessment.assessment_id,
      subjectType: assessment.subject_type,
      subjectRef: assessment.subject_ref,
      state: assessment.state,
      decision: assessment.decision,
      caseId: assessment.case_id,
    };
    return buildAssessmentContextPrompt("", ctx).split("\n\n")[0];
  }, [assessment]);

  return (
    <div className="flex flex-col gap-4 p-4">
      <Card className="bg-slate-900/40 border-slate-800">
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-slate-100">Aegis</CardTitle>
            <CardDescription className="text-slate-400">
              Independent assessment of a candidate or any external agent, system, provider, or model. Never
              self-assesses, never decides admission.
            </CardDescription>
          </div>
          {mode === "assessment" && assessment && (
            <div className="flex items-center gap-2">
              <Badge className="border-violet-700/60 bg-violet-500/10 text-violet-200">{assessment.state}</Badge>
              <button type="button" onClick={closeAssessment} className="text-xs text-slate-400 hover:text-slate-200">
                Close assessment
              </button>
            </div>
          )}
        </CardHeader>
        {mode === "consult" && (
          <CardContent className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setMode("assessment")}
              className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/70 bg-violet-500/10 px-3 py-1 text-xs text-violet-100 hover:bg-violet-500/20"
            >
              Start independent assessment
            </button>
            <button
              type="button"
              onClick={() => {
                setSubjectType("agent");
                setMode("assessment");
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-violet-500/50"
            >
              Assess an external agent/system/provider/model
            </button>
            <button
              type="button"
              onClick={() => setMode("assessment")}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-violet-500/50"
            >
              Open assessment
            </button>
          </CardContent>
        )}
      </Card>

      {mode === "consult" && (
        <Card className="bg-slate-900/40 border-slate-800">
          <CardContent className="pt-4">
            <SpecialistWorkspace
              specialistId="aegis"
              specialistLabel="Aegis"
              emptyStatePrompt={AEGIS_EMPTY_STATE_PROMPT}
              placeholder="Ask Aegis about trusted intelligence, risk, or independent assessment…"
              suggestedFollowups={AEGIS_FOLLOWUPS}
              scopeId={null}
              classifyRefusal={classifyRefusal}
            />
          </CardContent>
        </Card>
      )}

      {mode === "assessment" && !assessment && (
        <Card className="bg-slate-900/40 border-slate-800">
          <CardHeader>
            <CardTitle className="text-slate-100">Open or start an assessment</CardTitle>
            <CardDescription className="text-slate-400">
              Accept a pending Factor referral, assess an external subject directly, or open an existing assessment by
              id — never fabricated when no referral is pending.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {referralError && <p className="text-sm text-rose-300">{referralError}</p>}

            {referralCaseId ? (
              <div className="rounded-lg border border-violet-800/50 bg-violet-500/5 p-3">
                <h4 className="mb-1 text-sm font-medium text-slate-200">Referral from Aigent Factor</h4>
                <p className="mb-2 text-xs text-slate-400">
                  Case {referralCaseId.slice(0, 8)}… · {referralBusy ? "loading locked evidence…" : `${referralEvidence?.length ?? 0} evidence item(s) locked`}
                </p>
                <button
                  type="button"
                  onClick={acceptReferral}
                  disabled={assessmentBusy || referralBusy}
                  className="inline-flex items-center gap-2 rounded-full border border-violet-500/70 bg-violet-500/10 px-4 py-1.5 text-sm text-violet-100 hover:bg-violet-500/20 disabled:opacity-50"
                >
                  {assessmentBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                  Accept a referral from Aigent Factor
                </button>
              </div>
            ) : (
              <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-3">
                <h4 className="mb-2 text-sm font-medium text-slate-200">Assess a subject</h4>
                <div className="flex flex-wrap items-center gap-2">
                  <select value={subjectType} onChange={(e) => setSubjectType(e.target.value as "factor_case" | "agent")} className="rounded-lg border border-slate-800 bg-slate-900/60 p-1.5 text-xs text-slate-100">
                    <option value="agent">External agent / system / provider / model</option>
                    <option value="factor_case">Factor case (by caseId)</option>
                  </select>
                  <input
                    value={subjectRef}
                    onChange={(e) => setSubjectRef(e.target.value)}
                    placeholder={subjectType === "agent" ? "Subject reference (e.g. a DID, model id, or provider name)" : "caseId"}
                    className="min-w-[240px] flex-1 rounded-lg border border-slate-800 bg-slate-900/60 p-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-500/60 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={startExternalAssessment}
                    disabled={!subjectRef.trim() || assessmentBusy}
                    className="inline-flex items-center gap-2 rounded-full border border-violet-500/70 bg-violet-500/10 px-4 py-1.5 text-sm text-violet-100 hover:bg-violet-500/20 disabled:opacity-50"
                  >
                    {assessmentBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                    Start assessment
                  </button>
                </div>
                {assessmentError && <p className="mt-2 text-sm text-rose-300">{assessmentError}</p>}
              </div>
            )}

            <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-3">
              <h4 className="mb-2 text-sm font-medium text-slate-200">Open an existing assessment</h4>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={openAssessmentId}
                  onChange={(e) => setOpenAssessmentId(e.target.value)}
                  placeholder="assessmentId"
                  className="min-w-[240px] flex-1 rounded-lg border border-slate-800 bg-slate-900/60 p-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-500/60 focus:outline-none"
                />
                <button type="button" onClick={openAssessment} disabled={!openAssessmentId.trim()} className="rounded-full border border-slate-700 px-4 py-1.5 text-sm text-slate-200 hover:border-violet-500/50 disabled:opacity-50">
                  Open assessment
                </button>
              </div>
            </div>

            <button type="button" onClick={() => setMode("consult")} className="w-fit text-xs text-slate-400 hover:text-slate-200">
              Back to consultation
            </button>
          </CardContent>
        </Card>
      )}

      {mode === "assessment" && assessment && (
        <>
          <Card className="bg-slate-900/40 border-slate-800">
            <CardHeader>
              <CardTitle className="text-slate-100">
                Assessment {assessment.assessment_id.slice(0, 12)}…
              </CardTitle>
              <CardDescription className="text-slate-400">
                Subject: {assessment.subject_type} · {assessment.subject_ref}
                {assessment.case_id && <span> · Factor case {assessment.case_id.slice(0, 8)}…</span>}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {assessmentError && <p className="text-sm text-rose-300">{assessmentError}</p>}
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
                      <button type="button" onClick={() => setConfirming("ratify")} className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-violet-500/50">
                        Ratify assessment
                      </button>
                    )}
                  </div>
                </div>
              )}

              <p className="text-xs text-slate-500">
                Ratifying sets Aegis&apos;s own decision only. MoneyPenny&apos;s admission decision is made in Aigent
                Factor&apos;s own panel, on the linked case.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/40 border-slate-800">
            <CardHeader>
              <CardTitle className="text-slate-100">Conversation</CardTitle>
              <CardDescription className="text-slate-400">
                Exploratory questions to Aegis, grounded in this assessment. Advisory only — this consult can never
                mutate assessment state.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SpecialistWorkspace
                specialistId="aegis"
                specialistLabel="Aegis"
                emptyStatePrompt="Ask Aegis what evidence this assessment still needs."
                placeholder="Ask Aegis about this assessment…"
                suggestedFollowups={AEGIS_FOLLOWUPS}
                scopeId={assessment.assessment_id}
                groundContextBlock={groundContextBlock}
                classifyRefusal={classifyRefusal}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export default AegisPanel;
