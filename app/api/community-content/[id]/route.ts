/**
 * GET    /api/community-content/[id]  — public viewer single-row read.
 * DELETE /api/community-content/[id]  — admin-gated hard delete.
 *
 * GET only returns content that has been made public
 * (status in 'shared' | 'runtime_promoted'); drafts and rejected rows
 * 404 to avoid leaking unpublished work.
 *
 * DELETE removes the row entirely. Gated by requireCommunityAdmin so
 * only the cartridge's community admins can use it. Accepts
 * `{ adminPersonaId }` in body (resolved to active persona via the
 * spine when absent). Also removes the matching publication-state row
 * in {cartridge}_publication_states so the Living Canon surfaces drop
 * the entry cleanly.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCommunityContentSupabase } from '../_lib/personaContext';
import { requireCommunityAdmin } from '../_lib/adminAuth';
import { getActivePersona } from '@/services/identity/getActivePersona';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PUBLIC_STATUSES = ['shared', 'runtime_promoted'] as const;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } },
) {
  const resolved = await Promise.resolve(params);
  const id = resolved.id;
  if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });

  try {
    const supabase = getCommunityContentSupabase();

    const { data: row, error } = await supabase
      .from('community_generated_content')
      .select(
        'id, creator_persona_id, source_experience_id, parent_id, skill, title, prompt, article_body, image_url, status, qc_cost, generation_index, runtime_promoted_at, created_at, updated_at',
      )
      .eq('id', id)
      .in('status', PUBLIC_STATUSES as unknown as string[])
      .maybeSingle();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (!row) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });

    const r = row as {
      id: string;
      creator_persona_id: string;
      source_experience_id: string | null;
      parent_id: string | null;
      skill: 'article' | 'story';
      title: string;
      prompt: string;
      article_body: string | null;
      image_url: string | null;
      status: string;
      qc_cost: number;
      generation_index: number;
      runtime_promoted_at: string | null;
      created_at: string;
      updated_at: string;
    };

    let creator: { firstName: string | null; handle: string | null } = {
      firstName: null,
      handle: null,
    };
    const { data: persona } = await supabase
      .from('nakamoto_knyt_personas')
      .select('"First-Name", "Twitter-Handle", "Telegram-Handle", "Discord-Handle"')
      .eq('id', r.creator_persona_id)
      .maybeSingle();
    if (persona) {
      const p = persona as {
        'First-Name'?: string | null;
        'Twitter-Handle'?: string | null;
        'Telegram-Handle'?: string | null;
        'Discord-Handle'?: string | null;
      };
      creator = {
        firstName: p['First-Name'] || null,
        handle: p['Twitter-Handle'] || p['Telegram-Handle'] || p['Discord-Handle'] || null,
      };
    }

    return NextResponse.json({
      ok: true,
      item: {
        id: r.id,
        title: r.title,
        prompt: r.prompt,
        skill: r.skill,
        articleBody: r.article_body,
        imageUrl: r.image_url,
        status: r.status,
        qcCost: r.qc_cost,
        generationIndex: r.generation_index,
        sourceExperienceId: r.source_experience_id,
        parentId: r.parent_id,
        creator: { personaId: r.creator_persona_id, ...creator },
        promotedToRuntime: r.status === 'runtime_promoted',
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/community-content/[id]
 *
 * Admin-only hard delete. Removes the row and the matching publication-
 * state record (chosen by row.cartridge). Body: { adminPersonaId? } —
 * resolves via the spine when absent.
 *
 * Wired from the moderation queue in KnytCommunityContentAdminTab and
 * QriptoPulseAdminTab. Reject (POST /reject) is the soft alternative —
 * delete is for spam / abuse where the row should disappear, not just
 * be hidden.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } },
): Promise<NextResponse> {
  const resolved = await Promise.resolve(params);
  const id = resolved.id;
  if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });

  let body: { adminPersonaId?: string } = {};
  try {
    body = await req.json();
  } catch {
    // Body is optional — the spine resolution below covers the case.
  }
  let adminPersonaId = body.adminPersonaId?.trim() || null;
  if (!adminPersonaId) {
    try {
      const active = await getActivePersona(req);
      adminPersonaId = active?.personaId ?? null;
    } catch {
      // fall through to 401
    }
  }

  const supabase = getCommunityContentSupabase();

  const auth = await requireCommunityAdmin(supabase, adminPersonaId);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  // Fetch the row first to know its cartridge so we hit the right
  // publication-states table.
  const { data: content, error: fetchError } = await supabase
    .from('community_generated_content')
    .select('id, cartridge')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ ok: false, error: fetchError.message }, { status: 500 });
  if (!content) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });

  const row = content as { id: string; cartridge?: string };
  const cartridge: 'knyt' | 'qripto' = row.cartridge === 'qripto' ? 'qripto' : 'knyt';

  // Remove the publication-state mirror first (CASCADE on the log row
  // chases its own foreign key). Best-effort — the content_generated_
  // content delete proceeds even if the publication-state delete
  // misses (e.g. the row was never published).
  const publicationTable = cartridge === 'qripto'
    ? 'qripto_publication_states'
    : 'knyt_publication_states';
  await supabase.from(publicationTable).delete().eq('id', id);

  const { error: deleteError } = await supabase
    .from('community_generated_content')
    .delete()
    .eq('id', id);

  if (deleteError) {
    return NextResponse.json({ ok: false, error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, deleted: id, cartridge });
}
