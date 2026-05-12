/**
 * services/agents/draftCalendarEvent.ts — Aigent Me Phase 6.b Part 2.5c.
 *
 * Chief-of-staff drafting for Calendar events. Takes a one-line user
 * prompt ("30-min intro call with alice@example.com next Tuesday afternoon
 * about the metaMe alpha") and returns a fully-shaped event:
 *   { summary, description, startIso, endIso, timeZone, attendeeEmails[] }
 *
 * Mirrors draftEmail.ts: OpenAI live (response_format=json_object) when
 * a key is set, deterministic template fallback otherwise.
 *
 * The presence of attendeeEmails decides which Calendar connector the
 * artifact binds to:
 *   - empty → google.calendar.create-event (no approval; private event)
 *   - any   → google.calendar.invite-external (approval-gated send)
 */

import type { ExperienceQubeMeta } from '@/services/iqube/experienceQube';

export interface DraftCalendarContext {
  experience?: Pick<
    ExperienceQubeMeta,
    'experienceName' | 'primaryGoal' | 'experienceType' | 'currentStage'
  > | null;
  activeCartridge?: string;
  intentName?: string;
}

export interface DraftCalendarInput {
  prompt: string;
  context: DraftCalendarContext;
  /** Now-anchor for the LLM. Defaults to server time. */
  nowIso?: string;
  /** IANA timezone hint; defaults to UTC. */
  timeZone?: string;
}

export interface DraftCalendarOutput {
  summary: string;
  description: string;
  startIso: string;
  endIso: string;
  timeZone: string;
  attendeeEmails: string[];
  rationale: string;
  source: 'llm' | 'template';
  generatedAt: string;
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.SPECIALIST_LLM_MODEL || 'gpt-4o-mini';

const SYSTEM_PROMPT = [
  'You are Aigent Me, a sovereign personal chief-of-staff.',
  'You draft a single Google Calendar event on behalf of the active persona.',
  'You return STRICT JSON ONLY with the keys: summary, description, startIso, endIso, timeZone, attendeeEmails, rationale.',
  'startIso and endIso must be RFC3339 datetime strings with timezone offset.',
  'timeZone must be a valid IANA zone like "America/New_York" or "Europe/London"; default to UTC if unsure.',
  'attendeeEmails is an array of strings; include only addresses the user explicitly mentioned. Never invent addresses.',
  'description is plain text (no Markdown), 1–3 sentences explaining the agenda.',
  'rationale is one sentence (<= 25 words) explaining your scheduling/duration choice.',
  'Default duration is 30 minutes unless the user says otherwise.',
  'Default to a sensible business-hours slot relative to "now" if the user does not give a date/time.',
].join(' ');

function userPrompt(input: DraftCalendarInput): string {
  const ctx = input.context;
  const lines: string[] = [];
  lines.push(`USER PROMPT: ${input.prompt.trim()}`);
  lines.push(`NOW: ${input.nowIso || new Date().toISOString()}`);
  if (input.timeZone) lines.push(`Preferred timezone: ${input.timeZone}`);
  if (ctx.experience?.experienceName) lines.push(`Experience: ${ctx.experience.experienceName}`);
  if (ctx.experience?.primaryGoal) lines.push(`Primary goal: ${ctx.experience.primaryGoal}`);
  if (ctx.activeCartridge) lines.push(`Active cartridge: ${ctx.activeCartridge}`);
  if (ctx.intentName) lines.push(`Recent intent: ${ctx.intentName}`);
  lines.push('');
  lines.push('Draft the event now and return JSON.');
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
        temperature: 0.4,
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

function nextBusinessHourSlot(now: Date): { startIso: string; endIso: string } {
  // Next business-hour slot: tomorrow 10:00–10:30 UTC. Cheap default.
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() + 1);
  start.setUTCHours(10, 0, 0, 0);
  const end = new Date(start);
  end.setUTCMinutes(30);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

function templateDraft(input: DraftCalendarInput): Omit<DraftCalendarOutput, 'source' | 'generatedAt'> {
  const now = input.nowIso ? new Date(input.nowIso) : new Date();
  const slot = nextBusinessHourSlot(now);
  const seed = input.prompt.trim().replace(/\s+/g, ' ').slice(0, 60);
  return {
    summary: seed.length < input.prompt.trim().length ? `${seed}…` : seed || 'Untitled event',
    description: input.prompt.trim() || 'No description.',
    startIso: slot.startIso,
    endIso: slot.endIso,
    timeZone: input.timeZone || 'UTC',
    attendeeEmails: [],
    rationale:
      'Template fallback used (no LLM key configured); defaulted to tomorrow 10:00 UTC, 30 minutes.',
  };
}

export async function draftCalendarEvent(input: DraftCalendarInput): Promise<DraftCalendarOutput> {
  const generatedAt = new Date().toISOString();
  const prompt = (input.prompt || '').trim();
  if (!prompt) {
    return {
      ...templateDraft({ ...input, prompt: 'Quick sync' }),
      source: 'template',
      generatedAt,
    };
  }

  const raw = await callOpenAi(SYSTEM_PROMPT, userPrompt({ ...input, prompt }));
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<DraftCalendarOutput>;
      if (
        typeof parsed.summary === 'string' &&
        typeof parsed.startIso === 'string' &&
        typeof parsed.endIso === 'string'
      ) {
        return {
          summary: parsed.summary.trim(),
          description: typeof parsed.description === 'string' ? parsed.description : '',
          startIso: parsed.startIso,
          endIso: parsed.endIso,
          timeZone:
            typeof parsed.timeZone === 'string' && parsed.timeZone.trim().length > 0
              ? parsed.timeZone
              : (input.timeZone || 'UTC'),
          attendeeEmails: Array.isArray(parsed.attendeeEmails)
            ? parsed.attendeeEmails.filter((e): e is string => typeof e === 'string' && /@/.test(e))
            : [],
          rationale:
            typeof parsed.rationale === 'string' && parsed.rationale.trim().length > 0
              ? parsed.rationale.trim()
              : 'Drafted by Aigent Me from your prompt and current persona context.',
          source: 'llm',
          generatedAt,
        };
      }
    } catch {
      // fall through to template
    }
  }
  return {
    ...templateDraft({ ...input, prompt }),
    source: 'template',
    generatedAt,
  };
}
