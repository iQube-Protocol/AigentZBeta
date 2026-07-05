"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dots } from "@/components/registry/scoreUtils";
import {
  ExperienceBlockHeader,
  ExperienceStyleIcon,
  getExperienceProviderLabel,
} from "@/components/composer/ExperienceBlockChrome";
import {
  ArrowLeft,
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
} from "lucide-react";
import { persistGeneratedAssetsForExperience } from "@/services/composer/generatedAssetClient";
import { ExperienceContextSidebar } from "@/components/composer/ExperienceContextSidebar";

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
  /** Resume status-polling for a previously submitted job (bundle auto-gen). */
  initial_generation_id?: string;
  /** Venice model required for the status URL when resuming a Venice job. */
  initial_venice_model?: string;
  /**
   * Per-segment prompts for a multi-clip video (length must equal the
   * segment count implied by `duration`). When provided, each ≤12s
   * generation uses ITS OWN prompt instead of repeating `prompt` — this is
   * what makes a continuous multi-segment story possible; without it every
   * segment submits an identical request body (same prompt/duration/style),
   * which produces duplicate/near-duplicate clips (Chrysalis EXP-002 finding,
   * 2026-07-03). Falls back to repeating `prompt` when omitted, so existing
   * callers are unaffected.
   */
  segment_prompts?: string[];
  packet?: Record<string, any>;
  experience?: { configuration?: Record<string, any>; metadata?: Record<string, any> };
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
  provider_status?: string;
  provider_progress?: number;
  invocation_phase?: "provider_submit" | "job_accepted" | "polling" | "completed" | "failed";
  thumbnail_url?: string;
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
  return provider === "openai" ? "OpenAI Sora" : getExperienceProviderLabel(provider) || "Venice";
}

function isLegacyVideoProxyUrl(uri: string | undefined) {
  return typeof uri === "string" && /\/api\/skills\/video\//i.test(uri);
}

// --- Multi-clip stitching (videos > 12s) ---------------------------------
// Sora and Venice each cap a single generation at 12s. To reach longer videos
// we generate N ≤12s clips and stitch them via /api/skills/video/stitch.
const SEGMENT_SECONDS = 12;
const MAX_SEGMENTS = 4; // 4×12 = 48s ceiling (Chrysalis EXP-002, 2026-07-03)
// /api/skills/video/stitch accepts 2–3 clips per call. A 4-segment (48s)
// video is stitched hierarchically: [0,1]→A, [2,3]→B, then [A,B]→final.
const STITCH_MAX_CLIPS_PER_PASS = 3;
const SEGMENT_POLL_INTERVAL_MS = 15_000;
const SEGMENT_MAX_POLL_ATTEMPTS = 24; // ~6 min per clip

/** Split N clip URLs into stitch passes honouring STITCH_MAX_CLIPS_PER_PASS,
 * then stitch each pass and (if more than one pass) stitch the pass outputs
 * together — a generic hierarchical reducer, so this works for any segment
 * count without hardcoding the 2-pass/4-segment case.
 * Exported for the Experiment Lab's segment-recovery panel, which re-stitches
 * already-generated clips after a stitch-side failure. */
export async function stitchHierarchical(
  urls: string[],
  experienceId: string | undefined,
): Promise<{ ok: boolean; video_url?: string; thumbnail_url?: string; error?: string }> {
  // Warm-up: resolve/download the ffmpeg binary server-side BEFORE the first
  // stitch pass, so the binary fetch doesn't eat into the stitch request's
  // own time budget. Best-effort — a warm-up failure still lets the stitch
  // attempt run (it resolves ffmpeg itself and reports the real error).
  await fetch("/api/skills/video/stitch", { cache: "no-store" }).catch(() => {});

  const doStitch = async (clips: string[]) => {
    const res = await fetch("/api/skills/video/stitch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clips, experience_id: experienceId || undefined }),
    })
      .then((r) => r.json())
      .catch(() => ({ ok: false, error: "Stitch request failed" }));
    return res as { ok: boolean; video_url?: string; thumbnail_url?: string; error?: string };
  };

  if (urls.length <= STITCH_MAX_CLIPS_PER_PASS) {
    return doStitch(urls);
  }

  let level = urls;
  let lastResult: { ok: boolean; video_url?: string; thumbnail_url?: string; error?: string } | null = null;
  while (level.length > 1) {
    const nextLevel: string[] = [];
    for (let i = 0; i < level.length; i += STITCH_MAX_CLIPS_PER_PASS) {
      const chunk = level.slice(i, i + STITCH_MAX_CLIPS_PER_PASS);
      if (chunk.length === 1) {
        nextLevel.push(chunk[0]); // odd one out carries forward unstitched to the next level
        continue;
      }
      const res = await doStitch(chunk);
      if (!res.ok || !res.video_url) {
        return { ok: false, error: res.error || "Hierarchical stitch pass failed" };
      }
      lastResult = res;
      nextLevel.push(res.video_url);
    }
    level = nextLevel;
  }
  // level[0] is the final stitched URL; lastResult carries its thumbnail
  // (the pass that produced level[0] was always a real 2–3-clip stitch call,
  // since the loop only terminates once a single URL remains).
  return { ok: true, video_url: level[0], thumbnail_url: lastResult?.thumbnail_url };
}

