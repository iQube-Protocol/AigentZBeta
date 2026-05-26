/**
 * Codex Copilot Chat API
 * 
 * Provides intelligent responses about the metaKnyts and Qriptopian universes
 * using codex metadata and user context for personalized AI responses.
 * 
 * User context is derived from:
 * - Wallet data (balances, purchases, holdings)
 * - Persona data (DiDQube identity)
 * - User prompts (intent analysis)
 * - Declared roles (investor, creative, developer, entrepreneur, fan)
 * 
 * Supports both domains:
 * - metaKnyts (KNYT Codex) - Kn0w1 persona
 * - Qriptopian (Qriptopian Codex) - MoneyPenny persona
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getEmbeddingService } from '@/services/content/embeddingService';
import {
  getAgentLlmProviders,
  normalizeAgentId,
  type LlmProviderId,
} from '@/services/metame/agentLlmOrchestra';
import { personas } from '@/app/data/personas';
import {
  buildComposerPromptParts,
  type ComposerSessionContext,
} from '@/services/copilot/composer';
import { getExperienceQube, getPersonalGuide } from '@/services/iqube/experienceQube';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Initialize embedding service for KB search
const embeddingService = getEmbeddingService();

// OpenAI configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const VENICE_API_KEY = process.env.VENICE_API_KEY;
const VENICE_MODEL = process.env.VENICE_MODEL || 'venice-uncensored';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet';
const CHAINGPT_API_KEY =
  process.env.CHAINGPT_API_KEY ||
  process.env.CHAIN_GPT_API_KEY ||
  process.env.CHAINGPT_API_SECRET ||
  process.env.CHAIN_GPT_API_SECRET ||
  null;
const CHAINGPT_MODEL = process.env.CHAINGPT_MODEL || 'general_assistant';

// ============================================================================
// Types
// ============================================================================

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

type UserRole = 'investor' | 'creative' | 'developer' | 'entrepreneur' | 'fan';
type ContentDomain = 'metaKnyts' | 'qriptopian' | 'protocol';

type BudgetPosture = 'low' | 'medium' | 'high';

interface UserContext {
  domain: ContentDomain;
  roles: UserRole[];
  primaryRole: UserRole;
  walletBalance?: number;
  nftCount?: number;
  isFirstVisit?: boolean;
  visitCount?: number;
  // metaMe settings — applied as policy constraints in system prompt
  guardianMode?: boolean;
  budgetPosture?: BudgetPosture;
  receiptVisibility?: boolean;
  skillFilter?: 'curated' | 'all';
  explanationFirst?: boolean;
  // metaMe cartridge enrichment — populated when the active runtime
  // agent is aigent-me. Reads ExperienceQube.meta + PersonalGuide.blak
  // server-side from the user's metaMe cartridge state. Surfaces the
  // user's declared focus, primary goal, stage, and active cartridges
  // to aigentMe so its responses are framed in the user's actual
  // workstream — not a generic system orchestrator voice.
  metameContext?: {
    experienceName?: string | null;
    experienceType?: string | null;
    primaryGoal?: string | null;
    currentStage?: string | null;
    activeCartridges?: string[];
    focusIntent?: string | null;
    alignmentState?: string | null;
  };
  /**
   * T1-safe snapshot of what the calling surface is currently rendering
   * (the live brief shape, move-forward bundle, expModel state). When
   * present, the system prompt instructs the LLM to narrate ONLY these
   * rows by label and rationale rather than inventing a template. Set
   * by the chat client on every POST when available; null/undefined =>
   * generic narrative falls back to KB / persona prompt.
   */
  groundContext?: Record<string, unknown> | null;
}

interface CodexMetadata {
  characters: any[];
  episodes: any[];
  stats: {
    characterCount: number;
    episodeCount: number;
    coverCount: number;
    masterCount: number;
  };
}

interface KBSearchResult {
  content: string;
  title: string;
  contentCategory: string;
  similarity: number;
}

interface ComposerFallbackInput {
  message: string;
  sessionContext?: ComposerSessionContext;
}

type RuntimeProviderId = Extract<LlmProviderId, 'openai' | 'venice' | 'chaingpt' | 'anthropic'>;

interface ProviderAttempt {
  providerId: RuntimeProviderId;
  modelId: string;
}

interface ProviderExecutionResult {
  providerId: RuntimeProviderId;
  modelId: string;
  content: string;
}

interface ProviderAvailability {
  openai: boolean;
  venice: boolean;
  anthropic: boolean;
  chaingpt: boolean;
}

type WalletActionId =
  | 'checkout'
  | 'wallet'
  | 'library'
  | 'tasks'
  | 'rewards'
  | 'reputation';

type WalletActionTab = 'wallet' | 'library' | 'tasks' | 'reputation' | 'rewards';

interface WalletAction {
  id: WalletActionId;
  label: string;
  prompt: string;
  tab: WalletActionTab;
}

function buildWalletAction(actionId: WalletActionId): WalletAction {
  switch (actionId) {
    case 'checkout':
      return {
        id: 'checkout',
        label: 'Open Checkout',
        prompt: 'Open wallet checkout for the selected item.',
        tab: 'wallet',
      };
    case 'wallet':
      return {
        id: 'wallet',
        label: 'Wallet Balance',
        prompt: 'Show wallet balance and spendable funds.',
        tab: 'wallet',
      };
    case 'library':
      return {
        id: 'library',
        label: 'Open Library',
        prompt: 'Open the wallet library tab.',
        tab: 'library',
      };
    case 'tasks':
      return {
        id: 'tasks',
        label: 'View Tasks',
        prompt: 'Open the wallet tasks tab.',
        tab: 'tasks',
      };
    case 'rewards':
      return {
        id: 'rewards',
        label: 'Claim Rewards',
        prompt: 'Open the wallet rewards tab.',
        tab: 'rewards',
      };
    case 'reputation':
    default:
      return {
        id: 'reputation',
        label: 'View Reputation',
        prompt: 'Open the wallet reputation tab.',
        tab: 'reputation',
      };
  }
}

function inferWalletActions(message: string, assistantMessage: string): WalletAction[] {
  const combined = `${message}\n${assistantMessage}`.toLowerCase();
  const requested = new Set<WalletActionId>();

  const register = (actionId: WalletActionId) => {
    if (requested.size >= 3) return;
    requested.add(actionId);
  };

  const tagMatches = Array.from(assistantMessage.matchAll(/\[wallet_action:([a-z_-]+)\]/gi));
  for (const match of tagMatches) {
    const raw = (match[1] || '').toLowerCase();
    if (raw === 'checkout') register('checkout');
    if (raw === 'wallet' || raw === 'balance') register('wallet');
    if (raw === 'library') register('library');
    if (raw === 'tasks') register('tasks');
    if (raw === 'rewards') register('rewards');
    if (raw === 'reputation') register('reputation');
  }

  if (/(checkout|purchase|buy|unlock|pay)/.test(combined)) register('checkout');
  if (/(wallet|balance|funds|spendable|q¢|qct)/.test(combined)) register('wallet');
  if (/(reward|claim|earn)/.test(combined)) register('rewards');
  if (/(task|quest|mission)/.test(combined)) register('tasks');
  if (/(library|owned|entitlement)/.test(combined)) register('library');
  if (/(reputation|trust|score)/.test(combined)) register('reputation');

  return Array.from(requested).map((actionId) => buildWalletAction(actionId));
}

function createEventMeta(source: string) {
  const eventId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${source}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    eventId,
    source,
    timestamp: new Date().toISOString(),
  };
}

function normalizeRuntimeProviderId(raw?: unknown): RuntimeProviderId | null {
  if (typeof raw !== 'string') return null;
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'openai') return 'openai';
  if (normalized === 'venice' || normalized === 'venice ai') return 'venice';
  if (normalized === 'anthropic' || normalized === 'claude' || normalized === 'anthropic ai') return 'anthropic';
  if (normalized === 'chaingpt' || normalized === 'chain gpt') return 'chaingpt';
  return null;
}

function providerHasApiKey(providerId: RuntimeProviderId): boolean {
  switch (providerId) {
    case 'openai':
      return Boolean(OPENAI_API_KEY);
    case 'venice':
      return Boolean(VENICE_API_KEY);
    case 'anthropic':
      return Boolean(ANTHROPIC_API_KEY);
    case 'chaingpt':
      return Boolean(CHAINGPT_API_KEY);
    default:
      return false;
  }
}

function getProviderAvailability(): ProviderAvailability {
  return {
    openai: providerHasApiKey('openai'),
    venice: providerHasApiKey('venice'),
    anthropic: providerHasApiKey('anthropic'),
    chaingpt: providerHasApiKey('chaingpt'),
  };
}

function defaultAgentIdForPersona(persona: string): string {
  if (persona === 'moneypenny') return 'aigent-moneypenny';
  if (persona.startsWith('aigent-')) return persona;
  return 'aigent-kn0w1';
}

function defaultModelForProvider(providerId: RuntimeProviderId): string {
  switch (providerId) {
    case 'openai':
      return OPENAI_MODEL;
    case 'venice':
      return VENICE_MODEL;
    case 'anthropic':
      return ANTHROPIC_MODEL;
    case 'chaingpt':
      return CHAINGPT_MODEL;
    default:
      return OPENAI_MODEL;
  }
}

function mapChainGptModelId(modelId?: string | null): string {
  const normalized = modelId?.trim().toLowerCase();
  if (!normalized) return CHAINGPT_MODEL;
  if (
    normalized === 'general_assistant' ||
    normalized === 'chaingpt-general' ||
    normalized === 'chaingpt-crypto' ||
    normalized === 'chaingpt-code'
  ) {
    return 'general_assistant';
  }
  return normalized;
}

function mapAnthropicModelId(modelId?: string | null): string {
  const normalized = modelId?.trim().toLowerCase();
  if (!normalized) return 'claude-sonnet-4-6';
  if (normalized === 'claude-3-5-sonnet') return 'claude-sonnet-4-6';
  if (normalized === 'claude-3-5-haiku') return 'claude-haiku-4-5-20251001';
  if (normalized === 'claude-3-opus') return 'claude-opus-4-6';
  return normalized;
}

