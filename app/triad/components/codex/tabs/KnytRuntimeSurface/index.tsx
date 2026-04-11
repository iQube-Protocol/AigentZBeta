"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Compass, Wifi, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

type PatronageStage = "OutsideOrder" | "Acolyte" | "Keta" | "Keji" | "First" | "Zero" | "Satoshi";
type PcsStage = "Observer" | "Collector" | "Curator" | "Remixer" | "Creator" | "Correspondent" | "Steward" | "FranchiseAligned";
type EntryState = "curious" | "skeptical" | "disinterested" | "exploratory" | "aligned" | "committed" | "distrustful";
type SupportsAxis = "order" | "pcs" | "both";
type ActionId = "vote" | "like" | "spark" | "curate" | "remix" | "respond" | "contribute" | "patronize" | "endorse";
type FeaturedMomentType = "intro" | "lore" | "vote" | "curate" | "remix" | "contribute" | "stewardship";
type ActiveMatrix = "outsider_to_acolyte" | "acolyte_to_keta" | "keta_to_keji" | "first_to_contributor" | "zero_to_steward";

const PATRONAGE_AXIS: PatronageStage[] = ["OutsideOrder", "Acolyte", "Keta", "Keji", "First", "Zero", "Satoshi"];
const PCS_AXIS: PcsStage[] = ["Observer", "Collector", "Curator", "Remixer", "Creator", "Correspondent", "Steward", "FranchiseAligned"];

// Map journey_states.stage (lowercase) → PatronageStage
function stageToPatronage(stage: string | undefined): PatronageStage {
  const map: Record<string, PatronageStage> = {
    prospect: "OutsideOrder",
    acolyte: "Acolyte",
    keta: "Keta",
    keji: "Keji",
    first: "First",
    zero: "Zero",
    "sat knyt": "Satoshi",
  };
  return (stage && map[stage]) ? map[stage] : "OutsideOrder";
}

// Map journey_states.depth → PcsStage index → PcsStage
function depthToPcs(depth: string | undefined): PcsStage {
  const depthToIdx: Record<string, number> = {
    pill: 0,       // Observer
    capsule: 1,    // Collector
    mini_runtime: 3, // Remixer
    codex: 5,      // Correspondent
  };
  const idx = depth ? (depthToIdx[depth] ?? 0) : 0;
  return PCS_AXIS[idx] ?? "Observer";
}

interface FeaturedMoment {
  id: string;
  branch?: string;
  state?: string;
}

interface OpenElection {
  id: string;
  title?: string;
}

interface RuntimeAction {
  id: ActionId;
  label: string;
  helperText: string;
  isPrimary?: boolean;
  isEnabled: boolean;
}

interface RuntimeNextStep {
  action: string;
  rationale: string;
  unlock?: string;
  supports_axis: SupportsAxis;
}

interface RuntimeState {
  patronage_stage: PatronageStage;
  pcs_stage: PcsStage;
  next_patronage_stage?: PatronageStage;
  next_pcs_stage?: PcsStage;
  entry_state: EntryState;
  active_matrix: ActiveMatrix;
  featured_moment: {
    type: FeaturedMomentType;
    title: string;
    description: string;
    media?: string;
    primary_cta: string;
    secondary_cta?: string;
  };
  available_actions: RuntimeAction[];
  current_signals: ActionId[];
  latest_reward?: string;
  reward_reason?: string;
  balance_preview?: string;
  next_best_step: RuntimeNextStep;
  handoffs: {
    kn0w1: boolean;
    metame: boolean;
    aigent_c: boolean;
    marketa: boolean;
  };
  contributor_pathway_flag: boolean;
  stewardship_candidate_flag: boolean;
}

export interface KnytRuntimeSurfaceProps {
  personaId?: string;
  patronageStage?: PatronageStage;
  pcsStage?: PcsStage;
  featuredContentId?: string;
}

