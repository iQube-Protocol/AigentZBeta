/**
 * Shared generation helpers for community content.
 *
 * Wraps the existing /api/composer/article-draft (LLM text) and
 * /api/skills/image/generate (image gen) pipelines so the new community
 * content endpoint reuses your current providers (OpenAI text, Venice/OpenAI
 * image) without duplicating provider plumbing.
 */

import OpenAI from 'openai';
import type { SupabaseClient } from '@supabase/supabase-js';
import { type KnytPersonaContext, formatKnytPersonaForPrompt } from './personaContext';

export type Skill = 'article' | 'story';

export interface GenerationInput {
  prompt: string;
  skill: Skill;
  title?: string | null;
  personaContext: KnytPersonaContext | null;
}

export interface GeneratedTextResult {
  title: string;
  body: string;
  provider: 'openai' | 'fallback';
}

const STORY_SYSTEM_PROMPT = `You are a KNYT-canon storyteller. Write evocative, image-rich short fiction set in the metaKnyts universe. Your output is plain Markdown prose — no preamble, no meta commentary, no JSON.

WORLD: metaKnyts is a cyber-mythic saga where the Order of Metaiye, the 21 Sats stewards, and the cybernetic guardians of the protocol contend for the soul of the digital frontier. Stories blend Africanfuturist mythology with crypto-protocol intrigue.

LENGTH: 250–500 words. Three to five short sections, no headings.

VOICE: vivid, present tense or close past tense, sensory-first. Reference the user's persona naturally where it fits — never as exposition or as a roll call of attributes.`;

const ARTICLE_SYSTEM_PROMPT = `You are an editorial writer for the KNYT cartridge. Write a substantive consumer-facing article in plain Markdown — no preamble, no JSON, no meta commentary.

LENGTH: ~600–900 words. Use a deck (1-2 line italic lead under the title), 3–4 H2 sections, and a closing takeaway.

VOICE: confident, specific, plain English. Connect the topic to the KNYT world or the user's stated context where it fits, but do not strain the connection.`;

function buildSystemPrompt(skill: Skill, personaContext: KnytPersonaContext | null): string {
  const base = skill === 'story' ? STORY_SYSTEM_PROMPT : ARTICLE_SYSTEM_PROMPT;
  return base + formatKnytPersonaForPrompt(personaContext);
}

function buildFallbackText(input: GenerationInput): GeneratedTextResult {
  const titleLine = input.title?.trim() ||
    (input.skill === 'story' ? 'A Fragment of the Saga' : 'Editorial draft');
  const promptLine = input.prompt.trim();
  if (input.skill === 'story') {
    return {
      title: titleLine,
      body: `*${promptLine}*\n\nThe wind off the chrome plains carried more than dust that night — it carried the hum of a protocol awakening. Somewhere behind the mirrored citadels, the Order had begun its count.\n\n_(Generation provider unavailable — this is a placeholder. Configure OPENAI_API_KEY to receive a full draft.)_`,
      provider: 'fallback',
    };
  }
  return {
    title: titleLine,
    body: `_${promptLine}_\n\n## Why this matters\n\nA placeholder article body has been generated because the language model provider is not configured. Configure OPENAI_API_KEY on the server to receive substantive editorial drafts.\n\n## What's covered\n\nWhen live, this section explains the topic in concrete consumer-facing language and ties it back to the user's KNYT context where useful.\n\n## What to do next\n\nA real article would close with a clear next action.`,
    provider: 'fallback',
  };
}

export async function generateText(input: GenerationInput): Promise<GeneratedTextResult> {
  if (!input.prompt.trim()) {
    throw new Error('prompt required');
  }

  if (!process.env.OPENAI_API_KEY) {
    return buildFallbackText(input);
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const system = buildSystemPrompt(input.skill, input.personaContext);
  const userMessage = input.title?.trim()
    ? `Title: ${input.title.trim()}\n\nPrompt: ${input.prompt.trim()}`
    : input.prompt.trim();

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: input.skill === 'story' ? 0.85 : 0.7,
    max_tokens: input.skill === 'story' ? 800 : 1400,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userMessage },
    ],
  });

  const raw = response.choices[0]?.message?.content?.trim() || '';
  if (!raw) return buildFallbackText(input);

  // Extract title: prefer explicit "Title: …" or first H1; else fall back to user-supplied title or first line.
  let title = input.title?.trim() || '';
  let body = raw;
  const titleMatch = raw.match(/^#\s+(.+?)$/m);
  if (titleMatch) {
    title = title || titleMatch[1].trim();
    body = raw.replace(titleMatch[0], '').trim();
  } else if (!title) {
    const firstLine = raw.split('\n')[0].trim();
    title = firstLine.slice(0, 80);
  }

  return { title, body, provider: 'openai' };
}

