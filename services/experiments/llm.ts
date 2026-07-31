/**
 * Experiment-lab LLM caller (Foundational Validation Series front-end).
 *
 * Mirrors the platform LLM chain's env names, endpoints, and default models
 * (services/agents/_lib/llmDraftHelper.ts) but additionally returns usage
 * tokens — the rediscovery-cost measure of CFS-008 §2, which the draft helper
 * deliberately doesn't expose. Also carries the string-aware lenient JSON
 * parser the offline harnesses proved out against OSS-judge output.
 *
 * Server-only.
 */

export type ExperimentProvider =
  | 'anthropic'
  | 'openai'
  | 'venice'
  | 'chaingpt'
  | 'thirdweb'
  | 'grok'
  | 'gemini'
  | 'groq';

export const EXPERIMENT_PROVIDERS: Record<ExperimentProvider, { keyEnv: string; model: () => string }> = {
  anthropic: { keyEnv: 'ANTHROPIC_API_KEY', model: () => process.env.ANTHROPIC_DRAFT_MODEL || 'claude-sonnet-4-6' },
  openai: { keyEnv: 'OPENAI_API_KEY', model: () => process.env.OPENAI_DRAFT_MODEL || 'gpt-4o-mini' },
  venice: { keyEnv: 'VENICE_API_KEY', model: () => process.env.VENICE_DRAFT_MODEL || 'llama-3.3-70b' },
  chaingpt: { keyEnv: 'CHAINGPT_API_KEY', model: () => process.env.CHAINGPT_MODEL || 'general_assistant' },
  // thirdweb Nebula — server-side auth is the SECRET key (x-secret-key header);
  // the client ID is browser-only. Endpoint is operator-provided via
  // THIRDWEB_NEBULA_URL (no hardcoded production URL — see callChatWithUsage).
  thirdweb: { keyEnv: 'THIRDWEB_SECRET_KEY', model: () => process.env.THIRDWEB_MODEL || 'nebula' },
  // xAI Grok — OpenAI-compatible (api.x.ai/v1). Key + model env-overridable.
  grok: { keyEnv: 'XAI_API_KEY', model: () => process.env.XAI_MODEL || process.env.GROK_MODEL || 'grok-2-latest' },
  // Google Gemini — NOT OpenAI-compatible (generateContent; custom branch).
  gemini: { keyEnv: 'GEMINI_API_KEY', model: () => process.env.GEMINI_MODEL || 'gemini-1.5-flash' },
  // Groq — OpenAI-compatible (api.groq.com/openai/v1), open-weight models.
  groq: { keyEnv: 'GROQ_API_KEY', model: () => process.env.GROQ_MODEL || 'llama-3.3-70b-versatile' },
};

/** ChainGPT accepts four env spellings in production (mirrors the codex chat
 * route's resolution exactly — app/api/codex/chat/route.ts). */
function chaingptApiKey(): string | null {
  return (
    process.env.CHAINGPT_API_KEY ||
    process.env.CHAIN_GPT_API_KEY ||
    process.env.CHAINGPT_API_SECRET ||
    process.env.CHAIN_GPT_API_SECRET ||
    null
  );
}

/** xAI Grok — accept the two common env spellings so whichever the operator set
 *  in Amplify matches (both are allowlisted). */
function grokApiKey(): string | null {
  return process.env.XAI_API_KEY || process.env.GROK_API_KEY || null;
}

/** Gemini — accept the three common Google spellings (all allowlisted). */
function geminiApiKey(): string | null {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_AI_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    null
  );
}

/** Resolve a provider's key through its spelling-tolerant resolver where one
 *  exists, else the single configured keyEnv. */
function resolveApiKey(provider: ExperimentProvider): string | null {
  if (provider === 'chaingpt') return chaingptApiKey();
  if (provider === 'grok') return grokApiKey();
  if (provider === 'gemini') return geminiApiKey();
  return process.env[EXPERIMENT_PROVIDERS[provider].keyEnv] || null;
}

