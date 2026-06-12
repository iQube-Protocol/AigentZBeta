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
  RotateCcw,
} from "lucide-react";
import { SmartTriadCopilotLayer, type SuggestedLayoutHint } from "@/components/smarttriad/copilot/SmartTriadCopilotLayer";
import { ExploreQuickActionsStrip, type ExploreToolId, type ExploreSuggestionMap } from "@/components/metame/copilot/ExploreQuickActionsStrip";

type QuickPrompt = string | {
  label: string;
  prompt?: string;
  onSelect?: () => void;
  /** Pulse the chip — set when the copilot's last turn suggested this capability. */
  highlight?: boolean;
};

// ─── Types (local mirrors — avoids server import in client component) ──────

type DevLoopStage =
  | "intent_capture"
  | "context_assembly"
  | "gap_analysis"
  | "consequence_modeling"
  | "implementation"
  | "consequence_validation"
  | "complete";

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

interface StructuredDevIntent {
  intentId: string;
  rawInput: string;
  goal: string;
  users: string[];
  constraints: string[];
  desiredOutcomes: string[];
  successCriteria: string[];
  relatedVentures: string[];
  relatedCartridges: string[];
  priority: "critical" | "high" | "medium" | "low";
  status: "draft" | "refined" | "approved" | "in_progress" | "validated" | "complete";
}

interface ContextPackItem {
  sourceKind: string;
  sourcePath: string;
  title: string;
  relevanceScore: number;
  reuseSignal: "reuse" | "extend" | "reference";
}

interface ExistingCapability {
  name: string;
  location: string;
  reuseStrategy: string;
}

interface MissingCapability {
  name: string;
  description: string;
  estimatedComplexity: string;
  suggestedLocation: string;
}

interface ConsequenceEntry {
  id: string;
  description: string;
  category: string;
  severity: string;
}

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

// ─── Stage metadata ────────────────────────────────────────────────────────

const STAGES: { id: DevLoopStage; label: string; icon: typeof Cpu }[] = [
  { id: "intent_capture", label: "Intent", icon: Target },
  { id: "context_assembly", label: "Context", icon: Package },
  { id: "gap_analysis", label: "Gaps", icon: FileSearch },
  { id: "consequence_modeling", label: "Consequences", icon: AlertTriangle },
  { id: "implementation", label: "Implement", icon: Cpu },
  { id: "consequence_validation", label: "Validate", icon: CheckCircle },
  { id: "complete", label: "Complete", icon: CheckCircle },
];

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

// ─── Demo data (Executive Mobility Travel validation use case) ─────────────

const DEMO_INTENT: StructuredDevIntent = {
  intentId: "dci-demo-001",
  rawInput: "Build Executive Mobility Travel",
  goal: "Build Executive Mobility Travel service for high-value participants",
  users: ["Executive participants", "Corporate mobility managers", "Travel coordinators"],
  constraints: [
    "Must integrate with existing Passport Bureau",
    "Must not duplicate CRM contact workflows",
    "Must respect sovereignty-first principle",
  ],
  desiredOutcomes: [
    "Executive travel booking and management",
    "Accommodation workflow integration",
    "Residency pathway workflow activation",
    "CRM status tracking for mobility events",
  ],
  successCriteria: [
    "Travel booking triggers accommodation workflow",
    "Accommodation completion triggers residency workflow",
    "All events create DVN-anchored receipts",
    "CRM reflects current mobility status",
  ],
  relatedVentures: ["Venture Lab α"],
  relatedCartridges: ["knyt-codex", "agentiq-codex"],
  priority: "high",
  status: "refined",
};

const DEMO_CONTEXT_ITEMS: ContextPackItem[] = [
  { sourceKind: "codebase", sourcePath: "services/passport/passportCredentialService.ts", title: "Passport Credential Service", relevanceScore: 95, reuseSignal: "reuse" },
  { sourceKind: "codebase", sourcePath: "services/crm/", title: "CRM Integration Layer", relevanceScore: 90, reuseSignal: "reuse" },
  { sourceKind: "codebase", sourcePath: "services/marketa/", title: "Marketa Workflow Engine", relevanceScore: 85, reuseSignal: "extend" },
  { sourceKind: "governance", sourcePath: "services/governance/sovereignAgentRoles.ts", title: "Sovereign Agent Roles", relevanceScore: 80, reuseSignal: "reference" },
  { sourceKind: "receipt", sourcePath: "services/receipts/activityReceiptService.ts", title: "Activity Receipt Pipeline", relevanceScore: 75, reuseSignal: "reuse" },
  { sourceKind: "architecture", sourcePath: "codexes/packs/aigency/items/", title: "System Architecture Docs", relevanceScore: 70, reuseSignal: "reference" },
];

