"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CodexCopilotLayer, type CopilotMessage } from "@/app/components/codex/CodexCopilotLayer";
import SmartContentCard from "@/app/components/content/SmartContentCard";
import { PreviewFrame } from "@/components/preview/PreviewFrame";
import { DevicePreviewSwitcher, type DeviceType } from "@/components/preview/DevicePreviewSwitcher";
import { useToast } from "@/components/ui/toaster";
import {
  BookOpen,
  Bot,
  ChevronDown,
  Coins,
  Compass,
  Headphones,
  Hexagon,
  Pencil,
  PlayCircle,
  Send,
  Tv,
  Users,
} from "lucide-react";
import type { SmartContentQube } from "@/types/smartContent";

type RuntimeIntent = "watch" | "listen" | "read" | "play" | "find" | "earn" | "make" | "be";

type RuntimeAgent = {
  id: string;
  label: string;
  colorClass: string;
};

const RUNTIME_AGENTS: RuntimeAgent[] = [
  { id: "aigent-z", label: "Aigent Z", colorClass: "text-cyan-300" },
  { id: "aigent-kn0w1", label: "Kn0w1", colorClass: "text-emerald-300" },
  { id: "aigent-moneypenny", label: "MoneyPenny", colorClass: "text-violet-300" },
  { id: "aigent-nakamoto", label: "Nakamoto", colorClass: "text-amber-300" },
  { id: "aigent-marketa", label: "Marketa", colorClass: "text-rose-300" },
];

const DEFAULT_CONTENTS: SmartContentQube[] = [
  {
    id: "capsule-qriptopian-read",
    type: "SmartContentQube",
    app: "Qriptopian",
    title: "metaKnyts QriptoGraphic Novel (…",
    slug: "read-qriptopian",
    version: 1,
    description: "Launch an immersive article experience from the Qriptopian codex.",
    coverImageUri: "",
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
  } as unknown as SmartContentQube,
  {
    id: "capsule-metaknyt-play",
    type: "SmartContentQube",
    app: "metaKnyts",
    title: "21 Awakenings Overview",
    slug: "play-metaknyt",
    version: 1,
    description: "Jump into an episode experience with smart modules and rewards.",
    coverImageUri: "",
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
  } as unknown as SmartContentQube,
  {
    id: "capsule-earn-reward",
    type: "SmartContentQube",
    app: "AgentiQ",
    title: "The Clip That Sold Itself",
    slug: "earn-rewards",
    version: 1,
    description: "Complete a short task flow to earn Q and unlock content.",
    coverImageUri: "",
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
  } as unknown as SmartContentQube,
];

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

function modalityEnabled(content: SmartContentQube, intent: RuntimeIntent): boolean {
  if (intent === "watch") return Boolean(content.modalities?.watch?.enabled);
  if (intent === "listen") return Boolean(content.modalities?.listen?.enabled);
  if (intent === "read") return Boolean(content.modalities?.read?.enabled);
  if (intent === "play") return Boolean(content.modalities?.interact?.enabled);
  if (intent === "earn") {
    const pricing = content.pricingModel?.tiers?.[0]?.kind;
    return pricing !== "free";
  }
  return true;
}

function scoreContent(content: SmartContentQube, prompt: string, intent: RuntimeIntent): number {
  let score = 0;
  if (modalityEnabled(content, intent)) score += 5;
  const searchable = `${content.title} ${content.description} ${content.slug} ${content.libraryMetadata?.tags?.join(" ") || ""}`.toLowerCase();
  const words = prompt.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2);
  for (const word of words) {
    if (searchable.includes(word)) score += 1;
  }
  return score;
}

function toSmartContentFromExperience(raw: any): SmartContentQube {
  const config = raw?.configuration || {};
  const modalityFlags = config?.modalities || {};
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
    coverImageUri: "",
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
  } as unknown as SmartContentQube;
}

