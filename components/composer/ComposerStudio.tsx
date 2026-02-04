"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, CheckCircle2, ChevronDown, ChevronUp, Circle, Hexagon, LayoutGrid, List, Loader2, Monitor, Moon, Palette, ShieldCheck, SlidersHorizontal, Sun } from "lucide-react";
import { useCopilotAction } from "@copilotkit/react-core";
import { Button } from "@/components/ui/button";
import { PreviewFrame } from "@/components/preview/PreviewFrame";
import { DevicePreviewSwitcher } from "@/components/preview/DevicePreviewSwitcher";
import type { DeviceType } from "@/components/preview/DevicePreviewSwitcher";
import { SmartTriadProvider } from "@/app/components/content";
import { agentConfigs } from "@/app/data/agentConfig";
import { liquidTemplateRegistry } from "@/app/triad/components/codex/liquidTemplates/registry";
import { resolveLiquidTemplateId } from "@/services/composer/composerRegistryMapping";
import type { SmartContentQube } from "@/types/smartContent";
import { useDesignQubeTheme } from "@/components/metame/useDesignQubeTheme";
import { useCodexList } from "@/app/hooks/useCodexConfig";
import type { CodexListItem } from "@/types/codex";
import type { DesignQube, DesignQubeThemeMode } from "@/types/designQube";
import { CodexCopilotLayer } from "@/app/components/codex/CodexCopilotLayer";

type ComposerField = {
  id: string;
  name: string;
  type: "text" | "select" | "multiselect" | "checkbox" | "slider" | "textarea";
  required: boolean;
  options?: Array<{ value: string; label: string; description?: string }>;
  validation?: { min?: number; max?: number; step?: number; pattern?: string };
  default_value?: any;
  help_text?: string;
};

type ComposerStep = {
  id: string;
  title: string;
  description: string;
  type: "selection" | "configuration" | "validation" | "preview";
  required: boolean;
  component_type?: "DataQube" | "ContentQube" | "ToolQube" | "ModelQube" | "AgentQube";
  ui_config: {
    layout: "wizard" | "form" | "grid" | "timeline";
    fields: ComposerField[];
  };
};

type ExperienceTemplate = {
  id: string;
  name: string;
  description: string;
  category: string;
  complexity: string;
  estimated_time: number;
  required_components: string[];
  optional_components: string[];
  steps: ComposerStep[];
  tags: string[];
};

type ComposerSession = {
  id: string;
  tenant_id: string;
  user_id: string;
  template_id: string;
  current_step: number;
  status: "active" | "completed" | "abandoned";
  data: Record<string, any>;
};

type ExperienceQube = {
  id: string;
  name: string;
  description: string;
  tenant_id: string;
  creator_id: string;
  template_id: string;
  status: string;
  metadata?: { tags?: string[]; category?: string; version?: string };
};

const DEFAULT_TENANT = "qripto-codex";
const DEFAULT_USER = "aigentz@aigent:u_demo_001";

const QRIPTO_FALLBACK_CODEXES = [
  { id: "knyt-codex", label: "KNYT Codex" },
  { id: "qripto-codex", label: "Qriptopian Codex" },
  { id: "aigentiq-codex", label: "AgentiQ Codex" },
  { id: "marketa-codex", label: "Aigent Marketa" },
  { id: "moneypenny-codex", label: "Aigent MoneyPenny" },
  { id: "nakamoto-codex", label: "Aigent Nakamoto" },
];

const QRIPTO_CONTENT_TAGS = [
  { value: "hero", label: "Hero Feature" },
  { value: "second-hero", label: "Second Hero" },
  { value: "latest-news", label: "Latest News" },
  { value: "penny-drops", label: "Penny Drops" },
  { value: "scrolls-metaknyts", label: "Scrolls: metaKnyts" },
  { value: "scrolls-synthsimms", label: "Scrolls: SynthSimms" },
  { value: "knowdz-exec", label: "Knowdz: Exec" },
  { value: "knowdz-creative", label: "Knowdz: Creative" },
  { value: "knowdz-devs", label: "Knowdz: Devs" },
];

const QRIPTO_CONTENT_ITEMS = [
  {
    id: "qripto-hero-1",
    label: "Hero Feature: The Genesis Block",
    tag: "hero",
    mediaType: "image",
    mediaUri: "",
  },
  {
    id: "qripto-news-1",
    label: "Latest News: Protocol Briefing",
    tag: "latest-news",
    mediaType: "image",
    mediaUri: "",
  },
  {
    id: "qripto-penny-1",
    label: "Penny Drops: Q¢ Explained",
    tag: "penny-drops",
    mediaType: "image",
    mediaUri: "",
  },
  {
    id: "qripto-scrolls-mk",
    label: "Scrolls: metaKnyts Micro-Episode",
    tag: "scrolls-metaknyts",
    mediaType: "video",
    mediaUri: "",
  },
  {
    id: "qripto-scrolls-ss",
    label: "Scrolls: SynthSimms Micro-Episode",
    tag: "scrolls-synthsimms",
    mediaType: "video",
    mediaUri: "",
  },
  {
    id: "qripto-knowdz-exec",
    label: "Knowdz Exec: Leadership Sprint",
    tag: "knowdz-exec",
    mediaType: "audio",
    mediaUri: "",
  },
  {
    id: "qripto-knowdz-creative",
    label: "Knowdz Creative: Concept Lab",
    tag: "knowdz-creative",
    mediaType: "audio",
    mediaUri: "",
  },
  {
    id: "qripto-knowdz-devs",
    label: "Knowdz Devs: Protocol Builder",
    tag: "knowdz-devs",
    mediaType: "audio",
    mediaUri: "",
  },
];

