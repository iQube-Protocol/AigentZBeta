import crypto from 'crypto';
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../env.js';

/**
 * CRITICAL ARCHITECTURAL RULE
 * 
 * DO NOT expose this Railway endpoint directly to clients!
 * 
 * ALWAYS use the aa-proxy: https://bsjhfvctmduxhohtllly.supabase.co/functions/v1/aa-proxy/aa/v1/runtime/*
 * 
 * Why: aa-proxy provides iframe URL normalization and fallback protection.
 * Direct Railway usage causes 404 errors and has no safety net.
 * 
 * See: docs/qubetalk/AA_PROXY_ARCHITECTURAL_RULE.md
 */

type TrustState = 'ok' | 'warn' | 'fail';
type RuntimeMenuMode = 'triad' | 'collapsed' | 'full';

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
  intent: 'be' | 'earn' | 'play' | 'make' | 'share' | 'find';
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

type RuntimeState = {
  selected_aigent_id: string;
  selected_llm_id: string;
  menu_mode: RuntimeMenuMode;
  welcome_complete: boolean;
  last_intent: RuntimeMenuActionMeta['intent'] | null;
  last_action_id: string | null;
  updated_at: string;
};

type RuntimeContext = {
  tenantId: string;
  personaId: string;
  authMode: 'jwt' | 'anonymous';
  deviceHint: 'desktop' | 'tablet' | 'mobile';
};

const runtimeRouter = Router();

const AGENT_OPTIONS: SelectorOption[] = [
  { id: 'aigent-z', label: 'Aigent Z', icon: 'bot', tooltip: 'System orchestrator', color: '#67e8f9' },
  { id: 'aigent-kn0w1', label: 'Kn0w1', icon: 'brain', tooltip: 'Knowledge specialist', color: '#6ee7b7' },
  { id: 'aigent-moneypenny', label: 'MoneyPenny', icon: 'coins', tooltip: 'Treasury and settlement agent', color: '#c4b5fd' },
  { id: 'aigent-nakamoto', label: 'Nakamoto', icon: 'hexagon', tooltip: 'Crypto and protocol specialist', color: '#fcd34d' },
  { id: 'aigent-marketa', label: 'Marketa', icon: 'megaphone', tooltip: 'Growth and campaign strategist', color: '#fda4af' },
];