function getAxisProgress<T extends string>(axis: T[], value: T | undefined): number {
  if (!value) return 0;
  const index = axis.indexOf(value);
  if (index < 0) return 0;
  return Math.round((index / (axis.length - 1)) * 100);
}

function StageRail({ label, stage, progress, accentClass }: { label: string; stage: string; progress: number; accentClass: string }) {
  return (
    <Card className="rounded-xl border border-slate-800 bg-slate-950/80">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-300">{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span className={`text-sm font-semibold ${accentClass}`}>{stage}</span>
          <span className="text-xs text-slate-400">{progress}%</span>
        </div>
        <Progress value={progress} className="h-2 bg-slate-900" />
      </CardContent>
    </Card>
  );
}

function getNextByAxis<T extends string>(axis: T[], stage: T): T | undefined {
  const index = axis.indexOf(stage);
  if (index < 0 || index === axis.length - 1) return undefined;
  return axis[index + 1];
}

function getActiveMatrix(patronageStage: PatronageStage): ActiveMatrix {
  if (patronageStage === "OutsideOrder") return "outsider_to_acolyte";
  if (patronageStage === "Acolyte") return "acolyte_to_keta";
  if (patronageStage === "Keta" || patronageStage === "Keji") return "keta_to_keji";
  if (patronageStage === "First") return "first_to_contributor";
  return "zero_to_steward";
}

function getActionLabel(action: ActionId): string {
  return {
    vote: "Vote",
    like: "Like",
    spark: "Spark",
    curate: "Curate",
    remix: "Remix",
    respond: "Respond",
    contribute: "Contribute",
    patronize: "Patronize",
    endorse: "Endorse",
  }[action];
}

function getActionHelperText(action: ActionId): string {
  return {
    vote: "Shape what rises in the world.",
    like: "Signal immediate resonance.",
    spark: "Boost momentum for this moment.",
    curate: "Begin shaping the Order with your taste.",
    remix: "Move from audience to maker.",
    respond: "Add your correspondent signal.",
    contribute: "Submit a world-facing contribution.",
    patronize: "Deepen your place in the Order.",
    endorse: "Signal strategic alignment.",
  }[action];
}

function getFeaturedMomentType(patronageStage: PatronageStage, pcsStage: PcsStage, stewardshipCandidateFlag: boolean): FeaturedMomentType {
  if (patronageStage === "OutsideOrder") return "intro";
  if (pcsStage === "Curator") return "curate";
  if (pcsStage === "Remixer" || pcsStage === "Creator") return "remix";
  if (patronageStage === "First") return "contribute";
  if (stewardshipCandidateFlag || patronageStage === "Zero" || patronageStage === "Satoshi") return "stewardship";
  return "vote";
}

function getDefaultActions(patronageStage: PatronageStage): ActionId[] {
  if (patronageStage === "OutsideOrder") return ["like", "spark", "vote", "patronize"];
  if (patronageStage === "Acolyte") return ["vote", "like", "spark"];
  if (patronageStage === "Keta" || patronageStage === "Keji") return ["vote", "curate", "spark", "remix"];
  if (patronageStage === "First") return ["remix", "respond", "contribute"];
  return ["contribute", "endorse", "respond"];
}

function getNextBestStep(patronageStage: PatronageStage, pcsStage: PcsStage): RuntimeNextStep {
  if (patronageStage === "OutsideOrder") {
    return {
      action: "Take your first signal and enter as Acolyte.",
      rationale: "A first signal creates world memory and starts your Order path.",
      unlock: "Order access and early progression momentum.",
      supports_axis: "both",
    };
  }
  if (patronageStage === "Acolyte" && pcsStage === "Collector") {
    return {
      action: "Cast your first vote.",
      rationale: "Voting moves you from observer behavior to active world participation.",
      unlock: "Early Keta and Curator momentum.",
      supports_axis: "both",
    };
  }
  if (patronageStage === "Keta" || patronageStage === "Keji") {
    return {
      action: "Curate or remix the featured moment.",
      rationale: "Taste-shaping actions are how you help define what rises in the Order.",
      unlock: "Remixer and contribution-readiness.",
      supports_axis: "both",
    };
  }
  if (patronageStage === "First") {
    return {
      action: "Submit a world-facing contribution.",
      rationale: "Contribution quality determines movement toward correspondent and steward pathways.",
      unlock: "Contributor and steward candidacy.",
      supports_axis: "pcs",
    };
  }

  return {
    action: "Lead a stewardship-level action.",
    rationale: "Steward behavior reinforces long-horizon world alignment and apex trust.",
    unlock: "Satoshi/franchise-aligned pathway depth.",
    supports_axis: "both",
  };
}

