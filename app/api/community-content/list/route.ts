/**
 * GET /api/community-content/list
 *
 * Query params:
 *   personaId?  — when set with mine=1, filter to creator's content
 *   mine        — '1' to scope to the requesting persona's content
 *   status?     — comma-separated list, defaults to 'shared,runtime_promoted'
 *   cartridge?  — 'knyt' | 'qripto' — filter by cartridge column. When
 *                 omitted, returns rows from every cartridge (back-compat
 *                 for legacy callers that pre-date the cartridge split).
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
const ALLOWED_CARTRIDGES = new Set(['knyt', 'qripto', 'metame-runtime']);

interface ContentRow {
  id: string;
  creator_persona_id: string;
  source_experience_id: string | null;
  parent_id: string | null;
  skill: 'article' | 'story' | 'note';
  title: string;
  prompt: string;
  article_body: string | null;
  image_url: string | null;
  status: string;
  qc_cost: number;
  generation_index: number;
  runtime_promoted_at: string | null;
  cartridge: string | null;
  runtime_menu: string | null;
  runtime_submenu: string | null;
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
  const cartridgeParam = params.get('cartridge')?.trim().toLowerCase() || null;
  const cartridge = cartridgeParam && ALLOWED_CARTRIDGES.has(cartridgeParam) ? cartridgeParam : null;
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
      .select('id, creator_persona_id, source_experience_id, parent_id, skill, title, prompt, status, qc_cost, generation_index, runtime_promoted_at, cartridge, runtime_menu, runtime_submenu, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (mine && personaId) {
      query = query.eq('creator_persona_id', personaId);
    } else if (statusParam.length > 0) {
      query = query.in('status', statusParam);
    }

    // Cartridge filter — when present, scopes to KNYT or Qriptopian only.
    // When omitted, returns rows from every cartridge (back-compat with
    // pre-split callers; existing rows default cartridge='knyt' via the
    // migration so legacy behaviour stays correct).
    if (cartridge) {
      query = query.eq('cartridge', cartridge);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    const rows = (data ?? []) as ContentRow[];

    // Hydrate creator display info in a single batched query.
    //
    // Two parallel reads, merged into one map:
    //   1. nakamoto_knyt_personas — legacy KNYT social handles
    //      (First-Name, Twitter-Handle, Telegram-Handle, Discord-Handle)
    //   2. personas — canonical persona row with the FIO handle (e.g.
    //      `inquisitor@knyt`, `aigentz@aigent`) which is the operator's
    //      actual sovereign-identity byline.
    //
    // 2026-06-01 operator decision: byline on published articles /
    // stories should surface the persona's FIO handle as the
    // canonical "By <…>" identifier — not "Creator" and not a
    // first-name. FIO handle is the persona's chosen identity in the
    // metaMe / KNYT mythos, so it's what readers should see.
    //
    // Resolution priority (applied at FE render time):
    //   fioHandle → handle (social) → firstName → "Creator"
    const creatorIds = Array.from(new Set(rows.map((r) => r.creator_persona_id)));
    let creatorMap: Record<string, { firstName: string | null; handle: string | null; fioHandle: string | null }> = {};
    if (creatorIds.length > 0) {
      const [knytRes, personaRes] = await Promise.all([
        supabase
          .from('nakamoto_knyt_personas')
          .select('id, "First-Name", "Twitter-Handle", "Telegram-Handle", "Discord-Handle"')
          .in('id', creatorIds),
        supabase
          .from('personas')
          .select('id, fio_handle')
          .in('id', creatorIds),
      ]);
      const knytList = (knytRes.data ?? []) as PersonaRow[];
      const personaList = (personaRes.data ?? []) as Array<{ id: string; fio_handle: string | null }>;
      const fioByPersonaId = Object.fromEntries(
        personaList.map((p) => [p.id, p.fio_handle ?? null]),
      );
      creatorMap = Object.fromEntries(
        knytList.map((p) => [
          p.id,
          {
            firstName: (p['First-Name'] ?? null) || null,
            handle:
              (p['Twitter-Handle'] || p['Telegram-Handle'] || p['Discord-Handle'] || null) || null,
            fioHandle: fioByPersonaId[p.id] ?? null,
          },
        ]),
      );
      // Some personas only exist on the personas table (no KNYT social
      // handles row). Still expose their FIO handle for the byline.
      for (const p of personaList) {
        if (!creatorMap[p.id]) {
          creatorMap[p.id] = { firstName: null, handle: null, fioHandle: p.fio_handle ?? null };
        }
      }
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
        fioHandle: creatorMap[r.creator_persona_id]?.fioHandle ?? null,
        isMe:      personaId ? r.creator_persona_id === personaId : false,
      },
      promotedToRuntime:   r.status === 'runtime_promoted',
      cartridge:           (r.cartridge as 'knyt' | 'qripto' | 'metame-runtime' | null) ?? 'knyt',
      runtimeMenu:         r.runtime_menu ?? null,
      runtimeSubmenu:      r.runtime_submenu ?? null,
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
