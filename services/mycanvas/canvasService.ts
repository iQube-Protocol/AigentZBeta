/**
 * myCanvas service — Aigent Me Phase 4 · Activations · myCanvas.
 *
 * Personal publishing surface inside the metaMe runtime. Each persona
 * owns their entries; cross-persona invites are stubbed via the
 * `mycanvas_invites` table (acceptance flow lands later).
 *
 * Privacy: every operation is scoped via `getActivePersona`; this file
 * receives the resolved personaId and trusts it. Owner check is enforced
 * server-side on every mutation.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export type CanvasVisibility = 'private' | 'invited';
export type CanvasEntryType = 'note' | 'experience_origin' | 'experience_derived';

export interface CanvasEntry {
  id: string;
  title: string;
  bodyMd: string;
  tags: string[];
  visibility: CanvasVisibility;
  entryType: CanvasEntryType;
  metaJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CanvasInvite {
  id: string;
  entryId: string;
  invitedPersonaId: string; // T1 — caller-facing only when caller is owner
  role: 'viewer' | 'commenter';
  invitedAt: string;
  acceptedAt: string | null;
}

interface DbEntryRow {
  id: string;
  persona_id: string;
  title: string;
  body_md: string;
  tags: string[] | null;
  visibility: CanvasVisibility;
  entry_type: string | null;
  meta_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

function entryRowToShape(row: DbEntryRow): CanvasEntry {
  const rawType = row.entry_type;
  const entryType: CanvasEntryType =
    rawType === 'experience_origin' || rawType === 'experience_derived'
      ? rawType
      : 'note';
  return {
    id: row.id,
    title: row.title,
    bodyMd: row.body_md ?? '',
    tags: row.tags ?? [],
    visibility: row.visibility,
    entryType,
    metaJson: row.meta_json ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listEntries(personaId: string): Promise<CanvasEntry[]> {
  const admin = getSupabaseServer();
  if (!admin) return [];
  const { data } = await admin
    .from('mycanvas_entries')
    .select('*')
    .eq('persona_id', personaId)
    .order('updated_at', { ascending: false })
    .limit(100);
  if (!Array.isArray(data)) return [];
  return (data as DbEntryRow[]).map(entryRowToShape);
}

export async function createEntry(
  personaId: string,
  input: {
    title: string;
    bodyMd?: string;
    tags?: string[];
    visibility?: CanvasVisibility;
    entryType?: CanvasEntryType;
    metaJson?: Record<string, unknown>;
  },
): Promise<CanvasEntry | null> {
  const admin = getSupabaseServer();
  if (!admin) return null;
  const title = input.title.trim().slice(0, 240);
  if (!title) return null;
  const entryType: CanvasEntryType =
    input.entryType === 'experience_origin' || input.entryType === 'experience_derived'
      ? input.entryType
      : 'note';
  const { data } = await admin
    .from('mycanvas_entries')
    .insert({
      persona_id: personaId,
      title,
      body_md: (input.bodyMd ?? '').slice(0, 200_000),
      tags: Array.isArray(input.tags) ? input.tags.slice(0, 16) : [],
      visibility: input.visibility === 'invited' ? 'invited' : 'private',
      entry_type: entryType,
      meta_json: input.metaJson ?? {},
    })
    .select('*')
    .maybeSingle();
  return data ? entryRowToShape(data as DbEntryRow) : null;
}

export async function updateEntry(
  personaId: string,
  entryId: string,
  patch: { title?: string; bodyMd?: string; tags?: string[]; visibility?: CanvasVisibility },
): Promise<CanvasEntry | null> {
  const admin = getSupabaseServer();
  if (!admin) return null;
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof patch.title === 'string') update.title = patch.title.trim().slice(0, 240);
  if (typeof patch.bodyMd === 'string') update.body_md = patch.bodyMd.slice(0, 200_000);
  if (Array.isArray(patch.tags)) update.tags = patch.tags.slice(0, 16);
  if (patch.visibility === 'private' || patch.visibility === 'invited') {
    update.visibility = patch.visibility;
  }
  const { data } = await admin
    .from('mycanvas_entries')
    .update(update)
    .eq('id', entryId)
    .eq('persona_id', personaId) // owner-only mutation
    .select('*')
    .maybeSingle();
  return data ? entryRowToShape(data as DbEntryRow) : null;
}

export async function deleteEntry(personaId: string, entryId: string): Promise<boolean> {
  const admin = getSupabaseServer();
  if (!admin) return false;
  const { error } = await admin
    .from('mycanvas_entries')
    .delete()
    .eq('id', entryId)
    .eq('persona_id', personaId);
  return !error;
}

// ─────────────────────────────────────────────────────────────────────────
// Invites — stub. Future work wires acceptance + cross-persona reads.
// ─────────────────────────────────────────────────────────────────────────

export async function listInvites(
  personaId: string,
  entryId: string,
): Promise<CanvasInvite[]> {
  const admin = getSupabaseServer();
  if (!admin) return [];
  // Confirm caller owns the entry before exposing invites.
  const { data: entry } = await admin
    .from('mycanvas_entries')
    .select('id')
    .eq('id', entryId)
    .eq('persona_id', personaId)
    .maybeSingle();
  if (!entry) return [];
  const { data } = await admin
    .from('mycanvas_invites')
    .select('*')
    .eq('entry_id', entryId)
    .order('invited_at', { ascending: false });
  if (!Array.isArray(data)) return [];
  return data.map((r) => {
    const row = r as {
      id: string;
      entry_id: string;
      invited_persona_id: string;
      role: 'viewer' | 'commenter';
      invited_at: string;
      accepted_at: string | null;
    };
    return {
      id: row.id,
      entryId: row.entry_id,
      invitedPersonaId: row.invited_persona_id,
      role: row.role,
      invitedAt: row.invited_at,
      acceptedAt: row.accepted_at,
    };
  });
}

export async function inviteToEntry(
  personaId: string,
  entryId: string,
  invitedPersonaId: string,
  role: 'viewer' | 'commenter' = 'viewer',
): Promise<CanvasInvite | null> {
  const admin = getSupabaseServer();
  if (!admin) return null;
  // Owner check.
  const { data: entry } = await admin
    .from('mycanvas_entries')
    .select('id, visibility')
    .eq('id', entryId)
    .eq('persona_id', personaId)
    .maybeSingle();
  if (!entry) return null;
  // Flip visibility to 'invited' the first time someone is added.
  await admin
    .from('mycanvas_entries')
    .update({ visibility: 'invited' })
    .eq('id', entryId)
    .eq('persona_id', personaId);
  const { data } = await admin
    .from('mycanvas_invites')
    .upsert(
      { entry_id: entryId, invited_persona_id: invitedPersonaId, role },
      { onConflict: 'entry_id,invited_persona_id' },
    )
    .select('*')
    .maybeSingle();
  if (!data) return null;
  const row = data as {
    id: string;
    entry_id: string;
    invited_persona_id: string;
    role: 'viewer' | 'commenter';
    invited_at: string;
    accepted_at: string | null;
  };
  return {
    id: row.id,
    entryId: row.entry_id,
    invitedPersonaId: row.invited_persona_id,
    role: row.role,
    invitedAt: row.invited_at,
    acceptedAt: row.accepted_at,
  };
}
