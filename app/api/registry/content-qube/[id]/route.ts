/**
 * GET /api/registry/content-qube/[id]
 *
 * ContentQube registry read endpoint. Phase 3+4 of the ContentQube integration.
 *
 * Returns a browser-safe ContentQubeDisplayManifest via resolveContentQube().
 * When the caller is authenticated (valid session cookie / API key), persona_owns
 * is resolved server-side via evaluateAccess. Unauthenticated reads return
 * persona_owns = false (safe default — no T0 fields ever emitted).
 *
 * Storage URLs are intentionally withheld — delivery continues via the
 * existing content proxy routes (/api/content/pdf-page/[cid] etc.).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { resolveContentQube } from '@/services/content/resolveContentQube';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

export async function GET(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const id = params.id;
  if (!id) {
    return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });
  }

  // Resolve persona if present. getActivePersona returns null for unauthenticated
  // requests — resolveContentQube handles null gracefully (persona_owns = false).
  const persona = await getActivePersona(req).catch(() => null);

  const resolved = await resolveContentQube(id, persona);
  if (!resolved) {
    return NextResponse.json({ ok: false, error: 'ContentQube not found' }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    data: {
      manifest: resolved.manifest,
      editionSummary: resolved.editionSummary,
      codexSlugs: resolved.codexSlugs,
    },
  });
}
