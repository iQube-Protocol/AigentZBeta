"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CodexCopilotLayer,
  type CopilotMessage,
} from "@/app/components/codex/CodexCopilotLayer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { useNbePlan } from "@/app/hooks/useNbePlan";
import { emitClientOrchestrationEvent } from "@/services/orchestration/emitClientEvent";
import { buildCodexUrl } from "@/utils/codex-nav";

// ─── KNYT axis config ─────────────────────────────────────────────────────────
const PATRONAGE_AXIS = [
  "OutsideOrder", "Acolyte", "Keta", "Keji", "First", "Zero", "Satoshi",
];
const PCS_AXIS = [
  "Observer", "Collector", "Curator", "Remixer", "Creator",
  "Correspondent", "Steward", "FranchiseAligned",
];
const SIGNAL_ENDPOINTS: Record<string, string> = {
  like:       "/api/codex/knyt/living-canon/like",
  spark:      "/api/codex/knyt/living-canon/spark",
  vote:       "/api/codex/knyt/living-canon/vote",
  curate:     "/api/codex/knyt/living-canon/curate",
  remix:      "/api/codex/knyt/living-canon/remix",
  contribute: "/api/codex/knyt/living-canon/contribute",
};

// ─── Accent (all class strings static — Tailwind won't purge) ─────────────────
const A = {
  border: "border-amber-800/30", bg: "bg-amber-950/10", label: "text-amber-500/80",
  dot: "bg-amber-400", dotPast: "bg-slate-600", dotFuture: "bg-amber-900/30",
  badge: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  chip: "border-amber-700/50 bg-black/50 text-amber-300 hover:bg-amber-950/70",
  nbeBorder: "border-amber-800/30", nbeBg: "bg-amber-950/10",
  nbeText: "text-amber-300", nbeLabel: "text-amber-500/80",
};

// ─── Action meta ──────────────────────────────────────────────────────────────
type ActionId =
  | "vote" | "like" | "spark" | "curate"
  | "remix" | "respond" | "contribute" | "patronize" | "endorse";