function buildChainGptQuestion(systemPrompt: string, history: ChatMessage[], message: string): string {
  const priorTurns = history
    .filter((entry) => entry.role !== 'system')
    .map((entry) => `${entry.role === 'assistant' ? 'Assistant' : 'User'}: ${entry.content}`)
    .join('\n');

  return [
    systemPrompt,
    priorTurns ? `Conversation so far:\n${priorTurns}` : '',
    `User: ${message}`,
    'Respond directly to the latest user message while following the system guidance above.',
  ]
    .filter(Boolean)
    .join('\n\n');
}

async function parseErrorResponse(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function parsePossibleJson(raw: string): any {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function extractAnthropicText(data: any): string {
  if (!Array.isArray(data?.content)) return '';
  return data.content
    .filter((entry: any) => entry?.type === 'text' && typeof entry?.text === 'string')
    .map((entry: any) => entry.text)
    .join('\n')
    .trim();
}

function extractChainGptText(data: any): string {
  return typeof data?.data?.bot === 'string' ? data.data.bot.trim() : '';
}

function buildProviderAttempts(
  requestedProviderId: RuntimeProviderId | null,
  requestedModelId: string | null,
  agentId: string,
): { attempts: ProviderAttempt[]; skipped: Array<{ providerId: RuntimeProviderId; reason: string }> } {
  const normalizedAgentId = normalizeAgentId(agentId) || normalizeAgentId(defaultAgentIdForPersona('kn0w1'));
  const configuredProviders = normalizedAgentId ? getAgentLlmProviders(normalizedAgentId) : [];
  const attempts: ProviderAttempt[] = [];
  const skipped = new Map<RuntimeProviderId, string>();

  const pushAttempt = (providerId: RuntimeProviderId, modelId?: string | null) => {
    if (!providerHasApiKey(providerId)) {
      if (!skipped.has(providerId)) {
        skipped.set(providerId, 'API key not visible to server runtime');
      }
      return;
    }
    const resolvedModelId = modelId || defaultModelForProvider(providerId);
    if (attempts.some((entry) => entry.providerId === providerId && entry.modelId === resolvedModelId)) return;
    attempts.push({ providerId, modelId: resolvedModelId });
  };

  if (requestedProviderId) {
    const requestedProvider = configuredProviders.find((entry) => entry.id === requestedProviderId);
    const requestedModel =
      requestedModelId && requestedProvider?.models.find((model) => model.id === requestedModelId)?.id;
    pushAttempt(requestedProviderId, requestedModel || requestedModelId);
  }

  for (const provider of configuredProviders) {
    if (
      provider.id !== 'openai' &&
      provider.id !== 'venice' &&
      provider.id !== 'anthropic' &&
      provider.id !== 'chaingpt'
    ) {
      continue;
    }
    const preferredModel =
      requestedProviderId === provider.id && requestedModelId
        ? requestedModelId
        : provider.models[0]?.id || defaultModelForProvider(provider.id);
    pushAttempt(provider.id, preferredModel);
  }

  for (const fallbackProviderId of ['openai', 'venice', 'anthropic', 'chaingpt'] as RuntimeProviderId[]) {
    pushAttempt(fallbackProviderId);
  }

  return {
    attempts,
    skipped: Array.from(skipped.entries()).map(([providerId, reason]) => ({ providerId, reason })),
  };
}

async function callOpenAi(messages: ChatMessage[], modelId: string): Promise<ProviderExecutionResult> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: modelId || OPENAI_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 16000,
    }),
  });

  if (!response.ok) {
    const errorData = await parseErrorResponse(response);
    throw new Error(`OpenAI request failed: ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error('OpenAI returned an empty completion');
  }

  return {
    providerId: 'openai',
    modelId: modelId || OPENAI_MODEL,
    content,
  };
}

async function callVenice(messages: ChatMessage[], modelId: string): Promise<ProviderExecutionResult> {
  const response = await fetch('https://api.venice.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${VENICE_API_KEY}`,
    },
    body: JSON.stringify({
      model: modelId || VENICE_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 16000,
    }),
  });

  if (!response.ok) {
    const errorData = await parseErrorResponse(response);
    throw new Error(`Venice request failed: ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error('Venice returned an empty completion');
  }

  return {
    providerId: 'venice',
    modelId: modelId || VENICE_MODEL,
    content,
  };
}

async function callAnthropic(
  systemPrompt: string,
  history: ChatMessage[],
  message: string,
  modelId: string,
): Promise<ProviderExecutionResult> {
  const anthropicMessages = [
    ...history.filter((entry) => entry.role !== 'system'),
    { role: 'user' as const, content: message },
  ].map((entry) => ({
    role: entry.role,
    content: entry.content,
  }));

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY || '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: mapAnthropicModelId(modelId || ANTHROPIC_MODEL),
      system: systemPrompt,
      messages: anthropicMessages,
      max_tokens: 4096,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorData = await parseErrorResponse(response);
    throw new Error(`Anthropic request failed: ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  const content = extractAnthropicText(data);
  if (!content) {
    throw new Error('Anthropic returned an empty completion');
  }

  return {
    providerId: 'anthropic',
    modelId: mapAnthropicModelId(modelId || ANTHROPIC_MODEL),
    content,
  };
}

async function callChainGpt(
  systemPrompt: string,
  history: ChatMessage[],
  message: string,
  modelId: string,
): Promise<ProviderExecutionResult> {
  const response = await fetch('https://api.chaingpt.org/chat/stream', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${CHAINGPT_API_KEY}`,
    },
    body: JSON.stringify({
      model: mapChainGptModelId(modelId),
      question: buildChainGptQuestion(systemPrompt, history, message),
      chatHistory: 'off',
    }),
  });

  if (!response.ok) {
    const errorData = await parseErrorResponse(response);
    throw new Error(`ChainGPT request failed: ${JSON.stringify(errorData)}`);
  }

  const raw = await response.text();
  const data = parsePossibleJson(raw);
  const content =
    typeof data === 'string'
      ? data.trim()
      : extractChainGptText(data);
  if (!content) {
    throw new Error('ChainGPT returned an empty completion');
  }

  return {
    providerId: 'chaingpt',
    modelId: mapChainGptModelId(modelId),
    content,
  };
}

// ============================================================================
// Marketa Tool Calling
// ============================================================================

const MARKETA_TOOLS_ANTHROPIC = [
  {
    name: 'list_workflows',
    description: 'List available workflow definitions for the current tenant so you can tell the user what automation scenarios are available.',
    input_schema: {
      type: 'object' as const,
      properties: {
        tenantId: { type: 'string', description: 'The tenant ID to list workflows for' },
      },
      required: ['tenantId'],
    },
  },
  {
    name: 'invoke_workflow',
    description: 'Execute a workflow by its ID. Use this to actually run an automation scenario rather than just describing how to do it.',
    input_schema: {
      type: 'object' as const,
      properties: {
        workflowId: { type: 'string', description: 'The workflow definition UUID to invoke' },
        tenantId: { type: 'string', description: 'The tenant ID' },
        personaId: { type: 'string', description: 'The persona ID triggering the invocation' },
        input: { type: 'object', description: 'Input data to pass to the workflow' },
      },
      required: ['workflowId', 'tenantId', 'personaId'],
    },
  },
  {
    name: 'deploy_campaign',
    description: 'Deploy a Marketa campaign by its campaign ID. This triggers the full campaign deployment pipeline.',
    input_schema: {
      type: 'object' as const,
      properties: {
        campaignId: { type: 'string', description: 'The campaign ID to deploy' },
        tenantId: { type: 'string', description: 'The tenant ID' },
      },
      required: ['campaignId', 'tenantId'],
    },
  },
  {
    name: 'generate_image',
    description: 'Generate portrait and/or landscape images using AI. Use this when the user asks to create, generate, or produce images, artwork, or visual assets.',
    input_schema: {
      type: 'object' as const,
      properties: {
        portrait_prompt: { type: 'string', description: 'Prompt for portrait orientation image' },
        landscape_prompt: { type: 'string', description: 'Prompt for landscape orientation image' },
        provider_id: { type: 'string', enum: ['openai', 'venice'], description: 'Image provider — defaults to venice' },
        experience_id: { type: 'string', description: 'Optional experience ID to associate the image with' },
      },
    },
  },
  {
    name: 'generate_video',
    description: 'Generate a video clip from a text prompt. Use when the user asks to create, generate, or produce video content.',
    input_schema: {
      type: 'object' as const,
      properties: {
        prompt: { type: 'string', description: 'Detailed description of the video to generate' },
        skill_id: { type: 'string', enum: ['sora_video_gen_curated', 'venice_video_gen'], description: 'Video provider — use sora_video_gen_curated for high quality, venice_video_gen as alternative' },
        duration: { type: 'number', description: 'Duration in seconds (4-12 for Sora, 5-10 for Venice)' },
        aspect_ratio: { type: 'string', enum: ['16:9', '9:16', '1:1'], description: 'Video aspect ratio' },
        style: { type: 'string', enum: ['cinematic', 'animation', 'comic', 'photorealistic'], description: 'Visual style' },
        experience_id: { type: 'string', description: 'Optional experience ID' },
      },
      required: ['prompt', 'skill_id'],
    },
  },
  {
    name: 'draft_article',
    description: 'Generate a structured article draft with title, sections, and optional takeaways. Use when the user asks to write, draft, or create written content.',
    input_schema: {
      type: 'object' as const,
      properties: {
        prompt: { type: 'string', description: 'Goal or topic for the article' },
        title: { type: 'string', description: 'Optional article title' },
        outputs: { type: 'array', items: { type: 'string', enum: ['takeaways', 'glossary', 'next_action'] }, description: 'Optional output sections to include' },
        takeawaysCount: { type: 'number', description: 'Number of takeaways (1-5)' },
        mediaMode: { type: 'string', enum: ['image', 'video'], description: 'Media context for the article' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'create_image_article_bundle',
    description: 'Generate both an image (portrait + landscape) AND a supporting article draft together. Use this when the user wants a complete image-led content package.',
    input_schema: {
      type: 'object' as const,
      properties: {
        image_prompt: { type: 'string', description: 'Prompt used for both portrait and landscape images' },
        article_prompt: { type: 'string', description: 'Topic or goal for the article' },
        article_title: { type: 'string', description: 'Optional article title' },
        provider_id: { type: 'string', enum: ['openai', 'venice'], description: 'Image provider — defaults to venice' },
        experience_id: { type: 'string', description: 'Optional experience ID to associate assets with' },
      },
      required: ['image_prompt', 'article_prompt'],
    },
  },
  {
    name: 'create_video_article_bundle',
    description: 'Generate a video clip AND a supporting article draft together. Use this when the user wants a complete video-led content package.',
    input_schema: {
      type: 'object' as const,
      properties: {
        video_prompt: { type: 'string', description: 'Detailed description of the video to generate' },
        article_prompt: { type: 'string', description: 'Topic or goal for the article' },
        article_title: { type: 'string', description: 'Optional article title' },
        skill_id: { type: 'string', enum: ['sora_video_gen_curated', 'venice_video_gen'], description: 'Video provider' },
        duration: { type: 'number', description: 'Duration in seconds' },
        aspect_ratio: { type: 'string', enum: ['16:9', '9:16', '1:1'] },
        style: { type: 'string', enum: ['cinematic', 'animation', 'comic', 'photorealistic'] },
        experience_id: { type: 'string', description: 'Optional experience ID' },
      },
      required: ['video_prompt', 'article_prompt'],
    },
  },
  {
    name: 'deploy_experience',
    description: 'Deploy a completed experience to a delivery target — metaMe runtime thin client, metaMe runtime (full), Discord (as asset link, inline embed, or experience), or Studio preview. Use this when the user wants to publish, launch, distribute, or send an experience to the runtime or Discord.',
    input_schema: {
      type: 'object' as const,
      properties: {
        experienceId: { type: 'string', description: 'The ExperienceQube ID to deploy' },
        tenantId: { type: 'string', description: 'The tenant ID' },
        personaId: { type: 'string', description: 'The persona ID' },
        target: {
          type: 'string',
          enum: ['studio_preview', 'runtime_launch', 'runtime_thin_client', 'discord_mcp', 'mcp_app'],
          description: 'Deployment target — runtime_thin_client for thin-client runtime, discord_mcp for Discord, runtime_launch for full runtime, studio_preview for internal preview',
        },
        variant: {
          type: 'string',
          enum: ['runtime_standard', 'runtime_thin_client', 'asset_link', 'discord_asset_inline', 'discord_experience_inline'],
          description: 'Delivery variant — runtime_thin_client for thin client, asset_link for a Discord link, discord_asset_inline for inline Discord embed',
        },
        mode: {
          type: 'string',
          enum: ['simulate', 'live'],
          description: 'simulate to preview without actually posting, live to publish for real',
        },
        message: { type: 'string', description: 'Message text to accompany the experience (required for Discord)' },
        channelId: { type: 'string', description: 'Discord channel snowflake ID (required for live Discord dispatch)' },
        inviteUrl: { type: 'string', description: 'Discord invite URL (alternative to channelId for channel resolution)' },
        publishUrl: { type: 'string', description: 'URL to the published asset or experience' },
        thumbnailUrl: { type: 'string', description: 'Thumbnail image URL for embed preview' },
        titleOverride: { type: 'string', description: 'Override the experience title in the embed' },
        tool: {
          type: 'string',
          enum: ['pill.get', 'capsule.get', 'mini_runtime.get', 'codex.entry', 'invite.create', 'share.compose', 'next.best'],
          description: 'MCP delivery tool — use mini_runtime.get for runtime thin client, next.best to auto-select the best option',
        },
      },
      required: ['experienceId', 'tenantId', 'personaId', 'target', 'mode'],
    },
  },
  {
    name: 'check_discord_status',
    description: 'Check if the Discord bot is configured and has access to a specific channel. Call this before attempting a live Discord deployment to confirm the bot is ready.',
    input_schema: {
      type: 'object' as const,
      properties: {
        channelId: { type: 'string', description: 'Discord channel snowflake ID to check access for' },
        inviteUrl: { type: 'string', description: 'Discord invite URL (alternative to channelId)' },
      },
    },
  },
];

const MARKETA_TOOLS_OPENAI = MARKETA_TOOLS_ANTHROPIC.map((t) => ({
  type: 'function' as const,
  function: {
    name: t.name,
    description: t.description,
    parameters: t.input_schema,
  },
}));

async function executeMarketaTool(name: string, input: Record<string, unknown>): Promise<string> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  try {
    if (name === 'list_workflows') {
      const res = await fetch(`${base}/api/workflows?tenant_id=${encodeURIComponent(String(input.tenantId ?? ''))}&limit=20`);
      const json = await res.json();
      const workflows = (json.workflows ?? []).map((w: any) => ({ id: w.id, name: w.name, adapter: w.adapter, status: w.status }));
      return JSON.stringify({ workflows });
    }
    if (name === 'invoke_workflow') {
      const res = await fetch(`${base}/api/workflows/${input.workflowId}/invoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          envelope: { tenantId: input.tenantId, personaId: input.personaId },
          input: input.input ?? {},
        }),
      });
      const json = await res.json();
      return JSON.stringify(json);
    }
    if (name === 'deploy_campaign') {
      const res = await fetch(`${base}/api/marketa/campaigns/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: input.campaignId, tenantId: input.tenantId }),
      });
      const json = await res.json();
      return JSON.stringify(json);
    }
    if (name === 'generate_image') {
      const res = await fetch(`${base}/api/skills/image/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider_id: input.provider_id ?? 'venice',
          portrait_prompt: input.portrait_prompt,
          landscape_prompt: input.landscape_prompt,
          experience_id: input.experience_id,
        }),
      });
      const json = await res.json();
      const images = (json.images ?? []).map((img: any) => ({ orientation: img.orientation, ok: img.ok, image_url: img.image_url, error: img.error }));
      return JSON.stringify({ ok: json.ok, provider: json.provider, images });
    }
    if (name === 'generate_video') {
      const res = await fetch(`${base}/api/skills/invoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skill_id: input.skill_id ?? 'venice_video_gen',
          prompt: input.prompt,
          duration: input.duration,
          aspect_ratio: input.aspect_ratio,
          style: input.style,
          experience_id: input.experience_id,
          trust_override: true,
        }),
      });
      const json = await res.json();
      return JSON.stringify({ ok: json.ok, provider: json.provider, video_url: json.video_url, generation_id: json.generation_id, provider_status: json.provider_status });
    }
    if (name === 'draft_article') {
      const res = await fetch(`${base}/api/composer/article-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: input.prompt, title: input.title, outputs: input.outputs, takeawaysCount: input.takeawaysCount, mediaMode: input.mediaMode }),
      });
      const json = await res.json();
      return JSON.stringify({ ok: json.ok, articleDraft: json.articleDraft });
    }
    if (name === 'create_image_article_bundle') {
      const [imgRes, artRes] = await Promise.all([
        fetch(`${base}/api/skills/image/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider_id: input.provider_id ?? 'venice', portrait_prompt: input.image_prompt, landscape_prompt: input.image_prompt, experience_id: input.experience_id }),
        }),
        fetch(`${base}/api/composer/article-draft`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: input.article_prompt, title: input.article_title }),
        }),
      ]);
      const [imgJson, artJson] = await Promise.all([imgRes.json(), artRes.json()]);
      return JSON.stringify({
        images: (imgJson.images ?? []).map((img: any) => ({ orientation: img.orientation, ok: img.ok, image_url: img.image_url })),
        articleDraft: artJson.articleDraft,
      });
    }
    if (name === 'create_video_article_bundle') {
      const [vidRes, artRes] = await Promise.all([
        fetch(`${base}/api/skills/invoke`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ skill_id: input.skill_id ?? 'venice_video_gen', prompt: input.video_prompt, duration: input.duration, aspect_ratio: input.aspect_ratio, style: input.style, experience_id: input.experience_id, trust_override: true }),
        }),
        fetch(`${base}/api/composer/article-draft`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: input.article_prompt, title: input.article_title, mediaMode: 'video' }),
        }),
      ]);
      const [vidJson, artJson] = await Promise.all([vidRes.json(), artRes.json()]);
      return JSON.stringify({
        video: { ok: vidJson.ok, provider: vidJson.provider, video_url: vidJson.video_url, generation_id: vidJson.generation_id, provider_status: vidJson.provider_status },
        articleDraft: artJson.articleDraft,
      });
    }
    if (name === 'deploy_experience') {
      const target = String(input.target ?? 'runtime_thin_client');
      const defaultVariant = target === 'discord_mcp' ? 'asset_link' : 'runtime_thin_client';
      const res = await fetch(`${base}/api/messenger/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: target === 'discord_mcp' ? 'discord' : 'runtime',
          tenantId: input.tenantId,
          experienceId: input.experienceId,
          personaId: input.personaId,
          mode: input.mode ?? 'simulate',
          target,
          variant: input.variant ?? defaultVariant,
          tool: input.tool ?? 'next.best',
          message: input.message ?? '',
          channelId: input.channelId,
          inviteUrl: input.inviteUrl,
          publishUrl: input.publishUrl,
          thumbnailUrl: input.thumbnailUrl,
          titleOverride: input.titleOverride,
        }),
      });
      const json = await res.json();
      return JSON.stringify({
        ok: json.success,
        target,
        variant: json.deployment?.variant,
        status: json.success ? 'dispatched' : 'failed',
        publishUrl: json.deployment?.publishUrl,
        ctaUrl: json.deployment?.ctaUrl,
        capability: json.capability,
        liveDispatch: json.liveDispatch,
        warnings: json.warnings,
        error: json.error,
      });
    }
    if (name === 'check_discord_status') {
      const params = new URLSearchParams();
      if (input.channelId) params.set('channelId', String(input.channelId));
      if (input.inviteUrl) params.set('inviteUrl', String(input.inviteUrl));
      const res = await fetch(`${base}/api/messenger/discord/status?${params}`);
      const json = await res.json();
      return JSON.stringify({ ready: json.ready, checks: json.checks, details: json.details, errors: json.errors });
    }
    return JSON.stringify({ error: `Unknown tool: ${name}` });
  } catch (err: any) {
    return JSON.stringify({ error: err?.message ?? 'Tool execution failed' });
  }
}