const DEMO_EXISTING: ExistingCapability[] = [
  { name: "Passport Bureau", location: "services/passport/", reuseStrategy: "use_directly" },
  { name: "CRM Contact Management", location: "services/crm/", reuseStrategy: "extend" },
  { name: "Marketa Workflows", location: "services/marketa/", reuseStrategy: "extend" },
  { name: "Activity Receipt Pipeline", location: "services/receipts/", reuseStrategy: "use_directly" },
  { name: "DVN Anchoring", location: "services/dvn/", reuseStrategy: "use_directly" },
];

const DEMO_MISSING: MissingCapability[] = [
  { name: "Executive Travel Workflow", description: "Booking, itinerary, and mobility event management", estimatedComplexity: "medium", suggestedLocation: "services/travel/" },
  { name: "Corporate Mobility Dashboard", description: "Real-time view of executive mobility status and events", estimatedComplexity: "medium", suggestedLocation: "app/triad/components/codex/tabs/" },
];

const DEMO_SHOULD_HAPPEN: ConsequenceEntry[] = [
  { id: "ce-1", description: "Travel booking creates a DVN-anchored receipt", category: "workflow", severity: "critical" },
  { id: "ce-2", description: "Accommodation workflow triggered on booking completion", category: "workflow", severity: "high" },
  { id: "ce-3", description: "Residency workflow triggered on accommodation completion", category: "workflow", severity: "high" },
  { id: "ce-4", description: "CRM updated with current mobility status", category: "integration", severity: "high" },
  { id: "ce-5", description: "All state transitions emit orchestration events", category: "governance", severity: "medium" },
];

const DEMO_SHOULD_NOT_HAPPEN: ConsequenceEntry[] = [
  { id: "ce-6", description: "Travel data exposed outside sovereignty boundary", category: "governance", severity: "critical" },
  { id: "ce-7", description: "Duplicate CRM records from parallel workflows", category: "data", severity: "high" },
  { id: "ce-8", description: "Booking without valid passport credential", category: "permission", severity: "critical" },
];

// ─── Right-pane sub-components ────────────────────────────────────────────

