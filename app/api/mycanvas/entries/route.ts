/**
 * GET  /api/mycanvas/entries        — list this persona's entries
 * POST /api/mycanvas/entries        — create
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { createEntry, listEntries } from '@/services/mycanvas/canvasService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const entries = await listEntries(context.personaId);
  return NextResponse.json({ entries }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  let body: { title?: unknown; bodyMd?: unknown; tags?: unknown; visibility?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }
  const title = typeof body.title === 'string' ? body.title : '';
  if (!title.trim()) {
    return NextResponse.json({ error: 'title-required' }, { status: 400 });
  }
  const entry = await createEntry(context.personaId, {
    title,
    bodyMd: typeof body.bodyMd === 'string' ? body.bodyMd : '',
    tags: Array.isArray(body.tags) ? (body.tags.filter((t) => typeof t === 'string') as string[]) : [],
    visibility: body.visibility === 'invited' ? 'invited' : 'private',
  });
  if (!entry) return NextResponse.json({ error: 'create-failed' }, { status: 500 });
  return NextResponse.json({ entry }, { headers: { 'Cache-Control': 'no-store' } });
}
