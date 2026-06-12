"use client";

/**
 * DevCommandCenterTab — aigentZ Development Command Center
 * Operation Chrysalis Phase 1
 *
 * Two-pane split mirroring AigentMeWelcomeSplitTab:
 *
 *   ┌─────────────────────────┬────────────────────────────┐
 *   │                         │  Stage strip (carousel)    │
 *   │   aigentZ Copilot       │  6 capability buttons (2×3)│
 *   │   (embedded, persistent)│  Active layout (capsule)   │
 *   │                         │  Experience Model           │
 *   │   Quick-prompt chips:   │  Specialists               │
 *   │   New intent · Where    │  Dev Receipts              │
 *   │   are we? · Analyze     │                            │
 *   │   gaps · Model          │  Quick links: Terminal ·   │
 *   │   consequences ·        │  GitHub · DevTools ·       │
 *   │   Validate build        │  Linear · Upload · Download│
 *   │                         │                            │
 *   │                         │  Dev loop diagram          │
 *   └─────────────────────────┴────────────────────────────┘
 *
 * Two-tier copilot routing (stubbed for Claude Code integration):
 *   Tier 1: aigentZ → LLM → drives right pane layouts
 *   Tier 2: aigentZ → Claude Code → results → aigentZ → routing decision
 */

import React, { useState, useCallback, useMemo } from "react";
import {
  Cpu, Target, FileSearch, AlertTriangle, CheckCircle,
  ChevronDown, Package, Layers, ArrowRight,
  Terminal, GitBranch, Wrench, BarChart3,
  RotateCcw, Play,
} from "lucide-react";
import { SmartTriadCopilotLayer, type SuggestedLayoutHint, type CopilotStageProposal } from "@/components/smarttriad/copilot/SmartTriadCopilotLayer";
import { ExploreQuickActionsStrip, type ExploreToolId, type ExploreSuggestionMap } from "@/components/metame/copilot/ExploreQuickActionsStrip";

import type {
  DevLoopState,
  DevLoopStage,
  StructuredDevIntent,
  ContextPack,
  CapabilityGapAnalysis,
  ConsequenceCanvas,
  ConsequenceValidationReport,
} from "@/types/devCommandCenter";

import {
  createDevLoopSession,
  canAdvance,
  advanceStage,
  buildImplementationPackage,
  buildIntentSummary,
  buildContextPackSummary,
  buildGapAnalysisSummary,
  buildConsequenceCanvasSummary,
  buildValidationSummary,
  applyStageProposal,
  STAGE_PROPOSAL_KIND,
  PROPOSAL_KIND_TO_CAPSULE,
  type StageProposal,
  type StageProposalKind,
} from "@/services/devCommandCenter";

type QuickPrompt = string | {
  label: string;
  prompt?: string;
  onSelect?: () => void;
  highlight?: boolean;
};

// ─── UI-local types (layout/capsule state machine — not in service layer) ──

type DevCapsuleId =
  | "project-overview"
  | "intent"
  | "context"
  | "gap-analysis"
  | "consequence-canvas"
  | "validation";

type DevLayoutId =
  | "stack"
  | "project-overview"
  | "intent"
  | "context"
  | "gap-analysis"
  | "consequence-canvas"
  | "validation"
  | "terminal"
  | "github"
  | "devtools"
  | "linear";

// ─── Capsule → Layout mapping ─────────────────────────────────────────────

const CAPSULE_LAYOUT: Record<DevCapsuleId, DevLayoutId> = {
  "project-overview": "project-overview",
  "intent": "intent",
  "context": "context",
  "gap-analysis": "gap-analysis",
  "consequence-canvas": "consequence-canvas",
  "validation": "validation",
};

// ─── Two-tier routing stub ─────────────────────────────────────────────────

type PromptTier = "llm" | "claude-code";

interface RoutingDecision {
  tier: PromptTier;
  reason: string;
}

function classifyPromptTier(prompt: string): RoutingDecision {
  const lower = prompt.toLowerCase();
  const codePatterns = /\b(implement|code|build|create file|write code|refactor|fix bug|generate|scaffold|test)\b/;
  if (codePatterns.test(lower)) {
    return { tier: "claude-code", reason: "Code generation / implementation task" };
  }
  return { tier: "llm", reason: "Planning / analysis / right-pane update" };
}

// ─── Stage metadata (UI rendering) ────────────────────────────────────────

const STAGES: { id: DevLoopStage; label: string; icon: typeof Cpu }[] = [
  { id: "intent_capture", label: "Intent", icon: Target },
  { id: "context_assembly", label: "Context", icon: Package },
  { id: "gap_analysis", label: "Gaps", icon: FileSearch },
  { id: "consequence_modeling", label: "Consequences", icon: AlertTriangle },
  { id: "implementation", label: "Implement", icon: Cpu },
  { id: "consequence_validation", label: "Validate", icon: CheckCircle },
  { id: "complete", label: "Complete", icon: CheckCircle },
];

// Map stages to capsule IDs for click-to-navigate
const STAGE_TO_CAPSULE: Partial<Record<DevLoopStage, DevCapsuleId>> = {
  intent_capture: "intent",
  context_assembly: "context",
  gap_analysis: "gap-analysis",
  consequence_modeling: "consequence-canvas",
  consequence_validation: "validation",
};

function getStageIndex(stage: DevLoopStage): number {
  return STAGES.findIndex(s => s.id === stage);
}

// ─── Capability buttons ───────────────────────────────────────────────────

