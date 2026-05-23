/**
 * GET /api/community-content/list
 *
 * Query params:
 *   personaId?  — when set with mine=1, filter to creator's content
 *   mine        — '1' to scope to the requesting persona's content
 *   status?     — comma-separated list, defaults to 'shared,runtime_promoted'
 *   limit?      — default 30, max 100
 *
 * Returns: { ok, items: [...], count }
 *
 * Items include creator first-name + handle for display, but never expose
 * full persona records.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCommunityContentSupabase } from '../_lib/personaContext';

export const dynamic = 'force-dynamic';

const ALLOWED_STATUSES = new Set(['draft', 'shared', 'pending_promotion', 'runtime_promoted', 'rejected']);

interface ContentRow {
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
}

interface PersonaRow {
  id: string;
  'First-Name'?: string | null;
  'Twitter-Handle'?: string | null;
  'Telegram-Handle'?: string | null;
  'Discord-Handle'?: string | null;
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const personaId = params.get('personaId')?.trim() || null;
  const mine = params.get('mine') === '1';
  const statusParam = (params.get('status') || 'shared,runtime_promoted')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => ALLOWED_STATUSES.has(s));
  const limit = Math.min(100, Math.max(1, Number.parseInt(params.get('limit') || '30', 10) || 30));

  if (mine && !personaId) {
    return NextResponse.json({ ok: false, error: 'personaId required when mine=1' }, { status: 400 });
  }

  try {
    const supabase = getCommunityContentSupabase();

    let query = supabase
      .from('community_generated_content')
      // IMPORTANT: don't select article_body or image_url here. Articles
      // run 600–900 words and image_url is a base64 data URL (~100KB–1MB)
      // — cumulative response exceeds AWS Lambda's 6 MB ceiling and the
      // route returns 413 with an empty body, which the client surfaces
      // as 'JSON.parse: unexpected end of data'. Card thumbnails are
      // looked up separately (see imagePreview hydration on the client)
      // and the full article body is fetched on-demand when the user
      // opens an item.
      .select('id, creator_persona_id, source_experience_id, parent_id, skill, title, prompt, status, qc_cost, generation_index, runtime_promoted_at, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (mine && personaId) {
      query = query.eq('creator_persona_id', personaId);
    } else if (statusParam.length > 0) {
      query = query.in('status', statusParam);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    const rows = (data ?? []) as ContentRow[];

    // Hydrate creator display info in a single batched query.
    const creatorIds = Array.from(new Set(rows.map((r) => r.creator_persona_id)));
    let creatorMap: Record<string, { firstName: string | null; handle: string | null }> = {};
    if (creatorIds.length > 0) {
      const { data: personas } = await supabase
        .from('nakamoto_knyt_personas')
        .select('id, "First-Name", "Twitter-Handle", "Telegram-Handle", "Discord-Handle"')
        .in('id', creatorIds);
      const personaList = (personas ?? []) as PersonaRow[];
      creatorMap = Object.fromEntries(
        personaList.map((p) => [
          p.id,
          {
            firstName: (p['First-Name'] ?? null) || null,
            handle:
              (p['Twitter-Handle'] || p['Telegram-Handle'] || p['Discord-Handle'] || null) || null,
          },
        ]),
      );
    }

    const items = rows.map((r) => ({
      id:                  r.id,
      title:               r.title,
      prompt:              r.prompt,
      skill:               r.skill,
      // articleBody + imageUrl intentionally omitted — fetch full item
      // via /api/community-content/<id> when the user opens it.
      articleBody:         null as string | null,
      imageUrl:            null as string | null,
      status:              r.status,
      qcCost:              r.qc_cost,
      generationIndex:     r.generation_index,
      sourceExperienceId:  r.source_experience_id,
      parentId:            r.parent_id,
      creator: {
        personaId: r.creator_persona_id,
        firstName: creatorMap[r.creator_persona_id]?.firstName ?? null,
        handle:    creatorMap[r.creator_persona_id]?.handle    ?? null,
        isMe:      personaId ? r.creator_persona_id === personaId : false,
      },
      promotedToRuntime:   r.status === 'runtime_promoted',
      createdAt:           r.created_at,
      updatedAt:           r.updated_at,
    }));

    return NextResponse.json({ ok: true, items, count: items.length });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
