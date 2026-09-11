/**
 * POST /api/uploads/[id]/iqube-embed
 *
 * Stage a persona upload for embed into an iQube. Phase 1 stub —
 * resolves the upload via the persona service, returns the embed
 * descriptor. No DB write yet; Phase 2 persists the reference to
 * `iqube_payload_refs` and emits a DVN receipt at iQube mint time.
 *
 * Persona resolved through the spine — the persona id is server-
 * internal and never read from the body.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { stageUploadForIqube } from '@/services/uploads/iqubeUploadEmbed';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ error: 'persona-required' }, { status: 401 });
  }
  const { id: uploadId } = await ctx.params;

  let body: { iqubeId?: string | null; label?: string; tags?: string[] };
  try {
    body = (await req.json().catch(() => ({}))) as typeof body;
  } catch {
    body = {};
  }

  const result = await stageUploadForIqube({
    personaId: persona.personaId,
    uploadId,
    iqubeId: typeof body?.iqubeId === 'string' ? body.iqubeId : null,
    label: typeof body?.label === 'string' ? body.label : undefined,
    tags: Array.isArray(body?.tags) ? body.tags.filter((t): t is string => typeof t === 'string') : undefined,
  });
  if (!result.ok) {
    return NextResponse.json({ error: 'embed-failed', detail: result.reason }, { status: 400 });
  }
  return NextResponse.json({ ok: true, embed: result.embed });
}
