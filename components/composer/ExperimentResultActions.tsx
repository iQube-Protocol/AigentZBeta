"use client";

/**
 * ExperimentResultActions — the GLOBAL save + copy footer for every experiment
 * runner (operator 2026-07-20: a completed run needs to be both saved AND
 * copied out for offline analysis; the ask was to make this uniform across the
 * lab rather than per-runner).
 *
 * - SAVE follows the same contract as before: admins publish straight to canon;
 *   a reviewer saves privately, or submits for steward approval when they opt in.
 *   Reuses the shared `experimentStep` transport (personaFetch/spine-authed) and
 *   fires the run-lifecycle event on success.
 * - COPY writes the exact result payload as pretty JSON to the clipboard — the
 *   raw per-intent data (predicted / reference / deltas) an external reviewer
 *   needs to inspect error structure. Copy is CLIENT-ONLY: it never touches the
 *   DB or quota, so it always works even when save is gated or offline. Uses an
 *   iframe-safe fallback (`navigator.clipboard` can be blocked inside the embed
 *   viewer), so copy works on every surface the lab mounts in.
 *
 * Drop this in place of a runner's inline publish block: pass the same
 * experiment / provider / model / aggregates / results you would have POSTed,
 * plus a one-line lifecycle summary.
 */

import React, { useState } from "react";
import { Upload, Copy, Check } from "lucide-react";
import { experimentStep, recordRunLifecycle, lifecycleNote, publishStatePrefix } from "./experimentStepFetch";
import { RequestPublishControl } from "./RequestPublishControl";

export interface ExperimentResultActionsProps {
  experiment: string;
  provider: string;
  model: string;
  aggregates: Record<string, unknown>;
  /** The full structured result — saved verbatim AND the basis for Copy. */
  results: unknown;
  /** One-line evidence recorded to the run-lifecycle on a successful save. */
  lifecycleSummary: string;
  /** Reviewers may request public publication; admins always publish to canon. */
  canRequestPublish?: boolean;
  /** Disable both actions (e.g. while the run is still executing). */
  disabled?: boolean;
}

/** Copy text to the clipboard with an iframe-safe fallback. */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the execCommand path — clipboard API is often blocked in iframes */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    ta.style.pointerEvents = "none";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function ExperimentResultActions({
  experiment,
  provider,
  model,
  aggregates,
  results,
  lifecycleSummary,
  canRequestPublish = false,
  disabled = false,
}: ExperimentResultActionsProps) {
  const [publishState, setPublishState] = useState<string | null>(null);
  const [requestPublish, setRequestPublish] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyErr, setCopyErr] = useState<string | null>(null);

  const save = async () => {
    setPublishState("publishing");
    try {
      const data = await experimentStep("/api/experiments/results", {
        experiment,
        provider,
        model,
        requestPublish: canRequestPublish && requestPublish,
        aggregates,
        results,
      });
      const publishedMsg = `${publishStatePrefix(data.visibility)} — sha256 ${String(data.contentHash ?? "").slice(0, 12)}…`;
      setPublishState(publishedMsg);
      const lc = await recordRunLifecycle(experiment, "results-published", lifecycleSummary);
      setPublishState(`${publishedMsg} · ${lifecycleNote(lc)}`);
    } catch (err) {
      setPublishState(err instanceof Error ? err.message : "save failed");
    }
  };

  const copy = async () => {
    setCopyErr(null);
    const payload = JSON.stringify(results, null, 2);
    const ok = await copyToClipboard(payload);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } else {
      setCopyErr("copy blocked — select the JSON below and copy manually");
    }
  };

  const busy = publishState === "publishing";

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={save}
          disabled={disabled || busy}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-50"
        >
          <Upload className="h-3.5 w-3.5" />
          {busy ? "Saving…" : canRequestPublish ? (requestPublish ? "Submit for publication" : "Save result") : "Publish canonically"}
        </button>
        <button
          onClick={copy}
          disabled={disabled}
          title="Copy the full result payload (aggregate + per-intent rows) as JSON"
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-50"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy results"}
        </button>
      </div>
      {canRequestPublish && (
        <div className="mt-2">
          <RequestPublishControl requestPublish={requestPublish} onChange={setRequestPublish} disabled={busy} />
        </div>
      )}
      {publishState && !busy && <p className="mt-1 text-xs text-slate-400">{publishState}</p>}
      {copyErr && <p className="mt-1 text-xs text-amber-300/80">{copyErr}</p>}
    </div>
  );
}

export default ExperimentResultActions;
