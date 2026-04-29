/**
 * POST /api/community-content/[id]/discard
 *
 * Body: { personaId: string }
 *
 * Refund + delete a generation if:
 *   - the row belongs to the persona,
 *   - it's still in 'draft' status,
 *   - it was created within community_content_settings.discard_window_seconds (default 30s),
 *   - the persona has not used today's discard refund (1/day default).
 *
 * On success: refunds qc_cost back to qc_balances, deletes the content row,
 * and stamps community_content_quotas.daily_refund_used_date.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCommunityContentSupabase } from '../../_lib/personaContext';
import { creditQc } from '../../_lib/generate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Settings {
  discard_window_seconds: number;
  daily_discard_refund: number;
}

const FALLBACK_SETTINGS: Settings = {
  discard_window_seconds: 30,
  daily_discard_refund: 1,
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } },
) {
  const resolved = await Promise.resolve(params);
  const id = resolved.id;
  if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });

  let body: { personaId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const personaId = body.personaId?.trim();
  if (!personaId) return NextResponse.json({ ok: false, error: 'personaId required' }, { status: 400 });

  const supabase = getCommunityContentSupabase();

  const [settingsResult, contentResult, quotaResult] = await Promise.all([
    supabase.from('community_content_settings').select('discard_window_seconds, daily_discard_refund').eq('id', 1).maybeSingle(),
    supabase.from('community_generated_content').select('id, creator_persona_id, qc_cost, status, created_at').eq('id', id).maybeSingle(),
    supabase.from('community_content_quotas').select('daily_refund_used_date').eq('persona_id', personaId).maybeSingle(),
  ]);

  const settings: Settings = (settingsResult.data as Settings | null) ?? FALLBACK_SETTINGS;
  const content = contentResult.data as {
    id: string;
    creator_persona_id: string;
    qc_cost: number;
    status: string;
    created_at: string;
  } | null;
  const quota = quotaResult.data as { daily_refund_used_date: string | null } | null;

  if (!content) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
  if (content.creator_persona_id !== personaId) return NextResponse.json({ ok: false, error: 'Not your content' }, { status: 403 });
  if (content.status !== 'draft') return NextResponse.json({ ok: false, error: `Cannot discard once ${content.status}` }, { status: 409 });

  const ageSeconds = (Date.now() - new Date(content.created_at).getTime()) / 1000;
  if (ageSeconds > settings.discard_window_seconds) {
    return NextResponse.json(
      { ok: false, error: `Discard window expired (${settings.discard_window_seconds}s)` },
      { status: 410 },
    );
  }

  const today = todayISO();
  if (quota?.daily_refund_used_date === today && settings.daily_discard_refund <= 1) {
    return NextResponse.json(
      { ok: false, error: 'Daily discard refund already used' },
      { status: 429 },
    );
  }

  // Refund (only if there was a charge)
  if (content.qc_cost > 0) {
    await creditQc(supabase, personaId, content.qc_cost, 'community_content_discard_refund', id);
  }

  // Delete the content row
  const { error: deleteError } = await supabase
    .from('community_generated_content')
    .delete()
    .eq('id', id);
  if (deleteError) {
    return NextResponse.json({ ok: false, error: deleteError.message }, { status: 500 });
  }

  // Stamp the daily refund date
  await supabase
    .from('community_content_quotas')
    .upsert(
      {
        persona_id:             personaId,
        daily_refund_used_date: today,
        last_discard_refund_at: new Date().toISOString(),
        updated_at:             new Date().toISOString(),
      },
      { onConflict: 'persona_id' },
    );

  return NextResponse.json({ ok: true, refundedQc: content.qc_cost });
}
