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
}

// ─── OrgQube Policy panel ─────────────────────────────────────────────────────

const POSTURE_STYLES: Record<string, string> = {
  open:         "border-emerald-800/40 text-emerald-300",
  conservative: "border-amber-800/40 text-amber-300",
  strict:       "border-red-800/40 text-red-300",
};
const EXPOSURE_STYLES: Record<string, string> = {
  none:    "border-slate-700 text-slate-400",
  limited: "border-amber-800/40 text-amber-300",
  full:    "border-orange-800/40 text-orange-300",
};

function OrgPolicyPanel({ policy, isDefault, loading }: {
  policy: OrgPolicy | null;
  isDefault: boolean;
  loading: boolean;
}) {
  if (loading) return <div className="text-xs text-slate-500 py-3 text-center">Loading policy…</div>;
  if (!policy)  return <div className="text-xs text-slate-500 py-3 text-center">No policy configured.</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-slate-200">{policy.policyName}</span>
        {isDefault && <Badge variant="outline" className="text-[9px] border-slate-700 text-slate-500">alpha defaults</Badge>}
        <Badge variant="outline" className={`text-[9px] ${policy.active ? "border-emerald-800/40 text-emerald-400" : "border-red-800/40 text-red-400"}`}>
          {policy.active ? "active" : "inactive"}
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Skill Budget Posture", render: <Badge variant="outline" className={`text-[10px] font-medium capitalize ${POSTURE_STYLES[policy.skillBudgetPosture] ?? POSTURE_STYLES.open}`}>{policy.skillBudgetPosture}</Badge> },
          { label: "Asset Exposure",       render: <Badge variant="outline" className={`text-[10px] font-medium capitalize ${EXPOSURE_STYLES[policy.nativeAssetExposure] ?? EXPOSURE_STYLES.none}`}>{policy.nativeAssetExposure}</Badge> },
          { label: "Trust Floor",          render: <span className="text-sm font-bold text-slate-200">{policy.trustThresholdMin}<span className="text-[10px] text-slate-500 ml-0.5">/ 100</span></span> },
          { label: "Required Receipts",    render: <span className="text-sm font-bold text-slate-200">{policy.requiredReceipts.length}</span> },
        ].map(({ label, render }) => (
          <div key={label} className="rounded-lg border border-slate-800 bg-slate-900/50 p-2.5 space-y-0.5">
            <div className="text-[10px] text-slate-500">{label}</div>
            {render}
          </div>
        ))}
      </div>
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Allowed Agents</div>
        <div className="flex flex-wrap gap-1">
          {(policy.allowedAgents.length ? policy.allowedAgents : ["All agents"]).map((a) => (
            <span key={a} className="rounded-full border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[10px] text-slate-300">{a}</span>
          ))}
        </div>
      </div>
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Allowed Cartridges</div>
        <div className="flex flex-wrap gap-1">
          {(policy.allowedCartridges.length ? policy.allowedCartridges : ["All cartridges"]).map((c) => (
            <span key={c} className="rounded-full border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[10px] text-slate-300">{c}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Workstream definitions (canonical from doc 33) ───────────────────────────

type WsStatus = "complete" | "active" | "in-progress" | "queued";

const WORKSTREAMS: Array<{
  id: string;
  label: string;
  status: WsStatus;
  summary: string;
  items: Array<{ text: string; done: boolean }>;
}> = [
  {
    id: "agentiq-alpha",
    label: "AgentiQ Alpha",
    status: "complete",
    summary: "Platform foundation — registry, runtime, studio, SDK, experience model, capsule delivery.",
    items: [
      { text: "Registry pipeline", done: true },
      { text: "KNYT signal routes", done: true },
      { text: "Experience model + matrix", done: true },
      { text: "Agent personas + routing", done: true },
      { text: "SmartTriad copilot", done: true },
      { text: "KNYT Runtime Surface", done: true },
    ],
  },
  {
    id: "knyt-wheel",
    label: "KNYT Wheel",
    status: "active",
    summary: "Live campaign — KS launch, investor emails, cohort management, Marketa activation.",
    items: [
      { text: "KS campaign live", done: true },
      { text: "Investor cohorts segmented", done: true },
      { text: "Email sequences sent", done: true },
      { text: "Marketa fully activated", done: true },
      { text: "Partner activation (18 partners)", done: false },
    ],
  },
  {
    id: "relationship-builder",
    label: "Relationship Builder α",
    status: "in-progress",
    summary: "Partner + customer activation surface — 18-partner pipeline + 3,748-person investor/backer CRM.",
    items: [
      { text: "Docs + cartridge tab wired", done: true },
      { text: "QubeTalk feed live", done: true },
      { text: "DB migration + partner seed", done: false },
      { text: "KS backer import", done: false },
      { text: "Partners + Customers UI (Phase 1)", done: false },
      { text: "Composer + Marketa send (Phase 2)", done: false },
    ],
  },
  {
    id: "venture-lab",
    label: "Venture Lab α",
    status: "queued",
    summary: "Next-phase engine — metaMe / AgentiQ OS, reference agents, KNYT cartridge pair, treasury/rewards.",
    items: [
      { text: "23-doc planning corpus complete", done: true },
      { text: "Kn0w1-first KNYT Alpha shell", done: false },
      { text: "Treasury / rewards MVP", done: false },
      { text: "OrgQube policy layer", done: false },
      { text: "Qriptopian bidirectional signal", done: true },
      { text: "DVN receipt layer", done: true },
    ],
  },
];

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

// ─── Critical path items (from doc 33) ────────────────────────────────────────

const CRITICAL_PATH = [
  { text: "AgentiQ Alpha complete",                          done: true },
  { text: "KNYT Wheel operational",                          done: true },
  { text: "Relationship Builder α docs + cartridge wired",   done: true },
  { text: "DB migration + partner seed + KS backer import",  done: false },
  { text: "Partner Wave 1 outreach launched (16 partners)",  done: false },
  { text: "KS Backer email funnel active",                    done: false },
  { text: "Partner Wave 1 ignition signal (≥3 responded)",   done: false },
  { text: "Campaign momentum → Venture Lab α build starts",  done: false },
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
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-amber-500 mb-0.5">Programme Status</p>
            <h2 className="text-xl font-semibold text-slate-100">AgentiQ α Programme</h2>
            <p className="text-xs text-slate-400 mt-0.5">Four workstreams. One system.</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="border-emerald-800 bg-emerald-950 text-emerald-300">WS1 Complete</Badge>
            <Badge className="border-amber-800 bg-amber-950 text-amber-300">WS2 Active</Badge>
            <Button
              size="sm" variant="ghost"
              className="h-7 w-7 p-0"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            </Button>
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
        <h3 className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Workstreams</h3>
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
                <Badge variant="outline" className={`text-[9px] shrink-0 ${style.badge}`}>
                  {STATUS_LABEL[ws.status]}
                </Badge>
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
          Full 23-doc planning corpus in the Venture Lab α docs tab · Programme detail in α Programme tab
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
