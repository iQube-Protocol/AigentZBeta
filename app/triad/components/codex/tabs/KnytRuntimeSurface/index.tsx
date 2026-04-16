"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight, Brain, Compass, Wifi, WifiOff,
  Heart, Zap, CheckCircle2, Layers, Shuffle, Upload, Star, ThumbsUp, MessageCircle,
} from "lucide-react";
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


function AxisSteps({ label, axis, active, accentActive, accentText }: {
  label: string;
  axis: string[];
  active: string;
  accentActive: string;  // e.g. "bg-amber-500/20 border-amber-500/40 text-amber-300"
  accentText: string;    // e.g. "text-amber-300"
}) {
  const activeIdx = axis.indexOf(active);
  return (
    <div className="rounded-xl border border-white/5 bg-slate-950/80 p-4 space-y-3">
      <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-500">{label}</p>
      <p className={`text-sm font-semibold ${accentText}`}>{active}</p>
      <div className="flex flex-wrap gap-1">
        {axis.map((stage, i) => {
          const isActive = i === activeIdx;
          const isPast = i < activeIdx;
          return (
            <span
              key={stage}
              className={
                isActive
                  ? `inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${accentActive}`
                  : isPast
                  ? "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] text-slate-500 bg-slate-800/60"
                  : "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] text-slate-600"
              }
            >
              {stage}
            </span>
          );
        })}
      </div>
    </div>
  );
}

const ACTION_ICONS: Record<ActionId, React.ComponentType<{ className?: string }>> = {
  like: Heart,
  spark: Zap,
  vote: CheckCircle2,
  curate: Layers,
  remix: Shuffle,
  contribute: Upload,
  patronize: Star,
  endorse: ThumbsUp,
  respond: MessageCircle,
};