const LLM_OPTIONS_BY_AGENT: Record<string, SelectorOption[]> = {
  'aigent-z': [
    { id: 'gpt-4o', label: 'GPT-4o', icon: 'openai', tooltip: 'General orchestration', provider_id: 'openai' },
    { id: 'gpt-4o-mini', label: 'GPT-4o Mini', icon: 'openai', tooltip: 'Fast responses', provider_id: 'openai' },
    { id: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet', icon: 'anthropic', tooltip: 'Reasoning + reliability', provider_id: 'anthropic' },
    { id: 'venice-uncensored', label: 'Venice Uncensored', icon: 'venice', tooltip: 'Exploratory mode', provider_id: 'venice' },
    { id: 'chaingpt-general', label: 'ChainGPT General', icon: 'chaingpt', tooltip: 'Web3 context', provider_id: 'chaingpt' },
    { id: 'thirdweb-web3-llm', label: 'ThirdWeb Web3 LLM', icon: 'thirdweb', tooltip: 'Onchain workflows', provider_id: 'thirdweb' },
  ],
  'aigent-kn0w1': [
    { id: 'gpt-4o-mini', label: 'GPT-4o Mini', icon: 'openai', tooltip: 'Fast synthesis', provider_id: 'openai' },
    { id: 'venice-reasoning', label: 'Venice Reasoning', icon: 'venice', tooltip: 'Alternative reasoning path', provider_id: 'venice' },
    { id: 'claude-3-5-haiku', label: 'Claude 3.5 Haiku', icon: 'anthropic', tooltip: 'Concise analysis', provider_id: 'anthropic' },
  ],
  'aigent-moneypenny': [
    { id: 'gpt-4o-mini', label: 'GPT-4o Mini', icon: 'openai', tooltip: 'Transaction guidance', provider_id: 'openai' },
    { id: 'chaingpt-crypto', label: 'ChainGPT Crypto', icon: 'chaingpt', tooltip: 'Crypto-native analysis', provider_id: 'chaingpt' },
    { id: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet', icon: 'anthropic', tooltip: 'Audit-ready summaries', provider_id: 'anthropic' },
  ],
  'aigent-nakamoto': [
    { id: 'gpt-4o', label: 'GPT-4o', icon: 'openai', tooltip: 'Protocol architecture', provider_id: 'openai' },
    { id: 'venice-uncensored', label: 'Venice Uncensored', icon: 'venice', tooltip: 'Exploratory protocol ideation', provider_id: 'venice' },
    { id: 'chaingpt-code', label: 'ChainGPT Code', icon: 'chaingpt', tooltip: 'Smart-contract context', provider_id: 'chaingpt' },
    { id: 'claude-3-opus', label: 'Claude 3 Opus', icon: 'anthropic', tooltip: 'Deep technical reasoning', provider_id: 'anthropic' },
  ],
  'aigent-marketa': [
    { id: 'gpt-4o-mini', label: 'GPT-4o Mini', icon: 'openai', tooltip: 'Campaign drafting', provider_id: 'openai' },
    { id: 'thirdweb-web3-llm', label: 'ThirdWeb Web3 LLM', icon: 'thirdweb', tooltip: 'Web3 growth hooks', provider_id: 'thirdweb' },
    { id: 'claude-3-5-haiku', label: 'Claude 3.5 Haiku', icon: 'anthropic', tooltip: 'Short-form optimization', provider_id: 'anthropic' },
  ],
};

const MENU_ACTIONS: RuntimeMenuItem[] = [
  {
    id: 'be',
    label: 'Be',
    icon: 'users',
    tooltip: 'Identity, persona, and trust context',
    color: '#cbd5e1',
    enabled: true,
    edge: true,
    trigger: {
      prompt: 'I want to be...',
      intent: 'be',
      surface_plan_instruction: 'bias identity surfaces, profile cards, and context rails',
      copilot_instruction: 'set intent to be and prioritize persona/trust guidance',
    },
  },
  {
    id: 'earn',
    label: 'Earn',
    icon: 'coins',
    tooltip: 'Rewards, offers, and settlement opportunities',
    color: '#6ee7b7',
    enabled: true,
    trigger: {
      prompt: 'How can I earn...',
      intent: 'earn',
      surface_plan_instruction: 'prioritize earn modules, reward cards, and payout actions',
      copilot_instruction: 'set intent to earn and surface reward pathways',
    },
  },
  {
    id: 'play',
    label: 'Play',
    icon: 'play-circle',
    tooltip: 'Interactive experiences and capsule launch',
    color: '#67e8f9',
    enabled: true,
    trigger: {
      prompt: "I'd like to play experiences.",
      intent: 'play',
      surface_plan_instruction: 'prioritize play/watch modules and interactive capsules',
      copilot_instruction: 'set intent to play and surface interactive experiences first',
    },
  },
  {
    id: 'make',
    label: 'Make',
    icon: 'pencil',
    tooltip: 'Create, compose, and build',
    color: '#d8b4fe',
    enabled: true,
    trigger: {
      prompt: 'I want to make...',
      intent: 'make',
      surface_plan_instruction: 'bias compose/create modules and editor surfaces',
      copilot_instruction: 'set intent to make and prioritize creation workflows',
    },
  },
  {
    id: 'share',
    label: 'Share',
    icon: 'share-2',
    tooltip: 'Distribute capsules and invite collaborators',
    color: '#cbd5e1',
    enabled: true,
    edge: true,
    trigger: {
      prompt: 'Help me find experiences to share.',
      intent: 'find',
      surface_plan_instruction: 'bias share-capable capsules and drawer/share actions',
      copilot_instruction: 'map to find/share guidance and surface distribution channels',
    },
  },
];

const QUICK_LINKS = [
  { id: 'quick-watch', label: 'Watch', icon: 'tv', prompt: "I'd like to watch experiences." },
  { id: 'quick-listen', label: 'Listen', icon: 'headphones', prompt: "I'd like to listen to experiences." },
  { id: 'quick-read', label: 'Read', icon: 'book-open', prompt: "I'd like to read experiences." },
  { id: 'quick-find', label: 'Find', icon: 'compass', prompt: 'Help me find experiences.' },
];

const FLOATING_QUICK_LINKS = [
  { id: 'quick-refresh', label: 'Refresh runtime', icon: 'refresh-cw', prompt: '__runtime_refresh__', skip_inference: true },
  { id: 'quick-reset', label: 'Reset runtime', icon: 'rotate-ccw', prompt: '__runtime_reset__', skip_inference: true },
  {
    id: 'quick-preview-toggle',
    label: 'Toggle native preview',
    icon: 'maximize-2',
    prompt: '__runtime_toggle_fullscreen__',
    skip_inference: true,
  },
];

const ACTION_ALIASES: Record<string, string> = {
  compass_be: 'be',
  compass_earn: 'earn',
  compass_play: 'play',
  compass_make: 'make',
  compass_share: 'share',
};

const sessionStore = new Map<string, RuntimeState>();

function nowIso(): string {
  return new Date().toISOString();
}

function randomToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    const candidate = asString(value);
    if (candidate) return candidate;
  }
  return null;
}

