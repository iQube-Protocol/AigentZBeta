/**
 * GET/PUT /api/journey/knyts-bridge/editorial-config?section=home
 *
 * GET is deliberately NOT gated on auth — HOME is browsable signed-out (same
 * posture as /api/journey/knyts-bridge/state), so the front door's own copy
 * must load before a visitor has any session at all.
 *
 * PUT is admin-only via requireAdminPersona — never a hand-rolled admin
 * check, per CLAUDE.md's Security — Access Gates rule. This route edits
 * ONLY Bridge-owned editorial copy/media (see knytsBridgeEditorialConfig.ts's
 * own header) — nothing here can touch Pulse, Passport, myCanvas, Standing
 * or Store data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPersona } from '@/app/api/_lib/requireAdmin';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getCommunityContentSupabase } from '@/app/api/community-content/_lib/personaContext';
import {
  getKnytsBridgeEditorialSection,
  upsertKnytsBridgeEditorialSection,
} from '@/services/journey/knytsBridgeEditorialConfig';
import { CI_BRIDGE_VIEW_CONTENT } from '@/services/journey/constitutionalInternetBridgeViewContent';

export const dynamic = 'force-dynamic';

/**
 * This table/route now serves more than one Threshold Guide bridge (KNYTS's
 * `home`/`orient`, and — added 2026-08-11 — the Constitutional Internet
 * Bridge's `ci-home`/`ci-orient`/`ci-view-<blockId>` video-slot overrides).
 * Reusing the existing table via distinct primary-key strings needed zero
 * schema change. The `ci-view-*` keys are derived from
 * CI_BRIDGE_VIEW_CONTENT (the single source of truth for Ethos vignette
 * ids) rather than hand-duplicated, so a future vignette addition/removal
 * never drifts out of sync with what this route accepts.
 *
 * TODO(generalize): once a second bridge beyond CI proves this reuse is the
 * durable shape, rename this table/service/route to a bridge-neutral
 * "Threshold Guide editorial config" substrate — deliberately NOT done in
 * this pass (operator instruction, 2026-08-11: reuse for speed now, don't
 * let naming cleanup expand this build).
 */
const ALLOWED_SECTIONS = new Set([
  'home',
  'orient',
  'ci-home',
  'ci-orient',
  ...CI_BRIDGE_VIEW_CONTENT.map((block) => `ci-view-${block.id}`),
]);

export async function GET(req: NextRequest) {
  try {
    const section = req.nextUrl.searchParams.get('section')?.trim() || 'home';
    if (!ALLOWED_SECTIONS.has(section)) {
      return NextResponse.json({ ok: false, error: `Unknown section: ${section}` }, { status: 400 });
    }
    const supabase = getCommunityContentSupabase();
    const config = await getKnytsBridgeEditorialSection(supabase, section);
    return NextResponse.json({ ok: true, config });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: `This request threw before it could answer: ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}.`,
      },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  const isAdmin = await requireAdminPersona(req);
  if (!isAdmin) {
    return NextResponse.json({ ok: false, error: 'admin required' }, { status: 403 });
  }
  try {
    const body = await req.json();
    const section = typeof body?.section === 'string' ? body.section.trim() : 'home';
    if (!ALLOWED_SECTIONS.has(section)) {
      return NextResponse.json({ ok: false, error: `Unknown section: ${section}` }, { status: 400 });
    }
    const persona = await getActivePersona(req).catch(() => null);
    const supabase = getCommunityContentSupabase();
    const config = await upsertKnytsBridgeEditorialSection(
      supabase,
      section,
      {
        headline: typeof body.headline === 'string' ? body.headline : undefined,
        shortCopy: typeof body.shortCopy === 'string' ? body.shortCopy : undefined,
        videoUrl: typeof body.videoUrl === 'string' ? body.videoUrl : undefined,
        posterUrl: typeof body.posterUrl === 'string' ? body.posterUrl : undefined,
        campaignCta: typeof body.campaignCta === 'string' ? body.campaignCta : undefined,
        rewardCopy: typeof body.rewardCopy === 'string' ? body.rewardCopy : undefined,
      },
      persona?.personaId ?? 'admin',
    );
    return NextResponse.json({ ok: true, config });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: `This request threw before it could answer: ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}.`,
      },
      { status: 500 },
    );
  }
}
