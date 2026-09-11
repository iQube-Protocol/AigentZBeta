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
  /**
   * Artifacts produced by other quick-actions in the current workflow
   * turn (e.g. a Slides deck created moments before this outreach
   * email draft). Each entry carries a publicly-resolvable URL. The
   * drafter is instructed to embed these URLs inline next to any
   * "attached" / "shared" / "see the deck" reference. Keeps the
   * partner-outreach voice while still honouring the
   * URL-or-omit-the-reference rule. Empty / undefined when no prior
   * artifact exists.
   */
  relatedArtifacts?: Array<{
    artifactType: string;
    title: string;
    locationUrl: string;
  }>;
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
  'bodyText is PLAIN TEXT ONLY. NEVER use Markdown syntax: no asterisks for bold (**word**), no underscores for italic (_word_), no hash headers (#), no backticks for code (`code`), no bracket links, no horizontal rules. If you need emphasis, use capitalised key terms or rephrase in plain prose. Numbered lists are fine as "1. " "2. " etc., but item text after the number is plain — never bold the lead-in phrase. 80–250 words, structured as: short hook → value statement → single concrete next step. End with a sign-off line.',
  'ATTACHMENT URL RULE (non-negotiable): If the user prompt references an attached / shared / linked document, deck, doc, sheet, file, presentation, proposal, report, one-pager, or artifact AND the RELATED ARTIFACTS block lists one, you MUST include its URL inline next to the reference. Use bare URLs only (the email client auto-linkifies them) — for example: "Quick deck for context: https://docs.google.com/presentation/d/... — keen to hear your read." Never write "attached" / "see attached" / "find attached" / "I have attached" without a URL on the same line. If the RELATED ARTIFACTS block is empty AND the user prompt references an attachment, OMIT the reference entirely rather than promise something that is not there.',
  'rationale is one sentence (<= 25 words) explaining the angle you took.',
  'Never invent recipient email addresses. If the user names a person without an address, leave "to" blank and reference the name in the body.',
].join(' ');

/** Belt-and-suspenders strip for Sonnet's tendency to leak **bold** /
 *  __underline__ / `code` even after a "no Markdown" instruction.
 *  Same patterns as draftEmail.stripMarkdown — keep them in lockstep
 *  if either side changes. (Extract to _lib in a follow-up if a third
 *  email-flavoured drafter lands.) */
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/(^|[^A-Za-z0-9])\*([^*\n]+)\*(?=[^A-Za-z0-9]|$)/g, '$1$2')
    .replace(/(^|[^A-Za-z0-9])_([^_\n]+)_(?=[^A-Za-z0-9]|$)/g, '$1$2')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function userPrompt(input: DraftMarketaInput): string {
  const ctx = input.context;
  const lines: string[] = [];
  lines.push(`USER PROMPT: ${input.prompt.trim()}`);
  if (ctx.experience?.experienceName) lines.push(`Experience: ${ctx.experience.experienceName}`);
  if (ctx.experience?.primaryGoal) lines.push(`Primary goal: ${ctx.experience.primaryGoal}`);
  if (ctx.activeCartridge) lines.push(`Active cartridge: ${ctx.activeCartridge}`);
  if (ctx.intentName) lines.push(`Recent intent: ${ctx.intentName}`);
  if (ctx.relatedArtifacts && ctx.relatedArtifacts.length > 0) {
    lines.push('');
    lines.push('RELATED ARTIFACTS (already created in this workflow — include URLs inline when referenced):');
    for (const a of ctx.relatedArtifacts) {
      lines.push(`- ${a.title} (${a.artifactType}): ${a.locationUrl}`);
    }
  }
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
          subject: stripMarkdown(parsed.subject.trim()),
          bodyText: stripMarkdown(parsed.bodyText),
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
