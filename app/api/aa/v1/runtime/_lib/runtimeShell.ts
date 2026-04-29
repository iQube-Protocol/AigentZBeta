import crypto from "node:crypto";
import { NextRequest } from "next/server";

type TrustState = "ok" | "warn" | "fail";
type RuntimeMenuMode = "triad" | "collapsed" | "full";
type RuntimeIntent = "be" | "earn" | "play" | "make" | "share" | "find";

type SelectorOption = {
  id: string;
  label: string;
  icon?: string;
  tooltip?: string;
  color?: string;
  provider_id?: string;
};

type RuntimeMenuActionMeta = {
  prompt: string;
  intent: RuntimeIntent;
  surface_plan_instruction: string;
  copilot_instruction: string;
};

type RuntimeMenuItem = {
  id: string;
  label: string;
  icon: string;
  tooltip: string;
  color: string;
  enabled: boolean;
  edge?: boolean;
  trigger: RuntimeMenuActionMeta;
};

type RuntimeQuickLink = {
  id: string;
  label: string;
  icon: string;
  prompt: string;
  intent?: RuntimeIntent;
  skip_inference?: boolean;
};

type RuntimeState = {
  selected_aigent_id: string;
  selected_llm_id: string;
  menu_mode: RuntimeMenuMode;
  welcome_complete: boolean;
  last_intent: RuntimeIntent | null;
  last_action_id: string | null;
  updated_at: string;
};

type RuntimeContext = {
  tenantId: string;
  personaId: string;
  deviceHint: "desktop" | "tablet" | "mobile";
  processing: boolean;
};

const AGENT_OPTIONS: SelectorOption[] = [
  { id: "aigent-z", label: "Aigent Z", icon: "bot", tooltip: "System orchestrator", color: "#67e8f9" },
  { id: "aigent-kn0w1", label: "Kn0w1", icon: "brain", tooltip: "Knowledge specialist", color: "#6ee7b7" },
  { id: "aigent-moneypenny", label: "MoneyPenny", icon: "coins", tooltip: "Treasury and settlement agent", color: "#c4b5fd" },
  { id: "aigent-nakamoto", label: "Nakamoto", icon: "hexagon", tooltip: "Crypto and protocol specialist", color: "#fcd34d" },
  { id: "aigent-marketa", label: "Marketa", icon: "megaphone", tooltip: "Growth and campaign strategist", color: "#fda4af" },
];

