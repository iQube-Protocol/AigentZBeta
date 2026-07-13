"use client";

/**
 * ImplementationLayout — the dev loop's implementation stage, first-class.
 *
 * Before this card existed the "Implement" strip node was unreachable and
 * "development started" was copilot narrative with no surface behind it.
 * This card makes the development phase observable and constitutional:
 *
 *   1. The implementation brief (approved implementation_brief proposal, or
 *      the brief derived from intent + context + gaps + canvas).
 *   2. Generate Implementation Pack — the REAL constitutional pipeline
 *      (`/api/constitutional/implementation-pack`): invariant bindings,
 *      consequence preflight, `implementation_pack_generated` receipt.
 *   3. Propose deployment (D1, CFS-016 v1.0) — records the provenance chain
 *      as a `deployment_proposed` receipt. Execution stays human: the pack
 *      is run in Claude Code and pushed manually. The receipts ARE the
 *      "development phase initiated" confirmation.
 */

import React, { useMemo, useState } from "react";
import { Check, Copy, Cpu, Hammer, Loader2, Play } from "lucide-react";
import { LayoutShell } from "@/components/metame/welcome/layouts/LayoutShell";
import { PendingProposalCard } from "./PendingProposalCard";
import { canAdvance, buildImplementationPackage, constitutionalThresholdMet } from "@/services/devCommandCenter";
import { experimentStep } from "@/components/composer/experimentStepFetch";
import { packMarkdown, type PackView } from "@/components/composer/CapabilityPipelineTab";
import { evidenceFromSession } from "./types";
import type { DevLayoutProps } from "./types";

