/**
 * GET /api/intent-chains/feedback/aggregate?template_id=X
 *
 * Admin-only aggregate stats per template — like_count, dislike_count,
 * like_ratio, comment_count, recent comment samples (T1 — operator
 * read, never receipts). Powers the cartridge "template health"
 * surface in v1.5+.
 *
 * Auth: spine — admin only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const url = new URL(request.url);
  const template_id = url.searchParams.get('template_id') ?? '';
  if (!template_id) return NextResponse.json({ error: 'template_id_required' }, { status: 400 });

  const sample_limit = Math.min(Math.max(Number.parseInt(url.searchParams.get('sample_limit') ?? '10', 10), 0), 50);

  const sb = getSupabaseServer();
  if (!sb) return NextResponse.json({ error: 'storage_unavailable' }, { status: 503 });

  // Join via intent_chains since intent_chain_feedback doesn't carry template_id directly.
  // PostgREST nested select pulls feedback rows grouped through the chain.
  const { data: chains, error } = await sb
    .from('intent_chains')
    .select('chain_id, template_id, intent_chain_feedback (rating, comment, rated_at)')
    .eq('template_id', template_id)
    .limit(2000);

  if (error) return NextResponse.json({ error: 'query_failed', detail: error.message }, { status: 500 });

  let like_count = 0;
  let dislike_count = 0;
  let comment_count = 0;
  const dislike_comments: Array<{ comment: string; rated_at: string }> = [];

  type FeedbackInner = { rating: string; comment: string | null; rated_at: string };
  for (const row of chains ?? []) {
    const fbList = ((row as unknown as { intent_chain_feedback: FeedbackInner[] }).intent_chain_feedback) ?? [];
    for (const fb of fbList) {
      if (fb.rating === 'like') like_count++;
      else if (fb.rating === 'dislike') dislike_count++;
      if (fb.comment && fb.comment.trim().length > 0) {
        comment_count++;
        if (fb.rating === 'dislike') dislike_comments.push({ comment: fb.comment, rated_at: fb.rated_at });
      }
    }
  }

  const total = like_count + dislike_count;
  const like_ratio = total > 0 ? Math.round((like_count / total) * 100) / 100 : null;

  // Sort dislike comments by recency + cap
  dislike_comments.sort((a, b) => Date.parse(b.rated_at) - Date.parse(a.rated_at));
  const sample = dislike_comments.slice(0, sample_limit);

  return NextResponse.json({
    template_id,
    chains_sampled: chains?.length ?? 0,
    like_count,
    dislike_count,
    like_ratio,
    comment_count,
    recent_dislike_comments: sample,
  });
}
