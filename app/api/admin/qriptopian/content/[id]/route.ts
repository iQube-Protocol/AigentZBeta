/**
 * PATCH  /api/admin/qriptopian/content/[id]  — update title, excerpt, status, section
 * DELETE /api/admin/qriptopian/content/[id]  — soft delete (sets deleted_at)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ ok: false, error: 'DB unavailable' }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (typeof body.title === 'string')       updates.title       = body.title.trim();
  if (typeof body.description === 'string') updates.description = body.description.trim();
  if (body.status === 'published') {
    updates.status       = 'published';
    updates.published_at = new Date().toISOString();
  } else if (body.status === 'draft') {
    updates.status = 'draft';
  }
  if (typeof body.section === 'string') {
    updates.layout_hints = { section: body.section };
  }

  try {
    const { error } = await supabase
      .from('smart_content_qubes')
      .update(updates)
      .eq('id', params.id)
      .eq('tenant_id', 'qriptopian');

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin/qriptopian/content PATCH] error:', err);
    return NextResponse.json({ ok: false, error: 'Update failed' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ ok: false, error: 'DB unavailable' }, { status: 503 });

  try {
    const { error } = await supabase
      .from('smart_content_qubes')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', params.id)
      .eq('tenant_id', 'qriptopian');

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin/qriptopian/content DELETE] error:', err);
    return NextResponse.json({ ok: false, error: 'Delete failed' }, { status: 500 });
  }
}