function segmentsForDuration(seconds: number): number {
  const n = Number(seconds);
  if (!Number.isFinite(n) || n <= SEGMENT_SECONDS) return 1;
  return Math.min(MAX_SEGMENTS, Math.ceil(n / SEGMENT_SECONDS));
}

/** Poll a single generation's status route until it yields a playable URL. */
async function pollSegmentToUrl(
  genId: string,
  provider: "venice" | "openai",
  veniceModel: string | undefined,
): Promise<string> {
  const base =
    provider === "venice"
      ? `/api/skills/video/venice/${genId}/status?model=${encodeURIComponent(veniceModel || "")}`
      : `/api/skills/video/${genId}/status`;
  for (let i = 0; i < SEGMENT_MAX_POLL_ATTEMPTS; i += 1) {
    const sep = base.includes("?") ? "&" : "?";
    let data: any = null;
    try {
      const res = await fetch(`${base}${sep}_ts=${Date.now()}`, { cache: "no-store" });
      data = await res.json().catch(() => null);
    } catch {
      data = null;
    }
    if (data?.ready && data?.video_url) return data.video_url as string;
    if (data?.status === "failed" || data?.status === "error") {
      throw new Error(data?.error || "segment generation failed");
    }
    await new Promise((r) => setTimeout(r, SEGMENT_POLL_INTERVAL_MS));
  }
  throw new Error("segment generation timed out");
}

