/**
 * GET /api/community-content/[id]
 *
 * Single-row read for the public viewer page. Only returns content that
 * has been made public (status in 'shared' | 'runtime_promoted'); drafts
 * and rejected rows 404 to avoid leaking unpublished work.
 */
import { NextResponse } from 'next/server';
import { getCommunityContentSupabase } from '../_lib/personaContext';

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
