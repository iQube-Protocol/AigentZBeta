/**
 * POST /api/community-content/[id]/reject
 *
 * Admin-gated (UI). Flips 'shared' or 'pending_promotion' → 'rejected'
 * so the row stops surfacing publicly. Stores the reviewer + reason for
 * audit.
 *
 * Body: { adminPersonaId: string, reason?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCommunityContentSupabase } from '../../_lib/personaContext';
import { requireCommunityAdmin } from '../../_lib/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  props: { params: Promise<Promise<{ id: string }> | { id: string }> }
) {
  const params = await props.params;
  const resolved = await Promise.resolve(params);
  const id = resolved.id;
  if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });

  let body: { adminPersonaId?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }
  const adminPersonaId = body.adminPersonaId?.trim() || null;
  const reason = body.reason?.trim() || null;

  const supabase = getCommunityContentSupabase();

  const auth = await requireCommunityAdmin(supabase, adminPersonaId);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const { data: content, error: fetchError } = await supabase
    .from('community_generated_content')
    .select('id, status')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ ok: false, error: fetchError.message }, { status: 500 });
  if (!content) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });

  const row = content as { id: string; status: string };
  if (row.status === 'rejected') {
    return NextResponse.json({ ok: true, status: 'rejected', alreadyRejected: true });
  }

  const { error: updateError } = await supabase
    .from('community_generated_content')
    .update({
      status: 'rejected',
      rejected_at: new Date().toISOString(),
      rejected_by: adminPersonaId,
      rejection_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (updateError) return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });

  return NextResponse.json({ ok: true, status: 'rejected' });
}