export default function SkillVideoPlayer({
  skill_id,
  prompt,
  duration = 12,
  aspect_ratio = "16:9",
  style = "cinematic",
  creative_pack,
  experience_id,
  trust_override = false,
  venice_model,
  initial_video_url,
  initial_receipt,
  persona_id,
  initial_generation_id,
  initial_venice_model,
  segment_prompts,
  packet,
  experience,
}: SkillVideoPlayerProps) {
  const searchParams = useSearchParams();
  // Sora jobs typically complete in 3–5 min. First poll fires immediately,
  // then every 15 s — 24 attempts covers ~5 min 45 s total.
  const MAX_AUTO_POLL_ATTEMPTS = 24;
  const initialProvider = inferProviderFromSkillId(skill_id);
  const showRuntimeBack = searchParams?.get("from") === "runtime";
  const resolvedInitialVideoUrl = isLegacyVideoProxyUrl(initial_video_url) ? undefined : initial_video_url;
  // When a bundle auto-generated a job (proxy URL saved) but the video isn't
  // ready yet, initial_generation_id lets us resume polling immediately.
  const resolvedInitialGenerationId =
    !resolvedInitialVideoUrl && initial_generation_id ? initial_generation_id : undefined;
  const [state, setState] = useState<"idle" | "invoking" | "done" | "error">(
    resolvedInitialVideoUrl || resolvedInitialGenerationId ? "done" : "idle"
  );
  const [resultSource, setResultSource] = useState<"saved" | "generated" | "none">(
    resolvedInitialVideoUrl ? "saved" : resolvedInitialGenerationId ? "generated" : "none"
  );
  const [result, setResult] = useState<InvocationResult | null>(
    resolvedInitialVideoUrl
      ? {
          ok: true,
          mode: "live",
          provider: initialProvider,
          video_url: resolvedInitialVideoUrl,
          receipt: initial_receipt,
          skill_composite: 78,
        }
      : resolvedInitialGenerationId
        ? {
            ok: true,
            mode: "live",
            provider: initialProvider,
            generation_id: resolvedInitialGenerationId,
            venice_model: initial_venice_model,
            invocation_phase: "job_accepted",
          }
        : null
  );
  const [showReceipt, setShowReceipt] = useState(false);
  const [playbackRetryCount, setPlaybackRetryCount] = useState(0);
  const [persistedVideoKey, setPersistedVideoKey] = useState<string | null>(null);
  const [pollAttempts, setPollAttempts] = useState(0);
  const [autoPollPaused, setAutoPollPaused] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  // Clip URLs that generated successfully but whose stitch pass failed —
  // retained so the stitch can be retried WITHOUT regenerating (regeneration
  // is the token-expensive half; the clips persist server-side).
  const [unstitchedUrls, setUnstitchedUrls] = useState<string[] | null>(null);
  const resolvedProvider = result?.provider || initialProvider;
  const providerLabel = getProviderLabel(resolvedProvider);

  useEffect(() => {
    if (!resolvedInitialVideoUrl) return;
    setResult({
      ok: true,
      mode: "live",
      provider: initialProvider,
      video_url: resolvedInitialVideoUrl,
      receipt: initial_receipt,
      skill_composite: 78,
    });
    setState("done");
    setResultSource("saved");
  }, [initialProvider, initial_receipt, resolvedInitialVideoUrl]);

  // Resume polling when the parent provides a generation_id from a bundle job.
  useEffect(() => {
    if (!resolvedInitialGenerationId) return;
    setResult({
      ok: true,
      mode: "live",
      provider: initialProvider,
      generation_id: resolvedInitialGenerationId,
      venice_model: initial_venice_model,
      invocation_phase: "job_accepted",
    });
    setState("done");
    setResultSource("generated");
    setPollAttempts(0);
    setAutoPollPaused(false);
  }, [initialProvider, initial_venice_model, resolvedInitialGenerationId]);

  const segmentCount = segmentsForDuration(duration);

  // Stitch already-generated clips into the final video. Separated from
  // invokeMultiSegment so a failed stitch is retryable on its own — the error
  // UI offers "Retry stitch" against the retained clip URLs instead of
  // forcing a full (expensive) regeneration.
  const stitchAndFinish = useCallback(async (urls: string[]) => {
    setState("invoking");
    setStatusMessage("Stitching clips into the final video…");
    try {
      const stitchRes = await stitchHierarchical(urls, experience_id);
      if (!stitchRes.ok || !stitchRes.video_url) {
        throw new Error(stitchRes.error || "Failed to stitch clips into the final video");
      }
      setUnstitchedUrls(null);
      setStatusMessage(null);
      setResult({
        ok: true,
        mode: "live",
        provider: resolvedProvider,
        video_url: stitchRes.video_url,
        ...(typeof stitchRes.thumbnail_url === "string" ? { thumbnail_url: stitchRes.thumbnail_url } : {}),
        invocation_phase: "completed",
        skill_composite: 78,
      });
      setState("done");
      setResultSource("generated");
    } catch (err: any) {
      setResult({
        ok: false,
        error: err?.message || "Failed to stitch clips into the final video",
        invocation_phase: "failed",
      });
      setState("error");
      setResultSource("none");
      setStatusMessage(null);
    }
  }, [experience_id, resolvedProvider]);

  // Long-video path: generate `segments` clips (≤12s each) then stitch them.
  const invokeMultiSegment = useCallback(async (segments: number) => {
    setState("invoking");
    setResult(null);
    setPlaybackRetryCount(0);
    setPersistedVideoKey(null);
    setResultSource("none");
    setPollAttempts(0);
    setAutoPollPaused(false);
    setUnstitchedUrls(null);
    setStatusMessage(
      `Generating ${segments} clips to stitch into a ~${segments * SEGMENT_SECONDS}s video…`,
    );
    try {
      // 0. Resolve the per-segment prompt list. If the caller didn't supply
      // distinct segment_prompts, every segment falls back to the same
      // `prompt` — which is what caused the "segments are duplicate clips"
      // defect: identical request bodies read as the same generation
      // upstream. Callers producing a real multi-segment story (varied prose,
      // same invariants) MUST pass segment_prompts.
      const promptForSegment = (index: number): string =>
        segment_prompts && segment_prompts.length === segments
          ? segment_prompts[index]
          : prompt;

      // 1. Submit every segment in parallel (each a 12s generation, its own prompt).
      const submits = await Promise.all(
        Array.from({ length: segments }, async (_, index) => {
          const res = await fetch("/api/skills/invoke", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              skill_id,
              prompt: promptForSegment(index),
              duration: SEGMENT_SECONDS,
              aspect_ratio,
              style,
              creative_pack: creative_pack || undefined,
              experience_id: experience_id || undefined,
              trust_override,
              venice_model: venice_model || undefined,
            }),
          });
          return res
            .json()
            .catch(() => ({ ok: false, error: "Invalid response from skill API" }));
        }),
      );

      const failed = submits.find((s) => !s.ok || s.mode !== "live");
      if (failed) {
        throw new Error(
          failed.error || failed.fallback_reason || "One or more clips could not be generated live.",
        );
      }

      // 2. Resolve each segment to a completed URL (immediate or via polling).
      setStatusMessage(`Rendering ${segments} clips… this can take a few minutes.`);
      const urls = await Promise.all(
        submits.map((s) =>
          s.video_url
            ? Promise.resolve(s.video_url as string)
            : pollSegmentToUrl(s.generation_id, s.provider || resolvedProvider, s.venice_model),
        ),
      );

      // 3. Stitch the clips into one file. >3 clips (e.g. a 48s/4-segment
      // production) is stitched hierarchically since /api/skills/video/stitch
      // accepts at most 3 clips per call. The URLs are retained BEFORE the
      // stitch so a stitch-side failure never discards the generated clips —
      // the error UI can retry the stitch alone.
      setUnstitchedUrls(urls);
      await stitchAndFinish(urls);
    } catch (err: any) {
      setResult({
        ok: false,
        error: err?.message || "Multi-clip generation failed",
        invocation_phase: "failed",
      });
      setState("error");
      setResultSource("none");
      setStatusMessage(null);
    }
  }, [skill_id, prompt, segment_prompts, aspect_ratio, style, creative_pack, experience_id, trust_override, venice_model, resolvedProvider, stitchAndFinish]);

  const invoke = useCallback(async () => {
    if (!skill_id) return;
    if (segmentCount > 1) {
      return invokeMultiSegment(segmentCount);
    }
    setState("invoking");
    setResult(null);
    setPlaybackRetryCount(0);
    setPersistedVideoKey(null);
    setResultSource("none");
    setPollAttempts(0);
    setAutoPollPaused(false);
    setStatusMessage(null);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 40_000);
      const res = await fetch("/api/skills/invoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
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
      }).finally(() => clearTimeout(timeout));
      const data = await res.json().catch(() => ({ ok: false, error: "Invalid response from skill API" }));
      setResult({
        ...data,
        invocation_phase:
          data.ok && data.mode === "live"
            ? data.video_url
              ? "completed"
              : data.generation_id
                ? "job_accepted"
                : "failed"
            : data.ok
              ? undefined
              : "failed",
      });
      setState(data.ok ? "done" : "error");
      if (data.ok && data.mode === "live") {
        setResultSource("generated");
        if (!data.video_url && data.generation_id) {
          setStatusMessage(
            data.provider_status
              ? `Current ${providerLabel} status: ${String(data.provider_status).toLowerCase()}.`
              : `Waiting for ${providerLabel} to finish the video job.`
          );
        } else if (!data.video_url) {
          setResult({
            ...data,
            ok: false,
            error: `${providerLabel} accepted no generation id for this request.`,
            invocation_phase: "failed",
          });
          setState("error");
        }
      }
    } catch (err: any) {
      const timedOut = err?.name === "AbortError";
      setResult({
        ok: false,
        error: timedOut
          ? `${providerLabel} did not acknowledge the video request within 40 seconds.`
          : err?.message || "Invocation failed",
        invocation_phase: "failed",
      });
      setState("error");
      setResultSource("none");
    }
  }, [skill_id, prompt, duration, aspect_ratio, style, creative_pack, experience_id, trust_override, venice_model, segmentCount, invokeMultiSegment]);

  const checkStatus = useCallback(async () => {
    if (!result?.generation_id) return;
    try {
      const isV = result.provider === "venice";
      const statusUrl = isV
        ? `/api/skills/video/venice/${result.generation_id}/status?model=${encodeURIComponent(result.venice_model || "")}`
        : `/api/skills/video/${result.generation_id}/status`;
      const separator = statusUrl.includes("?") ? "&" : "?";
      const res = await fetch(`${statusUrl}${separator}_ts=${Date.now()}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);
      if (data?.ready && data?.video_url) {
        setPlaybackRetryCount(0);
        setPollAttempts(0);
        setAutoPollPaused(false);
        setStatusMessage(null);
        setResult(prev =>
          prev
            ? {
                ...prev,
                video_url: data.video_url,
                provider_status: data.status,
                provider_progress: typeof data.progress === "number" ? data.progress : prev.provider_progress,
                ...(typeof data.thumbnail_url === "string" ? { thumbnail_url: data.thumbnail_url } : {}),
              }
            : prev
        );
      } else if (data?.status === "failed" || data?.status === "error") {
        setResult(prev =>
          prev
            ? {
                ...prev,
                error: data.error || "Generation failed",
                provider_status: data.status,
                provider_progress: typeof data.progress === "number" ? data.progress : prev.provider_progress,
              }
            : prev
        );
        setState("error");
      } else {
        setResult(prev =>
          prev
            ? {
                ...prev,
                provider_status: typeof data?.status === "string" ? data.status : prev.provider_status,
                provider_progress:
                  typeof data?.progress === "number" ? data.progress : prev.provider_progress,
              }
            : prev
        );
        setPollAttempts((count) => {
          const next = count + 1;
          if (next >= MAX_AUTO_POLL_ATTEMPTS) {
            setAutoPollPaused(true);
            setStatusMessage(
              `${providerLabel} is still processing this video. Auto-checking is paused for now. Use Check Again or Regenerate.`
            );
          } else if (typeof data?.status === "string") {
            const progressLabel =
              typeof data?.progress === "number" && Number.isFinite(data.progress)
                ? ` ${Math.max(0, Math.round(data.progress))}%`
                : "";
            setStatusMessage(`Current ${providerLabel} status: ${data.status.toLowerCase()}.${progressLabel}`);
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

  // Auto-poll with a single-shot timer so each status check schedules the next one cleanly.
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const shouldPoll =
      state === "done" &&
      isLive &&
      !result?.video_url &&
      result?.generation_id &&
      !autoPollPaused &&
      pollAttempts < MAX_AUTO_POLL_ATTEMPTS;
    if (shouldPoll) {
      const delay = pollAttempts === 0 ? 0 : 15_000;
      pollRef.current = setTimeout(checkStatus, delay);
    }
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [MAX_AUTO_POLL_ATTEMPTS, autoPollPaused, checkStatus, isLive, pollAttempts, result?.generation_id, result?.video_url, state]);

  useEffect(() => {
    if (!experience_id || state !== "done" || !isLive || !result?.video_url) return;
    const generationKey = `${result.video_url}:${result.generation_id || ""}:${result.provider || ""}`;
    if (generationKey === persistedVideoKey) return;

    persistGeneratedAssetsForExperience({
      experienceId: experience_id,
      assets: [
        {
          id: `${experience_id}:video:${result.generation_id || ""}`,
          type: "video",
          label: "Generated video",
          provider: result.provider,
          assetUrl: result.video_url,
          receiptRef:
            typeof result.receipt?.receipt_id === "string" ? result.receipt.receipt_id : undefined,
          prompt,
          createdAt: new Date().toISOString(),
        },
        // Persist thumbnail as a companion portrait image so it surfaces as coverImageUri / OG image
        ...(result.thumbnail_url
          ? [
              {
                id: `${experience_id}:video:thumbnail`,
                type: "image" as const,
                label: "Video thumbnail",
                provider: result.provider,
                orientation: "portrait" as const,
                assetUrl: result.thumbnail_url,
                prompt,
                createdAt: new Date().toISOString(),
              },
            ]
          : []),
      ],
      receipt: result.receipt,
      personaId: persona_id,
    })
      .then(() => {
        setPersistedVideoKey(generationKey);
        window.dispatchEvent(
          new CustomEvent("composer:persona-media-updated", {
            detail: {
              personaId: persona_id,
              experienceId: experience_id,
            },
          })
        );
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

  const hasSidebar = Boolean(experience || packet);

  return (
    <div className={hasSidebar ? "grid gap-6 lg:grid-cols-[2fr_1fr]" : undefined}>
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
      {/* Header */}
      <ExperienceBlockHeader
        kind="video"
        provider={resolvedProvider}
        providerLabel={providerLabel}
        title="Video Generation"
        mobileTitle="Video"
        trustNode={result?.skill_composite != null ? <TrustDots composite={result.skill_composite} /> : null}
        rightActions={
          <>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400">
                <ExperienceStyleIcon style={style} className="h-5 w-5" />
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
                  <FileText className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{showReceipt ? "Hide receipt" : "Show receipt"}</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400" onClick={invoke}>
                <RefreshCw className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{state === "idle" ? "Generate" : "Regenerate"}</TooltipContent>
          </Tooltip>
          {showRuntimeBack ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-slate-400"
                  onClick={() => window.history.back()}
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Back to runtime</TooltipContent>
            </Tooltip>
          ) : null}
          </>
        }
      />

      {/* Main content area */}
      <div className="p-4">
        {state === "idle" && (
          <div className="space-y-4">
            {!skill_id && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                <p className="text-sm font-medium text-amber-200">Select a video skill first</p>
                <p className="mt-1 text-xs leading-relaxed text-amber-300/70">
                  Choose <span className="font-medium text-amber-200">OpenAI</span>, <span className="font-medium text-amber-200">Venice</span>, or community in
                  Customizer before generating this video.
                </p>
              </div>
            )}
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
              <Button onClick={invoke} disabled={!skill_id} className="bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-50">
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
                {result?.invocation_phase && (
                  <p className="text-[10px] text-slate-500 mt-1">
                    Phase: <span className="font-mono">{result.invocation_phase}</span>
                  </p>
                )}
                {result?.provider_status && (
                  <p className="text-[10px] text-slate-500 mt-1">
                    Provider state: <span className="font-mono">{result.provider_status}</span>
                    {typeof result.provider_progress === "number" && Number.isFinite(result.provider_progress)
                      ? ` · ${Math.max(0, Math.round(result.provider_progress))}%`
                      : ""}
                  </p>
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
              // Poster = the persisted thumbnail so the preview shows a frame
              // before playback. Unmuted autoplay is blocked by most browsers,
              // so without this the preview renders as a black frame — the exact
              // bug where the thin client (which sets a poster) shows a thumb but
              // the Studio preview did not. preload="metadata" also nudges the
              // browser to paint the first frame when no thumbnail exists yet.
              poster={result.thumbnail_url || undefined}
              controls
              autoPlay
              muted
              playsInline
              preload="metadata"
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
                {unstitchedUrls && (
                  <p className="text-[10px] text-emerald-300 mt-1">
                    Your {unstitchedUrls.length} clips generated successfully and are safe — only the
                    stitch failed. Retry the stitch below; nothing gets regenerated.
                  </p>
                )}
              </div>
            </div>
            {unstitchedUrls && (
              <details className="text-[10px] text-slate-500">
                <summary className="cursor-pointer">Generated clip URLs ({unstitchedUrls.length})</summary>
                <pre className="mt-1 whitespace-pre-wrap break-all bg-black/30 rounded-lg p-2">
                  {unstitchedUrls.join("\n")}
                </pre>
              </details>
            )}
            <div className="flex items-center gap-2">
              {unstitchedUrls && (
                <Button
                  size="sm"
                  className="text-xs bg-emerald-700 hover:bg-emerald-600 text-white"
                  onClick={() => stitchAndFinish(unstitchedUrls)}
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Retry stitch only
                </Button>
              )}
              <Button size="sm" variant="ghost" className="text-xs text-slate-400" onClick={invoke}>
                <RefreshCw className="h-3 w-3 mr-1" />
                {unstitchedUrls ? "Regenerate from scratch" : "Retry"}
              </Button>
            </div>
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
    {hasSidebar && (
      <ExperienceContextSidebar experience={experience} packet={packet} theme="dark" />
    )}
    </div>
  );
}
