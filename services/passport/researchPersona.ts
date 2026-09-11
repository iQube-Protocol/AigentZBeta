/**
 * researchPersona — a persistent, Persona-level research handle (IRL
 * Stewardship pass, 2026-10-01, item 3).
 *
 * NOT personhood. Composes with, never replaces, the Person-Persona-iQube
 * protocol (codexes/packs/agentiq/updates/
 * 2026-09-11_person-persona-iqube-constitutional-protocol-v0.1.md):
 * personhood stays anchored to KybeDID, identity continuity to RootDID; this
 * table is the display layer attached to the ACTIVE Persona's participation
 * relationship — the thing an admin sees when they need to tell Austin from
 * Ian without either one disclosing civil identity.
 *
 * One row per persona_id. A persona's research handle is stable across every
 * programme/experiment they participate in (table: research_personas,
 * migration 20261001000100).
 *
 * Privacy is the participant's own choice, never inferred:
 *   - identified   — display_name may show a civil/known name
 *   - pseudonymous — display_name/handle are a chosen alias
 *   - anonymous    — display_name/handle are a generated, non-identifying tag
 *
 * This module never reads or writes rootDid/kybeId — those stay on the T0
 * identity chain and are simply not columns here.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';

export type ResearchPersonaPrivacyMode = 'identified' | 'pseudonymous' | 'anonymous';

export interface ResearchPersonaRecord {
  id: string;
  personaId: string;
  displayName: string;
  handle: string;
  privacyMode: ResearchPersonaPrivacyMode;
  isPlaceholder: boolean;
  confirmedAt: string | null;
  proposedByPersonaId: string | null;
  createdAt: string;
  updatedAt: string;
}

function rowToRecord(r: Record<string, unknown>): ResearchPersonaRecord {
  return {
    id: String(r.id),
    personaId: String(r.persona_id),
    displayName: String(r.display_name),
    handle: String(r.handle),
    privacyMode: r.privacy_mode as ResearchPersonaPrivacyMode,
    isPlaceholder: Boolean(r.is_placeholder),
    confirmedAt: (r.confirmed_at as string | null) ?? null,
    proposedByPersonaId: (r.proposed_by_persona_id as string | null) ?? null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

/** Honest fallback label — never fabricated beyond what item 8 asks for:
 *  a neutral placeholder derived from the persona id, nothing more. */
export function placeholderResearchPersona(personaId: string): { displayName: string; handle: string } {
  const shortId = personaId.slice(0, 8);
  return { displayName: `Researcher ${shortId}`, handle: `researcher-${shortId}` };
}

export async function getResearchPersona(
  admin: SupabaseClient,
  personaId: string,
): Promise<ResearchPersonaRecord | null> {
  const { data, error } = await admin
    .from('research_personas')
    .select('*')
    .eq('persona_id', personaId)
    .maybeSingle();
  if (error || !data) return null;
  return rowToRecord(data as Record<string, unknown>);
}

/** Batch resolution for a list of personaIds — the Steward UI's grant list
 *  needs one query, not N. Personas with no row get the honest placeholder
 *  (never persisted here — only the migration backfill and onboarding write
 *  real rows; a read-time-only fallback for a persona that predates even the
 *  backfill, e.g. a grant created between migration and next deploy). */
export async function getResearchPersonasByIds(
  admin: SupabaseClient,
  personaIds: string[],
): Promise<Record<string, ResearchPersonaRecord | { displayName: string; handle: string; isPlaceholder: true }>> {
  const unique = Array.from(new Set(personaIds));
  if (unique.length === 0) return {};
  const { data, error } = await admin.from('research_personas').select('*').in('persona_id', unique);
  const out: Record<string, ResearchPersonaRecord | { displayName: string; handle: string; isPlaceholder: true }> = {};
  const found = new Set<string>();
  if (!error && data) {
    for (const row of data) {
      const rec = rowToRecord(row as Record<string, unknown>);
      out[rec.personaId] = rec;
      found.add(rec.personaId);
    }
  }
  for (const id of unique) {
    if (!found.has(id)) out[id] = { ...placeholderResearchPersona(id), isPlaceholder: true };
  }
  return out;
}

const HANDLE_PATTERN = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

export type UpsertResearchPersonaResult =
  | { ok: true; persona: ResearchPersonaRecord }
  | { ok: false; error: string };

/**
 * Create/confirm/edit a research persona. Callable by:
 *   - the participant themselves (personaId === actorPersonaId) — the
 *     "confirmed/edited during onboarding or later" path (item 3);
 *   - a steward proposing a handle at invitation time or correcting one later
 *     (item 3: "proposed at invitation creation", item 7: "policy" edit).
 * Policy is intentionally permissive here (self OR any steward who reached
 * this function — the caller route enforces WHICH stewards may reach it,
 * same separation as every other write in this file family); this function's
 * job is the data operation and the receipt, not re-deriving authority.
 */
export async function upsertResearchPersona(
  admin: SupabaseClient,
  input: {
    personaId: string;
    displayName: string;
    handle: string;
    privacyMode: ResearchPersonaPrivacyMode;
    actorPersonaId: string;
    /** true when the ACTOR is proposing this for someone else pre-confirmation. */
    proposedOnly?: boolean;
  },
): Promise<UpsertResearchPersonaResult> {
  const handle = input.handle.trim().toLowerCase();
  const displayName = input.displayName.trim();
  if (!displayName) return { ok: false, error: 'Display name is required.' };
  if (!HANDLE_PATTERN.test(handle)) {
    return { ok: false, error: 'Handle must be 3-40 lowercase letters, digits or hyphens.' };
  }

  const existing = await getResearchPersona(admin, input.personaId);

  // Handle uniqueness — the DB's own unique index is authoritative; this is
  // a friendlier pre-check so the steward gets a clear error, not a raw
  // Postgres conflict message.
  const { data: clash } = await admin
    .from('research_personas')
    .select('persona_id')
    .eq('handle', handle)
    .neq('persona_id', input.personaId)
    .maybeSingle();
  if (clash) return { ok: false, error: `Handle "@${handle}" is already in use.` };

  const isNew = !existing;
  const wasPlaceholder = existing?.isPlaceholder ?? false;
  const row = {
    persona_id: input.personaId,
    display_name: displayName,
    handle,
    privacy_mode: input.privacyMode,
    is_placeholder: false,
    proposed_by_persona_id: input.proposedOnly ? input.actorPersonaId : (existing?.proposedByPersonaId ?? null),
    confirmed_at: input.proposedOnly ? existing?.confirmedAt ?? null : new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await admin
    .from('research_personas')
    .upsert(row, { onConflict: 'persona_id' })
    .select('*')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Could not save research persona.' };

  try {
    await createActivityReceipt({
      personaId: input.actorPersonaId,
      actionType: input.proposedOnly ? 'research_persona_proposed' : 'research_persona_updated',
      summary: input.proposedOnly
        ? `Research persona proposed: ${displayName} (@${handle})`
        : `Research persona ${isNew || wasPlaceholder ? 'created' : 'updated'}: ${displayName} (@${handle})`,
      activeCartridge: 'polity-passport',
      actionInput: {
        targetPersonaId: input.personaId,
        displayName,
        handle,
        privacyMode: input.privacyMode,
        wasPlaceholder,
      },
    });
  } catch {
    // Receipt failure never blocks the write — see createActivityReceipt's
    // own fail-soft contract, reused here.
  }

  return { ok: true, persona: rowToRecord(data as Record<string, unknown>) };
}
