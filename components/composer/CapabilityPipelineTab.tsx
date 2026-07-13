"use client";

/**
 * Capability Pipeline tab — Aigent Z as the development interface, v1
 * (CFS-015 Strand Two Phase One).
 *
 * The operator states a capability goal; the Constitutional Capability
 * Pipeline's early stages run (intent → context → consequence-drafted
 * implementation artifact) and the Implementation Pack — the
 * artifact-before-implementation — renders with full constitutional
 * provenance: invariant bindings, resolved terms, mechanism (one of nine;
 * code is not privileged), validation + receipt plans, composedBy honesty
 * badge. Hand-off is COPY-based (byte-identical markdown, Report-tab
 * discipline) to any implementation provider — Claude Code today. Deploy
 * wiring is deliberately absent (operator-gated, later phase per Law XI).
 *
 * Stage strip: stages this v1 exercises are lit; risk/value/price render as
 * honest `unevaluated` chips (MaybeEvaluated discipline — their services are
 * ratified stubs).
 */

import React, { useMemo, useState } from "react";
import { Check, Copy, Hammer, Loader2 } from "lucide-react";
import { CONSTITUTIONAL_CAPABILITY_PIPELINE } from "@/types/constitutional";
import { experimentStep } from "./experimentStepFetch";

export interface PackView {
  id: string;
  intentId: string | null;
  goal: string;
  invariantBindings: { id: string; seedId: string | null; statement: string }[];
  resolvedTerms: { term: string; canonical: string; source: string; invariantIds: string[] }[];
  areasToTouch: string[];
  implementationMechanism: string;
  validationPlan: string[];
  receiptPlan: string[];
  canonVersion: string;
  generatedAt: string;
  composedBy: "llm" | "template";
  preflight: {
    disposition: "proceed" | "escalate";
    forcesEscalation: boolean;
    enables: number;
    constrains: number;
    contradicts: number;
    rationale: string;
    risk: { score: number; flags: string[]; basis: string };
    value: { workPotentialQc: number; basis: string };
  } | null;
  /** The dev-loop session's what-exists-vs-needed inventory, when a session
   * drove the generation (workflow-gap fix 2026-07-13). */
  sessionFindings?: {
    existing?: { name: string; path?: string; disposition?: string }[];
    missing?: { name: string; path?: string; complexity?: string; dependencies?: string[] }[];
    contextAssets?: { title: string; path?: string; signal?: string }[];
    reusePercent?: number;
    boundaries?: string[];
  } | null;
}

// Which pipeline stages this surface exercises. risk/value/consequence
// light up when the pack carries a consequence preflight (CFS-006a organs,
// heuristic-labeled); price remains the honest unevaluated stub (PriceQube
// unratified).
const BASE_LIVE_STAGES = new Set(["intent", "context", "implementation"]);
const PREFLIGHT_STAGES = new Set(["risk", "value", "consequence"]);
const STUB_STAGES = new Set(["price"]);