function parseAuthPayload(authorizationHeader: string | undefined): Record<string, unknown> | null {
  const header = authorizationHeader || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  try {
    return jwt.verify(token, env.AA_JWT_SECRET) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function normalizeDeviceHint(value: unknown): 'desktop' | 'tablet' | 'mobile' | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'desktop' || normalized === 'tablet' || normalized === 'mobile') {
    return normalized;
  }
  return null;
}

function resolveRuntimeContext(req: any): RuntimeContext {
  const authPayload = parseAuthPayload(req.headers?.authorization as string | undefined);
  const body = (req.body || {}) as Record<string, unknown>;
  const query = (req.query || {}) as Record<string, unknown>;

  const tenantId =
    pickString(
      query.tenant_id,
      query.tenantId,
      body.tenant_id,
      body.tenantId,
      req.headers?.['x-tenant-id'],
      authPayload?.tenant_id,
      authPayload?.tenantId,
      env.DEFAULT_TENANT_ID,
      'metame'
    ) || 'metame';

  const personaId =
    pickString(
      query.persona_id,
      query.personaId,
      body.persona_id,
      body.personaId,
      req.headers?.['x-persona-id'],
      authPayload?.persona_id,
      authPayload?.personaId,
      authPayload?.did,
      env.DEFAULT_PERSONA_ID,
      'guest'
    ) || 'guest';

  const deviceHint =
    normalizeDeviceHint(query.device) ||
    normalizeDeviceHint(query.device_type) ||
    normalizeDeviceHint(body.device) ||
    normalizeDeviceHint(body.device_type) ||
    normalizeDeviceHint(req.headers?.['x-device-type']) ||
    'mobile';

  return {
    tenantId,
    personaId,
    authMode: authPayload ? 'jwt' : 'anonymous',
    deviceHint,
  };
}

function providerReliability(providerId: string | undefined): { trust: number; reliability: number } {
  switch (providerId) {
    case 'anthropic':
      return { trust: 7.8, reliability: 7.2 };
    case 'venice':
      return { trust: 8.8, reliability: 8.6 };
    case 'chaingpt':
      return { trust: 8.0, reliability: 7.1 };
    case 'thirdweb':
      return { trust: 8.2, reliability: 8.4 };
    case 'openai':
      return { trust: 7.2, reliability: 7.3 };
    default:
      return { trust: 7.2, reliability: 7.0 };
  }
}

function trustStateFromScore(score: number): TrustState {
  if (score >= 8) return 'ok';
  if (score >= 5) return 'warn';
  return 'fail';
}

function getAgentById(agentId: string): SelectorOption {
  return AGENT_OPTIONS.find((agent) => agent.id === agentId) || AGENT_OPTIONS[0];
}

function getLlmOptionsForAgent(agentId: string): SelectorOption[] {
  return LLM_OPTIONS_BY_AGENT[agentId] || LLM_OPTIONS_BY_AGENT['aigent-z'] || [];
}