const CAPABILITIES: { id: DevCapsuleId; label: string; icon: typeof Cpu; color: string; description: string }[] = [
  { id: "project-overview", label: "Project Overview", icon: Layers, color: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20", description: "Active project, intent ID, and loop status" },
  { id: "intent", label: "Intent Distillation", icon: Target, color: "text-blue-400 border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20", description: "Distill raw input into structured intent" },
  { id: "context", label: "Context Pack", icon: Package, color: "text-purple-400 border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20", description: "Assemble relevant codebase context" },
  { id: "gap-analysis", label: "Gap Analysis", icon: FileSearch, color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20", description: "Identify existing vs missing capabilities" },
  { id: "consequence-canvas", label: "Consequence Canvas", icon: AlertTriangle, color: "text-amber-400 border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20", description: "Model what should/shouldn't happen" },
  { id: "validation", label: "Validation", icon: CheckCircle, color: "text-green-400 border-green-500/30 bg-green-500/10 hover:bg-green-500/20", description: "Validate build against consequences" },
];

// ─── Quick links for bottom strip ─────────────────────────────────────────

const DEV_QUICK_LINKS: { id: string; label: string; icon: typeof Terminal }[] = [
  { id: "terminal", label: "Terminal", icon: Terminal },
  { id: "github", label: "GitHub", icon: GitBranch },
  { id: "devtools", label: "DevTools", icon: Wrench },
  { id: "linear", label: "Linear", icon: BarChart3 },
];

// ─── Right-pane sub-components ────────────────────────────────────────────

function StageStrip({ stage, onStageClick }: { stage: DevLoopStage; onStageClick?: (stage: DevLoopStage) => void }) {
  const currentIdx = getStageIndex(stage);
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1 px-1">
      {STAGES.map((s, i) => {
        const Icon = s.icon;
        const isCurrent = s.id === stage;
        const isPast = i < currentIdx;
        const box = isCurrent ? "bg-green-500/20 border-green-500/30"
          : isPast ? "bg-emerald-500/10 border-emerald-500/20"
          : "bg-slate-800/30 border-slate-700/30";
        const iconColor = isCurrent ? "text-green-400" : isPast ? "text-emerald-400/60" : "text-slate-500";
        const capsuleTarget = STAGE_TO_CAPSULE[s.id];
        const isClickable = capsuleTarget && (isPast || isCurrent);
        return (
          <React.Fragment key={s.id}>
            {i > 0 && <ArrowRight className={`w-3 h-3 shrink-0 ${isPast || isCurrent ? "text-emerald-400/40" : "text-slate-700"}`} />}
            <button
              type="button"
              disabled={!isClickable}
              onClick={() => isClickable && onStageClick?.(s.id)}
              className={`flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-semibold whitespace-nowrap text-white ${box} ${isClickable ? "cursor-pointer hover:ring-1 hover:ring-white/20" : "cursor-default"}`}
            >
              <Icon className={`w-3 h-3 ${iconColor}`} />
              {s.label}
            </button>
          </React.Fragment>
        );
      })}
      {/* Phase badges — right of Complete */}
      <div className="flex items-center gap-1.5 ml-2 shrink-0">
        <span className="text-[10px] px-2 py-0.5 rounded bg-green-500/20 text-green-300 border border-green-500/30 font-semibold whitespace-nowrap">Phase 1 MVP</span>
        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold whitespace-nowrap">Operation Chrysalis</span>
      </div>
    </div>
  );
}

function IntentPanel({ intent }: { intent: StructuredDevIntent }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
          intent.status === "refined" ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
          : intent.status === "approved" ? "bg-green-500/20 text-green-300 border-green-500/30"
          : "bg-slate-500/20 text-slate-300 border-slate-500/30"
        }`}>{intent.status}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
          intent.priority === "critical" ? "bg-red-500/20 text-red-300 border-red-500/30"
          : intent.priority === "high" ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
          : "bg-slate-500/20 text-slate-300 border-slate-500/30"
        }`}>{intent.priority}</span>
      </div>
      <div>
        <div className="text-xs text-slate-500 mb-0.5">Goal</div>
        <p className="text-sm text-white">{intent.goal}</p>
      </div>
      <div>
        <div className="text-xs text-slate-500 mb-0.5">Raw input</div>
        <p className="text-xs text-slate-400 italic">&ldquo;{intent.rawInput}&rdquo;</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <div className="text-xs text-slate-500 mb-1">Users</div>
          {intent.users.map(u => <div key={u} className="text-xs text-slate-300">· {u}</div>)}
        </div>
        <div>
          <div className="text-xs text-slate-500 mb-1">Desired Outcomes</div>
          {intent.desiredOutcomes.map(o => <div key={o} className="text-xs text-slate-300">· {o}</div>)}
        </div>
      </div>
      <div>
        <div className="text-xs text-slate-500 mb-1">Success Criteria</div>
        {intent.successCriteria.map(c => <div key={c} className="text-xs text-emerald-300">✓ {c}</div>)}
      </div>
      {intent.constraints.length > 0 && (
        <div>
          <div className="text-xs text-slate-500 mb-1">Constraints</div>
          {intent.constraints.map(c => <div key={c} className="text-xs text-amber-300">⚠ {c}</div>)}
        </div>
      )}
    </div>
  );
}

function ContextPackPanel({ pack }: { pack: ContextPack }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-xs flex-wrap">
        <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">Reuse: {pack.reuseFirst.length}</span>
        <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">Extend: {pack.extendSecond.length}</span>
        <span className="px-1.5 py-0.5 rounded bg-slate-500/20 text-slate-300">Reference: {pack.buildNewLast.length}</span>
        {pack.totalTokenEstimate > 0 && (
          <span className="text-[10px] text-slate-500">{pack.totalTokenEstimate.toLocaleString()} est. tokens</span>
        )}
      </div>
      {pack.items.map(item => (
        <div key={item.sourcePath} className="py-1.5 border-b border-slate-700/20 last:border-0">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs text-white truncate">{item.title}</div>
              <div className="text-[10px] text-slate-500 font-mono truncate">{item.sourcePath}</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] text-slate-500">{item.relevanceScore}%</span>
              <span className={`text-[10px] px-1 py-0.5 rounded ${
                item.reuseSignal === "reuse" ? "bg-emerald-500/20 text-emerald-300"
                : item.reuseSignal === "extend" ? "bg-blue-500/20 text-blue-300"
                : "bg-slate-500/20 text-slate-300"
              }`}>{item.reuseSignal}</span>
            </div>
          </div>
          {item.excerpt && <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{item.excerpt}</div>}
        </div>
      ))}
    </div>
  );
}