export async function generateImage(prompt: string): Promise<string | null> {
  // Defer to existing /api/skills/image/generate via direct provider call.
  // We replicate the same prompt-to-image plumbing inline here so we don't
  // require an internal HTTP hop on the server.
  const veniceKey = process.env.VENICE_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!veniceKey && !openaiKey) return null;

  const provider = veniceKey ? 'venice' : 'openai';
  const endpoint =
    provider === 'venice'
      ? 'https://api.venice.ai/api/v1/image/generate'
      : 'https://api.openai.com/v1/images/generations';
  const apiKey = provider === 'venice' ? veniceKey! : openaiKey!;
  const model = provider === 'venice' ? 'venice-sd35' : 'gpt-image-1';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(
        provider === 'venice'
          ? { model, prompt, width: 1280, height: 1024, format: 'png', return_binary: false, safe_mode: false }
          : { model, prompt, size: '1536x1024', n: 1, quality: 'low' },
      ),
      signal: controller.signal,
    });

    if (!res.ok) return null;

    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!json) return null;

    type ImagePayload = { url?: string; image_url?: string; b64_json?: string; base64?: string };

    const data = (json as { data?: ImagePayload[] }).data?.[0];
    const images = (json as { images?: (ImagePayload | string)[] }).images?.[0];

    if (data?.url) return data.url;
    if (data?.image_url) return data.image_url;
    if (data?.b64_json) return `data:image/png;base64,${data.b64_json}`;
    if (data?.base64)   return `data:image/png;base64,${data.base64}`;
    if (typeof images === 'string') return `data:image/png;base64,${images}`;
    if (typeof images === 'object' && images?.url) return images.url;
    if (typeof images === 'object' && images?.b64_json) return `data:image/png;base64,${images.b64_json}`;

    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// ── Q¢ ledger helpers ────────────────────────────────────────────────────────

import { createQcPaymentIntent, type QcPaymentIntent } from './qcPaymentIntent';
import { attemptCustodialSettlement } from './custodialSettlement';

export async function debitQc(
  supabase: SupabaseClient,
  personaId: string,
  amount: number,
  reason: string,
  referenceId: string,
): Promise<
  | { ok: true; txId: string }
  | { ok: false; error: string; status: number; payment?: QcPaymentIntent }
> {
  if (amount <= 0) return { ok: true, txId: 'zero-cost' };

  const fetchBalance = async () => {
    const { data, error } = await supabase
      .from('qc_balances')
      .select('id, balance')
      .eq('persona_id', personaId)
      .eq('currency', 'base_qc')
      .order('balance', { ascending: false });
    if (error) return { error: error.message, rows: [], total: 0 };
    const rows = data ?? [];
    const total = rows.reduce(
      (sum, r) => sum + Number((r as { balance: number }).balance),
      0,
    );
    return { rows, total, error: null as string | null };
  };

  let { rows, total, error: fetchError } = await fetchBalance();
  if (fetchError) return { ok: false, error: fetchError, status: 500 };

  if (total < amount) {
    // DVN can't cover. The CANONICAL/ATOMIC path is to settle the
    // shortfall from the persona's custodial wallet (agent_keys.evm_address)
    // — server signs, no user prompt, DVN credited, debit proceeds. Falls
    // back to the x402 external-wallet flow only when:
    //   • the persona has no custodial row in agent_keys, OR
    //   • the custodial wallet itself doesn't have enough QCT.
    const shortfall = amount - total;
    const settled = await attemptCustodialSettlement(
      supabase,
      personaId,
      shortfall,
      reason,
      referenceId,
    );

    if (settled.ok) {
      // Re-fetch — DVN was just credited by the settlement helper.
      const refetched = await fetchBalance();
      if (refetched.error) {
        return { ok: false, error: refetched.error, status: 500 };
      }
      rows = refetched.rows;
      total = refetched.total;
      // Fall through to the standard DVN debit loop below.
    } else if (settled.reason === 'no_custodial' || settled.reason === 'insufficient_custodial') {
      // External-wallet fallback (x402). Emit the payment-intent envelope
      // so RemixDialog surfaces the "Pay via Base" prompt.
      const payment = await createQcPaymentIntent(
        supabase,
        personaId,
        amount,
        reason,
        referenceId,
      );
      return {
        ok: false,
        error: `Insufficient Q¢ balance. Have ${total}, need ${amount}.`,
        status: 402,
        payment,
      };
    } else {
      // Genuine system error during custodial settlement — surface 500.
      return {
        ok: false,
        error: settled.error || 'custodial settlement failed',
        status: 500,
      };
    }
  }

  let remaining = amount;
  for (const row of rows ?? []) {
    if (remaining <= 0) break;
    const r = row as { id: string; balance: number };
    const bal = Number(r.balance);
    const deduct = Math.min(bal, remaining);
    const { error: updateError } = await supabase
      .from('qc_balances')
      .update({ balance: bal - deduct, updated_at: new Date().toISOString() })
      .eq('id', r.id);
    if (updateError) return { ok: false, error: updateError.message, status: 500 };
    remaining -= deduct;
  }

  const txId = `dvn-qc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await supabase.from('qc_transactions').insert({
    persona_id: personaId,
    amount: -amount,
    currency: 'base_qc',
    type: 'debit',
    reference_id: referenceId,
    reason,
    tx_id: txId,
    created_at: new Date().toISOString(),
  });

  return { ok: true, txId };
}

export async function creditQc(
  supabase: SupabaseClient,
  personaId: string,
  amount: number,
  reason: string,
  referenceId: string,
): Promise<void> {
  if (amount <= 0) return;

  const { data: rows } = await supabase
    .from('qc_balances')
    .select('id, balance')
    .eq('persona_id', personaId)
    .eq('currency', 'base_qc')
    .limit(1);

  const existing = (rows ?? [])[0] as { id: string; balance: number } | undefined;
  if (existing) {
    await supabase
      .from('qc_balances')
      .update({ balance: Number(existing.balance) + amount, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
  } else {
    await supabase.from('qc_balances').insert({
      persona_id: personaId,
      currency: 'base_qc',
      balance: amount,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  const txId = `dvn-qc-refund-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await supabase.from('qc_transactions').insert({
    persona_id: personaId,
    amount,
    currency: 'base_qc',
    type: 'credit',
    reference_id: referenceId,
    reason,
    tx_id: txId,
    created_at: new Date().toISOString(),
  });
}
