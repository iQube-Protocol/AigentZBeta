/**
 * POST /api/mycanvas/entries/[id]/publish-to-pulse
 *
 * Publish a myCanvas `note` entry directly to a Pulse surface.
 *
 * Path:
 *   1. Resolve the calling persona via the canonical spine.
 *   2. Load the myCanvas entry; only the owner can publish their own entry.
 *   3. Only entryType='note' is accepted here. For 'experience_derived'
 *      use the existing /api/community-content/[id]/publish path —
 *      that row already has a community_generated_content backing.
 *   4. Materialise a stub community_generated_content row with skill='note',
 *      qc_cost=0, image_url=null, status='draft', cartridge=body.cartridge.
 *      The shared table means a note can graduate into a rich-media
 *      article/story later via Studio exQubes without a row migration.
 *   5. Flip the freshly-minted row to 'shared' and write the matching
 *      {cartridge}_publication_states record so the Living Canon surfaces
 *      pick it up.
 *   6. Stamp the originating myCanvas entry with metaJson.contentId so
 *      the existing republish path works idempotently.
 *
 * Body: { cartridge: 'knyt' | 'qripto' }
 *
 * 403s if the caller doesn't own the entry. 400s on missing / invalid
 * body. 404s on missing entry.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getEntry, updateEntry } from '@/services/mycanvas/canvasService';
import { getCommunityContentSupabase } from '@/app/api/community-content/_lib/personaContext';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  cartridge?: 'knyt' | 'qripto' | 'metame-runtime';
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } },
): Promise<NextResponse> {
  const resolved = await Promise.resolve(params);
  const entryId = resolved.id;
  if (!entryId) {
    return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });
  }

  const persona = await getActivePersona(req);
  if (!persona) {
    return NextResponse.json(
      { ok: false, error: 'unauthenticated' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid-json' }, { status: 400 });
  }

  const cartridge: 'knyt' | 'qripto' | 'metame-runtime' =
    body.cartridge === 'qripto' ? 'qripto'
    : body.cartridge === 'metame-runtime' ? 'metame-runtime'
    : 'knyt';

  // Owner-only — getEntry already filters by personaId so a non-owner
  // gets null and falls through to 404.
  const entry = await getEntry(persona.personaId, entryId);
  if (!entry) {
    return NextResponse.json({ ok: false, error: 'entry-not-found' }, { status: 404 });
  }
  if (entry.entryType !== 'note') {
    return NextResponse.json(
      {
        ok: false,
        error: 'entry-type-not-supported',
        detail: `publish-to-pulse accepts entryType='note' only; this entry is '${entry.entryType}'. For experience_derived entries use /api/community-content/[id]/publish via the contentId on metaJson.`,
      },
      { status: 400 },
    );
  }

  // Already published? Idempotent — return the existing contentId.
  const existingContentId =
    typeof entry.metaJson?.contentId === 'string' ? entry.metaJson.contentId : null;
  if (existingContentId) {
    return NextResponse.json({
      ok: true,
      alreadyPublished: true,
      contentId: existingContentId,
      cartridge,
    });
  }

  const supabase = getCommunityContentSupabase();

  // 1. Insert the community_generated_content row. skill='note' is the
  //    new path opened by the pulse_cartridge_split migration; widened
  //    CHECK accepts it alongside 'article' and 'story'.
  const title = (entry.title ?? '').trim() || 'Untitled note';
  const articleBody = entry.bodyMd ?? '';
  const promptText = title; // notes don't have an LLM prompt; reuse title

  const insertPayload = {
    creator_persona_id:   persona.personaId,
    source_experience_id: null,
    parent_id:            null,
    skill:                'note',
    title,
    prompt:               promptText,
    article_body:         articleBody,
    image_url:            null,
    status:               'draft',
    qc_cost:              0,
    generation_index:     0,
    cartridge,
  };

  const { data: inserted, error: insertError } = await supabase
    .from('community_generated_content')
    .insert(insertPayload)
    .select('id')
    .single();

  if (insertError || !inserted) {
    return NextResponse.json(
      { ok: false, error: 'note-row-insert-failed', detail: insertError?.message },
      { status: 500 },
    );
  }

  const contentId = (inserted as { id: string }).id;

  // 2. Flip to 'shared' so the Pulse surfaces pick it up.
  const { error: updateError } = await supabase
    .from('community_generated_content')
    .update({ status: 'shared', updated_at: new Date().toISOString() })
    .eq('id', contentId);

  if (updateError) {
    return NextResponse.json(
      { ok: false, error: 'publish-failed', detail: updateError.message },
      { status: 500 },
    );
  }

  // 3. Mirror into the matching {cartridge}_publication_states table so
  //    the Living Canon reaction infrastructure (KnytReactionBar today,
  //    qripto mirror when the cartridge-parameterized refactor lands)
  //    accepts this row as a valid publication. Same UUID for both rows.
  //    The 'metame-runtime' lane (metaMe Pulse) has no Living Canon surface,
  //    so it gets no publication-state mirror.
  if (cartridge !== 'metame-runtime') {
    const publicationTable = cartridge === 'qripto'
      ? 'qripto_publication_states'
      : 'knyt_publication_states';
    await supabase.from(publicationTable).upsert(
      {
        id: contentId,
        subject_type: 'community_content',
        subject_id:   contentId,
        branch:       'community',
        state:        'submitted',
        created_at:   new Date().toISOString(),
        updated_at:   new Date().toISOString(),
      },
      { onConflict: 'id' },
    );
  }

  // 4. Stamp the originating myCanvas entry with the new contentId so
  //    the existing republish path (PUBLISH button on entries with
  //    metaJson.contentId) treats this as the canonical reference.
  //    Best-effort — if the stamp fails the publish still succeeded.
  try {
    await updateEntry(persona.personaId, entryId, {
      metaJson: {
        ...(entry.metaJson ?? {}),
        contentId,
        publishedAt: new Date().toISOString(),
        cartridge,
      },
    });
  } catch (err) {
    console.warn('[publish-to-pulse] metaJson stamp failed (non-fatal):', err);
  }

  return NextResponse.json({
    ok: true,
    contentId,
    cartridge,
    status: 'shared',
  });
}
