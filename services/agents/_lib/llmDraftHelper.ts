/**
 * services/agents/_lib/llmDraftHelper.ts
 *
 * Shared LLM-call helpers for the aigentMe draft services
 * (draftEmail, draftMarketaEmail, draftGoogleDoc, draftGoogleSheet,
 * draftSlideOutline, draftCalendarEvent). Centralises the
 * Anthropic-first → OpenAI-second → caller-handled-template fallback
 * pattern so the six services stay consistent and a single env-var
 * cutover (e.g. when an account exhausts quota) only needs to land
 * here.
 *
 * Contract: each helper returns the raw model text or null. The caller
 * is responsible for parsing it as JSON and handling the
 * shape-mismatch case (which counts as a fallback trigger).
 */
import { GROUNDING_MANDATE } from '@/services/orchestration/groundingContract';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const VENICE_API_KEY = process.env.VENICE_API_KEY;
const VENICE_BASE_URL = process.env.VENICE_BASE_URL || 'https://api.venice.ai/api/v1';

// Match the model used by nbeLlmRerank + specialistRouter so the LLM
// stack stays consistent. Override via env if a workstream needs a
// different family — but keep the default in sync with the other
// Anthropic call sites. claude-sonnet-4-6 is the current Sonnet
// generation (Sonnet 4.6 in the Claude 4.X family); other Anthropic
// call sites in this repo target claude-haiku-4-5-20251001 for cheaper
// classification work — drafting benefits from Sonnet's quality so we
// pin to Sonnet here.
const ANTHROPIC_MODEL = process.env.ANTHROPIC_DRAFT_MODEL || 'claude-sonnet-4-6';
const OPENAI_MODEL = process.env.OPENAI_DRAFT_MODEL || 'gpt-4o-mini';
// Venice hosts open-source models (Llama / Mistral variants). We pin
// to the same llama-3.3-70b that specialistRouter already uses so dev
// + prod accounts share the same model allowlist. Override via env.
const VENICE_MODEL = process.env.VENICE_DRAFT_MODEL || 'llama-3.3-70b';

export function stripJsonFences(raw: string): string {
  // Anthropic sometimes wraps JSON in ```json ... ``` fences even when
  // instructed not to. Strip those before the caller JSON.parses.
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) return fenced[1].trim();
  const plain = raw.match(/```\s*([\s\S]*?)```/);
  if (plain && plain[1]) return plain[1].trim();
  return raw.trim();
}

/**
 * Call Anthropic Messages API and return the model's text response, or
 * null on any failure (no key, non-2xx, abort, parse error). JSON-fenced
 * responses are unwrapped so the caller can JSON.parse the result.
 */
export async function callAnthropicJson(
  system: string,
  user: string,
  maxTokens = 1000,
): Promise<string | null> {
  if (!ANTHROPIC_API_KEY) return null;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: maxTokens,
        temperature: 0.5,
        system,
        messages: [{ role: 'user', content: user }],
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[llmDraftHelper] Anthropic returned ${res.status}; falling through`);
      return null;
    }
    const data = (await res.json()) as { content?: Array<{ type?: string; text?: string }> };
    const block = data?.content?.find((b) => b?.type === 'text');
    if (!block?.text) return null;
    return stripJsonFences(block.text);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[llmDraftHelper] Anthropic call failed: ${msg}; falling through`);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Call OpenAI chat/completions with JSON response_format and return the
 * model's text content, or null on any failure (no key, non-2xx, abort).
 * Kept as the secondary path behind Anthropic so an Anthropic outage
 * still produces a real draft.
 */
export async function callOpenAiJson(
  system: string,
  user: string,
  maxTokens = 1000,
): Promise<string | null> {
  if (!OPENAI_API_KEY) return null;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.5,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[llmDraftHelper] OpenAI returned ${res.status}; falling through`);
      return null;
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data?.choices?.[0]?.message?.content?.trim() ?? null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[llmDraftHelper] OpenAI call failed: ${msg}; falling through`);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Call Venice (OpenAI-compatible chat/completions API hosting open-
 * source models like Llama 3.3 70B). Used as the third-tier fallback
 * after Anthropic + OpenAI both fail, so that quota outages on the
 * commercial providers don't drop the operator to the prompt-leaking
 * templateDraft. Venice's OSS models are weaker at strict-JSON
 * obedience than Sonnet / gpt-4o-mini — the caller's JSON.parse may
 * fail more often and the draft service will still fall through to
 * the template — but this is a meaningful safety net.
 *
 * We explicitly nudge the system prompt to remind the OSS model to
 * return JSON only, since they tend to wander into commentary.
 */
export async function callVeniceJson(
  system: string,
  user: string,
  maxTokens = 1000,
): Promise<string | null> {
  if (!VENICE_API_KEY) return null;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(`${VENICE_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${VENICE_API_KEY}`,
      },
      body: JSON.stringify({
        model: VENICE_MODEL,
        messages: [
          { role: 'system', content: `${system}\nReturn a single valid JSON object only. Do not include any commentary, markdown fences, or prose outside the JSON.` },
          { role: 'user', content: user },
        ],
        temperature: 0.5,
        max_tokens: maxTokens,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[llmDraftHelper] Venice returned ${res.status}; falling through`);
      return null;
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) return null;
    return stripJsonFences(text);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[llmDraftHelper] Venice call failed: ${msg}; falling through`);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Try Anthropic first, then OpenAI, then Venice (open-source third
 * tier). Returns the first non-null response, or null if every
 * provider is unavailable / failed. Each draft service composes its
 * own system + user prompts and parses the returned text as JSON; if
 * every provider fails OR every provider returns unparseable JSON the
 * draft service falls back to its local templateDraft().
 */
export async function callDraftLlm(
  system: string,
  user: string,
  maxTokens = 1000,
): Promise<string | null> {
  // Every drafter (doc, email, slides, sheet, calendar) is bound by the
  // no-hallucination mandate: it may COMPOSE prose, but must never fabricate
  // metrics, percentages, counts, revenue, dates, or progress/trend claims that
  // aren't in the supplied context. This stops e.g. a "venture progress report"
  // doc from inventing "75% completion" / "20% increase".
  const groundedSystem = `${system}\n\n${GROUNDING_MANDATE}`;
  const anthropic = await callAnthropicJson(groundedSystem, user, maxTokens);
  if (anthropic) return anthropic;
  const openai = await callOpenAiJson(groundedSystem, user, maxTokens);
  if (openai) return openai;
  return callVeniceJson(groundedSystem, user, maxTokens);
}
