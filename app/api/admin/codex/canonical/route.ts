/**
 * GET /api/admin/codex/canonical
 *
 * Admin-only canonical reference for the metaKnyt content corpus.
 *
 * The "is/are/where" record any agent or operator can use to know exactly:
 *  - which DB row is which display item (Episode #N, Character #N, GN)
 *  - what asset_kind / content_type / episode_number / status / auto_drive_cid each row carries
 *  - which convention applies to which table (0-indexed episodes, 1-indexed characters)
 *  - whether the upload state is complete per category
 *  - any rows that violate the canonical convention (mismatch detector)
 *
 * Response is JSON. Surfaces both human-oriented `summary` and machine-oriented
 * `canonical` blocks. T0 fields (DIDs, internal IDs) are never returned.
 *
 * Future: this endpoint will read from the ContentQube registry VIEW once
 * Phase 3 lands. For now, it reads `master_content_qubes` + `codex_media_assets`
 * directly so the Codex Admin tab is useful immediately for the KNYT mapping
 * problem the operator just spent 3 days on.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getActivePersona } from '@/services/identity/getActivePersona';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

interface MasterRow {
  id: string;
  content_type: string;
  episode_number: number | null;
  status: string;
  auto_drive_cid: string | null;
  title: string | null;
}

interface MediaRow {
  id: string;
  asset_kind: string;
  episode_number: number | null;
  status: string;
  auto_drive_cid: string | null;
  title: string | null;
}

const CANONICAL_DISPLAY_RANGE = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

const CONVENTIONS = {
  episodes: {
    table: 'master_content_qubes',
    indexing: '0-based',
    range: '0..12 (the 13 episodes); -1 for GN (separate content_type=gn_still)',
    displayFormula: 'display # = episode_number',
    contentTypes: ['gn_still', 'episode_still', 'episode_motion', 'episode_print'],
  },
  characters: {
    table: 'codex_media_assets',
    indexing: '1-based',
    range: '1..13 (the 13 characters)',
    displayFormula: 'display # = episode_number - 1',
    assetKinds: ['character_poster', 'powers_sheet'],
  },
  idNaming: {
    note: 'master_content_qubes.episode_number is canonical: 0..12 are the 13 displayed episodes (display # === episode_number); -1 reserved for GN (content_type=gn_still); -2..-4 are legacy preorder rarity drops. Row IDs (e.g. mk_epNN) are opaque — never used for math; always read episode_number + content_type from the row.',
  },
} as const;

async function assertAdmin(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona) return { ok: false as const, status: 401, error: 'Unauthorized' };
  if (!persona.cartridgeFlags?.isAdmin) return { ok: false as const, status: 403, error: 'Admin required' };
  return { ok: true as const, persona };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await assertAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const db = sb();
  const series = new URL(request.url).searchParams.get('series') || 'metaKnyts';

  const [mastersRes, mediaRes] = await Promise.all([
    db
      .from('master_content_qubes')
      .select('id, content_type, episode_number, status, auto_drive_cid, title')
      .eq('series', series)
      .order('content_type', { ascending: true })
      .order('episode_number', { ascending: true }),
    db
      .from('codex_media_assets')
      .select('id, asset_kind, episode_number, status, auto_drive_cid, title')
      .eq('series', series)
      .order('asset_kind', { ascending: true })
      .order('episode_number', { ascending: true }),
  ]);

  if (mastersRes.error || mediaRes.error) {
    return NextResponse.json(
      { error: 'Failed to load canonical record', detail: mastersRes.error?.message || mediaRes.error?.message },
      { status: 500 },
    );
  }

  const masters = (mastersRes.data ?? []) as MasterRow[];
  const media = (mediaRes.data ?? []) as MediaRow[];

  // ── GN (single row at content_type=gn_still, episode_number=-1) ────────
  const gn = masters.find((m) => m.content_type === 'gn_still' && m.episode_number === -1) ?? null;

  // ── Episodes: index by display # (= DB episode_number) per content_type
  const stillByEp = new Map<number, MasterRow>();
  const motionByEp = new Map<number, MasterRow>();
  const printByEp = new Map<number, MasterRow>();
  for (const m of masters) {
    if (m.episode_number == null || m.episode_number < 0) continue;
    if (m.content_type === 'episode_still') stillByEp.set(m.episode_number, m);
    else if (m.content_type === 'episode_motion') motionByEp.set(m.episode_number, m);
    else if (m.content_type === 'episode_print') printByEp.set(m.episode_number, m);
  }

  // ── Characters: index by display # (= DB episode_number - 1)
  const posterByDisplay = new Map<number, MediaRow>();
  const sheetByDisplay = new Map<number, MediaRow>();
  for (const a of media) {
    if (a.episode_number == null || a.episode_number < 1) continue;
    const display = a.episode_number - 1;
    if (a.asset_kind === 'character_poster') posterByDisplay.set(display, a);
    else if (a.asset_kind === 'powers_sheet') sheetByDisplay.set(display, a);
  }

  const episodes = CANONICAL_DISPLAY_RANGE.map((display) => ({
    displayNumber: display,
    dbEpisodeNumber: display,
    still: stillByEp.get(display) ?? null,
    motion: motionByEp.get(display) ?? null,
    print: printByEp.get(display) ?? null,
  }));

  const characters = CANONICAL_DISPLAY_RANGE.map((display) => ({
    displayNumber: display,
    dbEpisodeNumber: display + 1,
    poster: posterByDisplay.get(display) ?? null,
    sheet: sheetByDisplay.get(display) ?? null,
  }));

  // ── Mismatch detector: rows that don't fit the canonical convention
  const mismatches: Array<{ table: string; row: MasterRow | MediaRow; reason: string }> = [];
  for (const m of masters) {
    if (m.content_type === 'gn_still' && m.episode_number !== -1) {
      mismatches.push({ table: 'master_content_qubes', row: m, reason: `gn_still must have episode_number=-1 (found ${m.episode_number})` });
    }
    if (
      (m.content_type === 'episode_still' || m.content_type === 'episode_motion' || m.content_type === 'episode_print') &&
      (m.episode_number == null || m.episode_number < 0 || m.episode_number > 12)
    ) {
      mismatches.push({ table: 'master_content_qubes', row: m, reason: `${m.content_type} must have episode_number in 0..12 (found ${m.episode_number})` });
    }
  }
  for (const a of media) {
    if (a.asset_kind === 'character_poster' || a.asset_kind === 'powers_sheet') {
      if (a.episode_number == null || a.episode_number < 1 || a.episode_number > 13) {
        mismatches.push({ table: 'codex_media_assets', row: a, reason: `${a.asset_kind} must have episode_number in 1..13 (found ${a.episode_number})` });
      }
    }
  }

  // ── Counts / completeness summary
  const counts = {
    gn: gn ? 1 : 0,
    episode_still: stillByEp.size,
    episode_motion: motionByEp.size,
    episode_print: printByEp.size,
    character_poster: posterByDisplay.size,
    powers_sheet: sheetByDisplay.size,
    expectedPerCategory: 13,
  };

  return NextResponse.json({
    series,
    conventions: CONVENTIONS,
    canonical: {
      gn,
      episodes,
      characters,
    },
    counts,
    mismatches,
    fetchedAt: new Date().toISOString(),
  });
}
