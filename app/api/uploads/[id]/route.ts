/**
 * GET    /api/uploads/[id]  — fetch upload + parsed index for this persona
 * DELETE /api/uploads/[id]  — archive (soft-delete) this upload
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getPersonaUploadService } from '@/services/uploads/supabaseUploadAdapter';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ error: 'persona-required' }, { status: 401 });
  }
  const { id } = await ctx.params;
  const service = getPersonaUploadService();
  const upload = await service.get(id, persona.personaId);
  if (!upload) {
    return NextResponse.json({ error: 'not-found' }, { status: 404 });
  }
  return NextResponse.json({ upload });
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ error: 'persona-required' }, { status: 401 });
  }
  const { id } = await ctx.params;
  const service = getPersonaUploadService();
  const ok = await service.archive(id, persona.personaId);
  if (!ok) {
    return NextResponse.json({ error: 'not-found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
