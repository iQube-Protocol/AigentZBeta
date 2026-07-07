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

import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  Cpu, Target, FileSearch, AlertTriangle, CheckCircle,
  ChevronDown, Package, Layers, ArrowRight,
  Play, ShieldAlert, Rocket,
} from "lucide-react";
import { SmartTriadCopilotLayer, type SuggestedLayoutHint, type CopilotStageProposal } from "@/components/smarttriad/copilot/SmartTriadCopilotLayer";
import { ExploreQuickActionsStrip, type ExploreToolId, type ExploreSuggestionMap } from "@/components/metame/copilot/ExploreQuickActionsStrip";

import type {
  DevLoopState,
  DevLoopStage,
  DevReceiptClass,
  DeploymentAuthorization,
} from "@/types/devCommandCenter";

import { personaFetch } from "@/utils/personaSpine";

import {
  createDevLoopSession,
  isPristineDevLoopSession,
  canAdvance,
  advanceStage,
  buildImplementationPackage,
  buildIntentSummary,
  buildContextPackSummary,
  buildGapAnalysisSummary,
  buildConsequenceCanvasSummary,
  buildValidationSummary,
  applyStageProposal,
  recordDevReceipt,
  stageCapsuleId,
  stageActionLive,
  STAGE_PROPOSAL_KIND,
  PROPOSAL_KIND_TO_CAPSULE,
  type StageProposal,
  type StageProposalKind,
} from "@/services/devCommandCenter";
import {
  generateAffordances,
  resolveAutoActable,
  autoActNotice,
  autoActPolicyChangeNotice,
  disableAutoAct,
  DEFAULT_AUTO_ACT_POLICY,
  type AutoActPolicy,
} from "@/services/dcir/affordances";

import type { DcirEvent } from "@/types/dcir";
import {
  appendDcirEvent,
  compactDcirEvents,
  devStageProposalReceivedEvent,
  devProposalApprovedEvent,
  devProposalDismissedEvent,
  devStageAdvancedEvent,
  devCapsuleOpenedEvent,
  devCapsuleClosedEvent,
  devImplementationPackGeneratedEvent,
  devDeploymentProposedEvent,
  devAutoActedEvent,
  devToolUsedEvent,
} from "@/services/dcir/eventStream";
import {
  buildStateSnapshot,
  mineBehaviouralInvariants,
  compactBehaviouralInvariants,
} from "@/services/dcir/stateEngine";

import {
  IntentLayout,
  ContextLayout,
  GapAnalysisLayout,
  ConsequenceCanvasLayout,
  ImplementationLayout,
  ValidationLayout,
  RemediationLayout,
  DeploymentAuthorizationLayout,
  ProjectOverviewLayout,
  TerminalLayout,
  DevToolsLayout,
  GitHubLayout,
  LinearLayout,
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
  { id: "remediation", label: "Remediate", icon: ShieldAlert },
  { id: "deployment_authorization", label: "Deploy Auth", icon: Rocket },
  { id: "complete", label: "Complete", icon: CheckCircle },
];

const STAGE_TO_CAPSULE: Partial<Record<DevLoopStage, DevCapsuleId>> = {
  intent_capture: "intent",
  context_assembly: "context",
  gap_analysis: "gap-analysis",
  consequence_modeling: "consequence-canvas",
  implementation: "implementation",
  consequence_validation: "validation",
  remediation: "remediation",
  deployment_authorization: "deployment-authorization",
};

// Inverse of STAGE_TO_CAPSULE for the intelligent-affordance gate. "project-
// overview" is a status view, not a loop stage — omitted so it never reads as
// stale/irrelevant work.
const CAPSULE_TO_STAGE: Partial<Record<DevCapsuleId, DevLoopStage>> = {
  intent: "intent_capture",
  context: "context_assembly",
  "gap-analysis": "gap_analysis",
  "consequence-canvas": "consequence_modeling",
  implementation: "implementation",
  validation: "consequence_validation",
  remediation: "remediation",
  "deployment-authorization": "deployment_authorization",
};

function getStageIndex(stage: DevLoopStage): number {
  return STAGES.findIndex(s => s.id === stage);
}

// ─── Capability chip metadata ────────────────────────────────────────────

