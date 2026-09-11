/**
 * GET /api/admin/persona-graph/search?q=<term>
 *
 * Lookup endpoint for the Persona 360 inspector tab's picker. Matches
 * against persona display_label, persona fio_handle, crm_personas.email,
 * and crm_personas.identity_persona_id (when an admin pastes a known
 * persona id directly).
 *
 * Returns a short list of T1-safe persona summaries — the admin picks
 * one and the tab calls /api/admin/persona-graph?personaId=... for the
 * full graph.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SearchResult {
  personaId: string;
  displayLabel: string | null;
  fioHandle: string | null;
  email: string | null;
}

export async function GET(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  if (!persona.cartridgeFlags.isAdmin) {
    return NextResponse.json({ error: 'admin-only' }, { status: 403 });
  }

  const url = new URL(req.url);
  const raw = (url.searchParams.get('q') ?? '').trim();
  if (raw.length < 2) {
    return NextResponse.json({ ok: true, results: [] });
  }

  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json({ error: 'supabase-unavailable' }, { status: 500 });
  }

  // Fire each match branch in parallel; merge + de-dup at the end.
  // Each branch caps at 10 — the picker only shows ~20 results before
  // truncation. Postgres ilike with the small dataset alpha has is fine
  // without a search index; add tsvector when the result list gets slow.
  const term = `%${raw}%`;
  const idTerm = raw;

  const [byLabel, byHandle, byEmail, byId] = await Promise.all([
    admin
      .from('personas')
      .select('id, display_label, fio_handle')
      .ilike('display_label', term)
      .limit(10),
    admin
      .from('personas')
      .select('id, display_label, fio_handle')
      .ilike('fio_handle', term)
      .limit(10),
    admin
      .from('crm_personas')
      .select('identity_persona_id, email')
      .ilike('email', term)
      .limit(10),
    admin
      .from('personas')
      .select('id, display_label, fio_handle')
      .eq('id', idTerm)
      .limit(1),
  ]);

  const personaRowsById = new Map<string, { displayLabel: string | null; fioHandle: string | null }>();
  const pushRow = (id: string, displayLabel: string | null, fioHandle: string | null) => {
    if (!personaRowsById.has(id)) {
      personaRowsById.set(id, { displayLabel, fioHandle });
    }
  };
  for (const row of (byLabel.data ?? []) as Array<{ id: string; display_label: string | null; fio_handle: string | null }>) {
    pushRow(row.id, row.display_label, row.fio_handle);
  }
  for (const row of (byHandle.data ?? []) as Array<{ id: string; display_label: string | null; fio_handle: string | null }>) {
    pushRow(row.id, row.display_label, row.fio_handle);
  }
  for (const row of (byId.data ?? []) as Array<{ id: string; display_label: string | null; fio_handle: string | null }>) {
    pushRow(row.id, row.display_label, row.fio_handle);
  }

  // Email match — we got identity_persona_ids; if any aren't already
  // known via the persona lookups above, hydrate them.
  const emailHits = ((byEmail.data ?? []) as Array<{ identity_persona_id: string | null; email: string | null }>)
    .map((r) => ({ id: r.identity_persona_id, email: r.email }))
    .filter((r): r is { id: string; email: string | null } => !!r.id);
  const missingIds = emailHits.map((h) => h.id).filter((id) => !personaRowsById.has(id));
  if (missingIds.length > 0) {
    const { data } = await admin
      .from('personas')
      .select('id, display_label, fio_handle')
      .in('id', missingIds)
      .limit(20);
    for (const row of (data ?? []) as Array<{ id: string; display_label: string | null; fio_handle: string | null }>) {
      pushRow(row.id, row.display_label, row.fio_handle);
    }
  }

  // Final pass — pull email per personaId via crm_personas (one batched
  // call) so the picker can show the email alongside the label.
  const allIds = Array.from(personaRowsById.keys());
  const emailById = new Map<string, string | null>();
  if (allIds.length > 0) {
    const { data: crmRows } = await admin
      .from('crm_personas')
      .select('identity_persona_id, email')
      .in('identity_persona_id', allIds);
    for (const row of (crmRows ?? []) as Array<{ identity_persona_id: string; email: string | null }>) {
      emailById.set(row.identity_persona_id, row.email);
    }
  }

  const results: SearchResult[] = allIds.slice(0, 20).map((id) => {
    const row = personaRowsById.get(id)!;
    return {
      personaId: id,
      displayLabel: row.displayLabel,
      fioHandle: row.fioHandle,
      email: emailById.get(id) ?? null,
    };
  });

  return NextResponse.json({ ok: true, results });
}
