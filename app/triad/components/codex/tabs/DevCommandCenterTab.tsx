"use client";

/**
 * DevCommandCenterTab — aigentZ Development Command Center
 * Operation Chrysalis Phase 1
 *
 * Two-pane split mirroring AigentMeWelcomeSplitTab:
 *
 *   ┌─────────────────────────┬────────────────────────────┐
 *   │                         │  Stage strip (carousel)    │
 *   │   aigentZ Copilot       │  CTA chip row (capsule     │
 *   │   (embedded, persistent)│   activators with advance) │
 *   │                         │  Active layout (capsule)   │
 *   │   Quick-prompt chips:   │                            │
 *   │   New intent · Where    │  Quick links: Terminal ·   │
 *   │   are we? · Analyze     │  GitHub · DevTools ·       │
 *   │   gaps · Model          │  Linear · Upload · Download│
 *   │   consequences ·        │                            │
 *   │   Validate build        │                            │
 *   └─────────────────────────┴────────────────────────────┘
 *
 * Right-pane capsule layouts are standalone files under
 * components/devcommandcenter/layouts/ — each uses LayoutShell for
 * consistent chrome, in line with aigentMe's layout template pattern.
 */

import React, { useState, useCallback, useMemo } from "react";
import {
  Cpu, Target, FileSearch, AlertTriangle, CheckCircle,
  ChevronDown, Package, Layers, ArrowRight,
  Terminal, GitBranch, Wrench, BarChart3,
  Play,
} from "lucide-react";
import { SmartTriadCopilotLayer, type SuggestedLayoutHint, type CopilotStageProposal } from "@/components/smarttriad/copilot/SmartTriadCopilotLayer";
import { ExploreQuickActionsStrip, type ExploreToolId, type ExploreSuggestionMap } from "@/components/metame/copilot/ExploreQuickActionsStrip";