async function callAnthropicWithTools(
  systemPrompt: string,
  history: ChatMessage[],
  message: string,
  modelId: string,
): Promise<ProviderExecutionResult> {
  const anthropicMessages: any[] = [
    ...history.filter((e) => e.role !== 'system').map((e) => ({ role: e.role, content: e.content })),
    { role: 'user', content: message },
  ];

  let response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY || '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: mapAnthropicModelId(modelId || ANTHROPIC_MODEL),
      system: systemPrompt,
      messages: anthropicMessages,
      tools: MARKETA_TOOLS_ANTHROPIC,
      max_tokens: 4096,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorData = await parseErrorResponse(response);
    throw new Error(`Anthropic request failed: ${JSON.stringify(errorData)}`);
  }

  let data = await response.json();

  // Tool use loop — max 3 rounds
  let rounds = 0;
  while (data.stop_reason === 'tool_use' && rounds < 3) {
    rounds++;
    const toolUseBlocks = (data.content ?? []).filter((b: any) => b.type === 'tool_use');
    const toolResults: any[] = [];
    for (const block of toolUseBlocks) {
      const result = await executeMarketaTool(block.name, block.input ?? {});
      toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
    }
    // Append assistant turn + tool results
    anthropicMessages.push({ role: 'assistant', content: data.content });
    anthropicMessages.push({ role: 'user', content: toolResults });

    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: mapAnthropicModelId(modelId || ANTHROPIC_MODEL),
        system: systemPrompt,
        messages: anthropicMessages,
        tools: MARKETA_TOOLS_ANTHROPIC,
        max_tokens: 4096,
        temperature: 0.7,
      }),
    });
    if (!response.ok) {
      const errorData = await parseErrorResponse(response);
      throw new Error(`Anthropic tool follow-up failed: ${JSON.stringify(errorData)}`);
    }
    data = await response.json();
  }

  const content = extractAnthropicText(data);
  if (!content) throw new Error('Anthropic returned an empty completion');
  return { providerId: 'anthropic', modelId: mapAnthropicModelId(modelId || ANTHROPIC_MODEL), content };
}

