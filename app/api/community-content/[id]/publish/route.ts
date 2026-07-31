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
import { getCallerIdentityContext } from '@/services/wallet/personaRepo';
import { getMergedLinkedAuthProfileIds } from '@/services/wallet/multiEmailIdentity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Returns true when the caller's auth profile (and its merged links)
 * owns the persona that created the row. Lets a user publish their own
 * content even when their active persona at publish time differs from
 * the persona at creation time — common when persona-switching mid-
 * session or when an earlier remix was created under a default persona
 * (devagent) before the resolution fix landed. Strict-equality check
 * was rejecting legitimate authors.
 */
async function callerOwnsCreator(
  req: NextRequest,
  creatorPersonaId: string,
): Promise<boolean> {
  try {
    const caller = await getCallerIdentityContext(req);
    if (!caller) return false;
    const supabase = getCommunityContentSupabase();
    const linked = await getMergedLinkedAuthProfileIds(caller.authProfileId).catch(() => []);
    const visible = Array.from(new Set([caller.authProfileId, ...linked]));
    const { data } = await supabase
      .from('personas')
      .select('id')
      .in('auth_profile_id', visible)
      .eq('id', creatorPersonaId)
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}

export async function POST(
  req: NextRequest,
  props: { params: Promise<Promise<{ id: string }> | { id: string }> }
) {
  const params = await props.params;
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
    .select('id, creator_persona_id, status, cartridge')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ ok: false, error: fetchError.message }, { status: 500 });
  if (!content) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });

  const row = content as { id: string; creator_persona_id: string; status: string; cartridge?: string };
  // Cartridge defaults to 'knyt' for back-compat with rows created before
  // the Pulse cartridge split migration. The column was added with
  // DEFAULT 'knyt' so all existing rows are already KNYT-flavoured.
  const cartridge: 'knyt' | 'qripto' | 'metame-runtime' =
    row.cartridge === 'qripto' ? 'qripto'
    : row.cartridge === 'metame-runtime' ? 'metame-runtime'
    : 'knyt';
  // Auth-profile-level ownership — accept any persona the caller's
  // auth profile owns (covers multi-persona users + content created
  // under stale defaults). Strict personaId equality used to reject
  // legitimate authors.
  if (row.creator_persona_id !== personaId) {
    const ok = await callerOwnsCreator(req, row.creator_persona_id);
    if (!ok) {
      return NextResponse.json({ ok: false, error: 'Not your content' }, { status: 403 });
    }
  }

  // Already shared / promoted — idempotent
  if (row.status !== 'draft') {
    return NextResponse.json({ ok: true, status: row.status, alreadyPublished: true, cartridge });
  }

  const { error: updateError } = await supabase
    .from('community_generated_content')
    .update({ status: 'shared', updated_at: new Date().toISOString() })
    .eq('id', id);

  if (updateError) return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });

  // Insert a matching {cartridge}_publication_states row so the Living
  // Canon reaction infrastructure (KnytReactionBar today, qripto mirror
  // when the cartridge-parameterized refactor lands) accepts this row
  // as a valid publication. Cartridge column on community_generated_content
  // determines which table receives the publication-state record:
  //   - cartridge='knyt'   → knyt_publication_states
  //   - cartridge='qripto' → qripto_publication_states
  // Same UUID is used for both rows so the front-end can pass the
  // community_content.id straight through as publicationId. Best-effort —
  // non-fatal if the table or schema rejects.
  //
  // The 'metame-runtime' lane (metaMe Pulse) has no Living Canon surface —
  // it feeds the runtime menus, not a publication/reaction spine — so it
  // gets no publication-state mirror.
  if (cartridge !== 'metame-runtime') {
    const publicationTable = cartridge === 'qripto'
      ? 'qripto_publication_states'
      : 'knyt_publication_states';
    await supabase.from(publicationTable).upsert(
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
  }

  return NextResponse.json({ ok: true, status: 'shared', cartridge });
}
