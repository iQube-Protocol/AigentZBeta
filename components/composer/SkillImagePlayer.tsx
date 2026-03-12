"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ImageIcon, Loader2, RefreshCw, AlertTriangle, CheckCircle2, FileText } from "lucide-react";
import { persistGeneratedAssetsForExperience } from "@/services/composer/generatedAssetClient";

interface SkillImagePlayerProps {
  provider_id?: "openai" | "venice";
  portrait_prompt?: string;
  landscape_prompt?: string;
  visual_style?: string;
  experience_id?: string;
  autoInvoke?: boolean;
}

interface GeneratedImage {
  orientation: "portrait" | "landscape";
  prompt: string;
  ok: boolean;
  mode?: "live" | "simulation";
  image_url?: string;
  error?: string;
  model?: string;
}

interface GenerationResponse {
  ok: boolean;
  provider: "openai" | "venice";
  mode?: "live" | "simulation";
  images: GeneratedImage[];
  fallback_reason?: string;
  error?: string;
  receipt?: Record<string, unknown>;
}

const providerLabel = (provider: "openai" | "venice") =>
  provider === "venice" ? "Venice" : "OpenAI";

export default function SkillImagePlayer({
  provider_id = "venice",
  portrait_prompt,
  landscape_prompt,
  visual_style = "editorial",
  experience_id,
  autoInvoke = false,
}: SkillImagePlayerProps) {
  const [state, setState] = useState<"idle" | "invoking" | "done" | "error">("idle");
  const [result, setResult] = useState<GenerationResponse | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [persistedGenerationKey, setPersistedGenerationKey] = useState<string | null>(null);

  const availablePrompts = useMemo(
    () =>
      [
        portrait_prompt
          ? { orientation: "portrait" as const, prompt: portrait_prompt }
          : null,
        landscape_prompt
          ? { orientation: "landscape" as const, prompt: landscape_prompt }
          : null,
      ].filter(Boolean) as Array<{ orientation: "portrait" | "landscape"; prompt: string }>,
    [landscape_prompt, portrait_prompt]
  );

  const invoke = useCallback(async () => {
    if (availablePrompts.length === 0) return;
    setState("invoking");
    setResult(null);
    setShowReceipt(false);
    setPersistedGenerationKey(null);
    try {
      const res = await fetch("/api/skills/image/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider_id,
          portrait_prompt,
          landscape_prompt,
          experience_id,
        }),
      });
      const rawText = await res.text().catch(() => "");
      let data: GenerationResponse;
      try {
        data = JSON.parse(rawText) as GenerationResponse;
      } catch {
        data = {
          ok: false,
          provider: provider_id,
          images: [],
          error: rawText || "Invalid image response",
        };
      }
      setResult(data);
      setState(data.ok || data.mode === "simulation" ? "done" : "error");
    } catch (error: any) {
      setResult({
        ok: false,
        provider: provider_id,
        images: [],
        error: error?.message || "Image generation failed",
      });
      setState("error");
    }
  }, [availablePrompts.length, experience_id, landscape_prompt, portrait_prompt, provider_id]);

  useEffect(() => {
    if (!autoInvoke || state !== "idle") return;
    void invoke();
  }, [autoInvoke, invoke, state]);

  useEffect(() => {
    if (!experience_id || state !== "done" || result?.mode !== "live") return;

    const liveImages = result.images.filter(
      (image) => image.ok && typeof image.image_url === "string" && image.image_url.length > 0
    );
    if (liveImages.length === 0) return;

    const generationKey = liveImages
      .map((image) => `${image.orientation}:${image.image_url}:${image.model || ""}`)
      .join("|");
    if (!generationKey || generationKey === persistedGenerationKey) return;

    const assets = liveImages.map((image) => ({
      id: `${experience_id}:${image.orientation}:image`,
      type: "image" as const,
      label: `${image.orientation === "portrait" ? "Portrait" : "Landscape"} generated image`,
      provider: result.provider,
      orientation: image.orientation,
      assetUrl: image.image_url,
      receiptRef:
        typeof result.receipt?.receipt_id === "string" ? result.receipt.receipt_id : undefined,
      prompt: image.prompt,
      createdAt: new Date().toISOString(),
    }));

    persistGeneratedAssetsForExperience({
      experienceId: experience_id,
      assets,
      receipt: result.receipt,
    })
      .then(() => setPersistedGenerationKey(generationKey))
      .catch(() => undefined);
  }, [experience_id, persistedGenerationKey, result, state]);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
      <div className="flex items-center justify-between border-b border-slate-800/60 p-4">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5 text-cyan-400" />
          <span className="text-sm font-semibold text-white">{providerLabel(provider_id)} Image Generation</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-slate-700 text-[10px] text-slate-400">
            {visual_style}
          </Badge>
          {state === "done" && result?.receipt && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-slate-400"
              onClick={() => setShowReceipt((value) => !value)}
            >
              <FileText className="mr-1 h-3 w-3" />
              {showReceipt ? "Hide Receipt" : "Show Receipt"}
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-7 text-xs text-slate-400" onClick={invoke}>
            <RefreshCw className="mr-1 h-3 w-3" />
            {state === "idle" ? "Generate" : "Regenerate"}
          </Button>
        </div>
      </div>

      <div className="p-4">
        {state === "idle" && (
          <div className="space-y-3">
            <p className="text-xs text-slate-400">
              Generate orientation-aware article imagery from the prompts configured in the Studio customizer.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              {availablePrompts.map((item) => (
                <div key={item.orientation} className="rounded-xl border border-slate-800 bg-black/20 p-3">
                  <div className="mb-2 text-[10px] uppercase tracking-widest text-slate-500">{item.orientation}</div>
                  <div className="text-sm leading-relaxed text-slate-200">{item.prompt}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {state === "invoking" && (
          <div className="flex min-h-[280px] flex-col items-center justify-center gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-cyan-400" />
            <p className="text-sm text-slate-300">Generating portrait and landscape imagery…</p>
          </div>
        )}

        {state === "done" && result && (
          <div className="space-y-4">
            {result.mode === "simulation" && (
              <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-400" />
                <div>
                  <p className="text-sm font-medium text-amber-200">Simulation Mode</p>
                  <p className="mt-1 text-xs leading-relaxed text-amber-300/70">
                    No images were generated live. The image generation pipeline ran, but the provider returned a fallback response.
                  </p>
                  {result.fallback_reason && (
                    <p className="mt-2 text-[10px] font-mono text-amber-400/60">{result.fallback_reason}</p>
                  )}
                </div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              {result.images.map((image) => (
                <div key={image.orientation} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-medium uppercase tracking-widest text-slate-400">
                      {image.orientation}
                    </div>
                    {image.ok && image.mode === "live" ? (
                      <div className="flex items-center gap-1 text-[10px] text-emerald-300">
                        <CheckCircle2 className="h-3 w-3" />
                        Live
                      </div>
                    ) : (
                      <div className="text-[10px] text-amber-300">Preview</div>
                    )}
                  </div>
                  <div
                    className="overflow-hidden rounded-xl border border-slate-800 bg-black/30"
                    style={{ aspectRatio: image.orientation === "portrait" ? "2 / 3" : "3 / 2" }}
                  >
                    {image.image_url ? (
                      <img
                        src={image.image_url}
                        alt={`${image.orientation} generated art`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-400">
                        {image.prompt}
                      </div>
                    )}
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-black/20 p-3 text-xs leading-relaxed text-slate-300">
                    {image.prompt}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {state === "error" && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-200">
            {result?.error || "Image generation failed."}
          </div>
        )}

        {showReceipt && result?.receipt && (
          <div className="rounded-xl border border-slate-800 bg-black/20 p-3">
            <div className="mb-2 text-[10px] uppercase tracking-widest text-slate-500">DVN Receipt</div>
            <pre className="max-h-48 overflow-auto rounded-lg bg-black/30 p-3 text-[10px] text-slate-300">
              {JSON.stringify(result.receipt, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