async function callOpenAiWithTools(messages: ChatMessage[], modelId: string): Promise<ProviderExecutionResult> {
  let currentMessages: any[] = messages;

  let response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: modelId || OPENAI_MODEL,
      messages: currentMessages,
      tools: MARKETA_TOOLS_OPENAI,
      tool_choice: 'auto',
      temperature: 0.7,
      max_tokens: 16000,
    }),
  });

  if (!response.ok) {
    const errorData = await parseErrorResponse(response);
    throw new Error(`OpenAI request failed: ${JSON.stringify(errorData)}`);
  }

  let data = await response.json();
  let choice = data?.choices?.[0];

  // Tool use loop — max 3 rounds
  let rounds = 0;
  while (choice?.finish_reason === 'tool_calls' && rounds < 3) {
    rounds++;
    const toolCalls = choice.message?.tool_calls ?? [];
    currentMessages = [...currentMessages, choice.message];
    for (const tc of toolCalls) {
      let inputObj: Record<string, unknown> = {};
      try { inputObj = JSON.parse(tc.function?.arguments ?? '{}'); } catch { /* ignore */ }
      const result = await executeMarketaTool(tc.function?.name ?? '', inputObj);
      currentMessages.push({ role: 'tool', tool_call_id: tc.id, content: result });
    }
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: modelId || OPENAI_MODEL,
        messages: currentMessages,
        tools: MARKETA_TOOLS_OPENAI,
        tool_choice: 'auto',
        temperature: 0.7,
        max_tokens: 16000,
      }),
    });
    if (!response.ok) {
      const errorData = await parseErrorResponse(response);
      throw new Error(`OpenAI tool follow-up failed: ${JSON.stringify(errorData)}`);
    }
    data = await response.json();
    choice = data?.choices?.[0];
  }

  const content = choice?.message?.content?.trim();
  if (!content) throw new Error('OpenAI returned an empty completion');
  return { providerId: 'openai', modelId: modelId || OPENAI_MODEL, content };
}

async function executeProviderAttempt(
  attempt: ProviderAttempt,
  systemPrompt: string,
  history: ChatMessage[],
  message: string,
  isMarketa: boolean,
): Promise<ProviderExecutionResult> {
  switch (attempt.providerId) {
    case 'openai':
      if (isMarketa) {
        return callOpenAiWithTools(
          [{ role: 'system', content: systemPrompt }, ...history, { role: 'user', content: message }],
          attempt.modelId,
        );
      }
      return callOpenAi([...history, { role: 'user', content: message }], attempt.modelId);
    case 'venice':
      return callVenice([...history, { role: 'user', content: message }], attempt.modelId);
    case 'anthropic':
      if (isMarketa) {
        return callAnthropicWithTools(systemPrompt, history, message, attempt.modelId);
      }
      return callAnthropic(systemPrompt, history, message, attempt.modelId);
    case 'chaingpt':
      return callChainGpt(systemPrompt, history, message, attempt.modelId);
    default:
      throw new Error(`Unsupported provider: ${attempt.providerId}`);
  }
}

function buildComposerSystemPrompt(sessionContext: ComposerSessionContext): string {
  return buildComposerPromptParts(sessionContext)
    .map((part) => part.content.trim())
    .filter(Boolean)
    .join('\n\n');
}

function generateComposerFallbackResponse({
  message,
  sessionContext,
}: ComposerFallbackInput): string {
  const normalized = message.toLowerCase();
  const templateName = sessionContext?.templateContext.selectedTemplateName;
  const providerList = sessionContext?.resourceContext.selectedProviders?.join(', ');
  const phase = sessionContext?.studioContext.currentPhase || 'Intent';

  if (/(article|image|portrait|landscape|hero)/.test(normalized)) {
    return [
      `I can help you shape an image-led experience from the current ${phase} phase.`,
      templateName ? `Current template: **${templateName}**.` : `I recommend starting from an article-friendly template.`,
      `For alpha, I can guide **portrait** and **landscape** asset planning together so the runtime has orientation-aware imagery.`,
      providerList
        ? `Current providers in context: **${providerList}**.`
        : `For alpha, **OpenAI** and **Venice** are both valid image providers.`,
      `If you want, I can help refine the prompts, required resources, and the next Studio step.`,
    ].join('\n\n');
  }

  if (/(video|sora|venice|clip|trailer|motion)/.test(normalized)) {
    return [
      `I can help you shape a video-led experience from the current ${phase} phase.`,
      templateName ? `Current template: **${templateName}**.` : `I recommend starting from a video-capable template.`,
      providerList
        ? `Current providers in context: **${providerList}**.`
        : `For alpha, **OpenAI** and **Venice** are both valid video providers.`,
      `I can compare provider tradeoffs, suggest a concise prompt, and route you into Customizer and Resources.`,
    ].join('\n\n');
  }

  if (/(deploy|discord|mcp|receipt|dvn|parity|surface)/.test(normalized)) {
    return [
      `I can help review the current experience through **Parity Review**, **Surface Planning**, and **DVN Receipts**.`,
      `From there I can guide deployment options such as **MCP-backed delivery** and Discord-oriented flows once the experience is ready.`,
    ].join('\n\n');
  }

  return [
    `I can help you move from **Intent** through **Template**, **Customizer**, **Resources**, **Experiences**, **Preview**, and **Parity Review**.`,
    `Tell me whether you want an **image-led article**, a **video-led experience**, or a **deployment/proof review** and I will guide the next step.`,
  ].join('\n\n');
}

// ── Protocol KB Query Detection ─────────────────────────────────────────────
// Returns true when the message touches protocol economics topics.
// Triggers a secondary KB search against domain='protocol' for all agents.
const PROTOCOL_PATTERNS = [
  /\bqc\b/i, /qriptocent/i, /q¢/i, /\$knyt/i, /\bknyt\b.*token/i,
  /token.*\bknyt\b/i, /micro.?stable/i, /micro.?payment/i, /settlement rail/i,
  /pricing rail/i, /franchise token/i, /knyt.*treasury/i, /treasury.*knyt/i,
  /knyt.*reward/i, /reward.*knyt/i, /what is qc/i, /what is \$knyt/i,
  /qc.*vs.*knyt|\bknyt.*vs.*qc/i, /difference.*qc|qc.*differ/i,
];

function isProtocolQuery(message: string): boolean {
  return PROTOCOL_PATTERNS.some(p => p.test(message));
}

// ── Kn0w1 Inference Core ────────────────────────────────────────────────────

type Know1SkillId =
  | 'information_value_interpret'
  | 'risk_frame_humanize'
  | 'pricing_logic_explain'
  | 'knyt_treasury_explain'
  | 'knyt_rewards_explain'
  | 'qc_vs_knyt_explain'
  | '21sats_structure_explain'
  | 'opportunity_shape';

const SKILL_INTENT_PATTERNS: Array<{ skill: Know1SkillId; patterns: RegExp[] }> = [
  { skill: 'knyt_treasury_explain',      patterns: [/treasury/i, /what.*hold/i, /\bfund\b/i] },
  { skill: 'knyt_rewards_explain',       patterns: [/reward/i, /\bearn\b/i, /\$knyt/i, /balance/i, /how much.*have/i, /provisional/i, /finalised?/i] },
  { skill: 'qc_vs_knyt_explain',         patterns: [/\bqc\b/i, /qriptocent/i, /qc.*vs|vs.*qc/i, /difference.*qc/i, /qc.*differ/i, /qc.*\$knyt|\$knyt.*qc/i] },
  { skill: 'pricing_logic_explain',      patterns: [/pric/i, /\bcost\b/i, /how much.*skill/i, /session.*cost/i, /\bfee\b/i] },
  { skill: '21sats_structure_explain',   patterns: [/21\s*sats/i, /satoshi/i, /\bavs\b/i, /sub.?tenant/i] },
  { skill: 'opportunity_shape',          patterns: [/next.*move/i, /what.*(?:do|should)/i, /how.*participate/i, /venture/i, /progression/i, /my path/i] },
  { skill: 'risk_frame_humanize',        patterns: [/\brisk/i, /uncertain/i, /\bvolatil/i, /\bsafe\b/i] },
  { skill: 'information_value_interpret', patterns: [/\bworth\b/i, /value of/i, /what.*mean/i, /\binterpret\b/i] },
];

function detectSkillIntent(message: string): Know1SkillId | null {
  for (const { skill, patterns } of SKILL_INTENT_PATTERNS) {
    if (patterns.some(p => p.test(message))) return skill;
  }
  return null;
}

interface KnytLiveContext {
  knyt_balance: number | null;
  signal_counts: { like: number; spark: number; curate: number; total: number } | null;
  patronage_stage: string | null;
  pcs_stage: string | null;
  active_elections: Array<{ id: string; title: string; closes_at: string | null; branch: string }>;
  recent_participation: Array<{ action_type: string; created_at: string; provisional: boolean }>;
}