const LLM_OPTIONS_BY_AGENT: Record<string, SelectorOption[]> = {
  "aigent-z": [
    { id: "gpt-4o", label: "GPT-4o", icon: "openai", tooltip: "General orchestration", provider_id: "openai" },
    { id: "gpt-4o-mini", label: "GPT-4o Mini", icon: "openai", tooltip: "Fast responses", provider_id: "openai" },
    { id: "claude-3-5-sonnet", label: "Claude 3.5 Sonnet", icon: "anthropic", tooltip: "Reasoning + reliability", provider_id: "anthropic" },
    { id: "venice-uncensored", label: "Venice Uncensored", icon: "venice", tooltip: "Exploratory mode", provider_id: "venice" },
    { id: "chaingpt-general", label: "ChainGPT General", icon: "chaingpt", tooltip: "Web3 context", provider_id: "chaingpt" },
    { id: "thirdweb-web3-llm", label: "ThirdWeb Web3 LLM", icon: "thirdweb", tooltip: "Onchain workflows", provider_id: "thirdweb" },
    { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro", icon: "google", tooltip: "General assistant", provider_id: "google" },
  ],
  "aigent-kn0w1": [
    { id: "gpt-4o-mini", label: "GPT-4o Mini", icon: "openai", tooltip: "Fast synthesis", provider_id: "openai" },
    { id: "venice-reasoning", label: "Venice Reasoning", icon: "venice", tooltip: "Alternative reasoning path", provider_id: "venice" },
    { id: "claude-3-5-haiku", label: "Claude 3.5 Haiku", icon: "anthropic", tooltip: "Concise analysis", provider_id: "anthropic" },
  ],
  "aigent-moneypenny": [
    { id: "gpt-4o-mini", label: "GPT-4o Mini", icon: "openai", tooltip: "Transaction guidance", provider_id: "openai" },
    { id: "chaingpt-crypto", label: "ChainGPT Crypto", icon: "chaingpt", tooltip: "Crypto-native analysis", provider_id: "chaingpt" },
    { id: "claude-3-5-sonnet", label: "Claude 3.5 Sonnet", icon: "anthropic", tooltip: "Audit-ready summaries", provider_id: "anthropic" },
    { id: "thirdweb-web3-llm", label: "ThirdWeb Web3 LLM", icon: "thirdweb", tooltip: "Onchain workflows", provider_id: "thirdweb" },
  ],
  "aigent-nakamoto": [
    { id: "venice-uncensored", label: "Venice Uncensored", icon: "venice", tooltip: "Exploratory protocol ideation", provider_id: "venice" },
    { id: "chaingpt-code", label: "ChainGPT Code", icon: "chaingpt", tooltip: "Smart-contract context", provider_id: "chaingpt" },
    { id: "thirdweb-web3-llm", label: "ThirdWeb Web3 LLM", icon: "thirdweb", tooltip: "Onchain execution", provider_id: "thirdweb" },
    { id: "gpt-4o", label: "GPT-4o", icon: "openai", tooltip: "Protocol architecture", provider_id: "openai" },
  ],
  "aigent-marketa": [
    { id: "venice-reasoning", label: "Venice Reasoning", icon: "venice", tooltip: "Growth experimentation", provider_id: "venice" },
    { id: "thirdweb-web3-llm", label: "ThirdWeb Web3 LLM", icon: "thirdweb", tooltip: "Web3 growth hooks", provider_id: "thirdweb" },
    { id: "chaingpt-general", label: "ChainGPT General", icon: "chaingpt", tooltip: "Web3 campaigns", provider_id: "chaingpt" },
    { id: "gpt-4o-mini", label: "GPT-4o Mini", icon: "openai", tooltip: "Campaign drafting", provider_id: "openai" },
  ],
};

const BE_CHILDREN: RuntimeMenuItem[] = [
  { id: "persona",     label: "Persona",     icon: "users",              tooltip: "Your personas and iQube identity",              color: "#cbd5e1", enabled: true },
  { id: "memory",      label: "Memory",      icon: "sparkles",           tooltip: "Memory iQube and conversation history",         color: "#fcd34d", enabled: true },
  { id: "identity",    label: "Identity",    icon: "fingerprint",        tooltip: "Identity iQube and data sovereignty",           color: "#a5b4fc", enabled: true },
  { id: "connections", label: "Connections", icon: "network",            tooltip: "MetaMask and LinkedIn connections",              color: "#6ee7b7", enabled: true },
  { id: "settings",    label: "Settings",    icon: "sliders-horizontal", tooltip: "metaMe settings",                               color: "#94a3b8", enabled: true },
];

const MENU_ITEMS: RuntimeMenuItem[] = [
  {
    id: "be",
    label: "Be",
    icon: "users",
    tooltip: "Identity, persona, and trust context",
    color: "#cbd5e1",
    enabled: true,
    edge: true,
    children: BE_CHILDREN,
    trigger: {
      prompt: "I want to be...",
      intent: "be",
      surface_plan_instruction: "bias identity surfaces, profile cards, and context rails",
      copilot_instruction: "set intent to be and prioritize persona/trust guidance",
    },
  },
  {
    id: "earn",
    label: "Earn",
    icon: "coins",
    tooltip: "Rewards, offers, and settlement opportunities",
    color: "#6ee7b7",
    enabled: true,
    trigger: {
      prompt: "How can I earn...",
      intent: "earn",
      surface_plan_instruction: "prioritize earn modules, reward cards, and payout actions",
      copilot_instruction: "set intent to earn and surface reward pathways",
    },
  },
  {
    id: "play",
    label: "Play",
    icon: "play-circle",
    tooltip: "Interactive experiences and capsule launch",
    color: "#67e8f9",
    enabled: true,
    trigger: {
      prompt: "I'd like to play experiences.",
      intent: "play",
      surface_plan_instruction: "prioritize play/watch modules and interactive capsules",
      copilot_instruction: "set intent to play and surface interactive experiences first",
    },
  },
  {
    id: "make",
    label: "Make",
    icon: "pencil",
    tooltip: "Create, compose, and build",
    color: "#d8b4fe",
    enabled: true,
    trigger: {
      prompt: "I want to make...",
      intent: "make",
      surface_plan_instruction: "bias compose/create modules and editor surfaces",
      copilot_instruction: "set intent to make and prioritize creation workflows",
    },
  },
  {
    id: "share",
    label: "Share",
    icon: "share-2",
    tooltip: "Distribute capsules and invite collaborators",
    color: "#cbd5e1",
    enabled: true,
    edge: true,
    trigger: {
      prompt: "Help me find experiences to share.",
      intent: "share",
      surface_plan_instruction: "bias share-capable capsules and distribution actions",
      copilot_instruction: "map to share workflows and generate persona-aware links",
    },
  },
];

const QUICK_LINKS: RuntimeQuickLink[] = [
  { id: "quick-watch", label: "Watch", icon: "tv", prompt: "I'd like to watch experiences.", intent: "play" },
  { id: "quick-listen", label: "Listen", icon: "headphones", prompt: "I'd like to listen to experiences.", intent: "play" },
  { id: "quick-read", label: "Read", icon: "book-open", prompt: "I'd like to read experiences.", intent: "play" },
  { id: "quick-find", label: "Find", icon: "compass", prompt: "Help me find experiences.", intent: "find" },
  { id: "quick-share", label: "Share", icon: "share-2", prompt: "Help me find experiences to share.", intent: "share" },
];

const FLOATING_QUICK_LINKS: RuntimeQuickLink[] = [
  { id: "quick-refresh", label: "Refresh runtime", icon: "refresh-cw", prompt: "__runtime_refresh__", skip_inference: true },
  { id: "quick-reset", label: "Reset runtime", icon: "rotate-ccw", prompt: "__runtime_reset__", skip_inference: true },
  { id: "quick-preview-toggle", label: "Toggle native preview", icon: "maximize-2", prompt: "__runtime_toggle_fullscreen__", skip_inference: true },
];

const ACTION_ALIASES: Record<string, string> = {
  compass_be: "be",
  compass_earn: "earn",
  compass_play: "play",
  compass_make: "make",
  compass_share: "share",
};

const PROVIDER_SCORES: Record<string, { trust: number; reliability: number }> = {
  openai: { trust: 7.2, reliability: 7.3 },
  anthropic: { trust: 7.8, reliability: 7.2 },
  chaingpt: { trust: 8.0, reliability: 7.1 },
  venice: { trust: 8.8, reliability: 8.6 },
  thirdweb: { trust: 8.2, reliability: 8.4 },
  google: { trust: 7.2, reliability: 7.0 },
  default: { trust: 7.2, reliability: 7.0 },
};

const sessionStore = new Map<string, RuntimeState>();

const DEFAULT_RUNTIME_IFRAME_URL = "https://dev-beta.aigentz.me/metame/runtime?embed=1&shell=thin";
const DEFAULT_RUNTIME_IFRAME_PATH = "/metame/runtime";

function nowIso(): string {
  return new Date().toISOString();
}

function randomToken(): string {
  return crypto.randomBytes(16).toString("hex");
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeMode(value: unknown): RuntimeMenuMode | null {
  if (value === "triad" || value === "collapsed" || value === "full") return value;
  return null;
}

function normalizeDeviceHint(value: unknown): "desktop" | "tablet" | "mobile" | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "desktop" || normalized === "tablet" || normalized === "mobile") {
    return normalized;
  }
  return null;
}

function normalizeBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return null;
}

function normalizeRuntimeIframePath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, "") || "/";
  if (trimmed === "/runtime" || trimmed === "/") {
    return DEFAULT_RUNTIME_IFRAME_PATH;
  }
  return trimmed;
}

function normalizeRuntimeIframeUrl(input: string): string {
  try {
    const parsed = new URL(input);
    parsed.pathname = normalizeRuntimeIframePath(parsed.pathname);
    if (parsed.pathname === DEFAULT_RUNTIME_IFRAME_PATH && !parsed.searchParams.has("embed")) {
      parsed.searchParams.set("embed", "1");
    }
    if (parsed.pathname === DEFAULT_RUNTIME_IFRAME_PATH && !parsed.searchParams.has("shell")) {
      parsed.searchParams.set("shell", "thin");
    }
    return parsed.toString();
  } catch {
    return DEFAULT_RUNTIME_IFRAME_URL;
  }
}

function resolveIframeUrl(): string {
  const raw = asString(process.env.NEXT_PUBLIC_RUNTIME_IFRAME_URL) || DEFAULT_RUNTIME_IFRAME_URL;
  return normalizeRuntimeIframeUrl(raw);
}

function resolveIframeOrigin(iframeUrl: string): string {
  try {
    const explicit = asString(process.env.NEXT_PUBLIC_RUNTIME_IFRAME_ORIGIN);
    if (explicit) return new URL(explicit).origin;
  } catch {
    // fall through
  }
  try {
    return new URL(iframeUrl).origin;
  } catch {
    return "https://dev-beta.aigentz.me";
  }
}

