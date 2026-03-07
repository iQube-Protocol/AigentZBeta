"use client";

import React, { useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Play,
  Loader2,
  ShieldCheck,
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
}

const BADGE_COLORS: Record<string, string> = {
  A: "text-green-400 border-green-500/30 bg-green-500/10",
  B: "text-blue-400 border-blue-500/30 bg-blue-500/10",
  C: "text-amber-400 border-amber-500/30 bg-amber-500/10",
  D: "text-red-400 border-red-500/30 bg-red-500/10",
};

export default function SkillVideoPlayer({
  skill_id,
  prompt,
  duration = 10,
  aspect_ratio = "16:9",
  style = "cinematic",
  creative_pack,
  experience_id,
  trust_override = false,
}: SkillVideoPlayerProps) {
  const [state, setState] = useState<"idle" | "invoking" | "done" | "error">("idle");
  const [result, setResult] = useState<InvocationResult | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  const invoke = useCallback(async () => {
    setState("invoking");
    setResult(null);
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
        }),
      });
      const data = await res.json();
      setResult(data);
      setState(data.ok ? "done" : "error");
    } catch (err: any) {
      setResult({ ok: false, error: err?.message || "Invocation failed" });
      setState("error");
    }
  }, [skill_id, prompt, duration, aspect_ratio, style, creative_pack, experience_id, trust_override]);

  const badgeClass = BADGE_COLORS[result?.skill_badge || ""] || BADGE_COLORS.D;
  const isSimulation = result?.mode === "simulation";
  const isLive = result?.mode === "live";

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-800/60">
        <div className="flex items-center gap-2">
          <Video className="h-5 w-5 text-cyan-400" />
          <span className="text-sm font-semibold text-white">Sora Video Generation</span>
          {result?.skill_badge && (
            <Badge variant="outline" className={`text-[10px] ${badgeClass}`}>
              <ShieldCheck className="h-2.5 w-2.5 mr-0.5" />
              Badge {result.skill_badge}
            </Badge>
          )}
        </div>
        {state === "done" && result?.receipt && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[10px] text-slate-400"
            onClick={() => setShowReceipt((p) => !p)}
          >
            <FileText className="h-3 w-3 mr-1" />
            {showReceipt ? "Hide" : "Receipt"}
          </Button>
        )}
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
            <p className="text-[10px] text-slate-500">SkillWrapper sandbox &rarr; gate check &rarr; Sora API</p>
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
                  No video was generated. The Sora API requires a production OpenAI API key with video access.
                  The full invocation pipeline ran successfully — gate check, SkillWrapper sandbox, and DVN receipt
                  were all executed. When a live key is configured, a real video matching your prompt will appear here.
                </p>
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
                  <Badge variant="outline" className={`text-[9px] ${badgeClass}`}>
                    <ShieldCheck className="h-2 w-2 mr-0.5" />Badge {result?.skill_badge}
                  </Badge>
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
                    <span className="text-[10px] text-amber-300">Video: awaiting live key</span>
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
                  Sora is generating your video. This can take several minutes for longer or complex prompts.
                  The generation job has been submitted and is being processed.
                </p>
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
              <Button size="sm" variant="ghost" className="h-7 text-xs text-slate-400" onClick={invoke}>
                <RefreshCw className="h-3 w-3 mr-1" />
                Check Again
              </Button>
            </div>
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
            />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span className="text-xs text-emerald-300">Generated from Sora API</span>
                <Badge variant="outline" className={`text-[9px] ${badgeClass}`}>
                  Badge {result?.skill_badge}
                </Badge>
                {result.invocation_id && (
                  <span className="text-[10px] text-slate-500 font-mono">{result.invocation_id}</span>
                )}
              </div>
              <Button size="sm" variant="ghost" className="h-7 text-xs text-slate-400" onClick={invoke}>
                <RefreshCw className="h-3 w-3 mr-1" />
                Regenerate
              </Button>
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
                    This skill is below the hydration threshold. Enable &quot;Accept lower trust badge&quot; in the template to override.
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