export function packMarkdown(pack: PackView): string {
  return `# Implementation Pack — ${pack.goal}

**Generated:** ${pack.generatedAt} · **Composed by:** ${pack.composedBy} · **Canon version:** ${pack.canonVersion}
**Mechanism:** ${pack.implementationMechanism} (capability-first — code is one of nine mechanisms)
${pack.intentId ? `**Intent:** ${pack.intentId}\n` : ""}
## Invariant bindings (constitutional grounding)
${pack.invariantBindings.map((b) => `- ${b.seedId ? `[${b.seedId}] ` : ""}${b.statement}`).join("\n") || "_none resolved_"}

## Resolved canonical terms
${pack.resolvedTerms.map((t) => `- "${t.term}" → **${t.canonical}**${t.invariantIds.length ? ` (governed by ${t.invariantIds.join(", ")})` : ""}`).join("\n") || "_none_"}

## Areas to touch
${pack.areasToTouch.map((a) => `- ${a}`).join("\n") || "_not drafted (template pack — determine during implementation)_"}
${
  pack.sessionFindings &&
  ((pack.sessionFindings.existing?.length ?? 0) > 0 || (pack.sessionFindings.missing?.length ?? 0) > 0)
    ? `
## What exists vs what is needed (from the dev-loop session${typeof pack.sessionFindings.reusePercent === "number" ? ` · ${pack.sessionFindings.reusePercent}% reuse` : ""})
${(pack.sessionFindings.existing ?? []).map((e) => `- EXISTING · ${e.name}${e.path ? ` — \`${e.path}\`` : ""}${e.disposition ? ` [${e.disposition}]` : ""}`).join("\n")}
${(pack.sessionFindings.missing ?? []).map((m) => `- MISSING · ${m.name}${m.path ? ` — \`${m.path}\`` : ""}${m.complexity ? ` (${m.complexity})` : ""}${m.dependencies?.length ? ` deps: ${m.dependencies.join(", ")}` : ""}`).join("\n")}
${(pack.sessionFindings.boundaries ?? []).map((b) => `- NEVER · ${b}`).join("\n")}`
    : ""
}

## Validation plan
${pack.validationPlan.map((v) => `- ${v}`).join("\n")}

## Receipt plan
${pack.receiptPlan.map((r) => `- ${r}`).join("\n")}

## Consequence preflight${pack.preflight ? "" : " — not available for this pack"}
${
  pack.preflight
    ? [
        `- Disposition: **${pack.preflight.disposition}**${pack.preflight.forcesEscalation ? " (forces escalation — human ratification required before implementation)" : ""}`,
        `- Forecast: enables ${pack.preflight.enables} · constrains ${pack.preflight.constrains} · contradicts ${pack.preflight.contradicts}`,
        `- Rationale: ${pack.preflight.rationale}`,
        `- Risk: ${pack.preflight.risk.score}/100 (${pack.preflight.risk.basis})${pack.preflight.risk.flags.length ? ` — flags: ${pack.preflight.risk.flags.join(", ")}` : ""}`,
        `- Value: $${(pack.preflight.value.workPotentialQc / 100).toFixed(2)} (${pack.preflight.value.workPotentialQc} Q¢, ${pack.preflight.value.basis} work-potential)`,
      ].join("\n")
    : "_preflight could not run — pack shipped without it (best-effort by design)_"
}

---
*Artifact-before-implementation (CFS-015 Constitutional Capability Pipeline). The pack's generation was receipted (\`implementation_pack_generated\`, DVN-anchorable) with its invariant bindings recorded as \`invariants_used\`.*
`;
}

export default function CapabilityPipelineTab() {
  const [goal, setGoal] = useState("");
  const [domains, setDomains] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pack, setPack] = useState<PackView | null>(null);
  const [copied, setCopied] = useState(false);
  // D1 (CFS-016 v1.0): propose-deployment section state. Execution stays
  // human — this records the provenance chain, nothing more.
  const [commitRange, setCommitRange] = useState("");
  const [validationNotes, setValidationNotes] = useState("");
  const [touchesProtected, setTouchesProtected] = useState(false);
  const [proposing, setProposing] = useState(false);
  const [proposal, setProposal] = useState<string | null>(null);

  const markdown = useMemo(() => (pack ? packMarkdown(pack) : ""), [pack]);

  const generate = async () => {
    setGenerating(true);
    setError(null);
    setPack(null);
    try {
      const data = await experimentStep("/api/constitutional/implementation-pack", {
        goal: goal.trim(),
        domains: domains.trim() ? domains.split(",").map((d) => d.trim()).filter(Boolean) : undefined,
      });
      setPack(data.pack as PackView);
      setProposal(null);
      setCommitRange("");
      setValidationNotes("");
      setTouchesProtected(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pack generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const propose = async () => {
    if (!pack) return;
    setProposing(true);
    setProposal(null);
    try {
      const data = await experimentStep("/api/constitutional/deployment-proposal", {
        packId: pack.id,
        goal: pack.goal,
        commitRange: commitRange.trim(),
        validationNotes,
        touchesProtectedFiles: touchesProtected,
      });
      setProposal(`Proposed — receipt ${String(data.receiptId).slice(0, 8)}… · ${String(data.d1Semantics)}`);
    } catch (err) {
      setProposal(err instanceof Error ? err.message : "proposal failed");
    } finally {
      setProposing(false);
    }
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">Constitutional Capability Pipeline</h2>
        <p className="text-sm text-slate-400 mt-1">
          State a capability goal; the pipeline grounds it in the invariant substrate and produces the
          Implementation Pack — the artifact-before-implementation. Hand the pack to any implementation
          provider; every generation is receipted and DVN-anchorable.
        </p>
      </div>

      {/* Stage strip — honest about what's live vs ratified stubs. */}
      <div className="flex flex-wrap items-center gap-1">
        {CONSTITUTIONAL_CAPABILITY_PIPELINE.map((stage, i) => {
          const preflightLit = PREFLIGHT_STAGES.has(stage) && Boolean(pack?.preflight);
          const lit = BASE_LIVE_STAGES.has(stage) || preflightLit;
          return (
            <React.Fragment key={stage}>
              {i > 0 && <span className="text-slate-700 text-xs">→</span>}
              <span
                className={`rounded px-2 py-0.5 text-[10px] ${
                  lit
                    ? "bg-indigo-950/60 border border-indigo-800 text-indigo-300"
                    : STUB_STAGES.has(stage)
                      ? "bg-slate-900 border border-slate-800 text-slate-500"
                      : "bg-slate-900/50 border border-slate-800 text-slate-400"
                }`}
                title={
                  STUB_STAGES.has(stage)
                    ? "Ratified stub — returns unevaluated until its service ships (MaybeEvaluated discipline)"
                    : PREFLIGHT_STAGES.has(stage) && !pack?.preflight
                      ? "Lights when a pack's consequence preflight runs (heuristic-labeled)"
                      : undefined
                }
              >
                {stage}
                {STUB_STAGES.has(stage) ? " · unevaluated" : preflightLit ? " · heuristic" : ""}
              </span>
            </React.Fragment>
          );
        })}
      </div>

      <div className="space-y-2">
        <label className="block text-sm text-slate-300">
          Capability goal
          <textarea
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 text-sm"
            rows={3}
            placeholder="e.g. Add a per-persona export of activity receipts as a verifiable JSON bundle, honouring identifier-tier rules"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
          />
        </label>
        <label className="block text-sm text-slate-300">
          Context domains <span className="text-xs text-slate-500">(optional, comma-separated — scopes the invariant grounding)</span>
          <input
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 text-sm"
            placeholder="e.g. governance, receipts"
            value={domains}
            onChange={(e) => setDomains(e.target.value)}
          />
        </label>
        <button
          onClick={generate}
          disabled={generating || !goal.trim()}
          className="inline-flex items-center gap-1.5 rounded-md bg-indigo-700 hover:bg-indigo-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Hammer className="h-4 w-4" />}
          {generating ? "Generating pack…" : "Generate Implementation Pack"}
        </button>
      </div>

      {error && <div className="rounded-lg border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-300">{error}</div>}

      {pack && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-indigo-950/60 border border-indigo-800 px-2 py-0.5 text-xs text-indigo-300">
              mechanism: {pack.implementationMechanism}
            </span>
            <span
              className={`rounded px-2 py-0.5 text-xs ${
                pack.composedBy === "llm"
                  ? "bg-emerald-950/60 border border-emerald-800 text-emerald-300"
                  : "bg-amber-950/60 border border-amber-800 text-amber-300"
              }`}
              title={pack.composedBy === "template" ? "The LLM draft failed or was invalid — this is the honest deterministic fallback; specifics are determined during implementation" : undefined}
            >
              composedBy: {pack.composedBy}
            </span>
            <span className="text-xs text-slate-500">canon {pack.canonVersion.slice(0, 24)}</span>
            <span className="text-xs text-emerald-400">receipted: implementation_pack_generated</span>
            <button
              onClick={copy}
              className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 text-xs text-slate-200"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy pack (markdown)"}
            </button>
          </div>
          {pack.preflight && (
            <div className={`rounded-lg border p-3 ${pack.preflight.forcesEscalation ? "border-rose-800 bg-rose-950/30" : "border-slate-800 bg-slate-900/40"}`}>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`rounded px-2 py-0.5 border ${pack.preflight.forcesEscalation ? "bg-rose-950/60 border-rose-800 text-rose-300" : "bg-emerald-950/60 border-emerald-800 text-emerald-300"}`}>
                  consequence: {pack.preflight.disposition}
                </span>
                <span className="rounded px-2 py-0.5 border bg-slate-900 border-slate-700 text-slate-300">
                  risk {pack.preflight.risk.score}/100 · heuristic
                </span>
                <span className="rounded px-2 py-0.5 border bg-slate-900 border-slate-700 text-slate-300">
                  value ${(pack.preflight.value.workPotentialQc / 100).toFixed(2)} · heuristic
                </span>
                <span className="text-slate-500">
                  enables {pack.preflight.enables} · constrains {pack.preflight.constrains} · contradicts {pack.preflight.contradicts}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{pack.preflight.rationale}</p>
              {pack.preflight.risk.flags.length > 0 && (
                <p className="mt-1 text-xs text-amber-300">risk flags: {pack.preflight.risk.flags.join(", ")}</p>
              )}
            </div>
          )}

          <pre className="whitespace-pre-wrap break-words rounded-lg border border-slate-800 bg-slate-950/60 p-4 text-[12px] leading-relaxed text-slate-300 font-mono">
            {markdown}
          </pre>

          {/* D1 — propose deployment (CFS-016 v1.0). The proposal becomes
              constitutional; the execution stays human. */}
          <div className="rounded-lg border border-indigo-900/60 bg-indigo-950/20 p-3 space-y-2">
            <h3 className="text-sm font-semibold text-slate-200">Propose deployment (D1 — ratified 2026-07-06)</h3>
            <p className="text-xs text-slate-500">
              Records the provenance chain as a DVN-anchorable <code className="text-slate-400">deployment_proposed</code> receipt.
              Execution stays with you — after proposing, push manually exactly as today. No credentials move.
            </p>
            <label className="block text-xs text-slate-300">
              Commit range / hash(es)
              <input
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-100 text-xs"
                placeholder="e.g. abc1234..def5678 or a single commit hash"
                value={commitRange}
                onChange={(e) => setCommitRange(e.target.value)}
              />
            </label>
            <label className="block text-xs text-slate-300">
              Validation evidence <span className="text-slate-500">(one note per line — receipts, test runs, canaries)</span>
              <textarea
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-100 text-xs"
                rows={2}
                value={validationNotes}
                onChange={(e) => setValidationNotes(e.target.value)}
              />
            </label>
            <label className="flex items-start gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={touchesProtected}
                onChange={(e) => setTouchesProtected(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 rounded border-slate-700 bg-slate-900"
              />
              <span>
                Diff touches protected files (access gates / identity spine / DVN pipeline).
                <span className="text-slate-500"> Self-declared in v1. CFS-016 hard boundary 2: flagged proposals require those diffs individually reviewed before pushing.</span>
              </span>
            </label>
            <button
              onClick={propose}
              disabled={proposing || !commitRange.trim()}
              className="inline-flex items-center gap-1.5 rounded-md bg-indigo-700 hover:bg-indigo-600 px-2.5 py-1.5 text-xs text-white disabled:opacity-50"
            >
              {proposing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              {proposing ? "Recording proposal…" : "Propose deployment"}
            </button>
            {proposal && <p className="text-xs text-slate-400">{proposal}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
