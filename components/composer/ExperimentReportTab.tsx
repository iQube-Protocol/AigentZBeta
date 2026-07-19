"use client";

/**
 * Experiment Lab — Report tab: the consolidated Foundational Validation
 * Series report, draft-grade, built for confidential sharing with strategic
 * partners via COPY (deliberately not a public URL for now).
 *
 * The report is composed as one markdown string: authored narrative
 * (introduction, per-experiment aim/methodology/execution/findings, current
 * state) + a dynamic data section injected from the canonical published
 * results (/api/experiments/results — the hash-committed, DVN-anchorable
 * records). Because the data section is live, re-running or publishing new
 * experiment instances updates the report automatically; the narrative is
 * updated by amendment as conclusions evolve. Rendered text and copied text
 * are the SAME string, so what a partner receives is exactly what the
 * operator reviewed.
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

function aggLine(agg: Record<string, unknown>): string {
  return Object.entries(agg ?? {})
    .filter(([k]) => k !== "note")
    .map(([k, v]) => `${k}: ${typeof v === "number" ? Math.round(v * 1000) / 1000 : String(v)}`)
    .join(" · ");
}

function runsTable(rows: PublishedResult[]): string {
  if (rows.length === 0) return "_No canonical runs published yet for this experiment._\n";
  const lines = [
    "| Published | Provider / model | Aggregates | Content commitment (sha256) | DVN |",
    "|---|---|---|---|---|",
  ];
  for (const r of rows) {
    lines.push(
      `| ${new Date(r.createdAt).toISOString().slice(0, 10)} | ${r.provider} / ${r.model} | ${aggLine(r.aggregates) || "—"} | \`${r.contentHash.slice(0, 16)}…\` | ${r.receiptStatus ?? "local"} |`,
    );
  }
  return lines.join("\n") + "\n";
}

function buildReport(results: PublishedResult[], now: Date): string {
  const byExp = (id: string) => results.filter((r) => r.experiment === id);
  const legStatus = (id: string, label: string) =>
    byExp(id).length > 0 ? `${label}: **validated** (${byExp(id).length} canonical run${byExp(id).length > 1 ? "s" : ""} published)` : `${label}: run complete, canonical publication pending`;

  // Self-extending: the FVS narrative (§3–§5) is authored prose for EXP-001/002/003,
  // but ANY other experiment with canonically published runs (EXP-004 sovereignty
  // and beyond) is surfaced automatically — so a newly-published experiment appears
  // in the report without a template edit. (A full "compose which experiments are
  // published" mechanism follows in the Artifact Runtime workstream, CFS-025.)
  // Live freshness signal — the true latest canonical run across ALL experiments,
  // so the report never reads as frozen at an authored-prose date.
  const latestRunDate =
    results.length > 0
      ? new Date(Math.max(...results.map((r) => new Date(r.createdAt).getTime()))).toISOString().slice(0, 10)
      : null;
  const distinctExpCount = new Set(results.map((r) => r.experiment)).size;

  const FVS_IDS = new Set(["EXP-001", "EXP-002", "EXP-003"]);
  const extraIds = Array.from(new Set(results.map((r) => r.experiment)))
    .filter((id) => !FVS_IDS.has(id))
    .sort();
  const extraSection =
    extraIds.length === 0
      ? ""
      : `
## 9. Additional experiments (auto-included from the canonical record)

Beyond the Foundational Validation Series, these experiments have canonically
published runs. This section is generated live from the results record — any
newly-published experiment appears here automatically, with its real run dates.

${extraIds
  .map(
    (id) => `### ${id}

**Canonical runs:**
${runsTable(byExp(id))}`,
  )
  .join("\n")}`;

  return `# The Foundational Validation Series — Findings Report (Draft)

**Chrysalis Foundation / Invariant Intelligence · AigentZ platform**
**Status: CONFIDENTIAL DRAFT for strategic partners — not for publication or redistribution**
**Report generated: ${now.toISOString().slice(0, 10)} · Latest canonical run: ${latestRunDate ?? "none yet"} · ${results.length} published run${results.length === 1 ? "" : "s"} across ${distinctExpCount} experiment${distinctExpCount === 1 ? "" : "s"}**
*Run tables below render live from the canonical record; dated prose in §§3–5 describes the original validation runs and is amended as decisions evolve.*

---

## 1. Introduction — what is being validated

The platform's core knowledge primitive is the **invariant**: a versioned,
provenance-bearing statement of validated knowledge (e.g. *"Authority follows
standing"*), stored in a graph, classified by an ontology, and composed by
per-class composition laws into experiences — articles, reports, stories,
video, agent behaviour. The claim under test is **reasoning compression**:
that a curated collection of validated invariants functions as compressed,
reusable expertise which (a) survives transformation across modalities,
(b) survives composition across time, and (c) measurably reduces the cost of
reasoning while improving its fidelity.

Three orthogonal experiments test the same 18-invariant constitutional
collection (the "Living KnowledgeQube") along those three axes:

| Experiment | Property | Question |
|---|---|---|
| EXP-001 | Semantic fidelity | Does one invariant collection render faithfully across article, report, story, and infographic — without inventing what it does not contain? |
| EXP-002 | Temporal fidelity | Do invariants sustain coherent, style- and narrative-constrained productions across time (multi-segment generated video)? |
| EXP-003 | Computational efficiency | Does initializing a model with the collection reduce reasoning cost versus deriving the same answers cold? |

Every run is a separate experiment instance — provider and model are recorded
with each result and cross-model rows are never merged.

**Current series state:**
- ${legStatus("EXP-001", "EXP-001 (semantic fidelity)")}
- ${legStatus("EXP-002", "EXP-002 (temporal fidelity)")}
- ${legStatus("EXP-003", "EXP-003 (computational efficiency)")}

## 2. Trust model — why the numbers are auditable

Every published run stores its **exact results JSON** and a sha256 content
commitment over that exact text, anchored via a DVN-anchorable
(\`experiment_result_published\`) receipt on the platform's Decentralised
Verification Network pipeline. Verification is trustless and mechanical:
recompute sha256 over the stored text and compare with the anchored hash —
the platform's Results interface does this in-browser, taking no server
assertion on faith. The hashes in the data tables below are those
commitments.

## 3. EXP-001 — Semantic fidelity (the Living KnowledgeQube)

**Aim.** Render one 18-invariant constitutional collection into four text
artifacts (canonical article, technical report, narrative story,
infographic spec) and test whether an independent judge can recover the same
substantive answers from every rendering — and whether the artifacts refuse
to assert what the collection does not contain.

**Methodology.** 15 questions per artifact, including 3 adversarial
"hallucination probes" whose correct answer is NOT DERIVABLE. An independent
judge model (different provider from the author) scores consistency,
explainability (citation-traceability to invariant markers), hallucination,
and coherence. Machine verdicts are then human-adjudicated; adjudication can
only lower scores or dissolve machine flags with recorded reasons.

**Execution (run 1, 2026-07-04).** Judge: venice/llama-3.3-70b, temperature 0.

**Findings (adjudicated).** Consistency 1.83 (target ≥ 1.8); explainability
1.95 (≥ 1.6); artifact-attributable hallucinations 0; coherence 2.0;
**constitutional restraint 15/15 (100%)** — every probe across every document
correctly returned NOT DERIVABLE. The artifacts did not merely preserve what
the collection says; they refused to invent what it does not. Both
machine-raised hallucination flags dissolved under adjudication (one judge
false-positive, one judge retrieval failure — the latter scored honestly
against the run's consistency rather than the artifacts).

**Canonical runs:**
${runsTable(byExp("EXP-001"))}
## 4. EXP-002 — Temporal fidelity (invariant-carried video)

**Aim.** Compose one brief from the invariant substrate — semantic
invariants distributed across segments, a 7-invariant style continuity block
shared identically, a 5-beat narrative arc mapped sequentially — and test
whether coherence survives four independent 12-second video generations
stitched into one 48-second film.

**Methodology.** The brief is machine-composed by per-class composition laws
(distributive × global × sequential) and validated pre-render by a
Constitutional Coherence Engine scoring semantic, style, and narrative
dimensions. Generation runs on a production video provider; segments stitch
in the recorded play order. A **sequencing control arm** re-stitches the
identical clips in reversed order.

**Execution (run 2, 2026-07-05).** Provider: openai/sora-2, 4×12s.
(Run 1, 2026-07-04, validated the composition+coherence half and caught a
real narrative-mapping defect pre-render — fixed same day.)

**Findings.**
- Complete continuity of narrative, protagonist, settings, and constitutional
  context across all four independently generated segments (operator
  evaluation + frame-level review; formal independent-evaluator pass open).
- The recurring constitutional symbol persisted across three segments in
  three different material implementations (necklace, lapel pin, wall
  banner) — and was correctly absent from the one segment whose narrative
  context didn't call for it. Motif persistence modulated by narrative
  appropriateness: the style and narrative fields solved simultaneously.
- Character persistence held at the class level but not the instance level
  (facial phenotype varied between segments) — a measured granularity
  ceiling of prose-based identity continuity, now a ratified backlog item.
- **Control arm:** the reversed cut is distinctly less coherent while world,
  style, and semantic content stay intact — the dissociation signature of a
  pure sequencing failure. Two refinements were ratified from it: temporal
  correctness is *graded, not boolean* ("sequence is scored, not validated" —
  the designed order is a coherence maximum over the space of orderings),
  and local pairwise coherence survives a global order violation. A
  follow-up (EXP-002b) maps the coherence field's shape via adjacent-swap
  perturbations at zero generation cost.

**Canonical runs:**
${runsTable(byExp("EXP-002"))}
## 5. EXP-003 — Computational efficiency (rediscovery savings)

**Aim.** Quantify the cost of *not* having validated knowledge: five fixed
constitutional-design tasks answered twice by the same model at temperature
0 — once cold, once initialized with the 18-invariant collection.

**Methodology.** Per-task token accounting (input + output) plus an
independent judge decomposing each answer into claims scored consistent /
contradicting / outside the collection, and citation counting against
invariant markers. The efficiency claim requires the initialized arm to be
cheaper AND more grounded, not merely shorter.

**Execution (run 1, 2026-07-04).** Model: venice/llama-3.3-70b, both arms.

**Findings.** Initialized answers used **26.7% fewer tokens** with **100%
grounded claims** (zero contradictions of the collection) and dense
citations; cold answers were longer, uncited, and — most tellingly — one
cold answer **independently rediscovered a failure mode the collection
already encodes** (conflating standing with popularity, the platform's
ratified Law XII distinction) and got it wrong, while the initialized arm
avoided it by construction. Pre-paid reasoning eliminated the rediscovery.

**Canonical runs:**
${runsTable(byExp("EXP-003"))}
## 6. Cross-cutting conclusions (current)

1. **The same primitive validated along three orthogonal axes.** Semantic
   fidelity across modalities, temporal fidelity across sequential
   composition, and measurable reasoning-cost reduction — one collection,
   three independent properties.
2. **Constitutional restraint is a distinct, measurable property.** Refusing
   to derive what the knowledge does not contain (15/15 probes) is separable
   from avoiding false assertions — and it is the property that makes
   invariant-grounded systems auditable.
3. **Composition is where both failures and validations live.** Every defect
   found by the series lived in an *interaction between fields* (a narrative
   beat lost in segment mapping; audio overrunning a segment boundary), never
   in a single component — and the validators built on that principle caught
   a real defect before a single frame was generated.
4. **Sequence is scored, not validated.** The reversed-order control showed
   temporal coherence is a graded field over orderings with the designed
   sequence as its maximum — opening constrained resequencing (remix as an
   alternative coherent trajectory through the same invariant space) as a
   legitimate, scoreable operation.

## 7. Limitations, stated plainly

- Single-model runs to date (one OSS model for the text legs; one video
  provider) — deltas are within-model; constants are not universals.
  Cross-model replication is the first scale-up step.
- The judge is a model; machine verdicts required human adjudication twice
  (both instructive, both recorded).
- EXP-002's formal independent-evaluator pass is open; current findings are
  operator-evaluated with frame evidence.
- The collection was authored by the platform's own constitutional process —
  task-collection affinity is by design; cross-domain generalization untested.

## 8. What we're inviting partners to do

The next tier of rigor needs scale we intend to reach with partners: larger
task sets, multiple judge models, cross-domain collections, more permutation
coverage for the temporal-coherence field map (EXP-002b), and independent
replication of the initialization deltas. The full experiment protocols,
artifacts, and raw result records are available on request under the same
confidentiality.
${extraSection}
---
*Draft report — regenerated live from the canonical results record at view
time. Narrative sections are amended as the series evolves; data tables
update automatically as runs are published.*
`;
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
