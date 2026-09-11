/**
 * myWorkspace service — private work-artifact surface for the persona.
 *
 * Sibling of canvasService (mycanvas_entries) — points at the
 * myworkspace_entries table for strict separation. Same shape, same
 * RLS pattern, same persona-scoped owner check.
 *
 * Why a separate table: cohabiting in mycanvas_entries with a
 * meta_json.surface discriminator proved leaky — entries created
 * before the discriminator existed default to canvas and surface in
 * the wrong tab. Separation gives strict by-construction routing.
 *
 * Privacy: every operation is scoped via getActivePersona; this file
 * receives the resolved personaId and trusts it. Owner check is
 * enforced server-side on every mutation.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export type WorkspaceVisibility = 'private' | 'invited';
export type WorkspaceEntryType = 'note' | 'experience_origin' | 'experience_derived';

export interface WorkspaceEntry {
  id: string;
  title: string;
  bodyMd: string;
  tags: string[];
  visibility: WorkspaceVisibility;
  entryType: WorkspaceEntryType;
  metaJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface DbEntryRow {
  id: string;
  persona_id: string;
  title: string;
  body_md: string;
  tags: string[] | null;
  visibility: WorkspaceVisibility;
  entry_type: string | null;
  meta_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

function entryRowToShape(row: DbEntryRow): WorkspaceEntry {
  const rawType = row.entry_type;
  const entryType: WorkspaceEntryType =
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

export async function listEntries(personaId: string): Promise<WorkspaceEntry[]> {
  const admin = getSupabaseServer();
  if (!admin) return [];
  // Same payload-shrinking strategy as canvasService.listEntries:
  // strip body_md + meta_json on the list response so Lambda doesn't
  // 413 on personas with heavy entries. Detail view (getEntry) returns
  // the full row.
  const { data } = await admin
    .from('myworkspace_entries')
    .select('id, persona_id, title, tags, visibility, entry_type, created_at, updated_at')
    .eq('persona_id', personaId)
    .order('updated_at', { ascending: false })
    .limit(100);
  if (!Array.isArray(data)) return [];
  return (data as Array<Omit<DbEntryRow, 'body_md' | 'meta_json'>>).map((row) =>
    entryRowToShape({ ...row, body_md: '', meta_json: {} }),
  );
}

export async function getEntry(personaId: string, entryId: string): Promise<WorkspaceEntry | null> {
  const admin = getSupabaseServer();
  if (!admin) return null;
  const { data } = await admin
    .from('myworkspace_entries')
    .select('*')
    .eq('id', entryId)
    .eq('persona_id', personaId)
    .maybeSingle();
  return data ? entryRowToShape(data as DbEntryRow) : null;
}

export async function createEntry(
  personaId: string,
  input: {
    title: string;
    bodyMd?: string;
    tags?: string[];
    visibility?: WorkspaceVisibility;
    entryType?: WorkspaceEntryType;
    metaJson?: Record<string, unknown>;
  },
): Promise<WorkspaceEntry | null> {
  const admin = getSupabaseServer();
  if (!admin) return null;
  const title = input.title.trim().slice(0, 240);
  if (!title) return null;
  const entryType: WorkspaceEntryType =
    input.entryType === 'experience_origin' || input.entryType === 'experience_derived'
      ? input.entryType
      : 'note';
  const { data } = await admin
    .from('myworkspace_entries')
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
  patch: {
    title?: string;
    bodyMd?: string;
    tags?: string[];
    visibility?: WorkspaceVisibility;
    metaJson?: Record<string, unknown>;
  },
): Promise<WorkspaceEntry | null> {
  const admin = getSupabaseServer();
  if (!admin) return null;
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof patch.title === 'string') update.title = patch.title.trim().slice(0, 240);
  if (typeof patch.bodyMd === 'string') update.body_md = patch.bodyMd.slice(0, 200_000);
  if (Array.isArray(patch.tags)) update.tags = patch.tags.slice(0, 16);
  if (patch.visibility === 'private' || patch.visibility === 'invited') {
    update.visibility = patch.visibility;
  }
  if (patch.metaJson && typeof patch.metaJson === 'object') {
    update.meta_json = patch.metaJson;
  }
  const { data } = await admin
    .from('myworkspace_entries')
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
    .from('myworkspace_entries')
    .delete()
    .eq('id', entryId)
    .eq('persona_id', personaId);
  return !error;
}