async function fetchKnytLiveContext(personaId?: string): Promise<KnytLiveContext> {
  const empty: KnytLiveContext = {
    knyt_balance: null, signal_counts: null, patronage_stage: null,
    pcs_stage: null, active_elections: [], recent_participation: [],
  };

  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return empty;

  const db = createClient(url, key);

  // Wrap Supabase PromiseLike in a real Promise with timeout + error swallow
  function safeQuery<T>(query: PromiseLike<{ data: T | null }>, fallback: T, ms = 3000): Promise<T> {
    return Promise.race([
      Promise.resolve(query).then(({ data }) => data ?? fallback).catch(() => fallback),
      new Promise<T>(r => setTimeout(() => r(fallback), ms)),
    ]);
  }

  const [balanceRows, journeyRow, signalRows, electionsRows, participationRows] =
    await Promise.all([
      personaId
        ? safeQuery(db.from('knyt_reward_grants').select('amount_knyt').eq('persona_id', personaId), [])
        : Promise.resolve([]),
      personaId
        ? safeQuery(db.from('journey_states').select('stage').eq('persona_id', personaId)
            .order('active_at', { ascending: false }).limit(1).maybeSingle() as PromiseLike<{ data: { stage: string } | null }>, null)
        : Promise.resolve(null),
      personaId
        ? safeQuery(db.from('knyt_signals').select('signal_type').eq('persona_id', personaId), [])
        : Promise.resolve([]),
      safeQuery(
        db.from('knyt_elections').select('id, title, closes_at, branch')
          .eq('status', 'open').order('closes_at', { ascending: true }).limit(3),
        []
      ),
      personaId
        ? safeQuery(db.from('knyt_qc_events').select('action_type, created_at, provisional')
            .eq('persona_id', personaId).order('created_at', { ascending: false }).limit(5), [])
        : Promise.resolve([]),
    ]);

  const stage = (journeyRow as { stage: string } | null)?.stage ?? 'prospect';
  const rows = signalRows as Array<{ signal_type: string }>;
  const like   = rows.filter(s => s.signal_type === 'like').length;
  const spark  = rows.filter(s => s.signal_type === 'spark').length;
  const curate = rows.filter(s => s.signal_type === 'curate').length;
  const total  = like + spark + curate;
  const signalCounts = rows.length > 0 ? { like, spark, curate, total } : null;
  const pcsStageLabel = (() => {
    if (total >= 100) return 'Upstream'; if (total >= 50) return 'Creator';
    if (total >= 20) return 'Operator'; if (total >= 10) return 'Correspondent';
    if (total >= 3) return 'Community'; return 'Participant';
  })();
  const patronageMap: Record<string, string> = {
    prospect: 'Outside Order', acolyte: 'Apprentice', keta: 'Knight',
    keji: 'Esquire', first: 'Sennight', zero: 'Satoshi',
  };
  const balance = (balanceRows as Array<{ amount_knyt: unknown }>)
    .reduce((s, g) => s + parseFloat(String(g.amount_knyt ?? 0)), 0);

  return {
    knyt_balance: (balanceRows as unknown[]).length > 0 ? parseFloat(balance.toFixed(8)) : null,
    signal_counts: signalCounts,
    patronage_stage: personaId ? (patronageMap[stage] ?? 'Outside Order') : null,
    pcs_stage: personaId ? pcsStageLabel : null,
    active_elections: electionsRows as KnytLiveContext['active_elections'],
    recent_participation: participationRows as KnytLiveContext['recent_participation'],
  };
}

// Search Knowledge Base for relevant content with timeout
async function searchKnowledgeBase(
  query: string, 
  domain: ContentDomain,
  limit: number = 3
): Promise<KBSearchResult[]> {
  try {
    // Bumped from 5s → 15s. The original 5s budget routinely blew through on
    // cold-Lambda starts where the embedding provider needed extra time to
    // warm up — the agent then answered without KB context ("I don't have
    // specific information about iQubes…"). 15s is still well within the
    // route's overall timeout.
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('KB search timeout')), 15000)
    );

    const searchPromise = embeddingService.hybridSearch(query, domain, limit);

    const results = await Promise.race([searchPromise, timeoutPromise]);

    console.log(`[CodexChat] KB search domain=${domain} found ${results.length} results`);

    return results.map(r => ({
      content: r.content,
      title: r.metadata.title || 'Unknown',
      contentCategory: r.metadata.contentCategory || 'general',
      similarity: r.similarity,
    }));
  } catch (error) {
    console.error(`[CodexChat] KB search error (domain=${domain}):`, error);
    return [];
  }
}

// Fetch codex metadata for context (supports both metaKnyts and qriptopian domains)
async function fetchCodexMetadata(domain: ContentDomain = 'metaKnyts'): Promise<CodexMetadata> {
  if (domain === 'qriptopian') {
    // Fetch Qriptopian-specific content
    const { data: articles } = await supabase
      .from('smart_content_qubes')
      .select('id, title, description, content_type, domain')
      .eq('domain', 'qriptopian')
      .limit(20);

    const { count: contentCount } = await supabase
      .from('smart_content_qubes')
      .select('*', { count: 'exact', head: true })
      .eq('domain', 'qriptopian');

    return {
      characters: [], // Qriptopian uses articles, not characters
      episodes: (articles || []).map(a => ({
        id: a.id,
        title: a.title,
        synopsis: a.description,
        issue_number: a.content_type,
      })),
      stats: {
        characterCount: 0,
        episodeCount: contentCount || 0,
        coverCount: 0,
        masterCount: 0,
      },
    };
  }

  // Default: ONLY return metaKnyts content when the caller explicitly
  // asked for the metaKnyts domain. The previous behaviour dumped
  // KNYT characters / cards / episodes into the LLM prompt for EVERY
  // domain that wasn't 'qriptopian' — including 'agentiq' (aigentMe
  // copilot) — which produced KNYT-flavoured narrative on briefs that
  // had nothing to do with KNYT. Fix 2026-05-26: any unrecognised
  // domain returns an empty content scaffold so the LLM falls back to
  // its general / persona-prompt knowledge instead of being primed
  // with lore that doesn't apply.
  if (domain !== 'metaKnyts') {
    return {
      characters: [],
      episodes: [],
      stats: { characterCount: 0, episodeCount: 0, coverCount: 0, masterCount: 0 },
    };
  }

  const { data: characters } = await supabase
    .from('codex_characters')
    .select(`
      id, digiterra_name, terra_name, profile, affiliation,
      height, weight, origin_ethnicity, base
    `)
    .eq('series', 'metaKnyts');

  const { data: knytCards } = await supabase
    .from('codex_knyt_cards')
    .select(`
      id, character_id, powers, primary_weapon, secondary_weapons, first_appearance
    `)
    .eq('series', 'metaKnyts');

  const { data: episodes } = await supabase
    .from('codex_episodes')
    .select(`
      id, season_number, issue_number, episode_number, title,
      knytcard_focus, synopsis, intro_quote, end_quote
    `)
    .eq('series', 'metaKnyts')
    .eq('is_current', true)
    .order('episode_number');

  const { count: coverCount } = await supabase
    .from('codex_media_assets')
    .select('*', { count: 'exact', head: true })
    .eq('asset_type', 'cover');

  const { count: masterCount } = await supabase
    .from('master_content_qubes')
    .select('*', { count: 'exact', head: true });

  // Merge KNYT cards into characters
  const charactersWithCards = (characters || []).map(char => {
    const card = (knytCards || []).find(c => c.character_id === char.id);
    return { ...char, knyt_card: card || null };
  });

  return {
    characters: charactersWithCards,
    episodes: episodes || [],
    stats: {
      characterCount: charactersWithCards.length,
      episodeCount: (episodes || []).length,
      coverCount: coverCount || 0,
      masterCount: masterCount || 0
    }
  };
}

// ============================================================================
// Intent Analysis (Server-side)
// ============================================================================

const INTENT_KEYWORDS: Record<string, string[]> = {
  invest: ['invest', 'buy', 'purchase', 'stake', 'portfolio', 'value', 'price', 'roi', 'returns', 'token'],
  create: ['create', 'design', 'art', 'draw', 'write', 'story', 'character', 'concept', 'creative'],
  build: ['build', 'develop', 'integrate', 'api', 'sdk', 'code', 'technical', 'documentation', 'developer'],
  explore: ['show', 'browse', 'discover', 'explore', 'what', 'tell me', 'learn about', 'see'],
  collect: ['collect', 'nft', 'rare', 'edition', 'mint', 'drop', 'cover', 'card'],
};

function inferPrimaryRole(message: string, declaredRoles?: UserRole[]): UserRole {
  // Use declared role if provided
  if (declaredRoles?.length) {
    return declaredRoles[0];
  }

  const lowerMessage = message.toLowerCase();
  
  // Check for role-indicating keywords
  if (INTENT_KEYWORDS.invest.some(kw => lowerMessage.includes(kw))) return 'investor';
  if (INTENT_KEYWORDS.create.some(kw => lowerMessage.includes(kw))) return 'creative';
  if (INTENT_KEYWORDS.build.some(kw => lowerMessage.includes(kw))) return 'developer';
  if (INTENT_KEYWORDS.collect.some(kw => lowerMessage.includes(kw))) return 'fan';
  
  // Default to fan
  return 'fan';
}

// ============================================================================
// Role-Based Content Emphasis
// ============================================================================

function getRoleGuidelines(role: UserRole): string {
  switch (role) {
    case 'investor':
      return `
## User Context: INVESTOR
This user is interested in the investment and collectible aspects of metaKnyts.
- Emphasize collectible value, rarity, and market potential
- Highlight staking rewards and tokenomics when relevant
- Mention partnership opportunities and ecosystem growth
- Reference roadmap milestones and upcoming releases
- Be professional and data-oriented in your responses`;

    case 'creative':
      return `
## User Context: CREATIVE
This user is an artist, writer, or content creator interested in the creative universe.
- Emphasize visual storytelling, art direction, and character design
- Highlight the lore, world-building, and narrative depth
- Mention creative tools and contribution opportunities
- Reference concept art, character backstories, and visual elements
- Be inspiring and detail-oriented about creative aspects`;

    case 'developer':
      return `
## User Context: DEVELOPER
This user is a technical builder interested in integrating with metaKnyts.
- Emphasize technical architecture and integration possibilities
- Highlight APIs, SDKs, and developer documentation
- Mention smart contract details and blockchain mechanics
- Reference technical roadmap and infrastructure
- Be precise and technical in your explanations`;

    case 'entrepreneur':
      return `
## User Context: ENTREPRENEUR
This user is business-focused and interested in partnership opportunities.
- Emphasize business models and revenue opportunities
- Highlight partnership programs and licensing options
- Mention market reach and community engagement metrics
- Reference business development contacts and programs
- Be professional and opportunity-focused`;

    case 'fan':
    default:
      return `
## User Context: FAN
This user is a story enthusiast interested in the metaKnyts universe.
- Emphasize characters, storylines, and lore
- Highlight episode recommendations and reading order
- Mention community events and fan engagement
- Reference character relationships and story arcs
- Be enthusiastic and immersive in your storytelling`;
  }
}