function GapAnalysisPanel({ analysis }: { analysis: CapabilityGapAnalysis }) {
  const ratio = Math.round(analysis.reuseRatio * 100);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 rounded-full bg-slate-700 overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${ratio}%` }} />
        </div>
        <span className="text-xs text-emerald-300 font-semibold">{ratio}% reuse</span>
      </div>
      <div>
        <div className="text-xs text-slate-500 mb-1 uppercase font-semibold">Existing ({analysis.existing.length})</div>
        {analysis.existing.map(c => (
          <div key={c.name} className="py-1 border-b border-slate-700/20 last:border-0">
            <div className="flex items-center justify-between">
              <div className="text-xs text-emerald-300">{c.name}</div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500 font-mono">{c.location}</span>
                <span className="text-[10px] px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-300">{c.reuseStrategy}</span>
              </div>
            </div>
            {c.description && <div className="text-[10px] text-slate-400 mt-0.5">{c.description}</div>}
          </div>
        ))}
      </div>
      <div>
        <div className="text-xs text-slate-500 mb-1 uppercase font-semibold">Missing ({analysis.missing.length})</div>
        {analysis.missing.map(c => (
          <div key={c.name} className="py-1.5 border-b border-slate-700/20 last:border-0">
            <div className="flex items-center justify-between">
              <span className="text-xs text-amber-300">{c.name}</span>
              <span className="text-[10px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-300">{c.estimatedComplexity}</span>
            </div>
            <div className="text-[10px] text-slate-400">{c.description}</div>
            <div className="text-[10px] text-slate-500 font-mono">{c.suggestedLocation}</div>
            {c.dependencies.length > 0 && (
              <div className="text-[10px] text-slate-500 mt-0.5">Deps: {c.dependencies.join(", ")}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ConsequenceCanvasPanel({ canvas }: { canvas: ConsequenceCanvas }) {
  return (
    <div className="space-y-3">
      <div className="p-2 rounded bg-green-500/10 border border-green-500/20">
        <div className="text-[10px] text-slate-500 uppercase font-semibold mb-0.5">Success State</div>
        <p className="text-xs text-green-300">{canvas.successState || "(not defined)"}</p>
      </div>
      {canvas.workflowsActivated.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-slate-500 uppercase font-semibold">Workflows:</span>
          {canvas.workflowsActivated.map(w => (
            <span key={w} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300">{w}</span>
          ))}
        </div>
      )}
      {canvas.systemsAffected.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-slate-500 uppercase font-semibold">Systems:</span>
          {canvas.systemsAffected.map(s => (
            <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300">{s}</span>
          ))}
        </div>
      )}
      {canvas.permissionsRequired.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-slate-500 uppercase font-semibold">Permissions:</span>
          {canvas.permissionsRequired.map(p => (
            <span key={p} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">{p}</span>
          ))}
        </div>
      )}
      <div>
        <div className="text-xs text-emerald-400 font-semibold mb-1">Should Happen ({canvas.shouldHappen.length})</div>
        {canvas.shouldHappen.map(e => (
          <div key={e.id} className="flex items-start gap-2 py-1 border-b border-slate-700/20 last:border-0">
            <CheckCircle className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <div className="text-xs text-slate-300">{e.description}</div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-slate-500">{e.category}</span>
                <span className={`text-[10px] ${e.severity === "critical" ? "text-red-400" : e.severity === "high" ? "text-amber-400" : "text-slate-400"}`}>{e.severity}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div>
        <div className="text-xs text-rose-400 font-semibold mb-1">Should Never Happen ({canvas.shouldNeverHappen.length})</div>
        {canvas.shouldNeverHappen.map(e => (
          <div key={e.id} className="flex items-start gap-2 py-1 border-b border-slate-700/20 last:border-0">
            <AlertTriangle className="w-3 h-3 text-rose-400 mt-0.5 shrink-0" />
            <div>
              <div className="text-xs text-slate-300">{e.description}</div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-slate-500">{e.category}</span>
                <span className={`text-[10px] ${e.severity === "critical" ? "text-red-400" : e.severity === "high" ? "text-amber-400" : "text-slate-400"}`}>{e.severity}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProjectOverviewPanel({ session }: { session: DevLoopState }) {
  const { intent, stage, contextPack, gapAnalysis, consequenceCanvas, validationReport, sessionId } = session;
  const stageIdx = getStageIndex(stage);
  const canAdvanceNow = canAdvance(session);

  return (
    <div className="space-y-3">
      {intent ? (
        <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white truncate">{intent.goal}</div>
              <div className="text-[10px] text-slate-400 font-mono">{intent.intentId}</div>
            </div>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${
              intent.status === "refined" ? "bg-blue-500/20 text-white border-blue-500/30"
              : intent.status === "approved" ? "bg-green-500/20 text-white border-green-500/30"
              : "bg-slate-500/20 text-white border-slate-500/30"
            }`}>{intent.status}</span>
          </div>
        </div>
      ) : (
        <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-700/30 text-center">
          <div className="text-xs text-slate-400">No active intent — use &ldquo;New intent&rdquo; to start</div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="p-2 rounded bg-slate-800/40 border border-slate-700/30">
          <div className="text-[10px] text-slate-500 uppercase font-semibold mb-0.5">Loop Stage</div>
          <div className="text-xs text-white">{STAGES[stageIdx]?.label} ({stageIdx + 1}/{STAGES.length})</div>
          {canAdvanceNow && <div className="text-[10px] text-emerald-400 mt-0.5">Ready to advance</div>}
        </div>
        <div className="p-2 rounded bg-slate-800/40 border border-slate-700/30">
          <div className="text-[10px] text-slate-500 uppercase font-semibold mb-0.5">Priority</div>
          <div className="text-xs text-white">{intent?.priority ?? "—"}</div>
        </div>
        <div className="p-2 rounded bg-slate-800/40 border border-slate-700/30">
          <div className="text-[10px] text-slate-500 uppercase font-semibold mb-0.5">Session</div>
          <div className="text-[10px] text-white font-mono truncate">{sessionId}</div>
        </div>
        <div className="p-2 rounded bg-slate-800/40 border border-slate-700/30">
          <div className="text-[10px] text-slate-500 uppercase font-semibold mb-0.5">Artifacts</div>
          <div className="text-xs text-white">
            {[
              contextPack && `${contextPack.items.length} ctx`,
              gapAnalysis && `${gapAnalysis.existing.length}+${gapAnalysis.missing.length} gaps`,
              consequenceCanvas && `${consequenceCanvas.shouldHappen.length + consequenceCanvas.shouldNeverHappen.length} cons`,
              validationReport && validationReport.overallVerdict,
            ].filter(Boolean).join(" · ") || "None yet"}
          </div>
        </div>
      </div>

      {intent && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-2 rounded bg-slate-800/40 border border-slate-700/30">
              <div className="text-[10px] text-slate-500 uppercase font-semibold mb-0.5">Ventures</div>
              {intent.relatedVentures.map(v => <div key={v} className="text-xs text-white">{v}</div>)}
            </div>
            <div className="p-2 rounded bg-slate-800/40 border border-slate-700/30">
              <div className="text-[10px] text-slate-500 uppercase font-semibold mb-0.5">Cartridges</div>
              {intent.relatedCartridges.map(c => <div key={c} className="text-xs text-white font-mono">{c}</div>)}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Success Criteria</div>
            {intent.successCriteria.map(c => <div key={c} className="text-xs text-emerald-300">✓ {c}</div>)}
          </div>
        </>
      )}
    </div>
  );
}

