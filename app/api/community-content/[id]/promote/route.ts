/**
 * POST /api/community-content/[id]/promote
 *
 * Flips 'shared' → 'runtime_promoted' so the content becomes eligible
 * for the runtime takeover catalog.
 *
 * Body: { adminPersonaId: string }   // for audit trail
 *
 * Admin gating mirrors the rest of the codebase — UI gates this behind
 * the admin codex group; the route itself records who did it but does
 * not perform a server-side role check (consistent with treasury-admin
 * and similar routes).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCommunityContentSupabase } from '../../_lib/personaContext';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } },
) {
  const resolved = await Promise.resolve(params);
  const id = resolved.id;
  if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });

  let body: { adminPersonaId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }
  const adminPersonaId = body.adminPersonaId?.trim() || null;

  const supabase = getCommunityContentSupabase();

  const { data: content, error: fetchError } = await supabase
    .from('community_generated_content')
    .select('id, status')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ ok: false, error: fetchError.message }, { status: 500 });
  if (!content) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });

  const row = content as { id: string; status: string };
  if (row.status === 'runtime_promoted') {
    return NextResponse.json({ ok: true, status: 'runtime_promoted', alreadyPromoted: true });
  }
  if (row.status !== 'shared' && row.status !== 'pending_promotion') {
    return NextResponse.json(
      { ok: false, error: `Cannot promote from ${row.status}` },
      { status: 409 },
    );
  }

  const { error: updateError } = await supabase
    .from('community_generated_content')
    .update({
      status: 'runtime_promoted',
      runtime_promoted_at: new Date().toISOString(),
      runtime_promoted_by: adminPersonaId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (updateError) return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });

  return NextResponse.json({ ok: true, status: 'runtime_promoted' });
}