// Agents that need the KNYT codex character/episode context injected
const KNYT_FOCUSED_AGENTS = new Set(['aigent-kn0w1', 'aigent-marketa']);

/**
 * Load the metaMe cartridge state for a persona so aigentMe can answer
 * inside the user's actual workstream context. Reads ExperienceQube.meta
 * (experience name / type, primary goal, current stage, active cartridges)
 * and PersonalGuide.blak (focus intent, alignment state).
 *
 * Returns null when either:
 *   - personaId is missing / not a string (anonymous chat — generic mode)
 *   - getExperienceQube returns null (no cartridge state yet)
 *
 * Errors are caught and swallowed (returns null) so a hiccup in the
 * cartridge store doesn't break the chat — generic mode is the safe
 * fallback.
 */
async function loadMetameContext(
  personaId: string | undefined | null,
): Promise<UserContext['metameContext']> {
  if (!personaId || typeof personaId !== 'string') return undefined;
  try {
    const [qube, guide] = await Promise.all([
      getExperienceQube(personaId).catch(() => null),
      getPersonalGuide(personaId).catch(() => null),
    ]);
    if (!qube && !guide) return undefined;
    return {
      experienceName:   qube?.meta.experienceName ?? null,
      experienceType:   qube?.meta.experienceType ?? null,
      primaryGoal:      qube?.meta.primaryGoal ?? null,
      currentStage:     qube?.meta.currentStage ?? null,
      activeCartridges: qube?.meta.activeCartridges ?? [],
      focusIntent:      guide?.focusIntent ?? null,
      alignmentState:   guide?.alignmentState ?? null,
    };
  } catch {
    return undefined;
  }
}

// Build system prompt with codex context, user role, and KB content
function buildSystemPrompt(
  metadata: CodexMetadata,
  aigentId: string,
  userContext?: UserContext,
  kbContext?: KBSearchResult[],
  liveContext?: KnytLiveContext,
  activeSkill?: Know1SkillId | null,
): string {
  // Normalize short keys ('marketa', 'kn0w1') to full IDs ('aigent-marketa', 'aigent-kn0w1')
  const resolvedPersonaId = normalizeAgentId(aigentId) ?? 'aigent-kn0w1';
  const personaConfig =
    personas[resolvedPersonaId as keyof typeof personas] ??
    personas['aigent-kn0w1'];
  const personaIntro = personaConfig.systemPrompt;

  // Get role-specific guidelines
  const roleGuidelines = userContext ? getRoleGuidelines(userContext.primaryRole) : getRoleGuidelines('fan');

  // Build metaMe policy block when settings are present
  const policyLines: string[] = [];
  if (userContext) {
    if (userContext.guardianMode) {
      policyLines.push('- GUARDIAN MODE is ON: Before taking any action on behalf of the user, briefly state what you are about to do and wait for explicit confirmation.');
    }
    if (userContext.explanationFirst) {
      policyLines.push('- EXPLAIN BEFORE ACTING: Always explain your plan or reasoning before executing any step or making recommendations.');
    }
    if (userContext.budgetPosture === 'low') {
      policyLines.push('- SPEND AUTONOMY: Low — never recommend purchases or token spend without explicit user request. Flag costs clearly.');
    } else if (userContext.budgetPosture === 'medium') {
      policyLines.push('- SPEND AUTONOMY: Medium — may suggest low-cost actions but always show the price first.');
    } else if (userContext.budgetPosture === 'high') {
      policyLines.push('- SPEND AUTONOMY: High — may proactively surface purchase opportunities when relevant.');
    }
    if (userContext.skillFilter === 'curated') {
      policyLines.push('- CURATED SKILLS ONLY: Only invoke or reference skills from the pre-approved curated skill set. Do not suggest or use experimental or community skills.');
    }
    if (userContext.receiptVisibility === false) {
      policyLines.push('- RECEIPTS: Suppress transaction receipt display in responses.');
    }
  }
  const policyBlock = policyLines.length > 0
    ? `\n\n## Active Policy Rules (metaMe Settings)\n\n${policyLines.join('\n')}`
    : '';

  // metaMe cartridge context — only rendered for aigent-me. Surfaces the
  // user's ExperienceQube + PersonalGuide state so aigentMe answers
  // inside their actual workstream context rather than as a generic
  // system orchestrator. Loaded by loadMetameContext() in the POST
  // handler; absent fields are omitted (no hallucination of state).
  const metameLines: string[] = [];
  if (resolvedPersonaId === 'aigent-me' && userContext?.metameContext) {
    const m = userContext.metameContext;
    if (m.experienceName)   metameLines.push(`- Current experience: **${m.experienceName}**${m.experienceType ? ` (${m.experienceType})` : ''}`);
    if (m.primaryGoal)      metameLines.push(`- Primary goal: ${m.primaryGoal}`);
    if (m.currentStage)     metameLines.push(`- Current stage: ${m.currentStage}`);
    if (m.activeCartridges && m.activeCartridges.length > 0) {
      metameLines.push(`- Active cartridges: ${m.activeCartridges.join(', ')}`);
    }
    if (m.focusIntent)      metameLines.push(`- Today's focus (PersonalGuide): ${m.focusIntent}`);
    if (m.alignmentState)   metameLines.push(`- Alignment state: ${m.alignmentState}`);
  }
  const metameContextBlock = metameLines.length > 0
    ? `\n\n## User's metaMe Cartridge State\n\nFrame your reply inside this context — these are the facts the user has declared. Do not invent or override them.\n\n${metameLines.join('\n')}`
    : '';

  // Right-pane ground truth — when the host surface tells us what's
  // currently on screen, the LLM MUST narrate that exact shape instead
  // of inventing a generic template. Only emitted for aigent-me and
  // only when groundContext carries usable structure. Skipped when the
  // payload is empty so we don't add noise.
  let groundContextBlock = '';
  if (resolvedPersonaId === 'aigent-me' && userContext?.groundContext) {
    try {
      const gc = userContext.groundContext as Record<string, unknown>;
      const brief = gc.brief as Record<string, unknown> | null | undefined;
      const moveForward = gc.moveForward as Record<string, unknown> | null | undefined;
      const expModel = gc.experienceModel as Record<string, unknown> | null | undefined;
      const pending = gc.pendingApproval as Record<string, unknown> | null | undefined;
      const queuedIds = Array.isArray(gc.queuedIntentIds) ? (gc.queuedIntentIds as string[]) : [];
      const activeCartridges = Array.isArray(gc.activeCartridges) ? (gc.activeCartridges as string[]) : [];

      const lines: string[] = [];

      if (brief && Array.isArray(brief.nextBestActions) && (brief.nextBestActions as unknown[]).length > 0) {
        const priorities = (brief.topPriorities as Array<{ label?: string; cartridge?: string }> | undefined) ?? [];
        const nbas = (brief.nextBestActions as Array<Record<string, unknown>>) ?? [];
        lines.push(`### Active brief on the right pane`);
        if (brief.experienceName) lines.push(`- Experience: **${brief.experienceName}**`);
        if (brief.primaryGoal)    lines.push(`- Primary goal: ${brief.primaryGoal}`);
        if (brief.currentStage)   lines.push(`- Stage: ${brief.currentStage}`);
        if (priorities.length > 0) {
          lines.push(`- Top priorities:`);
          for (const p of priorities.slice(0, 6)) {
            if (p?.label) lines.push(`  • ${p.label}${p.cartridge ? ` (${p.cartridge})` : ''}`);
          }
        }
        lines.push(`- Next-best actions (deterministic + LLM-reranked):`);
        for (let i = 0; i < nbas.length; i++) {
          const a = nbas[i];
          const label = typeof a.label === 'string' ? a.label : 'Unnamed action';
          const cartridge = typeof a.cartridge === 'string' ? a.cartridge : '';
          const rationale = typeof a.rationale === 'string' ? a.rationale : '';
          const impact = typeof a.impact === 'string' ? ` · ${a.impact} impact` : '';
          const approval = a.approvalRequired ? ' · approval required' : '';
          const hint = typeof a.promptHint === 'string' && a.promptHint.length > 0 ? `\n     hint: ${a.promptHint}` : '';
          const artifact = typeof a.suggestedArtifact === 'string' && a.suggestedArtifact ? ` · suggested artifact: ${a.suggestedArtifact}` : '';
          lines.push(`  ${i + 1}. **${label}** (${cartridge})${impact}${approval}${artifact}\n     why: ${rationale}${hint}`);
        }
      }

      if (moveForward && (moveForward.topAction || (Array.isArray(moveForward.alternates) && (moveForward.alternates as unknown[]).length > 0))) {
        lines.push(`### Move-forward bundle on the right pane`);
        if (moveForward.cartridge) lines.push(`- Cartridge focus: ${moveForward.cartridge}`);
        if (moveForward.topActionReason) lines.push(`- Top action reason: ${moveForward.topActionReason}`);
        const top = moveForward.topAction as Record<string, unknown> | null | undefined;
        if (top) {
          const hint = typeof top.promptHint === 'string' && top.promptHint.length > 0 ? `\n   hint: ${top.promptHint}` : '';
          lines.push(`- Top action: **${top.label}** (${top.cartridge})\n   why: ${top.rationale}${hint}`);
        }
        const alts = (moveForward.alternates as Array<Record<string, unknown>>) ?? [];
        if (alts.length > 0) {
          lines.push(`- Alternates:`);
          for (const a of alts.slice(0, 3)) {
            const hint = typeof a.promptHint === 'string' && a.promptHint.length > 0 ? `\n     hint: ${a.promptHint}` : '';
            lines.push(`  • **${a.label}** (${a.cartridge}) — ${a.rationale}${hint}`);
          }
        }
      }

      if (expModel && typeof expModel.configured === 'boolean') {
        lines.push(`### Experience model`);
        lines.push(`- Configured: ${expModel.configured ? 'yes' : 'no'}`);
        if (expModel.stage) lines.push(`- Stage: ${expModel.stage}`);
        if (expModel.primaryGoal) lines.push(`- Primary goal: ${expModel.primaryGoal}`);
      }

      if (activeCartridges.length > 0) {
        lines.push(`### Active cartridges\n- ${activeCartridges.join(', ')}`);
      }

      if (pending && pending.label) {
        lines.push(`### Pending approval\n- ${pending.label} (${pending.cartridge ?? 'metame'})`);
      }
      if (queuedIds.length > 0) {
        lines.push(`### Queued intents (already approved, awaiting execution)\n- ${queuedIds.join(', ')}`);
      }

      if (lines.length > 0) {
        groundContextBlock = `\n\n## Right-pane ground truth — narrate THIS, do not invent\n\nThe operator's right pane is currently showing the structured data below. Your reply MUST mirror these exact rows — refer to each NBA by its label and rationale, cite the persona's primary goal / stage / active cartridges as the framing axis, and use the per-NBA hint (when present) as the starting frame for any "Act" guidance. NEVER emit placeholder strings like "[Priority 1]", "[Action 1]", or "[Event/Document/Message 1]" — those indicate you ignored this block. If the operator asks "give me my daily brief", paraphrase the brief below as a short narrative followed by 2-3 sentences of WHY each NBA is the move right now.\n\n${lines.join('\n')}`;
      }
    } catch {
      // groundContext malformed — fall back to general narrative.
    }
  }

  // Shared KB context section (appended for all agents when search returns results)
  const kbSection = kbContext && kbContext.length > 0 ? `

## Relevant Knowledge Base Content

The following content from the knowledge base is relevant to the user's query:

${kbContext.map((kb, i) => `### Source ${i + 1}: ${kb.title} (${kb.contentCategory})
${kb.content.substring(0, 800)}${kb.content.length > 800 ? '...' : ''}`).join('\n\n')}` : '';

  // KNYT-focused agents (Kn0w1, Marketa) get the full codex character/episode context injected.
  // Platform/system agents (Aigent Z, Aigent C, etc.) use only their own system prompt + KB hits —
  // injecting KNYT characters/episodes into Aigent Z's context would override its engineering identity.
  if (KNYT_FOCUSED_AGENTS.has(resolvedPersonaId)) {
    const characterSummaries = metadata.characters.map(c => {
      const card = c.knyt_card;
      return `- **${c.digiterra_name}** (${c.terra_name}): ${c.profile?.substring(0, 200) || 'No profile'}...
  Affiliation: ${c.affiliation || 'Unknown'}, Base: ${c.base || 'Unknown'}
  ${card ? `Powers: ${card.powers?.substring(0, 150) || 'Unknown'}... Primary Weapon: ${card.primary_weapon || 'None'}` : ''}`;
    }).join('\n\n');

    const episodeSummaries = metadata.episodes.map(e => {
      return `- **Episode ${e.issue_number}: ${e.title}** (Focus: ${e.knytcard_focus || 'Various'})
  Synopsis: ${e.synopsis?.substring(0, 200) || 'No synopsis'}...`;
    }).join('\n\n');

    // Live KNYT state injection (balance, stage, elections, participation)
    let liveSection = '';
    if (liveContext) {
      const lines: string[] = [];
      if (liveContext.knyt_balance !== null)
        lines.push(`- $KNYT balance: **${liveContext.knyt_balance}** (combined pending + settled)`);
      if (liveContext.patronage_stage)
        lines.push(`- Patronage stage: **${liveContext.patronage_stage}**`);
      if (liveContext.pcs_stage)
        lines.push(`- PCS stage: **${liveContext.pcs_stage}**`);
      if (liveContext.signal_counts)
        lines.push(`- Signals: ${liveContext.signal_counts.like} likes, ${liveContext.signal_counts.spark} sparks, ${liveContext.signal_counts.curate} curations (total: ${liveContext.signal_counts.total})`);
      if (liveContext.active_elections.length > 0) {
        const electionList = liveContext.active_elections
          .map(e => `  • "${e.title}" (${e.branch} branch${e.closes_at ? `, closes ${new Date(e.closes_at).toLocaleDateString()}` : ''})`)
          .join('\n');
        lines.push(`- Active Living Canon elections:\n${electionList}`);
      }
      if (liveContext.recent_participation.length > 0) {
        const partList = liveContext.recent_participation
          .map(p => `  • ${p.action_type}${p.provisional ? ' (provisional)' : ''} — ${new Date(p.created_at).toLocaleDateString()}`)
          .join('\n');
        lines.push(`- Recent participation:\n${partList}`);
      }
      if (lines.length > 0) {
        liveSection = `\n\n## This User's Live KNYT State\n\n${lines.join('\n')}`;
      }
    }

    // Active skill focus — tell Kn0w1 which of its 8 skills the query triggers
    const SKILL_DESCRIPTIONS: Record<Know1SkillId, string> = {
      information_value_interpret: 'Frame what this knowledge or content is worth inside the KNYT system.',
      risk_frame_humanize:         'Translate risk or uncertainty into plain language — honest, not alarming.',
      pricing_logic_explain:       'Explain Qc pricing for skills, sessions, or actions.',
      knyt_treasury_explain:       'Explain the KNYT Treasury — what it is, what it holds, how it sustains the economy.',
      knyt_rewards_explain:        'Explain the KNYT rewards model — what participation earns, provisional vs finalised.',
      qc_vs_knyt_explain:          'Explain the Qc / $KNYT distinction. Governing rule: Qc operates; $KNYT expresses and rewards.',
      '21sats_structure_explain':  'Explain 21 Sats — what it is, how it sits inside KNYT, the coordination path to AVS.',
      opportunity_shape:           "Help the user see and articulate their next real move inside the system.",
    };
    const skillFocusSection = activeSkill
      ? `\n\n## Active Skill Focus\n\nThe user's query activates skill: **${activeSkill}**\nFocus: ${SKILL_DESCRIPTIONS[activeSkill]}\nApply this skill's framing as your primary lens for this response.`
      : '';

    return `${personaIntro}${policyBlock}

${roleGuidelines}

## Your Knowledge Base

You have access to the complete metaKnyts Codex containing:
- ${metadata.stats.characterCount} characters with their KNYT cards
- ${metadata.stats.episodeCount} episodes with synopses and quotes
- ${metadata.stats.coverCount} collectible covers
- ${metadata.stats.masterCount} digital scrolls (motion comics)

## Characters in the Codex

${characterSummaries || 'No characters loaded yet.'}

## Episodes in the Codex

${episodeSummaries || 'No episodes loaded yet.'}

## Response Format Guidelines

**Structure your responses for readability:**
- Break information into short paragraphs (2-3 sentences each)
- Use bullet points (•) for lists of powers, weapons, or episode highlights
- When asked for a diagram, include a valid Mermaid diagram in a fenced code block using \`\`\`mermaid

**Always end with 2-3 follow-up questions:**
After your response, add:
"---
• [Follow-up question]
• [Follow-up question]"

## Content Guidelines

1. Answer questions about characters, their powers, affiliations, and backstories
2. Discuss episode plots, themes, and character arcs
3. Help users discover content they might enjoy
4. Reference specific episodes or characters when relevant
5. If asked about something not in your knowledge base, acknowledge it gracefully
6. Be engaging and immersive — you are a guide to this universe${kbSection}${liveSection}${skillFocusSection}`;
  }

  // Platform/system agents: persona system prompt only, plus any KB hits.
  // metameContextBlock + groundContextBlock are appended for aigent-me
  // (empty strings for any other agent — adds nothing to their prompts).
  return `${personaIntro}${policyBlock}${metameContextBlock}${groundContextBlock}${kbSection}`;
}

