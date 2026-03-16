"use client";

import React from "react";
import {
  Bot,
  Brush,
  Camera,
  Clapperboard,
  FileText,
  Film,
  ImageIcon,
  Newspaper,
  Palette,
  Sparkles,
} from "lucide-react";

export type ExperienceBlockKind = "image" | "video" | "copy";
export type ExperienceProviderId = "openai" | "venice" | "anthropic" | "chaingpt" | "thirdweb";

const PROVIDER_ICON_URL: Partial<Record<ExperienceProviderId, string>> = {
  openai: "/llm_model_logos/openai.png",
  venice: "/llm_model_logos/venice.png",
  anthropic: "/llm_model_logos/anthropic.png",
  chaingpt: "/llm_model_logos/chaingpt.png",
  thirdweb: "/llm_model_logos/thirdweb.png",
};

function normalizeProviderId(provider?: string | null): ExperienceProviderId | null {
  if (!provider) return null;
  const normalized = provider.trim().toLowerCase();
  if (normalized === "openai") return "openai";
  if (normalized === "venice") return "venice";
  if (normalized === "anthropic") return "anthropic";
  if (normalized === "chaingpt") return "chaingpt";
  if (normalized === "thirdweb") return "thirdweb";
  return null;
}

export function getExperienceProviderLabel(provider?: string | null) {
  const normalized = normalizeProviderId(provider);
  if (normalized === "openai") return "OpenAI";
  if (normalized === "venice") return "Venice";
  if (normalized === "anthropic") return "Anthropic";
  if (normalized === "chaingpt") return "ChainGPT";
  if (normalized === "thirdweb") return "Thirdweb";
  if (typeof provider === "string" && provider.trim()) {
    return provider.trim().replace(/(^\w|\s\w)/g, (match) => match.toUpperCase());
  }
  return null;
}

export function detectExperienceProviderFromAssetUri(uri?: string | null) {
  const normalized = (uri || "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes("/openai/")) return "openai";
  if (normalized.includes("/venice/")) return "venice";
  if (normalized.includes("/anthropic/")) return "anthropic";
  if (normalized.includes("/chaingpt/")) return "chaingpt";
  if (normalized.includes("/thirdweb/")) return "thirdweb";
  return null;
}

export function ExperienceProviderIcon({
  provider,
  className,
}: {
  provider?: string | null;
  className?: string;
}) {
  const normalized = normalizeProviderId(provider);
  const src = normalized ? PROVIDER_ICON_URL[normalized] : null;
  const darkModeClass = normalized === "openai" ? "dark:invert dark:brightness-200 dark:contrast-200" : "";
  if (!src) {
    return <Bot className={className || "h-4 w-4 text-slate-400"} />;
  }
  return (
    <img
      src={src}
      alt={`${normalized} logo`}
      className={`rounded-[2px] object-contain ${className || "h-4 w-4"} ${darkModeClass}`}
      loading="lazy"
      decoding="async"
    />
  );
}

export function ExperienceStyleIcon({ style, className }: { style: string; className?: string }) {
  const normalized = style.toLowerCase();
  if (normalized.includes("editorial") || normalized.includes("article")) return <Newspaper className={className} />;
  if (normalized.includes("cinematic")) return <Clapperboard className={className} />;
  if (normalized.includes("photo")) return <Camera className={className} />;
  if (normalized.includes("comic")) return <Brush className={className} />;
  if (normalized.includes("illustration") || normalized.includes("art")) return <Palette className={className} />;
  return <Sparkles className={className} />;
}

function BlockKindIcon({ kind, className }: { kind: ExperienceBlockKind; className?: string }) {
  if (kind === "video") return <Film className={className} />;
  if (kind === "copy") return <FileText className={className} />;
  return <ImageIcon className={className} />;
}

export function getExperienceBlockTitle(kind: ExperienceBlockKind) {
  if (kind === "video") return "Video Generation";
  if (kind === "copy") return "Article Draft";
  return "Image Generation";
}

export function ExperienceBlockHeader({
  kind,
  title,
  mobileTitle,
  provider,
  providerLabel,
  trustNode,
  rightActions,
  className,
}: {
  kind: ExperienceBlockKind;
  title?: string;
  mobileTitle?: string;
  provider?: string | null;
  providerLabel?: string | null;
  trustNode?: React.ReactNode;
  rightActions?: React.ReactNode;
  className?: string;
}) {
  const resolvedProviderLabel = providerLabel || getExperienceProviderLabel(provider);
  const resolvedTitle = title || getExperienceBlockTitle(kind);
  const resolvedMobileTitle = mobileTitle || (kind === "copy" ? "Copy" : kind === "video" ? "Video" : "Image");

  return (
    <div className={className || "flex items-center justify-between border-b border-slate-800/60 p-4"}>
      <div className="flex items-center gap-2">
        {resolvedProviderLabel ? (
          <>
            <ExperienceProviderIcon provider={provider} className="h-5 w-5" />
            <span className="hidden text-sm font-semibold text-white sm:inline">{resolvedProviderLabel}</span>
          </>
        ) : null}
        <BlockKindIcon kind={kind} className="h-5 w-5 text-cyan-300" />
        <span className="hidden text-sm font-semibold text-white sm:inline">{resolvedTitle}</span>
        <span className="text-sm font-semibold text-white sm:hidden">{resolvedMobileTitle}</span>
        {trustNode}
      </div>
      {rightActions ? <div className="flex items-center gap-1">{rightActions}</div> : null}
    </div>
  );
}
