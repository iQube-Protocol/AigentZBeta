/**
 * services/agents/draftEmail.ts — Aigent Me Phase 6.b Part 2.5b.
 *
 * Aigent Me as chief-of-staff: turn a one-line user prompt
 * ("thank Alice for yesterday's call and propose a follow-up next week")
 * into a fully-drafted Gmail message {to, subject, bodyText, cc?, bcc?}.
 *
 * Mirrors the specialistRouter pattern:
 *   1. Try OpenAI live (response_format=json_object) when OPENAI_API_KEY
 *      is set and SPECIALIST_LLM_MODEL points at a chat model.
 *   2. Fall back to a deterministic template that produces a plausible
 *      shape so the demo flow stays alive without any LLM key.
 *
 * Privacy contract:
 *   - personaId is T0; never echoed in the draft body.
 *   - displayLabel is T1; safe to use as a sign-off if present.
 *   - ExperienceQube meta slice is T1; safe to weave into context.
 *   - BlakQube fields never leave the spine.
 */

import type { ExperienceQubeMeta } from '@/services/iqube/experienceQube';

export interface DraftEmailContext {
  /** T1 display label of the active persona (sign-off candidate). */
  displayLabel?: string;
  /** ExperienceQube meta slice — non-confidential context. */
  experience?: Pick<
    ExperienceQubeMeta,
    'experienceName' | 'primaryGoal' | 'experienceType' | 'currentStage'
  > | null;
  /** Active cartridge slug for tone. */
  activeCartridge?: string;
  /** Optional intent name from a queued NBE. */
  intentName?: string;
}

export interface DraftEmailInput {
  /** What the user wants the email to do. Single sentence is enough. */
  prompt: string;
  context: DraftEmailContext;
}

export interface DraftEmailOutput {
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  bodyText: string;
  /** One-line explanation of why Aigent Me drafted it this way. */
  rationale: string;
  /** Whether the draft came from the live LLM or the template fallback. */
  source: 'llm' | 'template';
  /** ISO timestamp of the draft. */
  generatedAt: string;
}

import { callDraftLlm } from './_lib/llmDraftHelper';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.SPECIALIST_LLM_MODEL || 'gpt-4o-mini';

const SYSTEM_PROMPT = [
  'You are aigentMe, a sovereign personal chief-of-staff.',
  'You draft a single short, professional Gmail message on behalf of the active persona.',
  'You return STRICT JSON ONLY with the keys: to, cc, bcc, subject, bodyText, rationale.',
  'Empty strings are valid for to / cc / bcc when the user did not specify a recipient.',
  'bodyText must be PLAIN TEXT ONLY. NEVER use Markdown syntax: no asterisks for bold (**word**), no underscores for italic (_word_), no hash headers (#), no backticks for code (`code`), no bracket links, no horizontal rules. If you need emphasis, use capitalised key terms or rephrase in plain prose. Numbered lists are fine as "1. " "2. " etc. on their own lines, but item text after the number is plain — never bold the lead-in phrase. 50–250 words, signed off with the persona label when present.',
  'rationale is one sentence (<= 25 words) describing why you wrote it this way.',
  'Never invent recipient email addresses. If the user names a person without an address, leave "to" blank and reference the name in the body so they know who to fill in.',
].join(' ');

/**
 * Strip Markdown formatting from generated text. Belt-and-suspenders
 * for the system-prompt "no Markdown" rule — Sonnet still leaks
 * `**bold**` and `__underline__` into "plain text" bodyText. Operator-
 * facing email bodies render in Gmail's plain-text view, so unstripped
 * markdown ships as visible **asterisks** in the customer's inbox.
 *
 * Conservative — only patterns that are unambiguously formatting:
 *   - **bold** / __bold__   → bold
 *   - *italic* / _italic_   → italic (avoids touching `a_b_c` snake_case
 *                             by requiring leading + trailing word boundary)
 *   - `code`                → code
 *   - leading #/##/### hash headers
 *   - leading > blockquote markers
 */
