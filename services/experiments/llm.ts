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

export interface ChatResult {
  text: string;
  inputTokens: number | null;
  outputTokens: number | null;
  model: string;
}

/** One chat call, temperature 0 (benchmark discipline), usage returned. */
export async function callChatWithUsage(
  provider: ExperimentProvider,
  system: string,
  user: string,
  maxTokens: number,
): Promise<ChatResult> {
  const conf = EXPERIMENT_PROVIDERS[provider];
  const apiKey = process.env[conf.keyEnv];
  if (!apiKey) throw new Error(`${conf.keyEnv} is not configured`);
  const model = conf.model();

  if (provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
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
    });
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
  const res = await fetch(`${baseUrl}/chat/completions`, {
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
  });
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
): Promise<{ value: T; usage: { inputTokens: number | null; outputTokens: number | null } }> {
  const first = await callChatWithUsage(provider, system, user, maxTokens);
  try {
    return { value: parseJsonLenient<T>(first.text), usage: first };
  } catch {
    const retry = await callChatWithUsage(
      provider,
      `${system} Your previous attempt produced invalid JSON. Output MUST parse with JSON.parse — no trailing commas, no bare tokens, no literal newlines inside strings.`,
      user,
      maxTokens,
    );
    return { value: parseJsonLenient<T>(retry.text), usage: retry };
  }
}
