"use client";

/**
 * AgentiQOSTab — AgentiQ OS command center dashboard
 *
 * Composes live data from the registry, factory, and receipt APIs into a
 * single orchestrated view. Does NOT recreate RegistrySupplyTab or
 * FactoryIntakeTab — those remain the full browsing surfaces; this is the
 * summary/status layer that gives operators and builders a quick read on
 * the substrate health and directs them to the right deeper surface.
 *
 * Reads from:
 *   GET /api/registry/assets?assetClass=AigentQube&publicationStatus=published
 *   GET /api/registry/assets?assetClass=SkillQube&publicationStatus=published
 *   GET /api/registry/intake?tenantId=platform
 */

import { useCallback, useEffect, useState } from "react";
import {
  Badge
} from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Box,
  Brain,
  Cable,
  CheckCircle2,
  ChevronRight,
  Cpu,
  Factory,
  GitBranch,
  RefreshCw,
  ShieldCheck,
  Workflow,
  Wrench,
  Zap,
} from "lucide-react";
import {
  TRUST_BAND_LABELS,
  type TrustBand,
} from "@/types/registryIngestion";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Asset {
  assetId: string;
  assetClass: string;
  name: string;
  description?: string;
  trustBand: string;
  publicationStatus: string;
  metadata?: Record<string, unknown>;
  capabilities?: Array<{ name: string; scope: string }>;
  currentVersion?: string;
}

interface Intake {
  id: string;
  status: string;
  currentStage: string;
  createdAt: string;
}

// ─── Style helpers ────────────────────────────────────────────────────────────

const TRUST_STYLES: Record<string, string> = {
  L1_EXPERIMENTAL:         "border-slate-500 text-slate-300",
  L2_VERIFIED_COMMUNITY:   "border-blue-400/70 text-blue-200",
  L3_PRODUCTION_CANDIDATE: "border-emerald-400/70 text-emerald-200",
  L4_PRODUCTION_APPROVED:  "border-cyan-400/70 text-cyan-200",
  L5_CORE_SOVEREIGN:       "border-amber-400/80 text-amber-200",
};

function trustStyle(band: string) {
  return TRUST_STYLES[band] ?? "border-slate-700 text-slate-400";
}

function trustLabel(band: string) {
  return TRUST_BAND_LABELS[band as TrustBand] ?? band;
}

// ─── Stat tile ────────────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  accent,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  accent: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className={`rounded-xl border ${accent} bg-slate-950/60 p-4 flex items-center gap-3`}>
      <Icon className="h-5 w-5 shrink-0 opacity-70" />
      <div>
        <div className="text-xl font-bold text-slate-100 leading-none">{value}</div>
        <div className="text-[11px] text-slate-400 mt-0.5">{label}</div>
      </div>
    </div>
  );
}

// ─── Agent card ───────────────────────────────────────────────────────────────

