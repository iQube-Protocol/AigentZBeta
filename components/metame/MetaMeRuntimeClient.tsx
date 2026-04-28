"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTTSPlayer } from "@/app/hooks/useTTSPlayer";
import { useSearchParams } from "next/navigation";
import {
  createRuntimeMessage,
  isShellOutboundMessage,
  type RuntimeInboundType,
  type ShellInboundMessage,
} from "@metame/iframe-bridge";
import { CodexCopilotLayer, type CopilotMessage } from "@/app/components/codex/CodexCopilotLayer";
import SmartWalletDrawer from "@/app/components/content/SmartWalletDrawer";
import { PersonaIQubeDrawer } from "@/components/iqube/PersonaIQubeDrawer";
import { IdentityIQubeDrawer } from "@/components/iqube/IdentityIQubeDrawer";
import { MemoryIQubeDrawer } from "@/components/iqube/MemoryIQubeDrawer";
import { ConnectionsIQubeDrawer } from "@/components/iqube/ConnectionsIQubeDrawer";
import { PreviewFrame } from "@/components/preview/PreviewFrame";
import { DevicePreviewSwitcher, type DeviceType } from "@/components/preview/DevicePreviewSwitcher";
import { useToast } from "@/components/ui/toaster";
import {
  detectExperienceProviderFromAssetUri,
  ExperienceBlockHeader,
  ExperienceStyleIcon,
} from "@/components/composer/ExperienceBlockChrome";
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
import { useBrowserCapabilityController } from "@/components/metame/browser/useBrowserCapabilityController";
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
  Fingerprint,
  Headphones,
  Hexagon,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  Minimize2,
  Network,
  Pencil,
  PlayCircle,
  FileText,
  RefreshCw,
  RotateCcw,
  Send,
  Share2,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Wallet,
  Square,
  SquareArrowOutUpRight,
  Sun,
  Moon,
  Tv,
  Users,
  X,
} from "lucide-react";
import { MetaMeSettingsPanel, loadMetaMeSettings, type LeadAgent } from "@/components/metame/MetaMeSettingsPanel";
import { RuntimeTakeoverBanner } from "@/components/metame/RuntimeTakeoverBanner";
import { useRuntimeTakeover } from "@/app/hooks/useRuntimeTakeover";
import { CODEX_DEFINITIONS } from "@/data/codex-configs";
import type { ScreenFraction, SmartContentQube } from "@/types/smartContent";
import type { RuntimeCapsuleRecord } from "@/types/runtimeCapsules";

function getAccessTokenFromStorage(): string | null {
  if (typeof window === "undefined") return null;
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.includes("auth-token")) {
        const raw = window.localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const token =
          (parsed as Record<string, unknown>).access_token ??
          (parsed as Record<string, { access_token?: unknown }>).currentSession?.access_token;
        if (typeof token === "string" && token) return token;
      }
    }
  } catch { /* ignore */ }
  return null;
}

// ─── Pre-bootstrap shell message buffer ──────────────────────────────────────
// Messages from window.parent that arrive before MetaMeRuntimeClient's
// onShellMessage useEffect has registered will be silently dropped.
// This module-level FIFO captures them so they can be replayed once the
// handler is live. Max 32 entries.

let _preBootstrapBuf: MessageEvent[] = [];
let _preBootstrapCapture: ((e: MessageEvent) => void) | null = null;

function _startEarlyCapture() {
  if (typeof window === "undefined" || _preBootstrapCapture) return;
  _preBootstrapCapture = (e: MessageEvent) => {
    if (e.source !== window.parent) return;
    const d = e.data as Record<string, unknown> | null;
    if (!d || typeof d !== "object" || typeof d.type !== "string") return;
    if (_preBootstrapBuf.length < 32) _preBootstrapBuf.push(e);
  };
  window.addEventListener("message", _preBootstrapCapture);
}

function _drainEarlyCapture(handler: (e: MessageEvent) => void) {
  if (_preBootstrapCapture) {
    window.removeEventListener("message", _preBootstrapCapture);
    _preBootstrapCapture = null;
  }
  const drained = _preBootstrapBuf.splice(0);
  for (const e of drained) {
    try { handler(e); } catch { /* replay is best-effort */ }
  }
}

// Start capturing immediately at module evaluation time
_startEarlyCapture();

type RuntimeIntent = "watch" | "listen" | "read" | "play" | "find" | "earn" | "make" | "be" | "share";
type RuntimeContentSource = "experience" | "smart-content" | "codex";

type RuntimeAgent = {
  id: string;
  label: string;
  colorClass: string;
};

type RuntimeAgentModelMap = Record<string, AgentModelSelection | null>;
type RuntimeArticleDraft = {
  title: string;
  deck: string;
  opening: string;
  sections: Array<{ heading: string; body: string }>;
  takeaways: string[];
  glossary: Array<{ term: string; definition: string }>;
  nextAction: string | null;
};

type RuntimeExperienceContext = {
  experienceId?: string;
  bundlePresetId?: string;
  acceptedBlockOutputs?: Record<string, unknown>;
  blockStatuses?: Record<string, unknown>;
  policyScope?: Record<string, unknown>;
  allowedActions?: string[];
  inferenceContext?: Record<string, unknown>;
};

type RuntimeCustomizationBudget = {
  maxRegenerations: number;
  maxSpendUsd: number;
  estimatedCostUsd: number;
  usedRegenerations: number;
};

type RuntimeEditorState = {
  experienceId: string;
  experienceName: string;
  articleTitle: string;
  articlePrompt: string;
  articleOutputs: string[];
  takeawaysCount: number;
  budget: RuntimeCustomizationBudget;
  fetchedExperience: Record<string, unknown>;
};

type RuntimeCapsule = SmartContentQube & {
  runtimeSource: RuntimeContentSource;
  runtimeMenuIntent?: "make" | "play";
  runtimeCodexSlug?: string;
  runtimeCodexInitialTab?: string;
  runtimeLaunchHref?: string;
  runtimeAuthoringHref?: string;
  runtimeLaunchType?: "experience" | "codex" | "content";
  runtimeAssetStatus?: "resolved" | "missing";
  runtimeModalityHints?: string[];
  runtimeDurationMinutes?: number | null;
  runtimePriceLabel?: string | null;
  runtimeStatus?: string | null;
  runtimeContentKind?: "article" | "video" | "character" | "episode" | "generic" | null;
  runtimePreviewMediaUri?: string | null;
  runtimeArticleDraft?: RuntimeArticleDraft | null;
  runtimeExperienceContext?: RuntimeExperienceContext | null;
  configuration?: Record<string, unknown>;
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

const AGENT_PERSONA_KEY: Record<string, string> = {
  "aigent-z": "z",
  "aigent-kn0w1": "kn0w1",
  "aigent-moneypenny": "moneypenny",
  "aigent-nakamoto": "nakamoto",
  "aigent-marketa": "marketa",
};

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
  // Top-level menu items
  if (normalized === "be" || normalized === "compass_be") return "I want to be...";
  if (normalized === "earn" || normalized === "compass_earn") return "How can I earn...";
  if (normalized === "play" || normalized === "compass_play") return "I'd like to play experiences.";
  if (normalized === "make" || normalized === "compass_make") return "I want to make...";
  if (normalized === "share" || normalized === "compass_share") return "Help me share my experiences.";
  // Make sub-actions (sent by quick_links or future shell updates)
  if (normalized === "make-create-design") return "I want to create and design in metaMe Studio.";
  if (normalized === "make-build") return "I want to build with AgentiQ OS.";
  if (normalized === "make-remix") return "I want to remix and customise an existing iQube.";
  // Play sub-actions
  if (normalized === "play-watch") return "I'd like to watch experiences.";
  if (normalized === "play-listen") return "I'd like to listen to audio-first experiences.";
  if (normalized === "play-knyt") return "I'd like to explore my KNYT journey.";
  // Earn sub-actions
  if (normalized === "earn-goal") return "Show me my onboarding journey goals and first tasks.";
  // Share sub-actions
  if (normalized === "share-message") return "Send a direct message via QubeTalk.";
  if (normalized === "share-invite") return "Invite someone to a shared QubeTalk environment.";
  return null;
}

function coerceRuntimeIntent(input: unknown): RuntimeIntent | null {
  if (typeof input !== "string") return null;
  const normalized = input.trim().toLowerCase();
  const intents: RuntimeIntent[] = ["watch", "listen", "read", "play", "find", "earn", "make", "be", "share"];
  return intents.includes(normalized as RuntimeIntent) ? (normalized as RuntimeIntent) : null;
}

