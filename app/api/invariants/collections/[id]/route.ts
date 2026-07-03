/**
 * /api/invariants/collections/[id] — collection detail + membership edits.
 *
 * GET  — collection + ordered members (any authenticated persona)
 * POST — { addMembers?: string[]; removeMembers?: string[] } (admin)
 *
 * Spine-gated (personaFetch required).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { addMembers, getCollection, listMembers, removeMember } from '@/services/invariants';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, context: { params: { id: string } }) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  try {
    const collection = await getCollection(context.params.id);
    if (!collection) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    const members = await listMembers(context.params.id);
    return NextResponse.json({ ok: true, collection, members });
  } catch (error) {
    console.error('[api/invariants/collections/[id]] read failed', error);
    return NextResponse.json({ error: 'read_failed' }, { status: 500 });
  }
}

interface EditBody {
  addMembers?: string[];
  removeMembers?: string[];
}

export async function POST(request: NextRequest, context: { params: { id: string } }) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const collection = await getCollection(context.params.id);
  if (!collection) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  let body: EditBody;
  try {
    body = (await request.json()) as EditBody;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  try {
    if (body.addMembers?.length) await addMembers(context.params.id, body.addMembers);
    for (const invariantId of body.removeMembers ?? []) {
      await removeMember(context.params.id, invariantId);
    }
    const members = await listMembers(context.params.id);
    return NextResponse.json({ ok: true, members });
  } catch (error) {
    console.error('[api/invariants/collections/[id]] edit failed', error);
    return NextResponse.json({ error: 'edit_failed' }, { status: 500 });
  }
}
