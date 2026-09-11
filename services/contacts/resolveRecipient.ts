/**
 * resolveRecipient — the canonical recipient resolver for aigentMe's
 * communication composition (Homecoming Closeout WP-C6, operator brief
 * 2026-08-17).
 *
 * Audit finding (2026-08-17): app/api/assistant/draft-email/route.ts
 * ALREADY resolves recipients through persona_contacts (the existing,
 * multi-source, deduped, FTS-indexed contact substrate — CSV/vCard/Google
 * Contacts import, all already implemented). This module extracts that
 * inline logic into ONE canonical, reusable resolver — per the operator's
 * instruction "if not [already wired], wire ONE canonical recipient
 * resolver to it" — so any future caller (Marketa, a future contact-aware
 * flow) uses the SAME resolution, never a second copy.
 *
 * The one real gap this closes: the original inline logic took the FIRST
 * full-text-search match unconditionally (`.limit(1)`), silently guessing
 * whenever more than one contact plausibly matched. "Never silently guess
 * a recipient when ambiguity is material" (operator brief) — this resolver
 * treats 2+ distinct contacts returned by the same search as genuine
 * ambiguity and reports it explicitly rather than picking one.
 *
 * Does NOT touch contact storage or import — persona_contacts and its CSV/
 * vCard/Google Contacts importers are reused exactly as they exist today.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export interface RecipientCandidate {
  contactId: string;
  displayName: string | null;
  email: string;
}

export type RecipientResolution =
  | { status: 'resolved'; candidate: RecipientCandidate }
  | { status: 'ambiguous'; candidates: RecipientCandidate[] }
  | { status: 'not-found' };

const STOP_WORDS =
  /\b(draft|send|email|an?|the|to|for|re|about|regarding|follow|up|again|resend|reply|write|compose|create|from|with|on|of|at|and|or|message|note|letter)\b/gi;

/** Extract candidate name tokens from a natural-language prompt — the same
 *  extraction the pre-extraction inline code used, kept identical so this
 *  refactor changes ambiguity handling, not recall. */
export function extractNameCandidates(prompt: string): string[] {
  return prompt
    .replace(STOP_WORDS, ' ')
    .replace(/[^\w\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 6);
}

/**
 * Resolve a recipient by natural-language prompt against the persona's
 * persona_contacts. Returns 'not-found' on no match, 'resolved' on exactly
 * one, and 'ambiguous' (with every candidate, never silently narrowed) on
 * two or more — the caller decides how to surface disambiguation.
 */
export async function resolveRecipientFromPrompt(
  personaId: string,
  prompt: string,
): Promise<RecipientResolution> {
  const admin = getSupabaseServer();
  if (!admin) return { status: 'not-found' };

  const nameCandidates = extractNameCandidates(prompt);
  if (nameCandidates.length === 0) return { status: 'not-found' };

  try {
    const q = nameCandidates.map((w) => w + ':*').join(' | ');
    const { data, error } = await admin
      .from('persona_contacts')
      .select('id, display_name, email')
      .eq('persona_id', personaId)
      .not('email', 'is', null)
      .textSearch('fts', q, { config: 'english', type: 'plain' })
      .limit(5);
    if (error || !data || data.length === 0) return { status: 'not-found' };

    const candidates: RecipientCandidate[] = data
      .filter((row): row is { id: string; display_name: string | null; email: string } => typeof row.email === 'string')
      .map((row) => ({ contactId: String(row.id), displayName: row.display_name, email: row.email }));

    if (candidates.length === 0) return { status: 'not-found' };
    if (candidates.length === 1) return { status: 'resolved', candidate: candidates[0] };

    // 2+ distinct contacts matched — genuine ambiguity. Never guess.
    return { status: 'ambiguous', candidates };
  } catch {
    return { status: 'not-found' };
  }
}