import type {
  DevLoopState,
  DevLoopStage,
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

import {
  IntentLayout,
  ContextLayout,
  GapAnalysisLayout,
  ConsequenceCanvasLayout,
  ValidationLayout,
  ProjectOverviewLayout,
  CAPSULE_LAYOUT,
  type DevCapsuleId,
  type DevLayoutId,
} from "@/components/devcommandcenter/layouts";

type QuickPrompt = string | {
  label: string;
  prompt?: string;
  onSelect?: () => void;
  highlight?: boolean;
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

// ─── Capability chip metadata ────────────────────────────────────────────

const CAPABILITIES: { id: DevCapsuleId; label: string; shortLabel: string; icon: typeof Cpu; activeClass: string; hasDataClass: string; emptyClass: string; iconActiveClass: string; iconEmptyClass: string }[] = [
  { id: "project-overview", label: "Project Overview", shortLabel: "Overview", icon: Layers,
    activeClass: "bg-cyan-500/20 border-cyan-500/40 text-cyan-300 ring-1 ring-cyan-500/30",
    hasDataClass: "bg-cyan-500/10 border-cyan-500/20 text-cyan-300 hover:bg-cyan-500/15",
    emptyClass: "bg-slate-800/40 border-slate-700/30 text-slate-400 hover:bg-slate-800/60 hover:text-white",
    iconActiveClass: "text-cyan-400", iconEmptyClass: "text-slate-500" },
  { id: "intent", label: "Intent Distillation", shortLabel: "Intent", icon: Target,
    activeClass: "bg-blue-500/20 border-blue-500/40 text-blue-300 ring-1 ring-blue-500/30",
    hasDataClass: "bg-blue-500/10 border-blue-500/20 text-blue-300 hover:bg-blue-500/15",
    emptyClass: "bg-slate-800/40 border-slate-700/30 text-slate-400 hover:bg-slate-800/60 hover:text-white",
    iconActiveClass: "text-blue-400", iconEmptyClass: "text-slate-500" },
  { id: "context", label: "Context Pack", shortLabel: "Context", icon: Package,
    activeClass: "bg-purple-500/20 border-purple-500/40 text-purple-300 ring-1 ring-purple-500/30",
    hasDataClass: "bg-purple-500/10 border-purple-500/20 text-purple-300 hover:bg-purple-500/15",
    emptyClass: "bg-slate-800/40 border-slate-700/30 text-slate-400 hover:bg-slate-800/60 hover:text-white",
    iconActiveClass: "text-purple-400", iconEmptyClass: "text-slate-500" },
  { id: "gap-analysis", label: "Gap Analysis", shortLabel: "Gaps", icon: FileSearch,
    activeClass: "bg-emerald-500/20 border-emerald-500/40 text-emerald-300 ring-1 ring-emerald-500/30",
    hasDataClass: "bg-emerald-500/10 border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/15",
    emptyClass: "bg-slate-800/40 border-slate-700/30 text-slate-400 hover:bg-slate-800/60 hover:text-white",
    iconActiveClass: "text-emerald-400", iconEmptyClass: "text-slate-500" },
  { id: "consequence-canvas", label: "Consequence Canvas", shortLabel: "Consequences", icon: AlertTriangle,
    activeClass: "bg-amber-500/20 border-amber-500/40 text-amber-300 ring-1 ring-amber-500/30",
    hasDataClass: "bg-amber-500/10 border-amber-500/20 text-amber-300 hover:bg-amber-500/15",
    emptyClass: "bg-slate-800/40 border-slate-700/30 text-slate-400 hover:bg-slate-800/60 hover:text-white",
    iconActiveClass: "text-amber-400", iconEmptyClass: "text-slate-500" },
  { id: "validation", label: "Validation", shortLabel: "Validate", icon: CheckCircle,
    activeClass: "bg-green-500/20 border-green-500/40 text-green-300 ring-1 ring-green-500/30",
    hasDataClass: "bg-green-500/10 border-green-500/20 text-green-300 hover:bg-green-500/15",
    emptyClass: "bg-slate-800/40 border-slate-700/30 text-slate-400 hover:bg-slate-800/60 hover:text-white",
    iconActiveClass: "text-green-400", iconEmptyClass: "text-slate-500" },
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
      <div className="flex items-center gap-1.5 ml-2 shrink-0">
        <span className="text-[10px] px-2 py-0.5 rounded bg-green-500/20 text-green-300 border border-green-500/30 font-semibold whitespace-nowrap">Phase 1 MVP</span>
        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold whitespace-nowrap">Operation Chrysalis</span>
      </div>
    </div>
  );
}

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

/**
 * CTA chip row — mirrors aigentMe's capsule chip strip.
 * Each chip activates its capsule layout; pulsing chips indicate
 * copilot suggestions; a green dot indicates data is present.
 */
function CapabilityChipRow({ session, activeCapsuleId, pulsing, pending, onChipClick }: {
  session: DevLoopState;
  activeCapsuleId: DevCapsuleId | null;
  pulsing: Partial<Record<DevCapsuleId, boolean>>;
  pending: Partial<Record<DevCapsuleId, StageProposal>>;
  onChipClick: (id: DevCapsuleId) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 px-1">
      {CAPABILITIES.map(cap => {
        const Icon = cap.icon;
        const isActive = activeCapsuleId === cap.id;
        const hasData = capabilityHasData(cap.id, session);
        const isPulsing = pulsing[cap.id] === true;
        const hasPending = pending[cap.id] !== undefined;

        return (
          <button
            key={cap.id}
            type="button"
            onClick={() => onChipClick(cap.id)}
            className={`
              relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold
              whitespace-nowrap transition-all
              ${isActive ? cap.activeClass : hasData ? cap.hasDataClass : cap.emptyClass}
              ${isPulsing ? "animate-pulse" : ""}
            `}
          >
            <Icon className={`w-3.5 h-3.5 shrink-0 ${hasData || isActive ? cap.iconActiveClass : cap.iconEmptyClass}`} />
            <span>{cap.shortLabel}</span>
            {hasData && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />}
            {hasPending && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 border border-slate-900 animate-pulse" />
            )}
          </button>
        );
      })}
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

function StackLayout({ session, activeStage, onCapabilityClick, pending }: {
  session: DevLoopState;
  activeStage: DevLoopStage;
  onCapabilityClick: (id: DevCapsuleId) => void;
  pending: Partial<Record<DevCapsuleId, StageProposal>>;
}) {
  return (
    <div className="space-y-4">
      {/* Capability cards — larger, with summaries + pending indicators */}
      <div className="space-y-2">
        <div className="text-[10px] text-slate-500 uppercase font-semibold px-1">Capabilities</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {CAPABILITIES.map(cap => {
            const Icon = cap.icon;
            const hasData = capabilityHasData(cap.id, session);
            const hasPending = pending[cap.id] !== undefined;
            return (
              <button
                key={cap.id}
                onClick={() => onCapabilityClick(cap.id)}
                className={`relative flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                  hasData ? cap.hasDataClass : cap.emptyClass
                } ${hasPending ? "ring-1 ring-amber-500/40" : ""}`}
              >
                <Icon className={`w-5 h-5 shrink-0 ${hasData ? cap.iconActiveClass : cap.iconEmptyClass}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">{cap.label}</span>
                    {hasData && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {cap.id === "project-overview" && (session.intent ? session.intent.goal : "No active intent")}
                    {cap.id === "intent" && (session.intent ? `${session.intent.status} — ${session.intent.goal}` : "Start a new intent")}
                    {cap.id === "context" && (session.contextPack ? `${session.contextPack.items.length} items assembled` : "Pending intent")}
                    {cap.id === "gap-analysis" && (session.gapAnalysis ? `${session.gapAnalysis.existing.length} existing · ${session.gapAnalysis.missing.length} missing` : "Pending context")}
                    {cap.id === "consequence-canvas" && (session.consequenceCanvas ? `${session.consequenceCanvas.shouldHappen.length + session.consequenceCanvas.shouldNeverHappen.length} entries` : "Pending gaps")}
                    {cap.id === "validation" && (session.validationReport ? session.validationReport.overallVerdict : "Pending implementation")}
                  </div>
                </div>
                {hasPending && (
                  <span className="absolute -top-1 -right-1 flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold animate-pulse">
                    Pending
                  </span>
                )}
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
            const SIcon = s.icon;
            return (
              <div key={s.id} className="flex items-center gap-2 py-0.5">
                <SIcon className={`w-3 h-3 ${isCurrent ? "text-green-400" : isPast ? "text-emerald-400/60" : "text-slate-600"}`} />
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
              No receipts yet. Receipts are created when capabilities complete.
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

function ToolLayout({ toolId, onBack }: { toolId: string; onBack: () => void }) {
  const tool = DEV_QUICK_LINKS.find(l => l.id === toolId);
  const Icon = tool?.icon ?? Terminal;
  return (
    <div className="space-y-3">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
      >
        <ArrowRight className="w-3 h-3 rotate-180" />
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

  // ── Copilot-driven suggestions
  const [exploreSuggestions, setExploreSuggestions] = useState<ExploreSuggestionMap>({});
  const [capsuleSuggestions, setCapsuleSuggestions] = useState<Partial<Record<DevCapsuleId, boolean>>>({});

  const handleSuggestedLayouts = useCallback((hints: SuggestedLayoutHint[]) => {
    const explore: ExploreSuggestionMap = {};
    const caps: Partial<Record<DevCapsuleId, boolean>> = {};
    for (const h of hints) {
      const id = h.layoutId as string;
      if (id === "upload" || id === "download" || id === "terminal" || id === "github" || id === "devtools" || id === "linear") {
        explore[id as ExploreToolId | "upload" | "download"] = true;
      } else if (id === "intent" || id === "context" || id === "gap-analysis" || id === "consequence-canvas" || id === "validation" || id === "project-overview") {
        caps[id as DevCapsuleId] = true;
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

  // ── ICE engine: pending stage proposals
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
    const capsule = PROPOSAL_KIND_TO_CAPSULE[typed[0].kind] as DevCapsuleId;
    setCapsuleSuggestions(prev => ({ ...prev, [capsule]: true }));
    engageCapsuleAndMount(capsule);
  }, [engageCapsuleAndMount]);

  const handleApproveProposal = useCallback((capsule: DevCapsuleId) => {
    const proposal = pendingProposals[capsule];
    if (!proposal) return;
    setSession(s => {
      let next = applyStageProposal(s, proposal);
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

  // Ground context for the copilot
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
    pendingApprovals: Object.values(pendingProposals).map(p => p?.kind).filter(Boolean),
  }), [session, activeLayoutId, activeCapsuleId, pendingProposals]);

  // Quick-prompt chips for the copilot left pane
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
      label: "Assemble context",
      prompt: "Assemble the context pack for the current intent. Identify files, services, and patterns to reuse.",
      highlight: capsuleSuggestions["context"] === true,
      onSelect: () => {
        engageCapsuleAndMount("context");
        consumeCapsuleSuggestion("context");
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

  const handlePrompt = useCallback((prompt: string) => {
    const decision = classifyPromptTier(prompt);
    console.log(`[aigentZ routing] tier=${decision.tier} reason="${decision.reason}" prompt="${prompt.slice(0, 80)}…"`);
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

        {/* CTA chip row — mirrors aigentMe's capsule chip strip */}
        <div className="shrink-0 py-1">
          <CapabilityChipRow
            session={session}
            activeCapsuleId={activeCapsuleId}
            pulsing={capsuleSuggestions}
            pending={pendingProposals}
            onChipClick={(id) => {
              if (activeCapsuleId === id) {
                returnToStack();
              } else {
                engageCapsuleAndMount(id);
              }
              consumeCapsuleSuggestion(id);
            }}
          />
        </div>

        {/* Scrollable content area — capsule layouts or stack */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {activeLayoutId === "stack" && (
            <div className="h-full overflow-y-auto px-1 pb-16">
              <StackLayout
                session={session}
                activeStage={session.stage}
                onCapabilityClick={engageCapsuleAndMount}
                pending={pendingProposals}
              />
            </div>
          )}

          {isCapsuleLayout && activeCapsuleId === "project-overview" && (
            <ProjectOverviewLayout
              session={session}
              onDismiss={returnToStack}
              onAdvanceStage={handleAdvanceStage}
              pendingProposal={pendingProposals["project-overview"] ?? null}
              onApproveProposal={() => handleApproveProposal("project-overview")}
              onDismissProposal={() => handleDismissProposal("project-overview")}
              onNavigateCapsule={engageCapsuleAndMount}
            />
          )}
          {isCapsuleLayout && activeCapsuleId === "intent" && (
            <IntentLayout
              session={session}
              onDismiss={returnToStack}
              onAdvanceStage={handleAdvanceStage}
              pendingProposal={pendingProposals["intent"] ?? null}
              onApproveProposal={() => handleApproveProposal("intent")}
              onDismissProposal={() => handleDismissProposal("intent")}
            />
          )}
          {isCapsuleLayout && activeCapsuleId === "context" && (
            <ContextLayout
              session={session}
              onDismiss={returnToStack}
              onAdvanceStage={handleAdvanceStage}
              pendingProposal={pendingProposals["context"] ?? null}
              onApproveProposal={() => handleApproveProposal("context")}
              onDismissProposal={() => handleDismissProposal("context")}
            />
          )}
          {isCapsuleLayout && activeCapsuleId === "gap-analysis" && (
            <GapAnalysisLayout
              session={session}
              onDismiss={returnToStack}
              onAdvanceStage={handleAdvanceStage}
              pendingProposal={pendingProposals["gap-analysis"] ?? null}
              onApproveProposal={() => handleApproveProposal("gap-analysis")}
              onDismissProposal={() => handleDismissProposal("gap-analysis")}
            />
          )}
          {isCapsuleLayout && activeCapsuleId === "consequence-canvas" && (
            <ConsequenceCanvasLayout
              session={session}
              onDismiss={returnToStack}
              onAdvanceStage={handleAdvanceStage}
              pendingProposal={pendingProposals["consequence-canvas"] ?? null}
              onApproveProposal={() => handleApproveProposal("consequence-canvas")}
              onDismissProposal={() => handleDismissProposal("consequence-canvas")}
            />
          )}
          {isCapsuleLayout && activeCapsuleId === "validation" && (
            <ValidationLayout
              session={session}
              onDismiss={returnToStack}
              onAdvanceStage={handleAdvanceStage}
              pendingProposal={pendingProposals["validation"] ?? null}
              onApproveProposal={() => handleApproveProposal("validation")}
              onDismissProposal={() => handleDismissProposal("validation")}
            />
          )}

          {isToolLayout && (
            <div className="h-full overflow-y-auto px-1 pb-16">
              <ToolLayout toolId={activeLayoutId} onBack={returnToStack} />
            </div>
          )}
        </div>

        {/* Floating explore strip */}
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
