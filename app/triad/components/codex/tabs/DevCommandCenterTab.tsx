"use client";

import React, { useState, useCallback } from "react";
import {
  Cpu, Target, FileSearch, AlertTriangle, CheckCircle,
  ChevronDown, ChevronRight, Package, Layers, Shield,
  ArrowRight, Circle, Minus,
} from "lucide-react";

// ─── Types (local mirrors — avoids server import in client component) ──────

type DevLoopStage =
  | "intent_capture"
  | "context_assembly"
  | "gap_analysis"
  | "consequence_modeling"
  | "implementation"
  | "consequence_validation"
  | "complete";

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

// ─── Sub-components ────────────────────────────────────────────────────────

function StageStrip({ stage }: { stage: DevLoopStage }) {
  const currentIdx = getStageIndex(stage);
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {STAGES.map((s, i) => {
        const Icon = s.icon;
        const isCurrent = s.id === stage;
        const isPast = i < currentIdx;
        const color = isCurrent ? "text-green-400 bg-green-500/20 border-green-500/30"
          : isPast ? "text-emerald-400/60 bg-emerald-500/10 border-emerald-500/20"
          : "text-slate-500 bg-slate-800/30 border-slate-700/30";
        return (
          <React.Fragment key={s.id}>
            {i > 0 && <ArrowRight className={`w-3 h-3 shrink-0 ${isPast || isCurrent ? "text-emerald-400/40" : "text-slate-700"}`} />}
            <div className={`flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-semibold whitespace-nowrap ${color}`}>
              <Icon className="w-3 h-3" />
              {s.label}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

function ExpandableSection({ title, icon: Icon, color, defaultOpen, children }: {
  title: string; icon: typeof Cpu; color: string; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div className="rounded-lg bg-slate-800/30 border border-slate-700/30 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-3 text-left">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${color}`} />
          <span className="text-sm font-semibold text-white">{title}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-3 pb-3 border-t border-slate-700/30 pt-2">{children}</div>}
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

// ─── Main Component ────────────────────────────────────────────────────────

export function DevCommandCenterTab() {
  const [activeStage] = useState<DevLoopStage>("consequence_modeling");

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Cpu className="w-7 h-7 text-green-400" />
          <div>
            <h2 className="text-xl font-bold text-white">Development Command Center</h2>
            <p className="text-sm text-slate-400">aigentZ consequence engineering — intent → context → gaps → consequences → validation</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-300 border border-green-500/30">Phase 1 MVP</span>
          <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">Operation Chrysalis</span>
        </div>
      </div>

      {/* Stage strip */}
      <StageStrip stage={activeStage} />

      {/* Validation use case banner */}
      <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 flex items-start gap-2">
        <Layers className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-xs text-green-200 font-semibold">Validation Use Case: Executive Mobility Travel Service</p>
          <p className="text-[10px] text-green-200/70">Demonstrating the complete consequence engineering workflow — reuse, extend, build new.</p>
        </div>
      </div>

      {/* Capability panels */}
      <div className="space-y-3">
        <ExpandableSection title="Intent Distillation" icon={Target} color="text-blue-400" defaultOpen>
          <IntentPanel intent={DEMO_INTENT} />
        </ExpandableSection>

        <ExpandableSection title="Context Pack" icon={Package} color="text-purple-400" defaultOpen>
          <ContextPackPanel items={DEMO_CONTEXT_ITEMS} />
        </ExpandableSection>

        <ExpandableSection title="Capability Gap Analysis" icon={FileSearch} color="text-emerald-400" defaultOpen>
          <GapAnalysisPanel existing={DEMO_EXISTING} missing={DEMO_MISSING} />
        </ExpandableSection>

        <ExpandableSection title="Consequence Canvas" icon={AlertTriangle} color="text-amber-400" defaultOpen>
          <ConsequenceCanvasPanel
            shouldHappen={DEMO_SHOULD_HAPPEN}
            shouldNotHappen={DEMO_SHOULD_NOT_HAPPEN}
            successState="Executive travel booking, accommodation, and residency workflows execute as a connected chain with full DVN receipt trail and CRM synchronization."
          />
        </ExpandableSection>

        <ExpandableSection title="Consequence Validation" icon={CheckCircle} color="text-green-400">
          <div className="text-xs text-slate-400 italic py-2">
            Validation runs after Claude Code generates implementation. Pending implementation stage.
          </div>
        </ExpandableSection>
      </div>

      {/* Development loop diagram */}
      <div className="p-4 rounded-lg bg-slate-800/30 border border-slate-700/30">
        <h4 className="text-sm font-semibold text-white mb-3">Development Loop</h4>
        <div className="flex items-center gap-1 flex-wrap text-[10px]">
          {["User Intent", "Intent Distillation", "Context Pack", "Gap Analysis", "Consequence Canvas", "Claude Code", "Generated Code", "Consequence Validation", "Receipts", "Memory Update"].map((step, i, arr) => (
            <React.Fragment key={step}>
              <span className="px-2 py-1 rounded bg-slate-700/50 text-slate-300 whitespace-nowrap">{step}</span>
              {i < arr.length - 1 && <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />}
            </React.Fragment>
          ))}
        </div>
        <p className="text-[10px] text-slate-500 mt-2">
          Claude Code generates code. aigentZ generates and validates capability. The loop is cyclical — outputs feed back in.
        </p>
      </div>
    </div>
  );
}