function StageStrip({ stage }: { stage: DevLoopStage }) {
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
        return (
          <React.Fragment key={s.id}>
            {i > 0 && <ArrowRight className={`w-3 h-3 shrink-0 ${isPast || isCurrent ? "text-emerald-400/40" : "text-slate-700"}`} />}
            <div className={`flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-semibold whitespace-nowrap text-white ${box}`}>
              <Icon className={`w-3 h-3 ${iconColor}`} />
              {s.label}
            </div>
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

function ContextPackPanel({ items }: { items: ContextPackItem[] }) {
  const reuse = items.filter(i => i.reuseSignal === "reuse");
  const extend = items.filter(i => i.reuseSignal === "extend");
  const reference = items.filter(i => i.reuseSignal === "reference");

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-xs">
        <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">Reuse: {reuse.length}</span>
        <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">Extend: {extend.length}</span>
        <span className="px-1.5 py-0.5 rounded bg-slate-500/20 text-slate-300">Reference: {reference.length}</span>
      </div>
      {items.map(item => (
        <div key={item.sourcePath} className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-700/20 last:border-0">
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
      ))}
    </div>
  );
}

function GapAnalysisPanel({ existing, missing }: { existing: ExistingCapability[]; missing: MissingCapability[] }) {
  const ratio = Math.round((existing.length / (existing.length + missing.length)) * 100);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 rounded-full bg-slate-700 overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${ratio}%` }} />
        </div>
        <span className="text-xs text-emerald-300 font-semibold">{ratio}% reuse</span>
      </div>
      <div>
        <div className="text-xs text-slate-500 mb-1 uppercase font-semibold">Existing ({existing.length})</div>
        {existing.map(c => (
          <div key={c.name} className="flex items-center justify-between py-1 border-b border-slate-700/20 last:border-0">
            <div className="text-xs text-emerald-300">{c.name}</div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500 font-mono">{c.location}</span>
              <span className="text-[10px] px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-300">{c.reuseStrategy}</span>
            </div>
          </div>
        ))}
      </div>
      <div>
        <div className="text-xs text-slate-500 mb-1 uppercase font-semibold">Missing ({missing.length})</div>
        {missing.map(c => (
          <div key={c.name} className="py-1.5 border-b border-slate-700/20 last:border-0">
            <div className="flex items-center justify-between">
              <span className="text-xs text-amber-300">{c.name}</span>
              <span className="text-[10px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-300">{c.estimatedComplexity}</span>
            </div>
            <div className="text-[10px] text-slate-400">{c.description}</div>
            <div className="text-[10px] text-slate-500 font-mono">{c.suggestedLocation}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConsequenceCanvasPanel({ shouldHappen, shouldNotHappen, successState }: {
  shouldHappen: ConsequenceEntry[]; shouldNotHappen: ConsequenceEntry[]; successState: string;
}) {
  return (
    <div className="space-y-3">
      <div className="p-2 rounded bg-green-500/10 border border-green-500/20">
        <div className="text-[10px] text-slate-500 uppercase font-semibold mb-0.5">Success State</div>
        <p className="text-xs text-green-300">{successState}</p>
      </div>
      <div>
        <div className="text-xs text-emerald-400 font-semibold mb-1">Should Happen ({shouldHappen.length})</div>
        {shouldHappen.map(e => (
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
        <div className="text-xs text-rose-400 font-semibold mb-1">Should Never Happen ({shouldNotHappen.length})</div>
        {shouldNotHappen.map(e => (
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

function ProjectOverviewPanel({ intent, activeStage }: { intent: StructuredDevIntent; activeStage: DevLoopStage }) {
  const stageIdx = getStageIndex(activeStage);
  return (
    <div className="space-y-3">
      <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white truncate">{intent.goal}</div>
            <div className="text-[10px] text-slate-400 font-mono">{intent.intentId}</div>
          </div>
          <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${
            intent.status === "refined" ? "bg-blue-500/20 text-white border-blue-500/30"
            : "bg-slate-500/20 text-white border-slate-500/30"
          }`}>{intent.status}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="p-2 rounded bg-slate-800/40 border border-slate-700/30">
          <div className="text-[10px] text-slate-500 uppercase font-semibold mb-0.5">Loop Stage</div>
          <div className="text-xs text-white">{STAGES[stageIdx]?.label} ({stageIdx + 1}/{STAGES.length})</div>
        </div>
        <div className="p-2 rounded bg-slate-800/40 border border-slate-700/30">
          <div className="text-[10px] text-slate-500 uppercase font-semibold mb-0.5">Priority</div>
          <div className="text-xs text-white">{intent.priority}</div>
        </div>
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
    </div>
  );
}

function ValidationPanel() {
  return (
    <div className="text-xs text-slate-400 italic py-4 text-center">
      Validation runs after Claude Code generates implementation. Pending implementation stage.
    </div>
  );
}

// ─── Right-pane layout components ─────────────────────────────────────────

