/**
 * GET/POST /api/journey/knyts-bridge/placements
 *
 * QRP-BRIDGE-ADMIN A2 (2026-09-01) — typed asset placement with a real
 * draft/publish distinction for CI/KNYTS bridge media slots. Both methods
 * are admin-gated via requireAdminPersona (same canonical gate the sibling
 * editorial-config PUT route already uses — never a hand-rolled check).
 * GET is gated too, unlike editorial-config's GET: a draft asset is
 * pre-publication content and must not be visible to an unauthenticated
 * caller (spec A-08: "Draft previews are authorized and isolated from the
 * public read path").
 *
 * POST body: { section, slot, action: 'assign' | 'publish', assetId?, assetUrl? }
 * 'assign' requires assetUrl; 'publish' requires nothing beyond an existing
 * draft (assignPlacement must have been called first for this section/slot).
 *
 * This route is a thin HTTP boundary over bridgeContentPlacements.ts's pure
 * functions — the same functions A3's authorized-agent path will call
 * directly (in-process, after its own Threshold bearer authorization —
 * never through this HTTP boundary, matching the fix already applied to
 * the Threshold upload executor's own admin-hop pattern).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPersona } from '@/app/api/_lib/requireAdmin';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getCommunityContentSupabase } from '@/app/api/community-content/_lib/personaContext';
import { KNYTS_BRIDGE_ALLOWED_SECTIONS } from '@/services/journey/knytsBridgeEditorialConfig';
import {
  getPlacementsForSection,
  assignDraftAsset,
  publishPlacement,
  PlacementConflictError,
  type PlacementSlot,
} from '@/services/journey/bridgeContentPlacements';

export const dynamic = 'force-dynamic';

function isPlacementSlot(value: unknown): value is PlacementSlot {
  return value === 'video' || value === 'poster';
}

export async function GET(req: NextRequest) {
  try {
    const isAdmin = await requireAdminPersona(req);
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: 'admin required' }, { status: 403 });
    }
    const section = req.nextUrl.searchParams.get('section')?.trim() ?? '';
    if (!KNYTS_BRIDGE_ALLOWED_SECTIONS.has(section)) {
      return NextResponse.json({ ok: false, error: `Unknown section: ${section}` }, { status: 400 });
    }
    const supabase = getCommunityContentSupabase();
    const placements = await getPlacementsForSection(supabase, section);
    return NextResponse.json({ ok: true, placements });
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

export async function POST(req: NextRequest) {
  try {
    const isAdmin = await requireAdminPersona(req);
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: 'admin required' }, { status: 403 });
    }
    const body = await req.json();
    const section = typeof body?.section === 'string' ? body.section.trim() : '';
    const slot = body?.slot;
    const action = body?.action;

    if (!KNYTS_BRIDGE_ALLOWED_SECTIONS.has(section)) {
      return NextResponse.json({ ok: false, error: `Unknown section: ${section}` }, { status: 400 });
    }
    if (!isPlacementSlot(slot)) {
      return NextResponse.json({ ok: false, error: "slot must be 'video' or 'poster'" }, { status: 400 });
    }
    if (action !== 'assign' && action !== 'publish') {
      return NextResponse.json({ ok: false, error: "action must be 'assign' or 'publish'" }, { status: 400 });
    }

    const persona = await getActivePersona(req).catch(() => null);
    const actor = persona?.personaId ?? 'admin';
    const supabase = getCommunityContentSupabase();

    if (action === 'assign') {
      const assetUrl = typeof body?.assetUrl === 'string' ? body.assetUrl.trim() : '';
      if (!assetUrl) {
        return NextResponse.json({ ok: false, error: 'assetUrl is required for assign' }, { status: 400 });
      }
      const assetId = typeof body?.assetId === 'string' ? body.assetId : null;
      const placement = await assignDraftAsset(supabase, section, slot, { assetId, assetUrl }, actor);
      return NextResponse.json({ ok: true, placement });
    }

    // action === 'publish'
    try {
      const result = await publishPlacement(supabase, section, slot, actor);
      return NextResponse.json({ ok: true, placement: result.placement });
    } catch (err) {
      if (err instanceof Error && err.message === 'no-draft-to-publish') {
        return NextResponse.json({ ok: false, error: 'no-draft-to-publish' }, { status: 409 });
      }
      if (err instanceof PlacementConflictError) {
        return NextResponse.json({ ok: false, error: 'concurrent-edit-detected' }, { status: 409 });
      }
      throw err;
    }
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