export function providerAvailable(provider: ExperimentProvider): boolean {
  return Boolean(resolveApiKey(provider));
}

/** Type guard: is this provider id one with a verified callChatWithUsage adapter?
 *  The ModelQube registry NAMES more providers (thirdweb/gemini/grok stubs) than
 *  are routable; the router uses this to refuse to call an unimplemented one. */
export function isExperimentProvider(id: string): id is ExperimentProvider {
  return Object.prototype.hasOwnProperty.call(EXPERIMENT_PROVIDERS, id);
}

/**
 * Per-provider model allowlist for experiment runs — every id here has a real
 * call site or registration elsewhere in the codebase (llmDraftHelper env
 * defaults, agentLlmOrchestra ModelQubes, codex chat). Overrides are validated
 * against this list server-side; arbitrary model strings are rejected. First
 * entry = the platform's draft default for that provider.
 */
export const EXPERIMENT_MODEL_OPTIONS: Record<ExperimentProvider, { id: string; label: string }[]> = {
  anthropic: [
    { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (default)' },
    { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
    { id: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
  ],
  openai: [
    { id: 'gpt-4o-mini', label: 'GPT-4o Mini (default)' },
    { id: 'gpt-4o', label: 'GPT-4o' },
  ],
  venice: [
    { id: 'llama-3.3-70b', label: 'Llama 3.3 70B (default)' },
    { id: 'venice-uncensored', label: 'Venice Uncensored' },
    { id: 'venice-reasoning', label: 'Venice Reasoning' },
  ],
  // The one model value with a verified production call site (the codex chat
  // route's CHAINGPT_MODEL default). Add ids here only with a proven call.
  chaingpt: [{ id: 'general_assistant', label: 'ChainGPT General Assistant (default)' }],
  // Nebula is thirdweb's single onchain-reasoning model — one allowlisted id.
  thirdweb: [{ id: 'nebula', label: 'ThirdWeb Nebula (default)' }],
  grok: [
    { id: 'grok-2-latest', label: 'Grok 2 (default)' },
    { id: 'grok-beta', label: 'Grok Beta' },
  ],
  gemini: [
    { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (default)' },
    { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
  ],
  groq: [
    { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile (default)' },
    { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant' },
  ],
};

export function isAllowedExperimentModel(provider: ExperimentProvider, model: string): boolean {
  return EXPERIMENT_MODEL_OPTIONS[provider].some((m) => m.id === model);
}

export interface ChatResult {
  text: string;
  inputTokens: number | null;
  outputTokens: number | null;
  model: string;
}

/**
 * Provider-call budget (the execution envelope). The hosting gateway kills SSR
 * requests at ~30s and answers with an EMPTY body — which Safari's res.json()
 * surfaces as "The string did not match the expected pattern" (observed on the
 * first cartridge-mounted EXP-003 run, 2026-07-05). Aborting the provider call
 * at 25s lets the route return a clean JSON timeout the client can classify
 * (`timed_out`) and, for transient classes only, retry once against the SAME
 * provider — never an opaque gateway timeout, never a silent re-route.
 */
const PROVIDER_TIMEOUT_MS = 25_000;

async function fetchWithTimeout(url: string, init: RequestInit, provider: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(
        `${provider} timed out after ${PROVIDER_TIMEOUT_MS / 1000}s (execution envelope exceeded) — transient; retried once against the same provider`,
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** One chat call. `temperature` defaults to 0 (benchmark discipline — every
 *  existing caller is unchanged); conversational surfaces may raise it. Usage
 *  returned. */
export async function callChatWithUsage(
  provider: ExperimentProvider,
  system: string,
  user: string,
  maxTokens: number,
  modelOverride?: string,
  temperature = 0,
): Promise<ChatResult> {
  const conf = EXPERIMENT_PROVIDERS[provider];
  const apiKey = resolveApiKey(provider);
  if (!apiKey) throw new Error(`${conf.keyEnv} is not configured`);
  if (modelOverride && !isAllowedExperimentModel(provider, modelOverride)) {
    throw new Error(`model '${modelOverride}' is not in the ${provider} experiment allowlist`);
  }
  const model = modelOverride || conf.model();

  if (provider === 'chaingpt') {
    // Mirrors the platform's proven call (app/api/codex/chat/route.ts
    // callChainGpt) exactly: single flattened question, chatHistory off,
    // response is either JSON with data.bot or raw text. Honest limits: the
    // endpoint takes no temperature/max_tokens (benchmark temp-0 discipline
    // is not enforceable here) and returns no usage tokens — both reported
    // as null, never fabricated.
    const question = [
      system,
      `User: ${user}`,
      'Respond directly to the latest user message while following the system guidance above.',
    ]
      .filter(Boolean)
      .join('\n\n');
    const res = await fetchWithTimeout('https://api.chaingpt.org/chat/stream', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, question, chatHistory: 'off' }),
    }, 'chaingpt');
    if (!res.ok) throw new Error(`chaingpt ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const raw = await res.text();
    let text = raw.trim();
    try {
      const data = JSON.parse(raw);
      if (typeof data === 'string') text = data.trim();
      else if (typeof data?.data?.bot === 'string') text = data.data.bot.trim();
    } catch {
      // raw streaming text — already captured
    }
    if (!text) throw new Error('chaingpt returned an empty completion');
    return { text, inputTokens: null, outputTokens: null, model };
  }

  if (provider === 'thirdweb') {
    // thirdweb Nebula (AI for onchain). Server-side auth = the SECRET key via the
    // `x-secret-key` header (the client ID is browser-only). The endpoint is
    // operator-provided (THIRDWEB_NEBULA_URL) so no production URL is hardcoded
    // as an immutable fact — the documented Nebula default is overridable. Honest
    // limits: like chaingpt, no temperature/max_tokens/usage — reported null,
    // never fabricated. Response parsed DEFENSIVELY (Nebula `.message`, then
    // OpenAI-compatible + chaingpt-style fallbacks) so a shape mismatch degrades
    // to the router's next provider instead of producing garbage.
    const base = process.env.THIRDWEB_NEBULA_URL || 'https://nebula-api.thirdweb.com/chat';
    const question = [system, `User: ${user}`].filter(Boolean).join('\n\n');
    const res = await fetchWithTimeout(base, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-secret-key': apiKey },
      body: JSON.stringify({ message: question, stream: false }),
    }, 'thirdweb');
    if (!res.ok) throw new Error(`thirdweb ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const raw = await res.text();
    let text = raw.trim();
    try {
      const data = JSON.parse(raw);
      if (typeof data?.message === 'string') text = data.message.trim();
      else if (typeof data?.choices?.[0]?.message?.content === 'string') text = data.choices[0].message.content.trim();
      else if (typeof data?.data?.bot === 'string') text = data.data.bot.trim();
    } catch {
      // raw text response — already captured
    }
    if (!text) throw new Error('thirdweb returned an empty completion');
    return { text, inputTokens: null, outputTokens: null, model };
  }

  if (provider === 'gemini') {
    // Google Generative Language API (generateContent) — NOT OpenAI-compatible:
    // systemInstruction + contents/parts request, candidates response, key as a
    // ?key= query param. Model env-overridable (GEMINI_MODEL). usageMetadata
    // gives real token counts. A wrong model/shape degrades to the next provider.
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetchWithTimeout(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { temperature, maxOutputTokens: maxTokens },
      }),
    }, 'gemini');
    if (!res.ok) throw new Error(`gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    const text = (data?.candidates?.[0]?.content?.parts ?? [])
      .map((p: { text?: string }) => p.text ?? '')
      .join('');
    if (!text) throw new Error('gemini returned an empty completion');
    return {
      text,
      inputTokens: data?.usageMetadata?.promptTokenCount ?? null,
      outputTokens: data?.usageMetadata?.candidatesTokenCount ?? null,
      model,
    };
  }

  if (provider === 'anthropic') {
    const res = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    }, 'anthropic');
    if (!res.ok) throw new Error(`anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    const text = (data.content ?? [])
      .filter((b: { type?: string }) => b.type === 'text')
      .map((b: { text?: string }) => b.text ?? '')
      .join('');
    return {
      text,
      inputTokens: data.usage?.input_tokens ?? null,
      outputTokens: data.usage?.output_tokens ?? null,
      model,
    };
  }

  // OpenAI-compatible providers share this one path — only the base URL differs.
  // grok (xAI) and groq both speak the OpenAI /chat/completions API.
  const OPENAI_COMPATIBLE_BASE: Partial<Record<ExperimentProvider, string>> = {
    openai: 'https://api.openai.com/v1',
    venice: process.env.VENICE_BASE_URL || 'https://api.venice.ai/api/v1',
    grok: 'https://api.x.ai/v1',
    groq: 'https://api.groq.com/openai/v1',
  };
  const baseUrl = OPENAI_COMPATIBLE_BASE[provider] || 'https://api.openai.com/v1';
  const res = await fetchWithTimeout(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  }, provider);
  if (!res.ok) throw new Error(`${provider} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return {
    text: data.choices?.[0]?.message?.content ?? '',
    inputTokens: data.usage?.prompt_tokens ?? null,
    outputTokens: data.usage?.completion_tokens ?? null,
    model,
  };
}

/**
 * String-aware JSON repair for OSS-judge output (proved out in
 * scripts/evaluate-exp001.mjs): escapes literal newlines/tabs inside strings,
 * quotes bare C-NNN tokens and strips trailing commas in STRUCTURAL runs only
 * (prose markers like [C-011] inside answers stay intact).
 */
function repairJson(raw: string): string {
  let out = '';
  let seg = '';
  let inStr = false;
  let esc = false;
  const flushSeg = () => {
    seg = seg.replace(/([[,]\s*)(C-\d{3})(?=\s*[,\]])/g, '$1"$2"');
    seg = seg.replace(/,\s*([\]}])/g, '$1');
    out += seg;
    seg = '';
  };
  for (const ch of raw) {
    if (inStr) {
      if (esc) { out += ch; esc = false; continue; }
      if (ch === '\\') { out += ch; esc = true; continue; }
      if (ch === '"') { inStr = false; out += ch; continue; }
      if (ch === '\n') { out += '\\n'; continue; }
      if (ch === '\r') continue;
      if (ch === '\t') { out += '\\t'; continue; }
      out += ch;
      continue;
    }
    if (ch === '"') { flushSeg(); inStr = true; out += ch; continue; }
    seg += ch;
  }
  flushSeg();
  return out;
}

export function parseJsonLenient<T = unknown>(text: string): T {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1].trim() : text.trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  const sliced = start > -1 && end > start ? raw.slice(start, end + 1) : raw;
  try {
    return JSON.parse(sliced) as T;
  } catch {
    return JSON.parse(repairJson(sliced)) as T;
  }
}

/** parseJsonLenient with one strict-reminder retry (OSS judges misfire intermittently). */
export async function callJsonWithRetry<T = unknown>(
  provider: ExperimentProvider,
  system: string,
  user: string,
  maxTokens: number,
  modelOverride?: string,
): Promise<{ value: T; usage: { inputTokens: number | null; outputTokens: number | null } }> {
  const first = await callChatWithUsage(provider, system, user, maxTokens, modelOverride);
  try {
    return { value: parseJsonLenient<T>(first.text), usage: first };
  } catch {
    const retry = await callChatWithUsage(
      provider,
      `${system} Your previous attempt produced invalid JSON. Output MUST parse with JSON.parse — no trailing commas, no bare tokens, no literal newlines inside strings.`,
      user,
      maxTokens,
      modelOverride,
    );
    return { value: parseJsonLenient<T>(retry.text), usage: retry };
  }
}