function isQuickActionPrompt(prompt: string): boolean {
  const normalized = prompt.trim().toLowerCase();
  const quickActionPrompts = new Set([
    // Top-level menu items
    "i'd like to watch experiences.",
    "i'd like to listen to experiences.",
    "i'd like to read experiences.",
    "help me find experiences.",
    "i want to be...",
    "how can i earn...",
    "i'd like to play experiences.",
    "i want to make...",
    "help me share my experiences.",
    "help me find experiences to share.", // legacy — keep for backwards compat
    // Sub-action prompts (skip inference — intent is explicit)
    "i want to create and design in metame studio.",
    "i want to build with agentiq os.",
    "i want to remix and customise an existing iqube.",
    "i'd like to listen to audio-first experiences.",
    "i'd like to explore my knyt journey.",
    "show me my onboarding journey goals and first tasks.",
    "send a direct message via qubetalk.",
    "invite someone to a shared qubetalk environment.",
    "help me invite someone to collaborate.",
    // Launch aliases
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
  return /(\.mp4|\.mov|\.webm|\.m3u8)(\?.*)?$/i.test(uri) || uri.includes("/api/content/video/") || /\/api\/skills\/video\//i.test(uri);
}

function normalizeImageCandidate(candidate: unknown): string | null {
  if (typeof candidate !== "string") return null;
  const value = candidate.trim();
  if (!value) return null;
  // Reject video URIs — they cannot be used as <img> src or og:image
  if (isLikelyVideoUri(value)) return null;
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

function inferRuntimeExperienceStyle(content: RuntimeCapsule): string {
  if (content.runtimeContentKind === "video") return "cinematic";
  if (content.runtimeContentKind === "article") return "editorial";
  const text = `${content.title} ${content.description}`.toLowerCase();
  if (/\b(video|watch|cinematic|film|sora)\b/.test(text)) return "cinematic";
  return "editorial";
}

function runtimeContentKindIcon(kind: RuntimeCapsule["runtimeContentKind"] | "image") {
  if (kind === "image") return <ImageIcon className="h-3.5 w-3.5" />;
  if (kind === "video") return <Tv className="h-3.5 w-3.5" />;
  if (kind === "article") return <BookOpen className="h-3.5 w-3.5" />;
  return <Hexagon className="h-3.5 w-3.5" />;
}

/** Maps a content action verb to its icon for the thumbnail card action bar.
 *  LEFT = what it IS (badges).  RIGHT = what you CAN DO (these icons). */
function quickActionIcon(kind: "watch" | "read" | "listen" | "share") {
  if (kind === "watch") return <PlayCircle className="h-4 w-4" />;
  if (kind === "read") return <BookOpen className="h-4 w-4" />;
  if (kind === "listen") return <Headphones className="h-4 w-4" />;
  return <Share2 className="h-4 w-4" />;
}

function deriveRuntimeExperienceKinds(content: RuntimeCapsule): Array<"image" | "video" | "article"> {
  const kinds: Array<"image" | "video" | "article"> = [];
  if (resolveRuntimeArticleDraft(content)) {
    kinds.push("article");
  }
  const experienceContext = resolveRuntimeExperienceContext(content);
  const acceptedOutputs = asRecord(experienceContext?.acceptedBlockOutputs) ?? {};
  if (
    isLikelyVideoUri(content.runtimePreviewMediaUri || null) ||
    Boolean(asRecord(acceptedOutputs.video_generation))
  ) {
    kinds.unshift("video");
  } else if (
    content.runtimePreviewMediaUri ||
    resolveCapsuleCoverImage(content) ||
    Boolean(asRecord(acceptedOutputs.image_generation))
  ) {
    kinds.unshift("image");
  } else if (content.runtimeContentKind === "video") {
    kinds.unshift("video");
  } else if (content.runtimeContentKind === "article") {
    kinds.push("article");
  } else if (content.runtimeContentKind) {
    kinds.unshift("image");
  }
  return Array.from(new Set(kinds));
}

function deriveRuntimeExperienceQuickActions(
  content: RuntimeCapsule,
  intent: RuntimeIntent,
): Array<{ kind: "watch" | "read" | "listen" | "share"; label: string }> {
  const experienceContext = resolveRuntimeExperienceContext(content);
  const allowedActions = Array.isArray(experienceContext?.allowedActions)
    ? new Set(
        experienceContext.allowedActions.filter(
          (action): action is "watch" | "read" | "listen" | "share" =>
            action === "watch" || action === "read" || action === "listen" || action === "share",
        ),
      )
    : null;
  const actions: Array<{ kind: "watch" | "read" | "listen" | "share"; label: string }> = [];
  if (
    allowedActions?.has("watch") ||
    isLikelyVideoUri(content.runtimePreviewMediaUri || null) ||
    content.runtimeContentKind === "video"
  ) {
    actions.push({ kind: "watch", label: "Watch" });
  }
  if (allowedActions?.has("read") || resolveRuntimeArticleDraft(content) || content.runtimeContentKind === "article") {
    actions.push({ kind: "read", label: "Read" });
  }
  if (allowedActions?.has("listen") || content.modalities?.listen?.enabled || intent === "listen") {
    actions.push({ kind: "listen", label: "Listen" });
  }
  if (allowedActions?.has("share") ?? true) {
    actions.push({ kind: "share", label: "Share" });
  }
  return actions;
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

function selectCapsulesForDisplay(ranked: RuntimeCapsule[], limit = 12): RuntimeCapsule[] {
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
    configuration: raw?.configuration,
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
    runtimeExperienceContext: record.metadata?.activeExperienceContext ?? null,
  } as unknown as RuntimeCapsule;
}

function buildPreviewExperienceCapsule(input: {
  experienceId: string;
  selectedCapsuleId: string | null;
  title?: string | null;
  description?: string | null;
  contextImageUri?: string | null;
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
  articleDraft?: RuntimeArticleDraft | null;
  experienceContext?: RuntimeExperienceContext | null;
  runtimeAdminMode?: boolean;
}): RuntimeCapsule {
  const capsuleId = input.selectedCapsuleId || input.experienceId;
  const title = (input.title || "").trim() || "Experience Preview";
  const description = (input.description || "").trim() || "Runtime preview launched from Studio ExperienceQube.";
  const contextImageUri = (input.contextImageUri || "").trim();
  const imageUri = (input.imageUri || "").trim();
  const intent = input.intent || "read";
  const quickLink = input.quickLink || intent;
  const launchParams = new URLSearchParams({
    capsule: capsuleId,
    experienceId: input.experienceId,
    experienceName: title,
    experienceDescription: description,
    runtimeIntent: intent,
    runtimeQuickLink: quickLink,
    contentKind: input.contentKind || "episode",
  });
  if (contextImageUri) launchParams.set("experienceContextImage", contextImageUri);
  if (imageUri) launchParams.set("experienceImage", imageUri);
  if (input.imagePortraitUri) launchParams.set("experienceImagePortrait", input.imagePortraitUri);
  if (input.imageLandscapeUri) launchParams.set("experienceImageLandscape", input.imageLandscapeUri);
  if (input.videoUri) launchParams.set("experienceVideo", input.videoUri);
  if (input.activeCodexId) launchParams.set("activeCodexId", input.activeCodexId);
  if (input.activeCodexName) launchParams.set("activeCodexName", input.activeCodexName);
  if (input.activeCodexTab) launchParams.set("runtimeCodexTab", input.activeCodexTab);
  if (input.runtimeCartridge) launchParams.set("runtimeCartridge", input.runtimeCartridge);
  if (input.personaAssignment) launchParams.set("personaAssignment", input.personaAssignment);
  if (input.crmCohortAssignment) launchParams.set("crmCohortAssignment", input.crmCohortAssignment);
  if (input.policyAssignment) launchParams.set("policyAssignment", input.policyAssignment);
  if (input.articleDraft) launchParams.set("experienceArticleDraft", JSON.stringify(input.articleDraft));
  if (input.experienceContext) launchParams.set("experienceContext", JSON.stringify(input.experienceContext));
  if (input.runtimeAdminMode) launchParams.set("runtimeAdmin", "1");
  return {
    id: capsuleId,
    type: "SmartContentQube",
    app: "metaMe",
    title,
    slug: `experience-preview-${input.experienceId}`,
    version: 1,
    description,
    coverImageUri: contextImageUri || input.imageLandscapeUri || imageUri || input.imagePortraitUri || FAILSAFE_QRIPTO_IMAGE,
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
    runtimeLaunchHref: `/metame/runtime?${launchParams.toString()}`,
    runtimeAuthoringHref: `/studio/composer?experienceId=${encodeURIComponent(input.experienceId)}&panel=exqubes`,
    runtimeLaunchType: "experience",
    runtimeAssetStatus: "resolved",
    runtimeModalityHints: ["play", intent, quickLink],
    runtimeContentKind: input.contentKind || "episode",
    runtimePreviewMediaUri: input.videoUri || imageUri || input.imagePortraitUri || input.imageLandscapeUri || null,
    runtimeArticleDraft: input.articleDraft || null,
    runtimeExperienceContext: input.experienceContext || null,
  } as unknown as RuntimeCapsule;
}

function parseRuntimeArticleDraft(value: string | null | undefined): RuntimeArticleDraft | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const record = parsed as Record<string, unknown>;
    const sections = Array.isArray(record.sections)
      ? record.sections.filter(
          (item): item is { heading: string; body: string } =>
            Boolean(
              item &&
                typeof item === "object" &&
                !Array.isArray(item) &&
                typeof (item as { heading?: unknown }).heading === "string" &&
                typeof (item as { body?: unknown }).body === "string",
            ),
        )
      : [];
    return {
      title: typeof record.title === "string" ? record.title : "Editorial draft",
      deck: typeof record.deck === "string" ? record.deck : "",
      opening: typeof record.opening === "string" ? record.opening : "",
      sections,
      takeaways: Array.isArray(record.takeaways)
        ? record.takeaways.filter((item): item is string => typeof item === "string")
        : [],
      glossary: Array.isArray(record.glossary)
        ? record.glossary.filter(
            (item): item is { term: string; definition: string } =>
              Boolean(
                item &&
                  typeof item === "object" &&
                  !Array.isArray(item) &&
                  typeof (item as { term?: unknown }).term === "string" &&
                  typeof (item as { definition?: unknown }).definition === "string",
              ),
          )
        : [],
      nextAction: typeof record.nextAction === "string" ? record.nextAction : null,
    };
  } catch {
    return null;
  }
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function resolveRuntimeExperienceContext(content: RuntimeCapsule): RuntimeExperienceContext | null {
  const record = asRecord(content.runtimeExperienceContext);
  return record ? (record as RuntimeExperienceContext) : null;
}

function resolveRuntimeArticleDraft(content: RuntimeCapsule): RuntimeArticleDraft | null {
  if (content.runtimeArticleDraft) return content.runtimeArticleDraft;
  const context = resolveRuntimeExperienceContext(content);
  const acceptedOutputs = asRecord(context?.acceptedBlockOutputs) ?? {};
  const articleOutput = asRecord(acceptedOutputs.article_draft);
  const generated = asRecord(articleOutput?.generated);
  if (!generated) return null;
  return parseRuntimeArticleDraft(JSON.stringify(generated));
}

function resolveRuntimeExperienceShellState(content: RuntimeCapsule | null) {
  if (!content || content.runtimeSource !== "experience") return null;
  const context = resolveRuntimeExperienceContext(content);
  const quickActions = deriveRuntimeExperienceQuickActions(content, defaultRuntimeIntentForCapsule(content)).map(
    (action) => action.kind,
  );
  return {
    experience_id: content.id,
    experience_title: content.title,
    runtime_source: content.runtimeSource,
    content_kind: content.runtimeContentKind || "generic",
    launch_href: content.runtimeLaunchHref || null,
    modality_hints: content.runtimeModalityHints || [],
    quick_actions: quickActions,
    experience_context: context,
  };
}

function resolveRuntimeExperienceSummary(content: RuntimeCapsule): { headline: string; summary: string } {
  const articleDraft = resolveRuntimeArticleDraft(content);
  const context = resolveRuntimeExperienceContext(content);
  const fallbackDescription = content.description || "Open this experience to explore the full bundle.";
  const headline =
    articleDraft?.title ||
    (typeof context?.inferenceContext?.experienceName === "string" ? context.inferenceContext.experienceName : null) ||
    content.title;
  const summary =
    articleDraft?.deck ||
    articleDraft?.opening ||
    (typeof context?.inferenceContext?.experienceDescription === "string"
      ? context.inferenceContext.experienceDescription
      : null) ||
    fallbackDescription;
  return { headline, summary };
}

function resolveRuntimeExperienceBundleLabel(content: RuntimeCapsule): string | null {
  const kinds = deriveRuntimeExperienceKinds(content);
  if (kinds.includes("video") && kinds.includes("article")) return "Video + Article";
  if (kinds.includes("image") && kinds.includes("article")) return "Image + Article";
  if (kinds.includes("video")) return "Video";
  if (kinds.includes("article")) return "Article";
  if (kinds.includes("image")) return "Image";
  return null;
}

function defaultRuntimeIntentForCapsule(content: RuntimeCapsule): RuntimeIntent {
  const quickActions = deriveRuntimeExperienceQuickActions(content, content.runtimeContentKind === "video" ? "watch" : "read");
  if (quickActions.some((action) => action.kind === "watch")) return "watch";
  if (quickActions.some((action) => action.kind === "read")) return "read";
  if (quickActions.some((action) => action.kind === "listen")) return "listen";
  return "play";
}

function resolveRuntimeExperienceId(content: RuntimeCapsule | null): string | null {
  if (!content || content.runtimeSource !== "experience") return null;
  const context = resolveRuntimeExperienceContext(content);
  if (typeof context?.experienceId === "string" && context.experienceId.trim()) return context.experienceId.trim();
  const href = content.runtimeLaunchHref || "";
  if (href) {
    try {
      const url = new URL(href, "https://runtime.metame.local");
      const fromQuery = url.searchParams.get("experienceId");
      if (fromQuery?.trim()) return fromQuery.trim();
    } catch {
      const match = href.match(/[?&]experienceId=([^&#]+)/);
      if (match?.[1]) return decodeURIComponent(match[1]).trim();
    }
  }
  if (content.id.startsWith("experience-")) return content.id.replace(/^experience-/, "");
  return content.id || null;
}

function resolveRuntimeMediaMode(content: RuntimeCapsule): "image" | "video" {
  return deriveRuntimeExperienceKinds(content).includes("video") ? "video" : "image";
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

// ── RuntimeCapsuleAdminEditor ─────────────────────────────────────────────────
// Self-contained admin editor embedded inside the experience capsule panel.
// Positioned between the context chip and the media artifact so it lives within
// the runtime viewport and works in thin-client, preview, and live surfaces.
// Gate with runtimeAdminMode; future user-remix version can reuse with tighter constraints.
function RuntimeCapsuleAdminEditor({
  content,
  onComplete,
}: {
  content: RuntimeCapsule;
  onComplete: (override: {
    articleDraft: RuntimeArticleDraft | null;
    articleTitle: string;
    articlePrompt: string;
  }) => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formState, setFormState] = useState<RuntimeEditorState | null>(null);

  const experienceId = resolveRuntimeExperienceId(content) ?? "";

  const handleOpen = async () => {
    if (open) { setOpen(false); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/composer/experiences/${encodeURIComponent(experienceId)}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load ExperienceQube for editing.");
      const data = await res.json();
      const fetchedExperience = asRecord(data?.experience_qube) ?? {};
      const configuration = asRecord(fetchedExperience.configuration) ?? {};
      const metadata = asRecord(fetchedExperience.metadata) ?? {};
      const articleDraft = asRecord(configuration.article_draft) ?? {};
      const budgetRecord = asRecord(asRecord(metadata.runtime_admin_controls)?.article_draft) ?? {};
      const adminState = asRecord(metadata.runtime_admin_state) ?? {};
      setFormState({
        experienceId,
        experienceName: (typeof fetchedExperience.name === "string" && fetchedExperience.name) || content.title,
        articleTitle:
          (typeof articleDraft.title === "string" && articleDraft.title) ||
          resolveRuntimeArticleDraft(content)?.title ||
          content.title,
        articlePrompt:
          (typeof articleDraft.prompt === "string" && articleDraft.prompt) ||
          (typeof fetchedExperience.description === "string" ? fetchedExperience.description : "") ||
          "",
        articleOutputs: Array.isArray(articleDraft.outputs)
          ? articleDraft.outputs.filter((x): x is string => typeof x === "string")
          : ["takeaways", "next_action"],
        takeawaysCount:
          typeof articleDraft.takeaways_count === "number" && Number.isFinite(articleDraft.takeaways_count)
            ? articleDraft.takeaways_count
            : 3,
        budget: {
          maxRegenerations:
            typeof budgetRecord.max_regenerations === "number" && Number.isFinite(budgetRecord.max_regenerations)
              ? budgetRecord.max_regenerations : 3,
          maxSpendUsd:
            typeof budgetRecord.max_spend_usd === "number" && Number.isFinite(budgetRecord.max_spend_usd)
              ? budgetRecord.max_spend_usd : 0.1,
          estimatedCostUsd:
            typeof budgetRecord.estimated_cost_usd === "number" && Number.isFinite(budgetRecord.estimated_cost_usd)
              ? budgetRecord.estimated_cost_usd : 0.02,
          usedRegenerations:
            typeof adminState.article_draft_regenerations === "number" && Number.isFinite(adminState.article_draft_regenerations)
              ? adminState.article_draft_regenerations : 0,
        },
        fetchedExperience,
      });
      setOpen(true);
    } catch (e: any) {
      setError(e?.message || "Failed to open editor.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (regenerate: boolean) => {
    if (!formState) return;
    const { fetchedExperience, budget } = formState;
    const configuration = asRecord(fetchedExperience.configuration) ?? {};
    const metadata = asRecord(fetchedExperience.metadata) ?? {};
    const makeBundle = asRecord(configuration.make_bundle) ?? {};
    const bundleState = asRecord(metadata.composition_bundle_state) ?? {};
    const blockStatuses = { ...asRecord(makeBundle.block_statuses), ...asRecord(bundleState.block_statuses) };
    const blockOutputs = { ...asRecord(makeBundle.block_outputs), ...asRecord(bundleState.block_outputs) };
    const contextHints = normalizeStringArray([
      typeof fetchedExperience.description === "string" ? fetchedExperience.description : null,
      typeof fetchedExperience.goal === "string" ? fetchedExperience.goal : null,
    ]);
    setSaving(true);
    setError(null);
    try {
      let generatedDraft: RuntimeArticleDraft | null = resolveRuntimeArticleDraft(content);
      let usedRegenerations = budget.usedRegenerations;
      if (regenerate) {
        if (usedRegenerations >= budget.maxRegenerations) throw new Error("Article regeneration budget exhausted.");
        if (budget.estimatedCostUsd * (usedRegenerations + 1) > budget.maxSpendUsd + 1e-9)
          throw new Error("Article regeneration spend cap exceeded.");
        const genRes = await fetch("/api/composer/article-draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            experienceName: formState.experienceName,
            title: formState.articleTitle,
            prompt: formState.articlePrompt,
            outputs: formState.articleOutputs,
            takeawaysCount: formState.takeawaysCount,
            mediaMode: resolveRuntimeMediaMode(content),
            contextHints,
          }),
        });
        if (!genRes.ok) throw new Error("Failed to regenerate article draft.");
        const genData = await genRes.json();
        generatedDraft = (genData?.articleDraft as RuntimeArticleDraft | null) || generatedDraft;
        usedRegenerations += 1;
      }
      const articleDraftOutput = {
        ...asRecord(blockOutputs.article_draft),
        title: formState.articleTitle,
        prompt: formState.articlePrompt,
        outputs: formState.articleOutputs,
        takeaways_count: formState.takeawaysCount,
        ...(generatedDraft ? { generated: generatedDraft } : {}),
      };
      const nextConfig = {
        ...configuration,
        article_draft: {
          ...asRecord(configuration.article_draft),
          title: formState.articleTitle,
          prompt: formState.articlePrompt,
          outputs: formState.articleOutputs,
          takeaways_count: formState.takeawaysCount,
          ...(generatedDraft ? { generated: generatedDraft } : {}),
        },
        make_bundle: {
          ...makeBundle,
          block_statuses: {
            ...blockStatuses,
            article_draft: generatedDraft ? "ready_for_review" : (blockStatuses.article_draft || "in_progress"),
          },
          block_outputs: { ...blockOutputs, article_draft: articleDraftOutput },
        },
      };
      const nextMeta = {
        ...metadata,
        article_title: formState.articleTitle,
        article_prompt: formState.articlePrompt,
        editable_generation: {
          ...(asRecord(metadata.editable_generation) ?? {}),
          article_draft: {
            ...(asRecord(asRecord(metadata.editable_generation)?.article_draft) ?? {}),
            title: formState.articleTitle,
            prompt: formState.articlePrompt,
            outputs: formState.articleOutputs,
            takeaways_count: formState.takeawaysCount,
            ...(generatedDraft ? { generated: generatedDraft } : {}),
          },
        },
        composition_bundle_state: {
          ...bundleState,
          block_statuses: {
            ...blockStatuses,
            article_draft: generatedDraft ? "ready_for_review" : (blockStatuses.article_draft || "in_progress"),
          },
          block_outputs: { ...blockOutputs, article_draft: articleDraftOutput },
        },
        runtime_admin_controls: {
          ...asRecord(metadata.runtime_admin_controls),
          article_draft: {
            max_regenerations: budget.maxRegenerations,
            max_spend_usd: budget.maxSpendUsd,
            estimated_cost_usd: budget.estimatedCostUsd,
          },
        },
        runtime_admin_state: {
          ...asRecord(metadata.runtime_admin_state),
          article_draft_regenerations: usedRegenerations,
        },
      };
      const updateRes = await fetch(
        `/api/composer/experiences/${encodeURIComponent(formState.experienceId)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ configuration: nextConfig, metadata: nextMeta }),
        },
      );
      if (!updateRes.ok) throw new Error("Failed to persist runtime experience updates.");
      const updateData = await updateRes.json();
      const updatedExperience =
        asRecord(updateData?.experience_qube) ?? fetchedExperience;
      setFormState((prev) =>
        prev ? { ...prev, budget: { ...prev.budget, usedRegenerations }, fetchedExperience: updatedExperience } : prev,
      );
      onComplete({
        articleDraft: generatedDraft,
        articleTitle: formState.articleTitle,
        articlePrompt: formState.articlePrompt,
      });
      toast(regenerate ? "Runtime article regenerated" : "Runtime article settings saved", "success");
    } catch (e: any) {
      setError(e?.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-violet-400/25 bg-slate-900/70 p-3 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-violet-300/80">Runtime Admin</div>
          <div className="text-sm font-medium text-white">Customize &amp; regenerate</div>
        </div>
        <button
          type="button"
          onClick={() => void handleOpen()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-full border border-violet-300/25 bg-violet-500/10 px-3 py-1.5 text-xs text-violet-100 transition hover:bg-violet-500/20 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
          {open ? "Close editor" : "Customize"}
        </button>
      </div>

      {open && formState ? (
        <div className="space-y-4">
          {error ? (
            <div className="rounded-xl border border-rose-400/25 bg-rose-500/10 p-3 text-sm text-rose-100">{error}</div>
          ) : null}
          <div className="grid gap-4">
            <label className="grid gap-2">
              <span className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Article title</span>
              <input
                value={formState.articleTitle}
                onChange={(e) => setFormState((p) => p ? { ...p, articleTitle: e.target.value } : p)}
                className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/40"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Article prompt</span>
              <textarea
                value={formState.articlePrompt}
                onChange={(e) => setFormState((p) => p ? { ...p, articlePrompt: e.target.value } : p)}
                rows={4}
                className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/40"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Takeaways</span>
              <input
                type="number"
                min={1}
                max={5}
                value={formState.takeawaysCount}
                onChange={(e) =>
                  setFormState((p) => p ? { ...p, takeawaysCount: Math.min(5, Math.max(1, Number(e.target.value) || 1)) } : p)
                }
                className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/40"
              />
            </label>
            <div className="grid gap-2">
              <span className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Outputs</span>
              <div className="flex flex-wrap gap-2">
                {["takeaways", "glossary", "next_action"].map((output) => {
                  const enabled = formState.articleOutputs.includes(output);
                  return (
                    <button
                      key={output}
                      type="button"
                      onClick={() =>
                        setFormState((p) =>
                          p ? {
                            ...p,
                            articleOutputs: enabled
                              ? p.articleOutputs.filter((item) => item !== output)
                              : [...p.articleOutputs, output],
                          } : p,
                        )
                      }
                      className={`rounded-full border px-3 py-1 text-xs transition ${
                        enabled
                          ? "border-cyan-300/30 bg-cyan-500/10 text-cyan-100"
                          : "border-white/10 bg-white/5 text-slate-300"
                      }`}
                    >
                      {output}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/5 p-3">
              <div className="text-[11px] uppercase tracking-[0.16em] text-emerald-300">Budget controls</div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <label className="grid gap-2">
                  <span className="text-xs text-slate-300">Max regenerations</span>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={formState.budget.maxRegenerations}
                    onChange={(e) =>
                      setFormState((p) =>
                        p ? { ...p, budget: { ...p.budget, maxRegenerations: Math.min(20, Math.max(1, Number(e.target.value) || 1)) } } : p,
                      )
                    }
                    className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/40"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs text-slate-300">Spend cap (USD)</span>
                  <input
                    type="number"
                    min={0.01}
                    step={0.01}
                    value={formState.budget.maxSpendUsd}
                    onChange={(e) =>
                      setFormState((p) =>
                        p ? { ...p, budget: { ...p.budget, maxSpendUsd: Math.max(0.01, Number(e.target.value) || 0.01) } } : p,
                      )
                    }
                    className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/40"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs text-slate-300">Estimated cost / regen</span>
                  <input
                    type="number"
                    min={0.001}
                    step={0.001}
                    value={formState.budget.estimatedCostUsd}
                    onChange={(e) =>
                      setFormState((p) =>
                        p ? { ...p, budget: { ...p.budget, estimatedCostUsd: Math.max(0.001, Number(e.target.value) || 0.001) } } : p,
                      )
                    }
                    className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/40"
                  />
                </label>
              </div>
              <div className="mt-3 text-xs text-slate-300">
                Used: {formState.budget.usedRegenerations} / {formState.budget.maxRegenerations}
                {" · "}
                Spent: ${(formState.budget.usedRegenerations * formState.budget.estimatedCostUsd).toFixed(3)}
                {" / $"}
                {formState.budget.maxSpendUsd.toFixed(2)}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave(false)}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-slate-100 transition hover:bg-white/10 disabled:opacity-50"
            >
              Save settings
            </button>
            <button
              type="button"
              disabled={
                saving ||
                formState.budget.usedRegenerations >= formState.budget.maxRegenerations ||
                formState.budget.estimatedCostUsd * (formState.budget.usedRegenerations + 1) >
                  formState.budget.maxSpendUsd + 1e-9
              }
              onClick={() => void handleSave(true)}
              className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-100 transition hover:bg-cyan-500/20 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Regenerate + publish
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
// ── end RuntimeCapsuleAdminEditor ─────────────────────────────────────────────

// ── RuntimeArticlePanel ───────────────────────────────────────────────────────
function RuntimeArticlePanel({
  articleDraft,
  anchorId,
}: {
  articleDraft: RuntimeArticleDraft;
  anchorId: string;
}) {
  const { ttsState, handleListen } = useTTSPlayer({
    getText: () => {
      const sections = Array.isArray(articleDraft.sections) ? articleDraft.sections : [];
      const takeaways = Array.isArray(articleDraft.takeaways) ? articleDraft.takeaways : [];
      const parts: string[] = [];
      if (articleDraft.title) parts.push(`${articleDraft.title}.`);
      if (articleDraft.deck) parts.push(articleDraft.deck);
      if (articleDraft.opening) parts.push(articleDraft.opening);
      sections.forEach((s) => {
        if (s.heading) parts.push(`${s.heading}.`);
        if (s.body) parts.push(s.body);
      });
      if (takeaways.length > 0) {
        parts.push("Key takeaways.");
        parts.push(...takeaways.map((t) => `${t}.`));
      }
      return parts.join(" ").trim();
    },
  });

  return (
    <div id={anchorId} className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/80">Article</div>
          <div className="mt-1 text-base font-semibold text-white">{articleDraft.title}</div>
        </div>
        <button
          type="button"
          onClick={() => void handleListen()}
          disabled={ttsState === "loading"}
          title={ttsState === "playing" ? "Stop reading" : ttsState === "error" ? "TTS failed — click to dismiss" : "Listen with Marketa"}
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] transition ${
            ttsState === "playing"
              ? "border border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300"
              : ttsState === "error"
              ? "border border-red-500/40 bg-red-500/10 text-red-400"
              : "border border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white"
          }`}
        >
          {ttsState === "loading" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : ttsState === "playing" ? (
            <Square className="h-3.5 w-3.5" />
          ) : (
            <Headphones className="h-3.5 w-3.5" />
          )}
          <span>{ttsState === "playing" ? "Stop" : ttsState === "loading" ? "…" : ttsState === "error" ? "Error" : "Listen"}</span>
        </button>
      </div>
      {articleDraft.deck ? <div className="mt-2 text-sm text-slate-200">{articleDraft.deck}</div> : null}
      {articleDraft.opening ? <div className="mt-2 text-xs text-slate-400">{articleDraft.opening}</div> : null}
      {articleDraft.sections.length > 0 ? (
        <div className="space-y-3">
          {articleDraft.sections.map((section) => (
            <div key={section.heading} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{section.heading}</div>
              <div className="mt-1 text-sm text-slate-200">{section.body}</div>
            </div>
          ))}
        </div>
      ) : null}
      {articleDraft.takeaways.length > 0 ? (
        <div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Takeaways</div>
          <div className="mt-2 space-y-1 text-xs text-slate-300">
            {articleDraft.takeaways.map((item) => (
              <div key={item}>{item}</div>
            ))}
          </div>
        </div>
      ) : null}
      {articleDraft.glossary.length > 0 ? (
        <div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Glossary</div>
          <div className="mt-2 space-y-2 text-xs text-slate-300">
            {articleDraft.glossary.map((item) => (
              <div key={item.term}>
                <span className="font-medium text-white">{item.term}</span>: {item.definition}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {articleDraft.nextAction ? (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-100">
          <div className="text-[11px] uppercase tracking-[0.16em] text-emerald-300">Next action</div>
          <div className="mt-1">{articleDraft.nextAction}</div>
        </div>
      ) : null}
    </div>
  );
}
// ── end RuntimeArticlePanel ───────────────────────────────────────────────────

export default function MetaMeRuntimeClient() {
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const embedMode = searchParams?.get("embed") === "1";
  const thinShellQueryMode = searchParams?.get("shell") === "thin" || searchParams?.get("chrome") === "content-only";
  const selectedCapsuleId = searchParams?.get("capsule") ?? null;
  const selectedExperienceId = searchParams?.get("experienceId")?.trim() || null;
  const selectedExperienceName = searchParams?.get("experienceName");
  const selectedExperienceDescription = searchParams?.get("experienceDescription");
  const selectedExperienceContext = searchParams?.get("experienceContext");
  const selectedExperienceContextImage = searchParams?.get("experienceContextImage");
  const selectedExperienceImage = searchParams?.get("experienceImage");
  const selectedExperienceImagePortrait = searchParams?.get("experienceImagePortrait");
  const selectedExperienceImageLandscape = searchParams?.get("experienceImageLandscape");
  const selectedExperienceVideo = searchParams?.get("experienceVideo");
  const selectedExperienceArticleDraft = parseRuntimeArticleDraft(searchParams?.get("experienceArticleDraft"));
  const runtimeIntentParam = coerceRuntimeIntent(searchParams?.get("runtimeIntent"));
  const runtimeQuickLinkParam = coerceRuntimeIntent(searchParams?.get("runtimeQuickLink"));
  const runtimeAdminMode = searchParams?.get("runtimeAdmin") === "1" || searchParams?.get("admin") === "1";
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
  const [runtimeTheme, setRuntimeTheme] = useState<"light" | "dark">(
    searchParams?.get("theme") === "light" ? "light" : "dark"
  );
  const deviceParam = (searchParams?.get("device") as DeviceType) || "mobile";
  const defaultDevice: DeviceType =
    deviceParam === "desktop" || deviceParam === "tablet" || deviceParam === "mobile" ? deviceParam : "mobile";
  const [activeDevice, setActiveDevice] = useState<DeviceType>(defaultDevice);
  const [thinShellMode, setThinShellMode] = useState(thinShellQueryMode);
  const isMobileLayout = activeDevice === "mobile";
  const shellOriginRef = useRef<string | null>(null);
  const shellContextRef = useRef<{ tenant_id?: string; persona_id?: string }>({});
  const runtimeReadyPostedRef = useRef(false);
  // Stable conversation ID for the lifetime of this runtime session
  const conversationIdRef = useRef<string>(
    typeof crypto !== "undefined" ? crypto.randomUUID() : `conv-${Date.now()}`
  );
  const [activePersonaId, setActivePersonaId] = useState<string | null>(null);
  const [walletDrawerOpen, setWalletDrawerOpen] = useState(false);
  const [personaIQubeDrawer, setPersonaIQubeDrawer] = useState<"knyt" | "qripto" | null>(null);
  const [personaPickerOpen, setPersonaPickerOpen] = useState(false);
  const [identityIQubeOpen, setIdentityIQubeOpen] = useState(false);
  const [memoryDrawerOpen, setMemoryDrawerOpen] = useState(false);
  const [beMenuOpen, setBeMenuOpen] = useState(false);
  const [earnMenuOpen, setEarnMenuOpen] = useState(false);
  const [makeMenuOpen, setMakeMenuOpen] = useState(false);
  const [playMenuOpen, setPlayMenuOpen] = useState(false);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [connectionsDrawerOpen, setConnectionsDrawerOpen] = useState(false);
  const [walletInitialTab, setWalletInitialTab] = useState<"wallet" | "tasks" | "rewards" | "payments">("wallet");
  const [settingsDrawerOpen, setSettingsDrawerOpen] = useState(false);

  const [selectedAgent, setSelectedAgent] = useState<RuntimeAgent>(RUNTIME_AGENTS[0]);
  const [showAgentSelector, setShowAgentSelector] = useState(false);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  // Mirror of showWelcome for the stable [] onDrawerOpen handler — updated by effect below.
  const showWelcomeRef = useRef(true);
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
  const [runtimeContext, setRuntimeContext] = useState<'metame' | 'knyt'>('metame');

  // ─── Runtime Takeover ────────────────────────────────────────────────────────
  // Derive the active takeover cartridge slug from runtimeContext.
  // 'knyt' → KNYT takeover; default → metaMe fallback takeover.
  const takeoverCartridgeSlug = runtimeContext === 'knyt' ? 'knyt-codex' : 'metame-codex';
  const takeoverPersonaId = activePersonaId ?? shellContextRef.current.persona_id ?? null;
  const {
    manifest: takeoverManifest,
    isLoading: takeoverLoading,
    fireSignal: fireTakeoverSignal,
    refresh: refreshTakeover,
    dismiss: dismissTakeover,
  } = useRuntimeTakeover({
    cartridgeSlug: takeoverCartridgeSlug,
    personaId: takeoverPersonaId,
    entryPoint: "arrival",
    enabled: true,
  });

  // When runtimeContext switches to 'knyt' mid-session, refresh as a toggle entry
  const prevRuntimeContextRef = useRef(runtimeContext);
  useEffect(() => {
    if (prevRuntimeContextRef.current !== runtimeContext) {
      prevRuntimeContextRef.current = runtimeContext;
      refreshTakeover("toggle");
    }
  }, [runtimeContext, refreshTakeover]);

  // When personaId becomes available (wallet sign-in), refresh with personalised state
  const prevPersonaRef = useRef<string | null>(null);
  useEffect(() => {
    const next = activePersonaId ?? shellContextRef.current.persona_id ?? null;
    if (next && next !== prevPersonaRef.current) {
      prevPersonaRef.current = next;
      refreshTakeover("arrival");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePersonaId]);

  // Resolve display name for the banner from the codex config
  const takeoverDisplayName =
    CODEX_DEFINITIONS.find((c) => c.slug === takeoverCartridgeSlug || c.id === takeoverCartridgeSlug)
      ?.runtimeTakeover?.displayName ?? takeoverCartridgeSlug;

  // Re-sort capsuleContents so manifest-priority capsules appear first
  const applyTakeoverPriority = useCallback(
    (contents: RuntimeCapsule[]): RuntimeCapsule[] => {
      if (!takeoverManifest?.capsules?.length) return contents;
      const ids = takeoverManifest.capsules.map((c) => c.id);
      const pinId = takeoverManifest.capsules.find((c) => c.pin)?.id;
      const prioritySet = new Set(ids);
      const priority = ids
        .map((id) => contents.find((c) => c.id === id))
        .filter((c): c is RuntimeCapsule => Boolean(c));
      const rest = contents.filter((c) => !prioritySet.has(c.id));
      const sorted = [...priority, ...rest];
      if (pinId) {
        const pinIdx = sorted.findIndex((c) => c.id === pinId);
        if (pinIdx > 0) {
          const [pinned] = sorted.splice(pinIdx, 1);
          sorted.unshift(pinned);
        }
      }
      return sorted;
    },
    [takeoverManifest]
  );
  // ─────────────────────────────────────────────────────────────────────────────

  const [activeCartridgeOverlay, setActiveCartridgeOverlay] = useState<{
    slug: string;
    title: string;
    initialTab?: string;
  } | null>(null);
  // Tracks when the cartridge overlay was last opened — used to guard against race-condition
  // closes where CARTRIDGE_OVERLAY_CLOSE or a close-signal arrives within the same message
  // batch as LAUNCH_CARTRIDGE.  A 800ms cooldown is applied.
  const cartridgeOverlayOpenedAtRef = useRef<number>(0);
  // Once the user progresses past the welcome screen (handlePrompt sets showWelcome=false),
  // prevent any HANDOFF message from flipping it back.  This blocks the Lovable→STATE_SYNC→
  // HANDOFF feedback loop that was resetting the runtime to the landing page.
  const didExitWelcomeRef = useRef<boolean>(false);

  // Diagnostic: detect iframe/component remounts — if mount count > 1 the iframe is reloading.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    console.warn("[lifecycle] MetaMeRuntimeClient MOUNTED — new session, all state reset to defaults");
    return () => {
      console.warn("[lifecycle] MetaMeRuntimeClient UNMOUNTING — iframe/component is being destroyed");
    };
  }, []);
  const [agentProviderMap, setAgentProviderMap] = useState<Record<string, AgentProviderOption[]>>(staticProviderMap);
  const [selectedModelByAgent, setSelectedModelByAgent] = useState<RuntimeAgentModelMap>(() =>
    initialModelMap(staticProviderMap)
  );

  const activeAgentProviders = agentProviderMap[selectedAgent.id] || [];
  const activeModel = selectedModelByAgent[selectedAgent.id] || defaultSelectionFromProviders(activeAgentProviders);
  const trustProvider = activeModel?.providerId;
  const activePersonaKey = activePersonaId || AGENT_PERSONA_KEY[selectedAgent.id] || "kn0w1";
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
  const [livePromptValue, setLivePromptValue] = useState("");
  const [runtimeExperienceOverrides, setRuntimeExperienceOverrides] = useState<
    Record<string, { articleDraft?: RuntimeArticleDraft | null; articlePrompt?: string; articleTitle?: string }>
  >({});

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
  const parsedSelectedExperienceContext = useMemo(() => {
    if (!selectedExperienceContext) return null;
    try {
      const parsed = JSON.parse(selectedExperienceContext);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }, [selectedExperienceContext]);

  const queryPreviewCapsule = useMemo(() => {
    if (!selectedExperienceId) return null;
    return buildPreviewExperienceCapsule({
      experienceId: selectedExperienceId,
      selectedCapsuleId,
      title: selectedExperienceName,
      description: selectedExperienceDescription,
      contextImageUri: selectedExperienceContextImage,
      imageUri: selectedAdaptiveExperienceImage,
      imagePortraitUri: selectedExperienceImagePortrait,
      imageLandscapeUri: selectedExperienceImageLandscape,
      videoUri: selectedExperienceVideo,
      articleDraft: selectedExperienceArticleDraft,
      intent: runtimeIntentParam,
      quickLink: runtimeQuickLinkParam,
      activeCodexId: runtimeActiveCodexId,
      activeCodexName: runtimeActiveCodexName,
      activeCodexTab: runtimeCodexTab,
      runtimeCartridge,
      personaAssignment: runtimePersonaAssignment,
      crmCohortAssignment: runtimeCrmCohortAssignment,
      policyAssignment: runtimePolicyAssignment,
      experienceContext: parsedSelectedExperienceContext,
      runtimeAdminMode: embedMode || runtimeAdminMode,
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
    parsedSelectedExperienceContext,
    runtimeActiveCodexId,
    runtimeActiveCodexName,
    runtimeCartridge,
    runtimeCodexTab,
    runtimeCrmCohortAssignment,
    runtimeContentKindParam,
    runtimeIntentParam,
    runtimeAdminMode,
    runtimePersonaAssignment,
    runtimePolicyAssignment,
    runtimeQuickLinkParam,
    selectedAdaptiveExperienceImage,
    selectedCapsuleId,
    selectedExperienceArticleDraft,
    selectedExperienceContextImage,
    selectedExperienceDescription,
    selectedExperienceId,
    selectedExperienceImageLandscape,
    selectedExperienceImagePortrait,
    selectedExperienceName,
    selectedExperienceVideo,
  ]);

  const queryPreviewDisplayCapsule = useMemo(() => {
    if (!queryPreviewCapsule) return null;
    const experienceId = resolveRuntimeExperienceId(queryPreviewCapsule);
    const override = experienceId ? runtimeExperienceOverrides[experienceId] : null;
    if (!override) return queryPreviewCapsule;
    return {
      ...queryPreviewCapsule,
      runtimeArticleDraft: override.articleDraft ?? queryPreviewCapsule.runtimeArticleDraft,
    };
  }, [queryPreviewCapsule, runtimeExperienceOverrides]);

  const activeRuntimeExperience = useMemo(() => {
    const pool = queryPreviewDisplayCapsule ? [queryPreviewDisplayCapsule, ...allContents] : allContents;
    const active = pool.find((content) => content.id === activeCapsuleId) || queryPreviewDisplayCapsule || null;
    if (active) {
      const experienceId = resolveRuntimeExperienceId(active);
      if (experienceId && runtimeExperienceOverrides[experienceId]) {
        const override = runtimeExperienceOverrides[experienceId];
        return {
          ...active,
          runtimeArticleDraft: override.articleDraft ?? active.runtimeArticleDraft,
        };
      }
    }
    return active && active.runtimeSource === "experience" ? active : null;
  }, [activeCapsuleId, allContents, queryPreviewDisplayCapsule, runtimeExperienceOverrides]);

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
        // Preserve any preview capsule already in capsuleContents (items not returned by the
        // API). Without this, the Studio runtime thumbnail flips to a default capsule for the
        // few seconds between the carousel loading and the queryPreviewDisplayCapsule effect
        // re-inserting the preview item.
        setCapsuleContents((prev) => {
          const previewItems = prev.filter((item) => !activeSet.some((a) => a.id === item.id));
          const base = previewItems.length === 0
            ? selectCapsulesForDisplay(activeSet, 12)
            : selectCapsulesForDisplay([...previewItems, ...activeSet], 12 + previewItems.length).slice(0, 12);
          // Apply takeover priority ordering if a manifest is active
          return applyTakeoverPriority(base);
        });
      } else {
        setAllContents([]);
        setCapsuleContents([]);
      }
    } catch {
      setAllContents((prev) => prev);
      setCapsuleContents((prev) => prev);
    }
  }, [fetchRuntimeCapsules, applyTakeoverPriority]);

  useEffect(() => {
    fetchRuntimeData();
  }, [fetchRuntimeData]);

  // Re-sort capsuleContents whenever the takeover manifest arrives / changes
  useEffect(() => {
    if (!takeoverManifest) return;
    setCapsuleContents((prev) => applyTakeoverPriority(prev));
  }, [takeoverManifest, applyTakeoverPriority]);

  useEffect(() => {
    if (!queryPreviewDisplayCapsule) return;
    setAllContents((prev) => {
      const existing = prev.find((item) => item.id === queryPreviewDisplayCapsule.id);
      if (
        existing &&
        existing.title === queryPreviewDisplayCapsule.title &&
        existing.description === queryPreviewDisplayCapsule.description &&
        existing.coverImageUri === queryPreviewDisplayCapsule.coverImageUri &&
        existing.runtimeLaunchHref === queryPreviewDisplayCapsule.runtimeLaunchHref
      ) {
        return prev;
      }
      const next = prev.filter((item) => item.id !== queryPreviewDisplayCapsule.id);
      return [queryPreviewDisplayCapsule, ...next];
    });
    setCapsuleContents((prev) => {
      const withoutQueryCapsule = prev.filter((item) => item.id !== queryPreviewDisplayCapsule.id);
      return selectCapsulesForDisplay([queryPreviewDisplayCapsule, ...withoutQueryCapsule], 12);
    });
  // Also re-run when allContents changes (e.g. after fetchRuntimeData completes) so the
  // preview capsule is always re-inserted at the front of capsuleContents even if the
  // setCapsuleContents functional form above didn't preserve it in a given edge case.
  }, [queryPreviewDisplayCapsule, allContents]);

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
    console.warn("[runtime-reset] resetRuntime() called — tracing call site:");
    console.trace("[runtime-reset] resetRuntime trace");
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
    (content: RuntimeCapsule, intent: RuntimeIntent, options: { label: string; frameSrc: string; onClose?: () => void }) => {
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
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-200">{moduleConfig.label}</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-slate-300">{moduleConfig.screenFraction}</span>
              {options.onClose != null && (
                <button
                  type="button"
                  onClick={options.onClose}
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-700/50 hover:text-white transition-colors"
                  aria-label="Close cartridge"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
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

            {content.runtimeLaunchHref ? (() => {
              const codexMatch = content.runtimeLaunchHref?.match(/\/triad\/embed\/codex\/([^/?#]+)/);
              if (codexMatch) {
                const codexSlug = codexMatch[1];
                let initialTab: string | undefined;
                try {
                  const url = new URL(content.runtimeLaunchHref, 'http://x');
                  const tab = url.searchParams.get('tab') || url.searchParams.get('initialTab');
                  if (tab) initialTab = tab;
                } catch { /* invalid url — no tab */ }
                return (
                  <button
                    type="button"
                    onClick={() => {
                      const title = content.title || codexSlug.charAt(0).toUpperCase() + codexSlug.slice(1);
                      setActiveCartridgeOverlay({ slug: codexSlug, title, initialTab });
                    }}
                    className="inline-flex rounded-lg border border-emerald-300/30 bg-emerald-500/15 px-3 py-1.5 text-[11px] text-emerald-100 hover:bg-emerald-500/25"
                  >
                    Open in Codex
                  </button>
                );
              }
              return (
                <a
                  href={content.runtimeLaunchHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex rounded-lg border border-emerald-300/30 bg-emerald-500/15 px-3 py-1.5 text-[11px] text-emerald-100 hover:bg-emerald-500/25"
                >
                  Open Source Capsule
                </a>
              );
            })() : null}
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
          onClose: () => dismissCodexPanels(codexSlug),
        });
      }

      if (content.runtimeSource === "experience") {
        const heroImage = resolveCapsuleCoverImage(content);
        const previewMedia = content.runtimePreviewMediaUri || null;
        const mediaImage = !isLikelyVideoUri(previewMedia) ? previewMedia || heroImage : heroImage;
        const { videoStyle, imageStyle } = resolveSmartMediaPanelStyles(activeDevice, intent);
        const provider = detectExperienceProviderFromAssetUri(previewMedia || heroImage || content.runtimeLaunchHref || null);
        const makeBundle = asRecord(content.configuration?.make_bundle);
        const isVideoBundleOrKind =
          makeBundle?.presetId === "video_article_bundle" ||
          content.runtimeContentKind === "video";
        const primaryKind = (isLikelyVideoUri(previewMedia) || isVideoBundleOrKind) ? "video" : "image";
        const experienceKinds = deriveRuntimeExperienceKinds(content);
        const styleLabel = inferRuntimeExperienceStyle(content);
        const experienceContext = resolveRuntimeExperienceContext(content);
        const sourceExperienceHref = content.runtimeAuthoringHref
          ? withQueryParam(withQueryParam(content.runtimeAuthoringHref, "device", activeDevice), "from", "runtime")
          : null;
        const consumerExperienceHref = content.runtimeLaunchHref
          ? withQueryParam(content.runtimeLaunchHref, "device", activeDevice)
          : null;
        const receiptHref = sourceExperienceHref ? withQueryParam(sourceExperienceHref, "focus", "receipt") : null;
        const regenerateHref = sourceExperienceHref ? withQueryParam(sourceExperienceHref, "action", "regenerate") : null;
        const articleDraft = resolveRuntimeArticleDraft(content);
        const quickActions = deriveRuntimeExperienceQuickActions(content, intent);
        const mediaAnchorId = `experience-${content.id}-media`;
        const articleAnchorId = `experience-${content.id}-article`;
        return (
          <div
            data-embed-panel
            className={`rounded-2xl border border-cyan-400/25 bg-slate-950/85 p-3 space-y-3 ${
              embedMode ? "max-h-full overflow-y-auto" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/80">ExperienceQube Runtime</p>
                <p className="text-sm font-semibold text-white">{content.title}</p>
              </div>
              <div className="flex items-center gap-1.5">
                {experienceKinds.map((kind) => (
                  <span
                    key={kind}
                    className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-slate-200"
                    title={kind}
                  >
                    {runtimeContentKindIcon(kind)}
                    <span className={activeDevice === "mobile" ? "sr-only" : ""}>{kind}</span>
                  </span>
                ))}
                <span
                  className="inline-flex items-center gap-1 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-200"
                  title={activeDevice === "mobile" ? "portrait-first" : "landscape-first"}
                >
                  <span className={`inline-block rounded-[2px] border border-current ${activeDevice === "mobile" ? "h-3 w-2" : "h-2 w-3"}`} />
                  <span className={activeDevice === "mobile" ? "sr-only" : ""}>
                    {activeDevice === "mobile" ? "portrait-first" : "landscape-first"}
                  </span>
                </span>
              </div>
            </div>

            {heroImage ? (
              <div className="relative overflow-hidden rounded-xl border border-white/10">
                <img
                  src={heroImage}
                  alt={`${content.title} context`}
                  className="h-28 w-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />
              </div>
            ) : null}

            {(embedMode || runtimeAdminMode) ? (
              <RuntimeCapsuleAdminEditor
                content={content}
                onComplete={(override) =>
                  setRuntimeExperienceOverrides((prev) => ({
                    ...prev,
                    [resolveRuntimeExperienceId(content) ?? content.id]: override,
                  }))
                }
              />
            ) : null}

            <div id={mediaAnchorId} className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
              <ExperienceBlockHeader
                kind={primaryKind}
                provider={provider}
                title={primaryKind === "video" ? "Video Generation" : "Image Generation"}
                mobileTitle={primaryKind === "video" ? "Video" : "Image"}
                rightActions={
                  <div className="flex items-center gap-1">
                    <div
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400"
                      title={styleLabel}
                    >
                      <ExperienceStyleIcon style={styleLabel} className="h-5 w-5" />
                    </div>
                    {embedMode && receiptHref ? (
                      <a
                        href={receiptHref}
                        target="_top"
                        rel="noopener noreferrer"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-white/5 hover:text-cyan-200"
                        title="Open receipt details"
                      >
                        <FileText className="h-5 w-5" />
                      </a>
                    ) : null}
                    {embedMode && regenerateHref ? (
                      <a
                        href={regenerateHref}
                        target="_top"
                        rel="noopener noreferrer"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-white/5 hover:text-cyan-200"
                        title="Open source experience to regenerate"
                      >
                        <RefreshCw className="h-5 w-5" />
                      </a>
                    ) : null}
                    {embedMode && consumerExperienceHref ? (
                      <a
                        href={consumerExperienceHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-white/5 hover:text-cyan-200"
                        title="Pop out experience"
                      >
                        <SquareArrowOutUpRight className="h-5 w-5" />
                      </a>
                    ) : null}
                  </div>
                }
              />

              <div className="p-4 pt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium uppercase tracking-widest text-slate-400">
                    {primaryKind === "video" ? "video" : "preview"}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-200">
                      Last generated
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-emerald-300">
                      <Eye className="h-3 w-3" />
                      Live
                    </div>
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
              </div>
            </div>

            <p className="text-[11px] text-slate-400">
              Rendering the published experience media directly in runtime to avoid nested iframe shells.
            </p>

            {!embedMode && experienceContext ? (
              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/5 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/80">Active Experience</div>
                    <div className="mt-1 text-sm font-semibold text-white">
                      {typeof experienceContext.inferenceContext?.experienceName === "string"
                        ? experienceContext.inferenceContext.experienceName
                        : content.title}
                    </div>
                    {typeof experienceContext.inferenceContext?.experienceDescription === "string" &&
                    experienceContext.inferenceContext.experienceDescription.trim() ? (
                      <div className="mt-1 text-xs text-slate-300">
                        {experienceContext.inferenceContext.experienceDescription}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    {Array.isArray(experienceContext.allowedActions)
                      ? experienceContext.allowedActions.map((action) => (
                          <span
                            key={`${content.id}-${action}`}
                            className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-slate-200"
                          >
                            {action}
                          </span>
                        ))
                      : null}
                  </div>
                </div>
              </div>
            ) : null}

            {!embedMode ? (
              <div className="flex flex-wrap items-center gap-2">
                {quickActions.map((action) => {
                  if (action.kind === "watch") {
                    return (
                      <a
                        key={`${content.id}-${action.kind}`}
                        href={`#${mediaAnchorId}`}
                        className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-100 transition hover:bg-cyan-500/20"
                      >
                        <PlayCircle className="h-4 w-4" />
                        {action.label}
                      </a>
                    );
                  }
                  if (action.kind === "read") {
                    return (
                      <a
                        key={`${content.id}-${action.kind}`}
                        href={`#${articleAnchorId}`}
                        className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-slate-100 transition hover:bg-white/10"
                      >
                        <BookOpen className="h-4 w-4" />
                        {action.label}
                      </a>
                    );
                  }
                  if (action.kind === "listen") {
                    return (
                      <a
                        key={`${content.id}-${action.kind}`}
                        href={`#${articleAnchorId}`}
                        className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-slate-100 transition hover:bg-white/10"
                      >
                        <Headphones className="h-4 w-4" />
                        {action.label}
                      </a>
                    );
                  }
                  return (
                    <button
                      key={`${content.id}-${action.kind}`}
                      type="button"
                      onClick={() =>
                        setMessages((prev) => [
                          ...prev,
                          {
                            id: `share-panel-${Date.now()}`,
                            role: "assistant",
                            content: buildSharePanel(content.title),
                            timestamp: new Date(),
                            variant: "panel",
                          },
                        ])
                      }
                      className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-slate-100 transition hover:bg-white/10"
                    >
                      <Share2 className="h-4 w-4" />
                      {action.label}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {(content.runtimeContentKind === "article" || articleDraft) && articleDraft ? (
              <RuntimeArticlePanel articleDraft={articleDraft} anchorId={articleAnchorId} />
            ) : null}

            {embedMode && (() => {
              const makeBundle = asRecord(content.configuration?.make_bundle);
              const blockKinds = Array.isArray(makeBundle?.blockKinds) ? makeBundle.blockKinds as string[] : [];
              const blockStatuses = asRecord(makeBundle?.block_statuses);
              const imageGen = asRecord(content.configuration?.image_generation);
              const hasImagePrompts = typeof imageGen?.portrait_prompt === "string" && (imageGen.portrait_prompt as string).trim().length > 0;
              const videoPrompt = asRecord(content.configuration?.video_prompt);
              const hasVideoContent = typeof videoPrompt?.prompt === "string" && (videoPrompt.prompt as string).trim().length > 0;
              const needsImages =
                (blockKinds.includes("image_generation") || (hasImagePrompts && !hasVideoContent)) &&
                blockStatuses?.image_generation !== "accepted";
              if (needsImages) {
                return (
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== "undefined" && window.parent !== window) {
                        window.parent.postMessage(
                          { type: "composer:generate-images", experienceId: String(content.id || "") },
                          window.location.origin,
                        );
                      }
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-violet-400/60 bg-violet-400/10 px-3 py-1.5 text-[11px] text-violet-100 hover:bg-violet-400/20"
                  >
                    <Sparkles className="h-3 w-3" />
                    Generate Images
                  </button>
                );
              }
              if (consumerExperienceHref) {
                return (
                  <a
                    href={consumerExperienceHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex rounded-lg border border-cyan-300/30 bg-cyan-500/15 px-3 py-1.5 text-[11px] text-cyan-100 hover:bg-cyan-500/25"
                  >
                    Open Experience
                  </a>
                );
              }
              return null;
            })()}

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
    [activeDevice, buildSharePanel, dismissCodexPanels, embedMode, renderRuntimeFramePanel, runtimeAdminMode, setRuntimeExperienceOverrides, setActiveCartridgeOverlay]
  );

  const launchCapsule = useCallback(
    (content: RuntimeCapsule, intent: RuntimeIntent = lastIntent) => {
      // Fire a takeover view signal so the feedback loop tracks what the user engaged with
      fireTakeoverSignal("view", { contentId: content.id, runtimeSource: content.runtimeSource });

      // Codex-source capsules always open as a z-axis overlay so the runtime stays live underneath
      if (content.runtimeSource === "codex") {
        const slug = content.runtimeCodexSlug || "knyt";
        const title = content.title || slug.charAt(0).toUpperCase() + slug.slice(1);
        const initialTab = content.runtimeCodexInitialTab || undefined;
        setActiveCartridgeOverlay({ slug, title, initialTab });
        return;
      }
      // Non-codex content (smart-content, experience) still goes into the message feed
      setSelectedCapsuleLocal(content.id);
      const launchMessageId = buildLaunchMessageId({
        runtimeSource: content.runtimeSource,
        runtimeCodexSlug: content.runtimeCodexSlug || null,
      });
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
    [buildRuntimeCapsulePanel, fireTakeoverSignal, lastIntent, setActiveCartridgeOverlay]
  );

  // Moved earlier than its original location (was after runtimeSurface) so the auto-launch
  // effect below can reference it without a temporal dead zone error.
  const renderRuntimeExperienceChip = useCallback(
    (content: RuntimeCapsule, intent: RuntimeIntent) => {
      const heroImage = resolveCapsuleCoverImage(content);
      const experienceKinds = deriveRuntimeExperienceKinds(content);
      const bundleLabel = resolveRuntimeExperienceBundleLabel(content);
      const { headline, summary } = resolveRuntimeExperienceSummary(content);
      const quickActions = deriveRuntimeExperienceQuickActions(content, intent);
      const consumerExperienceHref = content.runtimeLaunchHref
        ? withQueryParam(content.runtimeLaunchHref, "device", activeDevice)
        : null;
      return (
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/80">Experience chip</div>
              <div className="mt-1 text-base font-semibold text-white">{headline}</div>
              <div className="mt-1 text-sm text-slate-300 line-clamp-3">{summary}</div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              {bundleLabel ? (
                <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-200">
                  {bundleLabel}
                </span>
              ) : null}
              {experienceKinds.map((kind) => (
                <span
                  key={`chip-${content.id}-${kind}`}
                  className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-slate-200"
                  title={kind}
                >
                  {runtimeContentKindIcon(kind)}
                  <span className={activeDevice === "mobile" ? "sr-only" : ""}>{kind}</span>
                </span>
              ))}
            </div>
          </div>
          {heroImage ? (
            <div className="mt-3 overflow-hidden rounded-xl border border-white/10">
              <img src={heroImage} alt={content.title} className="h-40 w-full object-cover" loading="lazy" />
            </div>
          ) : isLikelyVideoUri(content.runtimePreviewMediaUri || null) ? (
            <div className="mt-3 overflow-hidden rounded-xl border border-white/10">
              <video
                src={content.runtimePreviewMediaUri || undefined}
                className="h-40 w-full object-cover"
                muted
                playsInline
                preload="metadata"
              />
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {quickActions.map((action) => (
              <span
                key={`chip-action-${content.id}-${action.kind}`}
                className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-200"
              >
                {action.kind === "watch" ? <PlayCircle className="h-3.5 w-3.5" /> : null}
                {action.kind === "read" ? <BookOpen className="h-3.5 w-3.5" /> : null}
                {action.kind === "listen" ? <Headphones className="h-3.5 w-3.5" /> : null}
                {action.kind === "share" ? <Share2 className="h-3.5 w-3.5" /> : null}
                {action.label}
              </span>
            ))}
            {consumerExperienceHref && !embedMode ? (
              <a
                href={consumerExperienceHref}
                className="inline-flex items-center gap-1 rounded-full border border-cyan-300/25 bg-cyan-500/10 px-3 py-1 text-[11px] text-cyan-100 transition hover:bg-cyan-500/20"
              >
                <Eye className="h-3.5 w-3.5" />
                Enter experience
              </a>
            ) : null}
          </div>
        </div>
      );
    },
    [activeDevice, embedMode],
  );

  useEffect(() => {
    if (!queryPreviewDisplayCapsule) {
      autoLaunchedCapsuleRef.current = null;
      return;
    }
    if (autoLaunchedCapsuleRef.current === queryPreviewDisplayCapsule.id) return;
    autoLaunchedCapsuleRef.current = queryPreviewDisplayCapsule.id;
    setShowWelcome(false);
    const launchIntent = runtimeIntentParam || defaultRuntimeIntentForCapsule(queryPreviewDisplayCapsule);
    setLastIntent(launchIntent);
    setSelectedCapsuleLocal(queryPreviewDisplayCapsule.id);
    launchCapsule(queryPreviewDisplayCapsule, launchIntent);
  }, [launchCapsule, queryPreviewDisplayCapsule, runtimeIntentParam]);

  // After an experience auto-launches in embed mode, CopilotKit scrolls to the bottom
  // (showing the thumbnail carousel). Override by scrolling the capsule panel back into
  // view at the top after a short delay so the hero/context area is shown first.
  // Also re-run when capsuleContents changes: fetchRuntimeData updates the carousel which
  // triggers scrollChatToBottom, pushing the article/media panel off-screen. Re-scrolling
  // to [data-embed-panel] ensures the article remains visible in embed/Studio preview mode.
  useEffect(() => {
    if (!embedMode || !queryPreviewDisplayCapsule) return;
    const t = setTimeout(() => {
      document.querySelector("[data-embed-panel]")?.scrollIntoView({ block: "start", behavior: "instant" });
    }, 150);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedMode, queryPreviewDisplayCapsule?.id, capsuleContents]);

  // When queryPreviewDisplayCapsule changes due to runtimeExperienceOverrides (same id, updated
  // article draft), refresh the already-launched message panel in the shell in-place.
  // Guard with a stable key so we only call setMessages (and trigger scrollChatToBottom) when
  // content has actually changed — not just because queryPreviewDisplayCapsule got a new object
  // reference from useMemo.
  const lastInPlaceUpdateKeyRef = useRef<string>("");
  useEffect(() => {
    if (!queryPreviewDisplayCapsule || !autoLaunchedCapsuleRef.current) return;
    if (autoLaunchedCapsuleRef.current !== queryPreviewDisplayCapsule.id) return;
    const cap = queryPreviewDisplayCapsule as unknown as Record<string, unknown>;
    const updateKey = [
      String(cap.id ?? ""),
      runtimeIntentParam ?? "",
      String(cap.title ?? ""),
      String(cap.articleTitle ?? ""),
      JSON.stringify(cap.articleDraft ?? null),
    ].join("\x00");
    if (updateKey === lastInPlaceUpdateKeyRef.current) return;
    lastInPlaceUpdateKeyRef.current = updateKey;
    const launchMessageId = buildLaunchMessageId({
      runtimeSource: queryPreviewDisplayCapsule.runtimeSource,
      runtimeCodexSlug: queryPreviewDisplayCapsule.runtimeCodexSlug || null,
    });
    const launchIntent = runtimeIntentParam || defaultRuntimeIntentForCapsule(queryPreviewDisplayCapsule);
    setMessages((prev) =>
      prev.map((message) =>
        message.id === launchMessageId
          ? { ...message, content: buildRuntimeCapsulePanel(queryPreviewDisplayCapsule, launchIntent) }
          : message,
      ),
    );
  }, [buildRuntimeCapsulePanel, queryPreviewDisplayCapsule, runtimeIntentParam]);

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
      const timeSinceOverlayOpen = Date.now() - cartridgeOverlayOpenedAtRef.current;
      console.warn("[codex-close] onAnyMessage close signal matched", { closeSignal, navigateSignal, timeSinceOverlayOpen, source: event.source === window.parent ? "parent" : "child/other" });
      dismissCodexPanels(closeSignal.isClose ? closeSignal.codexId : navigateSignal.codexId);
      // Also close the z-axis cartridge overlay if one is active — apply same 800ms cooldown
      // to guard against race conditions where the overlay was just opened.
      if (timeSinceOverlayOpen >= 800) {
        setActiveCartridgeOverlay(null);
      } else {
        console.warn("[codex-close] onAnyMessage skipping setActiveCartridgeOverlay(null) — within 800ms of open", { timeSinceOverlayOpen });
      }
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
        const timeSinceBcOpen = Date.now() - cartridgeOverlayOpenedAtRef.current;
        console.warn("[codex-close] BroadcastChannel close signal", { closeSignal, navigateSignal, timeSinceBcOpen });
        dismissCodexPanels(closeSignal.isClose ? closeSignal.codexId : navigateSignal.codexId);
        if (timeSinceBcOpen >= 800) {
          setActiveCartridgeOverlay(null);
        }
        relayCloseCodexToNestedFrames();
      };
    } catch (e) { /* BroadcastChannel not supported */ }

    return () => {
      window.removeEventListener("message", onAnyMessage);
      try { bc?.close(); } catch (_) {}
    };
  }, [relayCloseCodexToNestedFrames, setActiveCartridgeOverlay]);

  const capsulePanel = useMemo(
    () => (
      <div className="space-y-3">
        {/* Runtime Takeover Banner — shown whenever a takeover manifest is active */}
        {takeoverManifest && (
          <RuntimeTakeoverBanner
            manifest={takeoverManifest}
            cartridgeDisplayName={takeoverDisplayName}
            cartridgeContext={runtimeContext}
            onDismiss={dismissTakeover}
            onNextBestAction={(target, targetType) => {
              if (targetType === "codex") {
                setActiveCartridgeOverlay({ slug: target, title: target });
              }
            }}
          />
        )}
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
              const styleLabel = inferRuntimeExperienceStyle(content);
              // Content verb actions derived from the capsule's actual capabilities.
              // These drive the RIGHT side of the card (what you CAN DO).
              const quickActions = deriveRuntimeExperienceQuickActions(content, lastIntent);
              // Non-verb modality hints drive the LEFT side type badge (what it IS).
              const verbHints = new Set(["read", "watch", "listen", "play", "share", "interact", "explore"]);
              const typeHint = content.runtimeModalityHints?.find((h) => !verbHints.has(h.toLowerCase()));
              const contentTypeBadge = typeHint
                ? typeHint.toUpperCase()
                : content.runtimeSource === "experience" && styleLabel === "cinematic"
                ? "FILM"
                : null;
              // Bottom row modality label: only non-verb hints (editorial positioning)
              const modalityLabel =
                content.runtimeModalityHints
                  ?.filter((h) => !verbHints.has(h.toLowerCase()))
                  .slice(0, 2)
                  .join(" · ") ||
                styleLabel ||
                "details";
              const authoringExperienceHref = content.runtimeAuthoringHref
                ? withQueryParam(withQueryParam(content.runtimeAuthoringHref, "device", activeDevice), "from", "runtime")
                : null;
              const consumerExperienceHref = content.runtimeLaunchHref
                ? withQueryParam(content.runtimeLaunchHref, "device", activeDevice)
                : null;
              const receiptHref = authoringExperienceHref
                ? withQueryParam(authoringExperienceHref, "focus", "receipt")
                : null;
              const regenerateHref = authoringExperienceHref
                ? withQueryParam(authoringExperienceHref, "action", "regenerate")
                : null;
              const sourceBadgeClass =
                content.runtimeSource === "codex"
                  ? "border-cyan-300/70 bg-cyan-500/30 text-cyan-100 font-semibold"
                  : content.runtimeSource === "experience"
                    ? "border-violet-300/70 bg-violet-500/30 text-violet-100 font-semibold"
                    : "border-emerald-300/70 bg-emerald-500/30 text-emerald-100 font-semibold";
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
                    {isLikelyVideoUri(content.runtimePreviewMediaUri || null) ? (
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
                      {/* LEFT — what it IS: source label + optional content type badge */}
                      <div className="flex items-center gap-1.5">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${sourceBadgeClass}`}>
                          {sourceLabel}
                        </span>
                        {contentTypeBadge ? (
                          <span className="rounded-full border border-white/18 bg-white/8 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/70">
                            {contentTypeBadge}
                          </span>
                        ) : null}
                      </div>
                      {/* RIGHT — what you CAN DO: icon-only action buttons */}
                      <div className="flex items-center gap-1">
                        {quickActions.map((action) => (
                          <button
                            key={action.kind}
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              if (action.kind === "share") {
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
                              } else {
                                launchCapsule(content);
                              }
                            }}
                            className="rounded-full border border-white/20 bg-slate-900/60 p-1.5 text-white/80 hover:text-white"
                            title={action.label}
                          >
                            {quickActionIcon(action.kind)}
                          </button>
                        ))}
                        {embedMode && content.runtimeSource === "experience" && (receiptHref || regenerateHref) ? (
                          <span className="mx-0.5 h-3 w-px bg-white/20" aria-hidden="true" />
                        ) : null}
                        {embedMode && content.runtimeSource === "experience" && receiptHref ? (
                          <a
                            href={receiptHref}
                            target="_top"
                            rel="noopener noreferrer"
                            onClick={(event) => event.stopPropagation()}
                            className="rounded-full border border-white/15 bg-slate-900/50 p-1.5 text-white/55 hover:text-white/80"
                            title="View receipt"
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </a>
                        ) : null}
                        {embedMode && content.runtimeSource === "experience" && regenerateHref ? (
                          <a
                            href={regenerateHref}
                            target="_top"
                            rel="noopener noreferrer"
                            onClick={(event) => event.stopPropagation()}
                            className="rounded-full border border-white/15 bg-slate-900/50 p-1.5 text-white/55 hover:text-white/80"
                            title="Regenerate"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </a>
                        ) : null}
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            if (consumerExperienceHref) {
                              window.open(consumerExperienceHref, "_blank", "noopener,noreferrer");
                            } else {
                              launchCapsule(content);
                            }
                          }}
                          className="rounded-full border border-white/15 bg-slate-900/50 p-1.5 text-white/55 hover:text-white/80"
                          title="Open in new window"
                        >
                          <SquareArrowOutUpRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 p-3 space-y-2">
                      <h4 className="line-clamp-1 text-sm font-semibold text-white">{content.title}</h4>
                      <p className="line-clamp-2 text-[11px] text-slate-200/85">{content.description}</p>
                      <div className="flex items-center gap-2 text-[10px] font-medium text-slate-100">
                        <span className="rounded-full border border-white/30 bg-white/18 px-2 py-0.5 uppercase tracking-wide">{modalityLabel}</span>
                        {content.runtimeDurationMinutes ? (
                          <span className="rounded-full border border-white/25 bg-white/15 px-2 py-0.5">{content.runtimeDurationMinutes} min</span>
                        ) : null}
                        {content.runtimePriceLabel ? (
                          <span className="rounded-full border border-white/25 bg-white/15 px-2 py-0.5">{content.runtimePriceLabel}</span>
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
    [activeCapsuleId, activeDevice, buildSharePanel, capsuleContents, dismissTakeover, embedMode, launchCapsule, takeoverDisplayName, takeoverManifest]
  );

  // Gate capsule-panel message updates by capsule ID list + active capsule + device.
  // capsulePanel (JSX) always produces a new reference even when content is identical;
  // calling setMessages on every re-memo would change displayMessages and fire
  // scrollChatToBottom() unnecessarily. Only update when the meaningful identifiers change.
  const capsulePanelHashRef = useRef<string>("");
  const capsulePanelTimestampRef = useRef<Date>(new Date());
  useEffect(() => {
    if (showWelcome) return;
    const hash = [activeDevice, activeCapsuleId ?? "", capsuleContents.map((c) => c.id).join(",")].join("|");
    if (hash === capsulePanelHashRef.current) return;
    capsulePanelHashRef.current = hash;
    // Reuse the same timestamp so the message object itself doesn't change reference
    // unnecessarily when only the JSX content updates.
    const panelMsg = {
      id: "capsule-panel",
      role: "assistant" as const,
      content: capsulePanel,
      timestamp: capsulePanelTimestampRef.current,
      variant: "panel" as const,
    };
    setMessages((prev) => {
      const withoutPanel = prev.filter((message) => message.id !== "capsule-panel");
      // Carousel always goes last so scrollChatToBottom() lands on the thumbnails,
      // keeping them visible. Experience content sits above and is readable by scrolling up.
      return [...withoutPanel, panelMsg];
    });
  }, [activeCapsuleId, activeDevice, capsuleContents, capsulePanel, embedMode, showWelcome]);

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

  const { handleShellBridgeMessage: handleBrowserShellBridgeMessage } = useBrowserCapabilityController({
    enabled: embedMode,
    emitShellEvent: (type, payload) => {
      postRuntimeEvent(type, payload);
    },
  });

  // Apply a lead agent by ID — sets the active agent and notifies the thin client shell
  const applyLeadAgentSetting = useCallback(
    (leadAgentId: LeadAgent) => {
      const agent = RUNTIME_AGENTS.find((a) => a.id === leadAgentId);
      if (!agent) return;
      setSelectedAgent(agent);
      postRuntimeEvent("LEAD_AGENT_CHANGED", {
        agentId: agent.id,
        agentLabel: agent.label,
      });
    },
    [postRuntimeEvent]
  );

  // Sync lead agent from metaMe settings on mount and whenever settings change
  useEffect(() => {
    const stored = loadMetaMeSettings();
    applyLeadAgentSetting(stored.leadAgent);

    function onSettingsChanged(e: Event) {
      const settings = (e as CustomEvent).detail;
      if (settings?.leadAgent) {
        applyLeadAgentSetting(settings.leadAgent as LeadAgent);
      }
    }
    window.addEventListener("metame_settings_changed", onSettingsChanged);
    return () => window.removeEventListener("metame_settings_changed", onSettingsChanged);
  }, [applyLeadAgentSetting]);

  // Notify the thin-client shell whenever the cartridge overlay opens or closes
  useEffect(() => {
    if (activeCartridgeOverlay) {
      postRuntimeEvent("CARTRIDGE_OVERLAY_ACTIVE", {
        active: true,
        slug: activeCartridgeOverlay.slug,
        title: activeCartridgeOverlay.title,
      });
    } else {
      postRuntimeEvent("CARTRIDGE_OVERLAY_ACTIVE", { active: false });
    }
  }, [activeCartridgeOverlay, postRuntimeEvent]);

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

      // ── Prompt fast-paths: open iQube drawers without inference ──────────
      // These match natural-language requests so the drawers are reachable via
      // the prompt bar as well as via shell postMessage — matching Wallet's
      // dual-path reliability.
      {
        const lp = trimmed.toLowerCase();
        if (/\b(knyt\s+persona|knyt\s+iqube|open\s+knyt|my\s+knyt\s+profile)\b/.test(lp)) {
          setPersonaIQubeDrawer("knyt");
          return;
        }
        if (/\b(qripto\s+persona|qripto\s+iqube|open\s+qripto|my\s+qripto\s+profile)\b/.test(lp)) {
          setPersonaIQubeDrawer("qripto");
          return;
        }
        if (/\b(persona\s+iqube|open\s+persona|my\s+persona|persona\s+qube)\b/.test(lp)) {
          setPersonaPickerOpen(true);
          return;
        }
        if (/\b(identity\s+iqube|open\s+identity|my\s+identity|identity\s+qube|did\s*qube)\b/.test(lp)) {
          setIdentityIQubeOpen(true);
          return;
        }
        if (/\b(my\s+memory|open\s+memory|memory\s+iqube|chat\s+history|conversation\s+history)\b/.test(lp)) {
          setMemoryDrawerOpen(true);
          return;
        }
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
      let ranked = selectCapsulesForDisplay(runtimeFiltered, 12);
      if (intent === "play") {
        ranked = diversifyPlayCapsules(ranked, selectedCapsuleLocal || null);
      }

      setCapsuleContents(ranked);
      setLastIntent(intent);
      didExitWelcomeRef.current = true;
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

      const persona = selectedAgent.id;
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
        // Non-blocking Supabase memory write — fire-and-forget, never blocks rendering
        void (async () => {
          try {
            const token = getAccessTokenFromStorage();
            if (!token) return;
            await fetch("/api/iqube/memory", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                query: trimmed,
                response: renderedResponse,
                interaction_type: intent === "earn" ? "earn" : "aigent",
                metadata: {
                  activePersona: activePersonaId,
                  conversationId: conversationIdRef.current,
                  agentType: selectedAgent.id,
                  modelUsed: usedModel,
                  aiProvider: usedProvider,
                  intent,
                  device: activeDevice,
                },
              }),
            });
          } catch {
            // Non-fatal — memory write failure never affects the chat experience
          }
        })();
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

  // Stable ref to latest handlePrompt — updated whenever handlePrompt changes so
  // the [] stable handler can call it without capturing a stale closure.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handlePromptRef = useRef<typeof handlePrompt>(handlePrompt);
  useEffect(() => { handlePromptRef.current = handlePrompt; }, [handlePrompt]);
  // Keep showWelcomeRef in sync so the [] stable handler can read current welcome state.
  useEffect(() => { showWelcomeRef.current = showWelcome; }, [showWelcome]);

  // Stable, permanent handler for persona and identity drawer opens.
  // Uses [] deps so it never tears down/re-registers — immune to dep-array churn in
  // the main onShellMessage effect. State setters are guaranteed stable by React.
  useEffect(() => {
    function onDrawerOpen(event: MessageEvent) {
      if (event.source !== window.parent) return;
      const raw = event.data;
      if (!raw || typeof raw !== "object" || typeof raw.type !== "string") return;
      const rawPayload = (raw.payload && typeof raw.payload === "object"
        ? raw.payload
        : raw) as Record<string, unknown>;

      // When triggered from the welcome screen, fire contextual inference first so the
      // user lands on relevant content underneath the drawer, not a blank landing page.
      // The drawer opens immediately (don't wait for inference) — hoisted iQubeDrawerLayer
      // ensures it renders over the welcome screen regardless of showWelcome.
      const maybeAdvanceWelcome = (prompt: string) => {
        if (showWelcomeRef.current && handlePromptRef.current) {
          void handlePromptRef.current(prompt, { source: "text_input", skipInference: false });
        }
      };

      if (raw.type === "OPEN_PERSONA_IQUBE") {
        const iQubeType = typeof rawPayload.iqube_type === "string" ? rawPayload.iqube_type : null;
        console.warn("[drawer] OPEN_PERSONA_IQUBE received", { iQubeType });
        if (iQubeType === "knyt") {
          maybeAdvanceWelcome("Tell me about my KNYT persona, my metaKnyt character and journey");
          setPersonaIQubeDrawer("knyt");
        } else if (iQubeType === "qripto") {
          maybeAdvanceWelcome("Tell me about my Qriptopian persona and reader identity");
          setPersonaIQubeDrawer("qripto");
        } else {
          maybeAdvanceWelcome("Tell me about my personas and how I express my identity in the protocol");
          setPersonaPickerOpen(true);
        }
        return;
      }

      if (raw.type === "OPEN_IDENTITY_IQUBE") {
        console.warn("[drawer] OPEN_IDENTITY_IQUBE received → opening");
        maybeAdvanceWelcome("Tell me about my identity iQube and what it means for my data sovereignty");
        setIdentityIQubeOpen(true);
        return;
      }

      if (raw.type === "OPEN_MEMORY_IQUBE") {
        console.warn("[drawer] OPEN_MEMORY_IQUBE received → opening");
        maybeAdvanceWelcome("Show me my memory iQube and conversation history");
        setMemoryDrawerOpen(true);
        return;
      }

      if (raw.type === "OPEN_CONNECTIONS_IQUBE" || raw.type === "OPEN_CONNECTIONS_DRAWER") {
        console.warn("[drawer] OPEN_CONNECTIONS_IQUBE received → opening");
        maybeAdvanceWelcome("Show me my connections");
        setConnectionsDrawerOpen(true);
        return;
      }

      if (raw.type === "LAUNCH_CARTRIDGE") {
        const cartridgeId = typeof rawPayload.cartridge_id === "string" ? rawPayload.cartridge_id : null;
        console.warn("[drawer] LAUNCH_CARTRIDGE received (stable handler)", { cartridgeId });
        if (cartridgeId) {
          const slug = cartridgeId.replace(/-codex$/i, "");
          cartridgeOverlayOpenedAtRef.current = Date.now();
          console.warn("[drawer] LAUNCH_CARTRIDGE → opening overlay", { slug });
          setActiveCartridgeOverlay({ slug, title: slug.charAt(0).toUpperCase() + slug.slice(1) });
        }
        return;
      }

      if (raw.type === "RUNTIME_CONTEXT_CHANGE") {
        const ctx = (rawPayload.context ?? (raw as Record<string, unknown>).context) === "knyt" ? "knyt" : "metame";
        setRuntimeContext(ctx as "metame" | "knyt");
        return;
      }
    }

    window.addEventListener("message", onDrawerOpen);
    // Drain the pre-bootstrap buffer into this stable handler so messages that
    // arrived before any React effect registered are not lost.
    _drainEarlyCapture(onDrawerOpen);

    return () => window.removeEventListener("message", onDrawerOpen);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

    function syncBrowserAaConfig(payload: Record<string, unknown>) {
      const baseUrl =
        typeof payload.aa_api_base_url === "string" && payload.aa_api_base_url.trim().length > 0
          ? payload.aa_api_base_url.trim()
          : null;
      const token =
        typeof payload.aa_api_token === "string" && payload.aa_api_token.trim().length > 0
          ? payload.aa_api_token.trim()
          : null;

      if (!baseUrl) return;

      const runtimeConfig = {
        baseUrl,
        token,
      };

      try {
        sessionStorage.setItem("metame.browser.aaClientConfig", JSON.stringify(runtimeConfig));
      } catch {
        // Ignore storage failures; the in-memory runtime copy is enough for the current session.
      }

      (
        window as Window & {
          __METAME_RUNTIME_AA_CONFIG__?: {
            baseUrl: string;
            token: string | null;
          };
        }
      ).__METAME_RUNTIME_AA_CONFIG__ = runtimeConfig;
    }

    function onShellMessage(event: MessageEvent) {
      if (event.source !== window.parent) return;

      // ── Universal catch-all log (FIRST thing, before any filtering) ──────────
      // This log runs for EVERY message from the parent — use it to diagnose
      // what Lovable is actually sending and in what order.
      const _rawType = event.data && typeof event.data === "object" ? (event.data as Record<string, unknown>).type : typeof event.data;
      console.warn("[all-msgs] parent→runtime:", _rawType, event.data);

      // LAUNCH_CARTRIDGE and RUNTIME_CONTEXT_CHANGE may arrive in raw (non-bridge)
      // format from the Lovable shell. Handle them before the strict bridge check so
      // they work regardless of whether the shell uses createShellMessage() or not.
      const raw = event.data;
      if (raw && typeof raw === "object" && typeof raw.type === "string") {
        console.log("[bridge] shell→runtime message received:", raw.type, raw);
        // Support both raw { type, cartridge_id } and bridge { type, payload: { cartridge_id } }
        const rawPayload = (raw.payload && typeof raw.payload === "object" ? raw.payload : raw) as Record<string, unknown>;

        if (raw.type === "LAUNCH_CARTRIDGE") {
          const cartridgeId = typeof rawPayload.cartridge_id === "string" ? rawPayload.cartridge_id : null;
          const codexId = typeof rawPayload.codex_id === "string" ? rawPayload.codex_id : cartridgeId;
          const rawSlug = codexId || cartridgeId;
          console.warn("[drawer] LAUNCH_CARTRIDGE received (volatile handler)", { cartridgeId, codexId, rawSlug });
          if (rawSlug) {
            const slug = (rawSlug as string).replace(/-codex$/i, "");
            const title = slug.charAt(0).toUpperCase() + slug.slice(1);
            cartridgeOverlayOpenedAtRef.current = Date.now();
            console.warn("[drawer] LAUNCH_CARTRIDGE → opening overlay (volatile)", { slug });
            setActiveCartridgeOverlay({ slug, title });
          }
          return;
        }

        if (raw.type === "CARTRIDGE_OVERLAY_CLOSE") {
          const timeSinceOpen = Date.now() - cartridgeOverlayOpenedAtRef.current;
          console.warn("[drawer] CARTRIDGE_OVERLAY_CLOSE received", { timeSinceOpen });
          if (timeSinceOpen < 800) {
            console.warn("[drawer] CARTRIDGE_OVERLAY_CLOSE ignored — within 800ms cooldown", { timeSinceOpen });
            return;
          }
          console.warn("[drawer] CARTRIDGE_OVERLAY_CLOSE → closing overlay");
          setActiveCartridgeOverlay(null);
          return;
        }

        // OPEN_PERSONA_IQUBE and OPEN_IDENTITY_IQUBE are handled by the stable
        // useEffect above — not here — so they are never affected by this
        // effect's dep-array re-registration cycles.

        // RUNTIME_CONTEXT_CHANGE: only update the context state.
        // The stable onDrawerOpen handler above already handles this — we must
        // NOT call handlePrompt here because that triggers full AI inference,
        // which causes the long loading delay and content flash the user sees.
        if (raw.type === "RUNTIME_CONTEXT_CHANGE") {
          console.warn("[ctx] RUNTIME_CONTEXT_CHANGE in volatile handler — context-only update (no inference)", { raw });
          return;
        }
      }

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
        // Only accept a "welcome" reset if the user has NOT already progressed past welcome.
        // Once didExitWelcomeRef is true, HANDOFF cannot flip them back to the landing page —
        // this blocks the STATE_SYNC→HANDOFF feedback loop that was causing constant resets.
        if (handoffState === "welcome" && !didExitWelcomeRef.current) {
          console.warn("[handoff] HANDOFF state=welcome accepted (user hasn't exited welcome yet)");
          setShowWelcome(true);
        } else if (handoffState === "welcome" && didExitWelcomeRef.current) {
          console.warn("[handoff] HANDOFF state=welcome BLOCKED — user already exited welcome, ignoring reset");
        }

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
        syncBrowserAaConfig(handoffContext);

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

      if (handleBrowserShellBridgeMessage(message)) {
        return;
      }

      if (message.type === "SELECTOR_CHANGE") {
        const aigentId = typeof payload.aigent_id === "string" ? payload.aigent_id : null;
        const llmId = typeof payload.llm_id === "string" ? payload.llm_id : null;
        applyShellSelectorChange(aigentId, llmId);
        return;
      }

      if (message.type === "MENU_ACTION") {
        const menuActionId =
          typeof payload.action_id === "string"
            ? payload.action_id
            : typeof payload.item_id === "string"
              ? payload.item_id
              : null;
        const DRAWER_ACTION_HANDLERS: Record<string, () => void> = {
          wallet:      () => setWalletDrawerOpen(true),
          settings:    () => setSettingsDrawerOpen(true),
          connections: () => setConnectionsDrawerOpen(true),
          memory:      () => setMemoryDrawerOpen(true),
          identity:    () => setIdentityIQubeOpen(true),
          persona:     () => setPersonaPickerOpen(true),
          // Make sub-actions — open cartridge overlays
          "make-create-design": () => setActiveCartridgeOverlay({ slug: 'metame',   title: 'metaMe Studio', initialTab: 'metame-studio'   }),
          "make-build":         () => setActiveCartridgeOverlay({ slug: 'aigentiq', title: 'AgentiQ OS',    initialTab: 'agentiq-os'       }),
          "make-remix":         () => setActiveCartridgeOverlay({ slug: 'aigentiq', title: 'iQube Registry', initialTab: 'registry-supply' }),
          // Play sub-actions
          "play-knyt": () => { setRuntimeContext('knyt'); refreshTakeover("toggle"); },
          // Share sub-actions — native share (no prompt, side-effect only)
          "share-refer": () => {
            const url = typeof window !== 'undefined' ? window.location.href : '';
            if (navigator.share) { void navigator.share({ title: 'Join me on metaMe', text: 'Explore your metaMe journey', url }); }
            else { void navigator.clipboard?.writeText(url); }
          },
        };
        if (menuActionId && menuActionId in DRAWER_ACTION_HANDLERS) {
          DRAWER_ACTION_HANDLERS[menuActionId]?.();
          return;
        }
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

      if (message.type === "RUNTIME_CONTEXT_CHANGE") {
        const ctx = payload.context === "knyt" ? "knyt" : "metame";
        setRuntimeContext(ctx);
        // Trigger the copilot to reframe within the new context.
        // The prevRuntimeContextRef effect fires after the state update and triggers refreshTakeover.
        void handlePrompt(
          ctx === "knyt"
            ? "I'd like to explore my KNYT journey"
            : "I'd like to return to my metaMe context",
          { source: "text_input", skipInference: false, explicitIntent: "play" }
        );
        return;
      }

      if (message.type === "LAUNCH_CARTRIDGE") {
        const cartridgeId = typeof payload.cartridge_id === "string" ? payload.cartridge_id : null;
        const codexId = typeof payload.codex_id === "string" ? payload.codex_id : cartridgeId;
        const rawSlug = codexId || cartridgeId;
        if (!rawSlug) return;
        const slug = rawSlug.replace(/-codex$/i, "");
        const title = slug.charAt(0).toUpperCase() + slug.slice(1);
        setActiveCartridgeOverlay({ slug, title });
        return;
      }

      if (message.type === "RESET_WELCOME") {
        void resetRuntime();
      }
    }

    window.addEventListener("message", onShellMessage);

    // NOTE: pre-bootstrap buffer is drained by the stable onDrawerOpen effect above.
    // Calling _drainEarlyCapture here would be a no-op (buffer already empty + capture
    // listener already removed) but is safe to skip.

    // Emit RUNTIME_READY immediately so the shell knows the runtime is live.
    // We also emit it again in response to SHELL_READY (idempotent via runtimeReadyPostedRef)
    // but this early emission handles the case where SHELL_READY arrived before us.
    try {
      window.parent.postMessage(
        { type: "RUNTIME_READY", source: "runtime", state: showWelcome ? "welcome" : "post_welcome" },
        "*"
      );
    } catch { /* not in an iframe — safe to ignore */ }

    // Platform sidebar fires this custom event for the persona iQube links
    function onOpenPersonaIQube(e: Event) {
      const t = (e as CustomEvent<{ type: string }>).detail?.type;
      if (t === "knyt" || t === "qripto") setPersonaIQubeDrawer(t);
    }
    window.addEventListener("open-persona-iqube", onOpenPersonaIQube);

    return () => {
      window.removeEventListener("message", onShellMessage);
      window.removeEventListener("open-persona-iqube", onOpenPersonaIQube);
    };
  }, [
    activeDevice,
    applyShellSelectorChange,
    embedMode,
    handlePrompt,
    postRuntimeEvent,
    resetRuntime,
    setActiveCartridgeOverlay,
    setRuntimeContext,
    showWelcome,
    thinShellMode,
    relayCloseCodexToNestedFrames,
    flushQueuedRuntimeEvents,
    handleBrowserShellBridgeMessage,
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
      runtime_context: runtimeContext,
    });

    if (previousWelcomeRef.current && !showWelcome) {
      postRuntimeEvent("WELCOME_COMPLETE", {
        state: "post_welcome",
        intent: lastIntent,
        device: activeDevice,
      });
    }

    previousWelcomeRef.current = showWelcome;
  }, [activeDevice, embedMode, isRuntimeFullscreen, lastIntent, postRuntimeEvent, runtimeContext, runtimeProcessing, showWelcome, thinShellMode]);

  useEffect(() => {
    if (!embedMode) return;
    postRuntimeEvent("STATE_SYNC", {
      active_experience: resolveRuntimeExperienceShellState(activeRuntimeExperience),
    });
  }, [activeRuntimeExperience, embedMode, postRuntimeEvent]);

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

  const renderIndicatorDots = (value: number, type: "trust" | "reliability", isProcessing?: boolean) => {
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
          return (
            <span
              key={`${type}-${index}`}
              className={`h-1.5 w-1.5 rounded-full ${active ? activeClass : "bg-slate-600"} ${
                isProcessing ? "animate-pulse transition-all duration-700" : "transition-all duration-300"
              }`}
              style={isProcessing ? { animationDelay: `${index * 0.15}s` } : undefined}
            />
          );
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
          <div className="relative flex flex-col items-center gap-0.5">
            {/* Be floating quick-links sub-menu */}
            {beMenuOpen && (
              <>
                <div className="fixed inset-0 z-[45]" onClick={() => setBeMenuOpen(false)} />
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-[46] flex flex-col gap-1 bg-slate-900/95 border border-white/10 rounded-xl p-2 shadow-2xl backdrop-blur-xl min-w-[120px]">
                  {[
                    { icon: <Users className="h-4 w-4" />, label: "Persona", action: () => { setPersonaPickerOpen(true); setBeMenuOpen(false); } },
                    { icon: <Fingerprint className="h-4 w-4" />, label: "Identity", action: () => { setIdentityIQubeOpen(true); setBeMenuOpen(false); } },
                    { icon: <SlidersHorizontal className="h-4 w-4" />, label: "Settings", action: () => { setSettingsDrawerOpen(true); setBeMenuOpen(false); } },
                    { icon: <Sparkles className="h-4 w-4" />, label: "Memory", action: () => { setMemoryDrawerOpen(true); setBeMenuOpen(false); } },
                    { icon: <Network className="h-4 w-4" />, label: "Connections", action: () => { setConnectionsDrawerOpen(true); setBeMenuOpen(false); } },
                  ].map(({ icon, label, action }) => (
                    <button key={label} type="button" onClick={action}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-white/10 hover:text-white transition w-full text-left">
                      <span className="text-cyan-400">{icon}</span>{label}
                    </button>
                  ))}
                </div>
              </>
            )}
            <button
              type="button"
              onClick={() => { handleRuntimeMenuIntent("be", "I want to be..."); setBeMenuOpen(prev => !prev); }}
              className={menuButtonClass("be")}
              title="I want to be..."
              aria-pressed={lastIntent === "be"}
            >
              <Users className="h-4 w-4 text-slate-200" />
              Be
            </button>
          </div>
          <div className="relative">
            {earnMenuOpen && (
              <>
                <div className="fixed inset-0 z-[45]" onClick={() => setEarnMenuOpen(false)} />
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-[46] flex flex-col gap-1 bg-slate-900/95 border border-white/10 rounded-xl p-2 shadow-2xl backdrop-blur-xl min-w-[130px]">
                  {[
                    { label: "Goal",   action: () => { handleRuntimeMenuIntent("earn", "Show me my onboarding journey goals and first tasks."); setEarnMenuOpen(false); } },
                    { label: "Task",   action: () => { setWalletInitialTab("tasks");    setWalletDrawerOpen(true); setEarnMenuOpen(false); } },
                    { label: "Wallet", action: () => { setWalletInitialTab("wallet");   setWalletDrawerOpen(true); setEarnMenuOpen(false); } },
                    { label: "Reward", action: () => { setWalletInitialTab("rewards");  setWalletDrawerOpen(true); setEarnMenuOpen(false); } },
                    { label: "Offer",  action: () => { setWalletInitialTab("payments"); setWalletDrawerOpen(true); setEarnMenuOpen(false); } },
                  ].map(({ label, action }) => (
                    <button key={label} type="button" onClick={action}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-white/10 hover:text-white transition w-full text-left">
                      <Coins className="h-3.5 w-3.5 text-emerald-400" />{label}
                    </button>
                  ))}
                </div>
              </>
            )}
            <button
              type="button"
              onClick={() => { handleRuntimeMenuIntent("earn", "How can I earn..."); setEarnMenuOpen(prev => !prev); }}
              className={menuButtonClass("earn")}
              title="How can I earn..."
              aria-pressed={lastIntent === "earn"}
            >
              <Coins className="h-5 w-5 text-emerald-300" />
              Earn
            </button>
          </div>
          <div className="relative flex flex-col items-center gap-0.5">
            {playMenuOpen && (
              <>
                <div className="fixed inset-0 z-[45]" onClick={() => setPlayMenuOpen(false)} />
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-[46] flex flex-col gap-1 bg-slate-900/95 border border-white/10 rounded-xl p-2 shadow-2xl backdrop-blur-xl min-w-[120px]">
                  <button type="button" onClick={() => { handleRuntimeMenuIntent("play", "I'd like to watch experiences."); setPlayMenuOpen(false); }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-white/10 hover:text-white transition w-full text-left">
                    <Tv className="h-3.5 w-3.5 text-cyan-400" />Watch
                  </button>
                  <button type="button" onClick={() => { handleRuntimeMenuIntent("play", "I'd like to listen to audio-first experiences."); setPlayMenuOpen(false); }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-white/10 hover:text-white transition w-full text-left">
                    <Headphones className="h-3.5 w-3.5 text-cyan-400" />Listen
                  </button>
                  <button type="button" onClick={() => { setRuntimeContext('knyt'); handleRuntimeMenuIntent("play", "I'd like to explore my KNYT journey."); setPlayMenuOpen(false); }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-white/10 hover:text-white transition w-full text-left">
                    <Moon className="h-3.5 w-3.5 text-cyan-400" />KNYT
                  </button>
                </div>
              </>
            )}
            <button
              type="button"
              onClick={() => { handleRuntimeMenuIntent("play", "I'd like to play experiences."); setPlayMenuOpen(prev => !prev); }}
              className={menuButtonClass("play")}
              title="I'd like to play experiences."
              aria-pressed={lastIntent === "play"}
            >
              <PlayCircle className="h-5 w-5 text-cyan-300" />
              Play
            </button>
          </div>
          <div className="relative flex flex-col items-center gap-0.5">
            {makeMenuOpen && (
              <>
                <div className="fixed inset-0 z-[45]" onClick={() => setMakeMenuOpen(false)} />
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-[46] flex flex-col gap-1 bg-slate-900/95 border border-white/10 rounded-xl p-2 shadow-2xl backdrop-blur-xl min-w-[140px]">
                  <button type="button" onClick={() => { setActiveCartridgeOverlay({ slug: 'metame', title: 'metaMe Studio', initialTab: 'metame-studio' }); setMakeMenuOpen(false); }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-white/10 hover:text-white transition w-full text-left">
                    <Sparkles className="h-3.5 w-3.5 text-purple-400" />Create &amp; Design
                  </button>
                  <button type="button" onClick={() => { setActiveCartridgeOverlay({ slug: 'aigentiq', title: 'AgentiQ OS', initialTab: 'agentiq-os' }); setMakeMenuOpen(false); }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-white/10 hover:text-white transition w-full text-left">
                    <Hexagon className="h-3.5 w-3.5 text-purple-400" />Build
                  </button>
                  <button type="button" onClick={() => { setActiveCartridgeOverlay({ slug: 'aigentiq', title: 'iQube Registry', initialTab: 'registry-supply' }); setMakeMenuOpen(false); }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-white/10 hover:text-white transition w-full text-left">
                    <RotateCcw className="h-3.5 w-3.5 text-purple-400" />Remix
                  </button>
                </div>
              </>
            )}
            <button
              type="button"
              onClick={() => { handleRuntimeMenuIntent("make", "I want to make..."); setMakeMenuOpen(prev => !prev); }}
              className={menuButtonClass("make")}
              title="I want to make..."
              aria-pressed={lastIntent === "make"}
            >
              <Pencil className="h-5 w-5 text-purple-300" />
              Make
            </button>
          </div>
          <div className="relative flex flex-col items-center gap-0.5">
            {shareMenuOpen && (
              <>
                <div className="fixed inset-0 z-[45]" onClick={() => setShareMenuOpen(false)} />
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-[46] flex flex-col gap-1 bg-slate-900/95 border border-white/10 rounded-xl p-2 shadow-2xl backdrop-blur-xl min-w-[130px]">
                  <button type="button" onClick={() => { handleRuntimeMenuIntent("share", "Send a direct message via QubeTalk."); setShareMenuOpen(false); }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-white/10 hover:text-white transition w-full text-left">
                    <Send className="h-3.5 w-3.5 text-slate-400" />Message
                  </button>
                  <button type="button" onClick={() => { handleRuntimeMenuIntent("share", "Invite someone to a shared QubeTalk environment."); setShareMenuOpen(false); }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-white/10 hover:text-white transition w-full text-left">
                    <Users className="h-3.5 w-3.5 text-slate-400" />Invite
                  </button>
                  <button type="button" onClick={() => {
                    const url = typeof window !== 'undefined' ? window.location.href : '';
                    if (navigator.share) { void navigator.share({ title: 'Join me on metaMe', text: 'Explore your metaMe journey', url }); }
                    else { void navigator.clipboard?.writeText(url); }
                    setShareMenuOpen(false);
                  }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-white/10 hover:text-white transition w-full text-left">
                    <Share2 className="h-3.5 w-3.5 text-slate-400" />Refer
                  </button>
                </div>
              </>
            )}
            <button
              type="button"
              onClick={() => { handleRuntimeMenuIntent("share", "Help me share my experiences."); setShareMenuOpen(prev => !prev); }}
              className={menuButtonClass("share")}
              title="Share experiences and invite collaborators."
              aria-pressed={lastIntent === "share"}
            >
              <Users className="h-4 w-4 text-slate-200" />
              Share
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between px-4">
          <div className="relative flex flex-col items-center gap-0.5">
            {/* Be floating quick-links sub-menu (desktop) — shared state with mobile */}
            {beMenuOpen && (
              <>
                <div className="fixed inset-0 z-[45]" onClick={() => setBeMenuOpen(false)} />
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-[46] flex flex-col gap-1 bg-slate-900/95 border border-white/10 rounded-xl p-2 shadow-2xl backdrop-blur-xl min-w-[130px]">
                  {[
                    { icon: <Users className="h-4 w-4" />, label: "Persona", action: () => { setPersonaPickerOpen(true); setBeMenuOpen(false); } },
                    { icon: <Fingerprint className="h-4 w-4" />, label: "Identity", action: () => { setIdentityIQubeOpen(true); setBeMenuOpen(false); } },
                    { icon: <SlidersHorizontal className="h-4 w-4" />, label: "Settings", action: () => { setSettingsDrawerOpen(true); setBeMenuOpen(false); } },
                    { icon: <Sparkles className="h-4 w-4" />, label: "Memory", action: () => { setMemoryDrawerOpen(true); setBeMenuOpen(false); } },
                    { icon: <Network className="h-4 w-4" />, label: "Connections", action: () => { setConnectionsDrawerOpen(true); setBeMenuOpen(false); } },
                  ].map(({ icon, label, action }) => (
                    <button key={label} type="button" onClick={action}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-white/10 hover:text-white transition w-full text-left">
                      <span className="text-cyan-400">{icon}</span>{label}
                    </button>
                  ))}
                </div>
              </>
            )}
            <button
              type="button"
              onClick={() => { handleRuntimeMenuIntent("be", "I want to be..."); setBeMenuOpen(prev => !prev); }}
              className={menuButtonClass("be")}
              title="I want to be..."
              aria-pressed={lastIntent === "be"}
            >
              <Users className="h-4 w-4 text-slate-200" />
              Be
            </button>
          </div>
          <div className="flex flex-1 items-center justify-center gap-6">
            <div className="relative">
              {earnMenuOpen && (
                <>
                  <div className="fixed inset-0 z-[45]" onClick={() => setEarnMenuOpen(false)} />
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-[46] flex flex-col gap-1 bg-slate-900/95 border border-white/10 rounded-xl p-2 shadow-2xl backdrop-blur-xl min-w-[130px]">
                    {[
                      { label: "Goal",   action: () => { handleRuntimeMenuIntent("earn", "Show me my onboarding journey goals and first tasks."); setEarnMenuOpen(false); } },
                      { label: "Task",   action: () => { setWalletInitialTab("tasks");    setWalletDrawerOpen(true); setEarnMenuOpen(false); } },
                      { label: "Wallet", action: () => { setWalletInitialTab("wallet");   setWalletDrawerOpen(true); setEarnMenuOpen(false); } },
                      { label: "Reward", action: () => { setWalletInitialTab("rewards");  setWalletDrawerOpen(true); setEarnMenuOpen(false); } },
                      { label: "Offer",  action: () => { setWalletInitialTab("payments"); setWalletDrawerOpen(true); setEarnMenuOpen(false); } },
                    ].map(({ label, action }) => (
                      <button key={label} type="button" onClick={action}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-white/10 hover:text-white transition w-full text-left">
                        <Coins className="h-3.5 w-3.5 text-emerald-400" />{label}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <button
                type="button"
                onClick={() => { handleRuntimeMenuIntent("earn", "How can I earn..."); setEarnMenuOpen(prev => !prev); }}
                className={menuButtonClass("earn")}
                title="How can I earn..."
                aria-pressed={lastIntent === "earn"}
              >
                <Coins className="h-5 w-5 text-emerald-300" />
                Earn
              </button>
            </div>
            <div className="relative">
              {playMenuOpen && (
                <>
                  <div className="fixed inset-0 z-[45]" onClick={() => setPlayMenuOpen(false)} />
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-[46] flex flex-col gap-1 bg-slate-900/95 border border-white/10 rounded-xl p-2 shadow-2xl backdrop-blur-xl min-w-[120px]">
                    <button type="button" onClick={() => { handleRuntimeMenuIntent("play", "I'd like to watch experiences."); setPlayMenuOpen(false); }}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-white/10 hover:text-white transition w-full text-left">
                      <Tv className="h-3.5 w-3.5 text-cyan-400" />Watch
                    </button>
                    <button type="button" onClick={() => { handleRuntimeMenuIntent("play", "I'd like to listen to audio-first experiences."); setPlayMenuOpen(false); }}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-white/10 hover:text-white transition w-full text-left">
                      <Headphones className="h-3.5 w-3.5 text-cyan-400" />Listen
                    </button>
                    <button type="button" onClick={() => { setRuntimeContext('knyt'); handleRuntimeMenuIntent("play", "I'd like to explore my KNYT journey."); setPlayMenuOpen(false); }}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-white/10 hover:text-white transition w-full text-left">
                      <Moon className="h-3.5 w-3.5 text-cyan-400" />KNYT
                    </button>
                  </div>
                </>
              )}
              <button
                type="button"
                onClick={() => { handleRuntimeMenuIntent("play", "I'd like to play experiences."); setPlayMenuOpen(prev => !prev); }}
                className={menuButtonClass("play")}
                title="I'd like to play experiences."
                aria-pressed={lastIntent === "play"}
              >
                <PlayCircle className="h-5 w-5 text-cyan-300" />
                Play
              </button>
            </div>
            <div className="relative">
              {makeMenuOpen && (
                <>
                  <div className="fixed inset-0 z-[45]" onClick={() => setMakeMenuOpen(false)} />
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-[46] flex flex-col gap-1 bg-slate-900/95 border border-white/10 rounded-xl p-2 shadow-2xl backdrop-blur-xl min-w-[140px]">
                    <button type="button" onClick={() => { setActiveCartridgeOverlay({ slug: 'metame', title: 'metaMe Studio', initialTab: 'metame-studio' }); setMakeMenuOpen(false); }}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-white/10 hover:text-white transition w-full text-left">
                      <Sparkles className="h-3.5 w-3.5 text-purple-400" />Create &amp; Design
                    </button>
                    <button type="button" onClick={() => { setActiveCartridgeOverlay({ slug: 'aigentiq', title: 'AgentiQ OS', initialTab: 'agentiq-os' }); setMakeMenuOpen(false); }}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-white/10 hover:text-white transition w-full text-left">
                      <Hexagon className="h-3.5 w-3.5 text-purple-400" />Build
                    </button>
                    <button type="button" onClick={() => { setActiveCartridgeOverlay({ slug: 'aigentiq', title: 'iQube Registry', initialTab: 'registry-supply' }); setMakeMenuOpen(false); }}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-white/10 hover:text-white transition w-full text-left">
                      <RotateCcw className="h-3.5 w-3.5 text-purple-400" />Remix
                    </button>
                  </div>
                </>
              )}
              <button
                type="button"
                onClick={() => { handleRuntimeMenuIntent("make", "I want to make..."); setMakeMenuOpen(prev => !prev); }}
                className={menuButtonClass("make")}
                title="I want to make..."
                aria-pressed={lastIntent === "make"}
              >
                <Pencil className="h-5 w-5 text-purple-300" />
                Make
              </button>
            </div>
          </div>
          <div className="relative flex flex-col items-center gap-0.5">
            {shareMenuOpen && (
              <>
                <div className="fixed inset-0 z-[45]" onClick={() => setShareMenuOpen(false)} />
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-[46] flex flex-col gap-1 bg-slate-900/95 border border-white/10 rounded-xl p-2 shadow-2xl backdrop-blur-xl min-w-[130px]">
                  <button type="button" onClick={() => { handleRuntimeMenuIntent("share", "Send a direct message via QubeTalk."); setShareMenuOpen(false); }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-white/10 hover:text-white transition w-full text-left">
                    <Send className="h-3.5 w-3.5 text-slate-400" />Message
                  </button>
                  <button type="button" onClick={() => { handleRuntimeMenuIntent("share", "Invite someone to a shared QubeTalk environment."); setShareMenuOpen(false); }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-white/10 hover:text-white transition w-full text-left">
                    <Users className="h-3.5 w-3.5 text-slate-400" />Invite
                  </button>
                  <button type="button" onClick={() => {
                    const url = typeof window !== 'undefined' ? window.location.href : '';
                    if (navigator.share) { void navigator.share({ title: 'Join me on metaMe', text: 'Explore your metaMe journey', url }); }
                    else { void navigator.clipboard?.writeText(url); }
                    setShareMenuOpen(false);
                  }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-white/10 hover:text-white transition w-full text-left">
                    <Share2 className="h-3.5 w-3.5 text-slate-400" />Refer
                  </button>
                </div>
              </>
            )}
            <button
              type="button"
              onClick={() => { handleRuntimeMenuIntent("share", "Help me share my experiences."); setShareMenuOpen(prev => !prev); }}
              className={menuButtonClass("share")}
              title="Share experiences and invite collaborators."
              aria-pressed={lastIntent === "share"}
            >
              <Users className="h-4 w-4 text-slate-200" />
              Share
            </button>
          </div>
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

  const themeToggle = (
    <button
      type="button"
      onClick={() => setRuntimeTheme((t) => (t === "light" ? "dark" : "light"))}
      className={`absolute right-3 top-[8px] z-30 inline-flex items-center justify-center rounded-lg border p-1.5 transition-colors ${
        runtimeTheme === "light"
          ? "border-[rgba(68,57,41,0.14)] bg-[#F7F2E8]/80 text-[#595247] hover:bg-[#ECE4D6]"
          : "border-white/10 bg-slate-950/80 text-slate-300 hover:bg-white/10 hover:text-white"
      }`}
      title={runtimeTheme === "light" ? "Switch to dark mode" : "Switch to light mode"}
    >
      {runtimeTheme === "light" ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
    </button>
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

  // The scroll area (CodexCopilotLayer) must fill the full viewport height so content
  // reaches all the way behind the floating overlay bar at the bottom.
  // disablePromptInput=true → resolvedFooterHeight=0 → scroll area bottom: 0.
  // The prompt input and runtimeMenu are rendered in a single absolute z-30 overlay that
  // sits on top of the scroll content in the z-axis, so the viewport "scrolls behind" them.
  const embedPreviewMode = embedMode && !!queryPreviewDisplayCapsule;
  const runtimeSurface = (
    <div className={`metame-runtime-layer relative h-full w-full ${runtimeTheme === "light" ? "mm-light" : "bg-slate-950 text-white"} overflow-hidden flex flex-col`}>
      <style jsx global>{`
        .copilotkit-launcher,
        .copilotkit-button,
        .copilotkit-floating-button {
          display: none !important;
        }
      `}</style>
      {!thinShellMode ? agentSelector : null}
      {themeToggle}
      <CodexCopilotLayer
        isOpen
        onClose={() => {}}
        variant="embedded"
        enableInferenceRendering
        panelClassName="w-full h-full"
        showNavMenu={false}
        showWalletMenu={false}
        panelBorder={false}
        messages={messages}
        onMessagesChange={setMessages}
        quickPrompts={[]}
        onPrompt={handlePrompt}
        floatingInput={false}
        disablePromptInput
        showTrustIndicators={!thinShellMode}
        isProcessing={runtimeProcessing}
        disableActivationButton
        showQuickPromptsToggle={false}
        trustProvider={trustProvider}
        className="flex-1 min-h-0"
      />
      <SmartWalletDrawer
        open={walletDrawerOpen}
        onClose={() => setWalletDrawerOpen(false)}
        variant="overlay"
        agent={{ id: activePersonaId || selectedAgent.id, name: selectedAgent.label }}
        personaId={activePersonaId || undefined}
        initialTab={walletInitialTab}
      />
      {/* Cartridge overlay — z-axis layer, no internal header (shell header carries the close button) */}
      {activeCartridgeOverlay != null && (
        <div className="absolute inset-0 z-[60]">
          <iframe
            src={`/triad/embed/codex/${activeCartridgeOverlay.slug}?theme=dark&closable=0${activeCartridgeOverlay.initialTab ? `&tab=${encodeURIComponent(activeCartridgeOverlay.initialTab)}` : ''}`}
            title={`${activeCartridgeOverlay.title} Cartridge`}
            className="h-full w-full border-0"
          />
        </div>
      )}
      {/* metaMe Settings — left-entering drawer (Be tab sub-item) */}
      {settingsDrawerOpen ? (
        <div
          className="absolute inset-0 z-40 bg-black/50"
          onClick={() => setSettingsDrawerOpen(false)}
        />
      ) : null}
      <div
        className={`absolute left-0 top-0 bottom-0 z-50 w-80 bg-slate-950 border-r border-white/10 overflow-y-auto transform transition-transform duration-300 ease-in-out ${settingsDrawerOpen ? "translate-x-0" : "-translate-x-full"}`}
        aria-hidden={!settingsDrawerOpen}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 sticky top-0 bg-slate-950 z-10">
          <span className="text-sm font-medium text-slate-200 flex items-center gap-2">
            <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" />
            metaMe Settings
          </span>
          <button
            type="button"
            onClick={() => setSettingsDrawerOpen(false)}
            className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white transition"
            aria-label="Close settings"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <MetaMeSettingsPanel personaId={activePersonaId ?? undefined} />
      </div>
      {/* iQube drawers (persona, identity, memory, connections, picker) are hoisted to iQubeDrawerLayer
          so they render over both the welcome screen and the runtime surface. */}
      {/* Absolute overlay: prompt bar (live view only) + runtimeMenu stacked at bottom */}
      {!thinShellMode ? (
        <div className="absolute inset-x-0 bottom-0 z-30 bg-slate-950/95 backdrop-blur-sm">
          {!embedPreviewMode ? (
            <div className="px-3 pt-2 pb-1">
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/80 px-3 py-1.5 shadow-lg backdrop-blur-xl">
                <input
                  type="text"
                  value={livePromptValue}
                  onChange={(e) => setLivePromptValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && livePromptValue.trim()) {
                      handlePrompt(livePromptValue, { source: "text_input" });
                      setLivePromptValue("");
                    }
                  }}
                  placeholder="What do you want to do today?"
                  className="flex-1 bg-transparent text-sm text-white placeholder-slate-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (livePromptValue.trim()) {
                      handlePrompt(livePromptValue, { source: "text_input" });
                      setLivePromptValue("");
                    }
                  }}
                  disabled={!livePromptValue.trim()}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cyan-500 text-white transition-colors hover:bg-cyan-600 disabled:bg-slate-700 disabled:text-slate-500"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ) : null}
          {runtimeMenu}
        </div>
      ) : null}
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
            {renderIndicatorDots(reliabilityScore, "reliability", runtimeProcessing)}
          </div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-white/70">
            <span className="text-[10px] text-white/60">T</span>
            {renderIndicatorDots(trustScore, "trust", runtimeProcessing)}
          </div>
        </div>
      ) : null}

      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
        {takeoverManifest && (
          <div className="w-full max-w-[760px]">
            <RuntimeTakeoverBanner
              manifest={takeoverManifest}
              cartridgeDisplayName={takeoverDisplayName}
              cartridgeContext={runtimeContext}
              onDismiss={dismissTakeover}
              onNextBestAction={(target, targetType) => {
                if (targetType === "codex") {
                  setActiveCartridgeOverlay({ slug: target, title: target });
                }
              }}
            />
          </div>
        )}
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

        {/* Takeover quick links — 3 context-specific action chips */}
        {takeoverManifest && (
          <div className="w-full max-w-[760px] flex flex-wrap gap-2">
            {runtimeContext === 'knyt' ? (
              <>
                <button
                  type="button"
                  onClick={() => void handlePrompt("I'd like to explore my KNYT journey.", { source: "quick_link", skipInference: true, explicitIntent: "play" })}
                  className="flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-200/80 hover:border-amber-500/40 hover:text-amber-100 transition-colors backdrop-blur-sm"
                >
                  <Compass className="h-3 w-3 shrink-0" />
                  Explore the KNYT World
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCartridgeOverlay({ slug: 'knyt-codex', title: 'KNYT Store', initialTab: 'store-episodes' })}
                  className="flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-200/80 hover:border-amber-500/40 hover:text-amber-100 transition-colors backdrop-blur-sm"
                >
                  <ShoppingBag className="h-3 w-3 shrink-0" />
                  Go to the KNYT Store
                </button>
                <button
                  type="button"
                  onClick={() => setWalletDrawerOpen(true)}
                  className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-white/60 hover:border-white/25 hover:text-white/90 transition-colors backdrop-blur-sm"
                >
                  <Wallet className="h-3 w-3 shrink-0" />
                  Sign in
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => void handlePrompt("help me find experiences.", { source: "quick_link", skipInference: true, explicitIntent: "find" })}
                  className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-[11px] text-emerald-200/80 hover:border-emerald-500/40 hover:text-emerald-100 transition-colors backdrop-blur-sm"
                >
                  <Sparkles className="h-3 w-3 shrink-0" />
                  Explore metaMe
                </button>
                {/* View metaMe cartridge: stub — hidden until runtime tab is built */}
                <button
                  type="button"
                  onClick={() => setWalletDrawerOpen(true)}
                  className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-white/60 hover:border-white/25 hover:text-white/90 transition-colors backdrop-blur-sm"
                >
                  <Wallet className="h-3 w-3 shrink-0" />
                  Sign in
                </button>
              </>
            )}
          </div>
        )}
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
      <SmartWalletDrawer
        open={walletDrawerOpen}
        onClose={() => setWalletDrawerOpen(false)}
        variant="overlay"
        agent={{ id: activePersonaId || selectedAgent.id, name: selectedAgent.label }}
        personaId={activePersonaId || undefined}
        initialTab={walletInitialTab}
      />
      {settingsDrawerOpen ? (
        <div
          className="absolute inset-0 z-40 bg-black/50"
          onClick={() => setSettingsDrawerOpen(false)}
        />
      ) : null}
      <div
        className={`absolute left-0 top-0 bottom-0 z-50 w-80 bg-slate-950 border-r border-white/10 overflow-y-auto transform transition-transform duration-300 ease-in-out ${settingsDrawerOpen ? "translate-x-0" : "-translate-x-full"}`}
        aria-hidden={!settingsDrawerOpen}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 sticky top-0 bg-slate-950 z-10">
          <span className="text-sm font-medium text-slate-200 flex items-center gap-2">
            <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" />
            metaMe Settings
          </span>
          <button
            type="button"
            onClick={() => setSettingsDrawerOpen(false)}
            className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white transition"
            aria-label="Close settings"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <MetaMeSettingsPanel personaId={activePersonaId ?? undefined} />
      </div>
    </div>
  );

  const runtimeDeviceWidthClass =
    activeDevice === "desktop"
      ? "mx-auto w-full max-w-[1240px]"
      : activeDevice === "tablet"
        ? "mx-auto w-full max-w-[860px]"
        : "mx-auto w-full max-w-[430px]";

  // iQube drawer layer — rendered outside the welcomeSurface/runtimeSurface toggle so
  // these drawers are always in the DOM regardless of showWelcome state.  Absolute
  // positioning scopes to the nearest positioned ancestor (relative outer containers below).
  const iQubeDrawerLayer = (
    <>
      {/* Persona iQube — left-entering drawer */}
      {personaIQubeDrawer && (
        <div className="absolute inset-0 z-[55] bg-black/50" onClick={() => setPersonaIQubeDrawer(null)} />
      )}
      <div
        className={`absolute left-0 top-0 bottom-0 z-[56] w-96 overflow-y-auto transform transition-transform duration-300 ease-in-out ${personaIQubeDrawer ? "translate-x-0" : "-translate-x-full"}`}
        aria-hidden={!personaIQubeDrawer}
      >
        {personaIQubeDrawer && (
          <PersonaIQubeDrawer type={personaIQubeDrawer} onClose={() => setPersonaIQubeDrawer(null)} />
        )}
      </div>
      {/* Identity iQube — left-entering drawer, z-[57] above persona */}
      {identityIQubeOpen && (
        <div className="absolute inset-0 z-[57] bg-black/50" onClick={() => setIdentityIQubeOpen(false)} />
      )}
      <div
        className={`absolute left-0 top-0 bottom-0 z-[58] w-96 overflow-y-auto transform transition-transform duration-300 ease-in-out ${identityIQubeOpen ? "translate-x-0" : "-translate-x-full"}`}
        aria-hidden={!identityIQubeOpen}
      >
        {identityIQubeOpen && <IdentityIQubeDrawer onClose={() => setIdentityIQubeOpen(false)} />}
      </div>
      {/* Memory iQube drawer */}
      <MemoryIQubeDrawer open={memoryDrawerOpen} onClose={() => setMemoryDrawerOpen(false)} />
      {/* Connections iQube drawer */}
      <ConnectionsIQubeDrawer open={connectionsDrawerOpen} onClose={() => setConnectionsDrawerOpen(false)} />
      {/* Persona picker — bottom sheet when no iqube_type specified */}
      {personaPickerOpen && (
        <>
          <div className="absolute inset-0 z-[60] bg-black/60 backdrop-blur-sm" onClick={() => setPersonaPickerOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 z-[61] flex flex-col gap-0 rounded-t-2xl border-t border-white/10 bg-slate-950 shadow-2xl pb-safe">
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Select Persona</span>
              <button type="button" onClick={() => setPersonaPickerOpen(false)} className="rounded-full p-1 text-slate-500 hover:text-white transition">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="flex flex-col gap-2 px-4 pb-6">
              {([
                { type: "knyt" as const, label: "KNYT Persona", description: "Your metaKnyt identity & character stats", color: "from-amber-500/20 to-yellow-500/10 border-amber-500/30 hover:border-amber-400/60" },
                { type: "qripto" as const, label: "Qripto Persona", description: "Your Qriptopian reader identity & collections", color: "from-cyan-500/20 to-blue-500/10 border-cyan-500/30 hover:border-cyan-400/60" },
              ]).map(({ type, label, description, color }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => { setPersonaIQubeDrawer(type); setPersonaPickerOpen(false); }}
                  className={`flex items-center gap-4 rounded-xl border bg-gradient-to-r p-4 text-left transition-all duration-150 ${color}`}
                >
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/10">
                    <Users className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{label}</div>
                    <div className="text-xs text-slate-400">{description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );

  if (embedMode) {
    const embedWidthClass = isRuntimeFullscreen || thinShellMode ? "w-full" : runtimeDeviceWidthClass;
    return (
      <div className={`relative h-full w-full bg-slate-950 p-0 ${embedWidthClass}`}>
        {showWelcome ? welcomeSurface : runtimeSurface}
        {iQubeDrawerLayer}
      </div>
    );
  }

  if (isRuntimeFullscreen) {
    return (
      <div className="fixed inset-0 z-[120] bg-slate-950 p-0 relative">
        <div className={`h-full ${runtimeDeviceWidthClass}`}>{showWelcome ? welcomeSurface : runtimeSurface}</div>
        {iQubeDrawerLayer}
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

  // Non-embed queryPreviewDisplayCapsule falls through to the PreviewFrame path below,
  // which shows runtimeSurface (CodexCopilotLayer with full header/footer shell). The
  // auto-launch effect adds the experience content as messages inside the shell.

  return (
    <div className="min-h-screen bg-slate-950 text-white px-4 py-6">
      <div className="relative mx-auto w-full h-[760px]">
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
        {iQubeDrawerLayer}
      </div>
    </div>
  );
}
