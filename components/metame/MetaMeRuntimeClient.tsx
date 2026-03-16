"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  createRuntimeMessage,
  isShellOutboundMessage,
  type RuntimeInboundType,
  type ShellInboundMessage,
} from "@metame/iframe-bridge";
import { CodexCopilotLayer, type CopilotMessage } from "@/app/components/codex/CodexCopilotLayer";
import { PreviewFrame } from "@/components/preview/PreviewFrame";
import { DevicePreviewSwitcher, type DeviceType } from "@/components/preview/DevicePreviewSwitcher";
import { useToast } from "@/components/ui/toaster";
import {
  buildLaunchMessageId,
  normalizeCodexId,
  readCodexClose,
  shouldDismissForCodexClose,
} from "@/components/metame/runtimeCloseLayer";
import {
  appendRuntimePersonaMemoryEntry,
  readRuntimePersonaMemoryEntries,
  type RuntimePersonaMemoryEntry,
} from "@/components/metame/runtimePersonaMemory";
import {
  getStaticAgentLlmProviders,
  type AgentModelSelection,
  type AgentProviderOption,
  type LlmProviderId,
} from "@/services/metame/agentLlmOrchestra";
import {
  BookOpen,
  Bot,
  ChevronDown,
  Coins,
  Compass,
  Eye,
  Headphones,
  Hexagon,
  Maximize2,
  Minimize2,
  Pencil,
  PlayCircle,
  RefreshCw,
  RotateCcw,
  Send,
  Share2,
  Tv,
  Users,
} from "lucide-react";
import type { ScreenFraction, SmartContentQube } from "@/types/smartContent";
import type { RuntimeCapsuleRecord } from "@/types/runtimeCapsules";

type RuntimeIntent = "watch" | "listen" | "read" | "play" | "find" | "earn" | "make" | "be";
type RuntimeContentSource = "experience" | "smart-content" | "codex";

type RuntimeAgent = {
  id: string;
  label: string;
  colorClass: string;
};

type RuntimeAgentModelMap = Record<string, AgentModelSelection | null>;
type RuntimeCapsule = SmartContentQube & {
  runtimeSource: RuntimeContentSource;
  runtimeMenuIntent?: "make" | "play";
  runtimeCodexSlug?: string;
  runtimeCodexInitialTab?: string;
  runtimeLaunchHref?: string;
  runtimeLaunchType?: "experience" | "codex" | "content";
  runtimeAssetStatus?: "resolved" | "missing";
  runtimeModalityHints?: string[];
  runtimeDurationMinutes?: number | null;
  runtimePriceLabel?: string | null;
  runtimeStatus?: string | null;
  runtimeContentKind?: "article" | "video" | "character" | "episode" | "generic" | null;
  runtimePreviewMediaUri?: string | null;
};

type RuntimeModuleConfig = {
  id: string;
  label: string;
  summaryVariant: "compact" | "mobileCard";
  runtimeDensity: "narrow" | "wide";
  screenFraction: ScreenFraction;
};

const RUNTIME_CODEX_MODULES: Record<DeviceType, { primary: RuntimeModuleConfig; secondary: RuntimeModuleConfig }> = {
  mobile: {
    primary: {
      id: "mobile_portrait_full",
      label: "Mobile portrait full",
      summaryVariant: "mobileCard",
      runtimeDensity: "narrow",
      screenFraction: "screen-full",
    },
    secondary: {
      id: "mobile_portrait_half",
      label: "Mobile portrait half",
      summaryVariant: "compact",
      runtimeDensity: "narrow",
      screenFraction: "screen-1-2",
    },
  },
  tablet: {
    primary: {
      id: "tablet_split_half",
      label: "Tablet split half",
      summaryVariant: "compact",
      runtimeDensity: "wide",
      screenFraction: "screen-1-2",
    },
    secondary: {
      id: "tablet_split_full",
      label: "Tablet split full",
      summaryVariant: "compact",
      runtimeDensity: "wide",
      screenFraction: "screen-full",
    },
  },
  desktop: {
    primary: {
      id: "desktop_split_half",
      label: "Desktop split half",
      summaryVariant: "compact",
      runtimeDensity: "wide",
      screenFraction: "screen-1-2",
    },
    secondary: {
      id: "desktop_split_three_quarter",
      label: "Desktop split 3/4",
      summaryVariant: "compact",
      runtimeDensity: "wide",
      screenFraction: "screen-3-4",
    },
  },
};

const SOURCE_PRIORITY_BY_INTENT: Record<RuntimeIntent, RuntimeContentSource[]> = {
  play: ["smart-content", "experience", "codex"],
  read: ["smart-content", "experience", "codex"],
  watch: ["smart-content", "experience", "codex"],
  listen: ["smart-content", "experience", "codex"],
  find: ["smart-content", "experience", "codex"],
  earn: ["smart-content", "experience", "codex"],
  make: ["smart-content", "experience", "codex"],
  be: ["smart-content", "experience", "codex"],
};

const RUNTIME_AGENTS: RuntimeAgent[] = [
  { id: "aigent-z", label: "Aigent Z", colorClass: "text-cyan-300" },
  { id: "aigent-kn0w1", label: "Kn0w1", colorClass: "text-emerald-300" },
  { id: "aigent-moneypenny", label: "MoneyPenny", colorClass: "text-violet-300" },
  { id: "aigent-nakamoto", label: "Nakamoto", colorClass: "text-amber-300" },
  { id: "aigent-marketa", label: "Marketa", colorClass: "text-rose-300" },
];

const FAILSAFE_QRIPTO_IMAGE =
  "https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-media/thumbnails/1763852402194-hswrqa.png";

const PROVIDER_ICON_URL: Record<LlmProviderId, string> = {
  openai: "/llm_model_logos/openai.png",
  venice: "/llm_model_logos/venice.png",
  chaingpt: "/llm_model_logos/chaingpt.png",
  thirdweb: "/llm_model_logos/thirdweb.png",
  anthropic: "/llm_model_logos/anthropic.png",
};

function providerIcon(providerId: LlmProviderId) {
  const darkModeClass =
    providerId === "openai" || providerId === "anthropic" ? "dark:invert dark:brightness-200 dark:contrast-200" : "";
  return (
    <img
      src={PROVIDER_ICON_URL[providerId]}
      alt={`${providerId} logo`}
      className={`h-3.5 w-3.5 rounded-[2px] object-contain ${darkModeClass}`}
      loading="lazy"
      decoding="async"
    />
  );
}

function defaultSelectionFromProviders(providers: AgentProviderOption[]): AgentModelSelection | null {
  const provider = providers[0];
  const model = provider?.models?.[0];
  if (!provider || !model) return null;
  return {
    providerId: provider.id,
    providerLabel: provider.label,
    modelId: model.id,
    modelLabel: model.label,
    sourceIQubeId: model.sourceIQubeId,
  };
}

function initialModelMap(providerMap: Record<string, AgentProviderOption[]>): RuntimeAgentModelMap {
  const map: RuntimeAgentModelMap = {};
  for (const agent of RUNTIME_AGENTS) {
    map[agent.id] = defaultSelectionFromProviders(providerMap[agent.id] || []);
  }
  return map;
}

const DEFAULT_CONTENTS: RuntimeCapsule[] = [
  {
    id: "capsule-qriptopian-read",
    type: "SmartContentQube",
    app: "Qriptopian",
    title: "metaKnyts QriptoGraphic Novel (…",
    slug: "read-qriptopian",
    version: 1,
    description: "Launch an immersive article experience from the Qriptopian codex.",
    coverImageUri: FAILSAFE_QRIPTO_IMAGE,
    creatorRootDid: "did:iq:creator2",
    tenantId: "qriptopian",
    modalities: {
      read: { enabled: true },
      watch: { enabled: false },
      listen: { enabled: false },
      interact: { enabled: false },
    },
    structure: { kind: "article" },
    pricingModel: {
      tiers: [{ kind: "free", amount: 0, currency: "QCT", covers: 1 }],
      acceptedTokens: [],
    },
    libraryMetadata: {
      category: "capsule",
      tags: ["capsule", "experience", "read"],
      recommendedShelf: "capsules",
      expiry: { model: "permanent" },
      ownership: { status: "available", libraryStatus: "not_owned" },
      discovery: { featured: true, curated: true, priority: 1 },
    },
    status: "published",
    createdAt: new Date().toISOString(),
    runtimeSource: "experience",
  } as unknown as RuntimeCapsule,
  {
    id: "capsule-metaknyt-play",
    type: "SmartContentQube",
    app: "metaKnyts",
    title: "21 Awakenings Overview",
    slug: "play-metaknyt",
    version: 1,
    description: "Jump into an episode experience with smart modules and rewards.",
    coverImageUri: FAILSAFE_QRIPTO_IMAGE,
    creatorRootDid: "did:iq:creator1",
    tenantId: "metaknyts",
    modalities: {
      read: { enabled: true },
      watch: { enabled: false },
      listen: { enabled: false },
      interact: { enabled: true },
    },
    structure: { kind: "episode", panelCount: 6 },
    pricingModel: {
      tiers: [{ kind: "payPerEpisode", amount: 50, currency: "QCT", covers: 6 }],
      acceptedTokens: ["QCT"],
    },
    libraryMetadata: {
      category: "capsule",
      tags: ["capsule", "experience", "play"],
      recommendedShelf: "capsules",
      expiry: { model: "permanent" },
      ownership: { status: "available", libraryStatus: "not_owned" },
      discovery: { featured: true, curated: true, priority: 2 },
    },
    status: "published",
    createdAt: new Date().toISOString(),
    runtimeSource: "experience",
  } as unknown as RuntimeCapsule,
  {
    id: "capsule-qriptopian-reading-sprint",
    type: "SmartContentQube",
    app: "Qriptopian",
    title: "Qriptopian Reading Sprint",
    slug: "qriptopian-reading-sprint",
    version: 1,
    description: "Guided 15-20 minute reading sprint with takeaways and rewards.",
    coverImageUri: FAILSAFE_QRIPTO_IMAGE,
    creatorRootDid: "did:iq:creator4",
    tenantId: "qriptopian",
    modalities: {
      read: { enabled: true },
      watch: { enabled: false },
      listen: { enabled: false },
      interact: { enabled: true },
    },
    structure: { kind: "episode", panelCount: 8 },
    pricingModel: {
      tiers: [{ kind: "payPerEpisode", amount: 0.05, currency: "QCT", covers: 1 }],
      acceptedTokens: ["QCT"],
    },
    libraryMetadata: {
      category: "capsule",
      tags: ["capsule", "experience", "read", "play", "qriptopian", "sprint"],
      recommendedShelf: "capsules",
      expiry: { model: "permanent" },
      ownership: { status: "available", libraryStatus: "not_owned" },
      discovery: { featured: true, curated: true, priority: 2 },
    },
    status: "published",
    createdAt: new Date().toISOString(),
    runtimeSource: "experience",
  } as unknown as RuntimeCapsule,
  {
    id: "capsule-earn-reward",
    type: "SmartContentQube",
    app: "AgentiQ",
    title: "The Clip That Sold Itself",
    slug: "earn-rewards",
    version: 1,
    description: "Complete a short task flow to earn Q and unlock content.",
    coverImageUri: FAILSAFE_QRIPTO_IMAGE,
    creatorRootDid: "did:iq:creator3",
    tenantId: "agentiq",
    modalities: {
      read: { enabled: true },
      watch: { enabled: true },
      listen: { enabled: false },
      interact: { enabled: true },
    },
    structure: { kind: "tutorial" },
    pricingModel: {
      tiers: [{ kind: "free", amount: 0, currency: "QCT", covers: 1 }],
      acceptedTokens: [],
    },
    libraryMetadata: {
      category: "capsule",
      tags: ["capsule", "experience", "watch", "earn"],
      recommendedShelf: "capsules",
      expiry: { model: "permanent" },
      ownership: { status: "available", libraryStatus: "not_owned" },
      discovery: { featured: true, curated: true, priority: 3 },
    },
    status: "published",
    createdAt: new Date().toISOString(),
    runtimeSource: "experience",
  } as unknown as RuntimeCapsule,
];

const SHOWCASE_CODEX_SLUGS = new Set(["qripto", "knyt"]);
const SHOWCASE_MATCHERS = ["qripto", "qriptopian", "knyt", "metaknyt", "metaknyts"];

const INTENT_KEYWORDS: Record<RuntimeIntent, string[]> = {
  watch: ["watch", "video", "clip", "tv"],
  listen: ["listen", "audio", "podcast", "sound"],
  read: ["read", "article", "book", "story", "novel"],
  play: ["play", "interactive", "game"],
  find: ["find", "discover", "search", "show"],
  earn: ["earn", "reward", "q", "knyt"],
  make: ["make", "create", "build", "customize"],
  be: ["be", "persona", "identity"],
};