function getRuntimeState({
  patronageStage,
  pcsStage,
  featuredMoment,
  openElection,
}: {
  patronageStage: PatronageStage;
  pcsStage: PcsStage;
  featuredMoment: FeaturedMoment | null;
  openElection: OpenElection | null;
}): RuntimeState {
  const contributorPathwayFlag = patronageStage === "First" || patronageStage === "Zero" || patronageStage === "Satoshi";
  const stewardshipCandidateFlag = patronageStage === "Zero" || patronageStage === "Satoshi";
  const featuredType = getFeaturedMomentType(patronageStage, pcsStage, stewardshipCandidateFlag);
  const featuredTitle =
    openElection?.title ||
    (featuredType === "intro"
      ? "Enter the world of KNYT"
      : featuredType === "stewardship"
      ? "Stewardship Moment"
      : "Featured World Moment");

  const featuredDescription =
    featuredMoment?.id
      ? `Live item ${featuredMoment.id.slice(0, 8)}… is active in ${featuredMoment.branch ?? "community"}.`
      : "No live featured moment is currently available. Refresh or open Living Canon.";

  return {
    patronage_stage: patronageStage,
    pcs_stage: pcsStage,
    next_patronage_stage: getNextByAxis(PATRONAGE_AXIS, patronageStage),
    next_pcs_stage: getNextByAxis(PCS_AXIS, pcsStage),
    entry_state: patronageStage === "OutsideOrder" ? "curious" : "aligned",
    active_matrix: getActiveMatrix(patronageStage),
    featured_moment: {
      type: featuredType,
      title: featuredTitle,
      description: featuredDescription,
      primary_cta: featuredType === "intro" ? "Explore KNYT" : "Act now",
      secondary_cta: "Open Living Canon",
    },
    available_actions: getDefaultActions(patronageStage).slice(0, 5).map((action, index) => ({
      id: action,
      label: getActionLabel(action),
      helperText: getActionHelperText(action),
      isEnabled: true,
      isPrimary: index === 0,
    })),
    current_signals: [],
    next_best_step: getNextBestStep(patronageStage, pcsStage),
    latest_reward: undefined,
    reward_reason: undefined,
    balance_preview: undefined,
    handoffs: {
      kn0w1: true,
      metame: patronageStage !== "OutsideOrder",
      aigent_c: contributorPathwayFlag,
      marketa: patronageStage === "OutsideOrder",
    },
    contributor_pathway_flag: contributorPathwayFlag,
    stewardship_candidate_flag: stewardshipCandidateFlag,
  };
}