function AgentCard({ agent }: { agent: Asset }) {
  const badge = (agent.metadata?.badge as string) ?? agent.name.charAt(0).toUpperCase();
  const caps = (agent.capabilities ?? []) as Array<{ name: string; scope: string }>;
  return (
    <div className="rounded-xl border border-amber-900/30 bg-amber-950/10 p-3 flex gap-3">
      <div className="h-9 w-9 shrink-0 rounded-full border border-amber-700/50 bg-amber-900/30 flex items-center justify-center text-sm font-bold text-amber-300">
        {badge}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-slate-100 truncate">{agent.name}</span>
          <Badge variant="outline" className={`text-[10px] ${trustStyle(agent.trustBand)}`}>
            <ShieldCheck className="h-2.5 w-2.5 mr-1" />
            {trustLabel(agent.trustBand)}
          </Badge>
        </div>
        {agent.description && (
          <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{agent.description}</p>
        )}
        {caps.length > 0 && (
          <div className="flex gap-1 flex-wrap mt-1.5">
            {caps.slice(0, 4).map((c) => (
              <span
                key={c.name}
                className="rounded-full border border-slate-700 bg-slate-800/60 px-1.5 py-0.5 text-[9px] text-slate-400"
              >
                {c.name}
              </span>
            ))}
            {caps.length > 4 && (
              <span className="text-[9px] text-slate-600 self-center">+{caps.length - 4}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Skill row ────────────────────────────────────────────────────────────────

function SkillRow({ skill }: { skill: Asset }) {
  const priceQc = (skill.metadata?.pricingQc as number | undefined) ?? 0;
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-slate-800/60 last:border-0">
      <div className="min-w-0">
        <span className="text-xs font-medium text-slate-200 truncate block">{skill.name}</span>
        {skill.description && (
          <span className="text-[11px] text-slate-500 line-clamp-1">{skill.description}</span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge variant="outline" className={`text-[10px] ${trustStyle(skill.trustBand)}`}>
          {trustLabel(skill.trustBand)}
        </Badge>
        <span className="text-[10px] text-slate-500 font-mono">{priceQc} Q¢</span>
      </div>
    </div>
  );
}

// ─── Contribution type card ───────────────────────────────────────────────────

const CONTRIBUTION_TYPES = [
  {
    label: "ToolQube",
    icon: Wrench,
    accent: "border-sky-900/40 bg-sky-950/10 text-sky-300",
    desc: "Standalone capability — API wrappers, AI models, data processors, analysis engines.",
  },
  {
    label: "SkillQube",
    icon: Cpu,
    accent: "border-indigo-900/40 bg-indigo-950/10 text-indigo-300",
    desc: "Atomic workflow step — classification, generation, summarization, transformation.",
  },
  {
    label: "WorkflowQube",
    icon: Workflow,
    accent: "border-orange-900/40 bg-orange-950/10 text-orange-300",
    desc: "Multi-step orchestration — a sequence of tools and skills with defined I/O.",
  },
  {
    label: "ConnectorQube",
    icon: Cable,
    accent: "border-teal-900/40 bg-teal-950/10 text-teal-300",
    desc: "Integration bridge — connects external systems, data sources, or services.",
  },
] as const;

// ─── Factory status helpers ───────────────────────────────────────────────────

const PIPELINE_STATUS_LABELS: Record<string, string> = {
  published:    "Published",
  scored:       "Trust Scored",
  review_pending: "In Review",
  received:     "Received",
  failed:       "Failed",
  rejected:     "Rejected",
};

const PIPELINE_STATUS_STYLES: Record<string, string> = {
  published:      "border-emerald-500/50 bg-emerald-500/10 text-emerald-300",
  scored:         "border-cyan-500/50 bg-cyan-500/10 text-cyan-300",
  review_pending: "border-amber-500/50 bg-amber-500/10 text-amber-300",
  received:       "border-blue-500/50 bg-blue-500/10 text-blue-300",
  failed:         "border-rose-500/50 bg-rose-500/10 text-rose-300",
  rejected:       "border-red-500/50 bg-red-500/10 text-red-300",
};

function groupByStatus(intakes: Intake[]): Record<string, number> {
  return intakes.reduce<Record<string, number>>((acc, i) => {
    acc[i.status] = (acc[i.status] ?? 0) + 1;
    return acc;
  }, {});
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AgentiQOSTab() {
  const [agents, setAgents]       = useState<Asset[]>([]);
  const [skills, setSkills]       = useState<Asset[]>([]);
  const [intakes, setIntakes]     = useState<Intake[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [agentsRes, skillsRes, intakesRes] = await Promise.all([
        fetch("/api/registry/assets?assetClass=AigentQube&publicationStatus=published&tenantId=platform&limit=20"),
        fetch("/api/registry/assets?assetClass=SkillQube&publicationStatus=published&tenantId=platform&limit=50"),
        fetch("/api/registry/intake?tenantId=platform").catch(() => null), // non-critical
      ]);

      if (agentsRes.ok) {
        const d = await agentsRes.json();
        setAgents(d.data ?? []);
      }
      if (skillsRes.ok) {
        const d = await skillsRes.json();
        setSkills(d.data ?? []);
      }
      if (intakesRes?.ok) {
        const d = await intakesRes.json();
        setIntakes(d.data ?? []);
      }
      setLastRefresh(new Date());
    } catch {
      setError("Failed to load registry data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const statusGroups = groupByStatus(intakes);
  const publishedCount = (statusGroups.published ?? 0);
  const pendingCount = intakes.length - publishedCount - (statusGroups.failed ?? 0) - (statusGroups.rejected ?? 0);

  return (
    <div className="space-y-5 p-4 md:p-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-emerald-500 mb-0.5">AgentiQ OS</p>
          <h2 className="text-xl font-semibold text-slate-100">Builder Substrate</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Live state of the agent registry, skill catalog, and ingestion factory.
            {lastRefresh && (
              <span className="ml-2 text-slate-600">Updated {lastRefresh.toLocaleTimeString()}</span>
            )}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={loading}
          className="h-7 gap-1.5 text-xs"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-4 py-2.5 text-xs text-rose-300">
          {error}
        </div>
      )}

      {/* ── Stat tiles ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Reference Agents" value={agents.length || "—"} accent="border-amber-800/40" icon={Brain} />
        <StatTile label="Published Skills"  value={skills.length || "—"} accent="border-indigo-800/40" icon={Cpu} />
        <StatTile label="Factory Submissions" value={intakes.length || "—"} accent="border-blue-800/40" icon={Factory} />
        <StatTile label="Published Assets" value={publishedCount || "—"} accent="border-emerald-800/40" icon={CheckCircle2} />
      </div>

      {/* ── Reference agents + Skills (side by side on desktop) ── */}
      <div className="grid md:grid-cols-2 gap-4">

        {/* Reference agents */}
        <Card className="rounded-xl border border-amber-900/30 bg-slate-950/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-amber-300 flex items-center gap-2">
              <Brain className="h-4 w-4" /> Reference Agents
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <div className="text-xs text-slate-500 py-4 text-center">Loading…</div>
            ) : agents.length > 0 ? (
              agents.map((a) => <AgentCard key={a.assetId} agent={a} />)
            ) : (
              <div className="text-xs text-slate-500 py-4 text-center">No agents published yet.</div>
            )}
          </CardContent>
        </Card>

        {/* Skill catalog */}
        <Card className="rounded-xl border border-indigo-900/30 bg-slate-950/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-indigo-300 flex items-center justify-between gap-2">
              <span className="flex items-center gap-2"><Cpu className="h-4 w-4" /> Skill Catalog</span>
              {skills.length > 0 && (
                <span className="text-[10px] text-slate-500 font-normal">{skills.length} skills</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-xs text-slate-500 py-4 text-center">Loading…</div>
            ) : skills.length > 0 ? (
              <div>
                {skills.slice(0, 10).map((s) => <SkillRow key={s.assetId} skill={s} />)}
                {skills.length > 10 && (
                  <div className="text-[11px] text-slate-600 pt-2">
                    +{skills.length - 10} more skills in the full registry
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-slate-500 py-4 text-center">No skills published yet.</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Factory pipeline summary ── */}
      <Card className="rounded-xl border border-blue-900/30 bg-slate-950/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-blue-300 flex items-center justify-between gap-2">
            <span className="flex items-center gap-2"><Factory className="h-4 w-4" /> Ingestion Factory</span>
            {pendingCount > 0 && (
              <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-300">
                {pendingCount} in pipeline
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {intakes.length === 0 ? (
            <div className="text-xs text-slate-500 py-2">
              No submissions yet. Use the Factory tab to submit a ToolQube, SkillQube, WorkflowQube, or ConnectorQube.
            </div>
          ) : (
            <div className="flex gap-2 flex-wrap">
              {Object.entries(statusGroups)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([status, count]) => (
                  <div
                    key={status}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${PIPELINE_STATUS_STYLES[status] ?? "border-slate-700 text-slate-400"}`}
                  >
                    {PIPELINE_STATUS_LABELS[status] ?? status}: {count}
                  </div>
                ))}
            </div>
          )}
          <p className="text-[11px] text-slate-600 mt-3">
            Full pipeline view with stage progression and diagnostics is available in the Factory tab.
          </p>
        </CardContent>
      </Card>

      {/* ── Contribution types ── */}
      <Card className="rounded-xl border border-slate-800 bg-slate-950/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <GitBranch className="h-4 w-4" /> What You Can Build
          </CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-3">
          {CONTRIBUTION_TYPES.map(({ label, icon: Icon, accent, desc }) => (
            <div
              key={label}
              className={`rounded-xl border p-3 flex gap-3 items-start ${accent.replace(" text-", " border-").split(" ")[0]} ${accent.split(" ")[1]}`}
            >
              <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${accent.split(" ")[2]}`} />
              <div>
                <p className={`text-xs font-semibold ${accent.split(" ")[2]}`}>{label}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ── How it flows ── */}
      <Card className="rounded-xl border border-slate-800 bg-slate-950/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <Zap className="h-4 w-4" /> How Contributions Flow
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-400">
            {[
              "Package + Submit",
              "Registry Ingestion Factory",
              "Validate + Trust Score",
              "Registry (accepted supply)",
              "Studio Composition",
              "metaMe Runtime Delivery",
              "Participation Signals",
            ].map((step, i, arr) => (
              <span key={step} className="flex items-center gap-2">
                <span className={i === 0 || i === arr.length - 1 ? "text-emerald-400 font-medium" : ""}>{step}</span>
                {i < arr.length - 1 && <ChevronRight className="h-3 w-3 text-slate-700 shrink-0" />}
              </span>
            ))}
          </div>
          <p className="text-[11px] text-slate-600 mt-2">
            Downstream participation signals — votes, sparks, remixes — feed back to inform what gets built next.
          </p>
        </CardContent>
      </Card>

      {/* ── Quick links ── */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-1.5 text-xs text-slate-400">
          <Box className="h-3 w-3" />
          Full registry browser: <span className="text-slate-300 ml-1">Registry tab</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-1.5 text-xs text-slate-400">
          <Factory className="h-3 w-3" />
          Submit a package: <span className="text-slate-300 ml-1">Factory tab</span>
        </div>
      </div>

    </div>
  );
}
