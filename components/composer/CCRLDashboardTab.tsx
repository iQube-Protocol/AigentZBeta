"use client";

/**
 * CCRL Dashboard — the front door of the Constitutional Cybernetics
 * Research Laboratory (CFS-019 Phase B).
 *
 * Live-computed, never asserted: programme status reads the Chrysalis Test
 * (admin-gated — degrades honestly when the caller isn't admin), recent
 * research output reads the canonical experiment_results publications.
 * Mission, layers, and roadmap are the charter's text (CFS-019).
 */

import React, { useEffect, useState } from "react";
import { Beaker, BookOpen, FlaskConical, Landmark, Loader2, ShieldCheck } from "lucide-react";
import { experimentGet } from "./experimentStepFetch";

interface ResultRow {
  id: string;
  experiment: string;
  provider: string;
  model: string;
  aggregates: Record<string, unknown> | null;
  contentHash: string;
  receiptStatus: string | null;
  createdAt: string;
}

interface ChrysalisSummary {
  passed: number;
  partial: number;
  pending: number;
  failed: number;
  total: number;
}

const LAYERS = [
  {
    numeral: "I",
    name: "Invariant Intelligence",
    governs: "Constitutional knowledge — canon, invariants, fields, ontology, provenance, publication",
    status: "Foundation complete",
    tone: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10",
    evidence: "Seed crystal (9 namespaces) · Standing/Reach flywheel · resolver-wired glossary · Foundational Validation Series run",
  },
  {
    numeral: "II",
    name: "Constitutional Computing",
    governs: "Constitutional execution — policy-bound computation, workflows, delegation, consequence engineering, sovereignty",
    status: "Alpha",
    tone: "text-sky-300 border-sky-500/30 bg-sky-500/10",
    evidence: "Capability Pipeline · Improvement Loop · D1 deployment · coherence engine · Chrysalis Test live",
  },
  {
    numeral: "III",
    name: "Constitutional Cybernetics",
    governs: "Constitutional evolution — feedback, adaptation, learning, multi-agent governance, resilience",
    status: "Nascent — the frontier",
    tone: "text-amber-300 border-amber-500/30 bg-amber-500/10",
    evidence: "Improvement Loop ratified as contract · feedback/adaptation experiments are the CCRL's mandate",
  },
];

const EXPERIMENT_FAMILY: Record<string, string> = {
  "EXP-001": "Semantic Fidelity",
  "EXP-002": "Temporal Fidelity",
  "EXP-003": "Computational Efficiency",
  "EXP-004": "Constitutional Sovereignty",
};

