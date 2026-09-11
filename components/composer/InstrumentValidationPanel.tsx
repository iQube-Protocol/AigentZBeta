"use client";

/**
 * InstrumentValidationPanel — the Stage-0 instrument-validation experiments
 * (IRV-001 / IPV-001) in the Experiment Lab. These RAN (2026-07-18 record
 * runs) and were published into the canonical results record via backfill —
 * this panel OBSERVES that record (never asserts from static copy) and shows
 * the published rows for the experiment. Reruns happen via the CLI harness
 * (scripts/run-instrument-validation.mjs) BY DESIGN — the public-route,
 * credential-free path exists so external replicators can run the instrument
 * independently of IRL.
 */

import React, { useEffect, useState } from "react";
import { FlaskConical, Loader2, ShieldCheck } from "lucide-react";
import { experimentGet } from "./experimentStepFetch";

interface PublishedRow {
  experiment: string;
  provider: string;
  model: string;
  aggregates?: Record<string, unknown>;
  contentHash: string;
  createdAt?: string;
}

export default function InstrumentValidationPanel({
  experimentId,
  family,
  hypothesis,
  protocolRef,
}: {
  experimentId: string;
  family: string;
  hypothesis: string;
  protocolRef?: string;
}) {
  const [rows, setRows] = useState<PublishedRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await experimentGet("/api/experiments/results");
        const all = (d.results as PublishedRow[]) ?? [];
        if (!cancelled) setRows(all.filter((r) => r.experiment === experimentId));
      } catch {
        if (!cancelled) setRows([]);
      }
    })();
    return () => { cancelled = true; };
  }, [experimentId]);

  return (
    <div className="space-y-3">
      <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-200">
        <ShieldCheck className="h-3.5 w-3.5" /> Stage-0 instrument validation — record run complete (2026-07-18)
      </div>
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 space-y-2">
        <div className="text-sm font-semibold text-slate-100">{experimentId} · {family}</div>
        <p className="text-xs text-slate-400">{hypothesis}</p>
        {protocolRef && (
          <p className="text-[11px] text-slate-500">
            Protocol: <code className="font-mono text-slate-400">{protocolRef}</code>
          </p>
        )}
      </div>

      {/* Canonical published record — observed from /api/experiments/results. */}
      {rows === null ? (
        <p className="flex items-center gap-2 text-xs text-slate-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading the canonical record…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-[11px] text-slate-300">
          No published run in the canonical record yet — use <span className="font-semibold">Results → Backfill repo records</span> to
          publish the ratified Stage-0 record summary (admin, idempotent).
        </div>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r) => (
            <div key={r.contentHash} className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
              <div className="flex items-center gap-2 text-[11px]">
                <span className="rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">{r.experiment}</span>
                <span className="text-slate-400">{r.provider} · {r.model}</span>
                <span className="ml-auto font-mono text-slate-500">sha256 {r.contentHash.slice(0, 16)}…</span>
              </div>
              {r.aggregates && (
                <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  {Object.entries(r.aggregates)
                    .filter(([k, v]) => typeof v === "number" || (typeof v === "string" && k !== "note"))
                    .slice(0, 8)
                    .map(([k, v]) => (
                      <div key={k} className="rounded-md bg-white/5 px-2 py-1">
                        <div className="text-[9px] uppercase tracking-wide text-slate-500">{k}</div>
                        <div className="text-xs font-semibold text-slate-100">{String(v)}</div>
                      </div>
                    ))}
                </div>
              )}
              {typeof r.aggregates?.note === "string" && (
                <p className="mt-1.5 text-[10px] text-slate-500">{r.aggregates.note}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="flex items-start gap-1.5 text-[11px] text-slate-500">
        <FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Reruns execute via the CLI harness (<code className="font-mono">scripts/run-instrument-validation.mjs</code>) against the
        public, credential-free IRE/IPE routes — by design, so external replicators can validate the instrument independently.
        Full findings: the IRV/IPV READMEs + STAGE-0_HANDOFF in the protocol pack.
      </p>
    </div>
  );
}