function resolveAaApiBaseUrl(): string | null {
  return asString(process.env.NEXT_PUBLIC_AA_API_BASE_URL) || asString(process.env.AA_API_BASE_URL);
}

function resolveAaApiToken(): string | null {
  return asString(process.env.NEXT_PUBLIC_AA_API_TOKEN) || asString(process.env.AA_API_TOKEN);
}

function getAgentById(agentId: string): SelectorOption {
  return AGENT_OPTIONS.find((agent) => agent.id === agentId) || AGENT_OPTIONS[0];
}

function getLlmOptionsForAgent(agentId: string): SelectorOption[] {
  return LLM_OPTIONS_BY_AGENT[agentId] || LLM_OPTIONS_BY_AGENT["aigent-z"];
}

function getLlmById(agentId: string, llmId: string): SelectorOption {
  const options = getLlmOptionsForAgent(agentId);
  return options.find((model) => model.id === llmId) || options[0];
}

function resolveProviderId(option: SelectorOption): string {
  return option.provider_id || "default";
}

function trustStateFromScore(score: number): TrustState {
  if (score >= 8) return "ok";
  if (score >= 5) return "warn";
  return "fail";
}

function defaultRuntimeState(): RuntimeState {
  // LAUNCH OVERRIDE (KNYT activation campaign): default lead agent on arrival
  // is Kn0w1 (KNYT-aligned). Reverts to AGENT_OPTIONS[0] (Aigent Z / metaMe)
  // post-launch.
  const defaultAgent =
    AGENT_OPTIONS.find((a) => a.id === "aigent-kn0w1") ?? AGENT_OPTIONS[0];
  const defaultModel = getLlmOptionsForAgent(defaultAgent.id)[0];
  return {
    selected_aigent_id: defaultAgent.id,
    selected_llm_id: defaultModel?.id || "gpt-4o",
    menu_mode: "triad",
    welcome_complete: false,
    last_intent: null,
    last_action_id: null,
    updated_at: nowIso(),
  };
}

function sessionKey(ctx: RuntimeContext): string {
  return `${ctx.tenantId}::${ctx.personaId}`;
}

function getOrCreateState(ctx: RuntimeContext): RuntimeState {
  const key = sessionKey(ctx);
  const current = sessionStore.get(key);
  if (current) return current;
  const next = defaultRuntimeState();
  sessionStore.set(key, next);
  return next;
}

