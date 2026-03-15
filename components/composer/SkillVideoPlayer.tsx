"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dots } from "@/components/registry/scoreUtils";
import {
  Play,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Video,
  FileText,
  Eye,
  Clock,
  Clapperboard,
  Info,
  Film,
  Sparkles,
  Camera,
  Palette,
  Brush,
  Newspaper,
} from "lucide-react";
import { persistGeneratedAssetsForExperience } from "@/services/composer/generatedAssetClient";

interface SkillVideoPlayerProps {
  skill_id: string;
  prompt: string;
  duration?: number;
  aspect_ratio?: string;
  style?: string;
  creative_pack?: string;
  experience_id?: string;
  trust_override?: boolean;
  autoInvoke?: boolean;
  venice_model?: string;
  initial_video_url?: string;
  initial_receipt?: Record<string, unknown>;
  persona_id?: string;
}

interface InvocationResult {
  ok: boolean;
  invocation_id?: string;
  skill_name?: string;
  skill_badge?: string;
  skill_composite?: number;
  mode?: string;
  video_url?: string;
  generation_id?: string;
  started_at?: string;
  completed_at?: string;
  receipt?: Record<string, unknown>;
  generation_metadata?: Record<string, unknown>;
  error?: string;
  gate_blocked?: boolean;
  fallback_reason?: string;
  sora_fallback_reason?: string;
  provider?: "venice" | "openai";
  venice_model?: string;
}

// Convert skill composite (0–100) to trust dot scale (0–10)
function compositeToTrust(composite?: number): number {
  return Math.round(((composite ?? 0) / 10) * 10) / 10;
}

// Compact T + 5-dot trust indicator
const TrustDots: React.FC<{ composite?: number; size?: "xs" | "sm" }> = ({ composite, size = "xs" }) => (
  <span className="inline-flex items-center gap-1">
    <span className="text-[10px] font-semibold text-slate-400">T</span>
    <Dots value={compositeToTrust(composite)} kind="trust" title="Trust" size={size} />
  </span>
);

function inferProviderFromSkillId(skillId: string): "venice" | "openai" {
  return skillId.includes("venice") ? "venice" : "openai";
}

function getProviderLabel(provider: "venice" | "openai") {
  return provider === "venice" ? "Venice" : "OpenAI Sora";
}

const PROVIDER_ICON_URL: Record<"venice" | "openai", string> = {
  openai: "/llm_model_logos/openai.png",
  venice: "/llm_model_logos/venice.png",
};

function ProviderIcon({ provider, className }: { provider: "venice" | "openai"; className?: string }) {
  const darkModeClass = provider === "openai" ? "dark:invert dark:brightness-200 dark:contrast-200" : "";
  return (
    <img
      src={PROVIDER_ICON_URL[provider]}
      alt={`${provider} logo`}
      className={`rounded-[2px] object-contain ${className || "h-4 w-4"} ${darkModeClass}`}
      loading="lazy"
      decoding="async"
    />
  );
}

function StyleIcon({ style, className }: { style: string; className?: string }) {
  const normalized = style.toLowerCase();
  if (normalized.includes("editorial") || normalized.includes("article")) return <Newspaper className={className} />;
  if (normalized.includes("cinematic")) return <Clapperboard className={className} />;
  if (normalized.includes("photo")) return <Camera className={className} />;
  if (normalized.includes("comic")) return <Brush className={className} />;
  if (normalized.includes("illustration") || normalized.includes("art")) return <Palette className={className} />;
  return <Sparkles className={className} />;
}