// CORS headers for cross-origin requests from Vite dev server
export async function OPTIONS() {
  return new NextResponse(null, { status: 200,  });
}

export async function POST(request: NextRequest) {
  try {
    const eventMeta = createEventMeta('codex-chat-api');
    const body = await request.json();
    const { 
      message, 
      chatHistory = [], 
      persona = 'aigent-kn0w1',
      mode = 'default',
      composerSessionContext,
      // New: User context fields
      domain = 'metaKnyts',
      declaredRoles,
      walletBalance,
      nftCount,
      isFirstVisit,
      visitCount,
      provider_id,
      llm_id,
      aigentId,
      // metaMe settings policy fields
      guardian_mode,
      budget_posture,
      receipt_visibility,
      skill_filter,
      explanation_first,
      // Kn0w1 live context — optional personaId to fetch live KNYT state
      personaId,
      // Right-pane ground truth — T1-safe snapshot of what the calling
      // surface is rendering. Only honoured for aigent-me; ignored for
      // other personas to avoid leaking aigentMe-flavoured narrative
      // into KNYT / Marketa replies.
      groundContext,
    } = body;

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400,  }
      );
    }

    // Infer primary role from message and declared roles
    const primaryRole = inferPrimaryRole(message, declaredRoles);
    
    // Build user context (includes metaMe policy settings when provided)
    const userContext: UserContext = {
      domain,
      roles: declaredRoles || [primaryRole],
      primaryRole,
      walletBalance,
      nftCount,
      isFirstVisit,
      visitCount,
      guardianMode: typeof guardian_mode === 'boolean' ? guardian_mode : undefined,
      budgetPosture: typeof budget_posture === 'string' && ['low','medium','high'].includes(budget_posture)
        ? (budget_posture as BudgetPosture)
        : undefined,
      receiptVisibility: typeof receipt_visibility === 'boolean' ? receipt_visibility : undefined,
      skillFilter: skill_filter === true || skill_filter === 'curated' ? 'curated'
        : skill_filter === false || skill_filter === 'all' ? 'all'
        : undefined,
      explanationFirst: typeof explanation_first === 'boolean' ? explanation_first : undefined,
      groundContext:
        groundContext && typeof groundContext === 'object' && !Array.isArray(groundContext)
          ? (groundContext as Record<string, unknown>)
          : undefined,
    };

    console.log('[CodexChat] User context:', { 
      domain, 
      primaryRole, 
      roles: userContext.roles,
      hasWallet: !!walletBalance 
    });

    const isComposerMode = mode === 'composer' && Boolean(composerSessionContext);

    let metadata: CodexMetadata | null = null;
    let kbResults: KBSearchResult[] = [];
    let systemPrompt = '';

    if (isComposerMode) {
      systemPrompt = buildComposerSystemPrompt(composerSessionContext as ComposerSessionContext);
    } else {
      const resolvedAgentForFetch = (typeof aigentId === 'string' && normalizeAgentId(aigentId)) || defaultAgentIdForPersona(persona);
      const isKn0w1 = resolvedAgentForFetch === 'aigent-kn0w1';
      const isAigentMe = resolvedAgentForFetch === 'aigent-me';
      const activeSkill = isKn0w1 ? detectSkillIntent(message) : null;
      const needsProtocolKB = isProtocolQuery(message);

      // aigentMe enrichment: when the active agent is the user's
      // sovereign aigentMe, load their metaMe cartridge state so the
      // system prompt frames the reply inside their actual workstream.
      // Loaded in parallel with the KB / metadata fetches below.
      if (isAigentMe) {
        const ctx = await loadMetameContext(typeof personaId === 'string' ? personaId : undefined);
        if (ctx) userContext.metameContext = ctx;
      }

      // Fetch codex metadata, KB results, protocol KB (when relevant), and live KNYT state in parallel
      const [resolvedMetadata, resolvedKbResults, resolvedProtocolResults, resolvedLiveContext] = await Promise.all([
        fetchCodexMetadata(domain),
        searchKnowledgeBase(message, domain, 3),
        needsProtocolKB ? searchKnowledgeBase(message, 'protocol', 3) : Promise.resolve([]),
        isKn0w1 ? fetchKnytLiveContext(typeof personaId === 'string' ? personaId : undefined) : Promise.resolve(undefined),
      ]);
      metadata = resolvedMetadata;
      // Merge domain KB + protocol KB results, deduplicated by content prefix
      const seen = new Set<string>();
      kbResults = [...resolvedKbResults, ...resolvedProtocolResults].filter(r => {
        const key = r.content.slice(0, 60);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      console.log(`[CodexChat] KB: ${resolvedKbResults.length} domain + ${resolvedProtocolResults.length} protocol results${isKn0w1 ? `, skill: ${activeSkill ?? 'none'}` : ''}`);

      systemPrompt = buildSystemPrompt(metadata, persona, userContext, kbResults, resolvedLiveContext ?? undefined, activeSkill);
    }

    const requestedProviderId = normalizeRuntimeProviderId(provider_id);
    const requestedModelId = typeof llm_id === 'string' ? llm_id : null;
    const resolvedAgentId =
      (typeof aigentId === 'string' && normalizeAgentId(aigentId)) ||
      defaultAgentIdForPersona(persona);
    const providerAvailability = getProviderAvailability();
    const { attempts: providerAttempts, skipped: skippedProviders } = buildProviderAttempts(
      requestedProviderId,
      requestedModelId,
      resolvedAgentId,
    );

    // Build shared conversation array
    const conversationHistory: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...chatHistory.slice(-10), // Keep last 10 messages for context
    ];
    const isMarketa = resolvedAgentId === 'aigent-marketa';
    let executionResult: ProviderExecutionResult | null = null;
    const providerErrors: Array<{ providerId: RuntimeProviderId; modelId: string; error: string }> = [];

    for (const attempt of providerAttempts) {
      try {
        executionResult = await executeProviderAttempt(
          attempt,
          systemPrompt,
          conversationHistory,
          message,
          isMarketa,
        );
        console.log('[CodexChat] Provider success:', {
          providerId: executionResult.providerId,
          modelId: executionResult.modelId,
        });
        break;
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        providerErrors.push({
          providerId: attempt.providerId,
          modelId: attempt.modelId,
          error: detail,
        });
        console.error('[CodexChat] Provider attempt failed:', {
          providerId: attempt.providerId,
          modelId: attempt.modelId,
          error: detail,
        });
      }
    }

    if (!executionResult) {
      console.error('[CodexChat] All configured LLM providers failed or were unavailable', {
        requestedProviderId,
        requestedModelId,
        resolvedAgentId,
        providerErrors,
      });

      const fallbackResponse = isComposerMode
        ? generateComposerFallbackResponse({
            message,
            sessionContext: composerSessionContext as ComposerSessionContext,
          })
        : generateFallbackResponse(message, metadata as CodexMetadata, persona);
      const walletActions = inferWalletActions(message, fallbackResponse);
      return NextResponse.json({
        response: fallbackResponse,
        persona,
        wallet_actions: walletActions,
        event_meta: eventMeta,
        fallback: true,
        provider_availability: providerAvailability,
        provider_attempts: providerAttempts,
        provider_skipped: skippedProviders,
        provider_errors: providerErrors,
      });
    }

    const assistantMessage = executionResult.content || 'I apologize, I could not generate a response.';
    const walletActions = inferWalletActions(message, assistantMessage);
    
    console.log('[CodexChat] Response length:', assistantMessage.length);
    console.log('[CodexChat] Response preview:', assistantMessage.substring(0, 200) + '...');
    console.log('[CodexChat] Response ending:', assistantMessage.substring(assistantMessage.length - 200));

    return NextResponse.json({
      response: assistantMessage,
      persona,
      wallet_actions: walletActions,
      event_meta: eventMeta,
      userContext: {
        domain: userContext.domain,
        primaryRole: userContext.primaryRole,
        roles: userContext.roles,
      },
      metadata: {
        characterCount: metadata?.stats.characterCount ?? 0,
        episodeCount: metadata?.stats.episodeCount ?? 0
      },
      provider_used: executionResult.providerId,
      model_used: executionResult.modelId,
      provider_requested: requestedProviderId,
      model_requested: requestedModelId,
      provider_fallback: Boolean(requestedProviderId && executionResult.providerId !== requestedProviderId),
      provider_availability: providerAvailability,
      provider_attempts: providerAttempts,
      provider_skipped: skippedProviders,
      kbSources: kbResults.length > 0 ? kbResults.map(r => ({
        title: r.title,
        category: r.contentCategory,
      })) : undefined,
    });

  } catch (error) {
    console.error('[CodexChat] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500,  }
    );
  }
}