function inferIntentFromPrompt(prompt: string, fallback: RuntimeIntent = "find"): RuntimeIntent {
  const lower = prompt.toLowerCase();
  if (lower.includes("be") || lower.includes("identity") || lower.includes("persona")) return "be";
  if (lower.includes("earn") || lower.includes("reward") || lower.includes("payout")) return "earn";
  if (lower.includes("make") || lower.includes("create") || lower.includes("build")) return "make";
  if (lower.includes("share") || lower.includes("invite") || lower.includes("send")) return "share";
  if (lower.includes("play") || lower.includes("watch") || lower.includes("listen") || lower.includes("read")) return "play";
  if (lower.includes("find") || lower.includes("discover")) return "find";
  return fallback;
}

function updateStateForAgent(state: RuntimeState, aigentId: string, llmId?: string | null): RuntimeState {
  const nextAgent = getAgentById(aigentId);
  const llmOptions = getLlmOptionsForAgent(nextAgent.id);
  const requestedLlm = llmId ? llmOptions.find((model) => model.id === llmId) : null;
  const fallbackLlm = llmOptions[0];
  return {
    ...state,
    selected_aigent_id: nextAgent.id,
    selected_llm_id: requestedLlm?.id || fallbackLlm?.id || state.selected_llm_id,
    updated_at: nowIso(),
  };
}

function updateStateForModel(state: RuntimeState, llmId: string): RuntimeState {
  const llmOptions = getLlmOptionsForAgent(state.selected_aigent_id);
  const nextModel = llmOptions.find((model) => model.id === llmId) || llmOptions[0];
  return {
    ...state,
    selected_llm_id: nextModel?.id || state.selected_llm_id,
    updated_at: nowIso(),
  };
}

export function resolveRuntimeContext(request: NextRequest, body: Record<string, unknown> = {}): RuntimeContext {
  const url = new URL(request.url);
  const query = url.searchParams;
  const tenantId =
    asString(query.get("tenant_id")) ||
    asString(query.get("tenantId")) ||
    asString(body.tenant_id) ||
    asString(body.tenantId) ||
    asString(request.headers.get("x-tenant-id")) ||
    "metame";

  const personaId =
    asString(query.get("persona_id")) ||
    asString(query.get("personaId")) ||
    asString(body.persona_id) ||
    asString(body.personaId) ||
    asString(request.headers.get("x-persona-id")) ||
    "guest";

  const deviceHint =
    normalizeDeviceHint(query.get("device")) ||
    normalizeDeviceHint(query.get("device_type")) ||
    normalizeDeviceHint(body.device) ||
    normalizeDeviceHint(body.device_type) ||
    normalizeDeviceHint(request.headers.get("x-device-type")) ||
    "mobile";

  const processing =
    normalizeBoolean(query.get("processing")) ??
    normalizeBoolean(body.processing) ??
    normalizeBoolean(request.headers.get("x-runtime-processing")) ??
    false;

  return {
    tenantId,
    personaId,
    deviceHint,
    processing,
  };
}

function buildMenu(ctx: RuntimeContext, state: RuntimeState) {
  return {
    mode: state.menu_mode,
    items: MENU_ITEMS,
    policy: {
      collapse_to_metame_button: true,
      edge_items_when_needed: true,
      close_group_desktop_tablet: true,
      center_group_ids: ["earn", "play", "make"],
      triad_cluster_gap: "tight",
      color_map: {
        be: "#cbd5e1",
        earn: "#6ee7b7",
        play: "#67e8f9",
        make: "#d8b4fe",
        share: "#cbd5e1",
      },
      quick_links: QUICK_LINKS,
      floating_quick_links: FLOATING_QUICK_LINKS,
      prompt_box: {
        placeholder: "What do you want to do today?",
        send_icon: "send",
      },
      state_behavior: {
        welcome: {
          show_quick_links: true,
          show_prompt_box: true,
          floating_input: false,
        },
        post_welcome: {
          show_quick_links: false,
          show_prompt_box: false,
          floating_input: true,
        },
      },
      sharing: {
        enabled: true,
        track_endpoint: "/api/social/track",
        include_persona_in_deep_link: true,
        persona_id: ctx.personaId,
        tenant_id: ctx.tenantId,
      },
    },
  };
}

