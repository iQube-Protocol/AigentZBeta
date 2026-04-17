/**
 * PATCH /api/marketa/packs/[id]/status
 *
 * Admin: approve, decline, or set pending_review on a partner-proposed pack.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getMarketaClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { db: { schema: 'marketa' } });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const marketaClient = getMarketaClient();
  if (!marketaClient) {
    return NextResponse.json({ ok: false, error: 'DB unavailable' }, { status: 503 });
  }

  const { id } = params;
  if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });

  let body: { status: string; admin_notes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid body' }, { status: 400 });
  }

  const allowed = ['draft', 'pending_review', 'approved', 'declined'];
  if (!allowed.includes(body.status)) {
    return NextResponse.json({ ok: false, error: `status must be one of: ${allowed.join(', ')}` }, { status: 400 });
  }

  const update: Record<string, unknown> = { status: body.status };
  if (body.admin_notes !== undefined) update.admin_notes = body.admin_notes;
  if (body.status === 'approved') update.approved_at = new Date().toISOString();

  try {
    // For draft IDs (temp IDs without DB record), return success gracefully
    if (id.startsWith('draft_')) {
      return NextResponse.json({ ok: true, id, status: body.status });
    }

    const { error } = await marketaClient
      .from('packs')
      .update(update)
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ ok: true, id, status: body.status });
  } catch (err) {
    console.error('[packs/status PATCH] error:', err);
    return NextResponse.json({ ok: false, error: 'Update failed' }, { status: 500 });
  }
}
