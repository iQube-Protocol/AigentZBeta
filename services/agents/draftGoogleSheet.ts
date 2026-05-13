/**
 * services/agents/draftGoogleSheet.ts
 *
 * Chief-of-staff drafting for Google Sheets. Turns a one-liner ("a tracker
 * for our Q1 partner outreach with name, status, last contact, next step")
 * into a fully-shaped spreadsheet:
 *   { title, sheetName, rows: string[][], rationale }
 *
 * The first row of `rows` is always the header. Subsequent rows are data.
 * The drafter may include 0–10 seed data rows; if it cannot infer a useful
 * seed, it returns just the header.
 */

import type { ExperienceQubeMeta } from '@/services/iqube/experienceQube';

export interface DraftGoogleSheetContext {
  experience?: Pick<
    ExperienceQubeMeta,
    'experienceName' | 'primaryGoal' | 'experienceType' | 'currentStage'
  > | null;
  activeCartridge?: string;
  intentName?: string;
}

export interface DraftGoogleSheetInput {
  prompt: string;
  context: DraftGoogleSheetContext;
}

export interface DraftGoogleSheetOutput {
  title: string;
  sheetName: string;
  rows: string[][];
  rationale: string;
  source: 'llm' | 'template';
  generatedAt: string;
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.SPECIALIST_LLM_MODEL || 'gpt-4o-mini';

const SYSTEM_PROMPT = [
  'You are aigentMe, a sovereign personal chief-of-staff.',
  'You draft a single Google Sheets spreadsheet on behalf of the active persona.',
  'You return STRICT JSON ONLY with the keys: title, sheetName, rows, rationale.',
  'rows is a 2D string array. The FIRST row is the header. Include 0–10 data rows beneath.',
  'Each row has the same length as the header. Cell values are plain strings.',
  'Pick a header that is small (3–8 columns) and operational; do not over-design the schema.',
  'sheetName is the tab name; "Sheet1" if you have no better idea. title is the spreadsheet title.',
  'rationale is one sentence (<= 25 words).',
].join(' ');

function userPrompt(input: DraftGoogleSheetInput): string {
  const ctx = input.context;
  const lines: string[] = [];
  lines.push(`USER PROMPT: ${input.prompt.trim()}`);
  if (ctx.experience?.experienceName) lines.push(`Experience: ${ctx.experience.experienceName}`);
  if (ctx.experience?.primaryGoal) lines.push(`Primary goal: ${ctx.experience.primaryGoal}`);
  if (ctx.activeCartridge) lines.push(`Active cartridge: ${ctx.activeCartridge}`);
  if (ctx.intentName) lines.push(`Recent intent: ${ctx.intentName}`);
  lines.push('');
  lines.push('Draft the spreadsheet now and return JSON.');
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
        temperature: 0.4,
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

function templateDraft(input: DraftGoogleSheetInput): Omit<DraftGoogleSheetOutput, 'source' | 'generatedAt'> {
  const seed = input.prompt.trim().replace(/\s+/g, ' ').slice(0, 60);
  const title = seed.length < input.prompt.trim().length ? `${seed}…` : seed || 'Untitled spreadsheet';
  return {
    title,
    sheetName: 'Sheet1',
    rows: [
      ['Name', 'Status', 'Next step', 'Owner', 'Notes'],
    ],
    rationale:
      'Template fallback used (no LLM key configured); replace the header columns with the schema you actually want.',
  };
}

function sanitiseRows(raw: unknown): string[][] {
  if (!Array.isArray(raw)) return [];
  const rows: string[][] = [];
  for (const row of raw) {
    if (!Array.isArray(row)) continue;
    const cells: string[] = row.map((cell) =>
      typeof cell === 'string' ? cell : cell == null ? '' : String(cell),
    );
    rows.push(cells);
    if (rows.length >= 11) break; // 1 header + 10 data rows max
  }
  // Pad rows to header width so the sheets API accepts them.
  const width = rows[0]?.length ?? 0;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].length < width) {
      while (rows[i].length < width) rows[i].push('');
    } else if (rows[i].length > width) {
      rows[i] = rows[i].slice(0, width);
    }
  }
  return rows;
}

export async function draftGoogleSheet(input: DraftGoogleSheetInput): Promise<DraftGoogleSheetOutput> {
  const generatedAt = new Date().toISOString();
  const prompt = (input.prompt || '').trim();
  if (!prompt) {
    return { ...templateDraft({ ...input, prompt: 'Untitled' }), source: 'template', generatedAt };
  }
  const raw = await callOpenAi(SYSTEM_PROMPT, userPrompt({ ...input, prompt }));
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<DraftGoogleSheetOutput>;
      const rows = sanitiseRows(parsed.rows);
      if (typeof parsed.title === 'string' && rows.length > 0 && rows[0].length > 0) {
        return {
          title: parsed.title.trim(),
          sheetName:
            typeof parsed.sheetName === 'string' && parsed.sheetName.trim().length > 0
              ? parsed.sheetName.trim().slice(0, 80)
              : 'Sheet1',
          rows,
          rationale:
            typeof parsed.rationale === 'string' && parsed.rationale.trim()
              ? parsed.rationale.trim()
              : 'Drafted by aigentMe from your prompt and current persona context.',
          source: 'llm',
          generatedAt,
        };
      }
    } catch {
      // fall through to template
    }
  }
  return { ...templateDraft({ ...input, prompt }), source: 'template', generatedAt };
}