export function buildShellConfig(ctx: RuntimeContext, state: RuntimeState) {
  const activeAgent = getAgentById(state.selected_aigent_id);
  const llmOptions = getLlmOptionsForAgent(activeAgent.id);
  const activeLlm = getLlmById(activeAgent.id, state.selected_llm_id);
  const providerId = resolveProviderId(activeLlm);
  const baseScores = PROVIDER_SCORES[providerId] || PROVIDER_SCORES.default;
  const trust = Math.max(1, Math.min(10, baseScores.trust - (ctx.processing ? 0.3 : 0)));
  const reliability = Math.max(1, Math.min(10, baseScores.reliability - (ctx.processing ? 0.3 : 0)));
  const iframeUrl = resolveIframeUrl();
  const iframeOrigin = resolveIframeOrigin(iframeUrl);
  const aaApiBaseUrl = resolveAaApiBaseUrl();
  const aaApiToken = resolveAaApiToken();

  return {
    tenant_id: ctx.tenantId,
    persona_id: ctx.personaId,
    session: {
      trust_level: trustStateFromScore(trust) === "ok" ? "verified" : trustStateFromScore(trust) === "warn" ? "warning" : "unverified",
      trust_signals: [
        { key: "did", label: "DID Verified", state: ctx.personaId === "guest" ? ("warn" as TrustState) : ("ok" as TrustState) },
        { key: "iqube", label: "iQube Secured", state: "ok" as TrustState },
        { key: "trust", label: `Trust ${trust.toFixed(1)}/10`, state: trustStateFromScore(trust) },
        { key: "reliability", label: `Reliability ${reliability.toFixed(1)}/10`, state: trustStateFromScore(reliability) },
      ],
      scores: {
        trust: Number(trust.toFixed(2)),
        reliability: Number(reliability.toFixed(2)),
      },
    },
    selectors: {
      aigent: {
        current: activeAgent,
        options: AGENT_OPTIONS,
      },
      llm: {
        current: activeLlm,
        options: llmOptions,
      },
    },
    menu: buildMenu(ctx, state),
    iframe: {
      url: iframeUrl,
      postMessageOrigin: iframeOrigin,
      bootstrap: {
        handoff_token: `rt_${ctx.tenantId}_${ctx.personaId}_${randomToken()}`,
        context: {
          intent: state.last_intent || "find",
          state: state.welcome_complete ? "post_welcome" : "welcome",
          shell_mode: "thin",
          chrome_mode: "content-only",
          thin_shell: true,
          device: ctx.deviceHint,
          menu_mode: state.menu_mode,
          last_action_id: state.last_action_id,
          persona_id: ctx.personaId,
          tenant_id: ctx.tenantId,
          ...(aaApiBaseUrl ? { aa_api_base_url: aaApiBaseUrl } : {}),
          ...(aaApiToken ? { aa_api_token: aaApiToken } : {}),
        },
      },
    },
    sharing: {
      enabled: true,
      persona_id: ctx.personaId,
      tenant_id: ctx.tenantId,
      track_endpoint: "/api/social/track",
      platforms: ["X", "LinkedIn", "Facebook", "WhatsApp", "Telegram", "Discord", "TikTok", "Instagram", "Email"],
    },
  };
}

export function getShellConfigPayload(request: NextRequest) {
  const ctx = resolveRuntimeContext(request);
  const current = getOrCreateState(ctx);
  const modeOverride = normalizeMode(new URL(request.url).searchParams.get("mode"));
  const nextState = modeOverride ? { ...current, menu_mode: modeOverride, updated_at: nowIso() } : current;
  sessionStore.set(sessionKey(ctx), nextState);
  return buildShellConfig(ctx, nextState);
}

