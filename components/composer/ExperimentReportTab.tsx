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
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, Loader2, RefreshCw } from "lucide-react";
import { experimentGet } from "./experimentStepFetch";

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

  return `# The Foundational Validation Series — Findings Report (Draft)

**Chrysalis Foundation / Invariant Intelligence · AigentZ platform**
**Status: CONFIDENTIAL DRAFT for strategic partners — not for publication or redistribution**
**Report generated: ${now.toISOString().slice(0, 10)} · data section reflects all canonically published runs to date**

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

---
*Draft report — regenerated live from the canonical results record at view
time. Narrative sections are amended as the series evolves; data tables
update automatically as runs are published.*
`;
}

export default function ExperimentReportTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<PublishedResult[]>([]);
  const [copied, setCopied] = useState(false);

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
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const report = useMemo(() => buildReport(results, new Date()), [results]);

  const copy = async () => {
    await navigator.clipboard.writeText(report);
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
          <button
            onClick={copy}
            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-700 hover:bg-indigo-600 px-3 py-1.5 text-xs text-white"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy report (markdown)"}
          </button>
          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh data
          </button>
        </div>
      </div>

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
          {report}
        </pre>
      )}
    </div>
  );
}
