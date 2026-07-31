/**
 * metaMe Runtime content controller (admin).
 *
 * GET  /api/runtime/admin/content?personaId=…
 *   Returns every piece of content that surfaces (or is awaiting promotion to
 *   surface) in the metaMe Runtime, drawn from BOTH runtime sources and
 *   normalized into one list:
 *     • experience  — Studio→runtime launches (composer_experience_qubes
 *                     meta_qube.runtime_publication). pending_review awaits
 *                     promotion; published is live.
 *     • community   — promoted UGC / cartridge-submitted Pulse rows
 *                     (community_generated_content). shared awaits promotion
 *                     (metame-runtime lane only); runtime_promoted is live
 *                     (any cartridge — KNYT/Qripto promoted content also
 *                     surfaces in the runtime via promotedCapsules).
 *   Split into { pending, live }.
 *
 * POST /api/runtime/admin/content
 *   Body: { source, id, action, adminPersonaId, runtimeMenu?, runtimeSubmenu? }
 *   action ∈ publish | unpublish | archive | delete
 *   Lifecycle management for what surfaces in the runtime. Editorial cartridge
 *   content flows in as published already — this is management, not a new
 *   approval flow (a cartridge→runtime approval gate is a future follow-up).
 *
 * Admin-gated via requireCommunityAdmin.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCommunityContentSupabase } from '../../../community-content/_lib/personaContext';
import { requireCommunityAdmin } from '../../../community-content/_lib/adminAuth';
import { getActivePersona } from '@/services/identity/getActivePersona';
import {
  listRuntimeProjectionAdminRecords,
  setRuntimeProjectionStatus,
} from '@/services/composer/runtimeProjectionService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_MENUS = new Set(['be', 'make', 'play', 'earn', 'share']);

interface RuntimeAdminItem {
  source: 'community' | 'experience';
  id: string;
  title: string;
  thumbUrl: string | null;
  cartridge: string;
  originCartridge: string | null;
  status: string;
  lane: 'pending' | 'live';
  runtimeMenu: string | null;
  runtimeSubmenu: string | null;
  skill: string | null;
  prompt: string | null;
  createdAt: string | null;
}

interface CommunityRow {
  id: string;
  skill: string | null;
  title: string;
  prompt: string | null;
  image_url: string | null;
  status: string;
  cartridge: string | null;
  origin_cartridge: string | null;
  runtime_menu: string | null;
  runtime_submenu: string | null;
  created_at: string;
}

const COMMUNITY_COLS =
  'id, skill, title, prompt, image_url, status, cartridge, origin_cartridge, runtime_menu, runtime_submenu, created_at';

export async function GET(req: NextRequest) {
  const personaId = req.nextUrl.searchParams.get('personaId')?.trim() || null;
  let adminPersonaId = personaId;
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

  try {
    // Community rows: metame-runtime shared (pending) + any-cartridge promoted (live).
    const [pendingCommunityRes, liveCommunityRes, projections] = await Promise.all([
      supabase
        .from('community_generated_content')
        .select(COMMUNITY_COLS)
        .eq('cartridge', 'metame-runtime')
        .eq('status', 'shared')
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('community_generated_content')
        .select(COMMUNITY_COLS)
        .eq('status', 'runtime_promoted')
        .order('created_at', { ascending: false })
        .limit(100),
      listRuntimeProjectionAdminRecords({ statuses: ['pending_review', 'published'], limit: 200 }),
    ]);

    if (pendingCommunityRes.error)
      return NextResponse.json({ ok: false, error: pendingCommunityRes.error.message }, { status: 500 });
    if (liveCommunityRes.error)
      return NextResponse.json({ ok: false, error: liveCommunityRes.error.message }, { status: 500 });

    const mapCommunity = (r: CommunityRow, lane: 'pending' | 'live'): RuntimeAdminItem => ({
      source: 'community',
      id: r.id,
      title: r.title,
      thumbUrl: r.image_url,
      cartridge: r.cartridge ?? 'metame-runtime',
      originCartridge: r.origin_cartridge,
      status: r.status,
      lane,
      runtimeMenu: r.runtime_menu,
      runtimeSubmenu: r.runtime_submenu,
      skill: r.skill,
      prompt: r.prompt,
      createdAt: r.created_at,
    });

    const pending: RuntimeAdminItem[] = [];
    const live: RuntimeAdminItem[] = [];

    for (const r of (pendingCommunityRes.data ?? []) as CommunityRow[]) pending.push(mapCommunity(r, 'pending'));
    for (const r of (liveCommunityRes.data ?? []) as CommunityRow[]) live.push(mapCommunity(r, 'live'));

    for (const p of projections) {
      const lane: 'pending' | 'live' = p.status === 'published' ? 'live' : 'pending';
      const item: RuntimeAdminItem = {
        source: 'experience',
        id: p.experienceId,
        title: p.title,
        thumbUrl: p.thumbUrl,
        cartridge: p.cartridge,
        originCartridge: null,
        status: p.status,
        lane,
        runtimeMenu: p.menuIntent || null,
        runtimeSubmenu: null,
        skill: null,
        prompt: null,
        createdAt: p.publishedAt,
      };
      (lane === 'live' ? live : pending).push(item);
    }

    return NextResponse.json({ ok: true, pending, live, count: pending.length + live.length });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

interface ActionBody {
  source?: 'community' | 'experience';
  id?: string;
  action?: 'publish' | 'unpublish' | 'archive' | 'delete';
  adminPersonaId?: string;
  runtimeMenu?: string;
  runtimeSubmenu?: string;
}

export async function POST(req: NextRequest) {
  let body: ActionBody;
  try {
    body = (await req.json()) as ActionBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const source = body.source;
  const id = body.id?.trim();
  const action = body.action;
  if (source !== 'community' && source !== 'experience')
    return NextResponse.json({ ok: false, error: 'source must be community|experience' }, { status: 400 });
  if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });
  if (!action || !['publish', 'unpublish', 'archive', 'delete'].includes(action))
    return NextResponse.json({ ok: false, error: 'action must be publish|unpublish|archive|delete' }, { status: 400 });

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

  // ── Experience projection lifecycle ──────────────────────────────────────
  if (source === 'experience') {
    // Hard delete of an experience is destructive (it belongs to its creator),
    // so "delete" here is a soft archive — it drops the item from the runtime
    // without destroying the ExperienceQube.
    const statusMap: Record<string, 'published' | 'pending_review' | 'unpublished' | 'archived'> = {
      publish: 'published',
      unpublish: 'unpublished',
      archive: 'archived',
      delete: 'archived',
    };
    const ok = await setRuntimeProjectionStatus(id, statusMap[action]);
    if (!ok) return NextResponse.json({ ok: false, error: 'projection not found' }, { status: 404 });
    return NextResponse.json({ ok: true, source, id, status: statusMap[action] });
  }

  // ── Community content lifecycle ──────────────────────────────────────────
  const { data: content, error: fetchError } = await supabase
    .from('community_generated_content')
    .select('id, status, cartridge')
    .eq('id', id)
    .maybeSingle();
  if (fetchError) return NextResponse.json({ ok: false, error: fetchError.message }, { status: 500 });
  if (!content) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
  const row = content as { id: string; status: string; cartridge?: string | null };

  if (action === 'delete') {
    // Mirror cleanup for cartridges that have a Living Canon publication-state
    // table (metame-runtime has none).
    if (row.cartridge === 'knyt' || row.cartridge === 'qripto') {
      const publicationTable = row.cartridge === 'qripto' ? 'qripto_publication_states' : 'knyt_publication_states';
      await supabase.from(publicationTable).delete().eq('id', id);
    }
    const { error: delError } = await supabase.from('community_generated_content').delete().eq('id', id);
    if (delError) return NextResponse.json({ ok: false, error: delError.message }, { status: 500 });
    return NextResponse.json({ ok: true, source, id, deleted: true });
  }

  if (action === 'publish') {
    const menu = body.runtimeMenu?.trim().toLowerCase() || null;
    if (!menu || !VALID_MENUS.has(menu))
      return NextResponse.json({ ok: false, error: 'runtimeMenu required (be|make|play|earn|share)' }, { status: 400 });
    const { error: upErr } = await supabase
      .from('community_generated_content')
      .update({
        status: 'runtime_promoted',
        runtime_promoted_at: new Date().toISOString(),
        runtime_promoted_by: adminPersonaId,
        runtime_menu: menu,
        runtime_submenu: body.runtimeSubmenu?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
    return NextResponse.json({ ok: true, source, id, status: 'runtime_promoted' });
  }

  // unpublish | archive
  const nextStatus = action === 'unpublish' ? 'unpublished' : 'archived';
  const { error: upErr } = await supabase
    .from('community_generated_content')
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
  return NextResponse.json({ ok: true, source, id, status: nextStatus });
}