function getLlmById(agentId: string, llmId: string): SelectorOption {
  const options = getLlmOptionsForAgent(agentId);
  return options.find((model) => model.id === llmId) || options[0];
}

function defaultRuntimeState(): RuntimeState {
  const defaultAgent = AGENT_OPTIONS[0];
  const defaultModel = getLlmOptionsForAgent(defaultAgent.id)[0];
  return {
    selected_aigent_id: defaultAgent.id,
    selected_llm_id: defaultModel?.id || 'gpt-4o',
    menu_mode: 'triad',
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

function normalizeMode(value: unknown): RuntimeMenuMode | null {
  if (value === 'triad' || value === 'collapsed' || value === 'full') return value;
  return null;
}

const DEFAULT_RUNTIME_IFRAME_URL = 'http://localhost:3000/metame/runtime?embed=1';
const DEFAULT_RUNTIME_IFRAME_PATH = '/metame/runtime';

function normalizeRuntimeIframePath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '') || '/';
  if (trimmed === '/runtime' || trimmed === '/') {
    return DEFAULT_RUNTIME_IFRAME_PATH;
  }
  return trimmed;
}

function normalizeRuntimeIframeUrl(input: string): string {
  try {
    const parsed = new URL(input);
    parsed.pathname = normalizeRuntimeIframePath(parsed.pathname);

    if (parsed.pathname === DEFAULT_RUNTIME_IFRAME_PATH && !parsed.searchParams.has('embed')) {
      parsed.searchParams.set('embed', '1');
    }
    if (parsed.pathname === DEFAULT_RUNTIME_IFRAME_PATH && !parsed.searchParams.has('shell')) {
      parsed.searchParams.set('shell', 'thin');
    }

    return parsed.toString();
  } catch {
    return DEFAULT_RUNTIME_IFRAME_URL;
  }
}

function resolveIframeUrl(): string {
  const raw =
    asString(env.RUNTIME_IFRAME_URL) ||
    asString(process.env.NEXT_PUBLIC_RUNTIME_IFRAME_URL) ||
    DEFAULT_RUNTIME_IFRAME_URL;

  return normalizeRuntimeIframeUrl(raw);
}

function parseOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function isLocalOrigin(origin: string | null): boolean {
  if (!origin) return false;
  try {
    const hostname = new URL(origin).hostname.toLowerCase();
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname.endsWith('.localhost')
    );
  } catch {
    return false;
  }
}

function resolveIframeOrigin(iframeUrl: string): string {
  const iframeUrlOrigin = parseOrigin(iframeUrl) || 'http://localhost:3000';
  const explicit =
    asString(env.RUNTIME_IFRAME_ORIGIN) ||
    asString(env.RUNTIME_POSTMESSAGE_ORIGIN) ||
    asString(process.env.NEXT_PUBLIC_RUNTIME_IFRAME_ORIGIN);

  if (!explicit) {
    return iframeUrlOrigin;
  }

  const explicitOrigin = parseOrigin(explicit);
  if (!explicitOrigin) {
    return iframeUrlOrigin;
  }

  // Defensive guard: never return localhost-style postMessage origin for a remote iframe URL.
  if (isLocalOrigin(explicitOrigin) && !isLocalOrigin(iframeUrlOrigin)) {
    return iframeUrlOrigin;
  }

  return explicitOrigin;
}