const QRIPTO_TEMPLATE_SEEDS: ExperienceTemplate[] = [
  {
    id: "qripto-micro-episode",
    name: "Micro-Episode Capsule",
    description: "7–20s episode clips with rewards, metaKnyts or SynthSimms.",
    category: "micro-episode",
    complexity: "beginner",
    estimated_time: 10,
    required_components: ["capsule", "media_clip"],
    optional_components: ["rewards", "share"],
    tags: ["micro-episode", "scrolls-metaknyts", "scrolls-synthsimms"],
    steps: [
      {
        id: "intent_timebox",
        title: "Intent + Timebox",
        description: "Define the micro-episode goal and timebox.",
        type: "selection",
        required: true,
        ui_config: {
          layout: "form",
          fields: [
            { id: "experience_name", name: "Experience name", type: "text", required: true },
            { id: "goal", name: "Goal", type: "textarea", required: false },
            { id: "time_available", name: "Time available (min)", type: "slider", required: false, validation: { min: 5, max: 20, step: 1 } },
          ],
        },
      },
      {
        id: "content_selection",
        title: "Content Selection",
        description: "Choose metaKnyts or SynthSimms episode material.",
        type: "selection",
        required: true,
        ui_config: {
          layout: "form",
          fields: [
            { id: "content_tag", name: "Scrolls Track", type: "select", required: true },
            { id: "content_items", name: "Content items", type: "multiselect", required: true },
          ],
        },
      },
      {
        id: "wallet_rewards",
        title: "Rewards (Optional)",
        description: "Configure optional rewards for completion.",
        type: "configuration",
        required: false,
        ui_config: {
          layout: "form",
          fields: [
            { id: "reward_amount", name: "Reward amount (Q¢)", type: "text", required: false },
            { id: "require_wallet_connect", name: "Require wallet connect", type: "checkbox", required: false },
          ],
        },
      },
    ],
  },
  {
    id: "qripto-feature-article",
    name: "Feature Article Experience",
    description: "Hero/Second Hero deep reads with optional companion capsules.",
    category: "article",
    complexity: "intermediate",
    estimated_time: 25,
    required_components: ["article_reader"],
    optional_components: ["capsule", "share"],
    tags: ["article", "hero", "second-hero", "latest-news"],
    steps: [
      {
        id: "content_selection",
        title: "Content Selection",
        description: "Select a feature article or latest news item.",
        type: "selection",
        required: true,
        ui_config: {
          layout: "form",
          fields: [
            { id: "content_tag", name: "Content Tag", type: "select", required: true },
            { id: "feature_item_id", name: "Feature item", type: "text", required: false },
            { id: "content_items", name: "Content items", type: "multiselect", required: true },
          ],
        },
      },
      {
        id: "wallet_rewards",
        title: "Rewards (Optional)",
        description: "Set optional reward after completion.",
        type: "configuration",
        required: false,
        ui_config: {
          layout: "form",
          fields: [
            { id: "reward_amount", name: "Reward amount (Q¢)", type: "text", required: false },
          ],
        },
      },
    ],
  },
  {
    id: "qripto-penny-drops",
    name: "Penny Drops Learning Flow",
    description: "Learning modules, guided explanations, and optional rewards.",
    category: "tutorial",
    complexity: "beginner",
    estimated_time: 20,
    required_components: ["lesson", "takeaways"],
    optional_components: ["rewards"],
    tags: ["tutorial", "penny-drops"],
    steps: [
      {
        id: "content_selection",
        title: "Learning Content",
        description: "Pick Penny Drops material or Knowdz training content.",
        type: "selection",
        required: true,
        ui_config: {
          layout: "form",
          fields: [
            { id: "content_tag", name: "Content Tag", type: "select", required: true },
            { id: "content_items", name: "Content items", type: "multiselect", required: true },
          ],
        },
      },
      {
        id: "copilot_output",
        title: "Copilot Takeaways",
        description: "Define summary/takeaway outputs.",
        type: "configuration",
        required: false,
        ui_config: {
          layout: "form",
          fields: [
            { id: "takeaways_count", name: "Takeaway count", type: "slider", required: false, validation: { min: 1, max: 6, step: 1 } },
          ],
        },
      },
    ],
  },
  {
    id: "qripto-knowdz-sprint",
    name: "Knowdz Specialist Sprint",
    description: "Exec/Creative/Dev focused micro-sprints.",
    category: "task",
    complexity: "intermediate",
    estimated_time: 30,
    required_components: ["task_list"],
    optional_components: ["rewards"],
    tags: ["task", "knowdz-exec", "knowdz-creative", "knowdz-devs"],
    steps: [
      {
        id: "content_selection",
        title: "Knowdz Track",
        description: "Choose Exec, Creative, or Dev track.",
        type: "selection",
        required: true,
        ui_config: {
          layout: "form",
          fields: [
            { id: "content_tag", name: "Knowdz Track", type: "select", required: true },
            { id: "content_items", name: "Content items", type: "multiselect", required: true },
          ],
        },
      },
      {
        id: "wallet_rewards",
        title: "Rewards (Optional)",
        description: "Configure optional rewards without gating access.",
        type: "configuration",
        required: false,
        ui_config: {
          layout: "form",
          fields: [
            { id: "reward_amount", name: "Reward amount (Q¢)", type: "text", required: false },
          ],
        },
      },
    ],
  },
  {
    id: "qripto-smart-offer",
    name: "Smart Wallet + Offer",
    description: "Offer flow with optional rewards and sharing.",
    category: "task",
    complexity: "intermediate",
    estimated_time: 15,
    required_components: ["offer", "consent"],
    optional_components: ["wallet", "receipt"],
    tags: ["offer", "wallet", "rewards"],
    steps: [
      {
        id: "intent_timebox",
        title: "Offer Intent",
        description: "Define the offer objective and duration.",
        type: "selection",
        required: true,
        ui_config: {
          layout: "form",
          fields: [
            { id: "experience_name", name: "Experience name", type: "text", required: true },
            { id: "time_available", name: "Time available (min)", type: "slider", required: false, validation: { min: 5, max: 30, step: 1 } },
          ],
        },
      },
      {
        id: "wallet_rewards",
        title: "Rewards",
        description: "Set optional reward (not required for access).",
        type: "configuration",
        required: false,
        ui_config: {
          layout: "form",
          fields: [
            { id: "reward_amount", name: "Reward amount (Q¢)", type: "text", required: false },
          ],
        },
      },
    ],
  },
];