export default function SkillVideoPlayer({
  skill_id,
  prompt,
  duration = 10,
  aspect_ratio = "16:9",
  style = "cinematic",
  creative_pack,
  experience_id,
  trust_override = false,
  venice_model,
  initial_video_url,
  initial_receipt,
  persona_id,
}: SkillVideoPlayerProps) {
  const MAX_AUTO_POLL_ATTEMPTS = 8;
  const initialProvider = inferProviderFromSkillId(skill_id);
  const [state, setState] = useState<"idle" | "invoking" | "done" | "error">(initial_video_url ? "done" : "idle");
  const [resultSource, setResultSource] = useState<"saved" | "generated" | "none">(initial_video_url ? "saved" : "none");
  const [result, setResult] = useState<InvocationResult | null>(
    initial_video_url
      ? {
          ok: true,
          mode: "live",
          provider: initialProvider,
          video_url: initial_video_url,
          receipt: initial_receipt,
          skill_composite: 78,
        }
      : null
  );
  const [showReceipt, setShowReceipt] = useState(false);
  const [playbackRetryCount, setPlaybackRetryCount] = useState(0);
  const [persistedVideoKey, setPersistedVideoKey] = useState<string | null>(null);
  const [pollAttempts, setPollAttempts] = useState(0);
  const [autoPollPaused, setAutoPollPaused] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const resolvedProvider = result?.provider || initialProvider;
  const providerLabel = getProviderLabel(resolvedProvider);

  useEffect(() => {
    if (!initial_video_url) return;
    setResult({
      ok: true,
      mode: "live",
      provider: initialProvider,
      video_url: initial_video_url,
      receipt: initial_receipt,
      skill_composite: 78,
    });
    setState("done");
    setResultSource("saved");
  }, [initialProvider, initial_receipt, initial_video_url]);

  const invoke = useCallback(async () => {
    setState("invoking");
    setResult(null);
    setPlaybackRetryCount(0);
    setPersistedVideoKey(null);
    setResultSource("none");
    setPollAttempts(0);
    setAutoPollPaused(false);
    setStatusMessage(null);
    try {
      const res = await fetch("/api/skills/invoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skill_id,
          prompt,
          duration,
          aspect_ratio,
          style,
          creative_pack: creative_pack || undefined,
          experience_id: experience_id || undefined,
          trust_override,
          venice_model: venice_model || undefined,
        }),
      });
      const data = await res.json().catch(() => ({ ok: false, error: "Invalid response from skill API" }));
      setResult(data);
      setState(data.ok ? "done" : "error");
      if (data.ok && data.mode === "live") {
        setResultSource("generated");
        if (!data.video_url && data.generation_id) {
          setStatusMessage(`Waiting for ${providerLabel} to finish the video job.`);
        }
      }
    } catch (err: any) {
      setResult({ ok: false, error: err?.message || "Invocation failed" });
      setState("error");
      setResultSource("none");
    }
  }, [skill_id, prompt, duration, aspect_ratio, style, creative_pack, experience_id, trust_override, venice_model]);

  const checkStatus = useCallback(async () => {
    if (!result?.generation_id) return;
    try {
      const isV = result.provider === "venice";
      const statusUrl = isV
        ? `/api/skills/video/venice/${result.generation_id}/status?model=${encodeURIComponent(result.venice_model || "")}`
        : `/api/skills/video/${result.generation_id}/status`;
      const res = await fetch(statusUrl);
      const data = await res.json().catch(() => null);
      if (data?.ready && data?.video_url) {
        setPlaybackRetryCount(0);
        setPollAttempts(0);
        setAutoPollPaused(false);
        setStatusMessage(null);
        setResult(prev => prev ? { ...prev, video_url: data.video_url } : prev);
      } else if (data?.status === "failed" || data?.status === "error") {
        setResult(prev => prev ? { ...prev, error: data.error || "Generation failed" } : prev);
        setState("error");
      } else {
        setPollAttempts((count) => {
          const next = count + 1;
          if (next >= MAX_AUTO_POLL_ATTEMPTS) {
            setAutoPollPaused(true);
            setStatusMessage(
              `${providerLabel} is still processing this video. Auto-checking is paused for now. Use Check Again or Regenerate.`
            );
          } else if (typeof data?.status === "string") {
            setStatusMessage(`Current ${providerLabel} status: ${data.status.toLowerCase()}.`);
          }
          return next;
        });
      }
    } catch {
      setPollAttempts((count) => {
        const next = count + 1;
        if (next >= MAX_AUTO_POLL_ATTEMPTS) {
          setAutoPollPaused(true);
          setStatusMessage(
            `${providerLabel} status checks are taking too long. Auto-checking is paused for now. Use Check Again or Regenerate.`
          );
        }
        return next;
      });
    }
  }, [MAX_AUTO_POLL_ATTEMPTS, providerLabel, result?.generation_id, result?.provider, result?.venice_model]);

  const isSimulation = result?.mode === "simulation";
  const isLive = result?.mode === "live";

  // Auto-poll every 15s while in "live + no video_url" state
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    const shouldPoll =
      state === "done" &&
      isLive &&
      !result?.video_url &&
      result?.generation_id &&
      !autoPollPaused &&
      pollAttempts < MAX_AUTO_POLL_ATTEMPTS;
    if (shouldPoll) {
      checkStatus(); // immediate first check
      pollRef.current = setInterval(checkStatus, 15_000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [MAX_AUTO_POLL_ATTEMPTS, autoPollPaused, checkStatus, isLive, pollAttempts, result?.generation_id, result?.video_url, state]);

  useEffect(() => {
    if (!experience_id || state !== "done" || !isLive || !result?.video_url) return;
    const generationKey = `${result.video_url}:${result.generation_id || ""}:${result.provider || ""}`;
    if (generationKey === persistedVideoKey) return;

    persistGeneratedAssetsForExperience({
      experienceId: experience_id,
      assets: [
        {
          id: `${experience_id}:video`,
          type: "video",
          label: "Generated video",
          provider: result.provider,
          assetUrl: result.video_url,
          receiptRef:
            typeof result.receipt?.receipt_id === "string" ? result.receipt.receipt_id : undefined,
          prompt,
          createdAt: new Date().toISOString(),
        },
      ],
      receipt: result.receipt,
      personaId: persona_id,
    })
      .then(() => {
        setPersistedVideoKey(generationKey);
        window.dispatchEvent(new CustomEvent("composer:persona-media-updated"));
        try {
          window.parent?.postMessage(
            {
              type: "composer:persona-media-updated",
              personaId: persona_id,
              experienceId: experience_id,
            },
            window.location.origin,
          );
        } catch {
          // Ignore cross-frame notification failures.
        }
      })
      .catch(() => undefined);
  }, [experience_id, isLive, persistedVideoKey, persona_id, prompt, result, state]);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-800/60">
        <div className="flex items-center gap-2">
          <ProviderIcon provider={resolvedProvider} className="h-5 w-5" />
          <span className="hidden text-sm font-semibold text-white sm:inline">{providerLabel}</span>
          <Film className="h-5 w-5 text-cyan-300" />
          <span className="hidden text-sm font-semibold text-white sm:inline">Video Generation</span>
          <span className="text-sm font-semibold text-white sm:hidden">Video</span>
          {result?.skill_composite != null && (
            <TrustDots composite={result.skill_composite} />
          )}
        </div>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400">
                <StyleIcon style={style} className="h-4.5 w-4.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{style}</TooltipContent>
          </Tooltip>
          {state === "done" && result?.receipt && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-slate-400"
                  onClick={() => setShowReceipt((p) => !p)}
                >
                  <FileText className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{showReceipt ? "Hide receipt" : "Show receipt"}</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Main content area */}
      <div className="p-4">
        {state === "idle" && (
          <div className="space-y-4">
            {/* Prompt preview */}
            <div className="rounded-xl border border-slate-700/50 bg-black/20 p-4">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Prompt</p>
              <p className="text-sm text-slate-200 leading-relaxed">{prompt || "No prompt provided"}</p>
            </div>
            {/* Params */}
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-700">
                <Clock className="h-2.5 w-2.5 mr-1" />{duration}s
              </Badge>
              <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-700">
                {aspect_ratio}
              </Badge>
              <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-700">
                <Clapperboard className="h-2.5 w-2.5 mr-1" />{style}
              </Badge>
              {creative_pack && (
                <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-700">
                  {creative_pack}
                </Badge>
              )}
              <Badge variant="outline" className="text-[10px] text-cyan-400 border-cyan-700/40">
                {skill_id.replace(/_/g, " ")}
              </Badge>
            </div>
            {/* Generate button */}
            <div className="flex justify-center pt-2">
              <Button onClick={invoke} className="bg-cyan-600 hover:bg-cyan-500 text-white">
                <Play className="h-4 w-4 mr-2" />
                Generate Video
              </Button>
            </div>
          </div>
        )}

        {state === "invoking" && (
          <div className="flex flex-col items-center justify-center py-10 space-y-3">
            <Loader2 className="h-10 w-10 text-cyan-400 animate-spin" />
            <p className="text-sm text-slate-300">Generating video&hellip;</p>
            <p className="text-[10px] text-slate-500">SkillWrapper sandbox &rarr; gate check &rarr; {providerLabel} API</p>
            <p className="text-[10px] text-slate-500/60">This may take 1–3 minutes for live generation</p>
          </div>
        )}

        {/* ── DONE: simulation mode ── */}
        {state === "done" && isSimulation && (
          <div className="space-y-4">
            {/* Simulation banner */}
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
              <Info className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-200">Simulation Mode</p>
                <p className="text-xs text-amber-300/70 mt-1 leading-relaxed">
                  No video was generated. The {providerLabel} API requires a configured production key with video access.
                  The full invocation pipeline ran successfully — gate check, SkillWrapper sandbox, and DVN receipt
                  were all executed. When a live key is configured, a real video matching your prompt will appear here.
                </p>
                {(result?.fallback_reason || result?.sora_fallback_reason) && (
                  <p className="text-[10px] text-amber-400/60 font-mono mt-2">{result?.fallback_reason || result?.sora_fallback_reason}</p>
                )}
              </div>
            </div>

            {/* Simulated output card — shows what WOULD be generated */}
            <div
              className="relative rounded-xl border border-slate-700/50 overflow-hidden"
              style={{
                aspectRatio: aspect_ratio === "9:16" ? "9/16" : aspect_ratio === "1:1" ? "1/1" : "16/9",
                maxHeight: "280px",
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/30 via-slate-900 to-purple-900/20 flex flex-col items-center justify-center">
                <Video className="h-12 w-12 text-cyan-500/40 mb-3" />
                <p className="text-xs text-slate-300 font-medium text-center px-6 max-w-md leading-relaxed">
                  &ldquo;{prompt}&rdquo;
                </p>
                <div className="flex gap-2 mt-3">
                  <Badge variant="outline" className="text-[9px] text-slate-500 border-slate-700">{duration}s</Badge>
                  <Badge variant="outline" className="text-[9px] text-slate-500 border-slate-700">{aspect_ratio}</Badge>
                  <Badge variant="outline" className="text-[9px] text-slate-500 border-slate-700">{style}</Badge>
                </div>
              </div>
            </div>

            {/* Supply chain summary */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-slate-800 bg-black/20 p-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">Skill</p>
                <p className="text-xs text-slate-200">{result?.skill_name}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <TrustDots composite={result?.skill_composite} />
                  <span className="text-[9px] text-slate-500">Composite {result?.skill_composite}</span>
                </div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-black/20 p-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">Pipeline</p>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                    <span className="text-[10px] text-slate-300">Gate check passed</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                    <span className="text-[10px] text-slate-300">SkillWrapper sandbox</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                    <span className="text-[10px] text-slate-300">DVN receipt emitted</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Eye className="h-3 w-3 text-amber-400" />
                    <span className="text-[10px] text-amber-300">Video: awaiting {providerLabel} access</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Invocation ID + regenerate */}
            <div className="flex items-center justify-between">
              {result?.invocation_id && (
                <span className="text-[10px] text-slate-500 font-mono">{result.invocation_id}</span>
              )}
              <Button size="sm" variant="ghost" className="h-7 text-xs text-slate-400" onClick={invoke}>
                <RefreshCw className="h-3 w-3 mr-1" />
                Re-invoke
              </Button>
            </div>
          </div>
        )}

        {/* ── DONE: live mode — generation in progress (timeout) ── */}
        {state === "done" && isLive && !result?.video_url && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4">
              <Loader2 className="h-5 w-5 text-cyan-400 flex-shrink-0 mt-0.5 animate-spin" />
              <div>
                <p className="text-sm font-medium text-cyan-200">Video Generation In Progress</p>
                <p className="text-xs text-cyan-300/70 mt-1 leading-relaxed">
                  {providerLabel} is generating your video. This can take 1–3 minutes.
                  {autoPollPaused
                    ? " Auto-checking is paused until you manually check again."
                    : " Auto-checking every 15 seconds — the video will appear automatically when ready."}
                </p>
                {statusMessage && (
                  <p className="text-[10px] text-cyan-300/70 mt-2">{statusMessage}</p>
                )}
                {result?.generation_id && (
                  <p className="text-[10px] text-slate-500 font-mono mt-2">Generation: {result.generation_id}</p>
                )}
              </div>
            </div>
            <div className="relative rounded-xl border border-slate-700/50 overflow-hidden"
              style={{ aspectRatio: aspect_ratio === "9:16" ? "9/16" : aspect_ratio === "1:1" ? "1/1" : "16/9", maxHeight: "280px" }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/30 via-slate-900 to-purple-900/20 flex flex-col items-center justify-center">
                <Loader2 className="h-10 w-10 text-cyan-500/50 animate-spin mb-3" />
                <p className="text-xs text-slate-400">Rendering&hellip;</p>
              </div>
            </div>
            <div className="flex justify-center">
              <Button size="sm" variant="ghost" className="h-7 text-xs text-slate-400" onClick={checkStatus}>
                <RefreshCw className="h-3 w-3 mr-1" />
                Check Again
              </Button>
            </div>
          </div>
        )}

        {state === "done" && isLive && result?.video_url && resultSource === "saved" && (
          <div className="mb-3 flex justify-end">
            <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-200">
              Last generated
            </span>
          </div>
        )}

        {/* ── DONE: live mode — real video ── */}
        {state === "done" && isLive && result?.video_url && (
          <div className="space-y-3">
            <video
              src={result.video_url}
              controls
              autoPlay
              className="w-full rounded-xl border border-slate-700/50"
              style={{
                aspectRatio: aspect_ratio === "9:16" ? "9/16" : aspect_ratio === "1:1" ? "1/1" : "16/9",
                maxHeight: "480px",
                objectFit: "contain",
                backgroundColor: "#000",
              }}
              onError={() => {
                if (playbackRetryCount >= 2) {
                  setResult(prev =>
                    prev
                      ? {
                          ...prev,
                          error: `The generated ${providerLabel} video is not playable yet. Try Check Again or Regenerate.`,
                        }
                      : prev
                  );
                  return;
                }
                setPlaybackRetryCount((count) => count + 1);
                setTimeout(() => {
                  setResult(prev => prev ? { ...prev, video_url: undefined } : prev);
                }, 1500);
              }}
            />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span className="text-xs text-emerald-300">Generated from {providerLabel}</span>
                <TrustDots composite={result?.skill_composite} />
                {result.invocation_id && (
                  <span className="text-[10px] text-slate-500 font-mono">{result.invocation_id}</span>
                )}
              </div>
              <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400" onClick={invoke}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
                <TooltipContent side="bottom">Regenerate</TooltipContent>
              </Tooltip>
            </div>
          </div>
        )}

        {/* ── ERROR ── */}
        {state === "error" && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/5 p-4">
              {result?.gate_blocked ? (
                <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <p className="text-sm text-red-200">{result?.error || "Unknown error"}</p>
                {result?.gate_blocked && (
                  <p className="text-[10px] text-amber-300 mt-1">
                    This skill is below the hydration threshold. Enable &quot;Accept lower trust level&quot; in the template to override.
                  </p>
                )}
              </div>
            </div>
            <Button size="sm" variant="ghost" className="text-xs text-slate-400" onClick={invoke}>
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          </div>
        )}
      </div>

      {/* DVN Receipt */}
      {showReceipt && result?.receipt && (
        <div className="border-t border-slate-800/40 p-4">
          <p className="text-[10px] text-slate-500 mb-2">DVN Receipt</p>
          <pre className="text-[10px] text-slate-300 bg-black/30 rounded-lg p-3 overflow-auto max-h-48">
            {JSON.stringify(result.receipt, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