const CAPABILITIES: { id: DevCapsuleId; label: string; shortLabel: string; icon: typeof Cpu; activeClass: string; hasDataClass: string; emptyClass: string; iconActiveClass: string; iconEmptyClass: string }[] = [
  { id: "project-overview", label: "Project Overview", shortLabel: "Overview", icon: Layers,
    activeClass: "bg-cyan-500/20 border-cyan-500/40 text-cyan-300 ring-1 ring-cyan-500/30",
    hasDataClass: "bg-cyan-500/10 border-cyan-500/20 text-cyan-300 hover:bg-cyan-500/15",
    emptyClass: "bg-cyan-500/5 border-cyan-500/15 text-cyan-400/60 hover:bg-cyan-500/10 hover:text-cyan-300",
    iconActiveClass: "text-cyan-400", iconEmptyClass: "text-cyan-500/50" },
  { id: "intent", label: "Intent Distillation", shortLabel: "Intent", icon: Target,
    activeClass: "bg-blue-500/20 border-blue-500/40 text-blue-300 ring-1 ring-blue-500/30",
    hasDataClass: "bg-blue-500/10 border-blue-500/20 text-blue-300 hover:bg-blue-500/15",
    emptyClass: "bg-blue-500/5 border-blue-500/15 text-blue-400/60 hover:bg-blue-500/10 hover:text-blue-300",
    iconActiveClass: "text-blue-400", iconEmptyClass: "text-blue-500/50" },
  { id: "context", label: "Context Pack", shortLabel: "Context", icon: Package,
    activeClass: "bg-purple-500/20 border-purple-500/40 text-purple-300 ring-1 ring-purple-500/30",
    hasDataClass: "bg-purple-500/10 border-purple-500/20 text-purple-300 hover:bg-purple-500/15",
    emptyClass: "bg-purple-500/5 border-purple-500/15 text-purple-400/60 hover:bg-purple-500/10 hover:text-purple-300",
    iconActiveClass: "text-purple-400", iconEmptyClass: "text-purple-500/50" },
  { id: "gap-analysis", label: "Gap Analysis", shortLabel: "Gaps", icon: FileSearch,
    activeClass: "bg-emerald-500/20 border-emerald-500/40 text-emerald-300 ring-1 ring-emerald-500/30",
    hasDataClass: "bg-emerald-500/10 border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/15",
    emptyClass: "bg-emerald-500/5 border-emerald-500/15 text-emerald-400/60 hover:bg-emerald-500/10 hover:text-emerald-300",
    iconActiveClass: "text-emerald-400", iconEmptyClass: "text-emerald-500/50" },
  { id: "consequence-canvas", label: "Consequence Canvas", shortLabel: "Consequences", icon: AlertTriangle,
    activeClass: "bg-amber-500/20 border-amber-500/40 text-amber-300 ring-1 ring-amber-500/30",
    hasDataClass: "bg-amber-500/10 border-amber-500/20 text-amber-300 hover:bg-amber-500/15",
    emptyClass: "bg-amber-500/5 border-amber-500/15 text-amber-400/60 hover:bg-amber-500/10 hover:text-amber-300",
    iconActiveClass: "text-amber-400", iconEmptyClass: "text-amber-500/50" },
  { id: "implementation", label: "Implementation", shortLabel: "Implement", icon: Cpu,
    activeClass: "bg-indigo-500/20 border-indigo-500/40 text-indigo-300 ring-1 ring-indigo-500/30",
    hasDataClass: "bg-indigo-500/10 border-indigo-500/20 text-indigo-300 hover:bg-indigo-500/15",
    emptyClass: "bg-indigo-500/5 border-indigo-500/15 text-indigo-400/60 hover:bg-indigo-500/10 hover:text-indigo-300",
    iconActiveClass: "text-indigo-400", iconEmptyClass: "text-indigo-500/50" },
  { id: "validation", label: "Constitutional Validation", shortLabel: "Validate", icon: CheckCircle,
    activeClass: "bg-green-500/20 border-green-500/40 text-green-300 ring-1 ring-green-500/30",
    hasDataClass: "bg-green-500/10 border-green-500/20 text-green-300 hover:bg-green-500/15",
    emptyClass: "bg-green-500/5 border-green-500/15 text-green-400/60 hover:bg-green-500/10 hover:text-green-300",
    iconActiveClass: "text-green-400", iconEmptyClass: "text-green-500/50" },
  { id: "remediation", label: "Remediation", shortLabel: "Remediate", icon: ShieldAlert,
    activeClass: "bg-rose-500/20 border-rose-500/40 text-rose-300 ring-1 ring-rose-500/30",
    hasDataClass: "bg-rose-500/10 border-rose-500/20 text-rose-300 hover:bg-rose-500/15",
    emptyClass: "bg-rose-500/5 border-rose-500/15 text-rose-400/60 hover:bg-rose-500/10 hover:text-rose-300",
    iconActiveClass: "text-rose-400", iconEmptyClass: "text-rose-500/50" },
  { id: "deployment-authorization", label: "Deployment Authorization", shortLabel: "Deploy Auth", icon: Rocket,
    activeClass: "bg-teal-500/20 border-teal-500/40 text-teal-300 ring-1 ring-teal-500/30",
    hasDataClass: "bg-teal-500/10 border-teal-500/20 text-teal-300 hover:bg-teal-500/15",
    emptyClass: "bg-teal-500/5 border-teal-500/15 text-teal-400/60 hover:bg-teal-500/10 hover:text-teal-300",
    iconActiveClass: "text-teal-400", iconEmptyClass: "text-teal-500/50" },
];