function ActionChip({ action, isPrimary, disabled, loading, onClick }: {
  action: RuntimeAction;
  isPrimary: boolean;
  disabled: boolean;
  loading: boolean;
  onClick: () => void;
}) {
  const Icon = ACTION_ICONS[action.id];
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      title={action.helperText}
      className={
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed " +
        (isPrimary
          ? "bg-amber-500 hover:bg-amber-400 text-black"
          : "border border-slate-700 text-slate-200 hover:border-slate-500 hover:text-white bg-transparent")
      }
    >
      {Icon && <Icon className="h-3 w-3" />}
      {action.label}
    </button>
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

function getInvestorPrivilege(cohort: string | null | undefined, band: string | null | undefined): { tier: string; discount: string } {
  if (cohort === 'zero_knyt') return { tier: 'Zero KNYT', discount: '25%' };
  if (cohort === 'top_shelf') return { tier: 'Top KNYT Shelf', discount: '20%' };
  if (band === '5000+') return { tier: 'First KNYT', discount: '20%' };
  if (band === '2000-4999') return { tier: 'Keji KNYT', discount: '15%' };
  return { tier: 'Keta KNYT', discount: '10%' };
}

function getCohortOffer(cohort: string | null | undefined): string {
  if (cohort === 'top_shelf') return 'Top KNYT Shelf (21 available)';
  if (cohort === 'zero_knyt') return 'Zero KNYT collector tier';
  return 'KNYT Codex collector path';
}

export default function KnytRuntimeSurface({
  personaId,
  patronageStage: patronageStageProp = "OutsideOrder",
  pcsStage: pcsStageProp = "Observer",
  featuredContentId,
}: KnytRuntimeSurfaceProps) {
  const { toast } = useToast();
  const router = useRouter();
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
  // Investor campaign status — populated for known investors
  const [investorStatus, setInvestorStatus] = useState<{
    isInvestor: boolean;
    ksBacked?: boolean;
    ksClicked?: boolean;
    campaignState?: string | null;
    campaignCohort?: string | null;
    investmentBand?: string | null;
    ksTrackingUrl?: string;
  } | null>(null);

  // Aggregate state from /api/runtime/knyt-state — replaces separate experience/dashboard load
  const [worldHeader, setWorldHeader] = useState<{ title: string; subtitle: string } | null>(null);
  const [signalCounts, setSignalCounts] = useState<{ like: number; spark: number; curate: number; total: number } | null>(null);
  const [knytBalance, setKnytBalance] = useState<number | null>(null);
  const [nbePlan, setNbePlan] = useState<{ disposition: string; next_experience_depth: string; rationale: string } | null>(null);
  // Capsule prescription from /api/experience/capsule — live matrix-based delivery
  const [capsule, setCapsule] = useState<{
    depth: string; label: string; cta_label: string; cta_action: string; next_depth: string; fallback: boolean;
  } | null>(null);

  useEffect(() => {
    if (!personaId) return;
    let cancelled = false;

    async function loadKnytState() {
      try {
        const res = await fetch(`/api/runtime/knyt-state?personaId=${encodeURIComponent(personaId!)}`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        // Resolve journey stages from the knyt-state response
        if (data.journey?.stage) {
          setPatronageStage(stageToPatronage(data.journey.stage));
          setPcsStage(depthToPcs(data.journey.depth));
        }
        if (data.world_header) setWorldHeader(data.world_header);
        if (data.signal_counts) setSignalCounts(data.signal_counts);
        if (typeof data.knyt_balance === "number") setKnytBalance(data.knyt_balance);
        if (data.nbe) setNbePlan(data.nbe);
        // Use editorial featured moment if available; living-canon load acts as fallback
        if (data.featured_moment?.content_id && !featuredMoment) {
          setFeaturedMoment({ id: data.featured_moment.content_id, branch: "editorial" });
        }
      } catch {
        // Fall back silently to prop defaults
      }
    }

    loadKnytState();
    return () => { cancelled = true; };
  }, [personaId]); // featuredMoment intentionally excluded — living-canon load below handles it

  // Load capsule prescription whenever stages resolve
  useEffect(() => {
    let cancelled = false;
    async function loadCapsule() {
      try {
        const res = await fetch('/api/experience/capsule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patronage_stage: patronageStage, pcs_stage: pcsStage }),
          cache: 'no-store',
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) setCapsule(data);
      } catch {
        // Degrade silently — static fallback content remains visible
      }
    }
    loadCapsule();
    return () => { cancelled = true; };
  }, [patronageStage, pcsStage]);

  // Load investor campaign status for the KNYT Wheel CTA lane
  useEffect(() => {
    if (!personaId) return;
    let cancelled = false;

    async function loadInvestorStatus() {
      try {
        const res = await fetch(
          `/api/crm/campaign/investor-status?personaId=${encodeURIComponent(personaId!)}`,
          { cache: "no-store" }
        );
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) setInvestorStatus(data);
      } catch {
        // Non-investors silently get no status
      }
    }

    loadInvestorStatus();
    return () => { cancelled = true; };
  }, [personaId]);

  const networkOnline = typeof navigator === "undefined" ? true : navigator.onLine;
  const investorPrivilege = getInvestorPrivilege(investorStatus?.campaignCohort, investorStatus?.investmentBand);
  const cohortOffer = getCohortOffer(investorStatus?.campaignCohort);
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
      {/* ── Header capsule ── */}
      <div className="rounded-xl border border-white/5 bg-slate-950/90 p-4">
        <p className="text-[10px] uppercase tracking-widest font-semibold text-amber-500/80 mb-2">KNYT Cartridge</p>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-100 leading-tight">{worldHeader?.title ?? "Live Runtime Surface"}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{worldHeader?.subtitle ?? "The Order is active. Your next move matters here."}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center rounded-full border border-amber-700/50 bg-amber-950/40 px-2.5 py-0.5 text-xs font-semibold text-amber-300">
              {runtimeState.patronage_stage}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-700/60 px-2.5 py-0.5 text-xs text-slate-300">
              {networkOnline
                ? <Wifi className="h-3 w-3 text-emerald-400" />
                : <WifiOff className="h-3 w-3 text-rose-400" />}
              {networkOnline ? "Network OK" : "Offline"}
            </span>
            {runtimeState.handoffs.kn0w1 && (
              <span className="inline-flex items-center rounded-full border border-amber-700/40 px-2.5 py-0.5 text-xs text-amber-400">Kn0w1 lead</span>
            )}
            {investorStatus?.isInvestor && investorStatus.ksBacked && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-900/30 border border-emerald-700/30 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
                ✓ Patron backed
              </span>
            )}
            {investorStatus?.isInvestor && !investorStatus.ksBacked && investorStatus.ksClicked && (
              <span className="inline-flex items-center rounded-full border border-amber-700/40 px-2.5 py-0.5 text-xs text-amber-300/80">
                KS viewed
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── KNYT Wheel investor CTA ── */}
      {investorStatus?.isInvestor && !investorStatus.ksBacked && investorStatus.ksTrackingUrl && (
        <div className="rounded-xl border border-amber-700/30 bg-amber-950/20 p-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest font-semibold text-amber-500/80 mb-1">KNYT Wheel — Live Now</p>
            <p className="text-sm font-semibold text-slate-100">Secure your slot before the window closes.</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {investorStatus.campaignCohort === "top_shelf"
                ? "You are eligible for the Top Shelf equity offer."
                : investorStatus.campaignCohort === "zero_knyt"
                ? "Your Zero KNYT collectible offer is waiting."
                : "The KNYT Wheel campaign is live on Kickstarter."}
            </p>
          </div>
          <a
            href={investorStatus.ksTrackingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold rounded-full transition whitespace-nowrap"
          >
            Back on Kickstarter <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      )}

      {/* ── Axis capsules ── */}
      <div className="grid gap-4 md:grid-cols-2">
        <AxisSteps
          label="PATRONAGE AXIS"
          axis={PATRONAGE_AXIS}
          active={patronageStage}
          accentActive="bg-amber-500/15 border-amber-500/40 text-amber-300"
          accentText="text-amber-300"
        />
        <AxisSteps
          label="PCS AXIS"
          axis={PCS_AXIS}
          active={pcsStage}
          accentActive="bg-indigo-500/15 border-indigo-500/40 text-indigo-300"
          accentText="text-indigo-300"
        />
      </div>

      {/* ── Featured Moment capsule ── */}
      <div className="rounded-xl border border-white/5 bg-slate-950/80 p-4 space-y-3">
        <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-500">Featured Moment</p>
        {runtimeState.featured_moment ? (
          <>
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Live matrix prescription badge */}
              {capsule && (
                <span className="inline-flex items-center rounded-full bg-amber-950/40 border border-amber-700/40 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                  {capsule.depth} · {capsule.label}
                </span>
              )}
              <span className="inline-flex items-center rounded-full border border-slate-700/60 px-2 py-0.5 text-[10px] text-slate-400">
                {runtimeState.featured_moment.type}
              </span>
              {featuredMoment?.branch && (
                <span className="inline-flex items-center rounded-full border border-slate-700/60 px-2 py-0.5 text-[10px] text-slate-400">
                  {featuredMoment.branch}
                </span>
              )}
              {featuredMoment?.state && (
                <span className="inline-flex items-center rounded-full bg-emerald-900/30 border border-emerald-700/30 px-2 py-0.5 text-[10px] text-emerald-400">
                  {featuredMoment.state}
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-slate-100">{runtimeState.featured_moment.title}</p>
            <p className="text-xs text-slate-300 leading-relaxed">{runtimeState.featured_moment.description}</p>
            {featuredMoment && (
              <p className="text-[10px] font-mono text-slate-600 truncate">{featuredMoment.id}</p>
            )}
            <div className="flex gap-2 pt-1">
              <button className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-black transition">
                {capsule?.cta_label ?? runtimeState.featured_moment.primary_cta}
              </button>
              {runtimeState.featured_moment.secondary_cta && (
                <button className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-slate-500 transition">
                  {runtimeState.featured_moment.secondary_cta}
                </button>
              )}
            </div>
          </>
        ) : (
          <p className="text-xs text-slate-500">No live featured moment available yet.</p>
        )}
      </div>

      {/* ── Signal Action Tray capsule ── */}
      <div className="rounded-xl border border-white/5 bg-slate-950/80 p-4 space-y-3">
        <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-500">Signal Action Tray</p>
        <div className="flex flex-wrap gap-2">
          {/* Campaign chip — primary for unbacked investors */}
          {investorStatus?.isInvestor && !investorStatus.ksBacked && investorStatus.ksTrackingUrl && (
            <a
              href={investorStatus.ksTrackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-black transition"
            >
              <Star className="h-3 w-3" />
              {investorPrivilege.tier} — {investorPrivilege.discount} off
              <ArrowRight className="h-3 w-3" />
            </a>
          )}
          {runtimeState.available_actions.map((action) => (
            <ActionChip
              key={action.id}
              action={action}
              isPrimary={!!action.isPrimary}
              disabled={!action.isEnabled || (action.id === "vote" && !openElection?.id)}
              loading={submittingAction === action.id}
              onClick={() => submitSignalAction(action.id)}
            />
          ))}
        </div>
        <p className="text-[11px] text-slate-500">
          {(runtimeState.available_actions.find((a) => a.isPrimary) ?? runtimeState.available_actions[0])?.helperText}
        </p>
        {signalCounts && signalCounts.total > 0 && (
          <div className="flex flex-wrap gap-3 text-[10px] text-slate-600">
            {signalCounts.like > 0 && <span>{signalCounts.like} like{signalCounts.like !== 1 ? "s" : ""}</span>}
            {signalCounts.spark > 0 && <span>{signalCounts.spark} spark{signalCounts.spark !== 1 ? "s" : ""}</span>}
            {signalCounts.curate > 0 && <span>{signalCounts.curate} curation{signalCounts.curate !== 1 ? "s" : ""}</span>}
            <span>— {signalCounts.total} total</span>
          </div>
        )}
      </div>

      {/* ── Reward + Progress capsule (conditional) ── */}
      {(runtimeState.latest_reward || runtimeState.balance_preview || (knytBalance !== null && knytBalance > 0)) && (
        <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/15 p-4 space-y-2">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-emerald-600">Reward + Progress</p>
          {knytBalance !== null && knytBalance > 0 && (
            <p className="text-sm font-semibold text-emerald-100">{knytBalance.toFixed(4)} $KNYT</p>
          )}
          {runtimeState.latest_reward && <p className="text-xs text-emerald-200">{runtimeState.latest_reward}</p>}
          {runtimeState.reward_reason && <p className="text-xs text-emerald-400/80">{runtimeState.reward_reason}</p>}
          {runtimeState.balance_preview && <p className="text-[10px] text-emerald-500">{runtimeState.balance_preview}</p>}
        </div>
      )}

      {/* ── Next Best Step capsule ── */}
      <div className="rounded-xl border border-white/5 bg-slate-950/80 p-4 space-y-3">
        <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-500">Next Best Step</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {nbePlan && (
            <span className="inline-flex items-center rounded-full border border-cyan-800/40 bg-cyan-950/30 px-2 py-0.5 text-[10px] font-semibold text-cyan-400">
              NBE {nbePlan.disposition} → {nbePlan.next_experience_depth}
            </span>
          )}
          {capsule && (
            <span className="inline-flex items-center rounded-full border border-indigo-800/40 bg-indigo-950/25 px-2 py-0.5 text-[10px] font-semibold text-indigo-300">
              next: {capsule.next_depth}
            </span>
          )}
        </div>
        <p className="text-sm font-semibold text-slate-100">{runtimeState.next_best_step.action}</p>
        <p className="text-xs text-slate-300 leading-relaxed">{runtimeState.next_best_step.rationale}</p>
        {nbePlan?.rationale && nbePlan.rationale !== runtimeState.next_best_step.rationale && (
          <p className="text-[11px] text-cyan-300/70">{nbePlan.rationale}</p>
        )}
        {runtimeState.next_best_step.unlock && (
          <p className="text-[11px] text-amber-400/80">
            Unlocks: {runtimeState.next_best_step.unlock}
          </p>
        )}
        {/* Investor privilege override — shown for unbacked investors */}
        {investorStatus?.isInvestor && !investorStatus.ksBacked && investorStatus.ksTrackingUrl ? (
          <div className="rounded-lg border border-amber-700/30 bg-amber-950/20 p-3 space-y-2">
            <p className="text-[10px] uppercase tracking-widest font-semibold text-amber-500/80">Investor privilege active</p>
            <p className="text-xs text-amber-200/80 leading-relaxed">
              As a <span className="font-semibold text-amber-300">{investorPrivilege.tier}</span> you unlock{" "}
              <span className="font-semibold text-amber-300">{investorPrivilege.discount} off</span> the {cohortOffer}.
              This Kickstarter-only privilege does not carry forward post-campaign.
            </p>
            <a
              href={investorStatus.ksTrackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-black transition"
            >
              Claim on Kickstarter <ArrowRight className="h-3 w-3" />
            </a>
          </div>
        ) : investorStatus?.isInvestor && investorStatus.ksBacked ? (
          <div className="rounded-lg border border-emerald-800/30 bg-emerald-950/15 p-3 space-y-1">
            <p className="text-[10px] uppercase tracking-widest font-semibold text-emerald-600">Patron confirmed</p>
            <p className="text-xs text-emerald-200/80">Your backing is live. Now activate your KNYT presence — signal, collect, and move up the Order.</p>
          </div>
        ) : (
          <button className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-black transition">
            Do this now <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* ── Kn0w1 intel capsule ── */}
      {runtimeState.handoffs.kn0w1 ? (
        <div className="rounded-xl border border-amber-900/30 bg-amber-950/15 p-4 space-y-3">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-amber-500/80">Kn0w1 — KNYT Intelligence</p>
          <p className="text-xs text-amber-200/70 leading-relaxed">
            Kn0w1 is your lead intelligence surface for the KNYT cartridge. Ask about treasury, rewards, Q¢ vs $KNYT, your progression, and what your next real move inside the system is.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-black transition"
              onClick={() => router.push("/aigents/aigent-kn0w1")}
            >
              <Brain className="h-3 w-3" /> Ask Kn0w1 <ArrowRight className="h-3 w-3" />
            </button>
            {runtimeState.handoffs.metame && (
              <button
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-slate-500 transition"
                onClick={() => router.push("/metame")}
              >
                See your path in metaMe
              </button>
            )}
            {runtimeState.handoffs.aigent_c && (
              <button className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-slate-500 transition">
                Builder path with Aigent C
              </button>
            )}
            {runtimeState.handoffs.marketa && (
              <button className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-slate-500 transition">
                Marketa context
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-white/5 bg-slate-950/80 p-4 space-y-3">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-500">Go Deeper</p>
          <div className="flex flex-wrap gap-2">
            {runtimeState.handoffs.metame && (
              <button
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-slate-500 transition"
                onClick={() => router.push("/metame")}
              >
                See your path in metaMe
              </button>
            )}
            {runtimeState.handoffs.aigent_c && (
              <button className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-slate-500 transition">
                Explore builder path with Aigent C
              </button>
            )}
            {runtimeState.handoffs.marketa && (
              <button className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-slate-500 transition">
                Launch context from Marketa
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Contribution path (conditional) ── */}
      {runtimeState.contributor_pathway_flag && (
        <div className="rounded-xl border border-fuchsia-900/30 bg-fuchsia-950/15 p-4 space-y-1">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-fuchsia-500/80">Contribution Path</p>
          <p className="text-xs text-fuchsia-200/80">You are eligible for deeper contributor pathways. Continue high-quality contribution signals to advance.</p>
        </div>
      )}

      {/* ── Stewardship path (conditional) ── */}
      {runtimeState.stewardship_candidate_flag && (
        <div className="rounded-xl border border-amber-900/30 bg-amber-950/15 p-4 space-y-1">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-amber-500/80">Stewardship Path</p>
          <p className="text-xs text-amber-200/80">Stewardship is active. Focus on world-supportive leadership actions and long-horizon alignment.</p>
        </div>
      )}

      {/* ── Recent activity (conditional) ── */}
      {runtimeState.current_signals.length > 0 && (
        <div className="rounded-xl border border-white/5 bg-slate-950/80 p-4 space-y-2">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-500 flex items-center gap-1.5">
            <Compass className="h-3 w-3 text-cyan-500" /> Recent Activity
          </p>
          {runtimeState.current_signals.map((signal, index) => (
            <p key={`${signal}-${index}`} className="text-xs text-slate-400">
              • You triggered {getActionLabel(signal)} in the live world.
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
