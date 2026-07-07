"use client";

/**
 * Experiment Lab — Results tab: the canonical, auditable record of published
 * Foundational Validation Series runs.
 *
 * Trust model: every published run stores the EXACT results JSON string and
 * its sha256 (a content commitment carried in a DVN-anchorable
 * `experiment_result_published` receipt). Verification here is TRUSTLESS:
 * the browser recomputes sha256 over the stored text via SubtleCrypto and
 * compares against the anchored hash — no server assertion is taken on
 * faith. The DVN chip shows the anchor's lifecycle
 * (local → dvn_pending → dvn_recorded).
 */

import React, { useCallback, useEffect, useState } from "react";
import { Download, History, Loader2, RefreshCw, ShieldCheck, ShieldX } from "lucide-react";
import { experimentGet, experimentStep, recordRunLifecycle } from "./experimentStepFetch";

interface PublishedResult {
  id: string;
  experiment: string;
  provider: string;
  model: string;
  aggregates: Record<string, unknown>;
  resultsJson: string;
  contentHash: string;
  receiptId: string | null;
  receiptStatus: string | null;
  dvnReceiptId: string | null;
  createdAt: string;
}

const DVN_CHIP: Record<string, string> = {
  local: "bg-slate-800 text-slate-400",
  dvn_pending: "bg-amber-900/50 text-amber-300",
  dvn_recorded: "bg-emerald-900/50 text-emerald-300",
  dvn_failed: "bg-rose-900/50 text-rose-300",
};

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default function ExperimentResultsTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<PublishedResult[]>([]);
  // id → 'verified' | 'mismatch' | 'verifying'
  const [verify, setVerify] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillNote, setBackfillNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await experimentGet("/api/experiments/results");
      setRows(data.results as PublishedResult[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load results");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Publish the repo-bundled historical run records (run-1 EXP-001/EXP-003,
  // EXP-002 run-2) through the same canonical pipeline. Idempotent server-side
  // (skips already-published content hashes), so safe to press repeatedly.
  const backfill = async () => {
    setBackfilling(true);
    setBackfillNote(null);
    try {
      const data = await experimentStep("/api/experiments/results/backfill", {});
      const outcomes = (data.outcomes as { experiment: string; published: boolean; skipped: boolean }[]) ?? [];
      const published = outcomes.filter((o) => o.published).map((o) => o.experiment);
      const skipped = outcomes.filter((o) => o.skipped).map((o) => o.experiment);
      // Instruments ↔ institution (CFS-019): a canonical publication advances
      // the experiment's research object one legal step. Covers EXP-002 (whose
      // canonical record enters via backfill, not a per-run publish) and any
      // other backfilled run. Fire-and-forget — never disturbs the backfill.
      const advanced: string[] = [];
      for (const exp of published) {
        const lc = await recordRunLifecycle(exp, "results-published", `${exp} run published via backfill`);
        if (lc?.ok && lc.to) advanced.push(`${exp} ${lc.from}→${lc.to}`);
      }
      setBackfillNote(
        [
          published.length ? `published: ${published.join(", ")}` : null,
          skipped.length ? `already present: ${skipped.join(", ")}` : null,
          advanced.length ? `lifecycle: ${advanced.join(", ")}` : null,
        ]
          .filter(Boolean)
          .join(" · ") || "nothing to backfill",
      );
      await load();
    } catch (err) {
      setBackfillNote(err instanceof Error ? err.message : "backfill failed");
    } finally {
      setBackfilling(false);
    }
  };

  const verifyRow = async (row: PublishedResult) => {
    setVerify((v) => ({ ...v, [row.id]: "verifying" }));
    const hash = await sha256Hex(row.resultsJson);
    setVerify((v) => ({ ...v, [row.id]: hash === row.contentHash ? "verified" : "mismatch" }));
  };

  const download = (row: PublishedResult) => {
    const blob = new Blob([row.resultsJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${row.experiment.toLowerCase()}-${row.createdAt.slice(0, 10)}-${row.contentHash.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-slate-400">
          Canonically published runs. Each row stores the exact results JSON and its sha256 content
          commitment, anchored via a DVN-anchorable <code className="text-slate-300">experiment_result_published</code> receipt.
          <span className="text-slate-300"> Verify recomputes the hash in your browser</span> — trustless,
          no server assertion taken on faith.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={backfill}
            disabled={backfilling}
            className="inline-flex items-center gap-1.5 rounded-md border border-indigo-800 bg-indigo-950/40 px-2.5 py-1.5 text-xs text-indigo-300 hover:bg-indigo-900/40"
            title="Publish the repo-bundled historical run records (run-1 EXP-001/EXP-003, EXP-002 run-2) — idempotent"
          >
            <History className="h-3.5 w-3.5" /> {backfilling ? "Backfilling…" : "Backfill historical runs"}
          </button>
          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
      </div>
      {backfillNote && <p className="text-xs text-slate-400">{backfillNote}</p>}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-400 py-8 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading published results…
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-300">{error}</div>
      )}
      {!loading && !error && rows.length === 0 && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6 text-center text-sm text-slate-500">
          Nothing published yet. Run an experiment in the other tabs, then use its
          &ldquo;Publish canonically&rdquo; button.
        </div>
      )}

      {rows.map((row) => (
        <div key={row.id} className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-indigo-950/60 border border-indigo-800 px-2 py-0.5 text-xs text-indigo-300">
              {row.experiment}
            </span>
            <span className="text-xs text-slate-400">{row.provider} / {row.model}</span>
            <span className="text-xs text-slate-600">{new Date(row.createdAt).toLocaleString()}</span>
            <span className={`rounded px-2 py-0.5 text-[10px] ${DVN_CHIP[row.receiptStatus ?? "local"] ?? DVN_CHIP.local}`}>
              {row.receiptStatus ?? "no receipt"}
            </span>
            {verify[row.id] === "verified" && (
              <span className="inline-flex items-center gap-1 rounded bg-emerald-900/50 px-2 py-0.5 text-[10px] text-emerald-300">
                <ShieldCheck className="h-3 w-3" /> hash verified in-browser
              </span>
            )}
            {verify[row.id] === "mismatch" && (
              <span className="inline-flex items-center gap-1 rounded bg-rose-900/50 px-2 py-0.5 text-[10px] text-rose-300">
                <ShieldX className="h-3 w-3" /> HASH MISMATCH — content altered
              </span>
            )}
          </div>

          <div className="font-mono text-[11px] text-slate-500 break-all">sha256: {row.contentHash}</div>

          {Object.keys(row.aggregates ?? {}).length > 0 && (
            <div className="text-xs text-slate-400">
              {Object.entries(row.aggregates).map(([k, v]) => (
                <span key={k} className="mr-3">
                  {k}: <span className="text-slate-300">{typeof v === "number" ? Number(v.toFixed ? v.toFixed(3) : v) : String(v)}</span>
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => verifyRow(row)}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-800"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              {verify[row.id] === "verifying" ? "Verifying…" : "Verify hash"}
            </button>
            <button
              onClick={() => download(row)}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-800"
            >
              <Download className="h-3.5 w-3.5" /> Download JSON
            </button>
            <button
              onClick={() => setExpanded(expanded === row.id ? null : row.id)}
              className="rounded-md border border-slate-700 px-2.5 py-1 text-xs text-slate-400 hover:bg-slate-800"
            >
              {expanded === row.id ? "Hide raw" : "View raw"}
            </button>
          </div>

          {expanded === row.id && (
            <pre className="max-h-80 overflow-auto rounded border border-slate-800 bg-slate-950 p-2 text-[10px] text-slate-400 whitespace-pre-wrap break-all">
              {row.resultsJson}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}
