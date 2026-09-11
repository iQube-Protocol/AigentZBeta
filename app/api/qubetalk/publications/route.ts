/**
 * /api/qubetalk/publications — PublicationQube (§4.6/§14).
 *
 * GET  — list the caller's own publications.
 * POST — create a new publication (draft). Body: { title, body?, sourceContentRef? }.
 *
 * Auth: spine (`getActivePersona`). Publications are keyed by the caller's
 * Polity Public Reference (author_ref, T2-safe) — the raw personaId never
 * leaves this route.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { personaPublicRef } from '@/services/identity/personaReferences';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { createPublication } from '@/services/qubetalk/publications';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: NO_STORE });

  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ error: 'db unavailable' }, { status: 503, headers: NO_STORE });

  const myRef = personaPublicRef(persona.personaId);
  const { data, error } = await admin
    .from('qubetalk_publications')
    .select('*')
    .eq('author_ref', myRef)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE });

  return NextResponse.json({ ok: true, publications: data ?? [] }, { headers: NO_STORE });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: NO_STORE });

  const body = (await req.json().catch(() => ({}))) as { title?: string; body?: string; sourceContentRef?: string; personaLabel?: string };
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400, headers: NO_STORE });

  const myRef = personaPublicRef(persona.personaId);
  const result = await createPublication(myRef, {
    title,
    body: typeof body.body === 'string' ? body.body : null,
    sourceContentRef: typeof body.sourceContentRef === 'string' ? body.sourceContentRef : null,
    personaLabel: typeof body.personaLabel === 'string' ? body.personaLabel : null,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500, headers: NO_STORE });

  return NextResponse.json({ ok: true, publication: result.value }, { headers: NO_STORE });
}
