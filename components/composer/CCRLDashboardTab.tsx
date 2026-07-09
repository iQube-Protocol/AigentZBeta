"use client";

/**
 * CCRL Dashboard — the front door of the Constitutional Cybernetics
 * Research Laboratory (CFS-019 Phase B).
 *
 * Live-computed, never asserted: programme status reads the Chrysalis Test
 * (admin-gated — degrades honestly when the caller isn't admin), recent
 * research output reads the canonical experiment_results publications.
 * Mission, layers, and roadmap are the charter's text (CFS-019).
 *
 * REFERENCE SURFACE for the Constitutional Representation System (CFS-021).
 * This is the FIRST progressive adoption: the whole tab is wrapped in ONE
 * tab-level `<RepresentationProvider>`, and every colour/type role is consumed
 * through `var(--rep-*)` (the CSS custom properties the provider injects) — NO
 * raw Tailwind colour literals remain (canary-enforced in
 * tests/ccrl-dashboard-adoption.test.ts). The interpretation switcher inside
 * the embedded RepresentationFieldPreview drives THIS provider, so flipping
 * Constitutional Civic Futurism ↔ High-Contrast reskins the ENTIRE dashboard
 * coherently — the constitutional field made visible, the environment a
 * Bearing Instrument can later operate within.
 */

import React, { useEffect, useState } from "react";
import { Beaker, BookOpen, FlaskConical, Landmark, Loader2, ShieldCheck, Compass, Palette } from "lucide-react";
import { experimentGet } from "./experimentStepFetch";
import {
  APPLIED_RESEARCH_CHAIN,
  RESEARCH_THEMES,
  OPEN_CONSTITUTIONAL_QUESTIONS,
  CONSTITUTIONAL_DISTINCTIONS,
} from "@/types/research";
import { RepresentationFieldPreview } from "@/components/representation/RepresentationFieldPreview";
import { RepresentationProvider, useSurfaceStyle } from "@/components/representation/RepresentationProvider";
import { BearingInstrument } from "@/components/representation/BearingInstrument";
import { CanonicalAssetRegistryPanel } from "@/components/representation/CanonicalAssetRegistryPanel";

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

interface OverviewEntry {
  experiment: { id: string; layer: string; family: string; seriesId: string };
  lifecycle: string;
  /** The receipted research-object state runs advance through the lifecycle
   * (research_objects) — null until a run materialises it. When present it is
   * the highlighted stage; the derived floor is the fallback. */
  persistedLifecycle: string | null;
  publishedRuns: number;
  distinctProviders: number;
  latestRunAt: string | null;
}

// Layer maturity denotes STANDING → the standing scale (roles, not literals):
//   I  Foundation complete   → standing.foundational
//   II Alpha                 → standing.validated
//   III Nascent (frontier)   → standing.experimental
const LAYERS = [
  {
    numeral: "I",
    name: "Invariant Intelligence",
    governs: "Constitutional knowledge — canon, invariants, fields, ontology, provenance, publication",
    status: "Foundation complete",
    tone: "text-[var(--rep-standing-foundational)] border-[var(--rep-standing-foundational)] bg-[var(--rep-surface-raised)]",
    evidence: "Seed crystal (9 namespaces) · Standing/Reach flywheel · resolver-wired glossary · Foundational Validation Series run",
  },
  {
    numeral: "II",
    name: "Constitutional Computing",
    governs: "Constitutional execution — policy-bound computation, workflows, delegation, consequence engineering, sovereignty",
    status: "Alpha",
    tone: "text-[var(--rep-standing-validated)] border-[var(--rep-standing-validated)] bg-[var(--rep-surface-raised)]",
    evidence: "Capability Pipeline · Improvement Loop · D1 deployment · coherence engine · Chrysalis Test live",
  },
  {
    numeral: "III",
    name: "Constitutional Cybernetics",
    governs: "Constitutional evolution — feedback, adaptation, learning, multi-agent governance, resilience",
    status: "Nascent — the frontier",
    tone: "text-[var(--rep-standing-experimental)] border-[var(--rep-standing-experimental)] bg-[var(--rep-surface-raised)]",
    evidence: "Improvement Loop ratified as contract · feedback/adaptation experiments are the CCRL's mandate",
  },
];