export function postSelectorsPayload(request: NextRequest, body: Record<string, unknown>) {
  const ctx = resolveRuntimeContext(request, body);
  const current = getOrCreateState(ctx);
  const requestedAgentId = asString(body.aigent_id) || current.selected_aigent_id;
  const requestedLlmId = asString(body.llm_id);
  let next = updateStateForAgent(current, requestedAgentId, requestedLlmId);
  if (!requestedAgentId || requestedAgentId === current.selected_aigent_id) {
    if (requestedLlmId) {
      next = updateStateForModel(next, requestedLlmId);
    }
  }
  sessionStore.set(sessionKey(ctx), next);
  const shellConfig = buildShellConfig(ctx, next);
  return {
    shell_config: shellConfig,
    selectors: shellConfig.selectors,
    session: shellConfig.session,
    menu: shellConfig.menu,
    iframe: shellConfig.iframe,
  };
}

export function postMenuActionPayload(request: NextRequest, body: Record<string, unknown>) {
  const ctx = resolveRuntimeContext(request, body);
  const current = getOrCreateState(ctx);
  const rawActionId = asString(body.action_id);
  if (!rawActionId) {
    return { status: 400, body: { error: "action_id is required" } };
  }

  const normalizedActionId = ACTION_ALIASES[rawActionId] || rawActionId;
  const menuItem = MENU_ITEMS.find((item) => item.id === normalizedActionId);
  const childItem = !menuItem ? MENU_ITEMS.flatMap((item) => item.children ?? []).find((child) => child.id === normalizedActionId) : null;
  const quickLink = QUICK_LINKS.find((item) => item.id === normalizedActionId);
  const floatingQuickLink = FLOATING_QUICK_LINKS.find((item) => item.id === normalizedActionId);

  if (!menuItem && !childItem && !quickLink && !floatingQuickLink) {
    return {
      status: 400,
      body: {
        error: `Unknown action_id: ${rawActionId}`,
        allowed_action_ids: [
          ...MENU_ITEMS.map((item) => item.id),
          ...MENU_ITEMS.flatMap((item) => (item.children ?? []).map((c) => c.id)),
          ...QUICK_LINKS.map((item) => item.id),
          ...FLOATING_QUICK_LINKS.map((item) => item.id),
        ],
      },
    };
  }

  if (childItem) {
    const next: RuntimeState = {
      ...current,
      welcome_complete: true,
      last_intent: "be",
      last_action_id: normalizedActionId,
      menu_mode: "collapsed",
      updated_at: nowIso(),
    };
    sessionStore.set(sessionKey(ctx), next);
    const shellConfig = buildShellConfig(ctx, next);
    return {
      status: 200,
      body: {
        shell_config: shellConfig,
        menu: shellConfig.menu,
        session: shellConfig.session,
        menu_event: {
          action_id: normalizedActionId,
          prompt: null,
          intent: "be",
          surface_plan_instruction: "open be sub-item drawer",
          copilot_instruction: `open drawer for be sub-item: ${normalizedActionId}`,
        },
        iframe_event: {
          type: "MENU_ACTION",
          action_id: normalizedActionId,
          intent: "be",
          prompt: null,
          payload: {
            action_id: normalizedActionId,
            intent: "be",
            prompt: null,
            menu_mode: "collapsed",
            tenant_id: ctx.tenantId,
            persona_id: ctx.personaId,
          },
        },
      },
    };
  }

  if (floatingQuickLink?.prompt === "__runtime_reset__") {
    return postPromptActionPayload(request, { prompt: "__runtime_reset__", payload: body.payload });
  }

  const trigger = menuItem?.trigger || {
    prompt: quickLink?.prompt || floatingQuickLink?.prompt || "Help me find experiences.",
    intent: quickLink?.intent || inferIntentFromPrompt(quickLink?.prompt || "find", "find"),
    surface_plan_instruction: "bias runtime surfaces for selected quick action",
    copilot_instruction: "map quick action prompt to copilot intent",
  };

  const requestedMode = normalizeMode((body.payload as Record<string, unknown> | undefined)?.menu_mode);
  const next: RuntimeState = {
    ...current,
    welcome_complete: true,
    last_intent: trigger.intent,
    last_action_id: normalizedActionId,
    menu_mode:
      requestedMode ||
      (trigger.intent === "be" || trigger.intent === "share" ? "collapsed" : "triad"),
    updated_at: nowIso(),
  };

  sessionStore.set(sessionKey(ctx), next);
  const shellConfig = buildShellConfig(ctx, next);

  return {
    status: 200,
    body: {
      shell_config: shellConfig,
      menu: shellConfig.menu,
      session: shellConfig.session,
      menu_event: {
        action_id: normalizedActionId,
        prompt: trigger.prompt,
        intent: trigger.intent,
        surface_plan_instruction: trigger.surface_plan_instruction,
        copilot_instruction: trigger.copilot_instruction,
      },
      iframe_event: {
        type: trigger.prompt.startsWith("__runtime_") ? "RUNTIME_COMMAND" : "MENU_ACTION",
        action_id: normalizedActionId,
        intent: trigger.intent,
        prompt: trigger.prompt,
        payload: {
          action_id: normalizedActionId,
          intent: trigger.intent,
          prompt: trigger.prompt,
          menu_mode: next.menu_mode,
          tenant_id: ctx.tenantId,
          persona_id: ctx.personaId,
        },
      },
    },
  };
}