export function ImplementationLayout({
  session,
  onDismiss,
  onAdvanceStage,
  pendingProposal,
  onApproveProposal,
  onDismissProposal,
  onReceipt,
  onPackGenerated,
  onDeploymentProposed,
}: DevLayoutProps & {
  /** Writes the generated pack's markdown back into the session as the
   * implementation brief — satisfying the stage's advance gate. */
  onPackGenerated?: (briefMarkdown: string) => void;
  /** DCIR D1 observation hook — fired after a deployment proposal is
   * successfully recorded. Observe-mode only: no payload, no behavior
   * change; the receipt pipeline stays authoritative. */
  onDeploymentProposed?: () => void;
}) {
  const canAdvanceNow = canAdvance(session);
  const derived = useMemo(() => buildImplementationPackage(session), [session]);
  const brief = session.implementationBrief || derived?.brief || null;

  const [generating, setGenerating] = useState(false);
  const [packError, setPackError] = useState<string | null>(null);
  const [pack, setPack] = useState<PackView | null>(null);
  const [copied, setCopied] = useState(false);
  const [commitRange, setCommitRange] = useState("");
  const [touchesProtected, setTouchesProtected] = useState(false);
  const [proposing, setProposing] = useState(false);
  const [proposal, setProposal] = useState<string | null>(null);

  const generate = async () => {
    if (!session.intent) return;
    setGenerating(true);
    setPackError(null);
    try {
      const domains = session.intent.relatedCartridges.filter(Boolean);
      // Capability Evidence (CFS-029): the session's stage findings travel
      // into pack generation AND persist beyond the session. The projection is
      // shared with the Decision capsule (evidenceFromSession) so both stages
      // ground on identical evidence.
      const capabilityEvidence = evidenceFromSession(session);
      const hasEvidence =
        capabilityEvidence.existing.length > 0 ||
        capabilityEvidence.missing.length > 0 ||
        capabilityEvidence.contextAssets.length > 0 ||
        capabilityEvidence.boundaries.length > 0;
      const data = await experimentStep("/api/constitutional/implementation-pack", {
        goal: session.intent.goal,
        ...(domains.length > 0 ? { domains } : {}),
        ...(hasEvidence ? { capabilityEvidence } : {}),
        // CFS-029 §7.1 — a decision already taken at the Decision stage
        // travels verbatim: the pipeline decides ONCE.
        ...(session.constitutionalDecision ? { decision: session.constitutionalDecision } : {}),
      });
      const p = data.pack as PackView;
      setPack(p);
      setProposal(null);
      onPackGenerated?.(packMarkdown(p));
      // Development-class receipt — the route created an
      // `implementation_pack_generated` receipt and returns its id. Record it
      // so the Dev Receipts panel reflects it (the receipt bug fix at source).
      if (typeof data.receiptId === "string" && data.receiptId) {
        onReceipt?.({ id: data.receiptId, actionType: "implementation_pack_generated" });
      }
    } catch (err) {
      setPackError(err instanceof Error ? err.message : "Pack generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const copyPack = async () => {
    if (!pack) return;
    await navigator.clipboard.writeText(packMarkdown(pack));
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
        validationNotes: session.validationReport
          ? `dev-loop validation verdict: ${session.validationReport.overallVerdict}`
          : "",
        touchesProtectedFiles: touchesProtected,
        constitutionalThresholdMet: constitutionalThresholdMet(session),
      });
      // The route now emits a Deployment CONSTITUTIONAL OBJECT (proposed) — show
      // its commitment ref + lifecycle state, not just the receipt.
      const dep = data.deployment as
        | { ref?: string; state?: string; standingBand?: string }
        | undefined;
      setProposal(
        dep?.ref
          ? `Proposed — deployment object ${dep.state ?? "proposed"} (${dep.standingBand ?? "experimental"}) · ref ${String(dep.ref).slice(0, 10)}… · receipt ${String(data.receiptId).slice(0, 8)}… · ${String(data.d1Semantics)}`
          : `Proposed — receipt ${String(data.receiptId).slice(0, 8)}… · ${String(data.d1Semantics)}`,
      );
      if (typeof data.receiptId === "string" && data.receiptId) {
        onReceipt?.({ id: data.receiptId, actionType: "deployment_proposed" });
      }
      onDeploymentProposed?.();
    } catch (err) {
      setProposal(err instanceof Error ? err.message : "proposal failed");
    } finally {
      setProposing(false);
    }
  };

  const body = (
    <div className="space-y-4">
      {pendingProposal && onApproveProposal && onDismissProposal && (
        <PendingProposalCard
          proposal={pendingProposal}
          onApprove={onApproveProposal}
          onDismiss={onDismissProposal}
        />
      )}

      {/* Implementation brief */}
      {brief ? (
        <div className="space-y-1">
          <div className="text-[10px] text-slate-500 uppercase font-semibold">
            Implementation brief {session.implementationBrief ? "" : "(derived — approve aigentZ's brief proposal or generate a pack to enrich)"}
          </div>
          <pre className="whitespace-pre-wrap break-words rounded-lg border border-slate-700/30 bg-slate-900/50 p-3 text-[11px] leading-relaxed text-slate-300 font-mono max-h-64 overflow-y-auto">
            {brief}
          </pre>
        </div>
      ) : (
        <div className="text-xs text-slate-400 italic py-4 text-center">
          No implementation brief yet. Complete intent → context → gaps → consequences first, or ask
          aigentZ to produce the implementation brief.
        </div>
      )}

      {/* Constitutional pipeline: Implementation Pack */}
      <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-3 space-y-2">
        <div className="text-xs font-semibold text-indigo-300">Constitutional Capability Pipeline</div>
        <p className="text-[10px] text-slate-400">
          Generates the Implementation Pack (artifact-before-implementation) through the constitutional
          pipeline: invariant bindings, consequence preflight, and an{" "}
          <code className="text-slate-300">implementation_pack_generated</code> receipt (DVN-anchorable).
        </p>
        <button
          onClick={generate}
          disabled={generating || !session.intent}
          className="inline-flex items-center gap-1.5 rounded-md bg-indigo-700 hover:bg-indigo-600 px-2.5 py-1.5 text-xs text-white disabled:opacity-50"
        >
          {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Hammer className="h-3.5 w-3.5" />}
          {generating ? "Generating pack…" : "Generate Implementation Pack"}
        </button>
        {packError && <p className="text-xs text-rose-400">{packError}</p>}

        {pack && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
              <span className="rounded px-1.5 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                mechanism: {pack.implementationMechanism}
              </span>
              <span className={`rounded px-1.5 py-0.5 border ${pack.composedBy === "llm" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : "bg-amber-500/20 text-amber-300 border-amber-500/30"}`}>
                composedBy: {pack.composedBy}
              </span>
              <span className="rounded px-1.5 py-0.5 bg-slate-800 text-slate-300 border border-slate-700">
                bindings: {pack.invariantBindings.length}
              </span>
              {pack.preflight && (
                <span className={`rounded px-1.5 py-0.5 border ${pack.preflight.forcesEscalation ? "bg-rose-500/20 text-rose-300 border-rose-500/30" : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"}`}>
                  consequence: {pack.preflight.disposition} · heuristic
                </span>
              )}
              <span className="text-emerald-400">receipted: implementation_pack_generated</span>
              <button
                onClick={copyPack}
                className="ml-auto inline-flex items-center gap-1 rounded bg-slate-800 hover:bg-slate-700 px-1.5 py-0.5 text-slate-200"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied" : "Copy pack"}
              </button>
            </div>

            {/* D1 — propose deployment */}
            <div className="rounded border border-slate-700/40 bg-slate-900/40 p-2 space-y-1.5">
              <div className="text-[10px] font-semibold text-slate-300">Propose deployment (D1 — CFS-016 v1.0)</div>
              <p className="text-[10px] text-slate-500">
                Records a <code className="text-slate-400">deployment_proposed</code> receipt — the provenance
                record that the development phase is initiated. Execution stays human: run the pack in Claude
                Code and push manually. No credentials move.
              </p>
              <input
                className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100 text-[11px]"
                placeholder="Commit range / hash(es) once the pack has been implemented"
                value={commitRange}
                onChange={(e) => setCommitRange(e.target.value)}
              />
              <label className="flex items-start gap-1.5 text-[10px] text-slate-400">
                <input
                  type="checkbox"
                  checked={touchesProtected}
                  onChange={(e) => setTouchesProtected(e.target.checked)}
                  className="mt-0.5 h-3 w-3 rounded border-slate-700 bg-slate-900"
                />
                <span>
                  Diff touches protected files (access gates / identity spine / DVN pipeline) — flagged
                  proposals require those diffs individually reviewed before pushing (CFS-016 boundary 2).
                </span>
              </label>
              <button
                onClick={propose}
                disabled={proposing || !commitRange.trim()}
                className="inline-flex items-center gap-1 rounded bg-indigo-700 hover:bg-indigo-600 px-2 py-1 text-[11px] text-white disabled:opacity-50"
              >
                {proposing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                {proposing ? "Recording…" : "Propose deployment"}
              </button>
              {proposal && <p className="text-[10px] text-slate-400">{proposal}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <LayoutShell
      surfaceId="dev-implementation"
      disTemplateId="dev-implementation-layout-v1"
      headerIcon={<Cpu className="w-4 h-4" />}
      headerEyebrow="ICE Stage 5"
      headerTitle="Implementation"
      headerActions={
        canAdvanceNow ? (
          <button
            onClick={onAdvanceStage}
            className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors"
          >
            <Play className="w-3 h-3" />
            Advance
          </button>
        ) : undefined
      }
      onDismiss={onDismiss}
      dismissLabel="Back to overview"
      body={body}
    />
  );
}
