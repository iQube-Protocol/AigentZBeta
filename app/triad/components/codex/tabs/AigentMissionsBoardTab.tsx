"use client";

import { useState } from "react";
import {
  BookOpen,
  Brain,
  CheckCircle2,
  ClipboardList,
  Cpu,
  Scale,
  Shield,
  Target,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

// ─── Types ────────────────────────────────────────────────────────────────────

type MissionCategory =
  | "segmentation"
  | "outreach-support"
  | "telemetry"
  | "partner"
  | "content"
  | "participation"
  | "governance";

type TrustClass = 1 | 2 | 3 | 4 | 5;

type LifecycleStage =
  | "defined"
  | "available"
  | "assigned"
  | "in-progress"
  | "submitted"
  | "reviewed"
  | "accepted"
  | "rewarded"
  | "learned";

interface Mission {
  id: string;
  title: string;
  category: MissionCategory;
  trustClass: TrustClass;
  stage: LifecycleStage;
  objective: string;
  successMetric: string;
  whyItMatters: string;
}

type SubTab = "mythos" | "ethos" | "logos";

// ─── Seed missions (from KNYT Wheel Agent Missions Framework §11) ─────────────

const SEED_MISSIONS: Mission[] = [
  {
    id: "M-001",
    title: "Investor Reactivation Prioritization",
    category: "segmentation",
    trustClass: 1,
    stage: "defined",
    objective: "Rank which investors deserve faster follow-up today",
    successMetric: "Useful queue reviewed and accepted by campaign operator",
    whyItMatters: "Identifies the highest-leverage next-contact opportunities from the 3,501 investor pool",
  },
  {
    id: "M-002",
    title: "Zero KNYT Legacy Investor Identification",
    category: "segmentation",
    trustClass: 1,
    stage: "defined",
    objective: "Identify and validate the strongest $1,000+ investor candidates for premium-tier emphasis",
    successMetric: "Clean list used in campaign ops",
    whyItMatters: "Surfaces the investors most likely to convert to KNYT holders without additional cost",
  },
  {
    id: "M-003",
    title: "Codex Objection Handling Support",
    category: "outreach-support",
    trustClass: 2,
    stage: "defined",
    objective: "Generate concise explanations for investors who already own legacy print or motioncomic assets",
    successMetric: "Copy reused in live outbound messaging",
    whyItMatters: "Removes the primary friction point blocking legacy asset holders from Codex adoption",
  },
  {
    id: "M-004",
    title: "Daily Campaign Telemetry Brief",
    category: "telemetry",
    trustClass: 1,
    stage: "defined",
    objective: "Summarize the last 24 hours of investor, partner, and channel performance",
    successMetric: "Brief used by Marketa for daily sequencing decisions",
    whyItMatters: "Converts raw signal into actionable campaign intelligence without manual operator synthesis",
  },
  {
    id: "M-005",
    title: "Partner Follow-up Ranking",
    category: "partner",
    trustClass: 2,
    stage: "defined",
    objective: "Recommend which partner deserves the next higher-touch follow-up based on live signal",
    successMetric: "Ranking accepted and used by campaign operator",
    whyItMatters: "Ensures partner capacity is allocated to the relationships with the highest near-term yield",
  },
  {
    id: "M-006",
    title: "Next-best-action Recommendation",
    category: "participation",
    trustClass: 3,
    stage: "defined",
    objective: "Recommend the next-best-action for users or investors after click, backing, or initial engagement",
    successMetric: "Prompts or actions deployed into Runtime, KNYT, or Tasks & Rewards",
    whyItMatters: "Deepens post-backing participation and moves patrons along the KNYT progression arc",
  },
  {
    id: "M-007",
    title: "Mission Boundary Review",
    category: "governance",
    trustClass: 3,
    stage: "defined",
    objective: "Flag whether a mission or output drifted outside its intended bounds",
    successMetric: "Helps refine constraints and charter language over time",
    whyItMatters: "Keeps the constitutional pilot honest — turns scope violations into learning rather than silent drift",
  },
];

// ─── Style maps ───────────────────────────────────────────────────────────────

const CATEGORY_META: Record<MissionCategory, { label: string; color: string }> = {
  segmentation:     { label: "Segmentation",      color: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  "outreach-support": { label: "Outreach Support", color: "bg-purple-500/15 text-purple-300 border-purple-500/30" },
  telemetry:        { label: "Telemetry",          color: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30" },
  partner:          { label: "Partner",            color: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  content:          { label: "Content",            color: "bg-rose-500/15 text-rose-300 border-rose-500/30" },
  participation:    { label: "Participation",      color: "bg-green-500/15 text-green-300 border-green-500/30" },
  governance:       { label: "Governance",         color: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30" },
};

const CLASS_META: Record<TrustClass, { label: string; color: string }> = {
  1: { label: "Class 1 — Observe",    color: "bg-slate-500/20 text-slate-300 border-slate-500/40" },
  2: { label: "Class 2 — Draft",      color: "bg-blue-500/20 text-blue-300 border-blue-500/40" },
  3: { label: "Class 3 — Optimize",   color: "bg-amber-500/20 text-amber-300 border-amber-500/40" },
  4: { label: "Class 4 — Operate",    color: "bg-orange-500/20 text-orange-300 border-orange-500/40" },
  5: { label: "Class 5 — Contribute", color: "bg-red-500/20 text-red-300 border-red-500/40" },
};

const STAGE_META: Record<LifecycleStage, { label: string; color: string }> = {
  defined:     { label: "Defined",     color: "bg-slate-600/40 text-slate-300" },
  available:   { label: "Available",   color: "bg-blue-600/30 text-blue-300" },
  assigned:    { label: "Assigned",    color: "bg-yellow-600/30 text-yellow-300" },
  "in-progress": { label: "In Progress", color: "bg-amber-600/30 text-amber-300" },
  submitted:   { label: "Submitted",   color: "bg-purple-600/30 text-purple-300" },
  reviewed:    { label: "Reviewed",    color: "bg-cyan-600/30 text-cyan-300" },
  accepted:    { label: "Accepted",    color: "bg-green-600/30 text-green-300" },
  rewarded:    { label: "Rewarded",    color: "bg-emerald-600/30 text-emerald-300" },
  learned:     { label: "Learned",     color: "bg-teal-600/30 text-teal-300" },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function MissionCard({ mission }: { mission: Mission }) {
  const cat = CATEGORY_META[mission.category];
  const cls = CLASS_META[mission.trustClass];
  const stg = STAGE_META[mission.stage];

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono text-slate-500">{mission.id}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cat.color}`}>{cat.label}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cls.color}`}>{cls.label}</span>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${stg.color}`}>{stg.label}</span>
      </div>
      <h3 className="text-sm font-semibold text-slate-100 leading-snug">{mission.title}</h3>
      <p className="text-xs text-slate-400 leading-relaxed">{mission.objective}</p>
      <div className="grid grid-cols-2 gap-3 pt-1">
        <div>
          <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1">Success metric</p>
          <p className="text-xs text-slate-300">{mission.successMetric}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1">Why it matters</p>
          <p className="text-xs text-slate-300">{mission.whyItMatters}</p>
        </div>
      </div>
    </div>
  );
}

function EthosMissionBoard() {
  const [filter, setFilter] = useState<"all" | MissionCategory>("all");

  const visible = filter === "all"
    ? SEED_MISSIONS
    : SEED_MISSIONS.filter((m) => m.category === filter);

  const categories = Array.from(new Set(SEED_MISSIONS.map((m) => m.category)));

  return (
    <div className="flex flex-col gap-5">
      {/* Constitutional health header */}
      <div className="rounded-xl border border-emerald-700/40 bg-emerald-950/30 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-semibold text-emerald-300">Constitutional Pilot Health</span>
          <span className="ml-auto text-xs text-slate-500 italic">Alpha — seed data</span>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Human demand",       value: 7,  sub: "missions seeded",      icon: Users },
            { label: "Agent supply",       value: 0,  sub: "missions assigned",    icon: Cpu },
            { label: "Receipts issued",    value: 0,  sub: "completed missions",   icon: CheckCircle2 },
            { label: "Trust progressions", value: 0,  sub: "band advances",        icon: Scale },
          ].map(({ label, value, sub, icon: Icon }) => (
            <div key={label} className="rounded-lg bg-slate-900/60 border border-slate-700/40 p-3 text-center">
              <Icon className="h-4 w-4 text-slate-400 mx-auto mb-1" />
              <div className="text-xl font-bold text-slate-100">{value}</div>
              <div className="text-[10px] font-medium text-slate-300">{label}</div>
              <div className="text-[10px] text-slate-500">{sub}</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-3 leading-relaxed">
          Mission → Trust → Standing → Contribution. The board is the first place where the constitutional theory becomes operational reality.
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setFilter("all")}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filter === "all" ? "bg-emerald-600/30 border-emerald-500/50 text-emerald-300" : "border-slate-700/60 text-slate-400 hover:text-slate-300"}`}
        >
          All ({SEED_MISSIONS.length})
        </button>
        {categories.map((cat) => {
          const meta = CATEGORY_META[cat];
          return (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filter === cat ? `${meta.color}` : "border-slate-700/60 text-slate-400 hover:text-slate-300"}`}
            >
              {meta.label}
            </button>
          );
        })}
      </div>

      {/* Mission cards */}
      <div className="flex flex-col gap-3">
        {visible.map((m) => <MissionCard key={m.id} mission={m} />)}
      </div>
    </div>
  );
}

