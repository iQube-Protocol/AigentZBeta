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

export type ExperimentProvider = 'anthropic' | 'openai' | 'venice';

export const EXPERIMENT_PROVIDERS: Record<ExperimentProvider, { keyEnv: string; model: () => string }> = {
  anthropic: { keyEnv: 'ANTHROPIC_API_KEY', model: () => process.env.ANTHROPIC_DRAFT_MODEL || 'claude-sonnet-4-6' },
  openai: { keyEnv: 'OPENAI_API_KEY', model: () => process.env.OPENAI_DRAFT_MODEL || 'gpt-4o-mini' },
  venice: { keyEnv: 'VENICE_API_KEY', model: () => process.env.VENICE_DRAFT_MODEL || 'llama-3.3-70b' },
};

export function providerAvailable(provider: ExperimentProvider): boolean {
  return Boolean(process.env[EXPERIMENT_PROVIDERS[provider].keyEnv]);
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
 * Provider-call budget. The hosting gateway kills SSR requests at ~30s and
 * answers with an EMPTY body — which Safari's res.json() surfaces as "The
 * string did not match the expected pattern" (observed on the first
 * cartridge-mounted EXP-003 run, 2026-07-05). Aborting the provider call at
 * 25s lets the route return a clean JSON error the client's automatic step
 * retry can act on, instead of an opaque gateway timeout.
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
        `${provider} timed out after ${PROVIDER_TIMEOUT_MS / 1000}s — transient; the client retries this step automatically`,
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** One chat call, temperature 0 (benchmark discipline), usage returned. */
export async function callChatWithUsage(
  provider: ExperimentProvider,
  system: string,
  user: string,
  maxTokens: number,
  modelOverride?: string,
): Promise<ChatResult> {
  const conf = EXPERIMENT_PROVIDERS[provider];
  const apiKey = process.env[conf.keyEnv];
  if (!apiKey) throw new Error(`${conf.keyEnv} is not configured`);
  if (modelOverride && !isAllowedExperimentModel(provider, modelOverride)) {
    throw new Error(`model '${modelOverride}' is not in the ${provider} experiment allowlist`);
  }
  const model = modelOverride || conf.model();

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
        temperature: 0,
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

  const baseUrl =
    provider === 'venice'
      ? `${process.env.VENICE_BASE_URL || 'https://api.venice.ai/api/v1'}`
      : 'https://api.openai.com/v1';
  const res = await fetchWithTimeout(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
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