function inferIntent(prompt: string): RuntimeIntent {
  const lower = prompt.toLowerCase();
  const scored = Object.entries(INTENT_KEYWORDS).map(([intent, keywords]) => ({
    intent: intent as RuntimeIntent,
    score: keywords.reduce((sum, keyword) => (lower.includes(keyword) ? sum + 1 : sum), 0),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.score ? scored[0].intent : "find";
}

function coerceDeviceType(input: unknown): DeviceType | null {
  if (typeof input !== "string") return null;
  const normalized = input.toLowerCase();
  if (normalized === "mobile" || normalized === "tablet" || normalized === "desktop") {
    return normalized;
  }
  return null;
}

function menuPromptFromActionId(actionId: string): string | null {
  const normalized = actionId.trim().toLowerCase();
  if (normalized === "be" || normalized === "compass_be") return "I want to be...";
  if (normalized === "earn" || normalized === "compass_earn") return "How can I earn...";
  if (normalized === "play" || normalized === "compass_play") return "I'd like to play experiences.";
  if (normalized === "make" || normalized === "compass_make") return "I want to make...";
  if (normalized === "share" || normalized === "compass_share") return "Help me find experiences to share.";
  return null;
}

function coerceRuntimeIntent(input: unknown): RuntimeIntent | null {
  if (typeof input !== "string") return null;
  const normalized = input.trim().toLowerCase();
  const intents: RuntimeIntent[] = ["watch", "listen", "read", "play", "find", "earn", "make", "be"];
  return intents.includes(normalized as RuntimeIntent) ? (normalized as RuntimeIntent) : null;
}

function isQuickActionPrompt(prompt: string): boolean {
  const normalized = prompt.trim().toLowerCase();
  const quickActionPrompts = new Set([
    "i'd like to watch experiences.",
    "i'd like to listen to experiences.",
    "i'd like to read experiences.",
    "help me find experiences.",
    "i want to be...",
    "how can i earn...",
    "i'd like to play experiences.",
    "i want to make...",
    "help me find experiences to share.",
    "launching earn…",
    "launching earn...",
    "launching play…",
    "launching play...",
    "launching make…",
    "launching make...",
    "launching be…",
    "launching be...",
    "launching share…",
    "launching share...",
  ]);
  return quickActionPrompts.has(normalized);
}

function resolveCapsuleCoverImage(content: RuntimeCapsule) {
  if (content.coverImageUri && content.coverImageUri.trim().length > 0) return content.coverImageUri;
  return "";
}

function isLikelyVideoUri(uri: string | null | undefined): boolean {
  if (!uri) return false;
  return /(\.mp4|\.mov|\.webm|\.m3u8)(\?.*)?$/i.test(uri) || uri.includes("/api/content/video/");
}

function normalizeImageCandidate(candidate: unknown): string | null {
  if (typeof candidate !== "string") return null;
  const value = candidate.trim();
  if (!value) return null;
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/")) return value;
  if (/\.(png|jpg|jpeg|webp|gif|avif|svg)$/i.test(value)) return value;
  return null;
}

function extractImageFromMediaAsset(asset: any): string | null {
  return (
    normalizeImageCandidate(asset?.thumbnailUri) ||
    normalizeImageCandidate(asset?.thumbnail_uri) ||
    normalizeImageCandidate(asset?.poster) ||
    normalizeImageCandidate(asset?.posterUrl) ||
    normalizeImageCandidate(asset?.storageUri) ||
    null
  );
}

function findNestedImageCandidate(node: unknown, depth = 0): string | null {
  if (depth > 3 || node == null) return null;
  if (typeof node === "string") return normalizeImageCandidate(node);
  if (Array.isArray(node)) {
    for (const entry of node) {
      const found = findNestedImageCandidate(entry, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof node !== "object") return null;

  const record = node as Record<string, unknown>;
  const preferredKeys = [
    "coverImageUri",
    "cover_image_uri",
    "preview_image",
    "heroImage",
    "hero_image",
    "thumbnailUri",
    "thumbnail_uri",
    "thumbnail",
    "imageUri",
    "image_uri",
    "imageUrl",
    "image_url",
    "image",
    "poster",
    "posterUrl",
    "banner",
    "mediaUri",
    "media_uri",
  ];
  for (const key of preferredKeys) {
    const found = normalizeImageCandidate(record[key]);
    if (found) return found;
  }
  for (const value of Object.values(record)) {
    const found = findNestedImageCandidate(value, depth + 1);
    if (found) return found;
  }
  return null;
}

function resolveAssociatedImage(raw: any): string {
  const config = raw?.configuration || {};
  const mediaCandidates = [
    ...(config?.modalities?.read?.panels || []),
    ...(config?.modalities?.watch?.videoAssets || []),
    ...(config?.modalities?.watch?.assets || []),
    ...(raw?.modalities?.read?.panels || []),
    ...(raw?.modalities?.watch?.videoAssets || []),
    ...(raw?.components || []),
  ];
  for (const candidate of mediaCandidates) {
    const image = extractImageFromMediaAsset(candidate) || findNestedImageCandidate(candidate);
    if (image) return image;
  }

  const directCandidates = [
    raw?.coverImageUri,
    raw?.cover_image_uri,
    raw?.preview_image,
    raw?.heroImage,
    raw?.hero_image,
    raw?.thumbnailUri,
    raw?.thumbnail_uri,
    raw?.image,
    raw?.imageUrl,
    config?.coverImageUri,
    config?.cover_image_uri,
    config?.preview_image,
    config?.heroImage,
    config?.hero_image,
    config?.thumbnail,
    config?.thumbnailUri,
  ];
  for (const candidate of directCandidates) {
    const image = normalizeImageCandidate(candidate);
    if (image) return image;
  }

  const deepMatch = findNestedImageCandidate(config) || findNestedImageCandidate(raw);
  if (deepMatch) return deepMatch;

  return "";
}

function isShowcaseCapsule(content: RuntimeCapsule) {
  if (content.runtimeSource === "codex") {
    return SHOWCASE_CODEX_SLUGS.has((content.runtimeCodexSlug || "").toLowerCase());
  }

  const searchable = [
    content.app,
    content.tenantId,
    content.title,
    content.slug,
    content.description,
    ...(content.libraryMetadata?.tags || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return SHOWCASE_MATCHERS.some((token) => searchable.includes(token));
}

function modalityEnabled(content: RuntimeCapsule, intent: RuntimeIntent): boolean {
  if (intent === "watch") return Boolean(content.modalities?.watch?.enabled);
  if (intent === "listen") return Boolean(content.modalities?.listen?.enabled);
  if (intent === "read") return Boolean(content.modalities?.read?.enabled);
  if (intent === "play") {
    return Boolean(content.modalities?.interact?.enabled || content.modalities?.watch?.enabled || content.modalities?.read?.enabled);
  }
  if (intent === "earn") {
    const pricing = content.pricingModel?.tiers?.[0]?.kind;
    return pricing !== "free";
  }
  return true;
}

function resolveRuntimeModule(device: DeviceType, intent: RuntimeIntent): RuntimeModuleConfig {
  const preset = RUNTIME_CODEX_MODULES[device];
  if (intent === "play") return preset.primary;
  return preset.secondary;
}

function resolveSmartMediaPanelStyles(
  device: DeviceType,
  intent: RuntimeIntent
): { videoStyle: React.CSSProperties | undefined; imageStyle: React.CSSProperties | undefined } {
  if (device === "mobile") {
    return { videoStyle: undefined, imageStyle: undefined };
  }

  // For smart-content playback, desktop should favor 3/4 and tablet full-height behavior.
  const moduleConfig = intent === "play" || intent === "watch" ? RUNTIME_CODEX_MODULES[device].secondary : resolveRuntimeModule(device, intent);
  const videoHeight =
    moduleConfig.screenFraction === "screen-full"
      ? "min(82vh, 820px)"
      : moduleConfig.screenFraction === "screen-3-4"
        ? "min(74vh, 760px)"
        : "min(62vh, 660px)";
  return {
    videoStyle: { height: videoHeight },
    imageStyle: { height: "min(24vh, 240px)" },
  };
}

function withDeviceParam(href: string, device: DeviceType): string {
  if (!href) return href;
  const [path, hashPart] = href.split("#");
  const separator = path.includes("?") ? "&" : "?";
  const hasDevice = /(?:\?|&)device=/.test(path);
  const nextPath = hasDevice ? path.replace(/([?&]device=)[^&]*/g, `$1${device}`) : `${path}${separator}device=${device}`;
  return hashPart ? `${nextPath}#${hashPart}` : nextPath;
}

function withQueryParam(href: string, key: string, value: string): string {
  if (!href) return href;
  const [path, hashPart] = href.split("#");
  const pattern = new RegExp(`([?&]${key}=)[^&]*`);
  const separator = path.includes("?") ? "&" : "?";
  const nextPath = pattern.test(path) ? path.replace(pattern, `$1${value}`) : `${path}${separator}${key}=${value}`;
  return hashPart ? `${nextPath}#${hashPart}` : nextPath;
}

function scoreContent(content: RuntimeCapsule, prompt: string, intent: RuntimeIntent): number {
  let score = 0;
  if (modalityEnabled(content, intent)) score += 5;
  if (content.runtimeAssetStatus === "resolved" || resolveCapsuleCoverImage(content)) score += 4;
  const searchable = `${content.title} ${content.description} ${content.slug} ${content.libraryMetadata?.tags?.join(" ") || ""}`.toLowerCase();
  const words = prompt.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2);
  for (const word of words) {
    if (searchable.includes(word)) score += 1;
  }
  if (isShowcaseCapsule(content)) score += 3;
  if (content.modalities?.read?.enabled) score += 1;
  if (content.modalities?.watch?.enabled) score += 1;
  if (intent === "play" && content.runtimeSource === "smart-content") score += 5;
  if (intent === "watch" && isLikelyVideoUri(content.runtimePreviewMediaUri || null)) score += 3;
  if (intent !== "play" && content.runtimeSource === "experience") score += 1;
  if (intent === "make" && content.runtimeSource === "experience") score += 8;
  if (intent === "make" && content.runtimeContentKind === "article") score += 2;
  if (intent === "make" && content.runtimeMenuIntent === "make") score += 4;
  return score;
}

function applySmartTriadIntentRules(contents: RuntimeCapsule[], prompt: string, intent: RuntimeIntent) {
  return contents.map((content) => ({
    content,
    score: scoreContent(content, prompt, intent),
  }));
}

function applyRuntimeCopilotFilter(
  rows: Array<{ content: RuntimeCapsule; score: number }>,
  intent: RuntimeIntent,
  device: DeviceType
) {
  const sourcePriority = SOURCE_PRIORITY_BY_INTENT[intent];
  return [...rows]
    .map((row) => {
      const sourceRank = sourcePriority.indexOf(row.content.runtimeSource);
      const sourceBonus = sourceRank === -1 ? 0 : (sourcePriority.length - sourceRank) * 2;
      const moduleBonus =
        row.content.runtimeSource === "codex" ? (resolveRuntimeModule(device, intent).screenFraction === "screen-full" ? 2 : 1) : 0;
      return {
        content: row.content,
        score: row.score + sourceBonus + moduleBonus,
      };
    })
    .sort((a, b) => b.score - a.score)
    .map((row) => row.content);
}

function selectCapsulesForDisplay(ranked: RuntimeCapsule[], limit = 6): RuntimeCapsule[] {
  const unique = ranked.filter((content, index, array) => array.findIndex((item) => item.id === content.id) === index);
  const withAssets = unique.filter((content) => resolveCapsuleCoverImage(content).length > 0);
  const pool = withAssets.length > 0 ? withAssets : unique;
  return pool.slice(0, limit);
}

function shuffleArray<T>(rows: T[]): T[] {
  const next = [...rows];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[randomIndex]] = [next[randomIndex], next[index]];
  }
  return next;
}

function diversifyPlayCapsules(rows: RuntimeCapsule[], previousLeadId: string | null): RuntimeCapsule[] {
  const shuffled = shuffleArray(rows);
  if (!previousLeadId || shuffled.length < 2) return shuffled;
  if (shuffled[0]?.id !== previousLeadId) return shuffled;
  const alternateIndex = shuffled.findIndex((row) => row.id !== previousLeadId);
  if (alternateIndex <= 0) return shuffled;
  [shuffled[0], shuffled[alternateIndex]] = [shuffled[alternateIndex], shuffled[0]];
  return shuffled;
}

function toSmartContentFromExperience(raw: any): RuntimeCapsule {
  const config = raw?.configuration || {};
  const modalityFlags = config?.modalities || {};
  const associatedImage = resolveAssociatedImage(raw);
  const tags: string[] = [];
  if (raw?.metadata?.category) tags.push(String(raw.metadata.category));
  if (raw?.template_id) tags.push(String(raw.template_id));
  tags.push("capsule", "experience");

  const firstTier =
    config?.pricingModel?.tiers?.[0] ||
    (config?.price
      ? { kind: "payPerEpisode", amount: Number(config.price) || 0, currency: "QCT", covers: 1 }
      : { kind: "free", amount: 0, currency: "QCT", covers: 1 });

  return {
    id: String(raw?.id || `exp-${Date.now()}`),
    type: "SmartContentQube",
    app: "metaKnyts",
    title: String(raw?.name || "ExperienceQube"),
    slug: String(raw?.id || "experience-qube"),
    version: 1,
    description: String(raw?.description || raw?.goal || "Experience capsule"),
    coverImageUri: associatedImage,
    creatorRootDid: `did:iq:${raw?.creator_id || "creator"}`,
    tenantId: String(raw?.tenant_id || "metame"),
    modalities: {
      read: { enabled: Boolean(modalityFlags?.read?.enabled) || /read|article|story/i.test(JSON.stringify(config)) },
      watch: { enabled: Boolean(modalityFlags?.watch?.enabled) || /watch|video|clip/i.test(JSON.stringify(config)) },
      listen: { enabled: Boolean(modalityFlags?.listen?.enabled) || /listen|audio|podcast/i.test(JSON.stringify(config)) },
      interact: { enabled: Boolean(modalityFlags?.interact?.enabled) || /play|interactive|game/i.test(JSON.stringify(config)) },
    },
    structure: { kind: "episode" },
    pricingModel: {
      tiers: [firstTier],
      acceptedTokens: ["QCT"],
    },
    libraryMetadata: {
      category: "capsule",
      tags,
      recommendedShelf: "capsules",
      expiry: { model: "permanent" },
      ownership: { status: "available", libraryStatus: "not_owned" },
      discovery: { featured: true, curated: true, priority: 1 },
    },
    status: "published",
    createdAt: new Date().toISOString(),
    runtimeSource: "experience",
  } as unknown as RuntimeCapsule;
}

function toSmartContentFromRegistry(raw: any): RuntimeCapsule {
  const associatedImage = resolveAssociatedImage(raw);
  const tags = [...(raw?.libraryMetadata?.tags || []), "capsule"];
  const hasCodexTag = tags.some((tag) => /codex/i.test(String(tag)));
  const slug = String(raw?.slug || "");
  return {
    ...raw,
    coverImageUri: raw?.coverImageUri || associatedImage,
    libraryMetadata: {
      ...(raw?.libraryMetadata || {}),
      tags,
    },
    runtimeSource: hasCodexTag ? "codex" : "smart-content",
    runtimeCodexSlug: hasCodexTag ? slug.replace(/-codex$/i, "") : undefined,
    runtimeCodexInitialTab: hasCodexTag ? "codex" : undefined,
  } as RuntimeCapsule;
}

function toSmartContentFromCodex(raw: any): RuntimeCapsule {
  const codexId = String(raw?.id || `codex-${Date.now()}`);
  const codexSlug = String(raw?.slug || codexId).replace(/-codex$/i, "");
  const codexName = String(raw?.name || "Codex");
  const metadata = raw?.metadata || {};
  const tags = Array.isArray(metadata?.tags) ? metadata.tags.map((tag: unknown) => String(tag)) : [];
  const associatedImage = resolveAssociatedImage(raw);
  return {
    id: `capsule-${codexId}`,
    type: "SmartContentQube",
    app: codexName,
    title: `${codexName} Capsule`,
    slug: `${codexSlug}-capsule`,
    version: 1,
    description: String(metadata?.description || `Launch ${codexName} from the SmartTriad runtime shell.`),
    coverImageUri: associatedImage,
    creatorRootDid: `did:iq:${raw?.owner || "codex"}`,
    tenantId: String(raw?.owner || "metame"),
    modalities: {
      read: { enabled: true },
      watch: { enabled: false },
      listen: { enabled: false },
      interact: { enabled: true },
    },
    structure: { kind: "collection" },
    pricingModel: {
      tiers: [{ kind: "free", amount: 0, currency: "QCT", covers: 1 }],
      acceptedTokens: [],
    },
    libraryMetadata: {
      category: "capsule",
      tags: [...tags, "capsule", "codex", "play", "smarttriad", "runtime"],
      recommendedShelf: "capsules",
      expiry: { model: "permanent" },
      ownership: { status: "available", libraryStatus: "not_owned" },
      discovery: { featured: true, curated: true, priority: 1 },
    },
    status: raw?.enabled === false ? "draft" : "published",
    createdAt: raw?.createdAt || new Date().toISOString(),
    runtimeSource: "codex",
    runtimeCodexSlug: codexSlug,
    runtimeCodexInitialTab: "codex",
  } as unknown as RuntimeCapsule;
}

function fromRuntimeCapsuleRecord(record: RuntimeCapsuleRecord): RuntimeCapsule {
  const runtimeSource: RuntimeContentSource = record.sourceType;
  const modalityHints = record.metadata?.modalityHints || [];
  const slug = record.metadata?.codexSlug || record.id;
  const sourceLabel = record.sourceType;
  const surfaceIntent = record.metadata?.surfaceIntent || (record.sourceType === "experience" ? "make" : "play");
  return {
    id: record.id,
    type: "SmartContentQube",
    app: record.metadata?.codexSlug ? record.metadata.codexSlug : "metaMe",
    title: record.title,
    slug,
    version: 1,
    description: record.description,
    coverImageUri: record.heroAsset?.uri || record.thumbnailAsset?.uri || "",
    creatorRootDid: "did:iq:runtime",
    tenantId: record.metadata?.tenantId || "metame",
    modalities: {
      read: { enabled: modalityHints.includes("read") },
      watch: { enabled: modalityHints.includes("watch") },
      listen: { enabled: modalityHints.includes("listen") },
      interact: { enabled: modalityHints.includes("play") || record.sourceType === "experience" },
    },
    structure: { kind: "episode" },
    pricingModel: {
      tiers: [{ kind: "free", amount: 0, currency: "QCT", covers: 1 }],
      acceptedTokens: [],
    },
    libraryMetadata: {
      category: "capsule",
      tags: ["capsule", sourceLabel, ...(record.metadata?.modalityHints || [])],
      recommendedShelf: "capsules",
      expiry: { model: "permanent" },
      ownership: { status: "available", libraryStatus: "not_owned" },
      discovery: { featured: true, curated: true, priority: 1 },
    },
    status: (record.metadata?.status as "draft" | "published" | "archived" | "scheduled") || "published",
    createdAt: new Date().toISOString(),
    runtimeSource,
    runtimeMenuIntent: surfaceIntent,
    runtimeCodexSlug: record.metadata?.codexSlug,
    runtimeCodexInitialTab: record.metadata?.codexTab || (record.sourceType === "codex" ? "codex" : undefined),
    runtimeLaunchHref: record.launchTarget?.href,
    runtimeLaunchType: record.launchTarget?.type,
    runtimeAssetStatus: record.assetStatus,
    runtimeModalityHints: record.metadata?.modalityHints || [],
    runtimeDurationMinutes: record.metadata?.durationMinutes ?? null,
    runtimePriceLabel: record.metadata?.priceLabel ?? null,
    runtimeStatus: record.metadata?.status ?? null,
    runtimeContentKind: record.metadata?.contentKind ?? null,
    runtimePreviewMediaUri: record.metadata?.previewMediaUri ?? null,
  } as unknown as RuntimeCapsule;
}

function buildPreviewExperienceCapsule(input: {
  experienceId: string;
  selectedCapsuleId: string | null;
  title?: string | null;
  description?: string | null;
  imageUri?: string | null;
  imagePortraitUri?: string | null;
  imageLandscapeUri?: string | null;
  videoUri?: string | null;
  intent?: RuntimeIntent | null;
  quickLink?: RuntimeIntent | null;
  contentKind?: "article" | "video" | "character" | "episode" | "generic" | null;
  activeCodexId?: string | null;
  activeCodexName?: string | null;
  activeCodexTab?: string | null;
  runtimeCartridge?: string | null;
  personaAssignment?: string | null;
  crmCohortAssignment?: string | null;
  policyAssignment?: string | null;
}): RuntimeCapsule {
  const capsuleId = input.selectedCapsuleId || input.experienceId;
  const title = (input.title || "").trim() || "Experience Preview";
  const description = (input.description || "").trim() || "Runtime preview launched from Studio ExperienceQube.";
  const imageUri = (input.imageUri || "").trim();
  const intent = input.intent || "read";
  const quickLink = input.quickLink || intent;
  return {
    id: capsuleId,
    type: "SmartContentQube",
    app: "metaMe",
    title,
    slug: `experience-preview-${input.experienceId}`,
    version: 1,
    description,
    coverImageUri: imageUri || FAILSAFE_QRIPTO_IMAGE,
    creatorRootDid: "did:iq:composer",
    tenantId: "metame",
    modalities: {
      read: { enabled: intent === "read" || quickLink === "read" },
      watch: { enabled: Boolean(input.videoUri) || intent === "watch" || quickLink === "watch" },
      listen: { enabled: false },
      interact: { enabled: true },
    },
    structure: { kind: "episode", panelCount: 1 },
    pricingModel: {
      tiers: [{ kind: "free", amount: 0, currency: "QCT", covers: 1 }],
      acceptedTokens: [],
    },
    libraryMetadata: {
      category: "capsule",
      tags: ["capsule", "experience", "preview", intent, quickLink],
      recommendedShelf: "capsules",
      expiry: { model: "permanent" },
      ownership: { status: "available", libraryStatus: "owned" },
      discovery: { featured: true, curated: true, priority: 1 },
    },
    status: "published",
    createdAt: new Date().toISOString(),
    runtimeSource: "experience",
    runtimeMenuIntent: "make",
    runtimeCodexInitialTab: input.activeCodexTab || undefined,
    runtimeLaunchHref: `/studio/composer/experience/${encodeURIComponent(input.experienceId)}?embed=1`,
    runtimeLaunchType: "experience",
    runtimeAssetStatus: "resolved",
    runtimeModalityHints: ["play", intent, quickLink],
    runtimeContentKind: input.contentKind || "episode",
    runtimePreviewMediaUri: input.videoUri || input.imageLandscapeUri || input.imagePortraitUri || imageUri || null,
  } as unknown as RuntimeCapsule;
}

function chooseExperiencePreviewImage(input: {
  device: DeviceType;
  fallbackImage?: string | null;
  portraitImage?: string | null;
  landscapeImage?: string | null;
  preferredMobile?: "portrait" | "landscape" | null;
  preferredTablet?: "portrait" | "landscape" | null;
  preferredDesktop?: "portrait" | "landscape" | null;
}) {
  const fallbackImage = (input.fallbackImage || "").trim();
  const portraitImage = (input.portraitImage || "").trim();
  const landscapeImage = (input.landscapeImage || "").trim();
  const preferred =
    input.device === "mobile"
      ? input.preferredMobile
      : input.device === "tablet"
        ? input.preferredTablet
        : input.preferredDesktop;
  if (preferred === "portrait" && portraitImage) return portraitImage;
  if (preferred === "landscape" && landscapeImage) return landscapeImage;
  if (input.device === "mobile" && portraitImage) return portraitImage;
  if ((input.device === "tablet" || input.device === "desktop") && landscapeImage) return landscapeImage;
  return portraitImage || landscapeImage || fallbackImage || null;
}

export default function MetaMeRuntimeClient() {
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const embedMode = searchParams?.get("embed") === "1";
  const thinShellQueryMode = searchParams?.get("shell") === "thin" || searchParams?.get("chrome") === "content-only";
  const selectedCapsuleId = searchParams?.get("capsule") ?? null;
  const selectedExperienceId = searchParams?.get("experienceId")?.trim() || null;
  const selectedExperienceName = searchParams?.get("experienceName");
  const selectedExperienceDescription = searchParams?.get("experienceDescription");
  const selectedExperienceImage = searchParams?.get("experienceImage");
  const selectedExperienceImagePortrait = searchParams?.get("experienceImagePortrait");
  const selectedExperienceImageLandscape = searchParams?.get("experienceImageLandscape");
  const selectedExperienceVideo = searchParams?.get("experienceVideo");
  const runtimeIntentParam = coerceRuntimeIntent(searchParams?.get("runtimeIntent"));
  const runtimeQuickLinkParam = coerceRuntimeIntent(searchParams?.get("runtimeQuickLink"));
  const runtimeContentKindParam = searchParams?.get("contentKind");
  const runtimeActiveCodexId = searchParams?.get("activeCodexId");
  const runtimeActiveCodexName = searchParams?.get("activeCodexName");
  const runtimeCodexTab = searchParams?.get("runtimeCodexTab");
  const runtimeCartridge = searchParams?.get("runtimeCartridge");
  const runtimePersonaAssignment = searchParams?.get("personaAssignment");
  const runtimeCrmCohortAssignment = searchParams?.get("crmCohortAssignment");
  const runtimePolicyAssignment = searchParams?.get("policyAssignment");
  const preferredImageOrientationMobile = searchParams?.get("preferredImageOrientationMobile");
  const preferredImageOrientationTablet = searchParams?.get("preferredImageOrientationTablet");
  const preferredImageOrientationDesktop = searchParams?.get("preferredImageOrientationDesktop");
  const deviceParam = (searchParams?.get("device") as DeviceType) || "mobile";
  const defaultDevice: DeviceType =
    deviceParam === "desktop" || deviceParam === "tablet" || deviceParam === "mobile" ? deviceParam : "mobile";
  const [activeDevice, setActiveDevice] = useState<DeviceType>(defaultDevice);
  const [thinShellMode, setThinShellMode] = useState(thinShellQueryMode);
  const isMobileLayout = activeDevice === "mobile";
  const shellOriginRef = useRef<string | null>(null);
  const shellContextRef = useRef<{ tenant_id?: string; persona_id?: string }>({});
  const runtimeReadyPostedRef = useRef(false);
  const [activePersonaId, setActivePersonaId] = useState<string | null>(null);

  const [selectedAgent, setSelectedAgent] = useState<RuntimeAgent>(RUNTIME_AGENTS[0]);
  const [showAgentSelector, setShowAgentSelector] = useState(false);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const previousWelcomeRef = useRef(true);
  const [isRuntimeFullscreen, setIsRuntimeFullscreen] = useState(false);
  const [welcomePrompt, setWelcomePrompt] = useState("");
  const [showWelcomeQuickLinks, setShowWelcomeQuickLinks] = useState(false);
  const quickLinksHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectorHideTimeoutsRef = useRef<{
    agent: ReturnType<typeof setTimeout> | null;
    model: ReturnType<typeof setTimeout> | null;
  }>({
    agent: null,
    model: null,
  });

  const staticProviderMap = useMemo<Record<string, AgentProviderOption[]>>(() => getStaticAgentLlmProviders(), []);
  const [agentProviderMap, setAgentProviderMap] = useState<Record<string, AgentProviderOption[]>>(staticProviderMap);
  const [selectedModelByAgent, setSelectedModelByAgent] = useState<RuntimeAgentModelMap>(() =>
    initialModelMap(staticProviderMap)
  );

  const activeAgentProviders = agentProviderMap[selectedAgent.id] || [];
  const activeModel = selectedModelByAgent[selectedAgent.id] || defaultSelectionFromProviders(activeAgentProviders);
  const trustProvider = activeModel?.providerId;
  const activePersonaKey = activePersonaId || (selectedAgent.id === "aigent-moneypenny" ? "moneypenny" : "kn0w1");
  const selectedAdaptiveExperienceImage = useMemo(
    () =>
      chooseExperiencePreviewImage({
        device: activeDevice,
        fallbackImage: selectedExperienceImage,
        portraitImage: selectedExperienceImagePortrait,
        landscapeImage: selectedExperienceImageLandscape,
        preferredMobile:
          preferredImageOrientationMobile === "portrait" || preferredImageOrientationMobile === "landscape"
            ? preferredImageOrientationMobile
            : null,
        preferredTablet:
          preferredImageOrientationTablet === "portrait" || preferredImageOrientationTablet === "landscape"
            ? preferredImageOrientationTablet
            : null,
        preferredDesktop:
          preferredImageOrientationDesktop === "portrait" || preferredImageOrientationDesktop === "landscape"
            ? preferredImageOrientationDesktop
            : null,
      }),
    [
      activeDevice,
      preferredImageOrientationDesktop,
      preferredImageOrientationMobile,
      preferredImageOrientationTablet,
      selectedExperienceImage,
      selectedExperienceImageLandscape,
      selectedExperienceImagePortrait,
    ],
  );

  const refreshPersonaMemory = useCallback((personaKey: string) => {
    setPersonaMemoryEntries(readRuntimePersonaMemoryEntries(personaKey));
  }, []);

  const persistPersonaMemory = useCallback(
    (entry: {
      prompt: string;
      inference: string;
      intent: RuntimeIntent;
      source: "menu_action" | "quick_link" | "text_input" | "runtime_ui";
      welcomePrompt: boolean;
      capsuleId?: string | null;
      device: DeviceType;
    }) => {
      const next = appendRuntimePersonaMemoryEntry(activePersonaKey, {
        prompt: entry.prompt,
        inference: entry.inference,
        intent: entry.intent,
        source: entry.source,
        welcomePrompt: entry.welcomePrompt,
        capsuleId: entry.capsuleId ?? null,
        device: entry.device,
      });
      setPersonaMemoryEntries(next);
    },
    [activePersonaKey]
  );

  const applyShellSelectorChange = useCallback(
    (aigentId?: string | null, llmId?: string | null) => {
      const requestedAgent =
        typeof aigentId === "string" ? RUNTIME_AGENTS.find((agent) => agent.id === aigentId) ?? null : null;
      const targetAgent = requestedAgent ?? selectedAgent;

      if (requestedAgent) {
        setSelectedAgent(requestedAgent);
      }

      if (!llmId) return;

      const providers = agentProviderMap[targetAgent.id] || [];
      for (const provider of providers) {
        const model = provider.models.find((entry) => entry.id === llmId);
        if (!model) continue;
        setSelectedModelByAgent((prev) => ({
          ...prev,
          [targetAgent.id]: {
            providerId: provider.id,
            providerLabel: provider.label,
            modelId: model.id,
            modelLabel: model.label,
            sourceIQubeId: model.sourceIQubeId,
          },
        }));
        return;
      }
    },
    [agentProviderMap, selectedAgent]
  );

  const applyModelSelection = useCallback(
    (provider: AgentProviderOption, model: AgentProviderOption["models"][number]) => {
      setSelectedModelByAgent((prev) => ({
        ...prev,
        [selectedAgent.id]: {
          providerId: provider.id,
          providerLabel: provider.label,
          modelId: model.id,
          modelLabel: model.label,
          sourceIQubeId: model.sourceIQubeId,
        },
      }));
      setShowModelSelector(false);
      setShowAgentSelector(false);
    },
    [selectedAgent.id]
  );

  const clearSelectorHideTimeout = useCallback((kind: "agent" | "model") => {
    const timeoutId = selectorHideTimeoutsRef.current[kind];
    if (timeoutId) {
      clearTimeout(timeoutId);
      selectorHideTimeoutsRef.current[kind] = null;
    }
  }, []);

  const scheduleSelectorHideTimeout = useCallback(
    (kind: "agent" | "model") => {
      clearSelectorHideTimeout(kind);
      selectorHideTimeoutsRef.current[kind] = setTimeout(() => {
        if (kind === "agent") setShowAgentSelector(false);
        if (kind === "model") setShowModelSelector(false);
        selectorHideTimeoutsRef.current[kind] = null;
      }, 3000);
    },
    [clearSelectorHideTimeout]
  );

  useEffect(() => {
    let mounted = true;
    const loadAgentLlmOptions = async () => {
      try {
        const response = await fetch("/api/metame/agent-llm-options", { cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json();
        const liveMap = payload?.providerMap as Record<string, AgentProviderOption[]> | undefined;
        if (!mounted || !liveMap || typeof liveMap !== "object") return;

        setAgentProviderMap(liveMap);
        setSelectedModelByAgent((prev) => {
          const next: RuntimeAgentModelMap = { ...prev };
          for (const agent of RUNTIME_AGENTS) {
            const providers = liveMap[agent.id] || [];
            const current = next[agent.id];
            const valid =
              !!current &&
              providers.some(
                (provider) =>
                  provider.id === current.providerId &&
                  provider.models.some((model) => model.id === current.modelId)
              );
            if (!valid) next[agent.id] = defaultSelectionFromProviders(providers);
          }
          return next;
        });
      } catch {
        // Keep static fallback map if live source is unavailable.
      }
    };
    loadAgentLlmOptions();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(
    () => () => {
      clearSelectorHideTimeout("agent");
      clearSelectorHideTimeout("model");
    },
    [clearSelectorHideTimeout]
  );

  useEffect(() => {
    setActiveDevice(defaultDevice);
  }, [defaultDevice]);

  useEffect(() => {
    setThinShellMode(thinShellQueryMode);
  }, [thinShellQueryMode]);

  useEffect(() => {
    refreshPersonaMemory(activePersonaKey);
  }, [activePersonaKey, refreshPersonaMemory]);

  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [personaMemoryEntries, setPersonaMemoryEntries] = useState<RuntimePersonaMemoryEntry[]>([]);
  const [channels, setChannels] = useState<Array<{ channel_id: string; participants: string[] }>>([]);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [runtimeProcessing, setRuntimeProcessing] = useState(false);

  const [allContents, setAllContents] = useState<RuntimeCapsule[]>([]);
  const [capsuleContents, setCapsuleContents] = useState<RuntimeCapsule[]>([]);
  const [selectedCapsuleLocal, setSelectedCapsuleLocal] = useState<string | null>(null);
  const [lastIntent, setLastIntent] = useState<RuntimeIntent>("find");
  useEffect(() => {
    if (runtimeIntentParam) {
      setLastIntent(runtimeIntentParam);
    }
  }, [runtimeIntentParam]);
  const autoLaunchedCapsuleRef = useRef<string | null>(null);
  const activeCodexPanelMessageIdsRef = useRef<Set<string>>(new Set());
  const pendingRuntimeEventsRef = useRef<Array<{ type: RuntimeInboundType; payload: Record<string, unknown> }>>([]);
  const activeCapsuleId = selectedCapsuleLocal || selectedCapsuleId;
  const relayCloseCodexToNestedFrames = useCallback(() => {
    if (typeof window === "undefined") return;

    const nowIso = new Date().toISOString();
    const frames = Array.from(document.querySelectorAll("iframe"));
    for (const frame of frames) {
      const frameWindow = frame.contentWindow;
      if (!frameWindow) continue;
      try {
        frameWindow.postMessage(
          {
            type: "MENU_ACTION",
            msg_id: `runtime-close-codex-menu-${Date.now()}`,
            timestamp: nowIso,
            source: "runtime",
            payload: { action_id: "close_codex", action: "close_codex", intent: "close_codex" },
          },
          "*"
        );
        frameWindow.postMessage(
          {
            type: "NAVIGATE",
            msg_id: `runtime-close-codex-nav-${Date.now()}`,
            timestamp: nowIso,
            source: "runtime",
            payload: { path: "/", action: "close_codex" },
          },
          "*"
        );
        frameWindow.postMessage(
          {
            type: "METAME_CODEX_CLOSE_LAYER",
            source: "runtime",
            close_target: "codex-panel",
            runtime_source: "codex",
          },
          "*"
        );
        frameWindow.postMessage("METAME_CODEX_CLOSE_LAYER", "*");
      } catch (_) {
        // Ignore frame-level delivery failures; parent close path remains primary.
      }
    }
  }, []);
  const queryPreviewCapsule = useMemo(() => {
    if (!selectedExperienceId) return null;
    return buildPreviewExperienceCapsule({
      experienceId: selectedExperienceId,
      selectedCapsuleId,
      title: selectedExperienceName,
      description: selectedExperienceDescription,
      imageUri: selectedAdaptiveExperienceImage,
      imagePortraitUri: selectedExperienceImagePortrait,
      imageLandscapeUri: selectedExperienceImageLandscape,
      videoUri: selectedExperienceVideo,
      intent: runtimeIntentParam,
      quickLink: runtimeQuickLinkParam,
      activeCodexId: runtimeActiveCodexId,
      activeCodexName: runtimeActiveCodexName,
      activeCodexTab: runtimeCodexTab,
      runtimeCartridge,
      personaAssignment: runtimePersonaAssignment,
      crmCohortAssignment: runtimeCrmCohortAssignment,
      policyAssignment: runtimePolicyAssignment,
      contentKind:
        runtimeContentKindParam === "article" ||
        runtimeContentKindParam === "video" ||
        runtimeContentKindParam === "character" ||
        runtimeContentKindParam === "episode" ||
        runtimeContentKindParam === "generic"
          ? runtimeContentKindParam
          : null,
    });
  }, [
    runtimeActiveCodexId,
    runtimeActiveCodexName,
    runtimeCartridge,
    runtimeCodexTab,
    runtimeCrmCohortAssignment,
    runtimeContentKindParam,
    runtimeIntentParam,
    runtimePersonaAssignment,
    runtimePolicyAssignment,
    runtimeQuickLinkParam,
    selectedAdaptiveExperienceImage,
    selectedCapsuleId,
    selectedExperienceDescription,
    selectedExperienceId,
    selectedExperienceImageLandscape,
    selectedExperienceImagePortrait,
    selectedExperienceName,
    selectedExperienceVideo,
  ]);

  const fetchRuntimeCapsules = useCallback(
    async (options?: { intent?: RuntimeIntent; query?: string; allowFallback?: boolean; nonce?: number }): Promise<RuntimeCapsule[]> => {
      const params = new URLSearchParams();
      params.set("limit", "60");
      if (options?.intent) params.set("intent", options.intent);
      if (options?.query) params.set("q", options.query);
      if (options?.nonce) params.set("nonce", String(options.nonce));
      if (runtimeActiveCodexId) params.set("codexId", runtimeActiveCodexId);
      if (runtimeCodexTab) params.set("codexTab", runtimeCodexTab);
      if (runtimeCartridge) params.set("cartridge", runtimeCartridge);
      const response = await fetch(`/api/runtime/capsules?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Runtime capsules API failed with ${response.status}`);
      const payload = await response.json();
      const records = Array.isArray(payload?.capsules) ? (payload.capsules as RuntimeCapsuleRecord[]) : [];
      const mapped = records.map(fromRuntimeCapsuleRecord);
      if (mapped.length > 0) return mapped;
      return options?.allowFallback ? DEFAULT_CONTENTS : [];
    },
    [runtimeActiveCodexId, runtimeCartridge, runtimeCodexTab]
  );

  const fetchRuntimeData = useCallback(async () => {
    try {
      const activeSet = await fetchRuntimeCapsules({ allowFallback: false });
      if (activeSet.length > 0) {
        setAllContents(activeSet);
        setCapsuleContents(selectCapsulesForDisplay(activeSet, 6));
      } else {
        setAllContents([]);
        setCapsuleContents([]);
      }
    } catch {
      setAllContents((prev) => prev);
      setCapsuleContents((prev) => prev);
    }
  }, [fetchRuntimeCapsules]);

  useEffect(() => {
    fetchRuntimeData();
  }, [fetchRuntimeData]);

  useEffect(() => {
    if (!queryPreviewCapsule) return;
    setAllContents((prev) => {
      const existing = prev.find((item) => item.id === queryPreviewCapsule.id);
      if (
        existing &&
        existing.title === queryPreviewCapsule.title &&
        existing.description === queryPreviewCapsule.description &&
        existing.coverImageUri === queryPreviewCapsule.coverImageUri &&
        existing.runtimeLaunchHref === queryPreviewCapsule.runtimeLaunchHref
      ) {
        return prev;
      }
      const next = prev.filter((item) => item.id !== queryPreviewCapsule.id);
      return [queryPreviewCapsule, ...next];
    });
    setCapsuleContents((prev) => {
      const withoutQueryCapsule = prev.filter((item) => item.id !== queryPreviewCapsule.id);
      return selectCapsulesForDisplay([queryPreviewCapsule, ...withoutQueryCapsule], 6);
    });
  }, [queryPreviewCapsule]);

  useEffect(() => {
    let mounted = true;
    const loadChannels = async () => {
      setChannelsLoading(true);
      try {
        const res = await fetch("/api/qubetalk/channels?tenant_id=metame");
        const data = await res.json();
        if (mounted && data?.success && Array.isArray(data.channels)) {
          setChannels(data.channels);
        }
      } catch {
        if (mounted) setChannels([]);
      } finally {
        if (mounted) setChannelsLoading(false);
      }
    };
    loadChannels();
    return () => {
      mounted = false;
    };
  }, []);

  const refreshRuntime = useCallback(async () => {
    await fetchRuntimeData();
    toast("Runtime refreshed", "info");
  }, [fetchRuntimeData, toast]);

  const resetRuntime = useCallback(async () => {
    await fetchRuntimeData();
    setMessages([]);
    setShowWelcome(true);
    setRuntimeProcessing(false);
    setIsRuntimeFullscreen(false);
    setWelcomePrompt("");
    setShowWelcomeQuickLinks(false);
    setSelectedCapsuleLocal(null);
    setLastIntent("find");
    refreshPersonaMemory(activePersonaKey);
    toast("Runtime reset to welcome", "info");
  }, [activePersonaKey, fetchRuntimeData, refreshPersonaMemory, toast]);

  const buildSharePanel = useCallback(
    (capsuleTitle: string) => {
      const channelLabels =
        channels.length > 0 ? channels.map((channel) => channel.channel_id) : ["KNYT Crew", "Agentic Designers", "metaMe Studio"];
      return (
        <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-3 space-y-3">
          <p className="text-sm text-slate-200">
            Who would you like to share <span className="text-white font-semibold">{capsuleTitle}</span> with?
          </p>
          <div className="flex flex-wrap gap-2">
            {channelLabels.map((channel) => (
              <button
                key={channel}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:border-white/30 hover:text-white"
                onClick={() => {
                  setMessages((prev) => [
                    ...prev,
                    {
                      id: `share-${Date.now()}`,
                      role: "assistant",
                      content: `Shared with ${channel}.`,
                      timestamp: new Date(),
                    },
                  ]);
                  toast(`Shared "${capsuleTitle}" with ${channel}`, "success");
                }}
              >
                {channel}
              </button>
            ))}
            {channelsLoading && <span className="text-[10px] uppercase tracking-wider text-white/40">Loading channels…</span>}
          </div>
        </div>
      );
    },
    [channels, channelsLoading, toast]
  );

  const dismissCodexPanels = useCallback(() => {
    console.warn("[codex-close] dismissCodexPanels called directly");
    setMessages((prev) => {
      const next = prev.filter(
        (m) => !(m?.variant === "panel" && m?.id !== "capsule-panel")
      );
      console.warn("[codex-close] direct dismiss", { before: prev.length, after: next.length });
      return next;
    });
    setSelectedCapsuleLocal(null);
  }, []);

  const renderRuntimeFramePanel = useCallback(
    (content: RuntimeCapsule, intent: RuntimeIntent, options: { label: string; frameSrc: string }) => {
      const moduleConfig = resolveRuntimeModule(activeDevice, intent);
      const heroImage = resolveCapsuleCoverImage(content);
      const frameHeight =
        activeDevice === "mobile" ? "min(66vh, 560px)" : activeDevice === "tablet" ? "min(62vh, 620px)" : "min(60vh, 680px)";
      return (
        <div className="rounded-2xl border border-cyan-400/25 bg-slate-950/85 p-3 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/80">{options.label}</p>
              <p className="text-sm font-semibold text-white">{content.title}</p>
            </div>
            <div className="flex flex-wrap justify-end gap-1.5">
              <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-200">{moduleConfig.label}</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-slate-300">{moduleConfig.screenFraction}</span>
            </div>
          </div>
          {heroImage ? (
            <div className="relative overflow-hidden rounded-xl border border-white/10">
              <img src={heroImage} alt={`${content.title} hero`} className="h-28 w-full object-cover" loading="lazy" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />
            </div>
          ) : (
            <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 p-2 text-[11px] text-amber-100">
              Asset unavailable: no first-class hero image on this capsule yet.
            </div>
          )}
          <div className="rounded-xl border border-white/10 bg-slate-900/70 overflow-hidden">
            <iframe
              src={options.frameSrc}
              title={`${content.title} runtime`}
              className="w-full border-0"
              style={{ height: frameHeight }}
              loading="lazy"
            />
          </div>
          <p className="text-[11px] text-slate-400">
            Runtime capsule framework active. Device module <span className="text-slate-200">{moduleConfig.id}</span> applied for{" "}
            <span className="text-slate-200">{activeDevice}</span>.
          </p>
        </div>
      );
    },
    [activeDevice]
  );

  const buildRuntimeCapsulePanel = useCallback(
    (content: RuntimeCapsule, intent: RuntimeIntent) => {
      if (content.runtimeSource === "smart-content") {
        const heroImage = resolveCapsuleCoverImage(content);
        const videoUri = content.runtimePreviewMediaUri || null;
        const { videoStyle, imageStyle } = resolveSmartMediaPanelStyles(activeDevice, intent);
        return (
          <div className="rounded-2xl border border-emerald-400/25 bg-slate-950/85 p-3 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-300/80">Visual Capsule Runtime</p>
                <p className="text-sm font-semibold text-white">{content.title}</p>
              </div>
              <div className="flex items-center gap-1.5">
                {content.runtimeContentKind ? (
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-slate-200">
                    {content.runtimeContentKind}
                  </span>
                ) : null}
                {content.runtimePriceLabel ? (
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-slate-200">
                    {content.runtimePriceLabel}
                  </span>
                ) : null}
              </div>
            </div>

            {isLikelyVideoUri(videoUri) ? (
              <video
                src={videoUri || undefined}
                poster={heroImage || undefined}
                controls
                className="w-full rounded-xl border border-white/10 bg-slate-950 object-cover"
                style={videoStyle}
              />
            ) : heroImage ? (
              <img
                src={heroImage}
                alt={content.title}
                className="w-full rounded-xl border border-white/10 object-cover"
                style={imageStyle}
                loading="lazy"
              />
            ) : (
              <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 p-2 text-[11px] text-amber-100">
                Asset unavailable for this capsule.
              </div>
            )}

            {content.runtimeLaunchHref ? (
              <a
                href={content.runtimeLaunchHref}
                className="inline-flex rounded-lg border border-emerald-300/30 bg-emerald-500/15 px-3 py-1.5 text-[11px] text-emerald-100 hover:bg-emerald-500/25"
              >
                Open Source Capsule
              </a>
            ) : null}
          </div>
        );
      }

      if (content.runtimeSource === "codex") {
        const moduleConfig = resolveRuntimeModule(activeDevice, intent);
        const codexSlug = content.runtimeCodexSlug || "knyt";
        const initialTab = content.runtimeCodexInitialTab || "codex";
        const rawFrameSrc =
          content.runtimeLaunchHref ||
          `/triad/embed/codex/${codexSlug}?tab=${initialTab}&theme=dark&density=${moduleConfig.runtimeDensity}`;
        const frameSrc = withQueryParam(rawFrameSrc, "closable", "0");
        return renderRuntimeFramePanel(content, intent, {
          label: "Codex Capsule Runtime",
          frameSrc,
        });
      }

      if (content.runtimeSource === "experience") {
        const heroImage = resolveCapsuleCoverImage(content);
        const previewMedia = content.runtimePreviewMediaUri || null;
        const mediaImage = !isLikelyVideoUri(previewMedia) ? previewMedia || heroImage : heroImage;
        const { videoStyle, imageStyle } = resolveSmartMediaPanelStyles(activeDevice, intent);
        return (
          <div className="rounded-2xl border border-cyan-400/25 bg-slate-950/85 p-3 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/80">ExperienceQube Runtime</p>
                <p className="text-sm font-semibold text-white">{content.title}</p>
              </div>
              <div className="flex items-center gap-1.5">
                {content.runtimeContentKind ? (
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-slate-200">
                    {content.runtimeContentKind}
                  </span>
                ) : null}
                <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-200">
                  {activeDevice === "mobile" ? "portrait-first" : "landscape-first"}
                </span>
              </div>
            </div>

            {isLikelyVideoUri(previewMedia) ? (
              <video
                src={previewMedia || undefined}
                poster={heroImage || undefined}
                controls
                className="w-full rounded-xl border border-white/10 bg-slate-950 object-cover"
                style={videoStyle}
              />
            ) : mediaImage ? (
              <img
                src={mediaImage}
                alt={content.title}
                className="w-full rounded-xl border border-white/10 object-cover"
                style={imageStyle}
                loading="lazy"
              />
            ) : (
              <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 p-2 text-[11px] text-amber-100">
                Asset unavailable for this ExperienceQube.
              </div>
            )}

            <p className="text-[11px] text-slate-400">
              Rendering the published experience media directly in runtime to avoid nested iframe shells.
            </p>

            {content.runtimeLaunchHref ? (
              <a
                href={content.runtimeLaunchHref}
                className="inline-flex rounded-lg border border-cyan-300/30 bg-cyan-500/15 px-3 py-1.5 text-[11px] text-cyan-100 hover:bg-cyan-500/25"
              >
                Open Source Experience
              </a>
            ) : null}
          </div>
        );
      }

      return (
        <div className="rounded-2xl border border-white/15 bg-slate-950/85 p-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/60">Runtime Capsule Adapter Stub</p>
              <p className="text-sm font-semibold text-white">{content.title}</p>
            </div>
            <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] text-white/70">source: {content.runtimeSource}</span>
          </div>
          {resolveCapsuleCoverImage(content) ? (
            <img src={resolveCapsuleCoverImage(content)} alt={content.title} className="h-40 w-full rounded-xl object-cover opacity-85" loading="lazy" />
          ) : (
            <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 p-2 text-[11px] text-amber-100">
              Asset unavailable: adapter pending for this capsule source.
            </div>
          )}
          <p className="text-[11px] text-slate-400">
            Runtime capsule framework is active for this source. A dedicated renderer will be wired next.
          </p>
        </div>
      );
    },
    [activeDevice, renderRuntimeFramePanel]
  );

  const launchCapsule = useCallback(
    (content: RuntimeCapsule, intent: RuntimeIntent = lastIntent) => {
      setSelectedCapsuleLocal(content.id);
      const launchMessageId = buildLaunchMessageId({
        runtimeSource: content.runtimeSource,
        runtimeCodexSlug: content.runtimeCodexSlug || null,
      });
      if (content.runtimeSource === "codex") {
        activeCodexPanelMessageIdsRef.current.add(launchMessageId);
      }
      setMessages((prev) => [
        ...prev,
        {
          id: launchMessageId,
          role: "assistant",
          content: buildRuntimeCapsulePanel(content, intent),
          timestamp: new Date(),
          variant: "panel",
        },
      ]);
    },
    [buildRuntimeCapsulePanel, lastIntent]
  );

  useEffect(() => {
    if (!queryPreviewCapsule) {
      autoLaunchedCapsuleRef.current = null;
      return;
    }
    if (autoLaunchedCapsuleRef.current === queryPreviewCapsule.id) return;
    autoLaunchedCapsuleRef.current = queryPreviewCapsule.id;
    setShowWelcome(false);
    const launchIntent =
      runtimeIntentParam ||
      (queryPreviewCapsule.runtimeContentKind === "video" ? "watch" : "play");
    setLastIntent(launchIntent);
    setSelectedCapsuleLocal(queryPreviewCapsule.id);
    launchCapsule(queryPreviewCapsule, launchIntent);
  }, [launchCapsule, queryPreviewCapsule, runtimeIntentParam]);

  useEffect(() => {
    const readNavigateClose = (data: unknown): { isClose: boolean; codexId: string | null } => {
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        return { isClose: false, codexId: null };
      }
      const payload = data as {
        type?: unknown;
        payload?: {
          action?: unknown;
          codex_id?: unknown;
          codexId?: unknown;
          codex_slug?: unknown;
          codexSlug?: unknown;
        };
      };
      if (payload.type !== "NAVIGATE" || payload.payload?.action !== "close_codex") {
        return { isClose: false, codexId: null };
      }
      const raw =
        (typeof payload.payload?.codex_id === "string" && payload.payload.codex_id) ||
        (typeof payload.payload?.codexId === "string" && payload.payload.codexId) ||
        (typeof payload.payload?.codex_slug === "string" && payload.payload.codex_slug) ||
        (typeof payload.payload?.codexSlug === "string" && payload.payload.codexSlug) ||
        null;
      return { isClose: true, codexId: normalizeCodexId(raw) };
    };

    const dismissCodexPanels = (codexId: string | null) => {
      const trackedIds = activeCodexPanelMessageIdsRef.current;
      setMessages((prev) =>
        prev.filter((message) => {
          if (trackedIds.has(message.id)) {
            if (!codexId) return false;
            const normalized = normalizeCodexId(codexId);
            if (!normalized) return false;
            return !message.id.startsWith(`capsule-launch-codex-${normalized}-`);
          }
          return !shouldDismissForCodexClose(message, codexId);
        })
      );
      if (!codexId) {
        trackedIds.clear();
      } else {
        const normalized = normalizeCodexId(codexId);
        if (normalized) {
          trackedIds.forEach((messageId) => {
            if (messageId.startsWith(`capsule-launch-codex-${normalized}-`)) {
              trackedIds.delete(messageId);
            }
          });
        } else {
          trackedIds.clear();
        }
      }
      setSelectedCapsuleLocal(null);
    };

    function onAnyMessage(event: MessageEvent) {
      const d = event.data;
      if (!d) return;

      if (typeof d === "object" && d.type) {
        const t = d.type as string;
        if (t === "MENU_ACTION" || t === "NAVIGATE" || t === "METAME_CODEX_CLOSE_LAYER") {
          console.warn("[codex-close] onAnyMessage received", { type: t, payload: d.payload, action_id: d.payload?.action_id, action: d.payload?.action, source: event.source === window.parent ? "parent" : "other" });
        }
      }

      if (
        typeof d === "object" &&
        d.type === "MENU_ACTION" &&
        (
          d.payload?.action_id === "close_codex" ||
          d.payload?.item_id === "close_codex" ||
          d.payload?.action === "close_codex" ||
          d.payload?.intent === "close_codex"
        )
      ) {
        console.warn("[codex-close] onAnyMessage MENU_ACTION close_codex — dismissing");
        dismissCodexPanels(null);
        relayCloseCodexToNestedFrames();
        try { window.parent.postMessage({ type: "STATE_SYNC", source: "runtime", payload: { close_codex_ack: true, handler: "onAnyMessage" } }, "*"); } catch (_) {}
        return;
      }

      const closeSignal = readCodexClose(d);
      const navigateSignal = readNavigateClose(d);
      if (!closeSignal.isClose && !navigateSignal.isClose) return;
      console.warn("[codex-close] onAnyMessage close signal matched", { closeSignal, navigateSignal });
      dismissCodexPanels(closeSignal.isClose ? closeSignal.codexId : navigateSignal.codexId);
      relayCloseCodexToNestedFrames();
    }

    window.addEventListener("message", onAnyMessage);

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("metame_codex_close");
      bc.onmessage = (ev: MessageEvent) => {
        const closeSignal = readCodexClose(ev.data);
        const navigateSignal = readNavigateClose(ev.data);
        if (!closeSignal.isClose && !navigateSignal.isClose) return;
        dismissCodexPanels(closeSignal.isClose ? closeSignal.codexId : navigateSignal.codexId);
        relayCloseCodexToNestedFrames();
      };
    } catch (e) { /* BroadcastChannel not supported */ }

    return () => {
      window.removeEventListener("message", onAnyMessage);
      try { bc?.close(); } catch (_) {}
    };
  }, [relayCloseCodexToNestedFrames]);

  const capsulePanel = useMemo(
    () => (
      <div className="space-y-3">
        {capsuleContents.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3 text-[12px] text-slate-300">
            No visual capsules available yet. Try `read`, `watch`, or `find`.
          </div>
        ) : null}
        <div className="overflow-x-auto pb-1 no-scrollbar">
          <div className="flex snap-x snap-mandatory gap-3">
            {capsuleContents.map((content) => {
              const isSelected = content.id === activeCapsuleId;
              const progressValue = /awakenings|play|episode/i.test(content.title) ? 33 : 0;
              const heroImage = resolveCapsuleCoverImage(content);
              const modalityLabel = content.runtimeModalityHints?.slice(0, 2).join(" · ") || "details";
              const sourceBadgeClass =
                content.runtimeSource === "codex"
                  ? "border-cyan-300/45 bg-cyan-500/20 text-cyan-100"
                  : content.runtimeSource === "experience"
                    ? "border-violet-300/45 bg-violet-500/20 text-violet-100"
                    : "border-emerald-300/45 bg-emerald-500/20 text-emerald-100";
              const sourceLabel =
                content.runtimeSource === "experience"
                  ? "ExperienceQube"
                  : content.runtimeSource === "smart-content"
                    ? content.runtimeContentKind === "character"
                      ? "Character"
                      : content.runtimeContentKind === "video"
                        ? "Video"
                        : "Article"
                    : "Codex";
              return (
                <div
                  key={content.id}
                  className={`snap-start shrink-0 basis-[78%] min-w-[280px] max-w-[360px] h-[206px] rounded-2xl overflow-hidden border transition ${
                    isSelected ? "border-cyan-300/60 ring-1 ring-cyan-300/35" : "border-white/15 hover:border-white/30"
                  }`}
                  role="button"
                  tabIndex={0}
                  onClick={() => launchCapsule(content)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      launchCapsule(content);
                    }
                  }}
                >
                  <div className="relative h-full w-full">
                    {content.runtimeSource === "experience" && isLikelyVideoUri(content.runtimePreviewMediaUri || null) ? (
                      <video
                        src={content.runtimePreviewMediaUri || undefined}
                        poster={heroImage || undefined}
                        className="h-full w-full object-cover"
                        muted
                        playsInline
                        preload="metadata"
                      />
                    ) : heroImage ? (
                      <img src={heroImage} alt={content.title} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-900/35 to-slate-900/20" />
                    <div className="absolute inset-x-0 top-0 p-3 flex items-start justify-between gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${sourceBadgeClass}`}>
                        {sourceLabel}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            launchCapsule(content);
                          }}
                          className="rounded-full border border-white/20 bg-slate-900/60 p-1.5 text-white/80 hover:text-white"
                          title="Launch"
                        >
                          <PlayCircle className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            launchCapsule(content);
                          }}
                          className="rounded-full border border-white/20 bg-slate-900/60 p-1.5 text-white/80 hover:text-white"
                          title="Preview"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setMessages((prev) => [
                              ...prev,
                              {
                                id: `share-panel-${Date.now()}`,
                                role: "assistant",
                                content: buildSharePanel(content.title),
                                timestamp: new Date(),
                                variant: "panel",
                              },
                            ]);
                          }}
                          className="rounded-full border border-white/20 bg-slate-900/60 p-1.5 text-white/80 hover:text-white"
                          title="Share"
                        >
                          <Share2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 p-3 space-y-2">
                      <h4 className="line-clamp-1 text-sm font-semibold text-white">{content.title}</h4>
                      <p className="line-clamp-2 text-[11px] text-slate-200/85">{content.description}</p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-200/75">
                        <span className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 uppercase tracking-wide">{modalityLabel}</span>
                        {content.runtimeDurationMinutes ? (
                          <span className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5">{content.runtimeDurationMinutes} min</span>
                        ) : null}
                        {content.runtimePriceLabel ? (
                          <span className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5">{content.runtimePriceLabel}</span>
                        ) : null}
                        {content.runtimeAssetStatus === "missing" ? (
                          <span className="rounded-full border border-amber-300/35 bg-amber-500/20 px-2 py-0.5 text-amber-100">no asset</span>
                        ) : null}
                      </div>
                      <div className="h-1 w-full overflow-hidden rounded-full bg-white/15">
                        <div className="h-full bg-gradient-to-r from-cyan-400 to-violet-400" style={{ width: `${progressValue}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    ),
    [activeCapsuleId, buildSharePanel, capsuleContents, launchCapsule]
  );

  useEffect(() => {
    if (showWelcome) return;
    setMessages((prev) => {
      const withoutPanel = prev.filter((message) => message.id !== "capsule-panel");
      return [
        ...withoutPanel,
        {
          id: "capsule-panel",
          role: "assistant",
          content: capsulePanel,
          timestamp: new Date(),
          variant: "panel",
        },
      ];
    });
  }, [capsulePanel, showWelcome]);

  const flushQueuedRuntimeEvents = useCallback(() => {
    if (typeof window === "undefined") return;
    if (window.parent === window) return;
    const origin = shellOriginRef.current;
    if (!origin) return;
    if (pendingRuntimeEventsRef.current.length === 0) return;

    const queued = [...pendingRuntimeEventsRef.current];
    pendingRuntimeEventsRef.current = [];
    queued.forEach((eventPayload) => {
      const message = createRuntimeMessage(eventPayload.type, eventPayload.payload, shellContextRef.current);
      window.parent.postMessage(message, origin);
    });
  }, []);

  const postRuntimeEvent = useCallback(
    (type: RuntimeInboundType, payload: Record<string, unknown>) => {
      if (typeof window === "undefined") return;
      if (window.parent === window) return;
      const origin = shellOriginRef.current;
      if (!origin) {
        pendingRuntimeEventsRef.current.push({ type, payload });
        if (pendingRuntimeEventsRef.current.length > 50) {
          pendingRuntimeEventsRef.current.shift();
        }
        return;
      }

      const message = createRuntimeMessage(type, payload, shellContextRef.current);
      window.parent.postMessage(message, origin);
    },
    []
  );

  const handlePrompt = useCallback(
    async (
      prompt: string,
      options?: {
        source?: "menu_action" | "quick_link" | "text_input" | "runtime_ui";
        skipInference?: boolean;
        explicitIntent?: RuntimeIntent | null;
      }
    ) => {
      const trimmed = prompt.trim();
      if (!trimmed) return;
      if (trimmed === "__runtime_refresh__") {
        void refreshRuntime();
        return;
      }
      if (trimmed === "__runtime_reset__") {
        void resetRuntime();
        return;
      }
      if (trimmed === "__runtime_toggle_fullscreen__") {
        const nextFullscreen = !isRuntimeFullscreen;
        setIsRuntimeFullscreen(nextFullscreen);
        toast(nextFullscreen ? "Native preview enabled" : "Native preview disabled", "info");
        return;
      }

      const source = options?.source ?? "runtime_ui";
      const intent = options?.explicitIntent ?? inferIntent(trimmed);
      const skipInference = Boolean(options?.skipInference);
      const wasWelcomePrompt = showWelcome;
      let workingContents = allContents;
      const shouldRefetchForIntent = intent === "play" || workingContents.length === 0 || intent !== lastIntent;
      if (shouldRefetchForIntent) {
        try {
          workingContents = await fetchRuntimeCapsules({
            intent,
            query: trimmed,
            allowFallback: intent !== "play",
            nonce: Date.now(),
          });
          if (workingContents.length > 0) {
            setAllContents(workingContents);
          } else {
            setAllContents([]);
          }
        } catch {
          workingContents = allContents;
        }
      }

      const triadRanked = applySmartTriadIntentRules(workingContents, trimmed, intent);
      let runtimeFiltered = applyRuntimeCopilotFilter(triadRanked, intent, activeDevice);
      if (intent === "play") {
        runtimeFiltered = diversifyPlayCapsules(runtimeFiltered, selectedCapsuleLocal || null);
      }
      let ranked = selectCapsulesForDisplay(runtimeFiltered, 6);
      if (intent === "play") {
        ranked = diversifyPlayCapsules(ranked, selectedCapsuleLocal || null);
      }

      setCapsuleContents(ranked);
      setLastIntent(intent);
      setShowWelcome(false);
      setWelcomePrompt("");
      const leadCapsule = ranked[0] || null;
      if (leadCapsule?.id) setSelectedCapsuleLocal(leadCapsule.id);
      const mappedIntentSummary =
        ranked.length > 0
          ? `Mapped intent to ${intent} capsules using SmartTriad runtime filters.`
          : "No visual capsules were resolved for this intent yet. Try read/watch/find.";
      const immediateMessages: CopilotMessage[] = [
        {
          id: `intent-msg-${Date.now()}`,
          role: "assistant",
          content: mappedIntentSummary,
          timestamp: new Date(),
        },
        {
          id: "capsule-panel",
          role: "assistant",
          content: capsulePanel,
          timestamp: new Date(),
          variant: "panel",
        },
      ];
      if (intent === "play" && leadCapsule && leadCapsule.runtimeSource === "experience") {
        immediateMessages.push({
          id: `runtime-launch-auto-${Date.now()}`,
          role: "assistant",
          content: buildRuntimeCapsulePanel(leadCapsule, intent),
          timestamp: new Date(),
          variant: "panel",
        });
      }
      setMessages(immediateMessages);
      if (wasWelcomePrompt) {
        postRuntimeEvent("STATE_SYNC", {
          state: "post_welcome",
          intent,
          device: activeDevice,
          thin_shell: thinShellMode,
          welcome_prompt_executed: true,
          welcome_inference_completed: true,
          prompt_source: source,
        });
        postRuntimeEvent("WELCOME_COMPLETE", {
          state: "post_welcome",
          intent,
          device: activeDevice,
          prompt_source: source,
          welcome_prompt_executed: true,
          welcome_inference_completed: true,
        });
      }

      const shouldRequestInference =
        !skipInference &&
        (source === "text_input" || (thinShellMode && source !== "menu_action" && source !== "quick_link"));

      if (!shouldRequestInference) {
        persistPersonaMemory({
          prompt: trimmed,
          inference: mappedIntentSummary,
          intent,
          source,
          welcomePrompt: wasWelcomePrompt,
          capsuleId: leadCapsule?.id ?? null,
          device: activeDevice,
        });
        return;
      }

      const persona = selectedAgent.id === "aigent-moneypenny" ? "moneypenny" : "kn0w1";
      setRuntimeProcessing(true);
      postRuntimeEvent("INFERENCE_START", {
        state: "welcome",
        intent,
        device: activeDevice,
        thin_shell: thinShellMode,
        prompt_source: source,
        welcome_prompt_executed: wasWelcomePrompt,
      });
      postRuntimeEvent("PROCESSING_START", {
        intent,
        device: activeDevice,
        thin_shell: thinShellMode,
        prompt_source: source,
        welcome_prompt_executed: wasWelcomePrompt,
      });
      try {
        const response = await fetch("/api/codex/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            persona,
            personaId: shellContextRef.current.persona_id || null,
            contextId: "metame-runtime-shell",
            aigentId: selectedAgent.id,
            llm_id: activeModel?.modelId ?? null,
            provider_id: activeModel?.providerId ?? null,
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          persistPersonaMemory({
            prompt: trimmed,
            inference: mappedIntentSummary,
            intent,
            source,
            welcomePrompt: wasWelcomePrompt,
            capsuleId: leadCapsule?.id ?? null,
            device: activeDevice,
          });
          postRuntimeEvent("INFERENCE_COMPLETE", {
            status: "error",
            intent,
            device: activeDevice,
            thin_shell: thinShellMode,
            prompt_source: source,
            welcome_prompt_executed: wasWelcomePrompt,
            welcome_inference_completed: wasWelcomePrompt,
          });
          postRuntimeEvent("RENDER_COMPLETE", {
            status: "error",
            state: "post_welcome",
            intent,
            device: activeDevice,
            thin_shell: thinShellMode,
            prompt_source: source,
            has_response: false,
            welcome_prompt_executed: wasWelcomePrompt,
            welcome_inference_completed: wasWelcomePrompt,
          });
          return;
        }
        const llmResponse = typeof data?.response === "string" ? data.response.trim() : "";
        const requestedProvider = typeof data?.provider_requested === "string" ? data.provider_requested : null;
        const usedProvider = typeof data?.provider_used === "string" ? data.provider_used : null;
        const usedModel = typeof data?.model_used === "string" ? data.model_used : null;
        const providerFallback = data?.provider_fallback === true;
        const fallbackMode = data?.fallback === true;
        const providerErrors = Array.isArray(data?.provider_errors) ? data.provider_errors : [];
        const providerSkipped = Array.isArray(data?.provider_skipped) ? data.provider_skipped : [];
        const providerAvailability =
          data?.provider_availability && typeof data.provider_availability === "object"
            ? data.provider_availability
            : null;
        if (!llmResponse) {
          persistPersonaMemory({
            prompt: trimmed,
            inference: mappedIntentSummary,
            intent,
            source,
            welcomePrompt: wasWelcomePrompt,
            capsuleId: leadCapsule?.id ?? null,
            device: activeDevice,
          });
          postRuntimeEvent("INFERENCE_COMPLETE", {
            status: "empty",
            intent,
            device: activeDevice,
            thin_shell: thinShellMode,
            prompt_source: source,
            welcome_prompt_executed: wasWelcomePrompt,
            welcome_inference_completed: wasWelcomePrompt,
          });
          postRuntimeEvent("RENDER_COMPLETE", {
            status: "empty",
            state: "post_welcome",
            intent,
            device: activeDevice,
            thin_shell: thinShellMode,
            prompt_source: source,
            has_response: false,
            welcome_prompt_executed: wasWelcomePrompt,
            welcome_inference_completed: wasWelcomePrompt,
          });
          return;
        }
        const diagnosticLines: string[] = [];
        if (fallbackMode) {
          diagnosticLines.push("Provider diagnostic: all configured providers failed, so a local fallback response was used.");
        } else if (requestedProvider && usedProvider) {
          diagnosticLines.push(
            providerFallback
              ? `Provider diagnostic: requested ${requestedProvider}, answered with ${usedProvider}${usedModel ? ` (${usedModel})` : ""}.`
              : `Provider diagnostic: answered with ${usedProvider}${usedModel ? ` (${usedModel})` : ""}.`
          );
        }
        if (providerAvailability) {
          const availabilitySummary = [
            `openai=${providerAvailability.openai ? "on" : "off"}`,
            `venice=${providerAvailability.venice ? "on" : "off"}`,
            `anthropic=${providerAvailability.anthropic ? "on" : "off"}`,
            `chaingpt=${providerAvailability.chaingpt ? "on" : "off"}`,
          ].join(", ");
          diagnosticLines.push(`Provider availability: ${availabilitySummary}`);
        }
        if (providerSkipped.length > 0) {
          const skippedSummary = providerSkipped
            .slice(0, 4)
            .map((entry: any) => {
              const providerId = typeof entry?.providerId === "string" ? entry.providerId : "unknown";
              const reason = typeof entry?.reason === "string" ? entry.reason : "skipped";
              return `- ${providerId}: ${reason}`;
            })
            .join("\n");
          diagnosticLines.push(`Skipped providers:\n${skippedSummary}`);
        }
        if (providerErrors.length > 0) {
          const summarized = providerErrors
            .slice(0, 3)
            .map((entry: any) => {
              const providerId = typeof entry?.providerId === "string" ? entry.providerId : "unknown";
              const modelId = typeof entry?.modelId === "string" ? entry.modelId : "unknown";
              const error = typeof entry?.error === "string" ? entry.error : "request failed";
              return `- ${providerId} (${modelId}): ${error}`;
            })
            .join("\n");
          diagnosticLines.push(`Provider errors:\n${summarized}`);
        }
        const renderedResponse =
          diagnosticLines.length > 0
            ? `> ${diagnosticLines.join("\n> ")}\n\n${llmResponse}`
            : llmResponse;
        setMessages((prev) => [
          ...prev,
          {
            id: `llm-msg-${Date.now()}`,
            role: "assistant",
            content: renderedResponse,
            timestamp: new Date(),
          },
        ]);
        persistPersonaMemory({
          prompt: trimmed,
          inference: renderedResponse,
          intent,
          source,
          welcomePrompt: wasWelcomePrompt,
          capsuleId: leadCapsule?.id ?? null,
          device: activeDevice,
        });
        postRuntimeEvent("INFERENCE_COMPLETE", {
          status: "ok",
          intent,
          device: activeDevice,
          thin_shell: thinShellMode,
          prompt_source: source,
          welcome_prompt_executed: wasWelcomePrompt,
          welcome_inference_completed: wasWelcomePrompt,
        });
        postRuntimeEvent("RENDER_COMPLETE", {
          status: "ok",
          state: "post_welcome",
          intent,
          device: activeDevice,
          thin_shell: thinShellMode,
          prompt_source: source,
          has_response: true,
          welcome_prompt_executed: wasWelcomePrompt,
          welcome_inference_completed: wasWelcomePrompt,
        });
      } catch {
        // Keep runtime functional even if inference endpoint fails.
        persistPersonaMemory({
          prompt: trimmed,
          inference: mappedIntentSummary,
          intent,
          source,
          welcomePrompt: wasWelcomePrompt,
          capsuleId: leadCapsule?.id ?? null,
          device: activeDevice,
        });
        postRuntimeEvent("INFERENCE_COMPLETE", {
          status: "error",
          intent,
          device: activeDevice,
          thin_shell: thinShellMode,
          prompt_source: source,
          welcome_prompt_executed: wasWelcomePrompt,
          welcome_inference_completed: wasWelcomePrompt,
        });
        postRuntimeEvent("RENDER_COMPLETE", {
          status: "error",
          state: "post_welcome",
          intent,
          device: activeDevice,
          thin_shell: thinShellMode,
          prompt_source: source,
          has_response: false,
          welcome_prompt_executed: wasWelcomePrompt,
          welcome_inference_completed: wasWelcomePrompt,
        });
      } finally {
        setRuntimeProcessing(false);
      }
    },
    [
      activeDevice,
      allContents,
      buildRuntimeCapsulePanel,
      capsulePanel,
      fetchRuntimeCapsules,
      isRuntimeFullscreen,
      thinShellMode,
      refreshRuntime,
      resetRuntime,
      selectedAgent.id,
      selectedCapsuleLocal,
      postRuntimeEvent,
      persistPersonaMemory,
      toast,
    ]
  );

  const providerBaseScore = useMemo(() => {
    if (trustProvider === "anthropic") return 8.3;
    if (trustProvider === "venice") return 7.8;
    if (trustProvider === "chaingpt") return 8.0;
    if (trustProvider === "thirdweb") return 7.6;
    return 5.0;
  }, [trustProvider]);

  const reliabilityScore = Math.max(1, Math.min(10, providerBaseScore + 0.8));
  const trustScore = Math.max(1, Math.min(10, providerBaseScore));

  useEffect(() => {
    if (!embedMode) return;

    function syncDeviceFromPayload(payload: Record<string, unknown>) {
      const directDevice =
        coerceDeviceType(payload.device) ||
        coerceDeviceType(payload.device_type) ||
        coerceDeviceType(payload.viewport_device);
      if (directDevice) {
        setActiveDevice(directDevice);
        return;
      }

      const widthCandidate = payload.viewport_width ?? payload.width;
      if (typeof widthCandidate === "number" && Number.isFinite(widthCandidate)) {
        if (widthCandidate < 768) setActiveDevice("mobile");
        else if (widthCandidate < 1024) setActiveDevice("tablet");
        else setActiveDevice("desktop");
      }
    }

    function onShellMessage(event: MessageEvent) {
      if (event.source !== window.parent) return;
      if (!isShellOutboundMessage(event.data)) return;

      const message = event.data as ShellInboundMessage;
      if (!shellOriginRef.current) {
        shellOriginRef.current = event.origin;
      }
      if (shellOriginRef.current !== event.origin) return;
      flushQueuedRuntimeEvents();

      shellContextRef.current = {
        tenant_id: message.tenant_id,
        persona_id: message.persona_id,
      };
      setActivePersonaId(typeof message.persona_id === "string" ? message.persona_id : null);

      const payload = message.payload || {};
      if (message.type === "SHELL_READY") {
        if (!runtimeReadyPostedRef.current) {
          runtimeReadyPostedRef.current = true;
          postRuntimeEvent("RUNTIME_READY", {
            state: showWelcome ? "welcome" : "post_welcome",
            device: activeDevice,
            thin_shell: thinShellMode,
          });
        }
        return;
      }

      if (message.type === "HANDOFF") {
        const handoffContext =
          payload.context && typeof payload.context === "object" && !Array.isArray(payload.context)
            ? (payload.context as Record<string, unknown>)
            : payload;
        const handoffState = typeof handoffContext.state === "string" ? handoffContext.state : null;
        if (handoffState === "post_welcome") setShowWelcome(false);
        if (handoffState === "welcome") setShowWelcome(true);

        const handoffIntent = typeof handoffContext.intent === "string" ? handoffContext.intent : null;
        if (handoffIntent && (Object.keys(INTENT_KEYWORDS) as RuntimeIntent[]).includes(handoffIntent as RuntimeIntent)) {
          setLastIntent(handoffIntent as RuntimeIntent);
        }

        const thinModeHint =
          handoffContext.shell_mode === "thin" ||
          handoffContext.chrome_mode === "content-only" ||
          handoffContext.thin_shell === true;
        if (thinModeHint) setThinShellMode(true);

        syncDeviceFromPayload(handoffContext);

        if (!runtimeReadyPostedRef.current) {
          runtimeReadyPostedRef.current = true;
          postRuntimeEvent("RUNTIME_READY", {
            state: handoffState ?? (showWelcome ? "welcome" : "post_welcome"),
            device: activeDevice,
            thin_shell: thinShellMode || thinModeHint,
          });
        }
        return;
      }

      if (message.type === "DEVICE_CONTEXT_UPDATE" || message.type === "CONTEXT_UPDATE") {
        syncDeviceFromPayload(payload);
        return;
      }

      if (message.type === "SELECTOR_CHANGE") {
        const aigentId = typeof payload.aigent_id === "string" ? payload.aigent_id : null;
        const llmId = typeof payload.llm_id === "string" ? payload.llm_id : null;
        applyShellSelectorChange(aigentId, llmId);
        return;
      }

      if (message.type === "MENU_ACTION") {
        if (
          payload.action_id === "close_codex" ||
          payload.item_id === "close_codex" ||
          payload.action === "close_codex" ||
          payload.intent === "close_codex"
        ) {
          console.warn("[codex-close] MENU_ACTION close_codex received from shell");
          setMessages((prev) => {
            const next = prev.filter(
              (m) => !(m?.variant === "panel" && m?.id !== "capsule-panel")
            );
            console.warn("[codex-close] MENU_ACTION dismiss", { before: prev.length, after: next.length });
            return next;
          });
          setSelectedCapsuleLocal(null);
          relayCloseCodexToNestedFrames();
          try { postRuntimeEvent("STATE_SYNC", { close_codex_ack: true, handler: "onShellMessage" }); } catch (_) {}
          return;
        }
        const explicitPrompt = typeof payload.prompt === "string" ? payload.prompt : null;
        const actionId =
          typeof payload.action_id === "string"
            ? payload.action_id
            : typeof payload.item_id === "string"
              ? payload.item_id
              : null;
        const explicitIntent = coerceRuntimeIntent(payload.intent);
        const actionPrompt = actionId ? menuPromptFromActionId(actionId) : null;
        const resolvedPrompt = explicitPrompt || actionPrompt;
        if (resolvedPrompt) {
          void handlePrompt(resolvedPrompt, {
            source: "menu_action",
            skipInference: true,
            explicitIntent,
          });
        }
        return;
      }

      if (message.type === "PROMPT_SUBMIT") {
        const promptText =
          typeof payload.text === "string"
            ? payload.text
            : typeof payload.prompt === "string"
              ? payload.prompt
              : null;
        if (promptText) {
          const explicitIntent = coerceRuntimeIntent(payload.intent);
          const skipInference =
            payload.skip_inference === true ||
            payload.skipInference === true ||
            isQuickActionPrompt(promptText);
          void handlePrompt(promptText, {
            source: skipInference ? "quick_link" : "text_input",
            skipInference,
            explicitIntent,
          });
        }
        return;
      }

      if (message.type === "RESET_WELCOME") {
        void resetRuntime();
      }
    }

    window.addEventListener("message", onShellMessage);
    return () => window.removeEventListener("message", onShellMessage);
  }, [
    activeDevice,
    applyShellSelectorChange,
    embedMode,
    handlePrompt,
    postRuntimeEvent,
    resetRuntime,
    showWelcome,
    thinShellMode,
    relayCloseCodexToNestedFrames,
    flushQueuedRuntimeEvents,
  ]);

  useEffect(() => {
    if (!embedMode) return;
    postRuntimeEvent("STATE_SYNC", {
      state: showWelcome ? "welcome" : "post_welcome",
      intent: lastIntent,
      device: activeDevice,
      thin_shell: thinShellMode,
      fullscreen: isRuntimeFullscreen,
      busy: runtimeProcessing,
      processing: runtimeProcessing,
      inferring: runtimeProcessing,
    });

    if (previousWelcomeRef.current && !showWelcome) {
      postRuntimeEvent("WELCOME_COMPLETE", {
        state: "post_welcome",
        intent: lastIntent,
        device: activeDevice,
      });
    }

    previousWelcomeRef.current = showWelcome;
  }, [activeDevice, embedMode, isRuntimeFullscreen, lastIntent, postRuntimeEvent, runtimeProcessing, showWelcome, thinShellMode]);

  useEffect(() => {
    if (!embedMode) return;
    postRuntimeEvent("TRUST_UPDATE", {
      trust_score: Number(trustScore.toFixed(2)),
      reliability_score: Number(reliabilityScore.toFixed(2)),
      aigent_id: selectedAgent.id,
      llm_id: activeModel?.modelId ?? null,
      provider_id: activeModel?.providerId ?? null,
    });
  }, [activeModel?.modelId, activeModel?.providerId, embedMode, postRuntimeEvent, reliabilityScore, selectedAgent.id, trustScore]);

  const quickPrompts = useMemo(
    () => [
      {
        label: "I'd like to watch experiences.",
        prompt: "I'd like to watch experiences.",
        icon: <Tv className="h-4 w-4" />,
        iconOnly: true,
      },
      {
        label: "I'd like to listen to experiences.",
        prompt: "I'd like to listen to experiences.",
        icon: <Headphones className="h-4 w-4" />,
        iconOnly: true,
      },
      {
        label: "I'd like to read experiences.",
        prompt: "I'd like to read experiences.",
        icon: <BookOpen className="h-4 w-4" />,
        iconOnly: true,
      },
      {
        label: "Help me find experiences.",
        prompt: "Help me find experiences.",
        icon: <Compass className="h-4 w-4" />,
        iconOnly: true,
      },
      {
        label: "Refresh runtime",
        prompt: "__runtime_refresh__",
        icon: <RefreshCw className="h-4 w-4" />,
        iconOnly: true,
        skipInference: true,
      },
      {
        label: "Reset runtime",
        prompt: "__runtime_reset__",
        icon: <RotateCcw className="h-4 w-4" />,
        iconOnly: true,
        skipInference: true,
      },
      {
        label: isRuntimeFullscreen ? "Exit native preview" : "Open native preview",
        prompt: "__runtime_toggle_fullscreen__",
        icon: isRuntimeFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />,
        iconOnly: true,
        skipInference: true,
      },
    ],
    [isRuntimeFullscreen]
  );

  const renderIndicatorDots = (value: number, type: "trust" | "reliability") => {
    const dotCount = Math.ceil(value / 2);
    return (
      <div className="flex items-center gap-1">
        {Array.from({ length: 5 }, (_, index) => {
          const active = index < dotCount;
          const activeClass =
            type === "reliability"
              ? value <= 3
                ? "bg-red-500"
                : value <= 6
                  ? "bg-yellow-500"
                  : "bg-purple-500"
              : value <= 3
                ? "bg-red-500"
                : value <= 6
                  ? "bg-yellow-500"
                  : "bg-green-500";
          return <span key={`${type}-${index}`} className={`h-1.5 w-1.5 rounded-full ${active ? activeClass : "bg-slate-600"}`} />;
        })}
      </div>
    );
  };

  const menuButtonClass = (intent: RuntimeIntent) =>
    `flex flex-col items-center rounded-md px-2 py-1 text-[11px] transition ${
      lastIntent === intent
        ? "bg-white/12 text-white ring-1 ring-cyan-300/35"
        : "text-slate-300 hover:bg-white/10 hover:text-white"
    }`;

  const handleRuntimeMenuIntent = (intent: RuntimeIntent, prompt: string) => {
    setLastIntent(intent);
    void handlePrompt(prompt, { source: "menu_action", skipInference: true, explicitIntent: intent });
  };

  const runtimeMenu = (
    <div className="relative z-30 pointer-events-auto border-t border-white/10 bg-white/[0.03] pt-3">
      {isMobileLayout ? (
        <div className="flex items-center justify-between px-4">
          <button
            type="button"
            onClick={() => handleRuntimeMenuIntent("be", "I want to be...")}
            className={menuButtonClass("be")}
            title="I want to be..."
            aria-pressed={lastIntent === "be"}
          >
            <Users className="h-4 w-4 text-slate-200" />
            Be
          </button>
          <button
            type="button"
            onClick={() => handleRuntimeMenuIntent("earn", "How can I earn...")}
            className={menuButtonClass("earn")}
            title="How can I earn..."
            aria-pressed={lastIntent === "earn"}
          >
            <Coins className="h-5 w-5 text-emerald-300" />
            Earn
          </button>
          <button
            type="button"
            onClick={() => handleRuntimeMenuIntent("play", "I'd like to play experiences.")}
            className={menuButtonClass("play")}
            title="I'd like to play experiences."
            aria-pressed={lastIntent === "play"}
          >
            <PlayCircle className="h-5 w-5 text-cyan-300" />
            Play
          </button>
          <button
            type="button"
            onClick={() => handleRuntimeMenuIntent("make", "I want to make...")}
            className={menuButtonClass("make")}
            title="I want to make..."
            aria-pressed={lastIntent === "make"}
          >
            <Pencil className="h-5 w-5 text-purple-300" />
            Make
          </button>
          <button
            type="button"
            onClick={() => handleRuntimeMenuIntent("find", "Help me find experiences to share.")}
            className={menuButtonClass("find")}
            title="Help me find experiences to share."
            aria-pressed={lastIntent === "find"}
          >
            <Users className="h-4 w-4 text-slate-200" />
            Share
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between px-4">
          <button
            type="button"
            onClick={() => handleRuntimeMenuIntent("be", "I want to be...")}
            className={menuButtonClass("be")}
            title="I want to be..."
            aria-pressed={lastIntent === "be"}
          >
            <Users className="h-4 w-4 text-slate-200" />
            Be
          </button>
          <div className="flex flex-1 items-center justify-center gap-6">
            <button
              type="button"
              onClick={() => handleRuntimeMenuIntent("earn", "How can I earn...")}
              className={menuButtonClass("earn")}
              title="How can I earn..."
              aria-pressed={lastIntent === "earn"}
            >
              <Coins className="h-5 w-5 text-emerald-300" />
              Earn
            </button>
            <button
              type="button"
              onClick={() => handleRuntimeMenuIntent("play", "I'd like to play experiences.")}
              className={menuButtonClass("play")}
              title="I'd like to play experiences."
              aria-pressed={lastIntent === "play"}
            >
              <PlayCircle className="h-5 w-5 text-cyan-300" />
              Play
            </button>
            <button
              type="button"
              onClick={() => handleRuntimeMenuIntent("make", "I want to make...")}
              className={menuButtonClass("make")}
              title="I want to make..."
              aria-pressed={lastIntent === "make"}
            >
              <Pencil className="h-5 w-5 text-purple-300" />
              Make
            </button>
          </div>
          <button
            type="button"
            onClick={() => handleRuntimeMenuIntent("find", "Help me find experiences to share.")}
            className={menuButtonClass("find")}
            title="Help me find experiences to share."
            aria-pressed={lastIntent === "find"}
          >
            <Users className="h-4 w-4 text-slate-200" />
            Share
          </button>
        </div>
      )}
    </div>
  );

  const modelOptionsPanel = (
    <div className="space-y-2">
      {activeAgentProviders.length === 0 ? (
        <p className="px-2 py-1 text-[11px] text-slate-400">No active LLM iQubes for this Aigent.</p>
      ) : (
        activeAgentProviders.map((provider) => (
          <div key={provider.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-1.5">
            <div className="mb-1 flex items-center gap-1.5 px-1 text-[11px] text-slate-300">
              {providerIcon(provider.id)}
              <span>{provider.label}</span>
            </div>
            <div className="space-y-1">
              {provider.models.map((model) => {
                const selected = activeModel?.providerId === provider.id && activeModel?.modelId === model.id;
                return (
                  <button
                    key={`${provider.id}-${model.id}`}
                    onClick={() => applyModelSelection(provider, model)}
                    className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[11px] transition ${
                      selected ? "bg-cyan-500/20 text-cyan-100" : "text-slate-200 hover:bg-white/10"
                    }`}
                  >
                    <span className="truncate">{model.label}</span>
                    {selected ? <span className="text-[10px] uppercase tracking-wide text-cyan-200">Active</span> : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );

  const agentSelector = (
    <div className="absolute left-3 top-[8px] z-30 flex items-center gap-2">
      <div
        className="relative"
        onMouseEnter={() => clearSelectorHideTimeout("agent")}
        onMouseLeave={() => scheduleSelectorHideTimeout("agent")}
      >
        <button
          onClick={() => {
            clearSelectorHideTimeout("agent");
            setShowAgentSelector((prev) => !prev);
            setShowModelSelector(false);
          }}
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-slate-950/80 px-2 py-1.5 text-[11px] text-slate-200"
          title="Select Aigent"
        >
          <Bot className={`h-4 w-4 ${selectedAgent.colorClass}`} />
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
        </button>
        {showAgentSelector && (
          <div className="absolute left-0 top-full mt-1 w-[280px] rounded-xl border border-white/10 bg-slate-950/95 p-1.5 backdrop-blur-xl">
            <div className="space-y-1">
              {RUNTIME_AGENTS.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => {
                    setSelectedAgent(agent);
                    setShowAgentSelector(false);
                  }}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs ${
                    selectedAgent.id === agent.id ? "bg-white/10 text-white" : "text-slate-200 hover:bg-white/10"
                  }`}
                >
                  <Bot className={`h-4 w-4 ${agent.colorClass}`} />
                  <span>{agent.label}</span>
                </button>
              ))}
            </div>
            <div className="my-2 h-px bg-white/10" />
            <div className="px-1 pb-1">
              <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">Active ModelQubes (LLM only)</p>
              {modelOptionsPanel}
            </div>
          </div>
        )}
      </div>

      <div
        className="relative"
        onMouseEnter={() => clearSelectorHideTimeout("model")}
        onMouseLeave={() => scheduleSelectorHideTimeout("model")}
      >
        <button
          onClick={() => {
            clearSelectorHideTimeout("model");
            setShowModelSelector((prev) => !prev);
            setShowAgentSelector(false);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-950/80 px-2 py-1.5 text-[11px] text-slate-200"
          title={activeModel ? `${activeModel.providerLabel} ${activeModel.modelLabel}` : "Select model"}
        >
          {activeModel ? providerIcon(activeModel.providerId) : <span className="inline-block h-3.5 w-3.5 rounded-[2px] bg-white/20" />}
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
        </button>
        {showModelSelector && (
          <div className="absolute left-0 top-full mt-1 w-[280px] rounded-xl border border-white/10 bg-slate-950/95 p-2 backdrop-blur-xl">
            <p className="mb-2 px-1 text-[10px] uppercase tracking-wide text-slate-400">{selectedAgent.label} models</p>
            {modelOptionsPanel}
          </div>
        )}
      </div>
    </div>
  );

  const runtimeSurface = (
    <div className="metame-runtime-layer relative h-full w-full rounded-[5px] bg-slate-950 text-white overflow-hidden flex flex-col">
      <style jsx global>{`
        .copilotkit-launcher,
        .copilotkit-button,
        .copilotkit-floating-button {
          display: none !important;
        }
      `}</style>
      {!thinShellMode ? agentSelector : null}
      <CodexCopilotLayer
        isOpen
        onClose={() => {}}
        variant="embedded"
        enableInferenceRendering
        panelClassName="w-full h-full"
        showNavMenu={false}
        showWalletMenu={false}
        panelBorder={false}
        promptPlaceholder="What do you want to do today?"
        messages={messages}
        onMessagesChange={setMessages}
        quickPrompts={thinShellMode ? [] : quickPrompts}
        onPrompt={handlePrompt}
        footerContent={thinShellMode ? null : runtimeMenu}
        floatingInput={!thinShellMode}
        disablePromptInput={thinShellMode}
        showTrustIndicators={!thinShellMode}
        disableActivationButton
        showQuickPromptsToggle={!thinShellMode}
        trustProvider={trustProvider}
        className="h-full"
      />
    </div>
  );

  const personaMemoryQuickLinks = useMemo(() => personaMemoryEntries.slice(0, 4), [personaMemoryEntries]);

  const welcomeQuickLinks = (
    <div
      className={`pointer-events-none absolute left-3 right-3 bottom-[70px] z-20 transition-opacity duration-200 ${
        showWelcomeQuickLinks ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="pointer-events-auto mx-auto w-full rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-2">
        <div className="overflow-x-auto no-scrollbar md:overflow-visible">
          <div className="flex w-max min-w-full snap-x snap-mandatory items-center gap-2 md:w-full md:min-w-0 md:snap-none">
            {quickPrompts.map((promptItem, index) => (
              <button
                key={`welcome-quick-${index}`}
                title={promptItem.label}
                className="snap-start shrink-0 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-white/70 transition hover:border-white/30 hover:text-white md:min-w-0 md:flex-1"
                onClick={() =>
                  void handlePrompt(promptItem.prompt ?? promptItem.label, {
                    source: "quick_link",
                    skipInference: true,
                    explicitIntent: coerceRuntimeIntent(promptItem.prompt),
                  })
                }
              >
                {promptItem.icon}
              </button>
            ))}
          </div>
        </div>
        {personaMemoryQuickLinks.length > 0 ? (
          <div className="mt-2 border-t border-white/10 pt-2">
            <p className="mb-1 text-[10px] uppercase tracking-wide text-white/45">Recent by persona</p>
            <div className="flex flex-wrap gap-1.5">
              {personaMemoryQuickLinks.map((entry) => (
                <button
                  key={entry.id}
                  title={entry.prompt}
                  className="max-w-full rounded-full border border-cyan-300/20 bg-cyan-500/10 px-3 py-1 text-[11px] text-cyan-100 hover:bg-cyan-500/20"
                  onClick={() =>
                    void handlePrompt(entry.prompt, {
                      source: "quick_link",
                      explicitIntent: coerceRuntimeIntent(entry.intent),
                    })
                  }
                >
                  <span className="line-clamp-1">{entry.prompt}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );

  const clearQuickLinksHideTimeout = useCallback(() => {
    if (quickLinksHideTimeoutRef.current) {
      clearTimeout(quickLinksHideTimeoutRef.current);
      quickLinksHideTimeoutRef.current = null;
    }
  }, []);

  const showQuickLinks = useCallback(() => {
    clearQuickLinksHideTimeout();
    setShowWelcomeQuickLinks(true);
  }, [clearQuickLinksHideTimeout]);

  const scheduleQuickLinksHide = useCallback(() => {
    clearQuickLinksHideTimeout();
    quickLinksHideTimeoutRef.current = setTimeout(() => {
      setShowWelcomeQuickLinks(false);
      quickLinksHideTimeoutRef.current = null;
    }, 3000);
  }, [clearQuickLinksHideTimeout]);

  useEffect(() => {
    return () => {
      clearQuickLinksHideTimeout();
    };
  }, [clearQuickLinksHideTimeout]);

  useEffect(() => {
    if (!isRuntimeFullscreen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsRuntimeFullscreen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isRuntimeFullscreen]);

  const welcomeSurface = (
    <div className="relative h-full w-full rounded-[5px] bg-slate-950 text-white overflow-hidden flex flex-col">
      {!thinShellMode ? agentSelector : null}
      {!thinShellMode ? (
        <div className="h-[44px] flex items-center justify-end gap-4 border-b border-white/10 bg-white/[0.03] px-4 pr-6">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-white/70">
            <span className="text-[10px] text-white/60">R</span>
            {renderIndicatorDots(reliabilityScore, "reliability")}
          </div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-white/70">
            <span className="text-[10px] text-white/60">T</span>
            {renderIndicatorDots(trustScore, "trust")}
          </div>
        </div>
      ) : null}

      <div className="flex-1 flex items-center justify-center px-6">
        <form
          className="w-full max-w-[760px]"
          onSubmit={(event) => {
            event.preventDefault();
            void handlePrompt(welcomePrompt, { source: "text_input" });
          }}
        >
          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] px-3 py-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={welcomePrompt}
                onChange={(event) => setWelcomePrompt(event.target.value)}
                placeholder="What do you want to do today?"
                className="w-full bg-transparent px-2 py-2 text-lg font-light text-slate-100 placeholder:text-slate-500 focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-xl border border-white/10 bg-white/10 p-2 text-slate-200 hover:bg-white/15"
                aria-label="Submit intent"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </form>
      </div>

      {!thinShellMode ? (
        <div
          className="relative px-3 pb-3"
          onMouseEnter={showQuickLinks}
          onMouseLeave={scheduleQuickLinksHide}
        >
          {welcomeQuickLinks}
          {runtimeMenu}
        </div>
      ) : null}
    </div>
  );

  const runtimeDeviceWidthClass =
    activeDevice === "desktop"
      ? "w-full"
      : activeDevice === "tablet"
        ? "mx-auto w-full max-w-[860px]"
        : "mx-auto w-full max-w-[430px]";

  if (embedMode) {
    const embedWidthClass = isRuntimeFullscreen || thinShellMode ? "w-full" : runtimeDeviceWidthClass;
    return (
      <div className="h-full w-full bg-slate-950 p-0">
        <div className={`h-full ${embedWidthClass}`}>{showWelcome ? welcomeSurface : runtimeSurface}</div>
      </div>
    );
  }

  if (isRuntimeFullscreen) {
    return (
      <div className="fixed inset-0 z-[120] bg-slate-950 p-0">
        <div className={`h-full ${runtimeDeviceWidthClass}`}>{showWelcome ? welcomeSurface : runtimeSurface}</div>
      </div>
    );
  }

  const runtimeToolbar = (device: DeviceType, onChange: (device: DeviceType) => void) => (
    <div className="flex items-center justify-between px-2 py-2">
      <div className="flex items-center gap-3">
        <Hexagon className="h-6 w-6 text-rose-400" />
        <span className="text-xl font-bold text-white">metaMe Runtime</span>
      </div>
      <DevicePreviewSwitcher value={device} onChange={onChange} />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white px-4 py-6">
      <div className="mx-auto w-full h-[760px]">
        <PreviewFrame
          defaultDevice={defaultDevice}
          onDeviceChange={(device) => setActiveDevice(device)}
          showToolbar
          toolbarPosition="top"
          deviceQueryParam="device"
          chromeless
          renderToolbar={runtimeToolbar}
        >
          {showWelcome ? welcomeSurface : runtimeSurface}
        </PreviewFrame>
      </div>
    </div>
  );
}
