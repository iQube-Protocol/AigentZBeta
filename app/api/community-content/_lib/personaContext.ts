/**
 * KNYT persona context for community content generation.
 *
 * Pulls the four user-context fields the operator confirmed for prompt
 * injection:
 *   - handle           (FIO/social handle)
 *   - journeyStage     (Outside Order | Acolyte | Keta | Keji | First | Zero)
 *   - characterPreference  (Characters-Owned)
 *   - ownedScrolls         (Motion / Print / Digital / print_episodes counts)
 *
 * Returns a compact text fragment ready to drop into a system prompt.
 * Fails gracefully — if no persona row exists or fields are empty the helper
 * returns null and the generation prompt runs without KNYT context.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface KnytPersonaContext {
  handle: string | null;
  firstName: string | null;
  journeyStage: string | null;
  characterPreference: string | null;
  ownedScrolls: {
    motionComics: number;
    printComics: number;
    digitalComics: number;
    printEpisodes: number;
  };
}

const STAGE_DISPLAY: Record<string, string> = {
  outside_order: 'Outside Order',
  acolyte: 'Acolyte',
  keta: 'Keta',
  keji: 'Keji',
  first: 'First',
  zero: 'Zero',
};

function toCount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.round(value));
  if (typeof value === 'string') {
    const n = Number.parseInt(value, 10);
    return Number.isNaN(n) ? 0 : Math.max(0, n);
  }
  return 0;
}

function toStr(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export async function loadKnytPersonaContext(
  supabase: SupabaseClient,
  personaId: string,
): Promise<KnytPersonaContext | null> {
  const [personaResult, journeyResult] = await Promise.all([
    supabase.from('nakamoto_knyt_personas').select('*').eq('id', personaId).maybeSingle(),
    supabase.from('journey_states').select('stage').eq('persona_id', personaId).maybeSingle(),
  ]);

  const row = personaResult.data as Record<string, unknown> | null;
  if (!row) return null;

  const journey = journeyResult.data as { stage?: string } | null;
  const stageKey = journey?.stage?.toLowerCase().replace(/\s+/g, '_');
  const journeyStage = stageKey ? STAGE_DISPLAY[stageKey] ?? journey?.stage ?? null : null;

  const handle =
    toStr(row['Twitter-Handle']) ||
    toStr(row['Telegram-Handle']) ||
    toStr(row['Discord-Handle']) ||
    toStr(row['Instagram-Handle']) ||
    null;

  return {
    handle,
    firstName: toStr(row['First-Name']),
    journeyStage,
    characterPreference: toStr(row['Characters-Owned']),
    ownedScrolls: {
      motionComics:  toCount(row['Motion-Comics-Owned']),
      printComics:   toCount(row['Print-Comics-Owned']),
      digitalComics: toCount(row['Digital-Comics-Owned']),
      printEpisodes: toCount(row['print_episodes_owned']),
    },
  };
}

/**
 * Format the persona context as a system-prompt fragment. Returns an empty
 * string if no useful context is available, so the prompt assembly can
 * simply concatenate without conditional logic.
 */
export function formatKnytPersonaForPrompt(ctx: KnytPersonaContext | null): string {
  if (!ctx) return '';

  const lines: string[] = [];
  if (ctx.firstName) lines.push(`- First name: ${ctx.firstName}`);
  if (ctx.handle) lines.push(`- Social handle: @${ctx.handle.replace(/^@/, '')}`);
  if (ctx.journeyStage) lines.push(`- KNYT journey stage: ${ctx.journeyStage}`);
  if (ctx.characterPreference) lines.push(`- Favourite KNYT character(s): ${ctx.characterPreference}`);

  const scrolls = ctx.ownedScrolls;
  const totalScrolls = scrolls.motionComics + scrolls.printComics + scrolls.digitalComics + scrolls.printEpisodes;
  if (totalScrolls > 0) {
    const parts: string[] = [];
    if (scrolls.printEpisodes > 0) parts.push(`${scrolls.printEpisodes} print episode(s)`);
    if (scrolls.motionComics > 0)  parts.push(`${scrolls.motionComics} motion comic(s)`);
    if (scrolls.printComics > 0)   parts.push(`${scrolls.printComics} print comic(s)`);
    if (scrolls.digitalComics > 0) parts.push(`${scrolls.digitalComics} digital comic(s)`);
    lines.push(`- Owned scrolls: ${parts.join(', ')}`);
  }

  if (lines.length === 0) return '';
  return `\n\nUSER CONTEXT (for personalisation — weave naturally, do not parrot back as a list):\n${lines.join('\n')}\n`;
}

export function getCommunityContentSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing Supabase credentials');
  return createClient(url, key);
}
