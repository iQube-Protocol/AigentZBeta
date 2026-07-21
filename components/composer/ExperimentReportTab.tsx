"use client";

/**
 * Experiment Lab — Report tab: the consolidated Foundational Validation
 * Series report, draft-grade, built for confidential sharing with strategic
 * partners via COPY (deliberately not a public URL for now).
 *
 * The report is composed as one markdown string, SEQUENCED BY THE PLATFORM'S
 * OWN COMPOSITION LAWS (dogfooding EXP-002's finding that composition obeys a
 * sequential narrative law + a global coherence field):
 *   - Experiments are emitted in canonical `EXPERIMENT_REGISTRY` order, grouped
 *     under their `SERIES_REGISTRY` series — so the body is a single ordered
 *     spine, never a narrated head + an appended out-of-order tail.
 *   - The introduction is GENERATED from the same registry + the live record
 *     (a programme map of every series and its members' status), so the intro
 *     and the body can never drift — global coherence, not a frozen "three
 *     experiments" preamble.
 *   - An experiment with no canonical runs yet is shown honestly in its correct
 *     slot as "publication pending" rather than dropped (so e.g. EXP-005 appears
 *     between EXP-004 and EXP-006, never silently missing).
 * Authored narrative (aim/methodology/execution/findings) is threaded in where
 * we have it; the data section for each experiment injects live from the
 * canonical published results (/api/experiments/results — the hash-committed,
 * DVN-anchorable records). Rendered text and copied text are the SAME string,
 * so what a partner receives is exactly what the operator reviewed.
 *
 * Research Briefing mode (Aletheon review, CFS-019 institute-standing
 * amendment 2026-07-06): wraps the UNCHANGED findings report in the formal
 * package — Cover → Letter from the Director (a TEMPLATE for the operator's
 * own voice, never ghost-written as final) → Executive Memorandum slot →
 * Findings Report → Appendix (protocols, raw data, architecture, repository,
 * DVN verification). Same copy-based confidentiality discipline; the
 * findings-report generation logic is not altered.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, Loader2, RefreshCw, Sparkles, ShieldCheck } from "lucide-react";
import { experimentGet, experimentStep } from "./experimentStepFetch";
import { composeFindingsReport, type ReportRun } from "@/services/research/findingsReportComposer";

interface PublishedResult {
  id: string;
  experiment: string;
  provider: string;
  model: string;
  aggregates: Record<string, unknown>;
  contentHash: string;
  receiptStatus: string | null;
  createdAt: string;
}

// The live draft maps published results to the shared, deterministic composer —
// the SAME composition the canonical server regeneration uses (no drift, no LLM).
function buildReport(results: PublishedResult[], now: Date): string {
  const runsByExp: Record<string, ReportRun[]> = {};
  for (const r of results) {
    (runsByExp[r.experiment] ??= []).push({
      provider: r.provider,
      model: r.model,
      aggregates: r.aggregates,
      contentHash: r.contentHash,
      receiptStatus: r.receiptStatus,
      createdAt: r.createdAt,
    });
  }
  return composeFindingsReport({ runsByExp, now });
}

/**
 * Research Briefing (formal package) — prepends the Aletheon-reviewed
 * packaging around the findings report, which passes through UNCHANGED.
 * The cover banner name is Aletheon's proposed EXTERNAL presentation;
 * adoption is a pending operator decision (CFS-019 naming note).
 */
function buildBriefing(report: string): string {
  return `# The Invariant Intelligence Research Institute

## Foundational Validation Series

### Executive Briefing

**July 2026 · Confidential**

---

## Letter from the Director

> **[TEMPLATE — DRAFT FOR THE OPERATOR'S OWN VOICE. Replace every bracketed
> paragraph before sharing; do not send as-is. One page, human,
> non-technical, non-fundraising.]**

Dear colleague,

[Paragraph 1 — why the institute exists: in your own words, the decision to
build an instrument because the research demanded one — the platform serves
the research, not the reverse.]

[Paragraph 2 — why the question matters: in your own words, why "how does
knowledge itself behave as a computational object" is worth a research
institute — preservation, composition, and reasoning-compression as
measurable properties.]

[Paragraph 3 — why they're receiving this: in your own words, why this
specific reader, and what you are (and are not) asking of them.]

[Sign-off in your own hand.]

---

## Executive Memorandum

> **[SLOT — insert the executive memorandum draft here before sharing.]**

---

${report}
---

## Appendix — Protocols, Data, and Verification

- **Experiment protocols** (full design docs, in-repo):
  - EXP-001 — \`codexes/packs/irl/foundation/experiments/exp-001-living-knowledgeqube/README.md\`
  - EXP-002 — \`codexes/packs/irl/foundation/experiments/exp-002-invariant-video/README.md\`
  - EXP-003 — \`codexes/packs/irl/foundation/experiments/exp-003-rediscovery-savings/README.md\`
- **Raw result records**: every published run's exact results JSON is stored
  with its sha256 content commitment and is available on request under the
  same confidentiality; the data tables in the findings report above are
  generated live from those records.
- **Experimental architecture**: the constitutional foundation corpus
  (charters, composition laws, coherence engine, invariant ontology) lives at
  \`codexes/packs/irl/foundation/\` — CFS-019 is the laboratory charter.
- **Repository**: the platform repository housing the corpus, runners, and
  results pipeline is available for inspection on request.
- **DVN verification**: each published run is anchored via a DVN-anchorable
  receipt on the platform's Decentralised Verification Network pipeline.
  Verification is mechanical: recompute sha256 over the stored results text
  and compare with the anchored commitment — the platform's Results
  interface performs this check in-browser.

*Confidential — not for publication or redistribution.*
`;
}

