/**
 * POST /api/community-content/[id]/publish
 *
 * Body: { personaId: string }
 *
 * Flips a draft → 'shared' so it appears in the KNYT Community Content tab.
 * Creator-only. Idempotent (re-publishing a shared row is a no-op).
 *
 * Promotion to 'runtime_promoted' is a separate admin endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCommunityContentSupabase } from '../../_lib/personaContext';
import { getActivePersona } from '@/services/identity/getActivePersona';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } },
) {
  const resolved = await Promise.resolve(params);
  const id = resolved.id;
  if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });

  let body: { personaId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  // Resolve persona via the canonical spine when the body doesn't carry
  // one. Same pattern as /api/community-content/generate — clients can
  // call without body.personaId and the spine (Bearer JWT + x-persona-id
  // header set by personaFetch) resolves to the active persona.
  let personaId = body.personaId?.trim();
  if (!personaId) {
    try {
      const active = await getActivePersona(req);
      personaId = active?.personaId;
    } catch {
      // spine resolution failed — fall through to 401 below
    }
  }
  if (!personaId) {
    return NextResponse.json({ ok: false, error: 'sign-in required' }, { status: 401 });
  }

  const supabase = getCommunityContentSupabase();

  const { data: content, error: fetchError } = await supabase
    .from('community_generated_content')
    .select('id, creator_persona_id, status')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ ok: false, error: fetchError.message }, { status: 500 });
  if (!content) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });

  const row = content as { id: string; creator_persona_id: string; status: string };
  if (row.creator_persona_id !== personaId) {
    return NextResponse.json({ ok: false, error: 'Not your content' }, { status: 403 });
  }

  // Already shared / promoted — idempotent
  if (row.status !== 'draft') {
    return NextResponse.json({ ok: true, status: row.status, alreadyPublished: true });
  }

  const { error: updateError } = await supabase
    .from('community_generated_content')
    .update({ status: 'shared', updated_at: new Date().toISOString() })
    .eq('id', id);

  if (updateError) return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });

  // Insert a matching knyt_publication_states row so KnytReactionBar
  // (the 21 Sats reaction infrastructure) accepts this content as a
  // valid publication. We use the same UUID for both rows so the front
  // end can pass community_content.id straight through as publicationId.
  // Best-effort — non-fatal if the table or schema rejects.
  await supabase.from('knyt_publication_states').upsert(
    {
      id,
      subject_type: 'community_content',
      subject_id:   id,
      branch:       'community',
      state:        'submitted',
      created_at:   new Date().toISOString(),
      updated_at:   new Date().toISOString(),
    },
    { onConflict: 'id' },
  );

  return NextResponse.json({ ok: true, status: 'shared' });
}