function StackLayout({ onCapabilityClick, activeStage }: {
  onCapabilityClick: (id: DevCapsuleId) => void;
  activeStage: DevLoopStage;
}) {
  return (
    <div className="space-y-4">
      {/* Capability buttons */}
      <div className="space-y-2">
        <div className="text-[10px] text-slate-500 uppercase font-semibold px-1">Capabilities</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {CAPABILITIES.map(cap => (
            <button
              key={cap.id}
              onClick={() => onCapabilityClick(cap.id)}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${cap.color}`}
            >
              <cap.icon className="w-5 h-5 shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white">{cap.label}</div>
                <div className="text-[10px] text-slate-300">{cap.description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Accordion sections */}
      <AccordionSection title="Experience Model" icon={Layers} defaultOpen={false}>
        <div className="text-xs text-slate-400 py-2">
          Experience model configuration inherited from aigentMe. Configure stages, goals, and progression.
        </div>
      </AccordionSection>

      <AccordionSection title="Specialists" icon={Cpu} defaultOpen={false}>
        <div className="text-xs text-slate-400 py-2">
          aigentZ specialist agents — domain experts for architecture, security, governance review.
        </div>
      </AccordionSection>

      <AccordionSection title="Dev Receipts" icon={CheckCircle} defaultOpen={false}>
        <div className="text-xs text-slate-400 py-2">
          DVN-anchored development receipts — intent captures, gap analyses, validation results.
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
          {["User Intent", "Intent Distillation", "Context Pack", "Gap Analysis", "Consequence Canvas", "Claude Code", "Generated Code", "Consequence Validation", "Receipts", "Memory Update"].map((step, i, arr) => (
            <React.Fragment key={step}>
              <span className="px-2 py-1 rounded bg-slate-700/50 text-white whitespace-nowrap shrink-0">{step}</span>
              {i < arr.length - 1 && <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />}
            </React.Fragment>
          ))}
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

// Capability detail layouts (shown when a capability button is clicked)
function CapabilityLayout({ capsuleId, onBack, activeStage }: {
  capsuleId: DevCapsuleId;
  onBack: () => void;
  activeStage: DevLoopStage;
}) {
  const cap = CAPABILITIES.find(c => c.id === capsuleId);
  if (!cap) return null;

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
          <cap.icon className="w-5 h-5 text-green-400" />
          <h3 className="text-sm font-bold text-white">{cap.label}</h3>
        </div>
      </div>

      {capsuleId === "project-overview" && <ProjectOverviewPanel intent={DEMO_INTENT} activeStage={activeStage} />}
      {capsuleId === "intent" && <IntentPanel intent={DEMO_INTENT} />}
      {capsuleId === "context" && <ContextPackPanel items={DEMO_CONTEXT_ITEMS} />}
      {capsuleId === "gap-analysis" && <GapAnalysisPanel existing={DEMO_EXISTING} missing={DEMO_MISSING} />}
      {capsuleId === "consequence-canvas" && (
        <ConsequenceCanvasPanel
          shouldHappen={DEMO_SHOULD_HAPPEN}
          shouldNotHappen={DEMO_SHOULD_NOT_HAPPEN}
          successState="Executive travel booking, accommodation, and residency workflows execute as a connected chain with full DVN receipt trail and CRM synchronization."
        />
      )}
      {capsuleId === "validation" && <ValidationPanel />}
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
  const [activeStage] = useState<DevLoopStage>("consequence_modeling");
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
      // Direct explore-strip targets (upload/download today; terminal /
      // github / devtools / linear once the chat route learns dev ids).
      if (id === "upload" || id === "download" || id === "terminal" || id === "github" || id === "devtools" || id === "linear") {
        explore[id as ExploreToolId | "upload" | "download"] = true;
      // aigentMe-vocabulary hints translated to dev capabilities.
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

  // Ground context for the copilot — feeds the LLM with current right-pane state
  const copilotGroundContext = useMemo(() => ({
    surface: "dev-command-center",
    activeStage,
    activeLayout: activeLayoutId,
    activeCapsule: activeCapsuleId,
    twoTierRouting: {
      description: "aigentZ routes prompts either to the LLM (tier 1, planning/analysis) or to Claude Code (tier 2, code generation). Results from Claude Code flow back through aigentZ for disposition.",
      currentTier: "llm",
    },
    capabilities: CAPABILITIES.map(c => c.id),
    devLoopStages: STAGES.map(s => s.id),
  }), [activeStage, activeLayoutId, activeCapsuleId]);

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
          onClearHighlights={clearCapsuleSuggestions}
          onClose={() => undefined}
        />
      </div>

      {/* ── RIGHT: Development Command Center (50/50 split) ─── */}
      <div className="lg:w-1/2 w-full h-full min-h-0 relative flex flex-col">
        {/* Stage strip at top */}
        <div className="shrink-0 py-2">
          <StageStrip stage={activeStage} />
        </div>

        {/* Scrollable content area */}
        <div className="flex-1 min-h-0 overflow-y-auto px-1 pb-16">
          {activeLayoutId === "stack" && (
            <StackLayout
              onCapabilityClick={engageCapsuleAndMount}
              activeStage={activeStage}
            />
          )}
          {isCapsuleLayout && activeCapsuleId && (
            <CapabilityLayout capsuleId={activeCapsuleId} onBack={returnToStack} activeStage={activeStage} />
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
