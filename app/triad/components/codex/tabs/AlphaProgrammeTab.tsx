"use client";

/**
 * AlphaProgrammeTab — Venture Lab α programme status dashboard
 *
 * Live panels on top of the four-workstream programme plan (doc 33):
 *   - Workstream status grid (hardcoded from canonical doc 33 + live signal overlay)
 *   - Qriptopian signal metrics (community engagement pulse)
 *   - KNYT participation stats (org-level)
 *   - Critical path progress indicator
 *
 * Does NOT replace the doc browser — links to the Venture Lab α docs tab
 * for the full 23-doc planning corpus.
 */

import { useCallback, useEffect, useState } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  Lock,
  RefreshCw,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SignalSummary {
  totalLikes: number;
  totalSparks: number;
  totalCurations: number;
}

interface OrgStats {
  totalRewardGrants: number;
  totalQcEvents: number;
  totalReceipts: number;
  provisionalGrants: number;
  finalizedGrants: number;
}

interface PolicyTargets {
  trustThresholdMin?: number;
  skillBudgetPosture?: string;
  nativeAssetExposure?: string;
  requiredReceipts?: string[];
}

interface OrgPolicy {
  orgId: string;
  policyName: string;
  allowedAgents: string[];
  allowedSkills: string[];
  allowedCartridges: string[];
  trustThresholdMin: number;
  skillBudgetPosture: string;
  nativeAssetExposure: string;
  requiredReceipts: string[];
  active: boolean;
  targets?: PolicyTargets;
}

// ─── OrgQube Policy panel ─────────────────────────────────────────────────────

const POSTURE_STYLES: Record<string, string> = {
  open:         "border-emerald-500/30 text-emerald-300 bg-emerald-500/10",
  conservative: "border-amber-500/30 text-amber-300 bg-amber-500/10",
  strict:       "border-red-500/30 text-red-300 bg-red-500/10",
};
const EXPOSURE_STYLES: Record<string, string> = {
  none:    "border-slate-600/40 text-slate-400 bg-slate-500/10",
  limited: "border-amber-500/30 text-amber-300 bg-amber-500/10",
  full:    "border-orange-500/30 text-orange-300 bg-orange-500/10",
};

function GlassTile({ label, accent, children }: { label: string; accent?: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-xl border p-3 space-y-2 backdrop-blur-sm ${accent ?? "border-white/[0.07] bg-white/[0.03]"}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      {children}
    </div>
  );
}

function TargetArrow({ current, target, styles }: { current: string; target?: string; styles: Record<string, string> }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Badge variant="outline" className={`text-[10px] font-medium capitalize backdrop-blur-sm ${styles[current] ?? styles.open}`}>{current}</Badge>
      {target && target !== current && (
        <>
          <span className="text-[9px] text-slate-600">→</span>
          <Badge variant="outline" className={`text-[10px] font-medium capitalize opacity-50 backdrop-blur-sm ${styles[target] ?? styles.open}`}>{target}</Badge>
        </>
      )}
    </div>
  );
}