const EXPERIMENT_FAMILY: Record<string, string> = {
  "EXP-001": "Semantic Fidelity",
  "EXP-002": "Temporal Fidelity",
  "EXP-003": "Computational Efficiency",
  "EXP-004": "Constitutional Sovereignty",
  "EXP-005": "Provider Choice",
};

function CCRLDashboardContent() {
  const [results, setResults] = useState<ResultRow[] | null>(null);
  const [resultsError, setResultsError] = useState<string | null>(null);
  const [chrysalis, setChrysalis] = useState<ChrysalisSummary | null>(null);
  const [chrysalisNote, setChrysalisNote] = useState<string | null>(null);
  const [overview, setOverview] = useState<OverviewEntry[] | null>(null);
  const [lifecycleOrder, setLifecycleOrder] = useState<string[]>([]);

  // Panel MATERIAL from the active interpretation (CFS-021 §3;
  // inv.representation.129). One composed style for every panel: opaque matte
  // under a flat interpretation (CCF, High-Contrast), liquid glass under the
  // house style — SAME markup, material flows through roles not literals.
  const surface = useSurfaceStyle();

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
    (async () => {
      try {
        const data = await experimentGet("/api/research/overview");
        setOverview((data.experiments as OverviewEntry[]) ?? []);
        setLifecycleOrder((data.lifecycleOrder as string[]) ?? []);
      } catch {
        /* overview degrades silently — the results table below still renders */
      }
    })();
  }, []);

  return (
    <>
      {/* Mission */}
      <div className="rounded-xl p-5" style={surface}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <Landmark className="h-5 w-5 text-[var(--rep-accent-geometry)]" />
            <h2
              className="text-lg font-semibold text-[var(--rep-ink-body)]"
              style={{ fontFamily: "var(--rep-type-title)" }}
            >
              Constitutional Cybernetics Research Laboratory
            </h2>
          </div>
          {/* The Bearing Instrument (CFS-021 §5) operating WITHIN the reference
              field — "you are here in the Constitutional Field". Oriented to the
              CCRL's home sector, Intelligence (Layer I Invariant Intelligence is
              the lab's foundation), with the sectors the lab touches illuminated
              and its Foundational standing on the bezel. Consumes ONLY roles, so
              it reskins with the dashboard when the interpretation flips. It emits
              navigation INTENT (an observation, below) — it does not route; there
              are no Constitutional Plate destinations yet. */}
          <div className="shrink-0 flex flex-col items-center gap-1">
            <BearingInstrument
              label="CCRL"
              activeSector="intelligence"
              standing="foundational"
              relatedSectors={["reasoning", "knowledge", "consequence"]}
              onNavigate={(sector) =>
                // Navigation INTENT only — no plate destinations exist yet
                // (CFS-021 §5 follow-on). Record the intent; never fake a route.
                console.info(`[bearing] navigate-intent → ${sector} sector`)
              }
              size={92}
            />
            <span
              className="text-[10px] uppercase tracking-wide text-[var(--rep-ink-muted)]"
              style={{ fontFamily: "var(--rep-type-annotation)" }}
            >
              Bearing · you are here
            </span>
          </div>
        </div>
        <p className="mt-2 text-sm text-[var(--rep-ink-body)]">
          The constitutional scientific institution of the platform (CFS-019). Mission: establish
          Constitutional Cybernetics as an empirical engineering discipline through repeatable,
          auditable, constitutionally governed experimentation.
        </p>
        <p className="mt-2 text-xs text-[var(--rep-ink-muted)]">
          {/* The lab's principal claim — the single reserved gold emphasis (highlight.principal). */}
          <span className="font-semibold text-[var(--rep-highlight-principal)]">Central hypothesis:</span> Invariant Fields
          constitute measurable structures through which computational behaviour, constitutional
          coherence and consequence can be predicted, governed and experimentally validated.
        </p>
        <p className="mt-2 text-xs text-[var(--rep-ink-muted)] italic">
          The laboratory operates by the principles it investigates — its own operation is its first
          and permanent experiment (inv.cybernetics.110).
        </p>
      </div>

      {/* Programme status — live Chrysalis summary */}
      <div className="rounded-xl p-5" style={surface}>
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="h-4 w-4 text-[var(--rep-state-positive)]" />
          <h3 className="text-sm font-semibold text-[var(--rep-ink-body)]">Programme status (live — the Chrysalis Test)</h3>
        </div>
        {chrysalis ? (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Outcome tones → state roles (pass positive · partial caution · pending muted · fail critical). */}
            <span className="rounded px-2 py-1 bg-[var(--rep-surface-raised)] text-[var(--rep-state-positive)] border border-[var(--rep-state-positive)]">pass {chrysalis.passed}</span>
            <span className="rounded px-2 py-1 bg-[var(--rep-surface-raised)] text-[var(--rep-state-caution)] border border-[var(--rep-state-caution)]">partial {chrysalis.partial}</span>
            <span className="rounded px-2 py-1 bg-[var(--rep-surface-raised)] text-[var(--rep-ink-muted)] border border-[var(--rep-border-subtle)]">pending {chrysalis.pending}</span>
            <span className="rounded px-2 py-1 bg-[var(--rep-surface-raised)] text-[var(--rep-state-critical)] border border-[var(--rep-state-critical)]">fail {chrysalis.failed}</span>
            <span className="text-[var(--rep-ink-muted)]">of {chrysalis.total} acceptance criteria — full detail in the Experiment Laboratory's Chrysalis tab</span>
          </div>
        ) : chrysalisNote ? (
          <p className="text-xs text-[var(--rep-ink-muted)]">{chrysalisNote}</p>
        ) : (
          <div className="flex items-center gap-2 text-xs text-[var(--rep-ink-muted)]"><Loader2 className="h-3 w-3 animate-spin" /> computing…</div>
        )}
      </div>

      {/* The three constitutional layers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {LAYERS.map((l) => (
          <div key={l.numeral} className={`rounded-xl border p-4 ${l.tone}`}>
            <div className="text-xs font-semibold uppercase tracking-wide opacity-80">Layer {l.numeral}</div>
            <div className="text-sm font-semibold text-[var(--rep-ink-body)] mt-0.5">{l.name}</div>
            <div className="text-[11px] text-[var(--rep-ink-muted)] mt-1">{l.governs}</div>
            <div className="text-xs font-semibold mt-2">{l.status}</div>
            <div className="text-[11px] text-[var(--rep-ink-muted)] mt-1">{l.evidence}</div>
          </div>
        ))}
      </div>

      {/* Experiment lifecycles — derived from the canonical record */}
      {overview && overview.length > 0 && (
        <div className="rounded-xl p-5" style={surface}>
          <h3 className="text-sm font-semibold text-[var(--rep-ink-body)] mb-1">Experiment lifecycles (derived, never asserted)</h3>
          <p className="text-[11px] text-[var(--rep-ink-muted)] mb-3">
            Highlighted stage = the receipted research-object state (
            <code className="text-[var(--rep-ink-muted)]">research_objects</code>) — runs advance it through{" "}
            <code className="text-[var(--rep-ink-muted)]">research_lifecycle_transition</code>. Falls back to the
            derived floor (published = a canonical run exists · replicated = runs on ≥2 distinct
            providers) until a run materialises the object.
          </p>
          <div className="space-y-2">
            {overview.map((o) => {
              // The receipted state (runs advance it) is the truth to highlight;
              // the derived floor is the fallback until a run materialises it.
              const activeStage = o.persistedLifecycle ?? o.lifecycle;
              return (
              <div key={o.experiment.id} className="flex flex-wrap items-center gap-2 text-xs">
                <span className="w-20 font-semibold text-[var(--rep-ink-body)]">{o.experiment.id}</span>
                <span className="w-44 text-[var(--rep-ink-muted)]">{o.experiment.family}</span>
                <span className="flex items-center gap-1">
                  {lifecycleOrder.map((stage, i) => {
                    const reached = lifecycleOrder.indexOf(activeStage) >= i;
                    return (
                      <span
                        key={stage}
                        title={stage}
                        className={`rounded px-1.5 py-0.5 text-[10px] border ${
                          stage === activeStage
                            ? "bg-[var(--rep-surface-raised)] text-[var(--rep-accent-geometry)] border-[var(--rep-accent-geometry)] font-semibold"
                            : reached
                              ? "bg-[var(--rep-surface-raised)] text-[var(--rep-state-positive)] border-[var(--rep-border-subtle)]"
                              : "bg-[var(--rep-surface-base)] text-[var(--rep-ink-muted)] border-[var(--rep-border-subtle)]"
                        }`}
                      >
                        {stage}
                      </span>
                    );
                  })}
                </span>
                <span className="text-[var(--rep-ink-muted)]">
                  {o.publishedRuns} run{o.publishedRuns === 1 ? "" : "s"} · {o.distinctProviders} provider{o.distinctProviders === 1 ? "" : "s"}
                  {o.persistedLifecycle ? " · receipted" : ""}
                </span>
              </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent canonical publications (experiment results) */}
      <div className="rounded-xl p-5" style={surface}>
        <div className="flex items-center gap-2 mb-3">
          <FlaskConical className="h-4 w-4 text-[var(--rep-accent-geometry)]" />
          <h3 className="text-sm font-semibold text-[var(--rep-ink-body)]">Recent canonical results (hash-committed)</h3>
        </div>
        {results === null && !resultsError && (
          <div className="flex items-center gap-2 text-xs text-[var(--rep-ink-muted)]"><Loader2 className="h-3 w-3 animate-spin" /> loading…</div>
        )}
        {resultsError && <p className="text-xs text-[var(--rep-ink-muted)]">{resultsError}</p>}
        {results && results.length === 0 && (
          <p className="text-xs text-[var(--rep-ink-muted)]">No canonical results published yet — run the backfill in the Experiment Laboratory's Results tab.</p>
        )}
        {results && results.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-[var(--rep-ink-muted)]">
                <tr>
                  <th className="text-left py-1 pr-3">Experiment</th>
                  <th className="text-left py-1 pr-3">Family</th>
                  <th className="text-left py-1 pr-3">Provider · model</th>
                  <th className="text-left py-1 pr-3">Commitment</th>
                  <th className="text-left py-1 pr-3">Receipt</th>
                  <th className="text-left py-1">Published</th>
                </tr>
              </thead>
              <tbody className="text-[var(--rep-ink-body)]">
                {results.slice(0, 8).map((r) => (
                  <tr key={r.id} className="border-t border-[var(--rep-border-subtle)]">
                    <td className="py-1.5 pr-3 font-semibold">{r.experiment}</td>
                    <td className="py-1.5 pr-3">{EXPERIMENT_FAMILY[r.experiment] ?? "—"}</td>
                    <td className="py-1.5 pr-3">{r.provider} · {r.model}</td>
                    <td className="py-1.5 pr-3 font-mono text-[var(--rep-ink-muted)]">{r.contentHash.slice(0, 12)}…</td>
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
      <div className="rounded-xl p-5" style={surface}>
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="h-4 w-4 text-[var(--rep-ink-body)]" />
          <h3 className="text-sm font-semibold text-[var(--rep-ink-body)]">Roadmap (CFS-019 §8)</h3>
        </div>
        <ul className="space-y-1.5 text-xs text-[var(--rep-ink-body)]">
          <li><span className="text-[var(--rep-state-positive)] font-semibold">A — delivered:</span> charter + vocabulary (Constitutional Cybernetics, inv.cybernetics.108–111)</li>
          <li><span className="text-[var(--rep-state-positive)] font-semibold">B — this surface:</span> the CCRL as canonical research surface over all existing assets</li>
          <li><span className="text-[var(--rep-ink-muted)] font-semibold">C:</span> research object model + lifecycles (receipted transitions) + Aigent Z research orchestration</li>
          <li><span className="text-[var(--rep-ink-muted)] font-semibold">D:</span> physical migration into the CCRL pack (atomic, path-inventory-driven)</li>
          <li><span className="text-[var(--rep-ink-muted)] font-semibold">E:</span> Invariant Field Explorer · resequencing views · Layer-III experiments (feedback, adaptation, multi-agent)</li>
        </ul>
        <p className="mt-3 text-[11px] text-[var(--rep-ink-muted)] flex items-center gap-1.5">
          <Beaker className="h-3 w-3" />
          Experiment series: Foundational Validation (EXP-001–004, run) · Platform Sovereignty PSE-1..5 (PSE-1 built; 2–5 named, designed before spend — CFS-018)
        </p>
      </div>

      {/* Constitutional Representation System — the representation-invariant field (CFS-021) */}
      <div className="rounded-xl p-5" style={surface}>
        <div className="flex items-center gap-2 mb-1">
          <Palette className="h-4 w-4 text-[var(--rep-ink-body)]" />
          <h3 className="text-sm font-semibold text-[var(--rep-ink-body)]">Constitutional Representation System (CFS-021)</h3>
        </div>
        <p className="text-[11px] text-[var(--rep-ink-muted)] mb-4">
          The system is the invariant <span className="text-[var(--rep-ink-body)]">contract</span> (roles · relationships · semantics); a
          style is one <span className="text-[var(--rep-ink-body)]">interpretation</span> that must satisfy it. Constitutional Civic Futurism
          is interpretation v1, never the definition. Flip the interpretation and watch this entire dashboard — the standing scale, the
          field sectors, every card — reskin coherently. Every element above and below consumes a ROLE, never a raw value.
        </p>
        {/* The switcher inside this preview drives the TAB-LEVEL provider — flipping the
            interpretation reskins the whole reference surface, not just this widget. */}
        <RepresentationFieldPreview />
      </div>

      {/* Research agenda — Research Roadmap Expansion (CFS-019 amendment 2026-07-07) */}
      <div className="rounded-xl p-5" style={surface}>
        <div className="flex items-center gap-2 mb-1">
          <Compass className="h-4 w-4 text-[var(--rep-ink-body)]" />
          <h3 className="text-sm font-semibold text-[var(--rep-ink-body)]">Research agenda — Applied Constitutional Research</h3>
        </div>
        <p className="text-[11px] text-[var(--rep-ink-muted)] mb-3">
          Research aims at constitutional capabilities that can be implemented, validated, and integrated — implementation
          is part of research. Preferred outcome chain:{" "}
          <span className="text-[var(--rep-ink-body)] font-mono">{APPLIED_RESEARCH_CHAIN.join(" → ")}</span>
        </p>
        <div className="text-xs text-[var(--rep-ink-body)]">
          <div className="mb-1">
            {/* Programme D is the Reasoning Systems sector → field.reasoning. */}
            <span className="text-[var(--rep-field-reasoning)] font-semibold">Programme D — Reasoning Systems</span>{" "}
            <span className="text-[var(--rep-ink-muted)]">(exploratory · long-term · hypothesis-driven)</span>
          </div>
          <ul className="space-y-1 mb-3">
            {RESEARCH_THEMES.map((t) => (
              <li key={t.id}>
                <span className="text-[var(--rep-ink-body)] font-semibold">{t.title}:</span>{" "}
                <span className="text-[var(--rep-ink-muted)]">{t.investigate.join(", ")}</span>
              </li>
            ))}
          </ul>
          <div className="mb-1 text-[var(--rep-ink-muted)] font-semibold">Open constitutional questions (kept as hypotheses, not conclusions)</div>
          <ul className="space-y-0.5 mb-3 list-disc list-inside text-[var(--rep-ink-muted)]">
            {OPEN_CONSTITUTIONAL_QUESTIONS.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </div>
        <p className="text-[11px] text-[var(--rep-ink-muted)]">
          <span className="font-semibold text-[var(--rep-ink-muted)]">Research method (guidance, not a law):</span>{" "}
          progress comes from finding the correct constitutional distinctions, then validating them experimentally —{" "}
          {CONSTITUTIONAL_DISTINCTIONS.join(" · ")}
        </p>
      </div>

      {/* Canonical Asset Registry (CFS-022a §2) — the frozen assets the
          Composition engine retrieves, incl. the Bearing Instrument mounted in
          the header above, browsable as first-class constitutional objects. */}
      <CanonicalAssetRegistryPanel />
    </>
  );
}

/**
 * The reference surface: ONE tab-level RepresentationProvider (default
 * interpretation = Constitutional Civic Futurism) injects every `--rep-*` role
 * as a CSS variable at the dashboard root, so every element below consumes
 * roles via `var(--rep-*)` and the interpretation switcher reskins the whole
 * environment. The provider's own div carries the dashboard's layout classes
 * (space-y-6 max-w-5xl) plus the field ground (surface.base) — no extra nesting,
 * no layout change.
 */
export default function CCRLDashboardTab() {
  return (
    <RepresentationProvider className="space-y-6 max-w-5xl bg-[var(--rep-surface-base)]">
      <CCRLDashboardContent />
    </RepresentationProvider>
  );
}
