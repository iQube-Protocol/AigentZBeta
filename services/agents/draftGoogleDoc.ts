/**
 * services/agents/draftGoogleDoc.ts — Aigent Me Phase 6.b Part 2.5c.
 *
 * Chief-of-staff drafting for Google Docs. Turns a one-liner ("a brief on
 * the metaMe Q1 alpha for the partner team") into a fully-shaped doc:
 *   { title, bodyText, shareSuggestions: { email, role }[] }
 *
 * The presence of shareSuggestions decides whether the artifact binds to
 * a share action:
 *   - empty → no second-tier; doc is created privately.
 *   - any   → artifact carries google.drive.share-doc with approval gate.
 */

import type { ExperienceQubeMeta } from '@/services/iqube/experienceQube';
import { callDraftLlm } from './_lib/llmDraftHelper';

export interface DraftGoogleDocContext {
  experience?: Pick<
    ExperienceQubeMeta,
    'experienceName' | 'primaryGoal' | 'experienceType' | 'currentStage'
  > | null;
  activeCartridge?: string;
  intentName?: string;
}

export interface DraftGoogleDocInput {
  prompt: string;
  context: DraftGoogleDocContext;
}

export interface DraftShareSuggestion {
  email: string;
  role: 'reader' | 'commenter' | 'writer';
}

export interface DraftGoogleDocOutput {
  title: string;
  bodyText: string;
  shareSuggestions: DraftShareSuggestion[];
  rationale: string;
  source: 'llm' | 'template';
  generatedAt: string;
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.SPECIALIST_LLM_MODEL || 'gpt-4o-mini';

const SYSTEM_PROMPT = [
  'You are aigentMe, a sovereign personal chief-of-staff.',
  'You draft a single Google Doc on behalf of the active persona.',
  'You return STRICT JSON ONLY with the keys: title, bodyText, shareSuggestions, rationale.',
  'bodyText is plain text (no Markdown, no HTML), 150–500 words structured with clear paragraphs.',
  'shareSuggestions is an array of {email, role} where role is "reader" | "commenter" | "writer".',
  'Include shareSuggestions only when the user explicitly names recipients. Never invent addresses.',
  'rationale is one sentence (<= 25 words).',
].join(' ');

function userPrompt(input: DraftGoogleDocInput): string {
  const ctx = input.context;
  const lines: string[] = [];
  lines.push(`USER PROMPT: ${input.prompt.trim()}`);
  if (ctx.experience?.experienceName) lines.push(`Experience: ${ctx.experience.experienceName}`);
  if (ctx.experience?.primaryGoal) lines.push(`Primary goal: ${ctx.experience.primaryGoal}`);
  if (ctx.activeCartridge) lines.push(`Active cartridge: ${ctx.activeCartridge}`);
  if (ctx.intentName) lines.push(`Recent intent: ${ctx.intentName}`);
  lines.push('');
  lines.push('Draft the doc now and return JSON.');
  return lines.join('\n');
}

async function callOpenAi(system: string, user: string): Promise<string | null> {
  if (!OPENAI_API_KEY) return null;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.5,
        max_tokens: 1200,
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

function templateDraft(input: DraftGoogleDocInput): Omit<DraftGoogleDocOutput, 'source' | 'generatedAt'> {
  const seed = input.prompt.trim().replace(/\s+/g, ' ').slice(0, 60);
  return {
    title: seed.length < input.prompt.trim().length ? `${seed}…` : seed || 'Untitled document',
    bodyText: [
      input.prompt.trim() || 'Untitled document.',
      '',
      'Aigent Me drafted this as a fallback placeholder — add your real content here.',
    ].join('\n'),
    shareSuggestions: [],
    rationale:
      'Template fallback used (no LLM key configured); replace with your own copy.',
  };
}

function validRole(value: unknown): DraftShareSuggestion['role'] {
  return value === 'reader' || value === 'writer' || value === 'commenter' ? value : 'commenter';
}

export async function draftGoogleDoc(input: DraftGoogleDocInput): Promise<DraftGoogleDocOutput> {
  const generatedAt = new Date().toISOString();
  const prompt = (input.prompt || '').trim();
  if (!prompt) {
    return { ...templateDraft({ ...input, prompt: 'Untitled' }), source: 'template', generatedAt };
  }
  const raw = await callDraftLlm(SYSTEM_PROMPT, userPrompt({ ...input, prompt }), 1000);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<DraftGoogleDocOutput>;
      if (typeof parsed.title === 'string' && typeof parsed.bodyText === 'string') {
        const shareSuggestions: DraftShareSuggestion[] = Array.isArray(parsed.shareSuggestions)
          ? parsed.shareSuggestions
              .filter((s): s is { email: string; role: string } =>
                !!s && typeof s.email === 'string' && /@/.test(s.email))
              .map((s) => ({ email: s.email, role: validRole(s.role) }))
          : [];
        return {
          title: parsed.title.trim(),
          bodyText: parsed.bodyText,
          shareSuggestions,
          rationale: typeof parsed.rationale === 'string' && parsed.rationale.trim()
            ? parsed.rationale.trim()
            : 'Drafted by aigentMe from your prompt and current persona context.',
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
