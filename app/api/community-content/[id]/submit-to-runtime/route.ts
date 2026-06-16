/**
 * POST /api/community-content/[id]/submit-to-runtime
 *
 * Cartridge Pulse admins (KNYT / Qriptopian) use this to forward a piece of
 * approved Pulse UGC into the metaMe Runtime pipeline. It does NOT move the
 * original row — the content stays in its cartridge Pulse. Instead it mints a
 * linked `cartridge='metame-runtime'` submission (status='shared') that lands
 * in the metaMe admin promotion queue, tagged with:
 *   • origin_cartridge — where it came from (knyt | qripto)
 *   • runtime_menu / runtime_submenu — the be/make/play/earn/share placement
 *
 * The metaMe admin then promotes it (or not) — cartridges filter their UGC into
 * their Pulse; cartridge admins apply for Pulse content to enter the runtime;
 * the metaMe admin owns final runtime placement.
 *
 * Idempotent: a second submit of the same source row returns the existing
 * metame-runtime child row instead of duplicating it.
 *
 * Body: { adminPersonaId?, runtimeMenu, runtimeSubmenu? }
 * Admin-gated via requireCommunityAdmin.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCommunityContentSupabase } from '../../_lib/personaContext';
import { requireCommunityAdmin } from '../../_lib/adminAuth';
import { getActivePersona } from '@/services/identity/getActivePersona';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_MENUS = new Set(['be', 'make', 'play', 'earn', 'share']);

interface Body {
  adminPersonaId?: string;
  runtimeMenu?: string;
  runtimeSubmenu?: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } },
): Promise<NextResponse> {
  const resolved = await Promise.resolve(params);
  const id = resolved.id;
  if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    // body optional except runtimeMenu — validated below
  }

  const runtimeMenu = body.runtimeMenu?.trim().toLowerCase() || null;
  if (!runtimeMenu || !VALID_MENUS.has(runtimeMenu)) {
    return NextResponse.json(
      { ok: false, error: 'runtimeMenu required (be|make|play|earn|share)' },
      { status: 400 },
    );
  }
  const runtimeSubmenu = body.runtimeSubmenu?.trim() || null;

  let adminPersonaId = body.adminPersonaId?.trim() || null;
  if (!adminPersonaId) {
    try {
      const active = await getActivePersona(req);
      adminPersonaId = active?.personaId ?? null;
    } catch {
      // fall through to gate
    }
  }

  const supabase = getCommunityContentSupabase();
  const auth = await requireCommunityAdmin(supabase, adminPersonaId);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  // Source row — must be a real (non-metame) cartridge Pulse row.
  const { data: source, error: fetchError } = await supabase
    .from('community_generated_content')
    .select('id, creator_persona_id, skill, title, prompt, article_body, image_url, cartridge')
    .eq('id', id)
    .maybeSingle();
  if (fetchError) return NextResponse.json({ ok: false, error: fetchError.message }, { status: 500 });
  if (!source) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });

  const src = source as {
    id: string;
    creator_persona_id: string;
    skill: string;
    title: string;
    prompt: string;
    article_body: string | null;
    image_url: string | null;
    cartridge: string | null;
  };
  const originCartridge = src.cartridge === 'qripto' ? 'qripto' : 'knyt';

  // Idempotency — reuse an existing metame-runtime child for this source.
  const { data: existing } = await supabase
    .from('community_generated_content')
    .select('id, status')
    .eq('cartridge', 'metame-runtime')
    .eq('parent_id', id)
    .maybeSingle();
  if (existing) {
    const ex = existing as { id: string; status: string };
    // Refresh the requested placement on the existing child.
    await supabase
      .from('community_generated_content')
      .update({
        runtime_menu: runtimeMenu,
        runtime_submenu: runtimeSubmenu,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ex.id);
    return NextResponse.json({ ok: true, alreadySubmitted: true, runtimeContentId: ex.id, status: ex.status });
  }

  const { data: inserted, error: insertError } = await supabase
    .from('community_generated_content')
    .insert({
      creator_persona_id: src.creator_persona_id,
      source_experience_id: null,
      parent_id: src.id,
      skill: src.skill,
      title: src.title,
      prompt: src.prompt,
      article_body: src.article_body,
      image_url: src.image_url,
      status: 'shared',
      qc_cost: 0,
      generation_index: 0,
      cartridge: 'metame-runtime',
      origin_cartridge: originCartridge,
      runtime_menu: runtimeMenu,
      runtime_submenu: runtimeSubmenu,
    })
    .select('id')
    .single();

  if (insertError || !inserted) {
    return NextResponse.json(
      { ok: false, error: insertError?.message ?? 'submit failed' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    runtimeContentId: (inserted as { id: string }).id,
    originCartridge,
    runtimeMenu,
    status: 'shared',
  });
}