function buildMenu(state: RuntimeState) {
  return {
    mode: state.menu_mode,
    items: MENU_ACTIONS,
    policy: {
      collapse_to_metame_button: true,
      edge_items_when_needed: true,
      close_group_desktop_tablet: true,
      center_group_ids: ['earn', 'play', 'make'],
      triad_cluster_gap: 'tight',
      color_map: {
        be: '#cbd5e1',
        earn: '#6ee7b7',
        play: '#67e8f9',
        make: '#d8b4fe',
        share: '#cbd5e1',
      },
      quick_links: QUICK_LINKS,
      floating_quick_links: FLOATING_QUICK_LINKS,
      prompt_box: {
        placeholder: 'What do you want to do today?',
        send_icon: 'send',
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
    },
  };
}

function buildShellConfig(ctx: RuntimeContext, state: RuntimeState) {
  const activeAgent = getAgentById(state.selected_aigent_id);
  const llmOptions = getLlmOptionsForAgent(activeAgent.id);
  const activeLlm = getLlmById(activeAgent.id, state.selected_llm_id);
  const providerScores = providerReliability(activeLlm.provider_id);
  const trust = trustStateFromScore(providerScores.trust);
  const reliability = trustStateFromScore(providerScores.reliability);
  const iframeUrl = resolveIframeUrl();
  const iframeOrigin = resolveIframeOrigin(iframeUrl);

  return {
    tenant_id: ctx.tenantId,
    persona_id: ctx.personaId,
    session: {
      trust_level: trust === 'ok' ? 'verified' : trust === 'warn' ? 'warning' : 'unverified',
      trust_signals: [
        { key: 'did', label: 'DID Verified', state: ctx.authMode === 'jwt' ? ('ok' as TrustState) : ('warn' as TrustState) },
        { key: 'iqube', label: 'iQube Secured', state: 'ok' as TrustState },
        { key: 'trust', label: `Trust ${providerScores.trust.toFixed(1)}/10`, state: trust },
        { key: 'reliability', label: `Reliability ${providerScores.reliability.toFixed(1)}/10`, state: reliability },
      ],
      scores: {
        trust: Number(providerScores.trust.toFixed(2)),
        reliability: Number(providerScores.reliability.toFixed(2)),
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
    menu: buildMenu(state),
    iframe: {
      url: iframeUrl,
      postMessageOrigin: iframeOrigin,
      bootstrap: {
        handoff_token: `rt_${ctx.tenantId}_${ctx.personaId}_${randomToken()}`,
        context: {
          intent: state.last_intent || 'find',
          state: state.welcome_complete ? 'post_welcome' : 'welcome',
          shell_mode: 'thin',
          chrome_mode: 'content-only',
          thin_shell: true,
          device: ctx.deviceHint,
          menu_mode: state.menu_mode,
          last_action_id: state.last_action_id,
        },
      },
    },
  };
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

function inferIntentFromPrompt(prompt: string, fallback: RuntimeMenuActionMeta['intent'] = 'find'): RuntimeMenuActionMeta['intent'] {
  const lower = prompt.toLowerCase();
  if (lower.includes('be') || lower.includes('identity') || lower.includes('persona')) return 'be';
  if (lower.includes('earn') || lower.includes('reward') || lower.includes('payout')) return 'earn';
  if (lower.includes('play') || lower.includes('watch') || lower.includes('listen') || lower.includes('read')) return 'play';
  if (lower.includes('make') || lower.includes('create') || lower.includes('build')) return 'make';
  if (lower.includes('share') || lower.includes('find') || lower.includes('discover')) return 'find';
  return fallback;
}

runtimeRouter.get('/shell-config', (req, res) => {
  const ctx = resolveRuntimeContext(req);
  const modeOverride = normalizeMode((req.query as Record<string, unknown>)?.mode);
  const current = getOrCreateState(ctx);
  const nextState = modeOverride ? { ...current, menu_mode: modeOverride, updated_at: nowIso() } : current;
  sessionStore.set(sessionKey(ctx), nextState);
  res.json(buildShellConfig(ctx, nextState));
});

runtimeRouter.post('/selectors', (req, res) => {
  const ctx = resolveRuntimeContext(req);
  const current = getOrCreateState(ctx);
  const body = (req.body || {}) as Record<string, unknown>;
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
  res.json({
    shell_config: shellConfig,
    selectors: shellConfig.selectors,
    session: shellConfig.session,
    menu: shellConfig.menu,
    iframe: shellConfig.iframe,
  });
});

runtimeRouter.post('/menu-action', (req, res) => {
  const ctx = resolveRuntimeContext(req);
  const current = getOrCreateState(ctx);
  const body = (req.body || {}) as Record<string, unknown>;
  const rawActionId = asString(body.action_id);

  if (!rawActionId) {
    return res.status(400).json({ error: 'action_id is required' });
  }

  const normalizedActionId = ACTION_ALIASES[rawActionId] || rawActionId;
  const action = MENU_ACTIONS.find((item) => item.id === normalizedActionId);
  if (!action) {
    return res.status(400).json({
      error: `Unknown action_id: ${rawActionId}`,
      allowed_action_ids: MENU_ACTIONS.map((item) => item.id),
    });
  }

  let next: RuntimeState = {
    ...current,
    welcome_complete: true,
    last_intent: action.trigger.intent,
    last_action_id: action.id,
    updated_at: nowIso(),
  };

  const payload = (body.payload || {}) as Record<string, unknown>;
  const requestedMode = normalizeMode(payload.menu_mode);
  if (requestedMode) {
    next.menu_mode = requestedMode;
  } else if (action.id === 'be' || action.id === 'share') {
    next.menu_mode = 'collapsed';
  } else {
    next.menu_mode = 'triad';
  }

  sessionStore.set(sessionKey(ctx), next);
  const shellConfig = buildShellConfig(ctx, next);

  return res.json({
    shell_config: shellConfig,
    menu: shellConfig.menu,
    session: shellConfig.session,
    menu_event: {
      action_id: action.id,
      prompt: action.trigger.prompt,
      intent: action.trigger.intent,
      surface_plan_instruction: action.trigger.surface_plan_instruction,
      copilot_instruction: action.trigger.copilot_instruction,
      iframe_event: {
        type: 'MENU_ACTION',
        payload: {
          action_id: action.id,
          prompt: action.trigger.prompt,
          intent: action.trigger.intent,
          menu_mode: next.menu_mode,
        },
      },
    },
  });
});

runtimeRouter.post('/prompt-action', (req, res) => {
  const ctx = resolveRuntimeContext(req);
  const current = getOrCreateState(ctx);
  const body = (req.body || {}) as Record<string, unknown>;
  const prompt = asString(body.prompt) || asString(body.text);

  if (!prompt) {
    return res.status(400).json({ error: 'prompt (or text) is required' });
  }

  const normalizedPrompt = prompt.trim().toLowerCase();
  if (normalizedPrompt === '__runtime_reset__') {
    const next: RuntimeState = {
      ...current,
      welcome_complete: false,
      last_intent: null,
      last_action_id: 'prompt_reset',
      menu_mode: 'triad',
      updated_at: nowIso(),
    };
    sessionStore.set(sessionKey(ctx), next);
    const shellConfig = buildShellConfig(ctx, next);
    return res.json({
      shell_config: shellConfig,
      menu: shellConfig.menu,
      session: shellConfig.session,
      prompt_event: {
        prompt,
        intent: null,
        iframe_event: {
          type: 'RESET_WELCOME',
          payload: {
            reason: 'prompt_reset',
          },
        },
      },
    });
  }

  const inferredIntent = inferIntentFromPrompt(prompt, current.last_intent || 'find');
  const matchingAction = MENU_ACTIONS.find((item) => item.trigger.intent === inferredIntent);

  const requestedMode = normalizeMode((body.payload as Record<string, unknown> | undefined)?.menu_mode);
  const next: RuntimeState = {
    ...current,
    welcome_complete: true,
    last_intent: inferredIntent,
    last_action_id: 'prompt_submit',
    menu_mode: requestedMode || current.menu_mode || 'triad',
    updated_at: nowIso(),
  };

  sessionStore.set(sessionKey(ctx), next);
  const shellConfig = buildShellConfig(ctx, next);

  return res.json({
    shell_config: shellConfig,
    menu: shellConfig.menu,
    session: shellConfig.session,
    prompt_event: {
      prompt,
      intent: inferredIntent,
      surface_plan_instruction:
        matchingAction?.trigger.surface_plan_instruction || 'route prompt through runtime intent planner',
      copilot_instruction:
        matchingAction?.trigger.copilot_instruction || 'route prompt to metaMe copilot and sync resulting state',
      iframe_event: {
        type: 'PROMPT_SUBMIT',
        payload: {
          text: prompt,
          intent: inferredIntent,
          menu_mode: next.menu_mode,
        },
      },
    },
  });
});

export { runtimeRouter };
