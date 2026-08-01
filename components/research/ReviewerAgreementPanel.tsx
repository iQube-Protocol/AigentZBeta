"use client";

/**
 * ReviewerAgreementPanel — the Submit Review stage's agreement surface
 * (operator ruling, 2026-08-02).
 *
 * The three-panel Submit Review flow is: **Review mandate → Reviewer
 * agreement → Submit review**, and this component renders the first two. The
 * mandate panel states what the reviewer may and may not do BEFORE they are
 * asked to consent, because consenting to a mandate you have not been shown
 * is not consent.
 *
 * ── DISPLAY IS NOT CONSENT ─────────────────────────────────────────────────
 *
 * Rendering this panel authorizes nothing. `authorized` is read from the
 * server's own derivation over the durable authorization row
 * (`/api/research/reviewer-agreement` → `requireReviewerAgreement`), never
 * from local state, and nothing in this file can set it. The only way it
 * becomes true is an explicit POST carrying an explicit acknowledgement and
 * an explicit conflict declaration — which is why the submit button is
 * disabled until BOTH have been answered, and why the conflict question has
 * no default: an unanswered conflict question is not "no conflict".
 *
 * ── THE CONSEQUENCE BOUNDARY IS RENDERED, NOT ASSUMED ──────────────────────
 *
 * `prohibitedActs` is displayed as prominently as `permittedActs`. A reviewer
 * must see, before signing, that this agreement confers no authority to
 * freeze, publish, canonise, alter lifecycle state or grant Standing — the
 * ruling's "a reviewer may authorize participation and submit findings; a
 * reviewer may not freeze the experiment or convert findings into canon".
 */

import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, Loader2, AlertTriangle, Check, FileText, Ban } from "lucide-react";

import { personaFetch } from "@/utils/personaSpine";

interface AgreementClause {
  id: string;
  heading: string;
  body: string;
}

interface AgreementView {
  agreementId: string;
  version: string;
  experimentId: string;
  displayLabel: string;
  packageScope: string[] | "*";
  effectiveFrom: string;
  supersedes: string | null;
  clauses: AgreementClause[];
  permittedActs: string[];
  prohibitedActs: string[];
  agreementHash: string;
}

interface AuthorizationView {
  agreementId: string;
  agreementVersion: string;
  authorizedAt: string;
  conflictDeclared: boolean;
  reviewerRef: string;
}

export interface ReviewerAgreementPanelProps {
  experimentId: string;
  /** Notifies the host so it can re-resolve journey state from the server. */
  onAuthorized?: () => void;
}

