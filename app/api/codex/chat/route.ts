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
type ContentDomain = 'metaKnyts' | 'qriptopian';

interface UserContext {
  domain: ContentDomain;
  roles: UserRole[];
  primaryRole: UserRole;
  walletBalance?: number;
  nftCount?: number;
  isFirstVisit?: boolean;
  visitCount?: number;
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

async function executeProviderAttempt(
  attempt: ProviderAttempt,
  systemPrompt: string,
  history: ChatMessage[],
  message: string,
): Promise<ProviderExecutionResult> {
  switch (attempt.providerId) {
    case 'openai':
      return callOpenAi([...history, { role: 'user', content: message }], attempt.modelId);
    case 'venice':
      return callVenice([...history, { role: 'user', content: message }], attempt.modelId);
    case 'anthropic':
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

// Search Knowledge Base for relevant content with timeout
async function searchKnowledgeBase(
  query: string, 
  domain: ContentDomain,
  limit: number = 3
): Promise<KBSearchResult[]> {
  try {
    // Add 5 second timeout to prevent hanging
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('KB search timeout')), 5000)
    );
    
    const searchPromise = embeddingService.hybridSearch(query, domain, limit);
    
    const results = await Promise.race([searchPromise, timeoutPromise]);
    
    console.log(`[CodexChat] KB search found ${results.length} results`);
    
    return results.map(r => ({
      content: r.content,
      title: r.metadata.title || 'Unknown',
      contentCategory: r.metadata.contentCategory || 'general',
      similarity: r.similarity,
    }));
  } catch (error) {
    console.error('[CodexChat] KB search error:', error);
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

  // Default: Fetch metaKnyts content
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

// Build system prompt with codex context, user role, and KB content
function buildSystemPrompt(
  metadata: CodexMetadata,
  aigentId: string,
  userContext?: UserContext,
  kbContext?: KBSearchResult[]
): string {
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

  // Normalize short keys ('marketa', 'kn0w1') to full IDs ('aigent-marketa', 'aigent-kn0w1')
  const resolvedPersonaId = normalizeAgentId(aigentId) ?? 'aigent-kn0w1';
  const personaConfig =
    personas[resolvedPersonaId as keyof typeof personas] ??
    personas['aigent-kn0w1'];
  const personaIntro = personaConfig.systemPrompt;

  // Get role-specific guidelines
  const roleGuidelines = userContext ? getRoleGuidelines(userContext.primaryRole) : getRoleGuidelines('fan');

  return `${personaIntro}

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
- Use **bold** for character names, episode titles, and key terms
- Use bullet points (•) for lists of powers, weapons, or episode highlights
- Use *italics* for quotes or emphasis
- When asked for a diagram, include a valid Mermaid diagram in a fenced code block using \`\`\`mermaid

**Diagram behavior:**
- You can generate Mermaid diagrams directly in your response
- Do not claim you cannot create diagrams
- Prefer simple, readable Mermaid flows (graph TD / flowchart / sequence) unless the user asks for a specific type

**Content sections to include when relevant:**
- A brief intro paragraph answering the question
- Key details organized with bullets or short paragraphs
- A "sidebar" section using → for related lore or connections

**Always end with 2-3 follow-up questions:**
After your response, add a section like:
"---
**Explore further:**
• [Question about a related character]
• [Question about an episode featuring this character]
• [Question about powers or lore connection]"

## Content Guidelines

1. Answer questions about characters, their powers, affiliations, and backstories
2. Discuss episode plots, themes, and character arcs
3. Help users discover content they might enjoy
4. Reference specific episodes or characters when relevant
5. If asked about something not in your knowledge base, acknowledge it gracefully
6. Be engaging and immersive - you're a guide to this universe
7. When users ask to read or view content, guide them to the appropriate episode in the Codex
8. Keep responses concise but well-structured${kbContext && kbContext.length > 0 ? `

## Relevant Knowledge Base Content

The following content from the knowledge base is relevant to the user's query. Use this information to provide accurate and detailed responses:

${kbContext.map((kb, i) => `### Source ${i + 1}: ${kb.title} (${kb.contentCategory})
${kb.content.substring(0, 800)}${kb.content.length > 800 ? '...' : ''}`).join('\n\n')}` : ''}`;
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
    } = body;

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400,  }
      );
    }

    // Infer primary role from message and declared roles
    const primaryRole = inferPrimaryRole(message, declaredRoles);
    
    // Build user context
    const userContext: UserContext = {
      domain,
      roles: declaredRoles || [primaryRole],
      primaryRole,
      walletBalance,
      nftCount,
      isFirstVisit,
      visitCount,
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
      // Fetch codex metadata and search KB in parallel
      const [resolvedMetadata, resolvedKbResults] = await Promise.all([
        fetchCodexMetadata(domain),
        searchKnowledgeBase(message, domain, 3),
      ]);
      metadata = resolvedMetadata;
      kbResults = resolvedKbResults;

      console.log(`[CodexChat] KB search returned ${kbResults.length} results`);
      
      // Build system prompt with codex context, user role, AND KB content
      systemPrompt = buildSystemPrompt(metadata, persona, userContext, kbResults);
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
    let executionResult: ProviderExecutionResult | null = null;
    const providerErrors: Array<{ providerId: RuntimeProviderId; modelId: string; error: string }> = [];

    for (const attempt of providerAttempts) {
      try {
        executionResult = await executeProviderAttempt(
          attempt,
          systemPrompt,
          conversationHistory,
          message,
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
