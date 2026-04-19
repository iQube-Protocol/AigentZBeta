"use client";

/**
 * ExperienceDashboardTab — Codex admin/operator Experience Dashboard
 *
 * COD-301: Shell + entry point
 * COD-302: Franchise view (stage distribution, funnel health, NBE opportunities)
 * COD-303: Cohort view (cohort heatmap, stalled cohorts, NBE opportunities)
 * COD-304: Individual view (goals, stage, NBE, blockers, activity)
 * COD-305: CRM-linked state (bound where available)
 * COD-306: Admin NBE planner (franchise/cohort/individual intervention)
 * COD-307: Analysis cards in admin views
 * COD-504: Investor reactivation view
 */

import { useCallback, useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Activity,
  BarChart3,
  Briefcase,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Coins,
  Eye,
  FileText,
  Gift,
  Globe,
  Hash,
  Layers,
  Linkedin,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  Star,
  TrendingUp,
  Twitter,
  Users,
  Wallet,
  Youtube,
  Zap,
} from "lucide-react";
import { Dots } from "@/components/registry/scoreUtils";
import { CodexCopilotLayer, type CopilotMessage } from "@/app/components/codex/CodexCopilotLayer";

type FranchiseData = {
  total_journeys: number;
  stage_distribution: Record<string, number>;
  depth_distribution: Record<string, number>;
  nbe_opportunities: { disposition: string; experience_id: string }[];
};

type CohortData = {
  total: number;
  cohorts: Record<string, { count: number; depths: Record<string, number>; stalled: number }>;
};

type TrustScores = {
  goal_alignment: number | null;
  stage_readiness: number | null;
  nbe_confidence: number | null;
};

type PersonaCRM = {
  display_name: string | null;
  fio_handle: string | null;
  order_tier: string | null;
  reputation_tier: string | null;
  reputation_score: number | null;
  reputation_bucket: number | null;
  status: string | null;
  created_at: string | null;
  badges: string[] | null;
};

type NakamotoData = {
  knytPersona: Record<string, any> | null;
  blakQube: Record<string, any> | null;
  interactions: { id: string; query: string; response: string; interaction_type: string; created_at: string }[];
  rewardRecord: {
    linkedin_connected: boolean;
    metamask_connected: boolean;
    data_completed: boolean;
    reward_claimed: boolean;
    reward_amount: number;
    created_at: string;
  } | null;
};

type CrmPersonaDetail = {
  id: string;
  tenantId: string;
  displayName: string;
  email?: string;
  personaState: string;
  reputationBucket?: string;
  primaryWalletAddress?: string;
  totalPokw: number;
  contributionCount: number;
  rewardCount: number;
  createdAt: string;
  updatedAt: string;
};

type Contribution = { id: string; contributionType: string; units: number; pokwScore: number; source: string; createdAt: string };
type Reward = { id: string; tokenType: string; amount: number; status: string; createdAt: string };

type Individual = {
  persona_id: string;
  stage: string;
  depth: string;
  current_experience_id: string | null;
  active_at: string | null;
  nbe: { disposition: string; next_experience_depth: string | null; rationale: string | null } | null;
  trust_scores: TrustScores | null;
  crm: PersonaCRM | null;
};

type NBEPlan = {
  persona_id: string;
  experience_id: string;
  disposition: string;
  next_experience_depth: string | null;
  rationale: string | null;
  created_at: string;
};

type NBEData = {
  plans: NBEPlan[];
  strategies: { id: string; name: string; target_segments: string[] }[];
};

function str(val: unknown): string { return typeof val === "string" ? val : ""; }
function arr(val: unknown): string[] { return Array.isArray(val) ? val.filter((v): v is string => typeof v === "string") : []; }

// KNYT (nakamoto) stage config
const KNYT_STAGES = ["prospect", "acolyte", "keta", "keji", "first", "zero", "sat knyt"];
const KNYT_STAGE_COLORS: Record<string, string> = {
  prospect:   "border-slate-600 text-slate-400",
  acolyte:    "border-blue-500/50 text-blue-300",
  keta:       "border-violet-500/50 text-violet-300",
  keji:       "border-amber-500/50 text-amber-300",
  first:      "border-emerald-500/50 text-emerald-300",
  zero:       "border-rose-500/50 text-rose-300",
  "sat knyt": "border-orange-400/60 text-orange-300",
};
const KNYT_JOURNEY_TO_PCS: Record<string, string> = {
  prospect:   'participant',
  acolyte:    'community',
  keta:       'correspondent',
  keji:       'operator',
  first:      'creator',
  zero:       'upstream_contributor',
  "sat knyt": 'upstream_contributor',
};

// metaMe canonical stage config
const METAME_STAGES = ["visitor", "initiate", "participant", "curator", "composer", "operator", "architect"];
const METAME_STAGE_COLORS: Record<string, string> = {
  visitor:    "border-slate-600 text-slate-400",
  initiate:   "border-blue-500/50 text-blue-300",
  participant: "border-violet-500/50 text-violet-300",
  curator:    "border-amber-500/50 text-amber-300",
  composer:   "border-emerald-500/50 text-emerald-300",
  operator:   "border-rose-500/50 text-rose-300",
  architect:  "border-orange-500/50 text-orange-300",
};
const METAME_JOURNEY_TO_PCS: Record<string, string> = {
  visitor:    'participant',
  initiate:   'community',
  participant: 'correspondent',
  curator:    'operator',
  composer:   'creator',
  operator:   'upstream_contributor',
  architect:  'upstream_contributor',
};

// Legacy fallbacks (default to KNYT)
const STAGES = KNYT_STAGES;

const TENANT_NAMES: Record<string, string> = {
  nakamoto: "Nakamoto | KNYT",
  "jmo-knyt": "JMO KNYT",
  metame: "metaMe",
};

const STAGE_COLORS: Record<string, string> = { ...KNYT_STAGE_COLORS, ...METAME_STAGE_COLORS };

// ─── PCS Ladder configuration (seeded in 20260407000000_pcs_seed_agentiq.sql) ──

const PCS_STAGES: Array<{
  slug: string;
  label: string;
  unlock: string;
  depths: string[];
}> = [
  { slug: 'participant',          label: 'Participant',           unlock: 'First participation signal',                    depths: ['pill'] },
  { slug: 'community',            label: 'Community',             unlock: 'Repeat participation + 3 signals',              depths: ['pill', 'capsule'] },
  { slug: 'correspondent',        label: 'Correspondent',         unlock: 'Curation or remix + community action',          depths: ['pill', 'capsule', 'mini_runtime'] },
  { slug: 'operator',             label: 'Operator',              unlock: 'Contribution submission accepted',              depths: ['pill', 'capsule', 'mini_runtime', 'codex'] },
  { slug: 'creator',              label: 'Creator',               unlock: 'Repeated accepted contributions',               depths: ['pill', 'capsule', 'mini_runtime', 'codex'] },
  { slug: 'upstream_contributor', label: 'Upstream Contributor',  unlock: 'Contributor pathway flag + Aigent C handoff',   depths: ['pill', 'capsule', 'mini_runtime', 'codex'] },
];

// journey_state.stage → PCS stage slug mapping (combined KNYT + metaMe)
const JOURNEY_TO_PCS: Record<string, string> = { ...KNYT_JOURNEY_TO_PCS, ...METAME_JOURNEY_TO_PCS };

// ── Y-axis stages (PCS engagement) per tenant ────────────────────────────────
const KNYT_Y_STAGES = [
  "Observer", "Collector", "Curator", "Remixer",
  "Creator", "Correspondent", "Steward", "Franchise-aligned Sovereign",
];
const METAME_Y_STAGES = [
  "Recipient", "Selector", "Modifier", "Producer", "Builder", "Steward",
];

// X-axis slug → 0-based index
const KNYT_STAGE_TO_IDX: Record<string, number> = {
  prospect: 0, acolyte: 1, keta: 2, keji: 3, first: 4, zero: 5, "sat knyt": 6,
};
const METAME_STAGE_TO_IDX: Record<string, number> = {
  visitor: 0, initiate: 1, participant: 2, curator: 3, composer: 4, operator: 5, architect: 6,
};

// Estimate Y index from depth alone (used in list view where wallet data isn't loaded)
const DEPTH_TO_Y_ESTIMATE: Record<string, number> = {
  pill: 0, capsule: 1, mini_runtime: 3, codex: 5,
};

// Infer KNYT Y index from rich CRM + wallet + contribution signals
function inferKnytYIndex(signals: {
  knytCards?: string; motionComics?: string; paperComics?: string;
  digitalComics?: string; knytPosters?: string; characters?: string;
  contributions?: { contributionType?: string }[];
  rewards?: unknown[];
  knytCoyn?: string;
}): number {
  let y = 0;
  const hasCards = !!(signals.knytCards || signals.motionComics || signals.paperComics ||
    signals.digitalComics || signals.knytPosters || signals.characters);
  if (hasCards || (signals.knytCoyn && signals.knytCoyn !== "0")) y = Math.max(y, 1); // Collector
  const contribs = signals.contributions ?? [];
  if (contribs.some(c => c.contributionType === 'curation')) y = Math.max(y, 2);     // Curator
  if (contribs.some(c => c.contributionType === 'remix'))     y = Math.max(y, 3);     // Remixer
  if (contribs.some(c => ['creation','creative','content'].includes(c.contributionType ?? ''))) y = Math.max(y, 4); // Creator
  if (contribs.length >= 5)  y = Math.max(y, 5); // Correspondent
  if (contribs.length >= 15) y = Math.max(y, 6); // Steward
  return y;
}

// Chess-grid reference: X column (A-G) + Y row (1-8)
function gridRef(xIndex: number, yIndex: number): string {
  return `${String.fromCharCode(65 + xIndex)}${yIndex + 1}`;
}