export function ReviewerAgreementPanel({ experimentId, onAuthorized }: ReviewerAgreementPanelProps) {
  const [agreement, setAgreement] = useState<AgreementView | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [authorization, setAuthorization] = useState<AuthorizationView | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [acknowledged, setAcknowledged] = useState(false);
  /** `null` = unanswered. NEVER defaults to false — see this file's header. */
  const [conflictDeclared, setConflictDeclared] = useState<boolean | null>(null);
  const [conflictStatement, setConflictStatement] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await personaFetch(
        `/api/research/reviewer-agreement?experimentId=${encodeURIComponent(experimentId)}`,
        { cache: "no-store" },
      );
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.ok) {
        setLoadError(
          body?.error === "review_access_required"
            ? "Your access to this experiment's review could not be confirmed, so the agreement cannot be shown yet."
            : "The reviewer agreement could not be loaded right now.",
        );
        return;
      }
      setAgreement(body.agreement as AgreementView);
      setAuthorized(!!body.authorized);
      setAuthorization((body.authorization as AuthorizationView) ?? null);
      setFailure((body.authorizationFailure as string) ?? null);
    } catch {
      setLoadError("The reviewer agreement could not be loaded right now.");
    } finally {
      setLoading(false);
    }
  }, [experimentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const authorize = useCallback(async () => {
    if (!agreement || conflictDeclared === null) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const res = await personaFetch("/api/research/reviewer-agreement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          experimentId,
          acknowledged,
          conflictDeclared,
          conflictStatement: conflictDeclared ? conflictStatement : null,
          // Echo the hash we displayed — if the terms changed while this was
          // open, the server refuses rather than record consent to text the
          // reviewer never read.
          agreementHash: agreement.agreementHash,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.ok) {
        setSubmitError(
          body?.error === "agreement_changed"
            ? (body.message as string)
            : (body?.error as string) ?? "The agreement could not be authorized right now.",
        );
        if (body?.error === "agreement_changed") await load();
        return;
      }
      await load();
      onAuthorized?.();
    } catch {
      setSubmitError("The agreement could not be authorized right now.");
    } finally {
      setSubmitting(false);
    }
  }, [agreement, acknowledged, conflictDeclared, conflictStatement, experimentId, load, onAuthorized]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-xs text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading the reviewer agreement…
      </div>
    );
  }

  if (loadError || !agreement) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-amber-900/60 bg-amber-950/20 p-4">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <div>
          <p className="text-xs text-amber-200">{loadError ?? "No reviewer agreement is defined for this experiment."}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-2 rounded border border-amber-800/60 bg-amber-950/30 px-2 py-1 text-[11px] text-amber-100 hover:bg-amber-950/50"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ── PANEL 1 — REVIEW MANDATE ─────────────────────────────────────
          What you may do, and what you may not, stated BEFORE the ask. */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-100">Review mandate</h3>
        </div>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
          <dt className="text-slate-500">Experiment</dt>
          <dd className="text-slate-300">{agreement.experimentId}</dd>
          <dt className="text-slate-500">Agreement</dt>
          <dd className="text-slate-300">
            {agreement.agreementId} <span className="text-slate-500">({agreement.version})</span>
          </dd>
          <dt className="text-slate-500">Terms hash</dt>
          <dd className="font-mono text-slate-400">{agreement.agreementHash.slice(0, 16)}…</dd>
          <dt className="text-slate-500">Package scope</dt>
          <dd className="text-slate-300">
            {agreement.packageScope === "*" ? "All EXP-P1 review packages" : agreement.packageScope.join(", ")}
          </dd>
        </dl>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-300">
              <Check className="h-3.5 w-3.5" /> You may
            </div>
            <ul className="mt-1.5 space-y-1">
              {agreement.permittedActs.map((a) => (
                <li key={a} className="text-[11px] leading-snug text-slate-300">
                  · {a}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-rose-300">
              <Ban className="h-3.5 w-3.5" /> You may not
            </div>
            <ul className="mt-1.5 space-y-1">
              {agreement.prohibitedActs.map((a) => (
                <li key={a} className="text-[11px] leading-snug text-slate-400">
                  · {a}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* ── PANEL 2 — REVIEWER AGREEMENT ─────────────────────────────────── */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className={`h-4 w-4 ${authorized ? "text-emerald-400" : "text-slate-400"}`} />
            <h3 className="text-sm font-semibold text-slate-100">{agreement.displayLabel}</h3>
          </div>
          {authorized ? (
            <span className="shrink-0 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
              Authorized
            </span>
          ) : null}
        </div>

        <div className="mt-3 space-y-2.5">
          {agreement.clauses.map((c) => (
            <div key={c.id}>
              <div className="text-[11px] font-medium text-slate-200">{c.heading}</div>
              <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">{c.body}</p>
            </div>
          ))}
        </div>

        {authorized && authorization ? (
          <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
            <p className="text-[11px] text-emerald-200">
              You authorized {authorization.agreementVersion} on{" "}
              {new Date(authorization.authorizedAt).toLocaleString()}
              {authorization.conflictDeclared ? " with a declared conflict." : " with no conflict declared."}
            </p>
            <p className="mt-1 text-[10px] text-emerald-200/60">Reviewer reference: {authorization.reviewerRef}</p>
          </div>
        ) : (
          <div className="mt-4 space-y-3 border-t border-slate-800 pt-3">
            {failure === "hash-mismatch" || failure === "version-superseded" ? (
              <p className="text-[11px] text-amber-300">
                These terms have changed since you last authorized them. Your earlier authorization stays on the
                record, but new submissions need this version.
              </p>
            ) : null}

            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 shrink-0"
              />
              <span className="text-[11px] leading-snug text-slate-300">
                I have read these terms and accept the review mandate, its independence requirements and its
                consequence boundaries.
              </span>
            </label>

            <div>
              <div className="text-[11px] font-medium text-slate-300">Conflict disclosure</div>
              <div className="mt-1.5 flex gap-2">
                <button
                  type="button"
                  onClick={() => setConflictDeclared(false)}
                  className={`rounded-lg border px-3 py-1.5 text-[11px] transition-colors ${
                    conflictDeclared === false
                      ? "border-slate-600 bg-slate-800 text-slate-100"
                      : "border-slate-800 bg-slate-900/40 text-slate-400 hover:bg-slate-900/60"
                  }`}
                >
                  I have no conflict to declare
                </button>
                <button
                  type="button"
                  onClick={() => setConflictDeclared(true)}
                  className={`rounded-lg border px-3 py-1.5 text-[11px] transition-colors ${
                    conflictDeclared === true
                      ? "border-amber-700 bg-amber-950/40 text-amber-100"
                      : "border-slate-800 bg-slate-900/40 text-slate-400 hover:bg-slate-900/60"
                  }`}
                >
                  I have a conflict to declare
                </button>
              </div>
              {conflictDeclared === true ? (
                <textarea
                  value={conflictStatement}
                  onChange={(e) => setConflictStatement(e.target.value)}
                  rows={3}
                  placeholder="Describe the interest a reader would want to know about."
                  className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2 text-[11px] text-slate-100"
                />
              ) : null}
              <p className="mt-1.5 text-[10px] text-slate-500">
                Disclosure does not disqualify you. Concealment invalidates the review.
              </p>
            </div>

            {submitError ? <p className="text-[11px] text-amber-300">{submitError}</p> : null}

            <button
              type="button"
              onClick={() => void authorize()}
              disabled={
                submitting ||
                !acknowledged ||
                conflictDeclared === null ||
                (conflictDeclared === true && !conflictStatement.trim())
              }
              className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-2 text-xs font-medium text-slate-100 transition-colors hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
              {submitting ? "Authorizing…" : "Authorize agreement"}
            </button>
            <p className="text-[10px] text-slate-500">
              Authorizing records your consent to review. It does not submit a review, and confers no authority to
              freeze, publish or canonise anything.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ReviewerAgreementPanel;