function StubPanel({ side }: { side: "mythos" | "logos" }) {
  const isMythos = side === "mythos";
  const icon = isMythos ? <BookOpen className="h-8 w-8 text-rose-400/60" /> : <Brain className="h-8 w-8 text-blue-400/60" />;
  const color = isMythos ? "border-rose-700/30 bg-rose-950/20" : "border-blue-700/30 bg-blue-950/20";
  const label = isMythos ? "Human Missions — Demand Side" : "Agent Missions — Supply Side";
  const entry = isMythos
    ? "Humans enter through mythos — story, identity, emotion, and belonging."
    : "Agents enter through logos — mission clarity, bounded delegation, measurable contribution, and receipts.";
  const coming = isMythos
    ? "Active when human mission intake flows from the KNYT Wheel campaign: investor tasks, collector quests, creator missions, and the patron progression arc."
    : "Active when agent mission intake is open: root identity registration, Agent Charter acceptance, mission assignment, receipt logging, and trust band progression.";

  return (
    <div className={`rounded-xl border ${color} p-6 flex flex-col items-center text-center gap-4`}>
      {icon}
      <div>
        <h2 className="text-base font-semibold text-slate-200 mb-1">{label}</h2>
        <p className="text-sm text-slate-400 max-w-sm leading-relaxed">{entry}</p>
      </div>
      <div className="rounded-lg border border-slate-700/40 bg-slate-900/60 p-4 max-w-md text-left">
        <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-2">Coming next</p>
        <p className="text-xs text-slate-400 leading-relaxed">{coming}</p>
      </div>
      <p className="text-xs text-slate-600 italic">
        Both stay and scale through ethos — the constitutional layer visible in the Missions Board.
      </p>
    </div>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────

const SUB_TABS: { id: SubTab; label: string; icon: React.ReactNode }[] = [
  { id: "mythos", label: "Mythos",  icon: <BookOpen className="h-3.5 w-3.5" /> },
  { id: "ethos",  label: "Ethos",   icon: <ClipboardList className="h-3.5 w-3.5" /> },
  { id: "logos",  label: "Logos",   icon: <Brain className="h-3.5 w-3.5" /> },
];

export function AigentMissionsBoardTab() {
  const [active, setActive] = useState<SubTab>("ethos");

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-slate-800/60 bg-slate-900/40 px-4 py-3">
        <div className="flex items-center gap-2 mb-3">
          <Target className="h-4 w-4 text-emerald-400" />
          <h1 className="text-sm font-semibold text-slate-100">Aigent Missions Board</h1>
          <Badge variant="outline" className="ml-auto text-[10px] border-emerald-700/50 text-emerald-400">
            Constitutional Pilot α
          </Badge>
        </div>
        {/* Sub-tab switcher */}
        <div className="flex gap-1">
          {SUB_TABS.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setActive(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                active === id
                  ? "bg-emerald-600/25 border border-emerald-600/40 text-emerald-300"
                  : "text-slate-400 hover:text-slate-300 border border-transparent"
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        {active === "mythos" && <StubPanel side="mythos" />}
        {active === "ethos"  && <EthosMissionBoard />}
        {active === "logos"  && <StubPanel side="logos" />}
      </div>
    </div>
  );
}