const ACTION_META: Record<ActionId, { label: string; helper: string; Icon: React.ComponentType<{ className?: string }> }> = {
  vote:       { label: "Vote",       helper: "Shape what rises in the world.",          Icon: CheckCircle2 },
  like:       { label: "Like",       helper: "Signal immediate resonance.",             Icon: Heart },
  spark:      { label: "Spark",      helper: "Boost momentum for this moment.",         Icon: Zap },
  curate:     { label: "Curate",     helper: "Begin shaping the Order with your taste.",Icon: Layers },
  remix:      { label: "Remix",      helper: "Move from audience to maker.",            Icon: Shuffle },
  contribute: { label: "Contribute", helper: "Submit a world-facing contribution.",     Icon: Upload },
  respond:    { label: "Respond",    helper: "Add your correspondent signal.",          Icon: MessageCircle },
  patronize:  { label: "Patronize",  helper: "Deepen your place in the Order.",        Icon: Star },
  endorse:    { label: "Endorse",    helper: "Signal strategic alignment.",             Icon: ThumbsUp },
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface RuntimeState {
  journey?: { stage?: string; depth?: string };
  world_header?: { title: string; subtitle: string };
  signal_counts?: { like: number; spark: number; curate: number; total: number };
  knyt_balance?: number;
  nbe?: { disposition: string; next_experience_depth: string; rationale: string };
  next_best_step?: { action: string; rationale: string; unlock?: string };
  handoffs?: { kn0w1?: boolean; metame?: boolean; aigent_c?: boolean; marketa?: boolean };
}

interface CapsuleState {
  depth: string; label: string; next_depth: string;
  cta_action: string; fallback: boolean;
}

export interface KnytRuntimeTabProps {
  personaId?: string;
  theme?: "light" | "dark";
  density?: "narrow" | "wide";
  codexId?: string;
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function StageStrip({ axis, current }: { axis: string[]; current: string }) {
  const idx = Math.max(0, axis.indexOf(current));
  return (
    <div className="flex items-center gap-1.5">
      {axis.map((s, i) => (
        <div
          key={s} title={s}
          className={`h-1 flex-1 rounded-full transition-all ${
            i === idx ? A.dot : i < idx ? A.dotPast : A.dotFuture
          }`}
        />
      ))}
      <span className="ml-1 shrink-0 text-[10px] text-slate-500">{current}</span>
    </div>
  );
}

function AxisCard({
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
          {axis.map((s, i) => (
            <span
              key={s}
              className={
                i === idx
                  ? `inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${accentActive}`
                  : i < idx
                  ? "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] text-slate-500 bg-slate-800/60"
                  : "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] text-slate-600"
              }
            >
              {s}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function NBECard({
  capsule, nextStep, onLaunch,
}: {
  capsule: CapsuleState | null;
  nextStep: RuntimeState["next_best_step"] | null;
  onLaunch: () => void;
}) {
  const label = capsule?.label ?? nextStep?.action ?? "Explore next";
  const sub = capsule
    ? `${capsule.depth} → ${capsule.next_depth}`
    : nextStep?.rationale ?? "";
  return (
    <button
      onClick={onLaunch}
      className={`w-full text-left rounded-xl border ${A.nbeBorder} ${A.nbeBg} p-4 backdrop-blur-sm hover:brightness-110 transition-all group flex items-center justify-between`}
    >
      <div className="min-w-0 pr-3">
        <p className={`text-[10px] uppercase tracking-widest font-semibold ${A.nbeLabel} mb-0.5`}>Next Experience</p>
        <p className={`text-sm font-semibold ${A.nbeText}`}>{label}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5 truncate">{sub}</p>}
      </div>
      <ChevronRight className={`h-5 w-5 shrink-0 ${A.nbeText} group-hover:translate-x-0.5 transition-transform`} />
    </button>
  );
}

function defaultActions(stageIdx: number): ActionId[] {
  if (stageIdx === 0) return ["like", "spark", "vote", "patronize"];
  if (stageIdx <= 2)  return ["vote", "like", "spark", "curate"];
  if (stageIdx <= 4)  return ["vote", "curate", "spark", "remix"];
  return ["remix", "contribute", "respond", "endorse"];
}

// ─── Main component ───────────────────────────────────────────────────────────
export function KnytRuntimeTab({ personaId, theme, density, codexId }: KnytRuntimeTabProps) {
  const { toast } = useToast();
  const router = useRouter();

  // ── State ──────────────────────────────────────────────────────────────────
  const [apiState, setApiState] = useState<RuntimeState | null>(null);
  const [capsule, setCapsule] = useState<CapsuleState | null>(null);
  const [streamConnected, setStreamConnected] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotMessages, setCopilotMessages] = useState<CopilotMessage[]>([]);
  const [submittingAction, setSubmittingAction] = useState<string | null>(null);
  const [signalHistory, setSignalHistory] = useState<string[]>([]);
  const [latestReward, setLatestReward] = useState<string | undefined>();
  const [copilotSuggestions, setCopilotSuggestions] = useState<
    Array<{ actionId: ActionId; reason: string }>
  >([]);
  const [networkOnline, setNetworkOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  // ── Canonical NBE plan (SoT — /api/runtime/nbe) ────────────────────────────
  // Cartridge-shaped state (apiState.nbe) is rendered as a fallback while the
  // canonical plan loads; once loaded we render fields from the persisted
  // NBEPlan row, which carries id + expires_at for downstream events.
  const { plan: nbePlan, refetch: refetchNbe } = useNbePlan(personaId);

  // ── Derived values ─────────────────────────────────────────────────────────
  const currentStage = apiState?.journey?.stage ?? PATRONAGE_AXIS[0];
  const currentDepth = apiState?.journey?.depth ?? PCS_AXIS[0];
  const stageIdx = Math.max(0, PATRONAGE_AXIS.indexOf(currentStage));
const availableActions = defaultActions(stageIdx);
  const progressPct = Math.round(((stageIdx + 1) / PATRONAGE_AXIS.length) * 100);
  const worldTitle = apiState?.world_header?.title ?? "The Order of KNYT";
  const worldSub = apiState?.world_header?.subtitle ?? "Your living journey through the KNYT universe";

  // ── Network listeners ──────────────────────────────────────────────────────
  useEffect(() => {
    const up = () => setNetworkOnline(true);
    const down = () => setNetworkOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  // ── Fetch REST state ───────────────────────────────────────────────────────
  const refetchState = useCallback(async () => {
    try {
      const url = personaId
        ? `/api/runtime/knyt-state?personaId=${encodeURIComponent(personaId)}`
        : "/api/runtime/knyt-state";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setApiState(data);
      }
    } catch {
      // silent — SSE will retry
    }
  }, [personaId]);

  useEffect(() => {
    refetchState();
  }, [refetchState]);

  // ── SSE stream ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!networkOnline) return;
    const url = personaId
      ? `/api/runtime/knyt-stream?personaId=${encodeURIComponent(personaId)}`
      : "/api/runtime/knyt-stream";
    const es = new EventSource(url);
    es.addEventListener("open", () => setStreamConnected(true));
    es.addEventListener("error", () => setStreamConnected(false));
    es.addEventListener("refresh", () => { refetchState(); });
    es.addEventListener("state", (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data) as RuntimeState;
        setApiState(data);
      } catch {
        // ignore malformed frames
      }
    });
    es.addEventListener("suggestion", (ev) => {
      try {
        const s = JSON.parse((ev as MessageEvent).data);
        if (Array.isArray(s)) setCopilotSuggestions(s);
      } catch {
        // ignore
      }
    });
    return () => { es.close(); setStreamConnected(false); };
  }, [networkOnline, personaId, refetchState]);

  // ── Capsule fetch ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!personaId) return;
    fetch(`/api/codex/knyt/capsule?personaId=${encodeURIComponent(personaId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setCapsule(d); })
      .catch(() => {});
  }, [personaId]);

  // ── Signal action ──────────────────────────────────────────────────────────
  const submitSignalAction = useCallback(
    async (actionId: ActionId) => {
      if (submittingAction) return;
      const endpoint = SIGNAL_ENDPOINTS[actionId];
      if (!endpoint) return;
      setSubmittingAction(actionId);
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ personaId, codexId }),
        });
        if (res.ok) {
          const data = await res.json();
          const reward = data?.reward ?? data?.message;
          if (reward) setLatestReward(String(reward));
          setSignalHistory((h) => [actionId, ...h].slice(0, 8));
          toast({
            title: ACTION_META[actionId]?.label ?? actionId,
            description: reward ?? "Signal recorded.",
          });
          if (personaId) {
            void emitClientOrchestrationEvent({
              event_type: "specialist_invoked",
              persona_id: personaId,
              // journey_stage left null — KNYT axis labels do not map to the
              // canonical JourneyStage union. Server can backfill from
              // journey_states if/when needed for indexing.
              journey_stage: null,
              active_cartridge: "knyt",
              active_codex: codexId ?? "knyt-codex",
              from_role: "cartridge-lead",
              to_role: "specialist",
              reason: `signal_emitted:${actionId}`,
              metadata: {
                signal_action: actionId,
                endpoint,
                reward: reward ?? null,
                knyt_axis_stage: currentStage,
              },
            });
          }
          refetchState();
          // Signal may advance stage/depth server-side; pull fresh NBE.
          void refetchNbe();
        } else {
          toast({ title: "Signal failed", description: "Please try again.", variant: "destructive" });
        }
      } catch {
        toast({ title: "Network error", description: "Could not send signal.", variant: "destructive" });
      } finally {
        setSubmittingAction(null);
      }
    },
    [submittingAction, personaId, codexId, currentStage, toast, refetchState, refetchNbe],
  );

  // ── Copilot QA2AGU ────────────────────────────────────────────────────────
  const handleUserPrompt = useCallback(
    async (prompt: string) => {
      const userMsg: CopilotMessage = { role: "user", content: prompt };
      setCopilotMessages((m) => [...m, userMsg]);
      try {
        const res = await fetch("/api/codex/knyt/copilot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ personaId, message: prompt, context: apiState }),
        });
        if (res.ok) {
          const { reply } = await res.json();
          setCopilotMessages((m) => [...m, { role: "assistant", content: reply }]);
        }
      } catch {
        setCopilotMessages((m) => [
          ...m,
          { role: "assistant", content: "I couldn't reach the KNYT oracle right now." },
        ]);
      }
    },
    [personaId, apiState],
  );

  // ── NBE launch ─────────────────────────────────────────────────────────────
  const handleNBELaunch = useCallback(() => {
    const action = capsule?.cta_action ?? apiState?.next_best_step?.action;
    if (!action) { setCopilotOpen(true); return; }
    const next =
      capsule?.next_depth ??
      nbePlan?.next_experience_depth ??
      apiState?.nbe?.next_experience_depth;

    // Emit orchestration event so the launch joins the audit trail.
    if (personaId) {
      void emitClientOrchestrationEvent({
        event_type: "cartridge_lead_active",
        persona_id: personaId,
        journey_stage: null,
        active_cartridge: "knyt",
        active_codex: codexId ?? "knyt-codex",
        from_role: "aigent-z",
        to_role: "cartridge-lead",
        reason: "nbe_launched",
        metadata: {
          action,
          nbe_id: nbePlan?.id ?? null,
          next_experience_depth: next ?? null,
          source_surface: "knyt-runtime",
          knyt_axis_stage: currentStage,
        },
      });
    }

    // L3 codex depth → navigate into the KNYT codex via buildCodexUrl so
    // personaId travels with the link. Other depths stay on the runtime
    // surface (the depth ladder transition is handled in-tab).
    if (next === "L3 codex" || next === "codex") {
      router.push(
        buildCodexUrl("knyt-codex", {
          personaId,
          from: "knyt-runtime",
        }),
      );
      return;
    }
    const params = new URLSearchParams();
    if (personaId) params.set("personaId", personaId);
    if (next) params.set("depth", next);
    router.push(`/runtime?${params.toString()}`);
  }, [capsule, apiState, nbePlan, personaId, codexId, currentStage, router]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="relative flex flex-col min-h-0 gap-4 px-4 pb-20 pt-4 overflow-y-auto">

      {/* ── Header strip ── */}
      <div className={`flex flex-col gap-1 rounded-xl border ${A.border} ${A.bg} px-4 py-3 backdrop-blur-sm`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="h-4 w-4 shrink-0 text-amber-400" />
            <p className="truncate text-sm font-semibold text-white">{worldTitle}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {streamConnected
              ? <Wifi className="h-3.5 w-3.5 text-emerald-400" />
              : <WifiOff className="h-3.5 w-3.5 text-slate-500" />}
            <Badge className={`text-[10px] ${A.badge}`}>{currentStage}</Badge>
          </div>
        </div>
        <p className="text-xs text-slate-400 truncate">{worldSub}</p>
        <StageStrip axis={PATRONAGE_AXIS} current={currentStage} />
      </div>

      {/* ── Copilot suggestion strip ── */}
      {copilotSuggestions.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {copilotSuggestions.slice(0, 3).map((s, i) => {
            const meta = ACTION_META[s.actionId];
            if (!meta) return null;
            return (
              <button
                key={i}
                onClick={() => submitSignalAction(s.actionId)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${A.chip} transition-all`}
              >
                <Brain className="h-3 w-3" />
                <span>{meta.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── NBE card ── */}
      <NBECard capsule={capsule} nextStep={apiState?.next_best_step ?? null} onLaunch={handleNBELaunch} />

      {/* ── Axis cards ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <AxisCard
          label="Patronage Stage"
          axis={PATRONAGE_AXIS}
          active={currentStage}
          accentActive={A.badge}
          accentText="text-amber-300"
        />
        <AxisCard
          label="Content & Creation Spectrum"
          axis={PCS_AXIS}
          active={currentDepth}
          accentActive="border-indigo-500/40 bg-indigo-500/10 text-indigo-300"
          accentText="text-indigo-300"
        />
      </div>

      {/* ── Signal action tray ── */}
      <Card className="rounded-xl border border-slate-700/60 bg-slate-900/80 backdrop-blur-sm">
        <CardContent className="p-4">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-500 mb-3">Signal Actions</p>
          <div className="flex flex-wrap gap-2">
            {availableActions.map((id) => {
              const meta = ACTION_META[id];
              const busy = submittingAction === id;
              return (
                <button
                  key={id}
                  disabled={!!submittingAction}
                  onClick={() => submitSignalAction(id)}
                  title={meta.helper}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${A.chip} disabled:opacity-50 transition-all`}
                >
                  {busy
                    ? <span className="h-3 w-3 rounded-full border border-amber-400 border-t-transparent animate-spin" />
                    : <meta.Icon className="h-3 w-3" />}
                  {meta.label}
                </button>
              );
            })}
          </div>
          {latestReward && (
            <p className="mt-2 text-xs text-amber-400/80 flex items-center gap-1">
              <Zap className="h-3 w-3" />{latestReward}
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Progress card ── */}
      <Card className="rounded-xl border border-slate-700/60 bg-slate-900/80 backdrop-blur-sm">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-500">Journey Progress</p>
            <span className="text-xs text-amber-400">{progressPct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-amber-400 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {apiState?.signal_counts && (
            <div className="flex gap-3 pt-1">
              {(["like","spark","curate"] as const).map((k) => (
                <div key={k} className="flex flex-col items-center gap-0.5">
                  <span className="text-sm font-semibold text-white">{apiState.signal_counts![k] ?? 0}</span>
                  <span className="text-[10px] capitalize text-slate-500">{k}s</span>
                </div>
              ))}
              <div className="ml-auto flex flex-col items-center gap-0.5">
                <span className="text-sm font-semibold text-amber-400">{apiState.knyt_balance ?? 0}</span>
                <span className="text-[10px] text-slate-500">KNYT</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── NBE disposition card ── */}
      {(() => {
        // Prefer the canonical NBEPlan row; fall back to cartridge state
        // while the plan loads on first paint.
        const disposition = nbePlan?.disposition ?? apiState?.nbe?.disposition;
        const rationale = nbePlan?.rationale ?? apiState?.nbe?.rationale;
        const nextDepth = nbePlan?.next_experience_depth ?? apiState?.nbe?.next_experience_depth;
        if (!disposition && !rationale) return null;
        return (
          <Card className="rounded-xl border border-slate-700/60 bg-slate-900/80 backdrop-blur-sm">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Compass className="h-4 w-4 text-amber-400" />
                <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-500">Aigent Disposition</p>
              </div>
              {rationale && <p className="text-xs text-slate-300">{rationale}</p>}
              <div className="flex flex-wrap gap-1 pt-1">
                {disposition && <Badge className={`text-[10px] ${A.badge}`}>{disposition}</Badge>}
                {nextDepth && (
                  <Badge className="text-[10px] border-slate-600 bg-slate-800 text-slate-300">
                    Next: {nextDepth}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* ── Agent handoffs ── */}
      {apiState?.handoffs && Object.values(apiState.handoffs).some(Boolean) && (
        <Card className="rounded-xl border border-slate-700/60 bg-slate-900/80 backdrop-blur-sm">
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-500 mb-2">Active Handoffs</p>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(apiState.handoffs) as [string, boolean][])
                .filter(([, v]) => v)
                .map(([k]) => (
                  <Badge key={k} className="text-[10px] border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                    {k}
                  </Badge>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Signal history ── */}
      {signalHistory.length > 0 && (
        <Card className="rounded-xl border border-slate-700/60 bg-slate-900/80 backdrop-blur-sm">
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-500 mb-2">Recent Signals</p>
            <div className="flex flex-wrap gap-1.5">
              {signalHistory.map((s, i) => {
                const meta = ACTION_META[s as ActionId];
                return (
                  <span key={i} className="flex items-center gap-1 text-[10px] text-slate-400 bg-slate-800/60 rounded-full px-2 py-0.5">
                    {meta && <meta.Icon className="h-2.5 w-2.5" />}{s}
                  </span>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Open copilot CTA ── */}
      <Button
        variant="outline"
        size="sm"
        className="w-full border-amber-700/40 bg-amber-950/10 text-amber-300 hover:bg-amber-950/30"
        onClick={() => setCopilotOpen(true)}
      >
        <MessageCircle className="h-4 w-4 mr-2" />
        Ask Kn0w1 about your journey
        <ArrowRight className="h-4 w-4 ml-auto" />
      </Button>

      {/* ── Floating copilot ── */}
      <CodexCopilotLayer
        open={copilotOpen}
        onOpenChange={setCopilotOpen}
        messages={copilotMessages}
        onSend={handleUserPrompt}
        contextId="knyt-runtime"
        agentName="Kn0w1"
        personaId={personaId}
      />
    </div>
  );
}