function stripMarkdown(text: string): string {
  return text
    // Bold / strong: **x** or __x__ → x
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    // Italic: *x* or _x_ → x (require non-alnum boundary so snake_case
    // and asterisks-as-bullets at line start don't get clobbered)
    .replace(/(^|[^A-Za-z0-9])\*([^*\n]+)\*(?=[^A-Za-z0-9]|$)/g, '$1$2')
    .replace(/(^|[^A-Za-z0-9])_([^_\n]+)_(?=[^A-Za-z0-9]|$)/g, '$1$2')
    // Inline code: `x` → x
    .replace(/`([^`\n]+)`/g, '$1')
    // Leading hash headers: # H1, ## H2, ### H3, etc.
    .replace(/^#{1,6}\s+/gm, '')
    // Leading blockquote marker: > x → x
    .replace(/^>\s?/gm, '')
    // Collapse any triple+ newlines the strips left behind
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function userPrompt(input: DraftEmailInput): string {
  const ctx = input.context;
  const lines: string[] = [];
  lines.push(`USER PROMPT: ${input.prompt.trim()}`);
  if (ctx.displayLabel) lines.push(`Persona label: ${ctx.displayLabel}`);
  if (ctx.experience?.experienceName) lines.push(`Experience: ${ctx.experience.experienceName}`);
  if (ctx.experience?.primaryGoal) lines.push(`Primary goal: ${ctx.experience.primaryGoal}`);
  if (ctx.experience?.experienceType) lines.push(`Experience type: ${ctx.experience.experienceType}`);
  if (ctx.experience?.currentStage) lines.push(`Current stage: ${ctx.experience.currentStage}`);
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
        max_tokens: 700,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[draftEmail] OpenAI returned ${res.status}; falling back to template`);
      return null;
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data?.choices?.[0]?.message?.content?.trim() ?? null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[draftEmail] OpenAI call failed: ${msg}; falling back to template`);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function templateDraft(input: DraftEmailInput): Omit<DraftEmailOutput, 'source' | 'generatedAt'> {
  const ctx = input.context;
  const signOff = ctx.displayLabel ? `Best,\n${ctx.displayLabel}` : 'Best,';
  const goal = ctx.experience?.primaryGoal ? ` aligned with ${ctx.experience.primaryGoal}` : '';
  const intent = ctx.intentName ? ` re: ${ctx.intentName}` : '';
  // Trim and clip the prompt for the subject so it never blows past Gmail's
  // header length limit.
  const subjectSeed = input.prompt.trim().replace(/\s+/g, ' ').slice(0, 60);
  return {
    to: '',
    cc: '',
    bcc: '',
    subject: subjectSeed.length < input.prompt.trim().length ? `${subjectSeed}…` : subjectSeed,
    bodyText: [
      `Hi,`,
      ``,
      `${input.prompt.trim()}${intent}.${goal ? '' : ''}`,
      goal ? `This connects to${goal}.` : ``,
      ``,
      `Let me know what would work — happy to adjust.`,
      ``,
      signOff,
    ].filter(Boolean).join('\n'),
    rationale:
      'Template fallback used (no LLM key configured); replace with your own copy as needed.',
  };
}

export async function draftEmail(input: DraftEmailInput): Promise<DraftEmailOutput> {
  const generatedAt = new Date().toISOString();
  const prompt = (input.prompt || '').trim();
  if (!prompt) {
    return {
      ...templateDraft({ ...input, prompt: 'Quick note' }),
      source: 'template',
      generatedAt,
    };
  }

  const raw = await callDraftLlm(SYSTEM_PROMPT, userPrompt({ ...input, prompt }), 700);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<DraftEmailOutput>;
      if (
        typeof parsed.subject === 'string' &&
        typeof parsed.bodyText === 'string'
      ) {
        return {
          to: typeof parsed.to === 'string' ? parsed.to : '',
          cc: typeof parsed.cc === 'string' ? parsed.cc : '',
          bcc: typeof parsed.bcc === 'string' ? parsed.bcc : '',
          subject: stripMarkdown(parsed.subject.trim()),
          bodyText: stripMarkdown(parsed.bodyText),
          rationale:
            typeof parsed.rationale === 'string' && parsed.rationale.trim().length > 0
              ? parsed.rationale.trim()
              : 'Drafted by aigentMe from your prompt and current persona context.',
          source: 'llm',
          generatedAt,
        };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[draftEmail] failed to parse LLM JSON: ${msg}; falling back to template`);
    }
  }

  return {
    ...templateDraft({ ...input, prompt }),
    source: 'template',
    generatedAt,
  };
}
