"use client";

import type { ReactNode } from "react";
import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CodexCopilotLayer,
  type CopilotMessage,
} from "@/app/components/codex/CodexCopilotLayer";
import { SmartContentCard, useOptionalSmartTriad } from "@/app/components/content";
import type { SmartContentQube } from "@/types/smartContent";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  ChevronRight,
  Compass,
  Heart,
  Layers,
  MessageCircle,
  Shuffle,
  Sparkles,
  Star,
  ThumbsUp,
  Upload,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ─── Accent colour map (all classes static — Tailwind won't purge) ────────────
type AccentColor = "amber" | "indigo" | "emerald" | "cyan" | "fuchsia";

const ACCENT: Record<
  AccentColor,
  {
    border: string; bg: string; label: string;
    dot: string; dotPast: string; dotFuture: string;
    badge: string; chip: string;
    nbeBorder: string; nbeBg: string; nbeText: string; nbeLabel: string;
  }
> = {
  amber: {
    border: "border-amber-800/30", bg: "bg-amber-950/10", label: "text-amber-500/80",
    dot: "bg-amber-400", dotPast: "bg-slate-600", dotFuture: "bg-amber-900/30",
    badge: "border-amber-500/40 bg-amber-500/10 text-amber-300",
    chip: "border-amber-700/50 bg-black/50 text-amber-300 hover:bg-amber-950/70",
    nbeBorder: "border-amber-800/30", nbeBg: "bg-amber-950/10",
    nbeText: "text-amber-300", nbeLabel: "text-amber-500/80",
  },
  indigo: {
    border: "border-indigo-800/30", bg: "bg-indigo-950/10", label: "text-indigo-500/80",
    dot: "bg-indigo-400", dotPast: "bg-slate-600", dotFuture: "bg-indigo-900/30",
    badge: "border-indigo-500/40 bg-indigo-500/10 text-indigo-300",
    chip: "border-indigo-700/50 bg-black/50 text-indigo-300 hover:bg-indigo-950/70",
    nbeBorder: "border-indigo-800/30", nbeBg: "bg-indigo-950/10",
    nbeText: "text-indigo-300", nbeLabel: "text-indigo-500/80",
  },
  emerald: {
    border: "border-emerald-800/30", bg: "bg-emerald-950/10", label: "text-emerald-500/80",
    dot: "bg-emerald-400", dotPast: "bg-slate-600", dotFuture: "bg-emerald-900/30",
    badge: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
    chip: "border-emerald-700/50 bg-black/50 text-emerald-300 hover:bg-emerald-950/70",
    nbeBorder: "border-emerald-800/30", nbeBg: "bg-emerald-950/10",
    nbeText: "text-emerald-300", nbeLabel: "text-emerald-500/80",
  },
  cyan: {
    border: "border-cyan-800/30", bg: "bg-cyan-950/10", label: "text-cyan-500/80",
    dot: "bg-cyan-400", dotPast: "bg-slate-600", dotFuture: "bg-cyan-900/30",
    badge: "border-cyan-500/40 bg-cyan-500/10 text-cyan-300",
    chip: "border-cyan-700/50 bg-black/50 text-cyan-300 hover:bg-cyan-950/70",
    nbeBorder: "border-cyan-800/30", nbeBg: "bg-cyan-950/10",
    nbeText: "text-cyan-300", nbeLabel: "text-cyan-500/80",
  },
  fuchsia: {
    border: "border-fuchsia-800/30", bg: "bg-fuchsia-950/10", label: "text-fuchsia-500/80",
    dot: "bg-fuchsia-400", dotPast: "bg-slate-600", dotFuture: "bg-fuchsia-900/30",
    badge: "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300",
    chip: "border-fuchsia-700/50 bg-black/50 text-fuchsia-300 hover:bg-fuchsia-950/70",
    nbeBorder: "border-fuchsia-800/30", nbeBg: "bg-fuchsia-950/10",
    nbeText: "text-fuchsia-300", nbeLabel: "text-fuchsia-500/80",
  },
};

// ─── Action meta ──────────────────────────────────────────────────────────────
type ActionId =
  | "vote" | "like" | "spark" | "curate"
  | "remix" | "respond" | "contribute" | "patronize" | "endorse";

const ACTION_META: Record<ActionId, { label: string; helper: string; Icon: React.ComponentType<{ className?: string }> }> = {
  vote:       { label: "Vote",       helper: "Shape what rises in the world.",                   Icon: CheckCircle2 },
  like:       { label: "Like",       helper: "Signal immediate resonance.",                      Icon: Heart },
  spark:      { label: "Spark",      helper: "Boost momentum for this moment.",                  Icon: Zap },
  curate:     { label: "Curate",     helper: "Begin shaping the Order with your taste.",         Icon: Layers },
  remix:      { label: "Remix",      helper: "Move from audience to maker.",                     Icon: Shuffle },
  contribute: { label: "Contribute", helper: "Submit a world-facing contribution.",              Icon: Upload },
  respond:    { label: "Respond",    helper: "Add your correspondent signal.",                   Icon: MessageCircle },
  patronize:  { label: "Patronize",  helper: "Deepen your place in the Order.",                 Icon: Star },
  endorse:    { label: "Endorse",    helper: "Signal strategic alignment.",                      Icon: ThumbsUp },
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface RuntimeApiState {
  journey?: { stage?: string; depth?: string };
  world_header?: { title: string; subtitle: string };
  signal_counts?: { like: number; spark: number; curate: number; total: number };
  knyt_balance?: number;
  nbe?: { disposition: string; next_experience_depth: string; rationale: string };
  featured_moment?: { content_id: string; branch?: string };
  available_actions?: Array<{ id: string; is_primary?: boolean }>;
  next_best_step?: { action: string; rationale: string; unlock?: string };
  handoffs?: { kn0w1?: boolean; metame?: boolean; aigent_c?: boolean; marketa?: boolean };
}

interface CapsuleState {
  depth: string; label: string; cta_label: string;
  cta_action: string; next_depth: string; fallback: boolean;
}

export interface CartridgeRuntimeTemplateProps {
  // TabRenderer standard
  personaId?: string;
  dataSource?: string;
  theme?: "light" | "dark";
  density?: "narrow" | "wide";
  // config.props spread
  cartridgeSlug?: string;
  worldLabel?: string;
  livingCanonEndpoint?: string;
  patronageAxis?: string[];
  pcsAxis?: string[];
  defaultStage?: string;
  defaultDepth?: string;
  accentColor?: AccentColor;
  pcsAccentColor?: AccentColor;
  agentLeadLabel?: string;
  agentLeadCopilotContextId?: string;
  investorCampaignEnabled?: boolean;
  signalEndpoints?: Record<string, string>;
}

// ─── AxisSteps ────────────────────────────────────────────────────────────────
function AxisSteps({
  label, axis, active, accentActive, accentText,
}: {
  label: string; axis: string[]; active: string;
  accentActive: string; accentText: string;
}) {
  const idx = axis.indexOf(active);
  return (
    <Card className="rounded-xl border border-slate-700/60 bg-slate-900/80 backdrop-blur-sm">
      <CardContent className="p-4 space-y-3">
        <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-500">{label}</p>
        <p className={`text-sm font-semibold ${accentText}`}>{active}</p>
        <div className="flex flex-wrap gap-1">
          {axis.map((stage, i) => (
            <span
              key={stage}
              className={
                i === idx
                  ? `inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${accentActive}`
                  : i < idx
                  ? "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] text-slate-500 bg-slate-800/60"
                  : "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] text-slate-600"
              }
            >
              {stage}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── ActionChip ───────────────────────────────────────────────────────────────
function ActionChip({
  actionId, isPrimary, disabled, loading, onClick,
}: {
  actionId: ActionId; isPrimary: boolean; disabled: boolean; loading: boolean; onClick: () => void;
}) {
  const meta = ACTION_META[actionId];
  if (!meta) return null;
  const Icon = meta.Icon;
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      title={meta.helper}
      className={
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed " +
        (isPrimary
          ? "border border-amber-700/50 bg-amber-950/30 backdrop-blur-sm text-amber-300 hover:bg-amber-950/50"
          : "border border-slate-700 text-slate-200 hover:border-slate-500 hover:text-white bg-white/[0.03] backdrop-blur-sm")
      }
    >
      {Icon && <Icon className="h-3 w-3" />}
      {meta.label}
    </button>
  );
}

// ─── Investor privilege helper ─────────────────────────────────────────────────
function getInvestorPrivilege(cohort: string | null | undefined, band: string | null | undefined) {
  if (cohort === "zero_knyt") return { tier: "Zero KNYT", discount: "25%", offer: "Zero KNYT collectible tier" };
  if (cohort === "top_shelf") return { tier: "Top KNYT Shelf", discount: "20%", offer: "Top KNYT Shelf (21 available)" };
  if (band === "5000+") return { tier: "First KNYT", discount: "20%", offer: "KNYT Codex collector path" };
  if (band === "2000-4999") return { tier: "Keji KNYT", discount: "15%", offer: "KNYT Codex collector path" };
  return { tier: "Keta KNYT", discount: "10%", offer: "KNYT Codex collector path" };
}

// ─── Stage strip ──────────────────────────────────────────────────────────────
function StageStrip({
  axis, currentStage, accentColor,
}: { axis: string[]; currentStage: string; accentColor: AccentColor }) {
  const a = ACCENT[accentColor];
  const idx = Math.max(0, axis.indexOf(currentStage));
  return (
    <div className="flex items-center gap-1.5">
      {axis.map((stage, i) => (
        <div
          key={stage} title={stage}
          className={`h-1 flex-1 rounded-full transition-all duration-500 ${
            i === idx ? a.dot : i < idx ? a.dotPast : a.dotFuture
          }`}
        />
      ))}
      <span className="ml-1 shrink-0 text-[10px] text-slate-500">{currentStage}</span>
    </div>
  );
}

// ─── NBE capsule ──────────────────────────────────────────────────────────────
function NBECapsule({
  capsule, nextStep, accentColor, onLaunch,
}: {
  capsule: CapsuleState | null;
  nextStep: { action: string; rationale: string; unlock?: string } | null;
  accentColor: AccentColor;
  onLaunch: () => void;
}) {
  const a = ACCENT[accentColor];
  const label = capsule?.label ?? nextStep?.action ?? "Explore next";
  const sub = capsule
    ? `${capsule.depth} → ${capsule.next_depth}`
    : nextStep?.rationale ?? "";
  return (
    <button
      onClick={onLaunch}
      className={`w-full text-left rounded-xl border ${a.nbeBorder} ${a.nbeBg} p-4 backdrop-blur-sm hover:brightness-110 transition-all group flex items-center justify-between`}
    >
      <div className="min-w-0 pr-3">
        <p className={`text-[10px] uppercase tracking-widest font-semibold ${a.nbeLabel} mb-0.5`}>
          Next Experience
        </p>
        <p className={`text-sm font-semibold ${a.nbeText}`}>{label}</p>
        {sub && (
          <p className="text-xs text-slate-400 mt-0.5 truncate">{sub}</p>
        )}
      </div>
      <ChevronRight
        className={`h-5 w-5 shrink-0 ${a.nbeText} group-hover:translate-x-0.5 transition-transform`}
      />
    </button>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function defaultActionsForIdx(idx: number): ActionId[] {
  if (idx === 0) return ["like", "spark", "vote", "patronize"];
  if (idx <= 2) return ["vote", "like", "spark", "curate"];
  if (idx <= 4) return ["vote", "curate", "spark", "remix"];
  return ["remix", "contribute", "respond", "endorse"];
}

function detectActionIntent(text: string, available: ActionId[]): ActionId | null {
  const lc = text.toLowerCase();
  const priority: ActionId[] = ["contribute", "curate", "vote", "remix", "spark", "like"];
  for (const id of priority) {
    if (available.includes(id) && lc.includes(id)) return id;
  }
  return null;
}

// ─── Main template ────────────────────────────────────────────────────────────
export function CartridgeRuntimeTemplate({
  personaId,
  dataSource,
  cartridgeSlug = "knyt-codex",
  worldLabel,
  livingCanonEndpoint,
  patronageAxis = ["OutsideOrder", "Acolyte", "Keta", "Keji", "First", "Zero", "Satoshi"],
  pcsAxis = ["Observer", "Collector", "Curator", "Remixer", "Creator", "Correspondent", "Steward", "FranchiseAligned"],
  defaultStage,
  defaultDepth,
  accentColor = "amber",
  agentLeadLabel,
  agentLeadCopilotContextId,
  investorCampaignEnabled = false,
  signalEndpoints = {},
}: CartridgeRuntimeTemplateProps) {
  const { toast } = useToast();
  const router = useRouter();
  const a = ACCENT[accentColor];
  const networkOnline = typeof navigator === "undefined" ? true : navigator.onLine;

  // ── State ─────────────────────────────────────────────────────────────────
  const [apiState, setApiState] = useState<RuntimeApiState | null>(null);
  const [capsule, setCapsule] = useState<CapsuleState | null>(null);
  const [featuredMoment, setFeaturedMoment] = useState<{ id: string; branch?: string } | null>(null);
  const [openElection, setOpenElection] = useState<{ id: string; title?: string } | null>(null);
  const [featuredContent, setFeaturedContent] = useState<SmartContentQube | null>(null);
  const [supportingContent, setSupportingContent] = useState<SmartContentQube[]>([]);
  const [investorStatus, setInvestorStatus] = useState<{
    isInvestor: boolean; ksBacked?: boolean;
    ksTrackingUrl?: string; campaignCohort?: string | null;
    investmentBand?: string | null;
  } | null>(null);
  const [balancePreview, setBalancePreview] = useState<string | undefined>();
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotMessages, setCopilotMessages] = useState<CopilotMessage[]>([]);
  const [submittingAction, setSubmittingAction] = useState<string | null>(null);
  const [signalHistory, setSignalHistory] = useState<string[]>([]);
  const [latestReward, setLatestReward] = useState<string | undefined>();

  // ── Resolved stage ────────────────────────────────────────────────────────
  const currentStage = apiState?.journey?.stage ?? defaultStage ?? patronageAxis[0];
  const currentDepth = apiState?.journey?.depth ?? defaultDepth ?? pcsAxis[0];
  const stageIdx = Math.max(0, patronageAxis.indexOf(currentStage));

  const availableActions: ActionId[] = (
    apiState?.available_actions?.map((x) => x.id as ActionId) ??
    defaultActionsForIdx(stageIdx)
  ).slice(0, 5);

  const nextBestStep = apiState?.next_best_step ?? null;
  const worldHeader = apiState?.world_header ?? null;
  const signalCounts = apiState?.signal_counts ?? null;
  const knytBalance = apiState?.knyt_balance ?? null;
  const nbePlan = apiState?.nbe ?? null;

  const contributorPathwayFlag = stageIdx >= Math.floor(patronageAxis.length * 0.57);
  const stewardshipCandidateFlag = stageIdx >= patronageAxis.length - 2;

  const handoffs = apiState?.handoffs ?? {
    kn0w1: !!agentLeadLabel,
    metame: !!personaId && stageIdx > 0,
    aigent_c: contributorPathwayFlag,
    marketa: stageIdx === 0,
  };

  const investorPrivilege = getInvestorPrivilege(
    investorStatus?.campaignCohort,
    investorStatus?.investmentBand,
  );

  // ── SmartTriad ────────────────────────────────────────────────────────────
  const smartTriad = useOptionalSmartTriad();
  const openContent = useCallback(async (content: SmartContentQube) => {
    if (!smartTriad) return;
    await smartTriad.actions.loadContent(content.id);
    smartTriad.actions.setViewerModality("read");
    smartTriad.actions.setActiveDrawer("contentViewer");
  }, [smartTriad]);
  const purchaseContent = useCallback(async (content: SmartContentQube) => {
    if (!smartTriad) return;
    await smartTriad.actions.loadContent(content.id);
    smartTriad.actions.openWallet("full");
  }, [smartTriad]);
  const isOwned = useCallback(
    (id: string) => (smartTriad ? smartTriad.actions.checkOwnership(id) : false),
    [smartTriad],
  );

  // ── Load runtime state ────────────────────────────────────────────────────
  useEffect(() => {
    if (!dataSource) return;
    let cancelled = false;
    const url = personaId
      ? `${dataSource}?personaId=${encodeURIComponent(personaId)}`
      : dataSource;
    fetch(url, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (!cancelled && data) setApiState(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [dataSource, personaId]);

  // ── Load capsule prescription ─────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    fetch("/api/experience/capsule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patronage_stage: currentStage, pcs_stage: currentDepth }),
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (!cancelled && data) setCapsule(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [currentStage, currentDepth]);

  // ── Load living canon (featured moment + election) ────────────────────────
  useEffect(() => {
    if (!livingCanonEndpoint) return;
    let cancelled = false;
    fetch(livingCanonEndpoint, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((payload) => {
        if (cancelled || !payload) return;
        const item =
          payload?.branches?.community?.items?.[0] ??
          payload?.branches?.canon?.items?.[0];
        setFeaturedMoment(item ? { id: item.id, branch: item.branch ?? "community" } : null);
        const election = payload?.open_elections?.[0];
        setOpenElection(election ? { id: election.id, title: election.title } : null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [livingCanonEndpoint]);

  // ── Fallback: editorial featured moment from API state ────────────────────
  useEffect(() => {
    if (apiState?.featured_moment?.content_id && !featuredMoment) {
      setFeaturedMoment({
        id: apiState.featured_moment.content_id,
        branch: apiState.featured_moment.branch ?? "editorial",
      });
    }
  }, [apiState?.featured_moment, featuredMoment]);

  // ── Load SmartContentQubes ────────────────────────────────────────────────
  useEffect(() => {
    if (!featuredMoment?.id) {
      setFeaturedContent(null);
      setSupportingContent([]);
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        const r = await fetch(
          `/api/content/smart/${encodeURIComponent(featuredMoment!.id)}`,
          { cache: "no-store" },
        );
        if (r.ok && !cancelled) {
          const d = await r.json();
          if (!cancelled && d?.data) setFeaturedContent(d.data);
        }
      } catch {}
      // Supporting items
      if (!livingCanonEndpoint) return;
      try {
        const r = await fetch(`${livingCanonEndpoint}?branch=community&limit=4`, { cache: "no-store" });
        if (!r.ok || cancelled) return;
        const payload = await r.json();
        const ids: string[] = (payload?.branches?.community?.items ?? [])
          .map((i: { id: string }) => i.id)
          .filter((id: string) => id !== featuredMoment?.id)
          .slice(0, 3);
        if (!ids.length || cancelled) return;
        const qubes = await Promise.all(
          ids.map((id) =>
            fetch(`/api/content/smart/${encodeURIComponent(id)}`, { cache: "no-store" })
              .then((r) => (r.ok ? r.json().then((d) => d?.data ?? null) : null)),
          ),
        );
        if (!cancelled) setSupportingContent(qubes.filter(Boolean) as SmartContentQube[]);
      } catch {}
    }
    load();
    return () => { cancelled = true; };
  }, [featuredMoment?.id, livingCanonEndpoint]);

  // ── Load investor status ──────────────────────────────────────────────────
  useEffect(() => {
    if (!investorCampaignEnabled || !personaId) return;
    let cancelled = false;
    fetch(
      `/api/crm/campaign/investor-status?personaId=${encodeURIComponent(personaId)}`,
      { cache: "no-store" },
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (!cancelled && data) setInvestorStatus(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [investorCampaignEnabled, personaId]);

  // ── Signal submission ─────────────────────────────────────────────────────
  async function submitSignalAction(actionId: string) {
    if (!personaId) {
      toast({ title: "Sign in to signal", description: "A persona is required.", variant: "destructive" });
      return;
    }
    const endpoint = signalEndpoints[actionId];
    if (!endpoint) {
      toast({ title: `${actionId} routed`, description: "Available via deeper pathways." });
      return;
    }
    if (!featuredMoment?.id) {
      toast({ title: "No featured content", description: "Wait for live content to load.", variant: "destructive" });
      return;
    }
    setSubmittingAction(actionId);
    try {
      let payload: Record<string, unknown> = {
        persona_id: personaId,
        content_id: featuredMoment.id,
      };
      if (actionId === "vote") {
        if (!openElection?.id) throw new Error("No open election available.");
        payload = {
          election_id: openElection.id,
          persona_id: personaId,
          voted_for: [featuredMoment.id],
          wallet_task_id: `runtime-${Date.now()}`,
        };
      } else if (actionId === "remix") {
        payload = {
          source_publication_id: featuredMoment.id,
          persona_id: personaId,
          task_slug: `${cartridgeSlug}:community_submission`,
        };
      } else if (actionId === "contribute") {
        payload = {
          persona_id: personaId,
          task_slug: `${cartridgeSlug}:community_submission`,
          branch_target: "community",
          status: "submitted",
          field_values: {
            title: `Contribution ${new Date().toISOString()}`,
            body: "Submitted from Runtime Surface.",
          },
          metadata: {
            source_publication_id: featuredMoment.id,
            source: "cartridge_runtime_template",
          },
        };
      }
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error ?? "Signal failed");
      setSignalHistory((prev) =>
        [actionId, ...prev.filter((s) => s !== actionId)].slice(0, 8),
      );
      const REWARD: Record<string, string> = {
        like: "Like recorded", spark: "Spark recorded",
        curate: "Curation eligibility increased", vote: "World vote recorded",
        remix: "Remix pathway updated", contribute: "Contribution submitted",
        respond: "Correspondent signal recorded", patronize: "Patronage intent recorded",
        endorse: "Endorsement recorded",
      };
      setLatestReward(REWARD[actionId] ?? "Signal recorded");
      setBalancePreview(actionId === "curate" ? "Potential +$KNYT pending settlement" : "Reward status updating");
      toast({ title: `${actionId.toUpperCase()} recorded`, description: `Signal sent.` });
    } catch (err) {
      toast({
        title: `${actionId.toUpperCase()} failed`,
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSubmittingAction(null);
    }
  }

  // ── QA2AGU: copilot prompt → rich React node ──────────────────────────────
  async function handleUserPrompt(prompt: string): Promise<string | ReactNode> {
    try {
      const res = await fetch("/api/codex/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: prompt,
          personaId,
          contextId: agentLeadCopilotContextId ?? `${cartridgeSlug}-runtime`,
          chatHistory: [],
          runtimeContext: {
            currentStage,
            currentDepth,
            featuredContentId: featuredMoment?.id,
            cartridgeSlug,
            nextBestStep: nextBestStep?.action,
          },
        }),
      });
      if (!res.ok) return "I encountered an issue. Please try again.";
      const data = await res.json();
      const text: string = data.response ?? "No response available.";
      const suggestedAction = detectActionIntent(text, availableActions);
      if (suggestedAction && signalEndpoints[suggestedAction]) {
        const meta = ACTION_META[suggestedAction];
        const Icon = meta.Icon;
        return (
          <div className="space-y-2.5">
            <p className="text-sm text-slate-200 leading-relaxed">{text}</p>
            <button
              onClick={() => { submitSignalAction(suggestedAction); setCopilotOpen(false); }}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold backdrop-blur-sm transition-colors ${a.chip}`}
            >
              <Icon className="h-3 w-3" />
              {meta.label} now
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        );
      }
      return text;
    } catch {
      return "Something went wrong. Try again.";
    }
  }

  // ── NBE launch ────────────────────────────────────────────────────────────
  function handleNBELaunch() {
    if (capsule?.cta_action === "open_wallet") {
      smartTriad?.actions.openWallet("full");
    } else if (capsule?.cta_action === "open_codex") {
      router.push("/codex");
    } else {
      setCopilotOpen(true);
    }
  }

  const unbackedInvestor =
    investorStatus?.isInvestor && !investorStatus.ksBacked && investorStatus.ksTrackingUrl;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">
    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
    <div className="flex flex-col gap-4 p-4 md:p-5">

      {/* Status strip */}
      <div className={`rounded-xl border ${a.border} ${a.bg} px-4 py-2.5 backdrop-blur-sm`}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <p className={`text-[10px] uppercase tracking-widest font-semibold ${a.label}`}>
            {worldLabel ?? worldHeader?.title ?? cartridgeSlug}
          </p>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="outline" className={`${a.badge} text-[10px]`}>
              {currentStage}
            </Badge>
            <Badge
              variant="outline"
              className="border-slate-600/40 bg-slate-800/30 text-slate-300 text-[10px] gap-1"
            >
              {networkOnline
                ? <Wifi className="h-2.5 w-2.5 text-emerald-400" />
                : <WifiOff className="h-2.5 w-2.5 text-rose-400" />}
              {networkOnline ? "Live" : "Offline"}
            </Badge>
            {investorStatus?.isInvestor && investorStatus.ksBacked && (
              <Badge variant="outline" className="border-emerald-700/30 bg-emerald-900/30 text-emerald-400 text-[10px]">
                ✓ Patron
              </Badge>
            )}
          </div>
        </div>
        <StageStrip
          axis={patronageAxis}
          currentStage={currentStage}
          accentColor={accentColor}
        />
        {worldHeader?.subtitle && (
          <p className="text-[11px] text-slate-500 mt-1.5 leading-snug">
            {worldHeader.subtitle}
          </p>
        )}
      </div>

      {/* Hero zone — SmartContentCard with overlaid NBA chips */}
      {featuredContent ? (
        <div className="relative">
          <SmartContentCard
            content={featuredContent}
            variant="hero"
            heroHeight="short"
            device="desktop"
            onSelect={openContent}
            onPurchase={purchaseContent}
            isOwned={isOwned(featuredContent.id)}
          />
          {/* Overlaid chips */}
          <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-end gap-1.5 pointer-events-none">
            {availableActions.slice(0, 4).map((actionId) => {
              const meta = ACTION_META[actionId];
              if (!meta) return null;
              const Icon = meta.Icon;
              const disabled =
                submittingAction === actionId ||
                (actionId === "vote" && !openElection?.id);
              return (
                <button
                  key={actionId}
                  disabled={disabled}
                  onClick={() => submitSignalAction(actionId)}
                  className={`pointer-events-auto inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm transition-colors disabled:opacity-40 ${a.chip}`}
                >
                  <Icon className="h-3 w-3" />
                  {meta.label}
                </button>
              );
            })}
            {/* Investor chip */}
            {unbackedInvestor && (
              <a
                href={investorStatus!.ksTrackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`pointer-events-auto ml-auto inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm transition-colors ${a.chip}`}
              >
                <Star className="h-3 w-3" />
                Back on KS
                <ArrowRight className="h-2.5 w-2.5" />
              </a>
            )}
          </div>
        </div>
      ) : (
        /* Loading / empty state */
        <div
          className={`rounded-xl border ${a.border} ${a.bg} h-52 flex items-center justify-center backdrop-blur-sm`}
        >
          <div className="text-center space-y-2">
            <Sparkles className={`h-5 w-5 mx-auto ${a.label} animate-pulse`} />
            <p className="text-xs text-slate-500">
              {worldHeader?.title ?? "Loading featured content…"}
            </p>
          </div>
        </div>
      )}

      {/* Supporting content — horizontal scroll */}
      {supportingContent.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory">
          {supportingContent.map((item) => (
            <div key={item.id} className="flex-shrink-0 w-44 snap-start relative">
              <SmartContentCard
                content={item}
                variant="thumbnailRect"
                device="mobile"
                onSelect={openContent}
                onPurchase={purchaseContent}
                isOwned={isOwned(item.id)}
              />
              <button
                onClick={() => openContent(item)}
                className="absolute bottom-2 right-2 inline-flex items-center gap-0.5 rounded-full bg-black/60 backdrop-blur-sm px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-black/80 transition"
              >
                Open <ArrowRight className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* NBE capsule — next experience launch */}
      {(capsule || nextBestStep) && (
        <NBECapsule
          capsule={capsule}
          nextStep={nextBestStep}
          accentColor={accentColor}
          onLaunch={handleNBELaunch}
        />
      )}


      {/* ── Axis progress ── */}
      <div className="grid gap-4 md:grid-cols-2">
        <AxisSteps
          label="PATRONAGE AXIS"
          axis={patronageAxis}
          active={currentStage}
          accentActive="bg-amber-500/15 border-amber-500/40 text-amber-300"
          accentText="text-amber-300"
        />
        <AxisSteps
          label="PCS AXIS"
          axis={pcsAxis}
          active={currentDepth}
          accentActive="bg-indigo-500/15 border-indigo-500/40 text-indigo-300"
          accentText="text-indigo-300"
        />
      </div>

      {/* ── Full signal action tray ── */}
      <Card className="rounded-xl border border-slate-700/60 bg-slate-900/80 backdrop-blur-sm">
        <CardContent className="p-4 space-y-3">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-500">Signal Action Tray</p>
          <div className="flex flex-wrap gap-2">
            {unbackedInvestor && (
              <a
                href={investorStatus!.ksTrackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-700/50 bg-amber-950/30 backdrop-blur-sm px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-950/50 transition"
              >
                <Star className="h-3 w-3" />
                {investorPrivilege.tier} — {investorPrivilege.discount} off
                <ArrowRight className="h-3 w-3" />
              </a>
            )}
            {availableActions.map((actionId, i) => (
              <ActionChip
                key={actionId}
                actionId={actionId}
                isPrimary={i === 0}
                disabled={!!(actionId === "vote" && !openElection?.id)}
                loading={submittingAction === actionId}
                onClick={() => submitSignalAction(actionId)}
              />
            ))}
          </div>
          <p className="text-[11px] text-slate-500">
            {ACTION_META[availableActions[0]]?.helper}
          </p>
          {signalCounts && signalCounts.total > 0 && (
            <div className="flex flex-wrap gap-3 text-[10px] text-slate-600">
              {signalCounts.like > 0 && <span>{signalCounts.like} like{signalCounts.like !== 1 ? "s" : ""}</span>}
              {signalCounts.spark > 0 && <span>{signalCounts.spark} spark{signalCounts.spark !== 1 ? "s" : ""}</span>}
              {signalCounts.curate > 0 && <span>{signalCounts.curate} curation{signalCounts.curate !== 1 ? "s" : ""}</span>}
              <span>— {signalCounts.total} total</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Reward + Progress ── */}
      {(latestReward || balancePreview || (knytBalance !== null && knytBalance > 0)) && (
        <Card className="rounded-xl border border-emerald-900/30 bg-emerald-950/10 backdrop-blur-sm">
          <CardContent className="p-4 space-y-2">
            <p className="text-[10px] uppercase tracking-widest font-semibold text-emerald-600">Reward + Progress</p>
            {knytBalance !== null && knytBalance > 0 && (
              <p className="text-sm font-semibold text-emerald-100">{knytBalance.toFixed(4)} $KNYT</p>
            )}
            {latestReward && <p className="text-xs text-emerald-200">{latestReward}</p>}
            {balancePreview && <p className="text-[10px] text-emerald-500">{balancePreview}</p>}
          </CardContent>
        </Card>
      )}

      {/* ── Next Best Step ── */}
      <Card className="rounded-xl border border-slate-700/60 bg-slate-900/80 backdrop-blur-sm">
        <CardContent className="p-4 space-y-3">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-500">Next Best Step</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {nbePlan && (
              <Badge variant="outline" className="border-cyan-800/40 bg-cyan-950/20 text-cyan-400 backdrop-blur-sm text-[10px]">
                NBE {nbePlan.disposition} → {nbePlan.next_experience_depth}
              </Badge>
            )}
            {capsule && (
              <Badge variant="outline" className="border-indigo-800/40 bg-indigo-950/20 text-indigo-300 backdrop-blur-sm text-[10px]">
                next: {capsule.next_depth}
              </Badge>
            )}
          </div>
          {nextBestStep ? (
            <>
              <p className="text-sm font-semibold text-slate-100">{nextBestStep.action}</p>
              <p className="text-xs text-slate-300 leading-relaxed">{nextBestStep.rationale}</p>
              {nbePlan?.rationale && nbePlan.rationale !== nextBestStep.rationale && (
                <p className="text-[11px] text-cyan-300/70">{nbePlan.rationale}</p>
              )}
              {nextBestStep.unlock && (
                <p className="text-[11px] text-amber-400/80">Unlocks: {nextBestStep.unlock}</p>
              )}
            </>
          ) : (
            <p className="text-xs text-slate-400">Keep engaging — your next step is being calculated.</p>
          )}
          {unbackedInvestor ? (
            <div className="rounded-lg border border-amber-700/25 bg-amber-950/10 p-3 space-y-2">
              <p className="text-[10px] uppercase tracking-widest font-semibold text-amber-500/80">Investor privilege active</p>
              <p className="text-xs text-amber-200/80 leading-relaxed">
                As a <span className="font-semibold text-amber-300">{investorPrivilege.tier}</span> you unlock{" "}
                <span className="font-semibold text-amber-300">{investorPrivilege.discount} off</span> the {investorPrivilege.offer}.
              </p>
              <a
                href={investorStatus!.ksTrackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-700/50 bg-amber-950/30 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-950/50 transition"
              >
                Claim on Kickstarter <ArrowRight className="h-3 w-3" />
              </a>
            </div>
          ) : investorStatus?.isInvestor && investorStatus.ksBacked ? (
            <div className="rounded-lg border border-emerald-800/25 bg-emerald-950/10 p-3 space-y-1">
              <p className="text-[10px] uppercase tracking-widest font-semibold text-emerald-600">Patron confirmed</p>
              <p className="text-xs text-emerald-200/80">Your backing is live. Signal, collect, and move up the Order.</p>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="rounded-full border-amber-700/50 bg-amber-950/30 text-amber-300 hover:bg-amber-950/50 gap-1.5"
              onClick={() => setCopilotOpen(true)}
            >
              Do this now <ArrowRight className="h-3 w-3" />
            </Button>
          )}
        </CardContent>
      </Card>

      {/* ── Agent handoffs ── */}
      {handoffs.kn0w1 ? (
        <Card className="rounded-xl border border-amber-900/25 bg-amber-950/10 backdrop-blur-sm">
          <CardContent className="p-4 space-y-3">
            <p className="text-xs uppercase tracking-wide text-amber-500/80">
              {agentLeadLabel ?? "Intelligence"} — {worldLabel ?? cartridgeSlug}
            </p>
            <p className="text-xs text-amber-200/70 leading-relaxed">
              Your lead intelligence surface for this cartridge. Ask about treasury, rewards, progression, and your next real move.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm"
                className="rounded-full border-amber-700/50 bg-amber-950/30 text-amber-300 hover:bg-amber-950/50 gap-1.5"
                onClick={() => setCopilotOpen(true)}
              >
                <Brain className="h-3 w-3" />
                Ask {agentLeadLabel ?? "agent"}
                <ArrowRight className="h-3 w-3" />
              </Button>
              {handoffs.metame && (
                <Button variant="outline" size="sm"
                  className="rounded-full border-slate-700 text-slate-200 hover:border-slate-500 gap-1.5"
                  onClick={() => router.push("/metame")}
                >
                  See your path in metaMe
                </Button>
              )}
              {handoffs.aigent_c && (
                <Button variant="outline" size="sm"
                  className="rounded-full border-slate-700 text-slate-200 hover:border-slate-500"
                >
                  Builder path with Aigent C
                </Button>
              )}
              {handoffs.marketa && (
                <Button variant="outline" size="sm"
                  className="rounded-full border-slate-700 text-slate-200 hover:border-slate-500"
                >
                  Marketa context
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (handoffs.metame || handoffs.aigent_c || handoffs.marketa) ? (
        <Card className="rounded-xl border border-slate-700/60 bg-slate-900/80 backdrop-blur-sm">
          <CardContent className="p-4 space-y-3">
            <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-500">Go Deeper</p>
            <div className="flex flex-wrap gap-2">
              {handoffs.metame && (
                <Button variant="outline" size="sm"
                  className="rounded-full border-slate-700 text-slate-200 hover:border-slate-500 gap-1.5"
                  onClick={() => router.push("/metame")}
                >
                  See your path in metaMe
                </Button>
              )}
              {handoffs.aigent_c && (
                <Button variant="outline" size="sm"
                  className="rounded-full border-slate-700 text-slate-200 hover:border-slate-500"
                >
                  Explore builder path with Aigent C
                </Button>
              )}
              {handoffs.marketa && (
                <Button variant="outline" size="sm"
                  className="rounded-full border-slate-700 text-slate-200 hover:border-slate-500"
                >
                  Launch context from Marketa
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* ── Contribution path ── */}
      {contributorPathwayFlag && (
        <Card className="rounded-xl border border-fuchsia-900/25 bg-fuchsia-950/10 backdrop-blur-sm">
          <CardContent className="p-4 space-y-1">
            <p className="text-xs uppercase tracking-wide text-fuchsia-500/80">Contribution Path</p>
            <p className="text-xs text-fuchsia-200/80">You are eligible for deeper contributor pathways. Continue high-quality contribution signals to advance.</p>
          </CardContent>
        </Card>
      )}

      {/* ── Stewardship path ── */}
      {stewardshipCandidateFlag && (
        <Card className="rounded-xl border border-amber-900/25 bg-amber-950/10 backdrop-blur-sm">
          <CardContent className="p-4 space-y-1">
            <p className="text-xs uppercase tracking-wide text-amber-500/80">Stewardship Path</p>
            <p className="text-xs text-amber-200/80">Stewardship is active. Focus on world-supportive leadership actions and long-horizon alignment.</p>
          </CardContent>
        </Card>
      )}

      {/* ── Recent activity ── */}
      {signalHistory.length > 0 && (
        <Card className="rounded-xl border border-slate-700/60 bg-slate-900/80 backdrop-blur-sm">
          <CardContent className="p-4 space-y-2">
            <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-500 flex items-center gap-1.5">
              <Compass className="h-3 w-3 text-cyan-500" /> Recent Activity
            </p>
            {signalHistory.map((sig, i) => (
              <p key={`${sig}-${i}`} className="text-xs text-slate-400">
                • You triggered {ACTION_META[sig as ActionId]?.label ?? sig} in the live world.
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Floating copilot */}
      <CodexCopilotLayer
        isOpen={copilotOpen}
        onClose={() => setCopilotOpen(false)}
        onOpen={() => setCopilotOpen(true)}
        variant="floating"
        enableInferenceRendering
        personaId={personaId}
        contextId={agentLeadCopilotContextId ?? `${cartridgeSlug}-runtime`}
        messages={copilotMessages}
        onMessagesChange={setCopilotMessages}
        onUserPrompt={handleUserPrompt}
      />
    </div>
    </div>
    </div>
  );
}
