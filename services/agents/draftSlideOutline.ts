/**
 * services/agents/draftSlideOutline.ts — Aigent Me Phase 6.b Part 2.5c.
 *
 * Chief-of-staff drafting for Google Slides. Turns a one-liner into a
 * deck outline: { title, outline[] } where outline[i] is a single slide
 * title. Slides connector creates one slide per line after the cover.
 */

import type { ExperienceQubeMeta } from '@/services/iqube/experienceQube';

export interface DraftSlideContext {
  experience?: Pick<
    ExperienceQubeMeta,
    'experienceName' | 'primaryGoal' | 'experienceType' | 'currentStage'
  > | null;
  activeCartridge?: string;
  intentName?: string;
}

export interface DraftSlideInput {
  prompt: string;
  context: DraftSlideContext;
}

export interface DraftSlideOutput {
  title: string;
  outline: string[];
  rationale: string;
  source: 'llm' | 'template';
  generatedAt: string;
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.SPECIALIST_LLM_MODEL || 'gpt-4o-mini';

const SYSTEM_PROMPT = [
  'You are Aigent Me, a sovereign personal chief-of-staff.',
  'You draft a single Google Slides deck outline on behalf of the active persona.',
  'You return STRICT JSON ONLY with the keys: title, outline, rationale.',
  'outline is an array of 3–7 strings; each string is one slide title (4–8 words).',
  'rationale is one sentence (<= 25 words) explaining the narrative arc.',
].join(' ');

function userPrompt(input: DraftSlideInput): string {
  const ctx = input.context;
  const lines: string[] = [];
  lines.push(`USER PROMPT: ${input.prompt.trim()}`);
  if (ctx.experience?.experienceName) lines.push(`Experience: ${ctx.experience.experienceName}`);
  if (ctx.experience?.primaryGoal) lines.push(`Primary goal: ${ctx.experience.primaryGoal}`);
  if (ctx.activeCartridge) lines.push(`Active cartridge: ${ctx.activeCartridge}`);
  if (ctx.intentName) lines.push(`Recent intent: ${ctx.intentName}`);
  lines.push('');
  lines.push('Draft the deck outline now and return JSON.');
  return lines.join('\n');
}

async function callOpenAi(system: string, user: string): Promise<string | null> {
  if (!OPENAI_API_KEY) return null;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12_000);
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
        max_tokens: 500,
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

function templateDraft(input: DraftSlideInput): Omit<DraftSlideOutput, 'source' | 'generatedAt'> {
  const seed = input.prompt.trim().replace(/\s+/g, ' ').slice(0, 60);
  return {
    title: seed.length < input.prompt.trim().length ? `${seed}…` : seed || 'Untitled deck',
    outline: ['Context', 'What we tried', 'What we learned', 'Where we go next'],
    rationale:
      'Template fallback used (no LLM key configured); generic 4-slide arc.',
  };
}

export async function draftSlideOutline(input: DraftSlideInput): Promise<DraftSlideOutput> {
  const generatedAt = new Date().toISOString();
  const prompt = (input.prompt || '').trim();
  if (!prompt) return { ...templateDraft({ ...input, prompt: 'Untitled' }), source: 'template', generatedAt };
  const raw = await callOpenAi(SYSTEM_PROMPT, userPrompt({ ...input, prompt }));
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<DraftSlideOutput>;
      if (typeof parsed.title === 'string' && Array.isArray(parsed.outline)) {
        const outline = parsed.outline.filter((s): s is string => typeof s === 'string' && s.trim().length > 0);
        if (outline.length > 0) {
          return {
            title: parsed.title.trim(),
            outline,
            rationale: typeof parsed.rationale === 'string' && parsed.rationale.trim()
              ? parsed.rationale.trim()
              : 'Drafted by Aigent Me from your prompt and current persona context.',
            source: 'llm',
            generatedAt,
          };
        }
      }
    } catch {
      // fall through
    }
  }
  return { ...templateDraft({ ...input, prompt }), source: 'template', generatedAt };
}