// Intelligent fallback when OpenAI is not available
function generateFallbackResponse(
  message: string,
  metadata: CodexMetadata,
  aigentId: string
): string {
  const lowerMessage = message.toLowerCase();
  const intro = (aigentId === 'aigent-moneypenny' || aigentId === 'moneypenny')
    ? "Hello, darling."
    : "Greetings, seeker of knowledge.";

  // Check for character queries
  for (const char of metadata.characters) {
    const names = [
      char.digiterra_name?.toLowerCase(),
      char.terra_name?.toLowerCase(),
      char.id?.toLowerCase()
    ].filter(Boolean);

    if (names.some(name => lowerMessage.includes(name))) {
      const card = char.knyt_card;
      let response = `${intro} You're asking about **${char.digiterra_name}** (${char.terra_name}).\n\n`;
      response += char.profile ? `${char.profile.substring(0, 300)}...\n\n` : '';
      response += `**Affiliation:** ${char.affiliation || 'Unknown'}\n`;
      response += `**Base:** ${char.base || 'Unknown'}\n`;
      if (card) {
        response += `\n**Powers:** ${card.powers?.substring(0, 200) || 'Unknown'}...\n`;
        response += `**Primary Weapon:** ${card.primary_weapon || 'None'}\n`;
        response += `**First Appearance:** ${card.first_appearance || 'Unknown'}`;
      }
      return response;
    }
  }

  // Check for episode queries
  for (const ep of metadata.episodes) {
    const titleLower = ep.title?.toLowerCase() || '';
    const issueMatch = lowerMessage.match(/episode\s*#?(\d+)|issue\s*#?(\d+)|#(\d+)/);
    
    if (titleLower && lowerMessage.includes(titleLower.substring(0, 20))) {
      return `${intro} **${ep.title}** (${ep.issue_number}) focuses on ${ep.knytcard_focus || 'the metaKnyts'}.\n\n${ep.synopsis || 'Synopsis not available.'}\n\n${ep.intro_quote ? `*"${ep.intro_quote}"*` : ''}`;
    }
    
    if (issueMatch) {
      const num = parseInt(issueMatch[1] || issueMatch[2] || issueMatch[3]);
      if (ep.issue_number === `#${num}` || ep.episode_number === num + 1) {
        return `${intro} **${ep.title}** (${ep.issue_number}) focuses on ${ep.knytcard_focus || 'the metaKnyts'}.\n\n${ep.synopsis || 'Synopsis not available.'}\n\n${ep.intro_quote ? `*"${ep.intro_quote}"*` : ''}`;
      }
    }
  }

  // General queries
  if (lowerMessage.includes('character') || lowerMessage.includes('who')) {
    const charList = metadata.characters.slice(0, 5).map(c => `• **${c.digiterra_name}** - ${c.affiliation || 'Unknown affiliation'}`).join('\n');
    return `${intro} The metaKnyts Codex contains ${metadata.stats.characterCount} characters. Here are some key figures:\n\n${charList}\n\nAsk me about any character to learn more about their powers and story!`;
  }

  if (lowerMessage.includes('episode') || lowerMessage.includes('story') || lowerMessage.includes('read')) {
    const epList = metadata.episodes.slice(0, 5).map(e => `• **${e.issue_number}: ${e.title}** - ${e.knytcard_focus || 'Various'}`).join('\n');
    return `${intro} The Codex contains ${metadata.stats.episodeCount} episodes. Here are the available scrolls:\n\n${epList}\n\nSelect any episode in the Codex to read the digital scroll!`;
  }

  if (lowerMessage.includes('power') || lowerMessage.includes('weapon') || lowerMessage.includes('ability')) {
    const poweredChars = metadata.characters.filter(c => c.knyt_card?.powers).slice(0, 3);
    const powerList = poweredChars.map(c => `• **${c.digiterra_name}**: ${c.knyt_card.powers?.substring(0, 100)}...`).join('\n\n');
    return `${intro} The metaKnyts possess extraordinary abilities. Here are some notable powers:\n\n${powerList}\n\nAsk about a specific character to learn their full abilities!`;
  }

  // Default response
  return `${intro} Welcome to the metaKnyts Codex! I have knowledge of ${metadata.stats.characterCount} characters, ${metadata.stats.episodeCount} episodes, and ${metadata.stats.coverCount} collectible covers.\n\nYou can ask me about:\n• **Characters** - their powers, affiliations, and backstories\n• **Episodes** - plot summaries and featured characters\n• **The metaKnyts universe** - lore and world-building\n\nWhat would you like to explore?`;
}