export default function KnytRuntimeSurface({
  personaId,
  patronageStage: patronageStageProp = "OutsideOrder",
  pcsStage: pcsStageProp = "Observer",
  featuredContentId,
}: KnytRuntimeSurfaceProps) {
  const { toast } = useToast();
  const [featuredMoment, setFeaturedMoment] = useState<FeaturedMoment | null>(null);
  const [openElection, setOpenElection] = useState<OpenElection | null>(null);
  const [submittingAction, setSubmittingAction] = useState<string | null>(null);
  const [signalHistory, setSignalHistory] = useState<ActionId[]>([]);
  const [latestReward, setLatestReward] = useState<string | undefined>();
  const [rewardReason, setRewardReason] = useState<string | undefined>();
  const [balancePreview, setBalancePreview] = useState<string | undefined>();
  // Resolved stages — loaded from journey_states when personaId is present
  const [patronageStage, setPatronageStage] = useState<PatronageStage>(patronageStageProp);
  const [pcsStage, setPcsStage] = useState<PcsStage>(pcsStageProp);

  // Load the persona's journey state to resolve their actual axes
  useEffect(() => {
    if (!personaId) return;
    let cancelled = false;

    async function loadJourneyState() {
      try {
        const params = new URLSearchParams({
          view: "individual",
          tenantId: "nakamoto",
          personaId,
          limit: "1",
        });
        const res = await fetch(`/api/runtime/experience/dashboard?${params}`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const state = data?.data?.[0];
        if (!state || cancelled) return;
        setPatronageStage(stageToPatronage(state.stage));
        // Use inferred PCS from depth as best available signal
        setPcsStage(depthToPcs(state.depth));
      } catch {
        // Fall back silently to prop defaults
      }
    }

    loadJourneyState();
    return () => { cancelled = true; };
  }, [personaId]);

  const patronageProgress = useMemo(() => getAxisProgress(PATRONAGE_AXIS, patronageStage), [patronageStage]);
  const pcsProgress = useMemo(() => getAxisProgress(PCS_AXIS, pcsStage), [pcsStage]);
  const networkOnline = typeof navigator === "undefined" ? true : navigator.onLine;
  const runtimeState = useMemo(
    () => ({
      ...getRuntimeState({ patronageStage, pcsStage, featuredMoment, openElection }),
      current_signals: signalHistory,
      latest_reward: latestReward,
      reward_reason: rewardReason,
      balance_preview: balancePreview,
    }),
    [balancePreview, featuredMoment, latestReward, openElection, patronageStage, pcsStage, rewardReason, signalHistory],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadFeaturedMoment() {
      try {
        const response = await fetch("/api/codex/knyt/living-canon", { cache: "no-store" });
        if (!response.ok) return;

        const payload = await response.json();
        if (cancelled) return;

        const preferred = featuredContentId
          ? payload?.branches?.community?.items?.find((item: FeaturedMoment) => item.id === featuredContentId)
          : undefined;
        const fallback = payload?.branches?.community?.items?.[0] || payload?.branches?.canon?.items?.[0];
        setFeaturedMoment(preferred || fallback || null);

        const firstElection = payload?.open_elections?.[0];
        setOpenElection(firstElection ? { id: firstElection.id, title: firstElection.title } : null);
      } catch {
        if (!cancelled) {
          setFeaturedMoment(null);
          setOpenElection(null);
        }
      }
    }

    loadFeaturedMoment();
    return () => {
      cancelled = true;
    };
  }, [featuredContentId]);

  async function submitSignalAction(action: ActionId) {
    if (action === "respond" || action === "patronize" || action === "endorse") {
      toast({
        title: `${getActionLabel(action)} routed`,
        description: "This action is available through deeper KNYT pathways and handoffs.",
      });
      return;
    }

    if (!personaId || !featuredMoment?.id) {
      toast({
        title: "Missing runtime context",
        description: "personaId and featured content are required for signal actions.",
        variant: "destructive",
      });
      return;
    }

    setSubmittingAction(action);

    try {
      const endpoint = `/api/codex/knyt/living-canon/${action}`;
      let payload: Record<string, unknown> = { content_id: featuredMoment.id, persona_id: personaId };

      if (action === "vote") {
        if (!openElection?.id) throw new Error("No open election is available.");
        payload = {
          election_id: openElection.id,
          persona_id: personaId,
          voted_for: [featuredMoment.id],
          wallet_task_id: `runtime-surface-${Date.now()}`,
        };
      }

      if (action === "remix") {
        payload = {
          source_publication_id: featuredMoment.id,
          persona_id: personaId,
          task_slug: "knyt:community_submission",
        };
      }

      if (action === "contribute") {
        payload = {
          persona_id: personaId,
          task_slug: "knyt:community_submission",
          branch_target: "community",
          status: "submitted",
          field_values: {
            title: `Runtime contribution ${new Date().toISOString()}`,
            body: "Submitted from KNYT Runtime Surface alpha signal tray.",
          },
          metadata: {
            source_publication_id: featuredMoment.id,
            source: "knyt_runtime_surface",
          },
        };
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "Signal action failed");

      setSignalHistory((prev) => [action, ...prev.filter((signal) => signal !== action)].slice(0, 8));
      const rewardByAction: Record<ActionId, string> = {
        like: "Signal recognition recorded",
        spark: "Momentum spark recorded",
        curate: "$KNYT curation eligibility increased",
        vote: "World vote impact recorded",
        remix: "Remix pathway progression updated",
        contribute: "Contribution pathway progression updated",
        respond: "Correspondent signal recorded",
        patronize: "Order patronage intent recorded",
        endorse: "Strategic endorsement recorded",
      };
      setLatestReward(rewardByAction[action]);
      setRewardReason(`Action ${getActionLabel(action)} changed your world participation footprint.`);
      setBalancePreview(action === "curate" ? "Potential +$KNYT pending settlement" : "Reward status updating");

      toast({
        title: `${action.toUpperCase()} recorded`,
        description: `Action completed for ${featuredMoment.id.slice(0, 8)}…`,
      });
    } catch (error) {
      toast({
        title: `${action.toUpperCase()} failed`,
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSubmittingAction(null);
    }
  }

  return (
    <div className="grid gap-4 p-4 md:p-6">
      <Card className="rounded-xl border border-slate-800 bg-slate-950/90">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-amber-500">KNYT Cartridge</p>
            <h2 className="text-xl font-semibold text-slate-100">Live Runtime Surface</h2>
            <p className="text-xs text-slate-400">The Order is active. Your next move matters here.</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="border-amber-800 bg-amber-950 text-amber-300">{runtimeState.patronage_stage}</Badge>
            <Badge variant="outline" className="border-slate-700 text-slate-300">
              {networkOnline ? <Wifi className="mr-1 h-3 w-3 text-emerald-400" /> : <WifiOff className="mr-1 h-3 w-3 text-rose-400" />}
              {networkOnline ? "Network OK" : "Offline"}
            </Badge>
            {runtimeState.handoffs.kn0w1 ? (
              <Badge variant="outline" className="border-indigo-800 text-indigo-300">Kn0w1 available</Badge>
            ) : null}
            {personaId ? (
              <Badge variant="outline" className="border-slate-700 text-slate-400">Persona {personaId.slice(0, 8)}…</Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <StageRail label="Patronage Axis" stage={patronageStage} progress={patronageProgress} accentClass="text-amber-300" />
        <StageRail label="PCS Axis" stage={pcsStage} progress={pcsProgress} accentClass="text-indigo-300" />
      </div>

      <Card className="rounded-xl border border-slate-800 bg-slate-950/80">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-300">Featured Moment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {runtimeState.featured_moment ? (
            <>
              <p className="font-semibold text-slate-100">{runtimeState.featured_moment.title}</p>
              <p className="text-slate-300">{runtimeState.featured_moment.description}</p>
              {featuredMoment ? (
                <p className="text-slate-400">
                  Content ID: <span className="font-mono text-slate-300">{featuredMoment.id}</span>
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="border-slate-700 text-slate-300">{runtimeState.featured_moment.type}</Badge>
                {featuredMoment?.branch ? <Badge variant="outline" className="border-slate-700 text-slate-300">{featuredMoment.branch}</Badge> : null}
                {featuredMoment?.state ? <Badge variant="outline" className="border-slate-700 text-slate-300">{featuredMoment.state}</Badge> : null}
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="secondary" className="bg-indigo-600 hover:bg-indigo-500 text-white">
                  {runtimeState.featured_moment.primary_cta}
                </Button>
                {runtimeState.featured_moment.secondary_cta ? (
                  <Button size="sm" variant="outline" className="border-slate-700 text-slate-100">
                    {runtimeState.featured_moment.secondary_cta}
                  </Button>
                ) : null}
              </div>
            </>
          ) : (
            <p className="text-slate-400">No live featured moment available yet.</p>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-xl border border-slate-800 bg-slate-950/80">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-300">Signal Action Tray</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {runtimeState.available_actions.map((action) => (
              <Button
                key={action.id}
                size="sm"
                variant={action.isPrimary ? "secondary" : "outline"}
                className={action.isPrimary ? "bg-cyan-600 hover:bg-cyan-500 text-white" : "border-slate-700 text-slate-100"}
                disabled={submittingAction !== null || !action.isEnabled || (action.id === "vote" && !openElection?.id)}
                onClick={() => submitSignalAction(action.id)}
              >
                {action.label}
              </Button>
            ))}
          </div>
          <p className="text-xs text-slate-400">
            {(runtimeState.available_actions.find((action) => action.isPrimary) ?? runtimeState.available_actions[0])?.helperText}
          </p>
        </CardContent>
      </Card>

      {(runtimeState.latest_reward || runtimeState.balance_preview) ? (
        <Card className="rounded-xl border border-emerald-900 bg-emerald-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-emerald-200">Reward + Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {runtimeState.latest_reward ? <p className="text-emerald-100">{runtimeState.latest_reward}</p> : null}
            {runtimeState.reward_reason ? <p className="text-emerald-300/90">{runtimeState.reward_reason}</p> : null}
            {runtimeState.balance_preview ? <p className="text-emerald-400 text-xs">{runtimeState.balance_preview}</p> : null}
          </CardContent>
        </Card>
      ) : null}

      <Card className="rounded-xl border border-slate-800 bg-slate-950/80">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-300">Your Next Best Step</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="font-semibold text-slate-100">{runtimeState.next_best_step.action}</p>
          <p className="text-slate-300">{runtimeState.next_best_step.rationale}</p>
          {runtimeState.next_best_step.unlock ? (
            <p className="text-xs text-indigo-300">Unlocks: {runtimeState.next_best_step.unlock}</p>
          ) : null}
          <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white">
            Do this now <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-xl border border-slate-800 bg-slate-950/80">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-300">Go Deeper</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {runtimeState.handoffs.kn0w1 ? <Button size="sm" variant="outline" className="border-slate-700 text-slate-100">Ask Kn0w1</Button> : null}
          {runtimeState.handoffs.metame ? <Button size="sm" variant="outline" className="border-slate-700 text-slate-100">See your path in metaMe</Button> : null}
          {runtimeState.handoffs.aigent_c ? <Button size="sm" variant="outline" className="border-slate-700 text-slate-100">Explore builder path with Aigent C</Button> : null}
          {runtimeState.handoffs.marketa ? <Button size="sm" variant="outline" className="border-slate-700 text-slate-100">Launch context from Marketa</Button> : null}
        </CardContent>
      </Card>

      {runtimeState.contributor_pathway_flag ? (
        <Card className="rounded-xl border border-fuchsia-900 bg-fuchsia-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-fuchsia-200">Contribution Path</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-fuchsia-100">
            You are eligible for deeper contributor pathways. Continue high-quality contribution signals to advance.
          </CardContent>
        </Card>
      ) : null}

      {runtimeState.stewardship_candidate_flag ? (
        <Card className="rounded-xl border border-amber-900 bg-amber-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-200">Stewardship Path</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-amber-100">
            Stewardship is active. Focus on world-supportive leadership actions and long-horizon alignment.
          </CardContent>
        </Card>
      ) : null}

      {runtimeState.current_signals.length ? (
        <Card className="rounded-xl border border-slate-800 bg-slate-950/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <Compass className="h-4 w-4 text-cyan-400" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-slate-300">
            {runtimeState.current_signals.map((signal, index) => (
              <p key={`${signal}-${index}`}>• You triggered {getActionLabel(signal)} in the live world.</p>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