const DEPTH_LABELS: Record<string, string> = {
  pill:         'L0 Pill',
  capsule:      'L1 Capsule',
  mini_runtime: 'L2 Mini-Runtime',
  codex:        'L3 Codex',
};

function MatrixPositionBars({
  xStages,
  xIndex,
  xLabel,
  yStages,
  yIndex,
  yLabel,
  yIsEstimated,
}: {
  xStages: string[]; xIndex: number; xLabel: string;
  yStages: string[]; yIndex: number; yLabel: string;
  yIsEstimated?: boolean;
}) {
  const ref = gridRef(xIndex, yIndex);
  const xNext = xStages[xIndex + 1];
  const yNext = yStages[yIndex + 1];
  return (
    <div className="rounded-xl border border-violet-500/20 bg-slate-950/60 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Matrix Position</div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-2xl font-bold text-amber-300 leading-none">{ref}</span>
          {yIsEstimated && <span className="text-[10px] text-slate-600 italic">Y estimated</span>}
        </div>
      </div>

      {/* X-axis — Sovereignty / Patronage */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-500">Sovereignty — X axis</span>
          <span className="font-semibold text-slate-200">{xLabel} · {xIndex + 1}/{xStages.length}</span>
        </div>
        <div className="flex gap-0.5 h-2.5">
          {xStages.map((s, i) => (
            <div
              key={s}
              title={s}
              className={`flex-1 rounded-sm transition-all ${
                i < xIndex  ? "bg-violet-600" :
                i === xIndex ? "bg-violet-400 ring-1 ring-violet-300/60" :
                               "bg-slate-800"
              }`}
            />
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-slate-600">
          <span>{xStages[0]}</span>
          {xNext && <span className="text-violet-400/60">next: {xNext}</span>}
          <span>{xStages[xStages.length - 1]} ★</span>
        </div>
      </div>

      {/* Y-axis — PCS Engagement */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-500">PCS Engagement — Y axis</span>
          <span className="font-semibold text-slate-200">{yLabel} · {yIndex + 1}/{yStages.length}</span>
        </div>
        <div className="flex gap-0.5 h-2.5">
          {yStages.map((s, i) => (
            <div
              key={s}
              title={s}
              className={`flex-1 rounded-sm transition-all ${
                i < yIndex  ? "bg-emerald-600" :
                i === yIndex ? "bg-emerald-400 ring-1 ring-emerald-300/60" :
                               "bg-slate-800"
              }`}
            />
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-slate-600">
          <span>{yStages[0]}</span>
          {yNext && <span className="text-emerald-400/60">next: {yNext}</span>}
          <span>{yStages[yStages.length - 1]} ★</span>
        </div>
      </div>

      <div className="text-[10px] text-slate-600 border-t border-slate-800/60 pt-2">
        Goal: top-right of matrix — {String.fromCharCode(65 + xStages.length - 1)}{yStages.length} apex
      </div>
    </div>
  );
}

function PCSLadderSection({ stage, depth }: { stage: string; depth: string }) {
  const pcsSlug = JOURNEY_TO_PCS[stage] ?? 'participant';
  const currentIdx = PCS_STAGES.findIndex((s) => s.slug === pcsSlug);
  const current = PCS_STAGES[currentIdx];
  const next = PCS_STAGES[currentIdx + 1] ?? null;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
        <span className="h-1 w-1 rounded-full bg-violet-400 inline-block" />
        PCS Progression Ladder
      </div>

      {/* Stage strip */}
      <div className="flex items-center gap-0.5 overflow-x-auto pb-1">
        {PCS_STAGES.map((s, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          return (
            <div key={s.slug} className="flex items-center gap-0.5 flex-1 min-w-0">
              <div
                title={s.label}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  done    ? 'bg-violet-500' :
                  active  ? 'bg-violet-400 ring-1 ring-violet-300/40' :
                            'bg-slate-800'
                }`}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[9px] text-slate-600">
        <span>{PCS_STAGES[0].label}</span>
        <span className="text-violet-400/70">{current?.label}</span>
        <span>{PCS_STAGES[PCS_STAGES.length - 1].label}</span>
      </div>

      {/* Current stage card */}
      {current && (
        <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 px-3 py-2 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-violet-300">{current.label}</span>
            <span className="text-[10px] text-violet-400/60">Stage {currentIdx + 1} of {PCS_STAGES.length}</span>
          </div>
          <div className="flex gap-1 flex-wrap">
            {current.depths.map((d) => (
              <span
                key={d}
                className={`rounded px-1.5 py-0.5 text-[10px] font-mono ${
                  d === depth
                    ? 'bg-violet-500/30 text-violet-200 ring-1 ring-violet-400/40'
                    : 'bg-slate-800 text-slate-500'
                }`}
              >
                {DEPTH_LABELS[d] ?? d}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Next stage unlock */}
      {next && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-0.5">Next: {next.label}</div>
          <div className="text-[11px] text-slate-400">{next.unlock}</div>
        </div>
      )}

      {!next && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-1.5">
          <div className="text-[11px] text-amber-300">Maximum PCS stage reached — Upstream Contributor</div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

// ── Experience Matrix config (mirrored from CARTRIDGE_FRAMEWORK in ComposerStudio) ─────
// Y = PCS engagement level (bottom → top), X = Sovereignty journey (left → right)
// Depth → approximate Y-row index for distribution overlay
const DEPTH_TO_Y_INDEX: Record<string, number> = {
  pill: 0, capsule: 1, mini_runtime: 2, codex: 3,
};

const MATRIX_CONFIG: Record<string, { y_stages: string[]; x_stages: string[] }> = {
  nakamoto: {
    y_stages: ["Observer", "Collector", "Curator", "Remixer", "Creator", "Correspondent", "Steward", "Franchise-aligned Sovereign"],
    x_stages: ["Prospect", "Acolyte", "Keta", "Keji", "First", "Zero", "Sat KNYT"],
  },
  metame: {
    y_stages: ["Recipient", "Selector", "Modifier", "Producer", "Builder", "Steward"],
    x_stages: ["Visitor", "Initiate", "Participant", "Curator", "Composer", "Operator", "Architect"],
  },
};

// Stage slug → X-axis index
const KNYT_STAGE_TO_X: Record<string, number> = {
  prospect: 0, acolyte: 1, keta: 2, keji: 3, first: 4, zero: 5, "sat knyt": 6,
};
const METAME_STAGE_TO_X: Record<string, number> = {
  visitor: 0, initiate: 1, participant: 2, curator: 3, composer: 4, operator: 5, architect: 6,
};

function MatrixMiniPanel({
  tenantId,
  stageDistribution,
  depthDistribution,
  totalJourneys,
  onStageClick,
}: {
  tenantId?: string;
  stageDistribution: Record<string, number>;
  depthDistribution: Record<string, number>;
  totalJourneys: number;
  onStageClick?: (stage: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(true);
  const cfg = MATRIX_CONFIG[tenantId ?? "nakamoto"] ?? MATRIX_CONFIG.nakamoto;
  const stageToX = tenantId === "metame" ? METAME_STAGE_TO_X : KNYT_STAGE_TO_X;
  const xLen = cfg.x_stages.length;
  const yLen = cfg.y_stages.length;
  const yReversed = [...cfg.y_stages].reverse();

  // Build cell heat map: for each (y, x) estimate density from stage + depth distributions
  // y index approximated from depth, x index from stage
  const heat: Record<string, number> = {};
  let maxHeat = 1;
  Object.entries(stageDistribution).forEach(([stage, sCount]) => {
    const xi = stageToX[stage.toLowerCase()];
    if (xi == null) return;
    // Distribute this stage's users across y based on depth distribution
    Object.entries(depthDistribution).forEach(([depth, dCount]) => {
      const yi = DEPTH_TO_Y_INDEX[depth] ?? 0;
      // Y index in reversed array (0=top) = yLen-1-yi
      const yRevIdx = yLen - 1 - Math.min(yi, Math.floor(yLen * 0.6)); // scale depth to y range
      const key = `${yRevIdx}:${xi}`;
      const contrib = totalJourneys > 0 ? (sCount / totalJourneys) * (dCount / totalJourneys) * totalJourneys : 0;
      heat[key] = (heat[key] ?? 0) + contrib;
      if ((heat[key] ?? 0) > maxHeat) maxHeat = heat[key]!;
    });
  });

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="flex items-center gap-1.5 text-[11px] text-violet-400/70 hover:text-violet-300 border border-violet-500/20 rounded px-2 py-1 bg-violet-500/5"
      >
        <span className="grid grid-cols-3 gap-0.5">
          {[0,1,2,3,4,5,6,7,8].map(i => (
            <span key={i} className={`h-1 w-1 rounded-sm ${i === 4 ? 'bg-emerald-500/60' : i % 3 === 2 && i < 6 ? 'bg-violet-500/30' : 'bg-slate-700'}`} />
          ))}
        </span>
        Experience Matrix
        <ChevronDown className="h-3 w-3" />
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-violet-500/20 bg-slate-950/80 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold text-violet-300 uppercase tracking-wide">Experience Matrix — Population View</div>
        <button onClick={() => setCollapsed(true)} className="text-[10px] text-slate-500 hover:text-slate-300">
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="text-[11px] text-slate-500">Y = PCS engagement · X = Sovereignty journey · Cell heat = population density</div>
      <div className="overflow-x-auto">
        <div style={{ minWidth: `${72 + xLen * 60}px` }}>
          {/* X header */}
          <div className="grid gap-0.5 mb-0.5" style={{ gridTemplateColumns: `68px repeat(${xLen}, 1fr)` }}>
            <div className="text-[10px] text-slate-700">Y╲X</div>
            {cfg.x_stages.map((x, xi) => {
              const stage = x.toLowerCase().replace(" knyt", "").replace("-aligned sovereign", "");
              const count = stageDistribution[stage] ?? 0;
              const pct = totalJourneys > 0 ? Math.round((count / totalJourneys) * 100) : 0;
              return (
                <button
                  key={x}
                  onClick={() => onStageClick?.(stage)}
                  className="text-center text-[10px] font-semibold text-slate-500 pb-0.5 hover:text-violet-300 truncate transition-colors"
                  title={`${x}: ${count} (${pct}%)`}
                >
                  {x.length > 7 ? x.slice(0, 7) + "…" : x}
                  {count > 0 && <span className="block text-[9px] text-violet-400/70">{count}</span>}
                </button>
              );
            })}
          </div>
          {/* Grid rows */}
          {yReversed.map((y, yi) => (
            <div key={y} className="grid gap-0.5 mb-0.5" style={{ gridTemplateColumns: `68px repeat(${xLen}, 1fr)` }}>
              <div className="text-[10px] text-slate-500 flex items-center truncate pr-1" title={y}>
                {y.length > 9 ? y.slice(0, 9) + "…" : y}
              </div>
              {cfg.x_stages.map((x, xi) => {
                const cellHeat = heat[`${yi}:${xi}`] ?? 0;
                const intensity = maxHeat > 0 ? cellHeat / maxHeat : 0;
                const isApex = yi <= 1 && xi >= xLen - 2;
                const bg = isApex && intensity > 0
                  ? `bg-amber-500/${Math.round(intensity * 30 + 5)}`
                  : intensity > 0.4
                    ? `bg-violet-500/${Math.round(intensity * 40 + 5)}`
                    : intensity > 0
                      ? "bg-violet-500/5"
                      : "bg-slate-950/30";
                return (
                  <div
                    key={`${y}:${x}`}
                    className={`rounded-sm h-5 border ${isApex ? 'border-amber-500/20' : intensity > 0 ? 'border-violet-500/20' : 'border-slate-800/20'} ${bg}`}
                    title={`${y} × ${x}${cellHeat > 0 ? ` — ~${Math.round(cellHeat)} users` : ''}`}
                  />
                );
              })}
            </div>
          ))}
          {/* Legend */}
          <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-600">
            <span><span className="text-violet-400">■</span> user density</span>
            <span><span className="text-amber-400">■</span> apex zone</span>
            <span className="ml-auto text-slate-700">goal: top-right ★</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const DISPOSITION_COLORS: Record<string, string> = {
  act: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  ask: "border-blue-500/40 bg-blue-500/10 text-blue-300",
  wait: "border-slate-600 bg-slate-800 text-slate-400",
  escalate: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  deny: "border-rose-500/40 bg-rose-500/10 text-rose-300",
};

interface ExperienceDashboardTabProps {
  personaId?: string;
  tenantId?: string;
  theme?: "light" | "dark";
}

export function ExperienceDashboardTab({ personaId, tenantId, theme = "dark" }: ExperienceDashboardTabProps) {
  // Tenant-aware stage config
  const isMetaMe = tenantId === "metame";
  const activeStages = isMetaMe ? METAME_STAGES : KNYT_STAGES;
  const activeStageColors = isMetaMe ? METAME_STAGE_COLORS : KNYT_STAGE_COLORS;

  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotMessages, setCopilotMessages] = useState<CopilotMessage[]>([]);

  const [activeView, setActiveView] = useState("franchise");
  const [franchise, setFranchise] = useState<FranchiseData | null>(null);
  const [cohort, setCohort] = useState<CohortData | null>(null);
  const [cohortStage, setCohortStage] = useState<string>("all");
  const [individuals, setIndividuals] = useState<Individual[]>([]);
  const [selectedIndividual, setSelectedIndividual] = useState<Individual | null>(null);
  const [nakamotoData, setNakamotoData] = useState<NakamotoData | null>(null);
  const [crmPersonaDetail, setCrmPersonaDetail] = useState<CrmPersonaDetail | null>(null);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [nakamotoLoading, setNakamotoLoading] = useState(false);
  const [indCrmTab, setIndCrmTab] = useState<"overview" | "investment" | "contributions" | "rewards" | "activity">("overview");
  const [expandedInteraction, setExpandedInteraction] = useState<string | null>(null);
  const [indStageFilter, setIndStageFilter] = useState<string>("all");
  const [indSearch, setIndSearch] = useState<string>("");
  const [nbeData, setNbeData] = useState<NBEData | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [artifactState, setArtifactState] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const fetchView = useCallback(async (view: string, opts?: { stage?: string; search?: string }) => {
    setLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams({ view });
      // Never filter the admin list by the current user's personaId —
      // personaId prop is the viewer's identity, not a list scope filter.
      // Individual detail fetches use selectedIndividual.persona_id directly.
      if (tenantId) params.set("tenantId", tenantId);
      if (opts?.stage && opts.stage !== "all") params.set("stage", opts.stage);
      if (opts?.search) params.set("search", opts.search);
      if (view === "individual") params.set("limit", "200");
      const res = await fetch(`/api/runtime/experience/dashboard?${params}`);
      if (!res.ok) {
        setFetchError(`API error ${res.status} — ${res.statusText}`);
        return;
      }
      const data = await res.json();
      if (view === "franchise") setFranchise(data);
      if (view === "cohort") setCohort(data);
      if (view === "individual") setIndividuals(data.individuals ?? []);
      if (view === "nbe") setNbeData(data);
    } catch {
      setFetchError("Network error — unable to reach the dashboard API.");
    } finally {
      setLoading(false);
    }
  }, [personaId, tenantId]);

  const syncCRM = useCallback(async (currentView: string) => {
    if (!tenantId) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch(`/api/runtime/experience/seed/${tenantId}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || res.status === 207) {
        const errMsg = data.error ?? (data.errors ? data.errors.join("; ") : "Sync failed");
        const hint = data.hint ? ` — ${data.hint}` : "";
        throw new Error(`${errMsg}${hint}`);
      }
      setSyncResult(`Synced ${data.seeded} personas (${data.skipped ?? 0} unchanged)`);
      // Refresh franchise + current view so totals update regardless of active tab
      void fetchView("franchise");
      if (currentView !== "franchise") void fetchView(currentView);
    } catch (e: any) {
      setSyncResult(`Sync error: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  }, [tenantId, fetchView]);

  // Fetch full CRM data when an individual is selected
  useEffect(() => {
    if (!selectedIndividual) {
      setNakamotoData(null);
      setCrmPersonaDetail(null);
      setContributions([]);
      setRewards([]);
      setIndCrmTab("overview");
      setArtifactState(null);
      return;
    }
    setNakamotoLoading(true);
    const tid = tenantId ?? "nakamoto";
    Promise.all([
      fetch(`/api/crm/personas/${selectedIndividual.persona_id}/nakamoto`).then((r) => r.json()),
      fetch(`/api/crm/personas?tenantId=${tid}&personaId=${selectedIndividual.persona_id}&source=live`).then((r) => r.json()),
      fetch(`/api/crm/contributions?tenantId=${tid}&personaId=${selectedIndividual.persona_id}&limit=10`).then((r) => r.json()),
      fetch(`/api/crm/rewards?tenantId=${tid}&personaId=${selectedIndividual.persona_id}&limit=10`).then((r) => r.json()),
      fetch(`/api/registry/studio-artifacts?personaId=${selectedIndividual.persona_id}`).then((r) => r.json()).catch(() => null),
    ])
      .then(([nakRes, personaRes, contribRes, rewardsRes, artifactRes]) => {
        setNakamotoData(nakRes?.data ?? null);
        setCrmPersonaDetail(personaRes?.data ?? personaRes ?? null);
        setContributions(contribRes?.data ?? contribRes?.contributions ?? []);
        setRewards(rewardsRes?.data ?? rewardsRes?.rewards ?? []);
        setArtifactState(artifactRes?.data?.status ?? null);
      })
      .catch(() => {})
      .finally(() => setNakamotoLoading(false));
  }, [selectedIndividual, tenantId]);

  useEffect(() => {
    if (activeView === "reactivation" || activeView === "guardian") {
      void fetchView("franchise");
      void fetchView("individual", { stage: indStageFilter });
    } else if (activeView === "cohort") {
      void fetchView("cohort", { stage: cohortStage !== "all" ? cohortStage : undefined });
    } else if (activeView === "individual") {
      void fetchView("individual", { stage: indStageFilter !== "all" ? indStageFilter : undefined });
    } else {
      void fetchView(activeView);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, fetchView]);

  const base = "rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-200";

  return (
    <div className="space-y-4 p-4">
      {/* Header — COD-301 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Layers className="h-5 w-5 text-violet-400" />
          <div>
            <div className="font-semibold text-slate-100">Experience Dashboard</div>
            <div className="text-xs text-slate-400">
              {tenantId === "metame" ? "metaMe PCS Journey — Operator View" : "KNYT Laddering Program — Operator View"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {tenantId && (
            <Button variant="outline" size="sm" onClick={() => void syncCRM(activeView)}
              disabled={syncing || loading} className="h-7 gap-1.5 text-xs border-violet-500/40 text-violet-300 hover:text-violet-200">
              <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing…" : "Sync CRM"}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => {
              if (activeView === "guardian" || activeView === "reactivation") {
                void fetchView("franchise");
                void fetchView("individual", { stage: indStageFilter });
              } else {
                void fetchView(activeView);
              }
            }}
            disabled={loading} className="h-7 gap-1.5 text-xs">
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>
      {syncResult && (
        <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 px-3 py-1.5 text-xs text-violet-300">
          {syncResult}
        </div>
      )}

      {/* COD-603 — Error banner */}
      {fetchError && (
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-4 py-2.5 flex items-center justify-between gap-3">
          <span className="text-xs text-rose-300">{fetchError}</span>
          <Button variant="ghost" size="sm" onClick={() => {
              if (activeView === "guardian" || activeView === "reactivation") {
                void fetchView("franchise");
                void fetchView("individual", { stage: indStageFilter });
              } else {
                void fetchView(activeView);
              }
            }}
            className="h-6 text-xs text-rose-400 hover:text-rose-300 shrink-0">
            Retry
          </Button>
        </div>
      )}

      <Tabs value={activeView} onValueChange={setActiveView}>
        <TabsList className="grid w-full grid-cols-6 border border-slate-800 bg-slate-950/70">
          <TabsTrigger value="franchise" className="flex items-center gap-1.5 text-xs">
            <Globe className="h-3.5 w-3.5" /> Franchise
          </TabsTrigger>
          <TabsTrigger value="cohort" className="flex items-center gap-1.5 text-xs">
            <Users className="h-3.5 w-3.5" /> Cohort
          </TabsTrigger>
          <TabsTrigger value="individual" className="flex items-center gap-1.5 text-xs">
            <Activity className="h-3.5 w-3.5" /> Individual
          </TabsTrigger>
          <TabsTrigger value="nbe" className="flex items-center gap-1.5 text-xs">
            <Zap className="h-3.5 w-3.5" /> NBE Planner
          </TabsTrigger>
          <TabsTrigger value="reactivation" className="flex items-center gap-1.5 text-xs">
            <TrendingUp className="h-3.5 w-3.5" /> Reactivation
          </TabsTrigger>
          <TabsTrigger value="guardian" className="flex items-center gap-1.5 text-xs">
            <Eye className="h-3.5 w-3.5" /> Guardian
          </TabsTrigger>
        </TabsList>

        {/* COD-302 — Franchise view */}
        <TabsContent value="franchise">
          <div className={base}>
            {franchise ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="text-2xl font-bold text-slate-100">{franchise.total_journeys}</div>
                  <div className="text-xs text-slate-400">total journeys</div>
                  <Badge variant="outline" className="border-violet-500/40 text-violet-300">
                    {franchise.nbe_opportunities.length} active NBE plans
                  </Badge>
                </div>

                {/* Stage distribution — funnel health */}
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Stage Distribution</div>
                  <div className={`grid gap-2 ${activeStages.length > 6 ? "md:grid-cols-7" : "md:grid-cols-6"}`}>
                    {activeStages.map((stage) => {
                      const count = franchise.stage_distribution[stage] ?? 0;
                      const pct = franchise.total_journeys > 0
                        ? Math.round((count / franchise.total_journeys) * 100)
                        : 0;
                      return (
                        <div key={stage} className={`rounded-lg border p-2 text-center ${activeStageColors[stage] ?? "border-slate-700 text-slate-400"}`}>
                          <div className="text-[11px] capitalize">{stage}</div>
                          <div className="text-lg font-bold">{count}</div>
                          <div className="text-[10px] opacity-70">{pct}%</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Depth distribution */}
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Depth Distribution</div>
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(franchise.depth_distribution).map(([depth, count]) => (
                      <div key={depth} className="rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-1.5 text-center">
                        <div className="text-[11px] text-slate-400">{depth}</div>
                        <div className="font-semibold">{count}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* NBE opportunities */}
                {franchise.nbe_opportunities.length > 0 && (
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">NBE Opportunities</div>
                    <div className="flex gap-2 flex-wrap">
                      {Object.entries(
                        franchise.nbe_opportunities.reduce<Record<string, number>>((acc, p) => {
                          acc[p.disposition] = (acc[p.disposition] ?? 0) + 1;
                          return acc;
                        }, {})
                      ).map(([disp, count]) => (
                        <Badge key={disp} variant="outline"
                          className={`capitalize ${DISPOSITION_COLORS[disp] ?? "border-slate-700 text-slate-300"}`}>
                          {disp}: {count}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Experience Matrix — population density overlay */}
                <MatrixMiniPanel
                  tenantId={tenantId}
                  stageDistribution={franchise.stage_distribution}
                  depthDistribution={franchise.depth_distribution}
                  totalJourneys={franchise.total_journeys}
                  onStageClick={(stage) => {
                    setActiveView("individual");
                    setIndStageFilter(stage);
                    void fetchView("individual", { stage });
                  }}
                />
              </div>
            ) : loading ? (
              <div className="text-slate-400">Loading franchise data…</div>
            ) : (
              <div className="text-slate-400 text-xs">No journey data yet. Run the DB migration and seed journey states.</div>
            )}
          </div>
        </TabsContent>

        {/* COD-303 — Cohort view */}
        <TabsContent value="cohort">
          <div className={base}>
            {/* Cohort stage selector */}
            <div className="mb-3 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-400 shrink-0">Cohort:</span>
              {["all", ...activeStages].map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setCohortStage(s);
                    void fetchView("cohort", { stage: s !== "all" ? s : undefined });
                  }}
                  className={`rounded px-2.5 py-0.5 text-[11px] border transition-colors capitalize ${
                    cohortStage === s
                      ? "border-violet-500/60 bg-violet-500/15 text-violet-200"
                      : "border-slate-700 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  {s === "all" ? "All" : s}
                </button>
              ))}
            </div>

            {cohort ? (
              <div className="space-y-3">
                <div className="text-xs text-slate-400">{cohort.total} journeys{cohortStage !== "all" ? ` · stage: ${cohortStage}` : ` across ${Object.keys(cohort.cohorts).length} cohort(s)`}</div>
                {Object.entries(cohort.cohorts).map(([key, data]) => (
                  <div key={key} className={`rounded-lg border p-3 ${cohortStage === key ? "border-violet-500/30 bg-violet-500/5" : "border-slate-800 bg-slate-900/40"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className={`font-semibold capitalize ${STAGE_COLORS[key]?.replace("border-", "text-").split(" ")[1] ?? "text-slate-200"}`}>{key}</div>
                      <div className="flex gap-2 items-center">
                        <Badge variant="outline" className="border-slate-700 text-slate-300 text-[11px]">
                          {data.count.toLocaleString()} journeys
                        </Badge>
                        {data.stalled > 0 && (
                          <Badge variant="outline" className="border-amber-500/40 text-amber-300 text-[11px]">
                            {data.stalled} stalled
                          </Badge>
                        )}
                        <button
                          onClick={() => {
                            setIndStageFilter(key);
                            setActiveView("individual");
                            void fetchView("individual", { stage: key });
                          }}
                          className="text-[10px] text-violet-400 hover:text-violet-300 underline underline-offset-2"
                        >
                          View individuals →
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {Object.entries(data.depths).map(([depth, count]) => (
                        <div key={depth} className="rounded border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300">
                          {depth}: {count}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {Object.keys(cohort.cohorts).length === 0 && (
                  <div className="text-slate-400 text-xs">No cohort data. Seed journey states to see cohort breakdowns.</div>
                )}
                {/* Experience Matrix — cohort density */}
                {franchise && (
                  <MatrixMiniPanel
                    tenantId={tenantId}
                    stageDistribution={franchise.stage_distribution}
                    depthDistribution={franchise.depth_distribution}
                    totalJourneys={franchise.total_journeys}
                    onStageClick={(stage) => {
                      setIndStageFilter(stage);
                      setActiveView("individual");
                      void fetchView("individual", { stage });
                    }}
                  />
                )}
              </div>
            ) : loading ? (
              <div className="text-slate-400">Loading cohort data…</div>
            ) : (
              <div className="text-slate-400 text-xs">No cohort data. Seed journey states to see cohort breakdowns.</div>
            )}
          </div>
        </TabsContent>

        {/* COD-304 — Individual view */}
        <TabsContent value="individual">
          <div className="space-y-3">
            {selectedIndividual ? (() => {
              const kp = nakamotoData?.knytPersona;
              const bq = nakamotoData?.blakQube;
              const displayName = str(crmPersonaDetail?.displayName) || str(kp?.['First-Name'] ?? '') + (str(kp?.['Last-Name']) ? ' ' + str(kp?.['Last-Name']) : '') || selectedIndividual.crm?.display_name || selectedIndividual.persona_id.slice(0, 8) + '…';
              const phone = str(kp?.['Phone-Number']) || str(bq?.['Phone-Number']);
              const evmKey = str(kp?.['EVM-Public-Key']) || str(bq?.['EVM-Public-Key']);
              const btcKey = str(kp?.['BTC-Public-Key']) || str(bq?.['BTC-Public-Key']);
              const tokensOfInterest = arr(kp?.['Tokens-of-Interest']).length ? arr(kp?.['Tokens-of-Interest']) : arr(bq?.['Tokens-of-Interest']);
              const web3Interests = arr(kp?.['Web3-Interests']).length ? arr(kp?.['Web3-Interests']) : arr(bq?.['Web3-Interests']);
              const twitter = str(kp?.['Twitter-Handle']) || str(bq?.['Twitter-Handle']);
              const linkedin = str(kp?.['LinkedIn-ID']) || str(bq?.['LinkedIn-ID']);
              const linkedinUrl = str(kp?.['LinkedIn-Profile-URL']) || str(bq?.['LinkedIn-Profile-URL']);
              const telegram = str(kp?.['Telegram-Handle']) || str(bq?.['Telegram-Handle']);
              const discord = str(kp?.['Discord-Handle']) || str(bq?.['Discord-Handle']);
              const omSince = str(kp?.['OM-Member-Since']);
              // OM-Tier-Status is often empty in nakamoto; fall back to the persona's order_tier
              const omTier = str(kp?.['OM-Tier-Status']) || str(bq?.['OM-Tier-Status']) || str(selectedIndividual.crm?.order_tier);
              const totalInvested = str(kp?.['Total-Invested']);
              const metaiyeShares = str(kp?.['Metaiye-Shares-Owned']);
              // Strip any embedded " KNYT" unit suffix stored in the DB before appending unit in display
              const knytCoyn = str(kp?.['KNYT-COYN-Owned']).replace(/\s*KNYT\s*$/i, '').trim();
              const motionComics = str(kp?.['Motion-Comics-Owned']);
              const paperComics = str(kp?.['Paper-Comics-Owned']);
              const digitalComics = str(kp?.['Digital-Comics-Owned']);
              const knytPosters = str(kp?.['KNYT-Posters-Owned']);
              const knytCards = str(kp?.['KNYT-Cards-Owned']);
              const characters = str(kp?.['Characters-Owned']);
              const knytId = str(kp?.['KNYT-ID']) || str(bq?.['KNYT-ID']);
              const profession = str(kp?.['Profession']) || str(bq?.['Profession']);
              const city = str(kp?.['Local-City']) || str(bq?.['Local-City']);
              const email = str(kp?.['Email']) || str(crmPersonaDetail?.email);
              const hasInvestment = !!(totalInvested || omTier || metaiyeShares || knytCoyn || motionComics || paperComics || digitalComics || knytPosters || knytCards || characters);
              const hasSocial = !!(twitter || linkedin || telegram || discord);
              const hasWeb3 = !!(evmKey || btcKey || tokensOfInterest.length || web3Interests.length);
              const crmTabs: { id: typeof indCrmTab; label: string }[] = [
                { id: 'overview', label: 'Overview' },
                ...(hasInvestment ? [{ id: 'investment' as const, label: 'Investment & Assets' }] : []),
                { id: 'contributions', label: 'Contributions' },
                { id: 'rewards', label: 'Rewards' },
                { id: 'activity', label: 'Activity' },
              ];
              const persona = crmPersonaDetail;
              const initials = displayName.charAt(0).toUpperCase();

              return (
              <div className="space-y-3">
                <Button variant="ghost" size="sm" onClick={() => setSelectedIndividual(null)}
                  className="h-6 gap-1 text-xs text-slate-400">
                  ← Back to list
                </Button>

                {nakamotoLoading ? (
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-6 text-slate-400 text-xs">Loading CRM data…</div>
                ) : (
                <div className="space-y-3">
                  {/* Header card */}
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center text-base font-semibold text-white shrink-0">
                          {initials}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-100">{displayName}</div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {email && <span className="text-[11px] text-slate-400 flex items-center gap-1"><Mail className="h-3 w-3" />{email}</span>}
                            {selectedIndividual.crm?.fio_handle && <span className="text-[11px] text-violet-400 font-mono">{selectedIndividual.crm.fio_handle}</span>}
                            {knytId && <span className="text-[10px] font-mono text-cyan-400/70 bg-cyan-400/10 px-1.5 py-0.5 rounded">KNYT-ID: {knytId}</span>}
                            {profession && <span className="text-[11px] text-slate-400 flex items-center gap-1"><Briefcase className="h-3 w-3" />{profession}</span>}
                            {city && <span className="text-[11px] text-slate-400 flex items-center gap-1"><MapPin className="h-3 w-3" />{city}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {omTier && <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-400/10 text-amber-400 ring-1 ring-amber-400/30">{omTier}</span>}
                        <Badge variant="outline" className={`capitalize text-[11px] ${STAGE_COLORS[selectedIndividual.stage] ?? "border-slate-700 text-slate-400"}`}>
                          {selectedIndividual.stage}
                        </Badge>
                        {(crmPersonaDetail?.personaState || selectedIndividual.crm?.status) && (
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 ${(crmPersonaDetail?.personaState || selectedIndividual.crm?.status) === 'active' ? 'bg-emerald-400/10 text-emerald-400 ring-emerald-400/30' : 'bg-slate-400/10 text-slate-400 ring-slate-400/20'}`}>
                            {crmPersonaDetail?.personaState ?? selectedIndividual.crm?.status}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-4 gap-2 mt-4">
                      {[
                        { icon: <TrendingUp className="h-3.5 w-3.5" />, label: "Total PoKW", value: (persona?.totalPokw ?? 0).toLocaleString(), color: "text-emerald-400" },
                        { icon: <FileText className="h-3.5 w-3.5" />, label: "Contributions", value: String(persona?.contributionCount ?? contributions.length), color: "text-slate-200" },
                        { icon: <Coins className="h-3.5 w-3.5" />, label: "Total Invested", value: totalInvested || "—", color: "text-amber-400" },
                        { icon: <Star className="h-3.5 w-3.5" />, label: "Reputation", value: persona?.reputationBucket ?? selectedIndividual.crm?.reputation_tier ?? "—", color: "text-slate-200" },
                      ].map(({ icon, label, value, color }) => (
                        <div key={label} className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
                          <div className="flex items-center gap-1.5 text-slate-400 text-[11px] mb-1">{icon}{label}</div>
                          <div className={`text-base font-semibold capitalize ${color}`}>{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* CRM Tabs */}
                  <div className="flex items-center gap-1 flex-wrap">
                    {crmTabs.map((tab) => (
                      <button key={tab.id} onClick={() => setIndCrmTab(tab.id)}
                        className={`px-3 py-1.5 rounded text-xs font-medium transition ${indCrmTab === tab.id ? "bg-violet-500/20 text-violet-200 border border-violet-500/40" : "text-slate-400 hover:text-slate-200 border border-transparent hover:border-slate-700"}`}>
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Overview tab */}
                  {indCrmTab === "overview" && (
                    <div className="grid gap-3 md:grid-cols-2">
                      {/* Details */}
                      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3 flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />Details</div>
                        <dl className="space-y-2 text-xs">
                          {[
                            ["Persona ID", selectedIndividual.crm?.fio_handle || selectedIndividual.persona_id.slice(0, 8) + "…"],
                            ["Tenant", TENANT_NAMES[persona?.tenantId ?? tenantId ?? ""] ?? persona?.tenantId ?? tenantId ?? "—"],
                            ["Created", persona?.createdAt ? new Date(persona.createdAt).toLocaleDateString() : selectedIndividual.crm?.created_at ? new Date(selectedIndividual.crm.created_at).toLocaleDateString() : "—"],
                            ["Last Updated", persona?.updatedAt ? new Date(persona.updatedAt).toLocaleDateString() : "—"],
                            ["Stage", selectedIndividual.stage],
                            ["Depth", selectedIndividual.depth],
                            ["Last Active", selectedIndividual.active_at ? new Date(selectedIndividual.active_at).toLocaleDateString() : "—"],
                            ...(phone ? [["Phone", phone]] : []),
                            ...(omSince ? [["OM Member Since", omSince]] : []),
                            ...(persona?.primaryWalletAddress ? [["Wallet", persona.primaryWalletAddress.slice(0, 10) + "…"]] : []),
                            ...(nakamotoData?.rewardRecord ? [["Onboarding Reward", nakamotoData.rewardRecord.reward_claimed ? `${nakamotoData.rewardRecord.reward_amount} KNYT claimed` : `${nakamotoData.rewardRecord.reward_amount} KNYT pending`]] : []),
                          ].map(([k, v]) => (
                            <div key={k} className="flex justify-between gap-2">
                              <dt className="text-slate-500 shrink-0 flex items-center gap-1">
                                {k === "Phone" && <Phone className="h-3 w-3" />}
                                {k}
                              </dt>
                              <dd className="text-slate-200 font-mono text-right truncate">{v}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>

                      {/* Social + NBE */}
                      <div className="space-y-3">
                        {hasSocial && (
                          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3 flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" />Social</div>
                            <div className="space-y-2 text-xs">
                              {twitter && <div className="flex items-center gap-2"><Twitter className="h-3.5 w-3.5 text-sky-400" /><span className="text-slate-300">@{twitter}</span></div>}
                              {linkedin && <div className="flex items-center gap-2"><Linkedin className="h-3.5 w-3.5 text-blue-400" />
                                {linkedinUrl ? <a href={linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{linkedin}</a> : <span className="text-slate-300">{linkedin}</span>}
                              </div>}
                              {telegram && <div className="flex items-center gap-2"><MessageCircle className="h-3.5 w-3.5 text-sky-400" /><span className="text-slate-300">@{telegram}</span></div>}
                              {discord && <div className="flex items-center gap-2"><Hash className="h-3.5 w-3.5 text-indigo-400" /><span className="text-slate-300">{discord}</span></div>}
                            </div>
                          </div>
                        )}
                        {hasWeb3 && (
                          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3 flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5" />Web3</div>
                            <div className="space-y-2 text-xs">
                              {evmKey && <div><div className="text-slate-500 text-[10px]">EVM</div><div className="font-mono text-slate-300 break-all text-[11px]">{evmKey}</div></div>}
                              {btcKey && <div><div className="text-slate-500 text-[10px]">BTC</div><div className="font-mono text-slate-300 break-all text-[11px]">{btcKey}</div></div>}
                              {tokensOfInterest.length > 0 && <div className="flex gap-1 flex-wrap">{tokensOfInterest.map((t) => <span key={t} className="rounded bg-violet-500/10 px-1.5 py-0.5 text-[10px] text-violet-300">{t}</span>)}</div>}
                            </div>
                          </div>
                        )}
                        {selectedIndividual.nbe && (
                          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-2">
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-violet-400" />NBE Plan</div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className={`capitalize text-[11px] ${DISPOSITION_COLORS[selectedIndividual.nbe.disposition] ?? "border-slate-700"}`}>{selectedIndividual.nbe.disposition}</Badge>
                              {selectedIndividual.nbe.next_experience_depth && <Badge variant="outline" className="border-violet-500/40 text-violet-300 text-[11px]">→ {selectedIndividual.nbe.next_experience_depth}</Badge>}
                            </div>
                            {selectedIndividual.nbe.rationale && <div className="text-xs text-slate-300">{selectedIndividual.nbe.rationale}</div>}
                            {/* D4 — NBE→KNYT routing: surface a direct path when disposition is act */}
                            {selectedIndividual.nbe.disposition === 'act' && (
                              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 flex items-center justify-between gap-2">
                                <span className="text-[11px] text-emerald-300">Ready to act — next step available</span>
                                <button
                                  onClick={() => {
                                    const nextDepth = selectedIndividual.nbe?.next_experience_depth ?? '';
                                    const isKnyt = nextDepth.includes('knyt') ||
                                      (selectedIndividual.nbe?.rationale ?? '').toLowerCase().includes('knyt');
                                    const path = isKnyt ? '/codex?id=knyt-codex' : '/codex?id=agentiq-codex&tab=experience-dashboard';
                                    window.location.href = path;
                                  }}
                                  className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-300 hover:bg-emerald-500/20 transition-colors shrink-0"
                                >
                                  {(() => {
                                    const nextDepth = selectedIndividual.nbe?.next_experience_depth ?? '';
                                    const isKnyt = nextDepth.includes('knyt') ||
                                      (selectedIndividual.nbe?.rationale ?? '').toLowerCase().includes('knyt');
                                    return isKnyt ? 'Go to KNYT →' : 'Continue →';
                                  })()}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                        {/* Matrix Position — dual X + Y bars with chess-grid reference */}
                        {(() => {
                          const isKnyt = (tenantId === "nakamoto" || !tenantId);
                          const xStages = isKnyt ? KNYT_STAGES.map(s => s === "sat knyt" ? "Sat KNYT" : s.charAt(0).toUpperCase() + s.slice(1)) : METAME_STAGES.map(s => s.charAt(0).toUpperCase() + s.slice(1));
                          const yStages = isKnyt ? KNYT_Y_STAGES : METAME_Y_STAGES;
                          const stageToIdx = isKnyt ? KNYT_STAGE_TO_IDX : METAME_STAGE_TO_IDX;
                          const xIdx = stageToIdx[selectedIndividual.stage] ?? 0;
                          const xLabel = xStages[xIdx] ?? selectedIndividual.stage;
                          // Rich Y inference if wallet data is loaded, else estimate from depth
                          const richY = nakamotoData ? inferKnytYIndex({
                            knytCards, motionComics, paperComics, digitalComics, knytPosters, characters,
                            contributions, rewards,
                            knytCoyn,
                          }) : null;
                          const yIdx = richY ?? (DEPTH_TO_Y_ESTIMATE[selectedIndividual.depth] ?? 0);
                          const yLabel = yStages[yIdx] ?? yStages[0];
                          return (
                            <MatrixPositionBars
                              xStages={xStages}
                              xIndex={xIdx}
                              xLabel={xLabel}
                              yStages={yStages}
                              yIndex={yIdx}
                              yLabel={yLabel}
                              yIsEstimated={richY === null}
                            />
                          );
                        })()}
                        {/* Studio artifact state badge */}
                        {artifactState && (
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Studio artifact</span>
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                              artifactState === "canonical"
                                ? "border-emerald-500/40 text-emerald-300"
                                : artifactState === "working"
                                ? "border-amber-500/40 text-amber-300"
                                : "border-slate-600 text-slate-400"
                            }`}>
                              {artifactState}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Investment & Assets tab */}
                  {indCrmTab === "investment" && hasInvestment && (
                    <div className="space-y-3">
                      <div className="grid gap-2 grid-cols-2 md:grid-cols-4">
                        {[
                          { label: "Total Invested", value: totalInvested || "—", color: "text-amber-400" },
                          { label: "OM Tier", value: omTier || "—", sub: omSince ? `Since ${omSince}` : undefined, color: "text-amber-300" },
                          { label: "Metaiye Shares", value: metaiyeShares || "0", color: "text-violet-300" },
                          { label: "KNYT COYN", value: `${knytCoyn || "0"} KNYT`, color: "text-cyan-300" },
                        ].map(({ label, value, sub, color }) => (
                          <div key={label} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                            <div className="text-[11px] text-slate-500 mb-1">{label}</div>
                            <div className={`text-lg font-bold ${color}`}>{value}</div>
                            {sub && <div className="text-[10px] text-slate-500 mt-0.5">{sub}</div>}
                          </div>
                        ))}
                      </div>
                      {(motionComics || paperComics || digitalComics || knytPosters || knytCards || characters) && (
                        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Asset Inventory</div>
                          <div className="grid gap-2 grid-cols-2 md:grid-cols-3 text-xs">
                            {[["Motion Comics", motionComics], ["Paper Comics", paperComics], ["Digital Comics", digitalComics], ["KNYT Posters", knytPosters], ["KNYT Cards", knytCards], ["Characters", characters]].filter(([, v]) => v).map(([k, v]) => (
                              <div key={k} className="rounded border border-slate-700 px-3 py-2 flex justify-between">
                                <span className="text-slate-400">{k}</span>
                                <span className="font-semibold text-slate-200">{v}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {nakamotoData?.rewardRecord && (
                        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                          <div className="text-xs font-semibold uppercase tracking-wide text-emerald-400 mb-3 flex items-center gap-1.5"><Gift className="h-3.5 w-3.5" />Onboarding Reward</div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                            {[
                              ["LinkedIn", nakamotoData.rewardRecord.linkedin_connected ? "✓ Connected" : "—"],
                              ["MetaMask", nakamotoData.rewardRecord.metamask_connected ? "✓ Connected" : "—"],
                              ["Data", nakamotoData.rewardRecord.data_completed ? "✓ Complete" : "—"],
                              ["Reward", nakamotoData.rewardRecord.reward_claimed ? `${nakamotoData.rewardRecord.reward_amount} KNYT claimed` : "Unclaimed"],
                            ].map(([k, v]) => (
                              <div key={k} className="rounded border border-emerald-500/20 px-2 py-1.5">
                                <div className="text-slate-500">{k}</div>
                                <div className={`font-semibold ${String(v).startsWith("✓") ? "text-emerald-400" : "text-slate-400"}`}>{v}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* KNYT Wheel Campaign Status — shown whenever nakamoto record exists */}
                      {nakamotoData?.knytPersona && (() => {
                        const kp = nakamotoData.knytPersona as Record<string, any>;
                        const nakId = String(kp.id ?? '');
                        const cohort = String(kp.campaign_cohort ?? '');
                        const state  = String(kp.campaign_state ?? '');
                        const ksClicked = !!kp.kickstarter_clicked_at;
                        const ksBacked  = !!kp.kickstarter_backed_at;
                        const notes = String(kp.campaign_notes ?? '');
                        const ksTrackUrl = nakId ? `/api/crm/track/ks?uid=${nakId}&utm_source=knyt_wheel&utm_medium=codex` : '';
                        return (
                          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
                            <div className="text-xs font-semibold uppercase tracking-wide text-rose-400 mb-3 flex items-center justify-between">
                              <span className="flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" />KNYT Wheel Campaign</span>
                              {ksBacked
                                ? <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">BACKED</span>
                                : ksClicked
                                ? <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold">VISITED KS</span>
                                : null
                              }
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mb-3">
                              <div className="rounded border border-rose-500/20 px-2 py-1.5">
                                <div className="text-slate-500">Cohort</div>
                                <div className="font-semibold text-rose-300 capitalize">{cohort || '—'}</div>
                              </div>
                              <div className="rounded border border-rose-500/20 px-2 py-1.5">
                                <div className="text-slate-500">State</div>
                                <div className="font-semibold text-slate-200 capitalize">{state || 'unsent'}</div>
                              </div>
                              <div className="rounded border border-rose-500/20 px-2 py-1.5">
                                <div className="text-slate-500">KS Visit</div>
                                <div className={`font-semibold ${ksClicked ? 'text-amber-400' : 'text-slate-500'}`}>{ksClicked ? '✓ Clicked' : 'Not yet'}</div>
                              </div>
                              <div className="rounded border border-rose-500/20 px-2 py-1.5">
                                <div className="text-slate-500">KS Backed</div>
                                <div className={`font-semibold ${ksBacked ? 'text-emerald-400' : 'text-slate-500'}`}>{ksBacked ? '✓ Backed' : 'Not yet'}</div>
                              </div>
                            </div>
                            {notes && (
                              <p className="text-xs text-slate-400 mb-3 italic">"{notes}"</p>
                            )}
                            {ksTrackUrl && !ksBacked && (
                              <div className="flex items-center gap-2">
                                <a
                                  href={ksTrackUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 ring-1 ring-rose-500/30 text-rose-300 rounded-lg text-xs font-medium transition"
                                >
                                  <TrendingUp className="h-3 w-3" />
                                  Open KS Tracking Link
                                </a>
                                <button
                                  onClick={() => {
                                    const full = `${window.location.origin}${ksTrackUrl}`;
                                    navigator.clipboard?.writeText(full);
                                  }}
                                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white ring-1 ring-white/10 rounded-lg text-xs transition"
                                >
                                  Copy link
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Contributions tab */}
                  {indCrmTab === "contributions" && (
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Contributions</div>
                      {contributions.length > 0 ? (
                        <div className="space-y-1.5">
                          {contributions.map((c) => (
                            <div key={c.id} className="flex items-center justify-between rounded border border-slate-800 bg-slate-900/40 px-3 py-2 text-xs">
                              <div className="flex items-center gap-2">
                                <span className="capitalize text-slate-300">{c.contributionType}</span>
                                <span className="text-slate-500">{c.source}</span>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className="text-slate-400">{c.units} units</span>
                                <span className="text-emerald-400 font-semibold">{c.pokwScore} PoKW</span>
                                <span className="text-slate-500">{new Date(c.createdAt).toLocaleDateString()}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500">No contributions found.</div>
                      )}
                    </div>
                  )}

                  {/* Rewards tab */}
                  {indCrmTab === "rewards" && (
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Rewards</div>
                      {rewards.length > 0 ? (
                        <div className="space-y-1.5">
                          {rewards.map((r) => (
                            <div key={r.id} className="flex items-center justify-between rounded border border-slate-800 bg-slate-900/40 px-3 py-2 text-xs">
                              <span className="capitalize text-slate-300">{r.tokenType}</span>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className="font-semibold text-amber-400">{r.amount}</span>
                                <span className={`capitalize px-1.5 py-0.5 rounded text-[10px] ${r.status === "approved" ? "bg-emerald-500/10 text-emerald-400" : r.status === "pending" ? "bg-amber-500/10 text-amber-400" : "bg-slate-500/10 text-slate-400"}`}>{r.status}</span>
                                <span className="text-slate-500">{new Date(r.createdAt).toLocaleDateString()}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500">No rewards found.</div>
                      )}
                    </div>
                  )}

                  {/* Activity tab */}
                  {indCrmTab === "activity" && (
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Activity ({nakamotoData?.interactions.length ?? 0} interactions)</div>
                      {nakamotoData?.interactions && nakamotoData.interactions.length > 0 ? (
                        <div className="space-y-1.5">
                          {nakamotoData.interactions.map((ix) => (
                            <div key={ix.id} className="rounded border border-slate-800 bg-slate-900/40 text-xs">
                              <button className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-900/60"
                                onClick={() => setExpandedInteraction(expandedInteraction === ix.id ? null : ix.id)}>
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="rounded bg-violet-500/10 text-violet-300 px-1.5 py-0.5 text-[10px] shrink-0">{ix.interaction_type ?? "chat"}</span>
                                  <span className="text-slate-400 text-[11px]">{new Date(ix.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                                  <span className="text-slate-300 truncate">{ix.query}</span>
                                </div>
                                {expandedInteraction === ix.id ? <ChevronUp className="h-3.5 w-3.5 text-slate-500 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-500 shrink-0" />}
                              </button>
                              {expandedInteraction === ix.id && (
                                <div className="border-t border-slate-800 px-3 py-2 space-y-1.5">
                                  <div className="text-slate-400 text-[11px] font-semibold">Query</div>
                                  <div className="text-slate-300 text-[11px]">{ix.query}</div>
                                  {ix.response && <>
                                    <div className="text-slate-400 text-[11px] font-semibold mt-2">Response</div>
                                    <div className="text-slate-400 text-[11px] whitespace-pre-wrap">{ix.response}</div>
                                  </>}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500">No activity found. Interactions are recorded when this member uses Mondai AI.</div>
                      )}
                    </div>
                  )}

                  {/* Trust scores (always shown at bottom) */}
                  {selectedIndividual.trust_scores && (
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <ShieldCheck className="h-3.5 w-3.5" />Trust &amp; Compatibility
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {([
                          { label: "Goal Align", key: "goal_alignment", kind: "trust" },
                          { label: "Stage Ready", key: "stage_readiness", kind: "accuracy" },
                          { label: "NBE Conf.", key: "nbe_confidence", kind: "reliability" },
                        ] as const).map(({ label, key, kind }) => {
                          const raw = selectedIndividual.trust_scores![key];
                          const val = raw != null ? raw / 10 : 0;
                          return (
                            <div key={key} className="rounded border border-slate-800 bg-slate-950/50 px-2 py-1.5 text-center">
                              <div className="text-[10px] text-slate-500 mb-1">{label}</div>
                              {raw != null ? <div className="flex justify-center"><Dots value={val} kind={kind} title={label} size="xs" /></div>
                                : <div className="text-[10px] text-slate-600">—</div>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                )}
              </div>
              );
            })() : (
              <div className={base}>
                {/* Filters row */}
                <div className="mb-3 flex items-center gap-2 flex-wrap">
                  <div className="relative flex-1 min-w-[160px]">
                    <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search name or FIO handle…"
                      value={indSearch}
                      onChange={(e) => setIndSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          void fetchView("individual", {
                            stage: indStageFilter !== "all" ? indStageFilter : undefined,
                            search: indSearch || undefined,
                          });
                        }
                      }}
                      className="w-full rounded border border-slate-700 bg-slate-900/60 py-1 pl-7 pr-3 text-xs text-slate-200 placeholder-slate-500 focus:border-violet-500/50 focus:outline-none"
                    />
                  </div>
                  {["all", ...activeStages].map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setIndStageFilter(s);
                        void fetchView("individual", {
                          stage: s !== "all" ? s : undefined,
                          search: indSearch || undefined,
                        });
                      }}
                      className={`rounded px-2.5 py-0.5 text-[11px] border transition-colors capitalize ${
                        indStageFilter === s
                          ? "border-violet-500/60 bg-violet-500/15 text-violet-200"
                          : "border-slate-700 text-slate-400 hover:border-slate-600"
                      }`}
                    >
                      {s === "all" ? "All" : s}
                    </button>
                  ))}
                </div>

                {individuals.length > 0 ? (
                  <div className="space-y-1">
                    <div className="mb-2 text-[11px] text-slate-500">{individuals.length} record(s){indStageFilter !== "all" ? ` · ${indStageFilter}` : ""}</div>
                    {individuals.map((ind) => (
                      <button
                        key={ind.persona_id}
                        onClick={() => setSelectedIndividual(ind)}
                        className="flex w-full items-center justify-between rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2 text-left hover:border-slate-700 hover:bg-slate-900/60"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Badge variant="outline"
                            className={`capitalize text-[11px] shrink-0 ${STAGE_COLORS[ind.stage] ?? "border-slate-700 text-slate-400"}`}>
                            {ind.stage}
                          </Badge>
                          <div className="min-w-0">
                            {ind.crm?.display_name ? (
                              <div className="text-xs text-slate-200 truncate">{ind.crm.display_name}</div>
                            ) : null}
                            <div className="text-[11px] text-slate-500 font-mono truncate">
                              {ind.crm?.fio_handle ?? ind.persona_id.slice(0, 12) + "…"}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {(() => {
                            const isKnyt = (tenantId === "nakamoto" || !tenantId);
                            const stageToIdx = isKnyt ? KNYT_STAGE_TO_IDX : METAME_STAGE_TO_IDX;
                            const xi = stageToIdx[ind.stage] ?? 0;
                            const yi = DEPTH_TO_Y_ESTIMATE[ind.depth] ?? 0;
                            return (
                              <span className="font-mono text-[11px] font-bold text-amber-300/80" title="Matrix position (X=sovereignty, Y=PCS ~est)">
                                {gridRef(xi, yi)}
                              </span>
                            );
                          })()}
                          <span className="text-[11px] text-slate-500">{ind.depth}</span>
                          {ind.nbe && (
                            <Badge variant="outline"
                              className={`capitalize text-[11px] ${DISPOSITION_COLORS[ind.nbe.disposition] ?? "border-slate-700"}`}>
                              {ind.nbe.disposition}
                            </Badge>
                          )}
                          <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
                        </div>
                      </button>
                    ))}
                  </div>
                ) : loading ? (
                  <div className="text-slate-400">Loading individuals…</div>
                ) : (
                  <div className="space-y-3 py-2">
                    <div className="text-slate-400 text-xs">No journey states found for {tenantId ?? "this tenant"}.</div>
                    {tenantId && (
                      <Button variant="outline" size="sm" onClick={() => void syncCRM("individual")}
                        disabled={syncing} className="h-7 gap-1.5 text-xs border-violet-500/40 text-violet-300 hover:text-violet-200">
                        <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
                        {syncing ? "Syncing…" : "Sync CRM to seed journey states"}
                      </Button>
                    )}
                    <div className="text-[11px] text-slate-600">Run DB migration first, then use Sync CRM to seed journey states from CRM personas.</div>
                  </div>
                )}
                {/* Experience Matrix — individual positioning reference */}
                {franchise && (
                  <div className="mt-3">
                    <MatrixMiniPanel
                      tenantId={tenantId}
                      stageDistribution={franchise.stage_distribution}
                      depthDistribution={franchise.depth_distribution}
                      totalJourneys={franchise.total_journeys}
                      onStageClick={(stage) => {
                        setIndStageFilter(stage);
                        void fetchView("individual", { stage });
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        {/* COD-306 — Admin NBE Planner */}
        <TabsContent value="nbe">
          <div className={base}>
            {nbeData ? (
              <div className="space-y-4">
                {/* Active strategies */}
                {nbeData.strategies.length > 0 && (
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Active Strategies</div>
                    <div className="flex gap-2 flex-wrap">
                      {nbeData.strategies.map((s) => (
                        <div key={s.id} className="rounded-lg border border-violet-500/30 bg-violet-500/5 px-3 py-1.5">
                          <div className="text-xs font-semibold text-violet-300">{s.name}</div>
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {s.target_segments.map((seg) => (
                              <span key={seg} className="text-[10px] text-slate-400">{seg}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* NBE plan list — COD-307 analysis cards */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Active Plans ({nbeData.plans.length})
                    </div>
                  </div>
                  {nbeData.plans.length > 0 ? (
                    <div className="space-y-2">
                      {nbeData.plans.map((plan, i) => (
                        <div key={i} className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline"
                              className={`capitalize text-[11px] ${DISPOSITION_COLORS[plan.disposition] ?? "border-slate-700"}`}>
                              {plan.disposition}
                            </Badge>
                            {plan.next_experience_depth && (
                              <Badge variant="outline" className="border-violet-500/40 text-violet-300 text-[11px]">
                                → {plan.next_experience_depth}
                              </Badge>
                            )}
                            <span className="text-[11px] text-slate-500 font-mono">{plan.persona_id.slice(0, 8)}…</span>
                          </div>
                          {plan.rationale && (
                            <div className="text-xs text-slate-300">{plan.rationale}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-slate-400 text-xs">No active NBE plans. Plans are created by the orchestration engine or manually via the NBE planning API.</div>
                  )}
                </div>
              </div>
            ) : loading ? (
              <div className="text-slate-400">Loading NBE planner…</div>
            ) : (
              <div className="text-slate-400 text-xs">No NBE data. Run the DB migration and generate plans via the orchestration engine.</div>
            )}
            {/* Experience Matrix — NBE context */}
            {franchise && (
              <div className="mt-3">
                <MatrixMiniPanel
                  tenantId={tenantId}
                  stageDistribution={franchise.stage_distribution}
                  depthDistribution={franchise.depth_distribution}
                  totalJourneys={franchise.total_journeys}
                  onStageClick={(stage) => {
                    setIndStageFilter(stage);
                    setActiveView("individual");
                    void fetchView("individual", { stage });
                  }}
                />
              </div>
            )}
          </div>
        </TabsContent>

        {/* COD-504 — Investor reactivation view */}
        <TabsContent value="reactivation" className="mt-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-200">Investor Reactivation</div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Journeys stalled at <span className="text-amber-400 font-mono">first</span> or{" "}
                  <span className="text-amber-400 font-mono">zero</span> stage eligible for reactivation outreach.
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => { void fetchView("franchise"); void fetchView("individual"); }}
              >
                <RefreshCw className="h-3 w-3 mr-1" /> Refresh
              </Button>
            </div>

            {/* Stalled investor summary from franchise data */}
            {franchise?.stage_distribution && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-amber-400" />
                  <span className="text-xs font-semibold text-amber-300">Late-Stage Stalled</span>
                </div>
                <div className="flex gap-3">
                  {["first", "zero"].map((stage) => {
                    const count = (franchise.stage_distribution as Record<string, number>)[stage] ?? 0;
                    return (
                      <div key={stage} className="rounded border border-slate-800 bg-slate-900/60 px-4 py-2 text-center">
                        <div className="text-lg font-bold text-slate-100">{count}</div>
                        <div className="text-[11px] text-slate-400 capitalize">{stage} stage</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Individual stalled journeys */}
            {individuals.filter((p) => p.stage === "first" || p.stage === "zero").length > 0 ? (
              <div className="space-y-2">
                {individuals
                  .filter((p) => p.stage === "first" || p.stage === "zero")
                  .map((p) => (
                    <div
                      key={p.persona_id}
                      className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-slate-300">{p.persona_id.slice(0, 12)}…</span>
                          <Badge
                            variant="outline"
                            className="border-amber-500/40 text-amber-300 capitalize text-[11px]"
                          >
                            {p.stage}
                          </Badge>
                          <Badge variant="outline" className="border-slate-700 text-slate-400 text-[11px]">
                            {p.depth}
                          </Badge>
                        </div>
                        {p.active_at && (
                          <div className="text-[11px] text-slate-500">
                            Last active:{" "}
                            {new Date(p.active_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </div>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
                        onClick={() => {
                          // COD-504 stub — emits investor_reactivation telemetry via NBE engine
                          fetch("/api/orchestration/reactivate", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ persona_id: p.persona_id }),
                          }).catch(() => {});
                        }}
                      >
                        Flag for Reactivation
                      </Button>
                    </div>
                  ))}
              </div>
            ) : loading ? (
              <div className="text-slate-400 text-xs">Loading reactivation candidates…</div>
            ) : (
              <div className="text-slate-400 text-xs">
                No stalled investor journeys found. Reactivation candidates appear when personas reach{" "}
                <span className="font-mono text-amber-400">first</span> or{" "}
                <span className="font-mono text-amber-400">zero</span> stage without progressing.
              </div>
            )}
          </div>
        </TabsContent>

        {/* Guardian view — grounded in visible experience state */}
        <TabsContent value="guardian" className="mt-4">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-emerald-400" />
              <div>
                <div className="text-sm font-semibold text-slate-200">Guardian State</div>
                <div className="text-xs text-slate-400 mt-0.5">
                  metaMe guardian recommendation inputs — grounded in live experience state.
                </div>
              </div>
            </div>

            {/* Franchise-level guardian inputs */}
            {franchise ? (
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Franchise Health Signal
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-center">
                    <div className="text-2xl font-bold text-slate-100">{franchise.total_journeys}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Total journeys</div>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-center">
                    <div className="text-2xl font-bold text-amber-300">
                      {(franchise.stage_distribution?.["first"] ?? 0) + (franchise.stage_distribution?.["zero"] ?? 0)}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Late-stage stalled</div>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-center">
                    <div className="text-2xl font-bold text-violet-300">{franchise.nbe_opportunities.length}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Active NBE opportunities</div>
                  </div>
                </div>

                {/* Stage funnel health — guardian policy view */}
                <div>
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Stage Funnel (Guardian Policy Input)
                  </div>
                  <div className="flex gap-1 items-end flex-wrap">
                    {["prospect", "acolyte", "keta", "keji", "first", "zero"].map((stage) => {
                      const count = franchise.stage_distribution?.[stage] ?? 0;
                      const total = franchise.total_journeys || 1;
                      const pct = Math.round((count / total) * 100);
                      return (
                        <div key={stage} className="flex flex-col items-center gap-1">
                          <div className="text-[10px] text-slate-400">{count}</div>
                          <div
                            className={`w-8 rounded-t-sm ${STAGE_COLORS[stage]?.includes("violet") ? "bg-violet-500/40" : STAGE_COLORS[stage]?.includes("emerald") ? "bg-emerald-500/40" : STAGE_COLORS[stage]?.includes("amber") ? "bg-amber-500/40" : "bg-slate-700"}`}
                            style={{ height: `${Math.max(4, pct * 0.6)}px` }}
                          />
                          <div className="text-[9px] text-slate-500 capitalize">{stage}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}

            {/* Per-persona guardian recommendation preview */}
            {individuals.length > 0 && (
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Recommendation Inputs (per persona)
                </div>
                <div className="space-y-2">
                  {individuals.slice(0, 5).map((ind) => {
                    const trustNormalized = ind.trust_scores
                      ? [ind.trust_scores.goal_alignment, ind.trust_scores.stage_readiness, ind.trust_scores.nbe_confidence]
                          .filter((s) => s != null)
                          .reduce((acc, s, _, arr) => acc + (s ?? 0) / arr.length, 0)
                      : null;
                    const guardianDisposition =
                      ind.nbe?.disposition === "escalate" ? "🔴 ESCALATE"
                      : ind.nbe?.disposition === "deny" ? "🔴 BLOCK"
                      : trustNormalized != null && trustNormalized < 40 ? "⚠️ REVIEW"
                      : ind.nbe?.disposition === "act" ? "✅ APPROVE"
                      : "⏸ WAIT";
                    return (
                      <div key={ind.persona_id}
                        className="grid gap-2 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2"
                        style={{ gridTemplateColumns: "1fr 80px 80px 100px" }}>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`capitalize text-[11px] ${STAGE_COLORS[ind.stage] ?? "border-slate-700 text-slate-400"}`}>
                            {ind.stage}
                          </Badge>
                          <span className="font-mono text-[11px] text-slate-500">{ind.persona_id.slice(0, 8)}…</span>
                        </div>
                        <div className="text-center text-[11px] text-slate-400">
                          {ind.depth}
                        </div>
                        <div className="text-center text-[11px]">
                          {trustNormalized != null
                            ? <span className={trustNormalized >= 70 ? "text-emerald-300" : trustNormalized >= 40 ? "text-amber-300" : "text-rose-300"}>
                                {Math.round(trustNormalized)}%
                              </span>
                            : <span className="text-slate-600">—</span>}
                        </div>
                        <div className="text-right text-[11px] font-mono">{guardianDisposition}</div>
                      </div>
                    );
                  })}
                  {individuals.length > 5 && (
                    <div className="text-[11px] text-slate-500 text-center">
                      +{individuals.length - 5} more — switch to Individual tab to inspect
                    </div>
                  )}
                </div>
                <div className="text-[10px] text-slate-600">
                  Guardian disposition: ESCALATE/DENY from active NBE plan · REVIEW from trust score &lt;40% · APPROVE from act disposition · WAIT otherwise
                </div>
              </div>
            )}

            {!franchise && !loading && (
              <div className="text-slate-400 text-xs">
                No experience state loaded. Run the DB migration and seed journey states.
              </div>
            )}
            {loading && <div className="text-slate-400 text-xs">Loading guardian state…</div>}
          </div>
        </TabsContent>
      </Tabs>
      <CodexCopilotLayer
        isOpen={copilotOpen}
        onClose={() => setCopilotOpen(false)}
        onOpen={() => setCopilotOpen(true)}
        variant="floating"
        enableInferenceRendering
        personaId={personaId}
        contextId="knyt-experience"
        messages={copilotMessages}
        onMessagesChange={setCopilotMessages}
      />
    </div>
  );
}

export default ExperienceDashboardTab;