function OrgPolicyPanel({ policy, isDefault, loading }: {
  policy: OrgPolicy | null;
  isDefault: boolean;
  loading: boolean;
}) {
  if (loading) return <div className="text-xs text-slate-500 py-3 text-center">Loading policy…</div>;
  if (!policy)  return <div className="text-xs text-slate-500 py-3 text-center">No policy configured.</div>;

  const tgt            = policy.targets ?? {};
  const trustTarget    = tgt.trustThresholdMin ?? 70;
  const receipts       = policy.requiredReceipts.length ? policy.requiredReceipts : [];
  const targetReceipts = tgt.requiredReceipts ?? receipts;
  const addedReceipts  = targetReceipts.filter((r) => !receipts.includes(r));

  return (
    <div className="space-y-3">
      {/* Policy name + status */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-slate-200">{policy.policyName}</span>
        {isDefault && <Badge variant="outline" className="text-[9px] border-white/10 bg-white/[0.04] text-slate-500 backdrop-blur-sm">alpha defaults</Badge>}
        <Badge variant="outline" className={`text-[9px] backdrop-blur-sm ${policy.active ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-red-500/30 bg-red-500/10 text-red-400"}`}>
          {policy.active ? "active" : "inactive"}
        </Badge>
      </div>

      {/* Trust floor — 0-100 gauge with target marker */}
      <GlassTile label="Trust Floor" accent="border-amber-500/20 bg-amber-500/[0.06] backdrop-blur-sm">
        <div className="flex items-baseline justify-between">
          <div>
            <span className="text-xl font-bold text-amber-300">{policy.trustThresholdMin}</span>
            <span className="text-[10px] text-slate-500 ml-1.5">actual</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-slate-500">target </span>
            <span className="text-base font-semibold text-amber-400/70">{trustTarget}</span>
            <span className="text-[10px] text-slate-600 ml-0.5">/ 100</span>
          </div>
        </div>
        {/* 0-100 gauge track with target marker pin */}
        <div className="relative w-full h-2 rounded-full bg-slate-800/80 overflow-visible">
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-amber-500/80"
            style={{ width: `${policy.trustThresholdMin}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-px h-4 bg-amber-400/50"
            style={{ left: `${trustTarget}%` }}
          />
        </div>
        <div className="flex justify-between text-[9px] text-slate-600">
          <span>0</span>
          <span className="text-amber-600/60">▲ target {trustTarget}</span>
          <span>100</span>
        </div>
        <div className="text-[9px] text-amber-900/80">Experimental phase — hardening toward {trustTarget} as agents and skills mature</div>
      </GlassTile>

      {/* Posture + Exposure */}
      <div className="grid grid-cols-2 gap-2">
        <GlassTile label="Skill Budget Posture" accent="border-emerald-500/15 bg-emerald-500/[0.04] backdrop-blur-sm">
          <TargetArrow current={policy.skillBudgetPosture} target={tgt.skillBudgetPosture} styles={POSTURE_STYLES} />
        </GlassTile>
        <GlassTile label="Asset Exposure" accent="border-sky-500/15 bg-sky-500/[0.04] backdrop-blur-sm">
          <TargetArrow current={policy.nativeAssetExposure} target={tgt.nativeAssetExposure} styles={EXPOSURE_STYLES} />
        </GlassTile>
      </div>

      {/* Required receipts — all material CRUD state changes */}
      <GlassTile label="Required Receipts — material state changes" accent="border-sky-500/15 bg-sky-500/[0.03] backdrop-blur-sm">
        <div className="flex flex-wrap gap-1">
          {receipts.length ? receipts.map((r) => (
            <span key={r} className="rounded-full border border-sky-500/25 bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-300/80 font-mono">{r}</span>
          )) : <span className="text-[10px] text-slate-600">none currently required</span>}
        </div>
        {addedReceipts.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5 border-t border-white/[0.05] mt-1">
            <span className="text-[9px] text-slate-600 self-center mr-0.5">target +</span>
            {addedReceipts.map((r) => (
              <span key={r} className="rounded-full border border-sky-500/15 bg-sky-500/[0.06] px-2 py-0.5 text-[10px] text-sky-400/50 font-mono">{r}</span>
            ))}
          </div>
        )}
      </GlassTile>

      {/* Allowed Agents + Lab Native Cartridges — side by side */}
      <div className="grid grid-cols-2 gap-2">
        <GlassTile label="Allowed Aigents" accent="border-violet-500/15 bg-violet-500/[0.04] backdrop-blur-sm">
          <div className="flex flex-wrap gap-1">
            {(policy.allowedAgents.length ? policy.allowedAgents : ["All"]).map((a) => (
              <span key={a} className="rounded-full border border-violet-500/25 bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-300/80">{a}</span>
            ))}
          </div>
        </GlassTile>
        <GlassTile label="Lab Native Cartridges" accent="border-emerald-500/15 bg-emerald-500/[0.04] backdrop-blur-sm">
          <div className="flex flex-wrap gap-1">
            {(policy.allowedCartridges.length ? policy.allowedCartridges : ["All"]).map((c) => (
              <span key={c} className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300/80">{c}</span>
            ))}
          </div>
        </GlassTile>
      </div>
    </div>
  );
}

// ─── Workstream definitions ────────────────────────────────────────────────────
// Six projects running through the Venture Lab α programme model.
// VL α is the programme frame — its infra readiness is the aggregate of all six.

type WsStatus = "complete" | "active" | "in-progress" | "queued";

const WORKSTREAMS: Array<{
  id: string;
  label: string;
  status: WsStatus;
  summary: string;
  link?: string;
  items: Array<{ text: string; done: boolean }>;
}> = [
  {
    id: "qriptopian",
    label: "Qriptopian",
    status: "complete",
    summary: "Live content cartridge — Terra feed, bidirectional KNYT signal, community engagement layer.",
    items: [
      { text: "Terra content feed live", done: true },
      { text: "KNYT signal routes wired", done: true },
      { text: "Bidirectional signal (outbound)", done: true },
      { text: "Trending badge + pulse banner", done: true },
      { text: "Signal aggregation API", done: true },
    ],
  },
  {
    id: "knyt-wheel",
    label: "KNYT Wheel",
    status: "active",
    summary: "Live campaign — KS launch, investor emails, cohort management, Marketa activation.",
    link: "/triad/embed/codex/venture-lab?tab=alpha-docs",
    items: [
      { text: "KS campaign live", done: true },
      { text: "Investor cohorts segmented", done: true },
      { text: "8-email funnel live (E1 → 3.2k contacts)", done: true },
      { text: "Marketa fully activated", done: true },
      { text: "DVN receipt layer", done: true },
      { text: "Webhook engagement tracking live", done: true },
      { text: "Partner activation (18 partners)", done: false },
    ],
  },
  {
    id: "metame",
    label: "metaMe",
    status: "in-progress",
    summary: "Runtime, studio, registry, experience and capsule delivery — personal sovereignty and intelligence surface.",
    items: [
      { text: "Runtime client built", done: true },
      { text: "Studio Composer", done: true },
      { text: "Registry integration", done: true },
      { text: "Experience + capsule delivery", done: true },
      { text: "Light mode (Parchment Intelligence)", done: true },
      { text: "metaMe guardian policy hook", done: true },
      { text: "Personal sovereignty settings UI", done: false },
    ],
  },
  {
    id: "agentiq-alpha",
    label: "AgentiQ α",
    status: "complete",
    summary: "Aigent, cartridge & iQube composition, Ingestion Factory, DVN, infrastructure, policy enforcement, SDK tier.",
    items: [
      { text: "Ingestion Factory pipeline", done: true },
      { text: "iQube composition layer", done: true },
      { text: "Agent personas + routing", done: true },
      { text: "DVN receipt infrastructure", done: true },
      { text: "OrgQube policy enforcement", done: true },
      { text: "SDK tier", done: true },
    ],
  },
  {
    id: "agentiq-os",
    label: "AgentiQ OS α",
    status: "in-progress",
    summary: "Open source sovereign framework and operating system underpinning the entire stack and ecosystem.",
    items: [
      { text: "23-doc planning corpus complete", done: true },
      { text: "Kn0w1-first KNYT Alpha shell", done: true },
      { text: "SkillQube + DataQube registry wired", done: true },
      { text: "Treasury / rewards MVP", done: false },
      { text: "Reference agent trio live", done: false },
    ],
  },
  {
    id: "relationship-builder",
    label: "Relationship Builder α",
    status: "active",
    summary: "7,000+ persona/investor backer CRM — 18-partner activation pipeline + KS backer cohorts.",
    items: [
      { text: "Docs + cartridge tab wired", done: true },
      { text: "QubeTalk feed live", done: true },
      { text: "DB migration + 18 partner seed", done: true },
      { text: "KS backer import + CSV upload endpoint", done: true },
      { text: "Partners + Customers UI (Phase 1)", done: true },
      { text: "Composer + Marketa send (Phase 2)", done: true },
      { text: "Partner Wave 1 activation", done: false },
    ],
  },
];

// VL α infrastructure readiness = aggregate of all workstream checklist items
const VL_INFRA_ITEMS = WORKSTREAMS.flatMap((ws) => ws.items);
const VL_INFRA_DONE  = VL_INFRA_ITEMS.filter((i) => i.done).length;
const VL_INFRA_PCT   = Math.round((VL_INFRA_DONE / VL_INFRA_ITEMS.length) * 100);

const STATUS_STYLES: Record<WsStatus, { badge: string; border: string; icon: typeof CheckCircle2; iconClass: string }> = {
  complete:    { badge: "border-emerald-700/60 text-emerald-300", border: "border-emerald-900/30", icon: CheckCircle2, iconClass: "text-emerald-400" },
  active:      { badge: "border-amber-700/60 text-amber-300",    border: "border-amber-900/30",   icon: Zap,          iconClass: "text-amber-400" },
  "in-progress": { badge: "border-sky-700/60 text-sky-300",      border: "border-sky-900/30",     icon: Clock,        iconClass: "text-sky-400" },
  queued:      { badge: "border-slate-700 text-slate-400",        border: "border-slate-800/50",   icon: Circle,       iconClass: "text-slate-600" },
};

const STATUS_LABEL: Record<WsStatus, string> = {
  complete:    "Complete",
  active:      "Active",
  "in-progress": "In Progress",
  queued:      "Queued",
};

// ─── Critical path (VL α gate sequence) ──────────────────────────────────────

const CRITICAL_PATH = [
  { text: "Qriptopian live + bidirectional signal",           done: true  },
  { text: "AgentiQ α platform complete",                     done: true  },
  { text: "KNYT Wheel operational",                          done: true  },
  { text: "Relationship Builder α cartridge wired",          done: true  },
  { text: "DB migration + partner seed + KS backer import",  done: true  },
  { text: "KS Backer email funnel active (8-email sequence)", done: true  },
  { text: "SkillQube / DataQube registry wired",             done: true  },
  { text: "Partner Wave 1 outreach launched (18 partners)",  done: false },
  { text: "Partner ignition signal (≥3 responded)",          done: false },
  { text: "AgentiQ OS α build gate open",                    done: false },
];

// ─── Main component ───────────────────────────────────────────────────────────

export function AlphaProgrammeTab() {
  const [signals,       setSignals]       = useState<SignalSummary | null>(null);
  const [orgStats,      setOrgStats]      = useState<OrgStats | null>(null);
  const [policy,        setPolicy]        = useState<OrgPolicy | null>(null);
  const [policyDefault, setPolicyDefault] = useState(false);
  const [loading,       setLoading]       = useState(true);
  const [policyLoading, setPolicyLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setPolicyLoading(true);
    try {
      const [sigRes, partRes, govRes] = await Promise.all([
        fetch("/api/codex/qriptopian/signal").catch(() => null),
        fetch("/api/codex/knyt/participation").catch(() => null),
        fetch("/api/codex/knyt/governance").catch(() => null),
      ]);
      if (sigRes?.ok) {
        const d = await sigRes.json();
        setSignals(d.data?.signalSummary ?? null);
      }
      if (partRes?.ok) {
        const d = await partRes.json();
        setOrgStats(d.data?.org ?? null);
      }
      if (govRes?.ok) {
        const d = await govRes.json();
        if (d.data?.policy) {
          setPolicy(d.data.policy);
          setPolicyDefault(d.data.isDefault ?? false);
        }
      }
    } finally {
      setLoading(false);
      setPolicyLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const doneCount   = CRITICAL_PATH.filter((i) => i.done).length;
  const totalCount  = CRITICAL_PATH.length;
  const pct         = Math.round((doneCount / totalCount) * 100);

  return (
    <div className="p-4 space-y-4">

      {/* Header */}
      <Card className="rounded-xl border border-amber-800/40 bg-amber-950/10">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-amber-500 mb-0.5">Programme Frame</p>
              <h2 className="text-xl font-semibold text-slate-100">Venture Lab α</h2>
              <p className="text-xs text-slate-400 mt-0.5">Six workstreams. One programme model.</p>
            </div>
            <div className="flex items-center flex-wrap gap-1.5">
              <Badge variant="outline" className="border-emerald-500/25 bg-emerald-500/10 text-emerald-300/80 backdrop-blur-sm text-[10px]">Qriptopian ✓</Badge>
              <Badge variant="outline" className="border-emerald-500/25 bg-emerald-500/10 text-emerald-300/80 backdrop-blur-sm text-[10px]">AgentiQ α ✓</Badge>
              <Badge variant="outline" className="border-amber-500/25 bg-amber-500/10 text-amber-300/80 backdrop-blur-sm text-[10px]">KNYT ✓</Badge>
              <Badge variant="outline" className="border-amber-500/25 bg-amber-500/10 text-amber-300/80 backdrop-blur-sm text-[10px]">Rel. Builder ✓</Badge>
              <Badge variant="outline" className="border-sky-500/25 bg-sky-500/10 text-sky-300/80 backdrop-blur-sm text-[10px]">metaMe</Badge>
              <Button
                size="sm" variant="ghost"
                className="h-7 w-7 p-0"
                onClick={() => void load()}
                disabled={loading}
              >
                <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
          {/* VL α infrastructure readiness bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-slate-500 uppercase tracking-wide font-semibold">Infrastructure Readiness</span>
              <span className="text-amber-400 font-semibold">{VL_INFRA_DONE}/{VL_INFRA_ITEMS.length} · {VL_INFRA_PCT}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${VL_INFRA_PCT}%` }} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Live metrics bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { label: "Qriptopian Values",  value: loading ? "…" : (signals?.totalLikes ?? 0),       accent: "text-emerald-300" },
          { label: "Qriptopian Sparks",  value: loading ? "…" : (signals?.totalSparks ?? 0),      accent: "text-amber-300" },
          { label: "KNYT Receipts",      value: loading ? "…" : (orgStats?.totalReceipts ?? 0),   accent: "text-sky-300" },
          { label: "KNYT Qc Events",     value: loading ? "…" : (orgStats?.totalQcEvents ?? 0),   accent: "text-violet-300" },
        ].map(({ label, value, accent }) => (
          <div key={label} className="rounded-lg border border-slate-800 bg-slate-900/50 p-2.5 text-center">
            <div className={`text-lg font-bold leading-none ${accent}`}>{value}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Signal pulse */}
      {signals && (signals.totalLikes + signals.totalSparks) > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-orange-400/20 bg-orange-500/[0.06] px-3 py-2">
          <TrendingUp className="h-3.5 w-3.5 text-orange-400 flex-shrink-0" />
          <span className="text-[11px] text-orange-300 font-medium">
            Qriptopian community active — {signals.totalLikes + signals.totalSparks} engagement signals recorded
          </span>
        </div>
      )}

      {/* Workstream status grid */}
      <div className="space-y-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Programme Workstreams</h3>
        <div className="grid grid-cols-2 gap-2">
        {WORKSTREAMS.map((ws) => {
          const style = STATUS_STYLES[ws.status];
          const Icon  = style.icon;
          const doneItems = ws.items.filter((i) => i.done).length;
          return (
            <div key={ws.id} className={`rounded-xl border ${style.border} bg-slate-950/40 p-3 space-y-2`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className={`h-4 w-4 flex-shrink-0 ${style.iconClass}`} />
                  <span className="text-xs font-semibold text-slate-100">{ws.label}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {ws.link && (
                    <a
                      href={ws.link}
                      className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] text-amber-400/70 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                      title="Open in codex"
                    >
                      <ArrowUpRight className="h-3 w-3" />
                    </a>
                  )}
                  <Badge variant="outline" className={`text-[9px] ${style.badge}`}>
                    {STATUS_LABEL[ws.status]}
                  </Badge>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 leading-snug">{ws.summary}</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      ws.status === "complete" ? "bg-emerald-500"
                      : ws.status === "active" ? "bg-amber-500"
                      : ws.status === "in-progress" ? "bg-sky-500"
                      : "bg-slate-700"
                    }`}
                    style={{ width: `${ws.items.length ? (doneItems / ws.items.length) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-500 shrink-0">{doneItems}/{ws.items.length}</span>
              </div>
            </div>
          );
        })}
        </div>
      </div>

      {/* Critical path */}
      <div className="rounded-xl border border-slate-800/60 bg-slate-950/30 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Critical Path</h3>
          <span className="text-[10px] text-slate-500">{doneCount}/{totalCount} · {pct}%</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
          <div className="h-full rounded-full bg-amber-500" style={{ width: `${pct}%` }} />
        </div>
        <div className="space-y-1.5">
          {CRITICAL_PATH.map(({ text, done }) => (
            <div key={text} className="flex items-start gap-2 text-[11px]">
              {done
                ? <CheckCircle2 className="h-3 w-3 text-emerald-400 mt-0.5 flex-shrink-0" />
                : <Circle className="h-3 w-3 text-slate-700 mt-0.5 flex-shrink-0" />}
              <span className={done ? "text-slate-400 line-through" : "text-slate-300"}>{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* OrgQube governance */}
      <div className="rounded-xl border border-slate-800/60 bg-slate-950/30 p-3 space-y-3">
        <div className="flex items-center gap-2">
          <Lock className="h-3.5 w-3.5 text-slate-500" />
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Institutional Governance</h3>
        </div>
        <OrgPolicyPanel policy={policy} isDefault={policyDefault} loading={policyLoading} />
      </div>

      {/* Link to full docs */}
      <div className="text-center">
        <p className="text-[10px] text-slate-600">
          Full 23-doc planning corpus in the Venture Lab α docs tab · Governance detail in the Institutional Governance panel above
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 text-slate-600 text-xs pt-2">
          <Loader2 className="h-3 w-3 animate-spin" />
          Loading live metrics…
        </div>
      )}
    </div>
  );
}