// Dev Receipts panel — the three constitutional classes (CFS-020 CDE).
const RECEIPT_CLASS_LABEL: Record<DevReceiptClass, string> = {
  development: "Development",
  constitutional: "Constitutional",
  deployment: "Deployment",
};

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
    case "implementation": return Boolean(session.implementationBrief);
    case "validation": return session.validationReport !== null;
    case "remediation": return session.remediationPlan != null;
    case "deployment-authorization": return session.deploymentAuthorization != null;
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
                    {cap.id === "implementation" && (session.implementationBrief ? "Brief ready — generate the pack" : "Pending consequences")}
                    {cap.id === "validation" && (session.validationReport ? session.validationReport.overallVerdict : "Pending implementation")}
                    {cap.id === "remediation" && (session.remediationPlan ? `${session.remediationPlan.remedies.length} remed(ies)` : "No remediation required")}
                    {cap.id === "deployment-authorization" && (session.deploymentAuthorization ? (session.deploymentAuthorization.authorized ? "Authorized" : "Blocked") : "Pending validation")}
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
            (["development", "constitutional", "deployment"] as DevReceiptClass[]).map((cls) => {
              const items = session.receipts.filter(r => r.class === cls);
              if (items.length === 0) return null;
              return (
                <div key={cls} className="space-y-1">
                  <div className="text-[10px] uppercase font-semibold text-slate-400">
                    {RECEIPT_CLASS_LABEL[cls]} ({items.length})
                  </div>
                  {items.map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-2 py-1 border-b border-slate-700/20 last:border-0">
                      <span className="text-[10px] text-slate-300 truncate">{r.actionType}</span>
                      <span className="text-[10px] text-slate-500 font-mono shrink-0">{r.id.slice(0, 10)}…</span>
                    </div>
                  ))}
                </div>
              );
            })
          ) : (
            <div className="text-xs text-slate-400 py-1">
              No receipts yet. Receipts are recorded when constitutional actions complete — pack
              generation (Development), validation + remediation (Constitutional), and deployment
              proposal + authorization (Deployment).
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
            { label: "Constitutional Validation", stage: "consequence_validation" },
            { label: "Remediation", stage: "remediation" },
            { label: "Deployment Authorization", stage: "deployment_authorization" },
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

// ─── Main Component ────────────────────────────────────────────────────────

interface DevCommandCenterTabProps {
  personaId?: string;
}

export function DevCommandCenterTab({ personaId }: DevCommandCenterTabProps) {
  const [session, setSession] = useState<DevLoopState>(() => createDevLoopSession());
  const [activeLayoutId, setActiveLayoutId] = useState<DevLayoutId>("stack");
  const [activeCapsuleId, setActiveCapsuleId] = useState<DevCapsuleId | null>(null);

  // ── Auto-act control (ratified operator policy, 2026-07-07). Ships OFF
  // (DEFAULT_AUTO_ACT_POLICY) — suggest-only is the default posture. Opt-in is
  // bounded to the navigation class by resolveAutoActable (the single choke-
  // point in services/dcir/affordances.ts, never re-implemented here) and is
  // always disablable in one synchronous click (caveat 2a). Every flip AND
  // every actual auto-execution notifies the operator (caveat 2b).
  const [autoActPolicy, setAutoActPolicy] = useState<AutoActPolicy>(DEFAULT_AUTO_ACT_POLICY);
  // Transient operator-facing notice line for auto-act flips + executions.
  const [autoActNoticeLine, setAutoActNoticeLine] = useState<string | null>(null);
  // At-most-once guard: a given affordance id auto-acts a single time per session.
  const autoActedIdsRef = useRef<Set<string>>(new Set());

  // ── DCIR D1 event stream (CFS-020) — OBSERVE-MODE ONLY.
  // Session-scoped ring buffer of what already happened; emissions ride the
  // existing seams and never block or mutate any behavior. The next copilot
  // turn observes the compacted tail via copilotGroundContext.recentEvents.
  const [dcirEvents, setDcirEvents] = useState<DcirEvent[]>([]);
  const observe = useCallback((event: DcirEvent) => {
    setDcirEvents(prev => appendDcirEvent(prev, event));
  }, []);

  // Observe EVERY stage transition (Advance button, approve-with-advance,
  // intent restart) from the state itself — the observation runtime watches
  // outcomes, it does not hook each caller.
  const prevStageRef = useRef<DevLoopStage>(session.stage);
  useEffect(() => {
    if (prevStageRef.current !== session.stage) {
      observe(devStageAdvancedEvent(prevStageRef.current, session.stage));
      prevStageRef.current = session.stage;
    }
  }, [session.stage, observe]);

  const engageCapsuleAndMount = useCallback((next: DevCapsuleId) => {
    setActiveCapsuleId(next);
    setActiveLayoutId(CAPSULE_LAYOUT[next]);
    observe(devCapsuleOpenedEvent(next));
  }, [observe]);

  const returnToStack = useCallback(() => {
    if (activeCapsuleId) observe(devCapsuleClosedEvent(activeCapsuleId));
    setActiveCapsuleId(null);
    setActiveLayoutId("stack");
  }, [activeCapsuleId, observe]);

  const handleToolOpen = useCallback((toolId: string) => {
    setActiveCapsuleId(null);
    setActiveLayoutId(toolId as DevLayoutId);
  }, []);

  // ── Session persistence (CFS-020 CDE — closes the in-memory honest limit).
  // Server-first: the DB is the store (CLAUDE.md State Management Boundaries);
  // localStorage is deliberately NOT used for the session. All fetches ride
  // personaFetch (spine rule — raw fetch returns 401 on spine routes).
  const sessionRef = useRef<DevLoopState>(session);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);
  const hydrateAttemptedRef = useRef(false);
  const lastSavedRef = useRef<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "failed">("idle");

  // Hydrate-on-mount: restore the caller's most recent session and re-mount
  // the restored stage's capsule so the surface lands where the operator left
  // off. Hydration only ever lands on a still-pristine default session — it
  // never clobbers work the operator started before the fetch returned.
  useEffect(() => {
    if (hydrateAttemptedRef.current) return;
    hydrateAttemptedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const res = await personaFetch("/api/dev-command-center/sessions", { cache: "no-store" });
        if (cancelled || !res.ok) return;
        const json = await res.json().catch(() => null);
        const restored = json?.session as DevLoopState | null;
        if (cancelled || !restored || typeof restored.sessionId !== "string") return;
        if (!isPristineDevLoopSession(sessionRef.current)) return; // operator already started — keep their work
        // The restored state IS the saved state — prime the save guard so the
        // auto-save effect doesn't immediately re-POST what we just fetched.
        lastSavedRef.current = JSON.stringify(restored);
        // Keep the stage-transition observer honest: hydration is a restore,
        // not a stage advance.
        prevStageRef.current = restored.stage;
        setSession(restored);
        const capsule = stageCapsuleId(restored.stage) as DevCapsuleId | null;
        if (capsule) engageCapsuleAndMount(capsule);
        console.log(`[dev-cmd] session restored: ${restored.sessionId} @ ${restored.stage}`);
      } catch (err) {
        console.warn("[dev-cmd] session hydration failed (non-blocking):", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [engageCapsuleAndMount]);

  // Debounced auto-save: persist ~1.5s after the last session change.
  // Fire-and-forget — persistence must never block the loop. Pristine default
  // sessions are skipped (nothing worth persisting; also skips the initial
  // state before hydration lands). A new intent/session simply persists under
  // its new session_id via the same upsert.
  useEffect(() => {
    if (isPristineDevLoopSession(session)) return;
    const serialized = JSON.stringify(session);
    if (serialized === lastSavedRef.current) return;
    const timer = setTimeout(() => {
      personaFetch("/api/dev-command-center/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session }),
        cache: "no-store",
      })
        .then((res) => {
          if (res.ok) {
            lastSavedRef.current = serialized;
            setSaveStatus("saved");
          } else {
            setSaveStatus("failed");
            console.warn(`[dev-cmd] session save failed (non-blocking): HTTP ${res.status}`);
          }
        })
        .catch((err) => {
          setSaveStatus("failed");
          console.warn("[dev-cmd] session save failed (non-blocking):", err);
        });
    }, 1500);
    return () => clearTimeout(timer);
  }, [session]);

  const handleAdvanceStage = useCallback(() => {
    setSession(prev => {
      const next = advanceStage(prev);
      if (next.stage !== prev.stage) {
        console.log(`[aigentZ dev-loop] advanced: ${prev.stage} → ${next.stage}`);
      }
      return next;
    });
  }, []);

  // Receipt-bug fix: every constitutional action's returned receiptId is
  // recorded into session.receipts (idempotent) so the Dev Receipts panel
  // reflects the three receipt classes instead of always reading "No receipts".
  const handleReceipt = useCallback((receipt: { id: string; actionType: string }) => {
    setSession(prev => recordDevReceipt(prev, receipt));
  }, []);

  // Direct commit of a deployment authorization (from the layout's Authorize
  // action) so the loop can complete — constitutional-threshold-gated inside
  // the layout, this only fires once the consequence test passed.
  const handleDeploymentAuthorized = useCallback((auth: DeploymentAuthorization) => {
    setSession(prev => ({ ...prev, deploymentAuthorization: auth, updatedAt: new Date().toISOString() }));
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
      } else if (id === "intent" || id === "context" || id === "gap-analysis" || id === "consequence-canvas" || id === "implementation" || id === "validation" || id === "remediation" || id === "deployment-authorization" || id === "project-overview") {
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

  // ── Feedback Coordinator (CFS-020 #12, first slice) — observation-initiated
  // turns (operator finding 6, 2026-07-06). Minted ONLY from an approval that
  // advanced the loop (an operator-gated transition): the copilot prompts the
  // operator on the next task from its updated awareness, one auto-turn per
  // transition. Never minted on dismissal, capsule clicks, or from a turn
  // that was itself auto-prompted (auto-turns can't approve anything).
  const [autoPrompt, setAutoPrompt] = useState<{ id: string; text: string } | null>(null);

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
    for (const p of typed) {
      observe(devStageProposalReceivedEvent(p.kind, PROPOSAL_KIND_TO_CAPSULE[p.kind]));
    }
    const capsule = PROPOSAL_KIND_TO_CAPSULE[typed[0].kind] as DevCapsuleId;
    setCapsuleSuggestions(prev => ({ ...prev, [capsule]: true }));
    engageCapsuleAndMount(capsule);
  }, [engageCapsuleAndMount, observe]);

  const handleApproveProposal = useCallback((capsule: DevCapsuleId) => {
    const proposal = pendingProposals[capsule];
    if (!proposal) return;
    // Apply + advance synchronously so the flow-through below can see the
    // post-approval stage (approval is a discrete click — no batching risk).
    let next = applyStageProposal(session, proposal);
    if (STAGE_PROPOSAL_KIND[next.stage] === proposal.kind && canAdvance(next)) {
      next = advanceStage(next);
    }
    console.log(`[aigentZ ICE] approved ${proposal.kind} → stage ${next.stage}`);
    setSession(next);
    observe(devProposalApprovedEvent(proposal.kind, capsule));
    setPendingProposals(prev => {
      const rest = { ...prev };
      delete rest[capsule];
      return rest;
    });
    consumeCapsuleSuggestion(capsule);
    // Flow-through (operator finding 3, 2026-07-06): when approval advanced
    // the loop, auto-close the approved capsule and auto-open the NEW session
    // stage's capsule so the right pane flows with the loop. Sequential flow
    // inside the loop's own capsules — not orphan spawning: the next capsule
    // is the loop's next stage, derived from the canary-pinned maps.
    const nextCapsule = stageCapsuleId(next.stage) as DevCapsuleId | null;
    if (next.stage !== session.stage && nextCapsule && nextCapsule !== capsule) {
      observe(devCapsuleClosedEvent(capsule));
      engageCapsuleAndMount(nextCapsule);
      // Finding 6: the conversation progresses proactively — one auto-turn
      // per approval transition, sent through the copilot's normal path.
      const nextKind = STAGE_PROPOSAL_KIND[next.stage];
      setAutoPrompt({
        id: `auto-${next.stage}-${Date.now()}`,
        text: `[observed] The ${proposal.kind} proposal was approved and the loop advanced to ${next.stage}. Guide me to the next task${nextKind ? ` and, when ready, produce the ${nextKind} proposal` : ''}.`,
      });
    }
  }, [pendingProposals, session, consumeCapsuleSuggestion, observe, engageCapsuleAndMount]);

  const handleDismissProposal = useCallback((capsule: DevCapsuleId) => {
    const dismissed = pendingProposals[capsule];
    if (dismissed) observe(devProposalDismissedEvent(dismissed.kind, capsule));
    setPendingProposals(prev => {
      const next = { ...prev };
      delete next[capsule];
      return next;
    });
    consumeCapsuleSuggestion(capsule);
  }, [pendingProposals, consumeCapsuleSuggestion, observe]);

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
    // DCIR D1 observation seam: the last ~12 session events, compacted —
    // the next copilot turn observes what happened (narrate-only).
    recentEvents: compactDcirEvents(dcirEvents),
    // DCIR D2 (observe-mode): compact constitutional state snapshot +
    // behavioural patterns mined from this session only — observations the
    // copilot may gently adapt to, NEVER rules (CFS-020 §6). Session-scoped;
    // nothing persists, nothing gates.
    stateSnapshot: buildStateSnapshot(dcirEvents, {
      surface: "dev-command-center",
      workflowStage: session.stage,
      activeCapsule: activeCapsuleId,
    }),
    observedPatterns: compactBehaviouralInvariants(mineBehaviouralInvariants(dcirEvents)),
  }), [session, activeLayoutId, activeCapsuleId, pendingProposals, dcirEvents]);

  // ── Intelligent affordances (operator finding, 2026-07-07): the pulsating
  // quick actions consult the DCIR D3 affordance service + session state so a
  // chip never pulses for an action that is already executed, completed, or no
  // longer relevant. Two halves, same service:
  //   • D3 generateAffordances() supplies the observed-event half — a
  //     positively-live affordance (a pending proposal, a stalled stage) always
  //     pulses, keyed by capsuleScope.
  //   • stageActionLive() supplies the session-state half — suppresses chips
  //     whose stage artifact is done-and-past or contextually irrelevant.
  const liveAffordances = useMemo(
    () => generateAffordances(dcirEvents, copilotGroundContext.stateSnapshot),
    [dcirEvents, copilotGroundContext.stateSnapshot],
  );
  const liveAffordanceScopes = useMemo(
    () => new Set(liveAffordances.map(a => a.capsuleScope)),
    [liveAffordances],
  );

  // ── Auto-act control surface (opt-in, navigation-only, always-disablable,
  // always-notifying). The toggle is the kill switch too: when ON, one click
  // disables it synchronously via disableAutoAct() (caveat 2a). Every flip
  // surfaces autoActPolicyChangeNotice() to the operator (caveat 2b).
  const toggleAutoAct = useCallback(() => {
    setAutoActPolicy(prev => {
      const next = prev.enabled ? disableAutoAct() : { enabled: true };
      setAutoActNoticeLine(autoActPolicyChangeNotice(next));
      return next;
    });
  }, []);

  // The auto-act execution loop. A NO-OP unless the operator opted in. For each
  // currently-live affordance, resolveAutoActable (the affordances.ts choke-
  // point — the class check is NEVER hand-rolled here) decides eligibility:
  // policy enabled + navigation class, nothing else. An eligible affordance
  // opens its capsule WITHIN the operator's context (engageCapsuleAndMount →
  // Capsule Containment, no orphan output), fires a T2-safe DCIR observation of
  // the auto-act, and surfaces the required execution notice. The at-most-once
  // ref guards against loops/repeats (a nav auto-act also makes that affordance
  // non-live on the next derivation, but the guard is the belt-and-braces).
  useEffect(() => {
    if (!autoActPolicy.enabled) return;
    for (const aff of liveAffordances) {
      if (!resolveAutoActable(aff, autoActPolicy)) continue; // boundary: nav only
      if (autoActedIdsRef.current.has(aff.id)) continue;      // at most once
      const scope = aff.capsuleScope;
      if (!Object.prototype.hasOwnProperty.call(CAPSULE_LAYOUT, scope)) continue;
      autoActedIdsRef.current.add(aff.id);
      engageCapsuleAndMount(scope as DevCapsuleId);
      observe(devAutoActedEvent(aff.label, scope));
      setAutoActNoticeLine(autoActNotice(aff));
    }
  }, [liveAffordances, autoActPolicy, engageCapsuleAndMount, observe]);

  const chipShouldPulse = useCallback((id: DevCapsuleId): boolean => {
    // D3 positively-live affordance for this capsule → always pulses.
    if (liveAffordanceScopes.has(id)) return true;
    // No standing suggestion → nothing to pulse.
    if (capsuleSuggestions[id] !== true) return false;
    // A suggestion stands unless the action is completed-and-past or irrelevant.
    const stage = CAPSULE_TO_STAGE[id];
    if (!stage) return true; // status view (project-overview) — suggestion stands
    return stageActionLive(stage, session);
  }, [liveAffordanceScopes, capsuleSuggestions, session]);

  // The pulse map the chip strip + stage strip consume — capsuleSuggestions
  // filtered through the intelligent gate so stale/irrelevant chips go quiet.
  const intelligentPulsing = useMemo((): Partial<Record<DevCapsuleId, boolean>> => {
    const out: Partial<Record<DevCapsuleId, boolean>> = {};
    for (const cap of CAPABILITIES) {
      if (chipShouldPulse(cap.id)) out[cap.id] = true;
    }
    return out;
  }, [chipShouldPulse]);

  // Quick-prompt chips for the copilot left pane
  const copilotQuickPrompts = useMemo((): QuickPrompt[] => [
    {
      label: "New intent",
      prompt: "I want to start a new development intent. Help me distill what I'm trying to build.",
      highlight: chipShouldPulse("intent"),
      onSelect: () => {
        engageCapsuleAndMount("intent");
        consumeCapsuleSuggestion("intent");
      },
    },
    {
      label: "Where are we?",
      prompt: "Give me a status update on the current dev loop — what stage are we at and what's next?",
      highlight: chipShouldPulse("project-overview"),
      onSelect: () => {
        engageCapsuleAndMount("project-overview");
        consumeCapsuleSuggestion("project-overview");
      },
    },
    {
      label: "Assemble context",
      prompt: "Assemble the context pack for the current intent. Identify files, services, and patterns to reuse.",
      highlight: chipShouldPulse("context"),
      onSelect: () => {
        engageCapsuleAndMount("context");
        consumeCapsuleSuggestion("context");
      },
    },
    {
      label: "Analyze gaps",
      prompt: "Analyze capability gaps for the current intent. What can we reuse, extend, or build new?",
      highlight: chipShouldPulse("gap-analysis"),
      onSelect: () => {
        engageCapsuleAndMount("gap-analysis");
        consumeCapsuleSuggestion("gap-analysis");
      },
    },
    {
      label: "Model consequences",
      prompt: "Model the consequences for the current intent. What should happen and what must never happen?",
      highlight: chipShouldPulse("consequence-canvas"),
      onSelect: () => {
        engageCapsuleAndMount("consequence-canvas");
        consumeCapsuleSuggestion("consequence-canvas");
      },
    },
    {
      label: "Implementation brief",
      prompt: "Produce the implementation brief for the current intent — PRD, architecture plan, task list, and Claude Code instructions.",
      highlight: chipShouldPulse("implementation"),
      onSelect: () => {
        engageCapsuleAndMount("implementation");
        consumeCapsuleSuggestion("implementation");
      },
    },
    {
      label: "Validate build",
      prompt: "Run the constitutional consequence test: validate the implementation against the consequence canvas. Give every must-happen and must-never-happen a verdict with evidence.",
      highlight: chipShouldPulse("validation"),
      onSelect: () => {
        engageCapsuleAndMount("validation");
        consumeCapsuleSuggestion("validation");
      },
    },
    {
      label: "Remediate failures",
      prompt: "Remediate the failed or partial high-severity consequences. Propose a concrete remedy and a captured lesson (learningNote) for each, and state whether re-validation is required.",
      highlight: chipShouldPulse("remediation"),
      onSelect: () => {
        engageCapsuleAndMount("remediation");
        consumeCapsuleSuggestion("remediation");
      },
    },
    {
      label: "Authorize deployment",
      prompt: "Author the deployment authorization. Confirm the constitutional threshold is met (consequence test passed) or list the blocking consequences. Execution stays human.",
      highlight: chipShouldPulse("deployment-authorization"),
      onSelect: () => {
        engageCapsuleAndMount("deployment-authorization");
        consumeCapsuleSuggestion("deployment-authorization");
      },
    },
  ], [engageCapsuleAndMount, chipShouldPulse, consumeCapsuleSuggestion]);

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
          autoPrompt={autoPrompt}
          onClose={() => undefined}
        />
      </div>

      {/* ── RIGHT: Development Command Center (50/50 split) ─── */}
      <div className="lg:w-1/2 w-full h-full min-h-0 relative flex flex-col">
        {/* Stage strip at top */}
        <div className="shrink-0 py-2">
          <StageStrip stage={session.stage} onStageClick={handleStageClick} />
        </div>

        {/* Auto-act control (opt-in, navigation-only) + transient notice.
            The toggle doubles as the always-visible one-click kill switch. */}
        <div className="shrink-0 px-1 pb-1 flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] uppercase tracking-wide text-slate-500">
              Auto-act · navigation-only
              <span className="normal-case tracking-normal text-slate-600">
                {" · "}
                <span className="font-mono">{session.sessionId.slice(0, 16)}…</span>
                {saveStatus === "saved" && <span className="text-emerald-400/70"> · saved</span>}
                {saveStatus === "failed" && <span className="text-rose-400/80"> · save failed</span>}
              </span>
            </span>
            <button
              type="button"
              onClick={toggleAutoAct}
              aria-pressed={autoActPolicy.enabled}
              title={autoActPolicy.enabled
                ? "Auto-act is ON — click to disable it instantly"
                : "Auto-act is OFF — click to opt in (navigation affordances only)"}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                autoActPolicy.enabled
                  ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-300 hover:border-rose-500/60 hover:bg-rose-500/15 hover:text-rose-300"
                  : "border-slate-600/60 bg-slate-700/30 text-slate-300 hover:bg-slate-700/50"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${autoActPolicy.enabled ? "bg-emerald-400" : "bg-slate-500"}`} />
              {autoActPolicy.enabled ? "Auto-act ON · Disable" : "Auto-act OFF · Enable"}
            </button>
          </div>
          {autoActNoticeLine && (
            <div className="flex items-start justify-between gap-2 rounded-md border border-sky-500/40 bg-sky-500/10 px-2 py-1.5 text-[11px] leading-snug text-sky-200">
              <span className="flex-1">{autoActNoticeLine}</span>
              <button
                type="button"
                onClick={() => setAutoActNoticeLine(null)}
                className="shrink-0 text-sky-300/70 hover:text-sky-100"
                aria-label="Dismiss auto-act notice"
              >
                ×
              </button>
            </div>
          )}
        </div>

        {/* CTA chip row — mirrors aigentMe's capsule chip strip */}
        <div className="shrink-0 py-1">
          <CapabilityChipRow
            session={session}
            activeCapsuleId={activeCapsuleId}
            pulsing={intelligentPulsing}
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
          {isCapsuleLayout && activeCapsuleId === "implementation" && (
            <ImplementationLayout
              session={session}
              onDismiss={returnToStack}
              onAdvanceStage={handleAdvanceStage}
              pendingProposal={pendingProposals["implementation"] ?? null}
              onApproveProposal={() => handleApproveProposal("implementation")}
              onDismissProposal={() => handleDismissProposal("implementation")}
              onReceipt={handleReceipt}
              onPackGenerated={(briefMarkdown) => {
                setSession(s => ({ ...s, implementationBrief: briefMarkdown, updatedAt: new Date().toISOString() }));
                observe(devImplementationPackGeneratedEvent());
              }}
              onDeploymentProposed={() => observe(devDeploymentProposedEvent())}
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
          {isCapsuleLayout && activeCapsuleId === "remediation" && (
            <RemediationLayout
              session={session}
              onDismiss={returnToStack}
              onAdvanceStage={handleAdvanceStage}
              pendingProposal={pendingProposals["remediation"] ?? null}
              onApproveProposal={() => handleApproveProposal("remediation")}
              onDismissProposal={() => handleDismissProposal("remediation")}
              onReceipt={handleReceipt}
            />
          )}
          {isCapsuleLayout && activeCapsuleId === "deployment-authorization" && (
            <DeploymentAuthorizationLayout
              session={session}
              onDismiss={returnToStack}
              onAdvanceStage={handleAdvanceStage}
              pendingProposal={pendingProposals["deployment-authorization"] ?? null}
              onApproveProposal={() => handleApproveProposal("deployment-authorization")}
              onDismissProposal={() => handleDismissProposal("deployment-authorization")}
              onReceipt={handleReceipt}
              onAuthorize={handleDeploymentAuthorized}
            />
          )}

          {/* CDE tool viewports (CFS-020) — real Terminal / GitHub / DevTools /
              Linear surfaces. Each fires a T2-safe DCIR observation of the
              read-only op it performed (devToolUsedEvent), threaded the same way
              ImplementationLayout receives its callbacks. */}
          {isToolLayout && activeLayoutId === "terminal" && (
            <TerminalLayout
              onBack={returnToStack}
              onToolUsed={(op) => observe(devToolUsedEvent("terminal", op))}
            />
          )}
          {isToolLayout && activeLayoutId === "github" && (
            <GitHubLayout
              onBack={returnToStack}
              onToolUsed={(op) => observe(devToolUsedEvent("github", op))}
            />
          )}
          {isToolLayout && activeLayoutId === "devtools" && (
            <DevToolsLayout
              onBack={returnToStack}
              onToolUsed={(op) => observe(devToolUsedEvent("devtools", op))}
            />
          )}
          {isToolLayout && activeLayoutId === "linear" && (
            <LinearLayout
              onBack={returnToStack}
              onToolUsed={(op) => observe(devToolUsedEvent("linear", op))}
            />
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