function toSmartContentFromRegistry(raw: any): SmartContentQube {
  return {
    ...raw,
    libraryMetadata: {
      ...(raw?.libraryMetadata || {}),
      tags: [...(raw?.libraryMetadata?.tags || []), "capsule"],
    },
  } as SmartContentQube;
}

export default function MetaMeRuntimeClient() {
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const embedMode = searchParams?.get("embed") === "1";
  const selectedCapsuleId = searchParams?.get("capsule");
  const deviceParam = (searchParams?.get("device") as DeviceType) || "mobile";
  const defaultDevice: DeviceType =
    deviceParam === "desktop" || deviceParam === "tablet" || deviceParam === "mobile" ? deviceParam : "mobile";
  const isMobileLayout = defaultDevice === "mobile";

  const [selectedAgent, setSelectedAgent] = useState<RuntimeAgent>(RUNTIME_AGENTS[0]);
  const [showAgentSelector, setShowAgentSelector] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [welcomePrompt, setWelcomePrompt] = useState("");
  const [showWelcomeQuickLinks, setShowWelcomeQuickLinks] = useState(false);
  const quickLinksHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [channels, setChannels] = useState<Array<{ channel_id: string; participants: string[] }>>([]);
  const [channelsLoading, setChannelsLoading] = useState(false);

  const [allContents, setAllContents] = useState<SmartContentQube[]>(DEFAULT_CONTENTS);
  const [capsuleContents, setCapsuleContents] = useState<SmartContentQube[]>(DEFAULT_CONTENTS);
  const [selectedCapsuleLocal, setSelectedCapsuleLocal] = useState<string | null>(null);
  const activeCapsuleId = selectedCapsuleLocal || selectedCapsuleId;

  useEffect(() => {
    let active = true;
    const fetchRuntimeData = async () => {
      try {
        const [experienceRes, smartRes] = await Promise.allSettled([
          fetch("/api/composer/experiences?limit=40", { cache: "no-store" }),
          fetch("/api/content/smart?status=published&limit=40", { cache: "no-store" }),
        ]);

        const experienceRows: any[] =
          experienceRes.status === "fulfilled" && experienceRes.value.ok
            ? ((await experienceRes.value.json())?.experience_qubes || [])
            : [];

        const smartRows: any[] =
          smartRes.status === "fulfilled" && smartRes.value.ok
            ? ((await smartRes.value.json())?.data || [])
            : [];

        const next = [
          ...experienceRows.map(toSmartContentFromExperience),
          ...smartRows.map(toSmartContentFromRegistry),
        ];

        if (!active) return;
        if (next.length > 0) {
          setAllContents(next);
          setCapsuleContents(next.slice(0, 6));
        }
      } catch {
        if (!active) return;
        setAllContents(DEFAULT_CONTENTS);
        setCapsuleContents(DEFAULT_CONTENTS);
      }
    };
    fetchRuntimeData();
    return () => {
      active = false;
    };
  }, []);

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

  const capsulePanel = useMemo(
    () => (
      <div className="space-y-3">
        <div className="overflow-x-auto pb-1 no-scrollbar">
          <div className="flex snap-x snap-mandatory gap-3">
          {capsuleContents.map((content) => (
            <div key={content.id} className="snap-start shrink-0 basis-[78%] min-w-[280px] max-w-[360px] h-[172px] [&>button]:h-full">
              <SmartContentCard
                content={content}
                variant="compact"
                showProgress
                progressPercentage={/awakenings|play|episode/i.test(content.title) ? 33 : 0}
                isSelected={content.id === activeCapsuleId}
                onOpen={() => {
                  setSelectedCapsuleLocal(content.id);
                  setMessages((prev) => [
                    ...prev,
                    {
                      id: `open-${Date.now()}`,
                      role: "assistant",
                      content: `Opening ${content.title}.`,
                      timestamp: new Date(),
                    },
                  ]);
                }}
                onPreview={() => {
                  setSelectedCapsuleLocal(content.id);
                  toast(`Previewing "${content.title}"`, "info");
                }}
                onShare={() => {
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
              />
            </div>
          ))}
          </div>
        </div>
      </div>
    ),
    [activeCapsuleId, buildSharePanel, capsuleContents, toast]
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

  const handlePrompt = useCallback(
    (prompt: string) => {
      const trimmed = prompt.trim();
      if (!trimmed) return;

      const intent = inferIntent(trimmed);
      const ranked = [...allContents]
        .map((content) => ({ content, score: scoreContent(content, trimmed, intent) }))
        .sort((a, b) => b.score - a.score)
        .map((row) => row.content);

      setCapsuleContents((ranked.length > 0 ? ranked : DEFAULT_CONTENTS).slice(0, 6));
      setShowWelcome(false);
      setWelcomePrompt("");
      setMessages([
        {
          id: `intent-msg-${Date.now()}`,
          role: "assistant",
          content: `Opening ${intent} experiences.`,
          timestamp: new Date(),
        },
        {
          id: "capsule-panel",
          role: "assistant",
          content: capsulePanel,
          timestamp: new Date(),
          variant: "panel",
        },
      ]);
    },
    [allContents, capsulePanel]
  );

  const quickPrompts = useMemo(
    () => [
      {
        label: "I'd like to watch experiences.",
        prompt: "I'd like to watch experiences.",
        icon: <Tv className="h-4 w-4" />,
        iconOnly: true,
      },
      {
        label: "I'd like to play experiences.",
        prompt: "I'd like to play experiences.",
        icon: <PlayCircle className="h-4 w-4" />,
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
    ],
    []
  );

  const menuButtonClass =
    "flex flex-col items-center rounded-md px-2 py-1 text-[11px] text-slate-300 transition hover:bg-white/10 hover:text-white";

  const runtimeMenu = (
    <div className="border-t border-white/10 bg-white/[0.03] pt-3">
      {isMobileLayout ? (
        <div className="flex items-center justify-between px-4">
          <button type="button" onClick={() => handlePrompt("I want to be...")} className={menuButtonClass} title="I want to be...">
            <Users className="h-4 w-4 text-slate-200" />
            Be
          </button>
          <button type="button" onClick={() => handlePrompt("How can I earn...")} className={menuButtonClass} title="How can I earn...">
            <Coins className="h-5 w-5 text-emerald-300" />
            Earn
          </button>
          <button
            type="button"
            onClick={() => handlePrompt("I'd like to play experiences.")}
            className={menuButtonClass}
            title="I'd like to play experiences."
          >
            <PlayCircle className="h-5 w-5 text-cyan-300" />
            Play
          </button>
          <button type="button" onClick={() => handlePrompt("I want to make...")} className={menuButtonClass} title="I want to make...">
            <Pencil className="h-5 w-5 text-purple-300" />
            Make
          </button>
          <button
            type="button"
            onClick={() => handlePrompt("Help me find experiences to share.")}
            className={menuButtonClass}
            title="Help me find experiences to share."
          >
            <Users className="h-4 w-4 text-slate-200" />
            Share
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between px-4">
          <button type="button" onClick={() => handlePrompt("I want to be...")} className={menuButtonClass} title="I want to be...">
            <Users className="h-4 w-4 text-slate-200" />
            Be
          </button>
          <div className="flex flex-1 items-center justify-center gap-12">
            <button type="button" onClick={() => handlePrompt("How can I earn...")} className={menuButtonClass} title="How can I earn...">
              <Coins className="h-5 w-5 text-emerald-300" />
              Earn
            </button>
            <button
              type="button"
              onClick={() => handlePrompt("I'd like to play experiences.")}
              className={menuButtonClass}
              title="I'd like to play experiences."
            >
              <PlayCircle className="h-5 w-5 text-cyan-300" />
              Play
            </button>
            <button type="button" onClick={() => handlePrompt("I want to make...")} className={menuButtonClass} title="I want to make...">
              <Pencil className="h-5 w-5 text-purple-300" />
              Make
            </button>
          </div>
          <button
            type="button"
            onClick={() => handlePrompt("Help me find experiences to share.")}
            className={menuButtonClass}
            title="Help me find experiences to share."
          >
            <Users className="h-4 w-4 text-slate-200" />
            Share
          </button>
        </div>
      )}
    </div>
  );

  const agentSelector = (
    <div className="absolute left-3 top-[8px] z-30">
      <button
        onClick={() => setShowAgentSelector((prev) => !prev)}
        className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-slate-950/80 px-2 py-1.5 text-[11px] text-slate-200"
        title="Select Aigent"
      >
        <Bot className={`h-4 w-4 ${selectedAgent.colorClass}`} />
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </button>
      {showAgentSelector && (
        <div className="absolute left-0 top-full mt-1 min-w-[170px] rounded-xl border border-white/10 bg-slate-950/95 p-1.5 backdrop-blur-xl">
          {RUNTIME_AGENTS.map((agent) => (
            <button
              key={agent.id}
              onClick={() => {
                setSelectedAgent(agent);
                setShowAgentSelector(false);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-slate-200 hover:bg-white/10"
            >
              <Bot className={`h-4 w-4 ${agent.colorClass}`} />
              <span>{agent.label}</span>
            </button>
          ))}
        </div>
      )}
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
      {agentSelector}
      <CodexCopilotLayer
        isOpen
        onClose={() => {}}
        variant="embedded"
        panelClassName="w-full h-full"
        showNavMenu={false}
        showWalletMenu={false}
        panelBorder={false}
        promptPlaceholder="What do you want to do today?"
        messages={messages}
        onMessagesChange={setMessages}
        quickPrompts={quickPrompts}
        onPrompt={handlePrompt}
        footerContent={runtimeMenu}
        floatingInput
        disableActivationButton
        className="h-full"
      />
    </div>
  );

  const welcomeQuickLinks = (
    <div
      className={`absolute left-3 right-3 bottom-[70px] transition-opacity duration-200 ${
        showWelcomeQuickLinks ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
    >
      <div className="mx-auto flex w-full items-center justify-between rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-2">
        {quickPrompts.map((promptItem, index) => (
          <button
            key={`welcome-quick-${index}`}
            title={promptItem.label}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-white/70 transition hover:border-white/30 hover:text-white"
            onClick={() => handlePrompt(promptItem.prompt ?? promptItem.label)}
          >
            {promptItem.icon}
          </button>
        ))}
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

  const welcomeSurface = (
    <div className="relative h-full w-full rounded-[5px] bg-slate-950 text-white overflow-hidden flex flex-col">
      {agentSelector}
      <div className="h-[44px] flex items-center justify-end gap-4 border-b border-white/10 bg-white/[0.03] px-4 pr-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-white/70">
          <span className="text-[10px] text-white/60">R</span>
          <div className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
            <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
            <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
            <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
            <span className="h-1.5 w-1.5 rounded-full bg-slate-600" />
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-white/70">
          <span className="text-[10px] text-white/60">T</span>
          <div className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
            <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
            <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
            <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
            <span className="h-1.5 w-1.5 rounded-full bg-slate-600" />
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6">
        <form
          className="w-full max-w-[760px]"
          onSubmit={(event) => {
            event.preventDefault();
            handlePrompt(welcomePrompt);
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

      <div
        className="relative px-3 pb-3"
        onMouseEnter={showQuickLinks}
        onMouseLeave={scheduleQuickLinksHide}
      >
        {welcomeQuickLinks}
        {runtimeMenu}
      </div>
    </div>
  );

  if (embedMode) {
    const embedWidthClass =
      defaultDevice === "desktop"
        ? "w-full"
        : defaultDevice === "tablet"
          ? "mx-auto w-full max-w-[860px]"
          : "mx-auto w-full max-w-[430px]";
    return (
      <div className="h-full w-full bg-slate-950 p-0">
        <div className={`h-full ${embedWidthClass}`}>{showWelcome ? welcomeSurface : runtimeSurface}</div>
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