export function postPromptActionPayload(request: NextRequest, body: Record<string, unknown>) {
  const ctx = resolveRuntimeContext(request, body);
  const current = getOrCreateState(ctx);
  const prompt = asString(body.prompt) || asString(body.text);
  if (!prompt) {
    return { status: 400, body: { error: "prompt (or text) is required" } };
  }

  const normalizedPrompt = prompt.trim().toLowerCase();
  if (normalizedPrompt === "__runtime_reset__") {
    const next: RuntimeState = {
      ...current,
      welcome_complete: false,
      last_intent: null,
      last_action_id: "prompt_reset",
      menu_mode: "triad",
      updated_at: nowIso(),
    };
    sessionStore.set(sessionKey(ctx), next);
    const shellConfig = buildShellConfig(ctx, next);
    return {
      status: 200,
      body: {
        shell_config: shellConfig,
        menu: shellConfig.menu,
        session: shellConfig.session,
        prompt_event: {
          prompt,
          intent: null,
        },
        iframe_event: {
          type: "RESET_WELCOME",
          payload: {
            reason: "prompt_reset",
            tenant_id: ctx.tenantId,
            persona_id: ctx.personaId,
          },
        },
      },
    };
  }

  const inferredIntent = inferIntentFromPrompt(prompt, current.last_intent || "find");
  const matchingAction = MENU_ITEMS.find((item) => item.trigger.intent === inferredIntent);
  const requestedMode = normalizeMode((body.payload as Record<string, unknown> | undefined)?.menu_mode);
  const next: RuntimeState = {
    ...current,
    welcome_complete: true,
    last_intent: inferredIntent,
    last_action_id: "prompt_submit",
    menu_mode: requestedMode || current.menu_mode || "triad",
    updated_at: nowIso(),
  };
  sessionStore.set(sessionKey(ctx), next);
  const shellConfig = buildShellConfig(ctx, next);

  return {
    status: 200,
    body: {
      shell_config: shellConfig,
      menu: shellConfig.menu,
      session: shellConfig.session,
      prompt_event: {
        prompt,
        intent: inferredIntent,
        surface_plan_instruction:
          matchingAction?.trigger.surface_plan_instruction || "route prompt through runtime intent planner",
        copilot_instruction:
          matchingAction?.trigger.copilot_instruction || "route prompt to metaMe copilot and sync resulting state",
      },
      iframe_event: {
        type: "PROMPT_SUBMIT",
        payload: {
          text: prompt,
          intent: inferredIntent,
          menu_mode: next.menu_mode,
          tenant_id: ctx.tenantId,
          persona_id: ctx.personaId,
        },
      },
    },
  };
}
