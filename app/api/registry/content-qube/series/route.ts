/**
 * GET /api/registry/content-qube/series
 *
 * Batch ContentQube resolver for a given series. Phase 8 of the ContentQube
 * integration — powers KNYT tab components (ScrollsTab, CharactersTab) so
 * they can display real persona_owns flags and live registry data instead of
 * static/mock content.
 *
 * Query params:
 *   series        (required) — e.g. 'metaKnyts'
 *   contentKind   (optional) — e.g. 'episode', 'character', 'gn'
 *   lifecycleState (optional) — e.g. 'canonized', 'semi_minted'
 *
 * Returns:
 *   { ok: true, data: { qubes: Array<{ manifest, editionSummary, codexSlugs }> } }
 *
 * Auth: optional. When the caller has a valid session cookie the persona_owns
 * flag is resolved server-side via evaluateAccess. Unauthenticated reads
 * return persona_owns = false for every qube.
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolveIframePersona } from '@/services/identity/resolveIframePersona';
import { resolveContentQubesBySeries } from '@/services/content/resolveContentQube';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  const series = searchParams.get('series');
  if (!series) {
    return NextResponse.json({ ok: false, error: 'series param required' }, { status: 400 });
  }

  const contentKind    = searchParams.get('contentKind')    ?? undefined;
  const lifecycleState = searchParams.get('lifecycleState') ?? undefined;

  // resolveIframePersona prefers the spine (cookie / Authorization header) and
  // falls back to ?personaId= URL param for codex iframe contexts where the
  // browser doesn't auto-attach the Supabase Bearer token. Admin/partner
  // flags are forced false in the fallback path; this is read-only persona-
  // owns resolution only.
  const persona = await resolveIframePersona(req);

  const resolved = await resolveContentQubesBySeries(series, persona, {
    contentKind,
    lifecycleState,
  });

  return NextResponse.json({
    ok: true,
    data: {
      qubes: resolved.map((r) => ({
        manifest:      r.manifest,
        editionSummary: r.editionSummary,
        codexSlugs:    r.codexSlugs,
      })),
    },
  });
}
