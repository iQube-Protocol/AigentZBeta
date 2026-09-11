/**
 * GET    /api/myworkspace/entries/[id]  — fetch full entry
 * PATCH  /api/myworkspace/entries/[id]  — update
 * DELETE /api/myworkspace/entries/[id]  — delete
 *
 * Sibling of /api/mycanvas/entries/[id].
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { deleteEntry, getEntry, updateEntry } from '@/services/myworkspace/workspaceService';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const { id } = await ctx.params;
  const entry = await getEntry(context.personaId, id);
  if (!entry) return NextResponse.json({ error: 'not-found-or-forbidden' }, { status: 404 });
  return NextResponse.json({ entry }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  let body: { title?: unknown; bodyMd?: unknown; tags?: unknown; visibility?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }
  const { id } = await ctx.params;
  const entry = await updateEntry(context.personaId, id, {
    title: typeof body.title === 'string' ? body.title : undefined,
    bodyMd: typeof body.bodyMd === 'string' ? body.bodyMd : undefined,
    tags: Array.isArray(body.tags)
      ? (body.tags.filter((t) => typeof t === 'string') as string[])
      : undefined,
    visibility:
      body.visibility === 'private' || body.visibility === 'invited' ? body.visibility : undefined,
  });
  if (!entry) return NextResponse.json({ error: 'not-found-or-forbidden' }, { status: 404 });
  return NextResponse.json({ entry }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function DELETE(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const { id } = await ctx.params;
  const ok = await deleteEntry(context.personaId, id);
  if (!ok) return NextResponse.json({ error: 'not-found-or-forbidden' }, { status: 404 });
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
