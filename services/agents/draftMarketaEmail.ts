/**
 * services/agents/draftMarketaEmail.ts — Aigent Me Phase 6.b Part 3.
 *
 * Chief-of-staff drafting for a Marketa transactional email. Same shape
 * as draftEmail.ts but the system prompt is tuned for outreach / campaign
 * voice rather than a personal-assistant note. Used by the Compose
 * Marketa modal; the user can still edit before sending.
 */

import type { ExperienceQubeMeta } from '@/services/iqube/experienceQube';
import { callDraftLlm } from './_lib/llmDraftHelper';

export interface DraftMarketaContext {
  experience?: Pick<
    ExperienceQubeMeta,
    'experienceName' | 'primaryGoal' | 'experienceType' | 'currentStage'
  > | null;
  activeCartridge?: string;
  intentName?: string;
}

export interface DraftMarketaInput {
  prompt: string;
  context: DraftMarketaContext;
}

export interface DraftMarketaOutput {
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  bodyText: string;
  rationale: string;
  source: 'llm' | 'template';
  generatedAt: string;
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.SPECIALIST_LLM_MODEL || 'gpt-4o-mini';

const SYSTEM_PROMPT = [
  'You are Marketa, the campaigns and partner-activation specialist drafted by aigentMe.',
  'You draft a single transactional / outreach email on behalf of the active persona.',
  'Tone: clear, value-led, partner-respectful. Avoid hype, jargon, or pushy CTAs.',
  'You return STRICT JSON ONLY with the keys: to, cc, bcc, subject, bodyText, rationale.',
  'Empty strings are valid for to / cc / bcc when the user did not specify a recipient.',
  'bodyText is plain text (no Markdown), 80–250 words, structured as: short hook → value statement → single concrete next step. End with a sign-off line.',
  'rationale is one sentence (<= 25 words) explaining the angle you took.',
  'Never invent recipient email addresses. If the user names a person without an address, leave "to" blank and reference the name in the body.',
].join(' ');

function userPrompt(input: DraftMarketaInput): string {
  const ctx = input.context;
  const lines: string[] = [];
  lines.push(`USER PROMPT: ${input.prompt.trim()}`);
  if (ctx.experience?.experienceName) lines.push(`Experience: ${ctx.experience.experienceName}`);
  if (ctx.experience?.primaryGoal) lines.push(`Primary goal: ${ctx.experience.primaryGoal}`);
  if (ctx.activeCartridge) lines.push(`Active cartridge: ${ctx.activeCartridge}`);
  if (ctx.intentName) lines.push(`Recent intent: ${ctx.intentName}`);
  lines.push('');
  lines.push('Draft the email now and return JSON.');
  return lines.join('\n');
}

async function callOpenAi(system: string, user: string): Promise<string | null> {
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
        max_tokens: 800,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data?.choices?.[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function templateDraft(input: DraftMarketaInput): Omit<DraftMarketaOutput, 'source' | 'generatedAt'> {
  const seed = input.prompt.trim().replace(/\s+/g, ' ').slice(0, 60);
  return {
    to: '',
    cc: '',
    bcc: '',
    subject: seed.length < input.prompt.trim().length ? `${seed}…` : seed || 'Quick note',
    bodyText: [
      'Hi,',
      '',
      input.prompt.trim() || 'Reaching out about a small partner activation.',
      '',
      `Happy to share the one-pager and a 15-minute window to walk through it — let me know if there's a time that works.`,
      '',
      'Best,',
      'Marketa (drafted by aigentMe)',
    ].join('\n'),
    rationale:
      'Template fallback used (no LLM key configured); standard partner-outreach shape.',
  };
}

export async function draftMarketaEmail(input: DraftMarketaInput): Promise<DraftMarketaOutput> {
  const generatedAt = new Date().toISOString();
  const prompt = (input.prompt || '').trim();
  if (!prompt) {
    return { ...templateDraft({ ...input, prompt: 'Quick partner note' }), source: 'template', generatedAt };
  }
  const raw = await callDraftLlm(SYSTEM_PROMPT, userPrompt({ ...input, prompt }), 800);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<DraftMarketaOutput>;
      if (typeof parsed.subject === 'string' && typeof parsed.bodyText === 'string') {
        return {
          to: typeof parsed.to === 'string' ? parsed.to : '',
          cc: typeof parsed.cc === 'string' ? parsed.cc : '',
          bcc: typeof parsed.bcc === 'string' ? parsed.bcc : '',
          subject: parsed.subject.trim(),
          bodyText: parsed.bodyText,
          rationale: typeof parsed.rationale === 'string' && parsed.rationale.trim()
            ? parsed.rationale.trim()
            : 'Drafted by Marketa (via aigentMe) from your prompt and current persona context.',
          source: 'llm',
          generatedAt,
        };
      }
    } catch {
      // fall through
    }
  }
  return { ...templateDraft({ ...input, prompt }), source: 'template', generatedAt };
}
