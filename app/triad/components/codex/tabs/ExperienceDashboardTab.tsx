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
  ChevronRight,
  Eye,
  Globe,
  Layers,
  RefreshCw,
  Search,
  ShieldCheck,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { Dots } from "@/components/registry/scoreUtils";

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
  interactions: any[];
  rewardRecord: Record<string, any> | null;
};

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

const STAGES = ["prospect", "acolyte", "keta", "keji", "first", "zero"];

const STAGE_COLORS: Record<string, string> = {
  prospect: "border-slate-600 text-slate-400",
  acolyte: "border-blue-500/50 text-blue-300",
  keta: "border-violet-500/50 text-violet-300",
  keji: "border-amber-500/50 text-amber-300",
  first: "border-emerald-500/50 text-emerald-300",
  zero: "border-rose-500/50 text-rose-300",
};

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
  const [activeView, setActiveView] = useState("franchise");
  const [franchise, setFranchise] = useState<FranchiseData | null>(null);
  const [cohort, setCohort] = useState<CohortData | null>(null);
  const [cohortStage, setCohortStage] = useState<string>("all");
  const [individuals, setIndividuals] = useState<Individual[]>([]);
  const [selectedIndividual, setSelectedIndividual] = useState<Individual | null>(null);
  const [nakamotoData, setNakamotoData] = useState<NakamotoData | null>(null);
  const [nakamotoLoading, setNakamotoLoading] = useState(false);
  const [indStageFilter, setIndStageFilter] = useState<string>("all");
  const [indSearch, setIndSearch] = useState<string>("");
  const [nbeData, setNbeData] = useState<NBEData | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const fetchView = useCallback(async (view: string, opts?: { stage?: string; search?: string }) => {
    setLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams({ view });
      if (personaId && view === "individual") params.set("personaId", personaId);
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
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      setSyncResult(`Synced ${data.seeded} personas (${data.skipped ?? 0} unchanged)`);
      void fetchView(currentView);
    } catch (e: any) {
      setSyncResult(`Sync error: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  }, [tenantId, fetchView]);

  // Fetch nakamoto CRM data when an individual is selected
  useEffect(() => {
    if (!selectedIndividual) { setNakamotoData(null); return; }
    setNakamotoLoading(true);
    fetch(`/api/crm/personas/${selectedIndividual.persona_id}/nakamoto`)
      .then((r) => r.json())
      .then((d) => setNakamotoData(d.data ?? null))
      .catch(() => setNakamotoData(null))
      .finally(() => setNakamotoLoading(false));
  }, [selectedIndividual]);

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
            <div className="text-xs text-slate-400">KNYT Laddering Program — Operator View</div>
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
          <Button variant="outline" size="sm" onClick={() => void fetchView(activeView)}
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
          <Button variant="ghost" size="sm" onClick={() => void fetchView(activeView)}
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
                  <div className="grid gap-2 md:grid-cols-6">
                    {STAGES.map((stage) => {
                      const count = franchise.stage_distribution[stage] ?? 0;
                      const pct = franchise.total_journeys > 0
                        ? Math.round((count / franchise.total_journeys) * 100)
                        : 0;
                      return (
                        <div key={stage} className={`rounded-lg border p-2 text-center ${STAGE_COLORS[stage] ?? "border-slate-700 text-slate-400"}`}>
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
              {["all", ...STAGES].map((s) => (
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
            {selectedIndividual ? (
              <div className={base}>
                <Button variant="ghost" size="sm" onClick={() => setSelectedIndividual(null)}
                  className="mb-3 h-6 gap-1 text-xs text-slate-400">
                  ← Back to list
                </Button>
                <div className="space-y-3">
                  {/* Identity header */}
                  <div className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                    <div className="flex-1 space-y-1 min-w-0">
                      <div className="font-semibold text-slate-100 truncate">
                        {selectedIndividual.crm?.display_name ?? selectedIndividual.persona_id.slice(0, 12) + "…"}
                      </div>
                      {selectedIndividual.crm?.fio_handle && (
                        <div className="text-xs text-violet-300 font-mono">{selectedIndividual.crm.fio_handle}</div>
                      )}
                      <div className="text-[11px] text-slate-500 font-mono">{selectedIndividual.persona_id}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge variant="outline"
                        className={`capitalize text-[11px] ${STAGE_COLORS[selectedIndividual.stage] ?? "border-slate-700 text-slate-400"}`}>
                        {selectedIndividual.stage}
                      </Badge>
                      {selectedIndividual.crm?.status && (
                        <Badge variant="outline" className={`text-[11px] ${selectedIndividual.crm.status === "active" ? "border-emerald-500/40 text-emerald-300" : "border-slate-600 text-slate-400"}`}>
                          {selectedIndividual.crm.status}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Journey state */}
                  <div className="grid gap-2 md:grid-cols-3">
                    {[
                      { label: "Stage", value: selectedIndividual.stage },
                      { label: "Depth", value: selectedIndividual.depth },
                      { label: "Last Active", value: selectedIndividual.active_at ? new Date(selectedIndividual.active_at).toLocaleDateString() : "—" },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                        <div className="text-[11px] text-slate-400">{label}</div>
                        <div className="mt-1 font-semibold capitalize">{value}</div>
                      </div>
                    ))}
                  </div>

                  {/* CRM reputation data */}
                  {selectedIndividual.crm && (
                    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">CRM Profile</div>
                      <div className="grid gap-2 grid-cols-2 md:grid-cols-4 text-[11px]">
                        {selectedIndividual.crm.order_tier && (
                          <div className="rounded border border-slate-700 px-2 py-1.5">
                            <div className="text-slate-500">Order Tier</div>
                            <div className="font-semibold text-violet-300">{selectedIndividual.crm.order_tier}</div>
                          </div>
                        )}
                        {selectedIndividual.crm.reputation_tier && (
                          <div className="rounded border border-slate-700 px-2 py-1.5">
                            <div className="text-slate-500">Rep Tier</div>
                            <div className="font-semibold text-amber-300">{selectedIndividual.crm.reputation_tier}</div>
                          </div>
                        )}
                        {selectedIndividual.crm.reputation_score != null && (
                          <div className="rounded border border-slate-700 px-2 py-1.5">
                            <div className="text-slate-500">Rep Score</div>
                            <div className="font-semibold text-slate-200">{selectedIndividual.crm.reputation_score}</div>
                          </div>
                        )}
                        {selectedIndividual.crm.created_at && (
                          <div className="rounded border border-slate-700 px-2 py-1.5">
                            <div className="text-slate-500">Joined</div>
                            <div className="font-semibold text-slate-200">{new Date(selectedIndividual.crm.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</div>
                          </div>
                        )}
                      </div>
                      {selectedIndividual.crm.badges && selectedIndividual.crm.badges.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {selectedIndividual.crm.badges.map((b) => (
                            <Badge key={b} variant="outline" className="text-[10px] border-blue-500/30 text-blue-300">{b}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Nakamoto CRM data (lazy-loaded) */}
                  <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nakamoto CRM</div>
                    {nakamotoLoading ? (
                      <div className="text-xs text-slate-400">Loading…</div>
                    ) : nakamotoData ? (
                      <div className="space-y-2">
                        {nakamotoData.knytPersona && (
                          <div className="space-y-1.5">
                            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">KNYT Persona</div>
                            <div className="grid gap-1.5 grid-cols-2 text-[11px]">
                              {[
                                ["KNYT-ID", nakamotoData.knytPersona["KNYT-ID"]],
                                ["Email", nakamotoData.knytPersona["Email"]],
                                ["First Name", nakamotoData.knytPersona["First Name"]],
                                ["Last Name", nakamotoData.knytPersona["Last Name"]],
                                ["Order Tier", nakamotoData.knytPersona["Order of Metaiye"]],
                                ["Twitter", nakamotoData.knytPersona["Twitter Handle"]],
                                ["LinkedIn", nakamotoData.knytPersona["LinkedIn URL"]],
                                ["EVM Address", nakamotoData.knytPersona["EVM Address"]],
                              ].filter(([, v]) => v).map(([k, v]) => (
                                <div key={String(k)} className="rounded border border-slate-700/50 px-2 py-1">
                                  <div className="text-slate-500">{k}</div>
                                  <div className="text-slate-200 font-mono truncate" title={String(v)}>{String(v)}</div>
                                </div>
                              ))}
                            </div>
                            {nakamotoData.rewardRecord && (
                              <div className="rounded border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-[11px]">
                                <span className="text-emerald-300 font-semibold">Rewards: </span>
                                <span className="text-slate-300">
                                  {nakamotoData.rewardRecord.reward_claimed ? `${nakamotoData.rewardRecord.reward_amount} claimed` : "unclaimed"}
                                  {nakamotoData.rewardRecord.linkedin_connected ? " · LinkedIn ✓" : ""}
                                  {nakamotoData.rewardRecord.metamask_connected ? " · MetaMask ✓" : ""}
                                </span>
                              </div>
                            )}
                            {nakamotoData.interactions.length > 0 && (
                              <div className="text-[11px] text-slate-500">{nakamotoData.interactions.length} interaction(s) on record</div>
                            )}
                          </div>
                        )}
                        {nakamotoData.blakQube && !nakamotoData.knytPersona && (
                          <div className="space-y-1.5">
                            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">blakQube</div>
                            <div className="grid gap-1.5 grid-cols-2 text-[11px]">
                              {[
                                ["Email", nakamotoData.blakQube["Email"]],
                                ["KNYT-ID", nakamotoData.blakQube["KNYT-ID"]],
                                ["Qrypto-ID", nakamotoData.blakQube["Qrypto-ID"]],
                              ].filter(([, v]) => v).map(([k, v]) => (
                                <div key={String(k)} className="rounded border border-slate-700/50 px-2 py-1">
                                  <div className="text-slate-500">{k}</div>
                                  <div className="text-slate-200 truncate">{String(v)}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {!nakamotoData.knytPersona && !nakamotoData.blakQube && (
                          <div className="text-xs text-slate-500">No Nakamoto CRM record matched. Persona may not have a linked email or KNYT-ID.</div>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500">No Nakamoto CRM data available for this persona.</div>
                    )}
                  </div>

                  {selectedIndividual.nbe && (
                    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Active NBE Plan</div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline"
                          className={`capitalize ${DISPOSITION_COLORS[selectedIndividual.nbe.disposition] ?? "border-slate-700"}`}>
                          {selectedIndividual.nbe.disposition}
                        </Badge>
                        {selectedIndividual.nbe.next_experience_depth && (
                          <Badge variant="outline" className="border-violet-500/40 text-violet-300">
                            → {selectedIndividual.nbe.next_experience_depth}
                          </Badge>
                        )}
                      </div>
                      {selectedIndividual.nbe.rationale && (
                        <div className="mt-2 text-xs text-slate-300">{selectedIndividual.nbe.rationale}</div>
                      )}
                    </div>
                  )}
                  {/* COD-601 — Registry trust & compatibility indicators */}
                  {selectedIndividual.trust_scores && (
                    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Trust &amp; Compatibility
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
                              {raw != null ? (
                                <div className="flex justify-center">
                                  <Dots value={val} kind={kind} title={label} size="xs" />
                                </div>
                              ) : (
                                <div className="text-[10px] text-slate-600">—</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
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
                  {["all", ...STAGES].map((s) => (
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
                  <div className="text-slate-400 text-xs">No journey states found. Seed data after running the DB migration.</div>
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
    </div>
  );
}

export default ExperienceDashboardTab;
