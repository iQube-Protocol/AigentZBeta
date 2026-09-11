/**
 * services/agents/draftSlideOutline.ts — Aigent Me Phase 6.b Part 2.5c.
 *
 * Chief-of-staff drafting for Google Slides. Turns a one-liner into a
 * deck outline: { title, outline[] } where outline[i] is a single slide
 * title. Slides connector creates one slide per line after the cover.
 */

import type { ExperienceQubeMeta } from '@/services/iqube/experienceQube';
import { callDraftLlm } from './_lib/llmDraftHelper';

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

/** One content slide. Each entry materialises as a TITLE_AND_BODY slide. */
export interface DraftSlideSection {
  title: string;
  bullets: string[];
  /**
   * Optional one-line description of a diagram or infographic that would
   * strengthen the slide. The connector renders this as a styled "Visual
   * concept" placeholder text box so the operator can drop a real graphic
   * in later. Becomes a real asset once style-guide + image generation
   * lands (Phase 6.b 2.5e).
   */
  diagramConcept?: string;
}

export interface DraftSlideOutput {
  title: string;
  /** Back-compat: array of slide titles. Kept for the connector's legacy path. */
  outline: string[];
  /** Phase 6.b 2.5c v2: full per-slide structure (title + bullets + diagram). */
  sections: DraftSlideSection[];
  rationale: string;
  source: 'llm' | 'template';
  generatedAt: string;
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.SPECIALIST_LLM_MODEL || 'gpt-4o-mini';

const SYSTEM_PROMPT = [
  'You are aigentMe, a sovereign personal chief-of-staff.',
  'You draft a single Google Slides deck on behalf of the active persona.',
  'You return STRICT JSON ONLY with the keys: title, sections, rationale.',
  'title is the deck title (becomes the file name and cover slide).',
  'sections is an array of 3–7 objects, each with {title, bullets, diagramConcept?}.',
  'Each section.title is one slide title (4–8 words).',
  'Each section.bullets is an array of 3–5 short bullet strings (8–15 words each); no leading dashes or markup.',
  'section.diagramConcept is OPTIONAL. Include it only when a visual would clearly strengthen the slide (process, comparison, taxonomy, timeline, architecture). Describe the diagram in one sentence (<= 25 words). Omit it for purely textual slides.',
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
        max_tokens: 1500,
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
  const sections: DraftSlideSection[] = [
    { title: 'Context', bullets: ['What we are talking about', 'Why it matters now', 'Who this is for'] },
    { title: 'What we tried', bullets: ['Approach taken', 'Key decisions', 'Trade-offs accepted'] },
    { title: 'What we learned', bullets: ['Result observed', 'Surprises', 'Open questions'] },
    { title: 'Where we go next', bullets: ['Top recommendation', 'Sequenced steps', 'Decision owner'] },
  ];
  return {
    title: seed.length < input.prompt.trim().length ? `${seed}…` : seed || 'Untitled deck',
    outline: sections.map((s) => s.title),
    sections,
    rationale:
      'Template fallback used (no LLM key configured); generic 4-slide arc.',
  };
}

export async function draftSlideOutline(input: DraftSlideInput): Promise<DraftSlideOutput> {
  const generatedAt = new Date().toISOString();
  const prompt = (input.prompt || '').trim();
  if (!prompt) return { ...templateDraft({ ...input, prompt: 'Untitled' }), source: 'template', generatedAt };
  const raw = await callDraftLlm(SYSTEM_PROMPT, userPrompt({ ...input, prompt }), 1000);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<DraftSlideOutput> & { sections?: unknown };
      if (typeof parsed.title === 'string' && Array.isArray(parsed.sections)) {
        const sections: DraftSlideSection[] = parsed.sections
          .filter((s): s is { title: string; bullets: unknown; diagramConcept?: unknown } =>
            !!s && typeof s === 'object' && typeof (s as { title?: unknown }).title === 'string'
              && (s as { title: string }).title.trim().length > 0)
          .map((s) => ({
            title: s.title.trim(),
            bullets: Array.isArray(s.bullets)
              ? s.bullets
                  .filter((b): b is string => typeof b === 'string' && b.trim().length > 0)
                  .map((b) => b.trim())
              : [],
            ...(typeof s.diagramConcept === 'string' && s.diagramConcept.trim().length > 0
              ? { diagramConcept: s.diagramConcept.trim() }
              : {}),
          }));
        if (sections.length > 0) {
          return {
            title: parsed.title.trim(),
            outline: sections.map((s) => s.title),
            sections,
            rationale: typeof parsed.rationale === 'string' && parsed.rationale.trim()
              ? parsed.rationale.trim()
              : 'Drafted by aigentMe from your prompt and current persona context.',
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