export default function CCRLDashboardTab() {
  const [results, setResults] = useState<ResultRow[] | null>(null);
  const [resultsError, setResultsError] = useState<string | null>(null);
  const [chrysalis, setChrysalis] = useState<ChrysalisSummary | null>(null);
  const [chrysalisNote, setChrysalisNote] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await experimentGet("/api/experiments/results");
        setResults((data.results as ResultRow[]) ?? []);
      } catch (err) {
        setResultsError(err instanceof Error ? err.message : "results unavailable");
      }
    })();
    (async () => {
      try {
        const data = await experimentGet("/api/constitutional/chrysalis-test");
        setChrysalis((data.summary as ChrysalisSummary) ?? null);
      } catch (err) {
        // Admin-gated — degrade honestly for non-admin researchers.
        setChrysalisNote(err instanceof Error ? err.message : "programme status requires admin");
      }
    })();
  }, []);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Mission */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <div className="flex items-center gap-2">
          <Landmark className="h-5 w-5 text-indigo-300" />
          <h2 className="text-lg font-semibold text-slate-100">Constitutional Cybernetics Research Laboratory</h2>
        </div>
        <p className="mt-2 text-sm text-slate-300">
          The constitutional scientific institution of the platform (CFS-019). Mission: establish
          Constitutional Cybernetics as an empirical engineering discipline through repeatable,
          auditable, constitutionally governed experimentation.
        </p>
        <p className="mt-2 text-xs text-slate-400">
          <span className="font-semibold text-slate-300">Central hypothesis:</span> Invariant Fields
          constitute measurable structures through which computational behaviour, constitutional
          coherence and consequence can be predicted, governed and experimentally validated.
        </p>
        <p className="mt-2 text-xs text-slate-500 italic">
          The laboratory operates by the principles it investigates — its own operation is its first
          and permanent experiment (inv.cybernetics.110).
        </p>
      </div>

      {/* Programme status — live Chrysalis summary */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="h-4 w-4 text-emerald-300" />
          <h3 className="text-sm font-semibold text-slate-100">Programme status (live — the Chrysalis Test)</h3>
        </div>
        {chrysalis ? (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded px-2 py-1 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">pass {chrysalis.passed}</span>
            <span className="rounded px-2 py-1 bg-sky-500/15 text-sky-300 border border-sky-500/30">partial {chrysalis.partial}</span>
            <span className="rounded px-2 py-1 bg-slate-500/15 text-slate-300 border border-slate-500/30">pending {chrysalis.pending}</span>
            <span className="rounded px-2 py-1 bg-rose-500/15 text-rose-300 border border-rose-500/30">fail {chrysalis.failed}</span>
            <span className="text-slate-500">of {chrysalis.total} acceptance criteria — full detail in the Experiment Laboratory's Chrysalis tab</span>
          </div>
        ) : chrysalisNote ? (
          <p className="text-xs text-slate-500">{chrysalisNote}</p>
        ) : (
          <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-3 w-3 animate-spin" /> computing…</div>
        )}
      </div>

      {/* The three constitutional layers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {LAYERS.map((l) => (
          <div key={l.numeral} className={`rounded-xl border p-4 ${l.tone}`}>
            <div className="text-xs font-semibold uppercase tracking-wide opacity-80">Layer {l.numeral}</div>
            <div className="text-sm font-semibold text-slate-100 mt-0.5">{l.name}</div>
            <div className="text-[11px] text-slate-400 mt-1">{l.governs}</div>
            <div className="text-xs font-semibold mt-2">{l.status}</div>
            <div className="text-[11px] text-slate-500 mt-1">{l.evidence}</div>
          </div>
        ))}
      </div>

      {/* Recent canonical publications (experiment results) */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <div className="flex items-center gap-2 mb-3">
          <FlaskConical className="h-4 w-4 text-indigo-300" />
          <h3 className="text-sm font-semibold text-slate-100">Recent canonical results (hash-committed)</h3>
        </div>
        {results === null && !resultsError && (
          <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-3 w-3 animate-spin" /> loading…</div>
        )}
        {resultsError && <p className="text-xs text-slate-500">{resultsError}</p>}
        {results && results.length === 0 && (
          <p className="text-xs text-slate-500">No canonical results published yet — run the backfill in the Experiment Laboratory's Results tab.</p>
        )}
        {results && results.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-slate-500">
                <tr>
                  <th className="text-left py-1 pr-3">Experiment</th>
                  <th className="text-left py-1 pr-3">Family</th>
                  <th className="text-left py-1 pr-3">Provider · model</th>
                  <th className="text-left py-1 pr-3">Commitment</th>
                  <th className="text-left py-1 pr-3">Receipt</th>
                  <th className="text-left py-1">Published</th>
                </tr>
              </thead>
              <tbody className="text-slate-300">
                {results.slice(0, 8).map((r) => (
                  <tr key={r.id} className="border-t border-slate-800">
                    <td className="py-1.5 pr-3 font-semibold">{r.experiment}</td>
                    <td className="py-1.5 pr-3">{EXPERIMENT_FAMILY[r.experiment] ?? "—"}</td>
                    <td className="py-1.5 pr-3">{r.provider} · {r.model}</td>
                    <td className="py-1.5 pr-3 font-mono text-slate-400">{r.contentHash.slice(0, 12)}…</td>
                    <td className="py-1.5 pr-3">{r.receiptStatus ?? "—"}</td>
                    <td className="py-1.5">{new Date(r.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Roadmap */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="h-4 w-4 text-slate-300" />
          <h3 className="text-sm font-semibold text-slate-100">Roadmap (CFS-019 §8)</h3>
        </div>
        <ul className="space-y-1.5 text-xs text-slate-300">
          <li><span className="text-emerald-300 font-semibold">A — delivered:</span> charter + vocabulary (Constitutional Cybernetics, inv.cybernetics.108–111)</li>
          <li><span className="text-emerald-300 font-semibold">B — this surface:</span> the CCRL as canonical research surface over all existing assets</li>
          <li><span className="text-slate-400 font-semibold">C:</span> research object model + lifecycles (receipted transitions) + Aigent Z research orchestration</li>
          <li><span className="text-slate-400 font-semibold">D:</span> physical migration into the CCRL pack (atomic, path-inventory-driven)</li>
          <li><span className="text-slate-400 font-semibold">E:</span> Invariant Field Explorer · resequencing views · Layer-III experiments (feedback, adaptation, multi-agent)</li>
        </ul>
        <p className="mt-3 text-[11px] text-slate-500 flex items-center gap-1.5">
          <Beaker className="h-3 w-3" />
          Experiment series: Foundational Validation (EXP-001–004, run) · Platform Sovereignty PSE-1..5 (PSE-1 built; 2–5 named, designed before spend — CFS-018)
        </p>
      </div>
    </div>
  );
}