export default function ExperimentReportTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<PublishedResult[]>([]);
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<"report" | "briefing">("report");
  // Canonical (regenerated + DVN-receipted) report versions — the narrative is
  // regenerated from the COLLECTIVE findings and saved as a verifiable version.
  interface CanonVersion { version: number; title: string; content: string; contentHash: string; receiptId: string | null; createdAt: string; publishedAt?: string | null }
  const [canonical, setCanonical] = useState<CanonVersion | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [regenNote, setRegenNote] = useState<string | null>(null);
  const [source, setSource] = useState<"live" | "canonical">("live");
  // Stage 3 — publish the canonical version to the public Publications → Reports tab.
  const [publishing, setPublishing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await experimentGet("/api/experiments/results");
      setResults(data.results as PublishedResult[]);
    } catch (err) {
      // The report still renders with empty data tables if the results
      // store isn't available — narrative stands on its own.
      setError(err instanceof Error ? err.message : "Failed to load published results");
      setResults([]);
    } finally {
      setLoading(false);
    }
    // Latest canonical version (best-effort).
    try {
      const cv = await experimentGet("/api/research/report/regenerate?scope=all");
      const latest = Array.isArray(cv.versions) && cv.versions.length ? cv.versions[0] : null;
      if (latest) { setCanonical(latest as CanonVersion); setSource("canonical"); }
    } catch {
      // No canonical version yet — the live draft stands.
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const regenerate = useCallback(async () => {
    setRegenerating(true);
    setRegenNote(null);
    try {
      const res = await experimentStep("/api/research/report/regenerate", { scope: "all" });
      setCanonical({ version: res.version as number, title: res.title as string, content: res.content as string, contentHash: res.contentHash as string, receiptId: (res.receiptId as string | null) ?? null, createdAt: new Date().toISOString() });
      setSource("canonical");
      setRegenNote(`Canonical v${res.version} regenerated${res.receiptId ? ` · receipt ${String(res.receiptId).slice(0, 12)}…` : ""}`);
    } catch (err) {
      setRegenNote(`⚠ ${err instanceof Error ? err.message : "regeneration failed"}`);
    } finally {
      setRegenerating(false);
    }
  }, []);

  const togglePublish = useCallback(async () => {
    if (!canonical) return;
    setPublishing(true);
    setRegenNote(null);
    const publish = !canonical.publishedAt;
    try {
      const res = await experimentStep("/api/research/report/publish", { scope: "all", version: canonical.version, publish });
      setCanonical({ ...canonical, publishedAt: (res.publishedAt as string | null) ?? null });
      setRegenNote(publish
        ? `Canonical v${canonical.version} PUBLISHED — now visible in Publications → Reports`
        : `Canonical v${canonical.version} unpublished (withdrawn from the public tab; canonical record intact)`);
    } catch (err) {
      setRegenNote(`⚠ ${err instanceof Error ? err.message : "publish failed"}`);
    } finally {
      setPublishing(false);
    }
  }, [canonical]);

  const mintReceipt = useCallback(async () => {
    if (!canonical) return;
    setPublishing(true);
    setRegenNote(null);
    try {
      const res = await experimentStep("/api/research/report/regenerate", { scope: "all", version: canonical.version }, "PATCH");
      setCanonical({ ...canonical, receiptId: (res.receiptId as string | null) ?? null });
      setRegenNote(`Receipt minted for v${canonical.version} — you can now publish`);
    } catch (err) {
      setRegenNote(`⚠ ${err instanceof Error ? err.message : "receipt mint failed"}`);
    } finally {
      setPublishing(false);
    }
  }, [canonical]);

  const liveReport = useMemo(() => buildReport(results, new Date()), [results]);
  const report = source === "canonical" && canonical ? canonical.content : liveReport;
  const sharedText = useMemo(() => (mode === "briefing" ? buildBriefing(report) : report), [mode, report]);

  const copy = async () => {
    await navigator.clipboard.writeText(sharedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          Consolidated series report — <span className="text-amber-300">confidential draft for strategic partners</span>.
          Data tables inject live from the canonical results record; copy shares exactly what you see.
        </p>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-slate-700 overflow-hidden">
            <button
              onClick={() => setMode("report")}
              className={`px-2.5 py-1.5 text-xs ${mode === "report" ? "bg-slate-700 text-white" : "text-slate-400 hover:bg-slate-800"}`}
            >
              Findings report
            </button>
            <button
              onClick={() => setMode("briefing")}
              className={`px-2.5 py-1.5 text-xs ${mode === "briefing" ? "bg-slate-700 text-white" : "text-slate-400 hover:bg-slate-800"}`}
            >
              Research Briefing (formal package)
            </button>
          </div>
          <button
            onClick={copy}
            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-700 hover:bg-indigo-600 px-3 py-1.5 text-xs text-white"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : mode === "briefing" ? "Copy briefing (markdown)" : "Copy report (markdown)"}
          </button>
          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh data
          </button>
        </div>
      </div>

      {/* Canonical report — the whole narrative regenerated from the collective
          findings, saved as a DVN-receipted version (not appended). */}
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-800 bg-slate-950/40 px-3 py-2">
        <span className="text-[11px] uppercase tracking-wide text-slate-500">Report source</span>
        <div className="inline-flex rounded-md border border-slate-700 overflow-hidden">
          <button
            onClick={() => setSource("live")}
            className={`px-2.5 py-1 text-xs ${source === "live" ? "bg-slate-700 text-white" : "text-slate-400 hover:bg-slate-800"}`}
          >
            Live draft
          </button>
          <button
            onClick={() => canonical && setSource("canonical")}
            disabled={!canonical}
            className={`px-2.5 py-1 text-xs disabled:opacity-40 ${source === "canonical" ? "bg-slate-700 text-white" : "text-slate-400 hover:bg-slate-800"}`}
          >
            {canonical ? `Canonical v${canonical.version}` : "Canonical (none yet)"}
          </button>
        </div>
        {canonical && source === "canonical" && (
          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
            <ShieldCheck className="h-3 w-3" />
            sha256 {canonical.contentHash.slice(0, 12)}…{canonical.receiptId ? ` · DVN receipt ${String(canonical.receiptId).slice(0, 10)}…` : " · receipt pending"}
          </span>
        )}
        <button
          onClick={regenerate}
          disabled={regenerating}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-indigo-500/40 bg-indigo-500/15 px-2.5 py-1 text-xs font-semibold text-indigo-100 hover:bg-indigo-500/25 transition disabled:opacity-50"
          title="Regenerate the whole narrative from the collective canonical findings and save a new DVN-receipted version"
        >
          {regenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {regenerating ? "Regenerating…" : "Regenerate canonical report"}
        </button>
        {canonical && !canonical.publishedAt && !canonical.receiptId && (
          <button
            onClick={mintReceipt}
            disabled={publishing}
            className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-100 transition hover:bg-amber-500/25 disabled:opacity-50"
            title="This version has no publication receipt yet — mint the DVN-anchorable receipt so it can be published (no regenerate, hash unchanged)"
          >
            {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
            {publishing ? "Minting…" : `Mint receipt for v${canonical.version}`}
          </button>
        )}
        {canonical && (canonical.publishedAt || canonical.receiptId) && (
          <button
            onClick={togglePublish}
            disabled={publishing}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold transition disabled:opacity-50 ${
              canonical.publishedAt
                ? "border-slate-600 bg-slate-800/60 text-slate-300 hover:bg-slate-700/60"
                : "border-emerald-500/40 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25"
            }`}
            title={canonical.publishedAt
              ? `Published ${new Date(canonical.publishedAt).toLocaleDateString()} — click to withdraw from the public Publications → Reports tab`
              : "Publish this canonical version to the public Publications → Reports tab"}
          >
            {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
            {publishing ? "Working…" : canonical.publishedAt ? `Published v${canonical.version} · Unpublish` : `Publish v${canonical.version}`}
          </button>
        )}
        {regenNote && <span className="basis-full text-[10px] text-slate-400">{regenNote}</span>}
      </div>

      {mode === "briefing" && (
        <p className="text-xs text-slate-500">
          The Letter from the Director is a <span className="text-amber-300">template for the operator&apos;s own voice</span> —
          replace every bracketed paragraph and the memorandum slot before sharing. The institute banner
          (&ldquo;The Invariant Intelligence Research Institute&rdquo;) is Aletheon&apos;s proposed external name;
          adoption is a pending operator decision (CFS-019 naming note).
        </p>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-400 py-4 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading canonical results…
        </div>
      )}
      {error && (
        <p className="text-xs text-amber-400">
          Published-results data unavailable ({error}) — report renders with empty data tables.
        </p>
      )}

      {!loading && (
        <pre className="whitespace-pre-wrap break-words rounded-lg border border-slate-800 bg-slate-950/60 p-4 text-[12px] leading-relaxed text-slate-300 font-mono">
          {sharedText}
        </pre>
      )}
    </div>
  );
}