export const ComposerStudio = () => {
  const router = useRouter();
  const [templates, setTemplates] = useState<ExperienceTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState(DEFAULT_TENANT);
  const [userId, setUserId] = useState(DEFAULT_USER);
  const [session, setSession] = useState<ComposerSession | null>(null);
  const [sessionTemplate, setSessionTemplate] = useState<ExperienceTemplate | null>(null);
  const [sessionData, setSessionData] = useState<Record<string, any>>({});
  const [stepData, setStepData] = useState<Record<string, Record<string, any>>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [experience, setExperience] = useState<ExperienceQube | null>(null);
  const [experiences, setExperiences] = useState<ExperienceQube[]>([]);
  const [designQube, setDesignQube] = useState<DesignQube | null>(null);
  const [designQubeLoading, setDesignQubeLoading] = useState(false);
  const [designQubeError, setDesignQubeError] = useState<string | null>(null);
  const [designTheme, setDesignTheme] = useState<DesignQubeThemeMode>("dark");
  const [designQubeCollapsed, setDesignQubeCollapsed] = useState(true);
  const [designQubeSummaryLayout, setDesignQubeSummaryLayout] = useState<"compact" | "grid">("compact");
  const [activeStyleQubeId, setActiveStyleQubeId] = useState("knyt-guidance-v1");
  const { data: codexList } = useCodexList({ useDefaults: true });
  const [copilotContextId, setCopilotContextId] = useState("qripto-codex");
  const [codexContentItems, setCodexContentItems] = useState<
    Array<{ id: string; label: string; tag: string; mediaType: string; mediaUri: string }>
  >([]);
  const [codexContentLoading, setCodexContentLoading] = useState(false);

  const styleQubeThemeTokens = designQube?.tokens?.themes?.[designTheme];
  const styleQubeColors = styleQubeThemeTokens?.color || {};
  const styleQubeThemeBg =
    styleQubeColors.surface || styleQubeColors.bg || "rgba(15,23,42,0.6)";
  const styleQubeThemeBorder = styleQubeColors.border || "rgba(148,163,184,0.2)";
  const styleQubeThemeText = styleQubeColors.text || "#e2e8f0";

  const copilotContextOptions = useMemo<Array<{ id: string; label: string }>>(() => {
    if (!codexList || codexList.length === 0) {
      return QRIPTO_FALLBACK_CODEXES as Array<{ id: string; label: string }>;
    }
    return codexList.map((codex: CodexListItem) => ({
      id: codex.id,
      label: codex.name,
    }));
  }, [codexList]);

  useEffect(() => {
    if (!copilotContextOptions.length) return;
    if (!copilotContextOptions.some((opt) => opt.id === copilotContextId)) {
      setCopilotContextId(copilotContextOptions[0].id);
    }
  }, [copilotContextOptions, copilotContextId]);

  useEffect(() => {
    if (!copilotContextId) return;
    setTenantId(copilotContextId);
    setUserId((prev) => prev || DEFAULT_USER);
  }, [copilotContextId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (copilotContextId !== "qripto-codex") {
      setCodexContentItems([]);
      return;
    }
    let cancelled = false;
    const loadContent = async () => {
      setCodexContentLoading(true);
      try {
        const origin = window.location.origin;
        const issueParam = "issue=issue-1&scope=codex";
        const sections = await Promise.all([
          fetch(`${origin}/api/content/section/home-hero?${issueParam}`).then((r) => r.json()),
          fetch(`${origin}/api/content/section/latest-news?${issueParam}`).then((r) => r.json()),
          fetch(`${origin}/api/content/section/second-hero?${issueParam}`).then((r) => r.json()),
          fetch(`${origin}/api/content/section/pennydrops?${issueParam}`).then((r) => r.json()),
          fetch(`${origin}/api/content/section/scrolls?${issueParam}`).then((r) => r.json()),
          fetch(`${origin}/api/content/section/21knowdz?${issueParam}`).then((r) => r.json()),
        ]);

        const tagged = [
          { items: sections[0]?.content || [], tag: "hero" },
          { items: sections[1]?.content || [], tag: "latest-news" },
          { items: sections[2]?.content || [], tag: "second-hero" },
          { items: sections[3]?.content || [], tag: "penny-drops" },
          { items: sections[4]?.content || [], tag: "scrolls-metaknyts" },
          { items: sections[5]?.content || [], tag: "knowdz-exec" },
        ];

        const mapped = tagged.flatMap(({ items, tag }) =>
          (items || []).slice(0, 4).map((item: any) => ({
            id: item.id || `${tag}-${item.title}`,
            label: item.title || item.name || tag,
            tag,
            mediaType: item.modalities?.watch ? "video" : item.modalities?.listen ? "audio" : "image",
            mediaUri: item.image || item.thumbnail || item.cover || item.heroImage || "",
          }))
        );

        if (!cancelled) setCodexContentItems(mapped.filter((item) => item.mediaUri));
      } catch {
        if (!cancelled) setCodexContentItems([]);
      } finally {
        if (!cancelled) setCodexContentLoading(false);
      }
    };
    loadContent();
    return () => {
      cancelled = true;
    };
  }, [copilotContextId]);
  const [templateIntent, setTemplateIntent] = useState<"micro-episode" | "article" | "tutorial" | "task" | null>(null);
  const [templateQuery, setTemplateQuery] = useState("");
  const [selectedExperienceId, setSelectedExperienceId] = useState<string | null>(null);
  const [previewDevice, setPreviewDevice] = useState<DeviceType>("mobile");
  const [previewAction, setPreviewAction] = useState<string | null>(null);
  const [previewTimestamp, setPreviewTimestamp] = useState(Date.now());

  // Auto-refresh preview every 30 seconds to prevent caching
  useEffect(() => {
    const interval = setInterval(() => {
      setPreviewTimestamp(Date.now());
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, []);

  // Force refresh when preview device or experience changes
  useEffect(() => {
    setPreviewTimestamp(Date.now());
  }, [previewDevice, selectedExperienceId, designTheme]);

  useEffect(() => {
    let active = true;
    const fetchTemplates = async () => {
      try {
        setTemplatesLoading(true);
        const res = await fetch("/api/composer/templates");
        if (!res.ok) throw new Error("Failed to load templates");
        const data = await res.json();
        if (active) {
          const apiTemplates: ExperienceTemplate[] = data.templates || [];
          const merged = [...apiTemplates];
          QRIPTO_TEMPLATE_SEEDS.forEach((seed) => {
            if (!merged.some((t) => t.id === seed.id)) {
              merged.push(seed);
            }
          });
          setTemplates(merged);
          setTemplatesError(null);
        }
      } catch (err: any) {
        if (active) setTemplatesError(err.message || "Failed to load templates");
      } finally {
        if (active) setTemplatesLoading(false);
      }
    };
    fetchTemplates();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const fetchDesignQube = async () => {
      try {
        setDesignQubeLoading(true);
        const res = await fetch("/api/metame/design-qube?includeImages=0");
        if (!res.ok) throw new Error("Failed to load DesignQube");
        const data = await res.json();
        if (!data.success) throw new Error(data.error || "Failed to load DesignQube");
        if (active) {
          setDesignQube(data.designQube || null);
          setDesignQubeError(null);
        }
      } catch (err: any) {
        if (active) setDesignQubeError(err.message || "Failed to load DesignQube");
      } finally {
        if (active) setDesignQubeLoading(false);
      }
    };
    fetchDesignQube();
    return () => {
      active = false;
    };
  }, []);

  useDesignQubeTheme(designQube?.tokens, designQube?.constraints, designTheme);

  const [previewSession, setPreviewSession] = useState({
    consentGiven: false,
    iqubeCreated: false,
    settlementComplete: false,
    shared: false,
  });

  const previewExperience = useMemo(() => {
    if (!selectedExperienceId) return experience;
    return experiences.find((exp) => exp.id === selectedExperienceId) || experience;
  }, [selectedExperienceId, experiences, experience]);

  const liquidTemplateId = resolveLiquidTemplateId((previewExperience as any) || null);
  const PreviewTemplate = liquidTemplateRegistry[liquidTemplateId] || liquidTemplateRegistry["liquidui:drawer_grid_v1"];
  const demoContent = useMemo(() => {
    return [
      {
        id: previewExperience?.id || "experience-preview",
        type: "SmartContentQube",
        app: "metaMe",
        title: previewExperience?.name || "Experience Preview",
        description: previewExperience?.description || "Preview capsule",
        rewardOutcomes: {
          engagementRewards: previewSession.settlementComplete
            ? [{ trigger: "settled", amount: 40, currency: "Q¢" }]
            : [],
        },
        modalities: { read: { enabled: true }, watch: { enabled: false }, listen: { enabled: false }, interact: { enabled: false } },
      } as unknown as SmartContentQube,
    ];
  }, [previewExperience, previewSession.settlementComplete]);

  const previewTemplateDevice = previewDevice === "desktop" ? "desktop" : previewDevice === "tablet" ? "tablet" : "mobile";

  const previewSettings = useMemo(() => {
    return {
      device: previewTemplateDevice,
      action: previewAction,
      consentGiven: previewSession.consentGiven,
      iqubeCreated: previewSession.iqubeCreated,
      settlementComplete: previewSession.settlementComplete,
      shared: previewSession.shared,
      receipts: previewSession.settlementComplete
        ? [
            {
              id: `receipt_${previewExperience?.id || "preview"}`,
              action: "settle",
              createdAt: new Date().toISOString(),
              receiptId: `rcpt_${Math.random().toString(36).slice(2, 8)}`,
            },
          ]
        : [],
    };
  }, [previewTemplateDevice, previewAction, previewSession, previewExperience?.id]);

  const RuntimePreviewMenu = ({
    onEarn,
    onPlay,
    onMake,
    onBe,
    onShare,
  }: {
    onEarn?: () => void;
    onPlay?: () => void;
    onMake?: () => void;
    onBe?: () => void;
    onShare?: () => void;
  }) => (
    <div className="absolute inset-x-0 bottom-0 border-t border-slate-800 bg-slate-950/90 px-4 py-2 text-[10px] uppercase tracking-wide text-slate-300 backdrop-blur">
      <div className="flex items-center justify-between">
        <button onClick={onBe} className="text-slate-400 hover:text-white">Be</button>
        <div className="flex items-center gap-4 text-slate-100">
          <button onClick={onEarn} className="hover:text-white">Earn</button>
          <button onClick={onPlay} className="hover:text-white">Play</button>
          <button onClick={onMake} className="hover:text-white">Make</button>
        </div>
        <button onClick={onShare} className="text-slate-400 hover:text-white">Share</button>
      </div>
    </div>
  );

  const PreviewStatus = () => (
    <div className="absolute top-3 right-3 rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-[11px] text-slate-300 backdrop-blur">
      <div className="flex items-center justify-between gap-2">
        <span>Consent</span>
        <span className={previewSession.consentGiven ? "text-emerald-300" : "text-slate-500"}>
          {previewSession.consentGiven ? "On" : "Off"}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span>iQube</span>
        <span className={previewSession.iqubeCreated ? "text-emerald-300" : "text-slate-500"}>
          {previewSession.iqubeCreated ? "Created" : "Pending"}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span>Settlement</span>
        <span className={previewSession.settlementComplete ? "text-emerald-300" : "text-slate-500"}>
          {previewSession.settlementComplete ? "Complete" : "Pending"}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span>Share</span>
        <span className={previewSession.shared ? "text-emerald-300" : "text-slate-500"}>
          {previewSession.shared ? "Sent" : "Pending"}
        </span>
      </div>
    </div>
  );

  useEffect(() => {
    if (!tenantId) return;
    let active = true;
    const fetchExperiences = async () => {
      try {
        const res = await fetch(`/api/composer/experiences?tenant_id=${encodeURIComponent(tenantId)}`);
        if (!res.ok) throw new Error("Failed to load experiences");
        const data = await res.json();
        if (active) setExperiences(data.experience_qubes || []);
      } catch {
        if (active) setExperiences([]);
      }
    };
    fetchExperiences();
    return () => {
      active = false;
    };
  }, [tenantId, experience?.id]);

  const filteredTemplates = useMemo(() => {
    const query = templateQuery.trim().toLowerCase();
    const intentKeywords: Record<string, string[]> = {
      "micro-episode": ["episode", "story", "series", "micro", "narrative", "serial"],
      article: ["article", "reader", "read", "essay", "news", "editorial"],
      tutorial: ["tutorial", "guide", "how", "lesson", "learn", "training"],
      task: ["task", "workflow", "checklist", "action", "runbook", "ops"],
    };

    const keywords = templateIntent ? intentKeywords[templateIntent] || [] : [];

    return templates.filter((template) => {
      const haystack = [
        template.name,
        template.description,
        template.category,
        template.complexity,
        ...(template.tags || []),
        ...(template.required_components || []),
        ...(template.optional_components || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const intentMatch = keywords.length === 0 || keywords.some((word) => haystack.includes(word));
      const queryMatch = query.length === 0 || haystack.includes(query);
      return intentMatch && queryMatch;
    });
  }, [templates, templateIntent, templateQuery]);

  useCopilotAction({
    name: "composer_set_template_intent",
    description: "Set the template intent and filter query for Studio composition.",
    parameters: [
      { name: "intent", type: "string", description: "micro-episode, article, tutorial, or task", required: false },
      { name: "query", type: "string", description: "Filter query for templates", required: false },
    ],
    handler: async ({ intent, query }) => {
      if (intent === "micro-episode" || intent === "article" || intent === "tutorial" || intent === "task") {
        setTemplateIntent(intent);
      }
      if (query) {
        setTemplateQuery(query);
      }
      return "Template filters updated.";
    },
  });

  const composerAgent = agentConfigs["aigent-z"];
  const handleCopilotPrompt = (prompt: string) => {
    const lower = prompt.toLowerCase();
    const contextLabel =
      copilotContextOptions.find((opt) => opt.id === copilotContextId)?.label || "The Qriptopian";
    let promptWithContext = `${contextLabel}: ${prompt}`;
    if (/(show|view|browse).*(all|templates)|all templates/.test(lower)) {
      setTemplateIntent(null);
      setTemplateQuery("");
      return;
    }
    if (/(micro|episode|story|series|serial)/.test(lower)) {
      setTemplateIntent("micro-episode");
      if (/(synth|synthsimms)/.test(lower)) {
        promptWithContext += " scrolls-synthsimms";
      } else if (/(knyt|metaknyt)/.test(lower)) {
        promptWithContext += " scrolls-metaknyts";
      } else {
        promptWithContext += " scrolls-metaknyts";
      }
    } else if (/(article|reader|read|essay|news)/.test(lower)) {
      setTemplateIntent("article");
      if (/(hero|feature)/.test(lower)) promptWithContext += " hero";
      if (/news/.test(lower)) promptWithContext += " latest-news";
    } else if (/(tutorial|guide|how|lesson|learn)/.test(lower)) {
      setTemplateIntent("tutorial");
      if (/penny/.test(lower)) promptWithContext += " penny-drops";
    } else if (/(task|workflow|checklist|runbook|ops)/.test(lower)) {
      setTemplateIntent("task");
      if (/exec/.test(lower)) promptWithContext += " knowdz-exec";
      if (/creative/.test(lower)) promptWithContext += " knowdz-creative";
      if (/dev/.test(lower)) promptWithContext += " knowdz-devs";
    }
    setTemplateQuery(promptWithContext);
  };

  const qriptoContentOptions = useMemo(() => {
    if (codexContentItems.length > 0) {
      return codexContentItems.map((item) => ({ value: item.id, label: item.label }));
    }
    return QRIPTO_CONTENT_ITEMS.map((item) => ({ value: item.id, label: item.label }));
  }, [codexContentItems]);

  const selectContentDefaults = useMemo(() => {
    const source = codexContentItems.length > 0 ? codexContentItems : QRIPTO_CONTENT_ITEMS;
    return source.slice(0, 3).map((item) => item.id);
  }, [codexContentItems]);

  useEffect(() => {
    if (filteredTemplates.length === 0) {
      setSelectedTemplateId(null);
      return;
    }
    if (!selectedTemplateId || !filteredTemplates.some((t) => t.id === selectedTemplateId)) {
      setSelectedTemplateId(filteredTemplates[0].id);
    }
  }, [filteredTemplates, selectedTemplateId]);

  const selectedTemplate = useMemo(
    () => filteredTemplates.find((t) => t.id === selectedTemplateId) || null,
    [filteredTemplates, selectedTemplateId]
  );

  const currentStep = useMemo(() => {
    if (!sessionTemplate) return null;
    return sessionTemplate.steps[session?.current_step || 0] || null;
  }, [sessionTemplate, session?.current_step]);

  const getFieldError = (field: ComposerField, value: any): string | null => {
    const isEmpty =
      value === undefined ||
      value === null ||
      (typeof value === "string" && value.trim().length === 0);

    if (field.type === "multiselect") {
      const list = Array.isArray(value) ? value : [];
      if (field.required && list.length === 0) return "Select at least one option.";
      return null;
    }

    if (field.type === "checkbox") {
      if (field.required && value !== true) return "This must be enabled.";
      return null;
    }

    if (field.required && isEmpty) return "This field is required.";

    if (field.validation?.pattern && !isEmpty) {
      try {
        const regex = new RegExp(field.validation.pattern);
        if (!regex.test(String(value))) return "Value does not match the required format.";
      } catch {
        // Ignore invalid regex patterns.
      }
    }

    if (field.validation && typeof value === "number") {
      const min = field.validation.min;
      const max = field.validation.max;
      if (min !== undefined && value < min) return `Minimum value is ${min}.`;
      if (max !== undefined && value > max) return `Maximum value is ${max}.`;
    }

    return null;
  };

  useEffect(() => {
    if (!currentStep) return;
    setStepData((prev) => {
      if (prev[currentStep.id]) return prev;
      const defaults: Record<string, any> = {};
      currentStep.ui_config.fields.forEach((field) => {
        if (field.default_value !== undefined) {
          defaults[field.id] = field.default_value;
          return;
        }
        if (field.id === "content_items") {
          defaults[field.id] = selectContentDefaults;
          return;
        }
        if (field.id === "content_tag") {
          defaults[field.id] = QRIPTO_CONTENT_TAGS[0]?.value;
        }
      });
      if (Object.keys(defaults).length === 0) return prev;
      return { ...prev, [currentStep.id]: defaults };
    });
  }, [currentStep]);

  const stepValues = currentStep ? stepData[currentStep.id] || {} : {};

  const mergedData = useMemo(() => {
    if (!currentStep) return sessionData;
    return {
      ...sessionData,
      [currentStep.id]: stepValues,
    };
  }, [currentStep, sessionData, stepValues]);

  const isStepValid = useMemo(() => {
    if (!currentStep) return false;
    return currentStep.ui_config.fields.every((field) => !getFieldError(field, stepValues[field.id]));
  }, [currentStep, stepValues]);

  const handleStartSession = async () => {
    if (!selectedTemplate || !tenantId || !userId) return;
    try {
      setSessionError(null);
      setIsSaving(true);
      const res = await fetch("/api/composer/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          user_id: userId,
          template_id: selectedTemplate.id,
        }),
      });
      if (!res.ok) throw new Error("Failed to create session");
      const data = await res.json();
      setSession(data.session);
      setSessionTemplate({ ...selectedTemplate, steps: data.template.steps || selectedTemplate.steps });
      setSessionData(data.session?.data || {});
      setStepData({});
      setExperience(null);
    } catch (err: any) {
      setSessionError(err.message || "Failed to start session");
    } finally {
      setIsSaving(false);
    }
  };

  const updateSession = async (nextStep: number) => {
    if (!session) return;
    const nextData = {
      ...sessionData,
      ...(currentStep ? { [currentStep.id]: stepValues } : {}),
    };
    const res = await fetch(`/api/composer/sessions/${session.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        current_step: nextStep,
        data: nextData,
        status: session.status,
      }),
    });
    if (!res.ok) throw new Error("Failed to save session");
    const data = await res.json();
    setSession(data.session);
    setSessionData(nextData);
  };

  const handleNext = async () => {
    if (!sessionTemplate || !session) return;
    const nextStep = Math.min(sessionTemplate.steps.length - 1, (session.current_step || 0) + 1);
    try {
      setIsSaving(true);
      await updateSession(nextStep);
    } catch (err: any) {
      setSessionError(err.message || "Failed to save step");
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = async () => {
    if (!sessionTemplate || !session) return;
    const prevStep = Math.max(0, (session.current_step || 0) - 1);
    try {
      setIsSaving(true);
      await updateSession(prevStep);
    } catch (err: any) {
      setSessionError(err.message || "Failed to save step");
    } finally {
      setIsSaving(false);
    }
  };

  const handleComplete = async () => {
    if (!session) return;
    try {
      setIsCompleting(true);
      setSessionError(null);
      const res = await fetch(`/api/composer/sessions/${session.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete" }),
      });
      if (!res.ok) throw new Error("Failed to complete session");
      const data = await res.json();
      setExperience(data.experience_qube || null);
      setSession((prev) => (prev ? { ...prev, status: "completed" } : prev));
    } catch (err: any) {
      setSessionError(err.message || "Failed to complete session");
    } finally {
      setIsCompleting(false);
    }
  };

  const updateField = (stepId: string, fieldId: string, value: any) => {
    setStepData((prev) => ({
      ...prev,
      [stepId]: {
        ...(prev[stepId] || {}),
        [fieldId]: value,
      },
    }));
  };

  const cardClass = "rounded-2xl border border-slate-800 bg-slate-900/60 p-6";
  const summaryCardClass = "rounded-xl border border-slate-800 bg-slate-950/60 p-4";
  const getMergedValue = (stepId: string, fieldId: string) => mergedData?.[stepId]?.[fieldId];
  const summary = useMemo(() => {
    if (!sessionTemplate) return [];
    const getLabel = (stepId: string, fieldId: string) => {
      const step = sessionTemplate.steps.find((s) => s.id === stepId);
      const field = step?.ui_config.fields.find((f) => f.id === fieldId);
      return field?.name || fieldId;
    };

    const list: Array<{ label: string; value: string }> = [];
    const intentStep = mergedData.intent_timebox || {};
    if (intentStep.experience_name) list.push({ label: getLabel("intent_timebox", "experience_name"), value: intentStep.experience_name });
    if (intentStep.goal) list.push({ label: getLabel("intent_timebox", "goal"), value: intentStep.goal });
    if (intentStep.time_available) list.push({ label: getLabel("intent_timebox", "time_available"), value: `${intentStep.time_available} min` });
    if (intentStep.depth) list.push({ label: getLabel("intent_timebox", "depth"), value: intentStep.depth });

    const contentStep = mergedData.content_selection || {};
    if (contentStep.issue_slug) list.push({ label: getLabel("content_selection", "issue_slug"), value: contentStep.issue_slug });
    if (contentStep.feature_item_id) list.push({ label: getLabel("content_selection", "feature_item_id"), value: contentStep.feature_item_id });
    if (Array.isArray(contentStep.supporting_item_ids) && contentStep.supporting_item_ids.length > 0) {
      list.push({ label: getLabel("content_selection", "supporting_item_ids"), value: `${contentStep.supporting_item_ids.length} items` });
    }

    const walletStep = mergedData.wallet_rewards || {};
    if (walletStep.unlock_price !== undefined) list.push({ label: getLabel("wallet_rewards", "unlock_price"), value: `${walletStep.unlock_price} Q¢` });
    if (walletStep.reward_amount !== undefined) list.push({ label: getLabel("wallet_rewards", "reward_amount"), value: `${walletStep.reward_amount} Q¢` });
    if (walletStep.require_wallet_connect !== undefined) list.push({ label: getLabel("wallet_rewards", "require_wallet_connect"), value: walletStep.require_wallet_connect ? "Required" : "Optional" });

    const copilotStep = mergedData.copilot_output || {};
    if (Array.isArray(copilotStep.outputs) && copilotStep.outputs.length > 0) {
      list.push({ label: getLabel("copilot_output", "outputs"), value: copilotStep.outputs.join(", ") });
    }
    if (copilotStep.takeaways_count !== undefined) list.push({ label: getLabel("copilot_output", "takeaways_count"), value: String(copilotStep.takeaways_count) });

    return list;
  }, [mergedData, sessionTemplate]);

  return (
    <div className="min-h-screen bg-slate-900 px-6 py-6">
      <div className="w-full space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Hexagon className="h-6 w-6 text-rose-400" />
            <h1 className="text-xl font-bold text-white">metaMe Studio</h1>
            <span className="text-sm text-slate-400">
              Build ExperienceQubes using guided templates. This uses the existing Composer API and receipt pipeline.
            </span>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr_1fr]">
          <div
            className={cardClass}
            style={
              designQube
                ? {
                    backgroundColor: styleQubeThemeBg,
                    borderColor: styleQubeThemeBorder,
                    color: styleQubeThemeText,
                  }
                : undefined
            }
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-cyan-300" />
                  <h2 className="text-lg font-semibold text-white">Composer Copilot</h2>
                </div>
                <p className="text-sm text-slate-400">What would you like to compose?</p>
              </div>
            </div>
            <div className="mt-4 h-[640px] w-96 overflow-hidden rounded-2xl border border-transparent bg-slate-950/60 backdrop-blur-xl flex flex-col">
              <div className="h-full overflow-hidden">
                <CodexCopilotLayer
                  isOpen
                  onClose={() => {}}
                  variant="embedded"
                  showNavMenu
                  showWalletMenu
                  hideAvatarToggle
                  contextOptions={copilotContextOptions}
                  contextId={copilotContextId}
                  onContextChange={setCopilotContextId}
                  inputPanelClassName="rounded-2xl border border-white/10 bg-slate-950/95 backdrop-blur-xl px-3 py-3 shadow-lg"
                  inputPanelInputClassName="flex-1 px-3 py-2 bg-slate-900/80 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 text-sm"
                  panelBorder={false}
                  quickPrompts={[
                    "Show all templates",
                    "Micro-episode experience",
                    "Smart wallet + offer",
                    "Article reading flow",
                    "Tutorial walkthrough",
                    "Task runbook with rewards",
                  ]}
                  onPrompt={handleCopilotPrompt}
                  agent={{
                    id: composerAgent.id,
                    name: composerAgent.name,
                    evmSepolia: composerAgent.walletAddresses?.evmAddress as `0x${string}`,
                    evmArb: composerAgent.walletAddresses?.evmAddress as `0x${string}`,
                    btcAddress: composerAgent.walletAddresses?.btcAddress,
                    fioHandle: composerAgent.fioId,
                  }}
                />
              </div>
            </div>
          </div>

          <div className={cardClass}>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <LayoutGrid className="h-4 w-4 text-emerald-300" />
                  <h2 className="text-lg font-semibold text-white">Experience Templates</h2>
                </div>
                <p className="text-sm text-slate-400">Select a template to begin a new session.</p>
              </div>
              {templatesLoading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
            </div>
            {templatesError && (
              <div className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                {templatesError}
              </div>
            )}
            <div className="mt-4 max-h-[460px] space-y-3 overflow-y-auto pr-1">
              {filteredTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => setSelectedTemplateId(template.id)}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                    selectedTemplateId === template.id
                      ? "border-emerald-400/60 bg-emerald-500/10"
                      : "border-slate-800 bg-slate-950/60 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-white">{template.name}</div>
                      <div className="text-xs text-slate-400">{template.description}</div>
                    </div>
                    <div className="text-xs text-slate-400">{template.estimated_time} min</div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-400">
                    <span className="rounded-full border border-slate-700 px-2 py-0.5">
                      {template.category}
                    </span>
                    <span className="rounded-full border border-slate-700 px-2 py-0.5">
                      {template.complexity}
                    </span>
                    {template.tags?.slice(0, 3).map((tag) => (
                      <span key={tag} className="rounded-full border border-slate-700 px-2 py-0.5">
                        {tag}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
              {!templatesLoading && filteredTemplates.length === 0 && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-6 text-sm text-slate-400">
                  No templates match that intent yet. Try a different prompt or clear filters.
                </div>
              )}
            </div>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs text-slate-400">Tenant ID</label>
                <input
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-200"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">User ID</label>
                <input
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-200"
                />
              </div>
            </div>
            <button
              onClick={handleStartSession}
              disabled={!selectedTemplate || isSaving}
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-emerald-500/40"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Start Session"}
            </button>
          </div>

          <div className={cardClass}>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-violet-300" />
                  <h2 className="text-lg font-semibold text-white">Template Customizer</h2>
                </div>
                <p className="text-sm text-slate-400">Follow the guided steps and publish an ExperienceQube.</p>
              </div>
              {session && (
                <span className="rounded-full border border-slate-700 px-2 py-1 text-xs text-slate-300">
                  {session.status}
                </span>
              )}
            </div>
            {!session && (
              <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-6 text-sm text-slate-400">
                Start a session to begin composing an experience.
              </div>
            )}
            {session && sessionTemplate && (
              <div className="mt-4 max-h-[520px] space-y-4 overflow-y-auto pr-1">
                <div className="space-y-2">
                  {sessionTemplate.steps.map((step, idx) => (
                    <div key={step.id} className="flex items-start gap-3">
                      {idx <= (session.current_step || 0) ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5" />
                      ) : (
                        <Circle className="h-4 w-4 text-slate-500 mt-0.5" />
                      )}
                      <div>
                        <div className="text-sm text-slate-200">{step.title}</div>
                        <div className="text-xs text-slate-500">{step.description}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {currentStep && (
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                    <div className="mb-2 text-sm font-semibold text-white">{currentStep.title}</div>
                    <div className="mb-4 text-xs text-slate-400">{currentStep.description}</div>
                    <div className="space-y-3">
                      {currentStep.ui_config.fields.map((field) => {
                        const value = stepValues[field.id];
                        const error = getFieldError(field, value);
                        const isContentItemsField = field.id === "content_items";
                        const isContentTagField =
                          field.id.includes("content_tag") || field.name.toLowerCase().includes("content tag");
                        const options = isContentItemsField
                          ? qriptoContentOptions
                          : isContentTagField && field.options
                            ? [
                                ...field.options,
                                ...QRIPTO_CONTENT_TAGS.filter(
                                  (tag) => !field.options?.some((opt) => opt.value === tag.value)
                                ),
                              ]
                            : isContentTagField
                              ? QRIPTO_CONTENT_TAGS
                              : field.options;
                        return (
                          <div key={field.id}>
                            <label className="text-xs text-slate-400">
                              {field.name} {field.required && <span className="text-rose-400">*</span>}
                            </label>
                            {field.type === "text" && (
                              <input
                                value={value || ""}
                                onChange={(e) => updateField(currentStep.id, field.id, e.target.value)}
                                className={`mt-1 w-full rounded-lg border bg-slate-900 px-3 py-2 text-sm text-slate-200 ${
                                  error ? "border-rose-500/60" : "border-slate-800"
                                }`}
                              />
                            )}
                            {field.type === "textarea" && (
                              <textarea
                                value={value || ""}
                                onChange={(e) => updateField(currentStep.id, field.id, e.target.value)}
                                className={`mt-1 w-full rounded-lg border bg-slate-900 px-3 py-2 text-sm text-slate-200 ${
                                  error ? "border-rose-500/60" : "border-slate-800"
                                }`}
                                rows={3}
                              />
                            )}
                            {field.type === "select" && (
                              <select
                                value={value || ""}
                                onChange={(e) => updateField(currentStep.id, field.id, e.target.value)}
                                className={`mt-1 w-full rounded-lg border bg-slate-900 px-3 py-2 text-sm text-slate-200 ${
                                  error ? "border-rose-500/60" : "border-slate-800"
                                }`}
                              >
                                <option value="">Select...</option>
                                {options?.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            )}
                            {field.type === "multiselect" && (
                              <div className="mt-2 grid gap-2">
                                {options?.map((opt) => {
                                  const selected = Array.isArray(value) && value.includes(opt.value);
                                  return (
                                    <label key={opt.value} className="flex items-center gap-2 text-xs text-slate-300">
                                      <input
                                        type="checkbox"
                                        checked={selected}
                                        onChange={(e) => {
                                          const next = new Set(Array.isArray(value) ? value : []);
                                          if (e.target.checked) next.add(opt.value);
                                          else next.delete(opt.value);
                                          updateField(currentStep.id, field.id, Array.from(next));
                                        }}
                                      />
                                      {opt.label}
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                            {field.type === "checkbox" && (
                              <label className="mt-2 flex items-center gap-2 text-xs text-slate-300">
                                <input
                                  type="checkbox"
                                  checked={value === true}
                                  onChange={(e) => updateField(currentStep.id, field.id, e.target.checked)}
                                />
                                Enabled
                              </label>
                            )}
                            {field.type === "slider" && (
                              <div className="mt-2 space-y-1">
                                <input
                                  type="range"
                                  min={field.validation?.min ?? 0}
                                  max={field.validation?.max ?? 100}
                                  step={field.validation?.step ?? 1}
                                  value={value ?? field.default_value ?? 0}
                                  onChange={(e) => updateField(currentStep.id, field.id, Number(e.target.value))}
                                  className="w-full"
                                />
                                <div className="text-xs text-slate-500">
                                  {value ?? field.default_value ?? 0}
                                </div>
                              </div>
                            )}
                            {error && <div className="mt-1 text-[11px] text-rose-300">{error}</div>}
                            {field.help_text && !error && (
                              <div className="mt-1 text-[11px] text-slate-500">{field.help_text}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {summary.length > 0 && (
                  <div className={summaryCardClass}>
                    <div className="mb-2 text-xs uppercase tracking-widest text-slate-400">Experience Snapshot</div>
                    <div className="grid gap-2 text-sm text-slate-200">
                      {summary.map((item) => (
                        <div key={item.label} className="flex items-center justify-between gap-3">
                          <span className="text-slate-400">{item.label}</span>
                          <span className="text-slate-200 text-right">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {sessionError && (
                  <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                    {sessionError}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleBack}
                    disabled={!session || (session.current_step || 0) === 0 || isSaving}
                    className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 disabled:opacity-50"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={!sessionTemplate || !session || !isStepValid || isSaving || (session.current_step || 0) === sessionTemplate.steps.length - 1}
                    className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
                  >
                    {isSaving ? "Saving..." : "Next"}
                  </button>
                  <button
                    onClick={handleComplete}
                    disabled={!sessionTemplate || !session || !isStepValid || isCompleting || (session.current_step || 0) !== sessionTemplate.steps.length - 1}
                    className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {isCompleting ? "Completing..." : "Complete"}
                  </button>
                  {experience && (
                    <button
                      onClick={() => router.push(`/studio/composer/experience/${experience.id}`)}
                      className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200"
                    >
                      Open Experience
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <div className={cardClass}>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Hexagon className="h-4 w-4 text-cyan-300" />
                  <h2 className="text-lg font-semibold text-white">ExperienceQubes</h2>
                </div>
                <p className="text-sm text-slate-400">Latest experiences for the current tenant.</p>
              </div>
              {experience && (
                <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200">
                  Created {experience.name}
                </span>
              )}
            </div>
            <div className="mt-4 max-h-[420px] overflow-y-auto pr-1">
              <div className="grid gap-3 md:grid-cols-2">
                {experiences.map((exp) => (
                  <div key={exp.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                    <div className="text-sm font-semibold text-white">{exp.name}</div>
                    <div className="text-xs text-slate-400">{exp.description}</div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-400">
                      <span className="rounded-full border border-slate-700 px-2 py-0.5">{exp.status}</span>
                      {exp.metadata?.category && (
                        <span className="rounded-full border border-slate-700 px-2 py-0.5">
                          {exp.metadata.category}
                        </span>
                      )}
                      {exp.metadata?.tags?.slice(0, 2).map((tag) => (
                        <span key={tag} className="rounded-full border border-slate-700 px-2 py-0.5">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedExperienceId(exp.id);
                          setPreviewAction(`Preview ${exp.name}`);
                        }}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                          selectedExperienceId === exp.id
                            ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-200"
                            : "border-slate-700 bg-slate-900/40 text-slate-300 hover:bg-slate-800/60"
                        }`}
                      >
                        Preview
                      </button>
                      <button
                        onClick={() => router.push(`/studio/composer/experience/${exp.id}`)}
                        className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/20"
                      >
                        Launch Experience
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {experiences.length === 0 && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-6 text-sm text-slate-400">
                  No ExperienceQubes created yet.
                </div>
              )}
            </div>
          </div>

          <div
            className={cardClass}
            style={
              designQube
                ? {
                    backgroundColor: styleQubeThemeBg,
                    borderColor: styleQubeThemeBorder,
                    color: styleQubeThemeText,
                  }
                : undefined
            }
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Palette className="h-4 w-4 text-rose-300" />
                  <h2 className="text-lg font-semibold text-white">StyleQube</h2>
                </div>
                <p className="text-sm text-slate-400">Active styling profile for Runtime + Studio.</p>
              </div>
            </div>
            {designQubeLoading && (
              <div className="mt-4 text-sm text-slate-400">Loading DesignQube references...</div>
            )}
            {designQubeError && (
              <div className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                {designQubeError}
              </div>
            )}

            {designQube && (
              <div className="mt-4">
                {(() => {
                  const themeTokens = designQube.tokens?.themes?.[designTheme];
                  const colors = themeTokens?.color || {};
                  const palette = [
                    colors.bg,
                    colors.surface,
                    colors.accent,
                    colors.text,
                    colors.muted,
                    colors.border,
                  ].filter(Boolean) as string[];
                  const radiusValues = designQube.tokens?.radius
                    ? Object.values(designQube.tokens.radius).slice(0, 3)
                    : [];
                  const fontFamily = designQube.tokens?.typography?.fontFamily?.sans || "system-ui";
                  const scale = designQube.tokens?.typography?.scale || {};
                  const glassEnabled = designQube.constraints?.material?.glass?.enabled;
                  const references = designQube.references?.slice(0, 4) || [];
                  const summaryBadges = designQube.manifest?.themes || [];
                  const themeBg = colors.surface || colors.bg || "rgba(15,23,42,0.6)";
                  const themeBorder = colors.border || "rgba(148,163,184,0.2)";
                  const themeText = colors.text || "#e2e8f0";

                  return (
                    <>
                      <div
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3 py-2"
                        style={{ backgroundColor: themeBg, borderColor: themeBorder }}
                      >
                        <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: themeText }}>
                          <select
                            value={activeStyleQubeId}
                            onChange={(e) => setActiveStyleQubeId(e.target.value)}
                            className="rounded-md border border-white/10 bg-slate-950/40 px-2 py-1 text-xs text-white/90"
                            style={{ borderColor: themeBorder, backgroundColor: themeBg }}
                          >
                            <option value="knyt-guidance-v1">KNYT Guidance</option>
                          </select>
                          <button
                            className="inline-flex items-center rounded-full border px-2 py-0.5"
                            title={designQube.manifest?.authorityLevel || "guidance"}
                            style={{ borderColor: themeBorder }}
                          >
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setDesignTheme("light")}
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 ${designTheme === "light" ? "border-amber-300/60 bg-amber-500/10" : ""}`}
                            title="Light theme"
                            style={designTheme === "light" ? undefined : { borderColor: themeBorder }}
                          >
                            <Sun className="h-3.5 w-3.5 text-amber-300" />
                          </button>
                          <button
                            onClick={() => setDesignTheme("dark")}
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 ${designTheme === "dark" ? "border-slate-300/60 bg-slate-500/10" : ""}`}
                            title="Dark theme"
                            style={designTheme === "dark" ? undefined : { borderColor: themeBorder }}
                          >
                            <Moon className="h-3.5 w-3.5 text-slate-300" />
                          </button>
                          <button
                            onClick={() => setDesignQubeSummaryLayout("compact")}
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 ${designQubeSummaryLayout === "compact" ? "border-cyan-300/60 bg-cyan-500/10" : ""}`}
                            title="Row view"
                            style={designQubeSummaryLayout === "compact" ? undefined : { borderColor: themeBorder }}
                          >
                            <List size={14} className="text-cyan-300" />
                          </button>
                          <button
                            onClick={() => setDesignQubeSummaryLayout("grid")}
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 ${designQubeSummaryLayout === "grid" ? "border-cyan-300/60 bg-cyan-500/10" : ""}`}
                            title="Grid view"
                            style={designQubeSummaryLayout === "grid" ? undefined : { borderColor: themeBorder }}
                          >
                            <LayoutGrid size={14} className="text-cyan-300" />
                          </button>
                          <button
                            onClick={() => setDesignQubeCollapsed((prev) => !prev)}
                            className="inline-flex items-center rounded-full border px-2 py-0.5"
                            title={designQubeCollapsed ? "Expand details" : "Collapse details"}
                            style={{ borderColor: themeBorder }}
                          >
                            {designQubeCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                          </button>
                        </div>
                      </div>

                      {!designQubeCollapsed ? (
                        <>
                          {designQube.styleBrief && (
                            <div className="mt-3 max-h-[160px] overflow-y-auto pr-1 text-sm" style={{ color: themeText }}>
                              {designQube.styleBrief}
                            </div>
                          )}
                          <div className="mt-4 max-h-[420px] overflow-y-auto pr-1">
                            <div className="grid gap-3 sm:grid-cols-2">
                              {designQube.references?.slice(0, 6).map((ref) => (
                                <div
                                  key={ref.id}
                                  className="rounded-xl border p-2"
                                  style={{ backgroundColor: themeBg, borderColor: themeBorder }}
                                >
                                  {ref.dataUrl || ref.thumbnailUrl ? (
                                    <img
                                      src={ref.dataUrl || ref.thumbnailUrl}
                                      alt={ref.title || ref.file}
                                      className="h-32 w-full rounded-lg object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-32 items-center justify-center rounded-lg border border-dashed text-xs text-slate-500">
                                      {ref.file}
                                    </div>
                                  )}
                                  <div className="mt-2 text-xs text-slate-400">{ref.title || ref.file}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      ) : designQubeSummaryLayout === "compact" ? (
                        <div className="mt-4 rounded-xl border p-3" style={{ backgroundColor: themeBg, borderColor: themeBorder }}>
                          <div className="flex flex-wrap items-center justify-between gap-4">
                            <div className="flex flex-wrap items-center gap-2 text-[11px]" style={{ color: themeText }}>
                              <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5" style={{ borderColor: themeBorder }}>
                                <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
                              </span>
                              {summaryBadges.map((theme) => (
                                <span key={theme} className="inline-flex items-center rounded-full border px-2 py-0.5" style={{ borderColor: themeBorder }}>
                                  {theme.toLowerCase().includes("light") ? (
                                    <Sun className="h-3.5 w-3.5 text-amber-300" />
                                  ) : (
                                    <Moon className="h-3.5 w-3.5 text-slate-300" />
                                  )}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            {palette.slice(0, 6).map((color, idx) => (
                              <span
                                key={`${color}-${idx}`}
                                className="h-4 w-4 rounded-full border"
                                style={{ backgroundColor: color, borderColor: themeBorder }}
                                title={color}
                              />
                            ))}
                            {glassEnabled && (
                              <span className="inline-flex items-center rounded-full border px-2 py-0.5" style={{ borderColor: themeBorder }} title="Glass material">
                                <Moon className="h-3.5 w-3.5 text-slate-400" />
                              </span>
                            )}
                          </div>
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs" style={{ color: themeText }}>
                            <div className="flex items-center gap-2">
                              <span style={{ fontFamily, fontSize: scale.lg || 18 }} className="text-white">Aa</span>
                              <span style={{ fontFamily, fontSize: scale.sm || 14 }} className="text-slate-400">Aa</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {radiusValues.map((radius, idx) => (
                                <div
                                  key={`radius-${idx}`}
                                  className="h-6 w-10 border"
                                  style={{ borderRadius: `${radius}px`, backgroundColor: themeBg, borderColor: themeBorder }}
                                  title={`radius ${radius}`}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 grid gap-4 rounded-xl border p-4 md:grid-cols-[1.2fr,1fr]" style={{ backgroundColor: themeBg, borderColor: themeBorder }}>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <div className="flex flex-wrap items-center gap-2">
                              {palette.slice(0, 6).map((color, idx) => (
                                <span
                                  key={`${color}-${idx}`}
                                  className="h-4 w-4 rounded-full border"
                                  style={{ backgroundColor: color, borderColor: themeBorder }}
                                  title={color}
                                />
                              ))}
                              {glassEnabled && (
                                <span className="inline-flex items-center rounded-full border px-2 py-0.5" style={{ borderColor: themeBorder }} title="Glass material">
                                  <Moon className="h-3.5 w-3.5 text-slate-400" />
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2 text-[11px]" style={{ color: themeText }}>
                              <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5" style={{ borderColor: themeBorder }}>
                                <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
                              </span>
                              {summaryBadges.map((theme) => (
                                <span key={theme} className="inline-flex items-center rounded-full border px-2 py-0.5" style={{ borderColor: themeBorder }}>
                                  {theme.toLowerCase().includes("light") ? (
                                    <Sun className="h-3.5 w-3.5 text-amber-300" />
                                  ) : (
                                    <Moon className="h-3.5 w-3.5 text-slate-300" />
                                  )}
                                </span>
                              ))}
                              {glassEnabled && (
                                <span className="inline-flex items-center rounded-full border px-2 py-0.5" style={{ borderColor: themeBorder }} title="Glass material">
                                  <Moon className="h-3.5 w-3.5 text-slate-400" />
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              {palette.slice(0, 6).map((color, idx) => (
                                <span
                                  key={`${color}-${idx}`}
                                  className="h-5 w-5 rounded-md border"
                                  style={{ backgroundColor: color, borderColor: themeBorder }}
                                  title={color}
                                />
                              ))}
                            </div>
                            <div className="flex items-center gap-3">
                              <span style={{ fontFamily, fontSize: scale.xl || 22 }} className="text-white">Aa</span>
                              <span style={{ fontFamily, fontSize: scale.sm || 14 }} className="text-slate-400">Aa</span>
                              <div className="ml-auto flex items-center gap-2">
                                {radiusValues.map((radius, idx) => (
                                  <div
                                    key={`radius-grid-${idx}`}
                                    className="h-6 w-12 border"
                                    style={{ borderRadius: `${radius}px`, backgroundColor: themeBg, borderColor: themeBorder }}
                                    title={`radius ${radius}`}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>

          <div className={cardClass}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Hexagon className="h-5 w-5 text-rose-400" />
                <h2 className="text-lg font-semibold text-white">metaMe Runtime Preview</h2>
                <p className="text-sm text-slate-400">Toggle device sizes to validate the Runtime flow.</p>
              </div>
              <div className="flex items-center gap-3">
                {previewAction && (
                  <span className="text-xs text-slate-400">Last action: {previewAction}</span>
                )}
                <DevicePreviewSwitcher value={previewDevice} onChange={setPreviewDevice} />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewTimestamp(Date.now())}
                  className="text-xs"
                >
                  Refresh Preview
                </Button>
              </div>
            </div>
            <div className="mt-4 h-[760px] max-h-[760px] overflow-hidden">
              <PreviewFrame
                src={`/metame/runtime?preview=1&capsule=${selectedExperienceId || previewExperience?.id || "capsule-metaknyt-play"}&theme=${designTheme}&embed=1&device=${previewDevice}&t=${previewTimestamp}`}
                defaultDevice="mobile"
                chromeless
                deviceQueryParam="device"
                showToolbar={false}
                className="h-full"
              />
            </div>
          </div>
      </div>
    </div>
  );
};