function ValidationPanel({ report }: { report: ConsequenceValidationReport | null }) {
  if (!report) {
    return (
      <div className="text-xs text-slate-400 italic py-4 text-center">
        Validation runs after Claude Code generates implementation. Pending implementation stage.
      </div>
    );
  }
  const verdictColor = report.overallVerdict === "pass" ? "text-green-400 bg-green-500/10 border-green-500/20"
    : report.overallVerdict === "fail" ? "text-red-400 bg-red-500/10 border-red-500/20"
    : "text-amber-400 bg-amber-500/10 border-amber-500/20";
  return (
    <div className="space-y-3">
      <div className={`p-2 rounded border ${verdictColor}`}>
        <div className="text-[10px] text-slate-500 uppercase font-semibold mb-0.5">Overall Verdict</div>
        <div className="text-sm font-bold uppercase">{report.overallVerdict}</div>
      </div>
      <div className="flex items-center gap-3 text-xs">
        <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">Satisfied: {report.satisfied.length}</span>
        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">Unresolved: {report.unresolved.length}</span>
        <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-300">Unintended: {report.unintended.length}</span>
      </div>
      {report.satisfied.length > 0 && (
        <div>
          <div className="text-xs text-emerald-400 font-semibold mb-1">Satisfied</div>
          {report.satisfied.map(item => (
            <div key={item.consequenceId} className="flex items-start gap-2 py-1 border-b border-slate-700/20 last:border-0">
              <CheckCircle className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />
              <div>
                <div className="text-xs text-slate-300">{item.description}</div>
                <div className="text-[10px] text-slate-500">{item.evidence}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      {report.unresolved.length > 0 && (
        <div>
          <div className="text-xs text-amber-400 font-semibold mb-1">Unresolved</div>
          {report.unresolved.map(item => (
            <div key={item.consequenceId} className="flex items-start gap-2 py-1 border-b border-slate-700/20 last:border-0">
              <AlertTriangle className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <div className="text-xs text-slate-300">{item.description}</div>
                <div className="text-[10px] text-slate-500">{item.evidence}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      {report.unintended.length > 0 && (
        <div>
          <div className="text-xs text-red-400 font-semibold mb-1">Unintended</div>
          {report.unintended.map(item => (
            <div key={item.consequenceId} className="flex items-start gap-2 py-1 border-b border-slate-700/20 last:border-0">
              <AlertTriangle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
              <div>
                <div className="text-xs text-slate-300">{item.description}</div>
                <div className="text-[10px] text-slate-500">{item.evidence}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Right-pane layout components ─────────────────────────────────────────

function capabilityHasData(id: DevCapsuleId, session: DevLoopState): boolean {
  switch (id) {
    case "project-overview": return session.intent !== null;
    case "intent": return session.intent !== null;
    case "context": return session.contextPack !== null && session.contextPack.items.length > 0;
    case "gap-analysis": return session.gapAnalysis !== null;
    case "consequence-canvas": return session.consequenceCanvas !== null && session.consequenceCanvas.successState.length > 0;
    case "validation": return session.validationReport !== null;
    default: return false;
  }
}

function StackLayout({ onCapabilityClick, activeStage, session }: {
  onCapabilityClick: (id: DevCapsuleId) => void;
  activeStage: DevLoopStage;
  session: DevLoopState;
}) {
  return (
    <div className="space-y-4">
      {/* Capability buttons */}
      <div className="space-y-2">
        <div className="text-[10px] text-slate-500 uppercase font-semibold px-1">Capabilities</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {CAPABILITIES.map(cap => {
            const hasData = capabilityHasData(cap.id, session);
            return (
              <button
                key={cap.id}
                onClick={() => onCapabilityClick(cap.id)}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${cap.color}`}
              >
                <cap.icon className="w-5 h-5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">{cap.label}</span>
                    {hasData && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />}
                  </div>
                  <div className="text-[10px] text-slate-300">{cap.description}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Accordion sections */}
      <AccordionSection title="Experience Model" icon={Layers} defaultOpen={false}>
        <div className="space-y-2">
          <div className="text-[10px] text-slate-500 uppercase font-semibold">Dev Loop Stages</div>
          {STAGES.map((s, i) => {
            const stageIdx = getStageIndex(activeStage);
            const isCurrent = s.id === activeStage;
            const isPast = i < stageIdx;
            const Icon = s.icon;
            return (
              <div key={s.id} className="flex items-center gap-2 py-0.5">
                <Icon className={`w-3 h-3 ${isCurrent ? "text-green-400" : isPast ? "text-emerald-400/60" : "text-slate-600"}`} />
                <span className={`text-xs ${isCurrent ? "text-green-300 font-semibold" : isPast ? "text-emerald-300/60" : "text-slate-500"}`}>{s.label}</span>
                {isCurrent && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-300">Active</span>}
                {isPast && <span className="text-[10px] text-emerald-400/50">✓</span>}
              </div>
            );
          })}
          <div className="pt-1 border-t border-slate-700/20">
            <div className="text-[10px] text-slate-500">Implementation package: {session.intent && session.contextPack && session.gapAnalysis && session.consequenceCanvas ? <span className="text-emerald-300">ready to assemble</span> : <span className="text-amber-300">incomplete — fill remaining capabilities</span>}</div>
          </div>
        </div>
      </AccordionSection>

      <AccordionSection title="Specialists" icon={Cpu} defaultOpen={false}>
        <div className="space-y-2">
          {[
            { name: "Architecture Reviewer", role: "Validates structural decisions against platform patterns", status: "available" },
            { name: "Security Reviewer", role: "Checks for OWASP top 10, auth gate integrity, secret exposure", status: "available" },
            { name: "Governance Reviewer", role: "Ensures DVN receipt compliance and sovereignty boundaries", status: "available" },
            { name: "Spine Integrity Checker", role: "Validates identity spine contracts and tier exposure rules", status: "available" },
          ].map(spec => (
            <div key={spec.name} className="flex items-center justify-between py-1 border-b border-slate-700/20 last:border-0">
              <div>
                <div className="text-xs text-white">{spec.name}</div>
                <div className="text-[10px] text-slate-500">{spec.role}</div>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300">{spec.status}</span>
            </div>
          ))}
          <div className="text-[10px] text-slate-500 pt-1">Specialists are invoked by aigentZ during gap analysis and validation stages.</div>
        </div>
      </AccordionSection>

      <AccordionSection title="Dev Receipts" icon={CheckCircle} defaultOpen={false}>
        <div className="space-y-2">
          {session.receipts.length > 0 ? (
            session.receipts.map((receiptId, i) => (
              <div key={receiptId} className="flex items-center justify-between py-1 border-b border-slate-700/20 last:border-0">
                <span className="text-xs text-white font-mono truncate">{receiptId}</span>
                <span className="text-[10px] text-slate-500">#{i + 1}</span>
              </div>
            ))
          ) : (
            <div className="text-xs text-slate-400 py-1">
              No receipts yet. Receipts are created when capabilities complete — intent captures, gap analyses, validation results are DVN-anchored.
            </div>
          )}
          <div className="flex items-center gap-3 text-[10px] text-slate-500 pt-1 border-t border-slate-700/20">
            <span>Session: <span className="font-mono text-slate-400">{session.sessionId.slice(0, 16)}…</span></span>
            <span>Started: {new Date(session.startedAt).toLocaleDateString()}</span>
          </div>
        </div>
      </AccordionSection>

      {/* Dev loop diagram */}
      <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-700/30">
        <div className="flex items-baseline gap-2 mb-2 min-w-0">
          <h4 className="text-xs font-semibold text-white shrink-0">Development Loop</h4>
          <p className="text-[10px] text-slate-400 truncate">
            Claude Code generates code. aigentZ generates and validates capability. The loop is cyclical.
          </p>
        </div>
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1 text-xs">
          {[
            { label: "User Intent", stage: "intent_capture" },
            { label: "Intent Distillation", stage: "intent_capture" },
            { label: "Context Pack", stage: "context_assembly" },
            { label: "Gap Analysis", stage: "gap_analysis" },
            { label: "Consequence Canvas", stage: "consequence_modeling" },
            { label: "Claude Code", stage: "implementation" },
            { label: "Generated Code", stage: "implementation" },
            { label: "Consequence Validation", stage: "consequence_validation" },
            { label: "Receipts", stage: "complete" },
            { label: "Memory Update", stage: "complete" },
          ].map((step, i, arr) => {
            const stageIdx = getStageIndex(activeStage);
            const stepStageIdx = STAGES.findIndex(s => s.id === step.stage);
            const isPast = stepStageIdx < stageIdx;
            const isCurrent = step.stage === activeStage;
            return (
              <React.Fragment key={step.label}>
                <span className={`px-2 py-1 rounded whitespace-nowrap shrink-0 ${
                  isCurrent ? "bg-green-500/20 text-green-300 ring-1 ring-green-500/30"
                  : isPast ? "bg-emerald-500/10 text-emerald-300/60"
                  : "bg-slate-700/50 text-white"
                }`}>{step.label}</span>
                {i < arr.length - 1 && <ArrowRight className={`w-3 h-3 shrink-0 ${isPast || isCurrent ? "text-emerald-400/40" : "text-slate-600"}`} />}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AccordionSection({ title, icon: Icon, defaultOpen, children }: {
  title: string; icon: typeof Cpu; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div className="rounded-lg bg-slate-800/30 border border-slate-700/30 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-3 text-left">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-white">{title}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-3 pb-3 border-t border-slate-700/30 pt-2">{children}</div>}
    </div>
  );
}

// ── ICE engine: pending proposal approval card ─────────────────────────────
// Mirrors aigentMe's artifact-pill approval pattern: the copilot's structured
// stage proposal renders as an amber card inside the capability capsule it
// belongs to. Approve commits it to the DevLoopState (and advances the strip
// when it satisfies the waiting stage); Dismiss drops it — the operator can
// ask aigentZ to refine and a fresh card replaces it.

function proposalPreviewLines(p: StageProposal): string[] {
  const d = p.data as Record<string, unknown>;
  const count = (v: unknown) => (Array.isArray(v) ? v.length : 0);
  switch (p.kind) {
    case "intent":
      return [
        typeof d.goal === "string" ? `Goal: ${d.goal}` : "",
        `${count(d.users)} user groups · ${count(d.desiredOutcomes)} outcomes · ${count(d.successCriteria)} success criteria · ${count(d.constraints)} constraints`,
      ].filter(Boolean);
    case "context_pack":
      return [`${count(d.items)} context items proposed`];
    case "gap_analysis":
      return [`${count(d.existing)} existing capabilities (reuse/extend) · ${count(d.missing)} to create`];
    case "consequence_canvas":
      return [
        `${count(d.shouldHappen)} should-happen · ${count(d.shouldNeverHappen)} must-never-happen`,
        typeof d.successState === "string" && d.successState ? `Success state: ${d.successState.slice(0, 140)}${d.successState.length > 140 ? "…" : ""}` : "",
      ].filter(Boolean);
    case "implementation_brief":
      return [typeof d.brief === "string" ? `Brief: ${d.brief.split("\n").find(l => l.trim()) ?? ""} (${d.brief.length.toLocaleString()} chars)` : ""];
    case "validation_report":
      return [`${count(d.items)} consequence checks · ${count(d.testingRequirements)} testing requirements`];
    default:
      return [];
  }
}

const PROPOSAL_KIND_LABEL: Record<StageProposalKind, string> = {
  intent: "Distilled Intent",
  context_pack: "Context Pack",
  gap_analysis: "Gap Report",
  consequence_canvas: "Consequence Canvas",
  implementation_brief: "Implementation Package",
  validation_report: "Validation Report",
};

function PendingProposalCard({ proposal, onApprove, onDismiss }: {
  proposal: StageProposal;
  onApprove: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span className="text-[10px] uppercase tracking-wide text-amber-300 font-semibold">
          Proposed by aigentZ — awaiting your approval
        </span>
      </div>
      <div className="text-xs font-semibold text-white">
        {PROPOSAL_KIND_LABEL[proposal.kind]}: {proposal.summary}
      </div>
      <div className="space-y-0.5">
        {proposalPreviewLines(proposal).map((line, i) => (
          <div key={i} className="text-[11px] text-slate-300">{line}</div>
        ))}
      </div>
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={onApprove}
          className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors font-semibold"
        >
          <CheckCircle className="w-3 h-3" />
          Approve
        </button>
        <button
          onClick={onDismiss}
          className="text-[10px] px-2.5 py-1 rounded bg-slate-700/40 text-slate-300 border border-slate-600/40 hover:bg-slate-700/70 transition-colors"
        >
          Dismiss
        </button>
        <span className="text-[10px] text-slate-500 ml-1">
          or ask aigentZ to refine it — a fresh card replaces this one
        </span>
      </div>
    </div>
  );
}

// Capability detail layouts (shown when a capability button is clicked)
function CapabilityLayout({ capsuleId, onBack, session, onAdvanceStage, pendingProposal, onApproveProposal, onDismissProposal }: {
  capsuleId: DevCapsuleId;
  onBack: () => void;
  session: DevLoopState;
  onAdvanceStage: () => void;
  pendingProposal?: StageProposal | null;
  onApproveProposal?: (capsule: DevCapsuleId) => void;
  onDismissProposal?: (capsule: DevCapsuleId) => void;
}) {
  const cap = CAPABILITIES.find(c => c.id === capsuleId);
  if (!cap) return null;

  const canAdvanceNow = canAdvance(session);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          Back to overview
        </button>
        <div className="flex items-center gap-2">
          {canAdvanceNow && (
            <button
              onClick={onAdvanceStage}
              className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors"
            >
              <Play className="w-3 h-3" />
              Advance
            </button>
          )}
          <cap.icon className="w-5 h-5 text-green-400" />
          <h3 className="text-sm font-bold text-white">{cap.label}</h3>
        </div>
      </div>

      {pendingProposal && onApproveProposal && onDismissProposal && (
        <PendingProposalCard
          proposal={pendingProposal}
          onApprove={() => onApproveProposal(capsuleId)}
          onDismiss={() => onDismissProposal(capsuleId)}
        />
      )}

      {capsuleId === "project-overview" && <ProjectOverviewPanel session={session} />}
      {capsuleId === "intent" && session.intent && <IntentPanel intent={session.intent} />}
      {capsuleId === "intent" && !session.intent && (
        <div className="text-xs text-slate-400 italic py-4 text-center">
          No intent captured yet. Use the copilot to start a new intent.
        </div>
      )}
      {capsuleId === "context" && session.contextPack && <ContextPackPanel pack={session.contextPack} />}
      {capsuleId === "context" && !session.contextPack && (
        <div className="text-xs text-slate-400 italic py-4 text-center">
          Context pack assembles after intent is refined. Ask aigentZ to assemble context.
        </div>
      )}
      {capsuleId === "gap-analysis" && session.gapAnalysis && <GapAnalysisPanel analysis={session.gapAnalysis} />}
      {capsuleId === "gap-analysis" && !session.gapAnalysis && (
        <div className="text-xs text-slate-400 italic py-4 text-center">
          Gap analysis runs after context pack is assembled. Ask aigentZ to analyze gaps.
        </div>
      )}
      {capsuleId === "consequence-canvas" && session.consequenceCanvas && (
        <ConsequenceCanvasPanel canvas={session.consequenceCanvas} />
      )}
      {capsuleId === "consequence-canvas" && !session.consequenceCanvas && (
        <div className="text-xs text-slate-400 italic py-4 text-center">
          Consequence canvas models what should and shouldn&apos;t happen. Ask aigentZ to model consequences.
        </div>
      )}
      {capsuleId === "validation" && <ValidationPanel report={session.validationReport} />}
    </div>
  );
}

// Stub layout for tool modals (Terminal, GitHub, DevTools, Linear)
function ToolLayout({ toolId, onBack }: { toolId: string; onBack: () => void }) {
  const tool = DEV_QUICK_LINKS.find(l => l.id === toolId);
  const Icon = tool?.icon ?? Terminal;
  return (
    <div className="space-y-3">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
      >
        <RotateCcw className="w-3 h-3" />
        Back to overview
      </button>
      <div className="flex items-center gap-2">
        <Icon className="w-5 h-5 text-green-400" />
        <h3 className="text-sm font-bold text-white">{tool?.label ?? toolId}</h3>
      </div>
      <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-700/30 min-h-[200px] flex items-center justify-center">
        <div className="text-center">
          <Icon className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-xs text-slate-500">{tool?.label} viewport — Phase 2</p>
          <p className="text-[10px] text-slate-600 mt-1">
            {toolId === "terminal" && "Claude Code terminal session will render here"}
            {toolId === "github" && "Repository browser and PR activity will render here"}
            {toolId === "devtools" && "Build logs, type errors, and diagnostics will render here"}
            {toolId === "linear" && "Linear issue tracker integration will render here"}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────

interface DevCommandCenterTabProps {
  personaId?: string;
}

export function DevCommandCenterTab({ personaId }: DevCommandCenterTabProps) {
  // ICE engine: sessions start clean at intent_capture — the loop is
  // populated by approving aigentZ's stage proposals, not demo data.
  const [session, setSession] = useState<DevLoopState>(() => createDevLoopSession());
  const [activeLayoutId, setActiveLayoutId] = useState<DevLayoutId>("stack");
  const [activeCapsuleId, setActiveCapsuleId] = useState<DevCapsuleId | null>(null);

  const engageCapsuleAndMount = useCallback((next: DevCapsuleId) => {
    setActiveCapsuleId(next);
    setActiveLayoutId(CAPSULE_LAYOUT[next]);
  }, []);

  const returnToStack = useCallback(() => {
    setActiveCapsuleId(null);
    setActiveLayoutId("stack");
  }, []);

  const handleToolOpen = useCallback((toolId: string) => {
    setActiveCapsuleId(null);
    setActiveLayoutId(toolId as DevLayoutId);
  }, []);

  const handleAdvanceStage = useCallback(() => {
    setSession(prev => {
      const next = advanceStage(prev);
      if (next.stage !== prev.stage) {
        console.log(`[aigentZ dev-loop] advanced: ${prev.stage} → ${next.stage}`);
      }
      return next;
    });
  }, []);

  const handleStageClick = useCallback((stageId: DevLoopStage) => {
    const capsuleId = STAGE_TO_CAPSULE[stageId];
    if (capsuleId) engageCapsuleAndMount(capsuleId);
  }, [engageCapsuleAndMount]);

  // ── Copilot-driven suggestions (mirrors aigentMe's suggested-layout
  // contract). The chat route classifies each turn; hints land here and
  // pulse the matching chips — explore-strip tools on the right,
  // capability quick-prompts on the left. Either side's Clear wipes its
  // own class of suggestions, same as aigentMe.
  const [exploreSuggestions, setExploreSuggestions] = useState<ExploreSuggestionMap>({});
  const [capsuleSuggestions, setCapsuleSuggestions] = useState<Partial<Record<DevCapsuleId, boolean>>>({});

  const handleSuggestedLayouts = useCallback((hints: SuggestedLayoutHint[]) => {
    const explore: ExploreSuggestionMap = {};
    const caps: Partial<Record<DevCapsuleId, boolean>> = {};
    for (const h of hints) {
      const id = h.layoutId as string;
      // Explore-strip targets
      if (id === "upload" || id === "download" || id === "terminal" || id === "github" || id === "devtools" || id === "linear") {
        explore[id as ExploreToolId | "upload" | "download"] = true;
      // Direct dev capsule IDs (from aigent-z layout tags)
      } else if (id === "intent" || id === "context" || id === "gap-analysis" || id === "consequence-canvas" || id === "validation" || id === "project-overview") {
        caps[id as DevCapsuleId] = true;
      // aigentMe-vocabulary hints translated to dev capabilities
      } else if (id === "brief" || id === "venture-cockpit") {
        caps["project-overview"] = true;
      } else if (id === "decision-board") {
        caps["consequence-canvas"] = true;
      }
    }
    setExploreSuggestions(explore);
    setCapsuleSuggestions(caps);
  }, []);

  const clearExploreSuggestions = useCallback(() => setExploreSuggestions({}), []);
  const clearCapsuleSuggestions = useCallback(() => setCapsuleSuggestions({}), []);
  const consumeCapsuleSuggestion = useCallback((id: DevCapsuleId) => {
    setCapsuleSuggestions(prev => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  // ── ICE engine: pending stage proposals (mirrors aigentMe's artifact-
  // approval pattern). The copilot's stage_data fences arrive here as
  // structured proposals; each lands as a pending approval card inside
  // its capability capsule. Pending cards persist across turns until
  // approved, dismissed, or replaced by a fresh proposal of the same kind
  // — an empty turn never clobbers an unreviewed artifact.
  const [pendingProposals, setPendingProposals] = useState<Partial<Record<DevCapsuleId, StageProposal>>>({});

  const handleStageProposals = useCallback((proposals: CopilotStageProposal[]) => {
    if (proposals.length === 0) return;
    const typed = proposals.filter(
      (p): p is StageProposal => typeof p.kind === "string" && p.kind in PROPOSAL_KIND_TO_CAPSULE,
    );
    if (typed.length === 0) return;
    setPendingProposals(prev => {
      const next = { ...prev };
      for (const p of typed) {
        next[PROPOSAL_KIND_TO_CAPSULE[p.kind] as DevCapsuleId] = p;
      }
      return next;
    });
    // Surface the first proposal: pulse its chip and mount its capsule so
    // the dev sees the card without hunting for it (containment rule —
    // the artifact renders inside the capability that produced it).
    const capsule = PROPOSAL_KIND_TO_CAPSULE[typed[0].kind] as DevCapsuleId;
    setCapsuleSuggestions(prev => ({ ...prev, [capsule]: true }));
    engageCapsuleAndMount(capsule);
  }, [engageCapsuleAndMount]);

  const handleApproveProposal = useCallback((capsule: DevCapsuleId) => {
    const proposal = pendingProposals[capsule];
    if (!proposal) return;
    setSession(s => {
      let next = applyStageProposal(s, proposal);
      // Auto-advance only when the approved artifact is the one the current
      // stage was waiting for — approving a cyclical revision of an earlier
      // stage must not push the strip forward.
      if (STAGE_PROPOSAL_KIND[next.stage] === proposal.kind && canAdvance(next)) {
        next = advanceStage(next);
      }
      console.log(`[aigentZ ICE] approved ${proposal.kind} → stage ${next.stage}`);
      return next;
    });
    setPendingProposals(prev => {
      const next = { ...prev };
      delete next[capsule];
      return next;
    });
    consumeCapsuleSuggestion(capsule);
  }, [pendingProposals, consumeCapsuleSuggestion]);

  const handleDismissProposal = useCallback((capsule: DevCapsuleId) => {
    setPendingProposals(prev => {
      const next = { ...prev };
      delete next[capsule];
      return next;
    });
    consumeCapsuleSuggestion(capsule);
  }, [consumeCapsuleSuggestion]);

  // Ground context for the copilot — feeds the LLM with current session state.
  // Includes markdown summaries from the service layer so the LLM can reason
  // about the full dev loop without needing a separate API call.
  const copilotGroundContext = useMemo(() => ({
    surface: "dev-command-center",
    activeStage: session.stage,
    activeLayout: activeLayoutId,
    activeCapsule: activeCapsuleId,
    sessionId: session.sessionId,
    canAdvance: canAdvance(session),
    twoTierRouting: {
      description: "aigentZ routes prompts either to the LLM (tier 1, planning/analysis) or to Claude Code (tier 2, code generation). Results from Claude Code flow back through aigentZ for disposition.",
      currentTier: "llm",
    },
    capabilities: CAPABILITIES.map(c => c.id),
    devLoopStages: STAGES.map(s => s.id),
    intentSummary: session.intent ? buildIntentSummary(session.intent) : null,
    contextPackSummary: session.contextPack ? buildContextPackSummary(session.contextPack) : null,
    gapAnalysisSummary: session.gapAnalysis ? buildGapAnalysisSummary(session.gapAnalysis) : null,
    consequenceCanvasSummary: session.consequenceCanvas ? buildConsequenceCanvasSummary(session.consequenceCanvas) : null,
    validationSummary: session.validationReport ? buildValidationSummary(session.validationReport) : null,
    implementationPackage: buildImplementationPackage(session) ? "ready" : "incomplete",
    // Proposals awaiting operator approval — the LLM should remind the
    // operator about unreviewed cards rather than emit duplicate fences.
    pendingApprovals: Object.values(pendingProposals).map(p => p?.kind).filter(Boolean),
  }), [session, activeLayoutId, activeCapsuleId, pendingProposals]);

  // Quick-prompt chips for the copilot left pane. `highlight` pulses the
  // chip when the copilot's last turn suggested the matching capability;
  // clicking consumes that suggestion (mirrors aigentMe's chip contract).
  const copilotQuickPrompts = useMemo((): QuickPrompt[] => [
    {
      label: "New intent",
      prompt: "I want to start a new development intent. Help me distill what I'm trying to build.",
      highlight: capsuleSuggestions["intent"] === true,
      onSelect: () => {
        engageCapsuleAndMount("intent");
        consumeCapsuleSuggestion("intent");
      },
    },
    {
      label: "Where are we?",
      prompt: "Give me a status update on the current dev loop — what stage are we at and what's next?",
      highlight: capsuleSuggestions["project-overview"] === true,
      onSelect: () => {
        engageCapsuleAndMount("project-overview");
        consumeCapsuleSuggestion("project-overview");
      },
    },
    {
      label: "Analyze gaps",
      prompt: "Analyze capability gaps for the current intent. What can we reuse, extend, or build new?",
      highlight: capsuleSuggestions["gap-analysis"] === true,
      onSelect: () => {
        engageCapsuleAndMount("gap-analysis");
        consumeCapsuleSuggestion("gap-analysis");
      },
    },
    {
      label: "Model consequences",
      prompt: "Model the consequences for the current intent. What should happen and what must never happen?",
      highlight: capsuleSuggestions["consequence-canvas"] === true,
      onSelect: () => {
        engageCapsuleAndMount("consequence-canvas");
        consumeCapsuleSuggestion("consequence-canvas");
      },
    },
    {
      label: "Validate build",
      prompt: "Validate the implementation against the consequence canvas. Run the post-prompt validation.",
      highlight: capsuleSuggestions["validation"] === true,
      onSelect: () => {
        engageCapsuleAndMount("validation");
        consumeCapsuleSuggestion("validation");
      },
    },
  ], [engageCapsuleAndMount, capsuleSuggestions, consumeCapsuleSuggestion]);

  // Two-tier routing: on each prompt, classify and log the routing decision
  const handlePrompt = useCallback((prompt: string) => {
    const decision = classifyPromptTier(prompt);
    console.log(`[aigentZ routing] tier=${decision.tier} reason="${decision.reason}" prompt="${prompt.slice(0, 80)}…"`);
    // Tier 1: handled by SmartTriadCopilotLayer's built-in chat POST
    // Tier 2 (stub): would route to Claude Code session and await response
    // For now both tiers flow through the LLM; Claude Code integration is Phase 2
  }, []);

  const isToolLayout = activeLayoutId === "terminal" || activeLayoutId === "github" || activeLayoutId === "devtools" || activeLayoutId === "linear";
  const isCapsuleLayout = activeCapsuleId !== null && !isToolLayout && activeLayoutId !== "stack";

  return (
    <div className="h-[calc(100vh-96px)] flex flex-col lg:flex-row gap-2 px-2 pr-3 overflow-hidden">
      {/* ── LEFT: aigentZ Copilot (50/50 split) ──────────────── */}
      <div className="lg:w-1/2 w-full h-full min-h-0 flex flex-col">
        <SmartTriadCopilotLayer
          isOpen
          variant="panel"
          quickPrompts={copilotQuickPrompts}
          promptPlaceholder="Ask aigentZ — new intent, analyze gaps, model consequences…"
          agent={{ id: "aigent-z", name: "aigentZ" }}
          agentSubtitle="Development Command Center · consequence engineering"
          personaId={personaId}
          groundContext={copilotGroundContext}
          onPrompt={handlePrompt}
          onSuggestedLayouts={handleSuggestedLayouts}
          onStageProposals={handleStageProposals}
          onClearHighlights={clearCapsuleSuggestions}
          onClose={() => undefined}
        />
      </div>

      {/* ── RIGHT: Development Command Center (50/50 split) ─── */}
      <div className="lg:w-1/2 w-full h-full min-h-0 relative flex flex-col">
        {/* Stage strip at top */}
        <div className="shrink-0 py-2">
          <StageStrip stage={session.stage} onStageClick={handleStageClick} />
        </div>

        {/* Scrollable content area */}
        <div className="flex-1 min-h-0 overflow-y-auto px-1 pb-16">
          {activeLayoutId === "stack" && (
            <StackLayout
              onCapabilityClick={engageCapsuleAndMount}
              activeStage={session.stage}
              session={session}
            />
          )}
          {isCapsuleLayout && activeCapsuleId && (
            <CapabilityLayout
              capsuleId={activeCapsuleId}
              onBack={returnToStack}
              session={session}
              onAdvanceStage={handleAdvanceStage}
              pendingProposal={pendingProposals[activeCapsuleId] ?? null}
              onApproveProposal={handleApproveProposal}
              onDismissProposal={handleDismissProposal}
            />
          )}
          {isToolLayout && (
            <ToolLayout toolId={activeLayoutId} onBack={returnToStack} />
          )}
        </div>

        {/* Floating explore strip — pinned to bottom of right pane,
            mirrors aigentMe's ComposeQuickActionsStrip placement. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-3 px-3 z-30">
          <div className="pointer-events-auto">
            <ExploreQuickActionsStrip
              onOpen={(tool) => {
                handleToolOpen(tool);
                setExploreSuggestions(prev => {
                  if (!prev[tool]) return prev;
                  const next = { ...prev };
                  delete next[tool];
                  return next;
                });
              }}
              onUploadOpen={() => {
                console.log("[dev-cmd] upload");
                setExploreSuggestions(prev => {
                  if (!prev.upload) return prev;
                  const next = { ...prev };
                  delete next.upload;
                  return next;
                });
              }}
              onDownloadsOpen={() => {
                console.log("[dev-cmd] download");
                setExploreSuggestions(prev => {
                  if (!prev.download) return prev;
                  const next = { ...prev };
                  delete next.download;
                  return next;
                });
              }}
              activeToolId={isToolLayout ? activeLayoutId : null}
              suggested={exploreSuggestions}
              onClearSuggestions={clearExploreSuggestions}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default DevCommandCenterTab;
