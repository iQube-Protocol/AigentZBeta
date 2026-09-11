/**
 * POST /api/marketa/activation/inbound-reply
 *
 * Mailjet Parse API receiver — automated reply ingestion for activation
 * outreach (golden path #2; replaces the manual "Mark responded" click
 * when configured). When a candidate's operator replies to an outreach
 * email, the sender address is matched against outreach_sent activation
 * events and the candidate flips sent → responded, exactly like the
 * manual mark_responded action.
 *
 * Auth: shared secret as a query param (same pattern as
 * /api/crm/webhooks/mailjet): ?secret=<MAILJET_WEBHOOK_SECRET>
 *
 * Configure in Mailjet: Account → Inbound message parsing (Parse API) →
 * Add inbound address → URL:
 *   https://<host>/api/marketa/activation/inbound-reply?secret=<MAILJET_WEBHOOK_SECRET>
 * Replies reach this hook when the outreach From/Reply-To uses the
 * parse-routed address.
 *
 * Always returns 200 for authenticated, parseable posts (Mailjet retries
 * non-200s; an unmatched sender is a normal outcome, not an error).
 */

import { NextRequest, NextResponse } from 'next/server';

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { dbToCandidate } from '@/services/marketa/activation/normalizers';
import { extractSenderEmail, summarizeReply } from '@/services/marketa/activation/inboundReply';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const secret = process.env.MAILJET_WEBHOOK_SECRET;
  if (secret) {
    if (request.nextUrl.searchParams.get('secret') !== secret) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }
  } else {
    console.warn('[activation inbound-reply] MAILJET_WEBHOOK_SECRET not set — webhook is unauthenticated');
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid-json' }, { status: 400 });
  }

  const sender = extractSenderEmail(payload);
  if (!sender) {
    return NextResponse.json({ ok: true, matched: 0, note: 'no sender email in payload' });
  }

  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ ok: false, error: 'DB unavailable' }, { status: 503 });

  // Match the sender against outreach_sent events (metadata.to records the
  // operator-supplied recipient), newest first.
  const { data: sentEvents, error: eventsError } = await supabase
    .schema('marketa')
    .from('marketa_activation_events')
    .select('candidate_agent_id, metadata, created_at')
    .eq('event_type', 'outreach_sent')
    .order('created_at', { ascending: false })
    .limit(200);
  if (eventsError) {
    console.error('[activation inbound-reply] event lookup failed:', eventsError.message);
    return NextResponse.json({ ok: false, error: 'event-lookup-failed' }, { status: 500 });
  }

  const candidateIds = Array.from(
    new Set(
      (sentEvents ?? [])
        .filter((row) => {
          const to = (row.metadata as Record<string, unknown> | null)?.to;
          return typeof to === 'string' && to.trim().toLowerCase() === sender;
        })
        .map((row) => row.candidate_agent_id as string)
        .filter(Boolean),
    ),
  );
  if (candidateIds.length === 0) {
    return NextResponse.json({ ok: true, matched: 0, note: `no sent outreach to ${sender}` });
  }

  const now = new Date().toISOString();
  const summary = summarizeReply(payload);
  let responded = 0;

  for (const candidateId of candidateIds) {
    const { data: row } = await supabase
      .schema('marketa')
      .from('marketa_candidate_agents')
      .select('*')
      .eq('id', candidateId)
      .single();
    if (!row) continue;
    const candidate = dbToCandidate(row as Record<string, unknown>);
    // Same guard as the manual mark_responded action — only sent outreach
    // flips, so duplicate replies and stale matches are no-ops.
    if (candidate.outreachStatus !== 'sent') continue;

    const { error: updateError } = await supabase
      .schema('marketa')
      .from('marketa_candidate_agents')
      .update({
        outreach_status: 'responded',
        activation_status:
          candidate.activationStatus === 'outreach_sent' ? 'responded' : candidate.activationStatus,
        updated_at: now,
      })
      .eq('id', candidateId);
    if (updateError) {
      console.error('[activation inbound-reply] update failed:', candidateId, updateError.message);
      continue;
    }

    await supabase
      .schema('marketa')
      .from('marketa_activation_events')
      .insert({
        candidate_agent_id: candidateId,
        event_type: 'outreach_responded',
        summary: `${candidate.name} replied to outreach (auto-ingested from ${sender})${summary ? `: ${summary}` : ''}`,
        actor: 'mailjet-inbound',
        metadata: { sender, replySummary: summary || undefined, source: 'mailjet_parse_api' },
      });
    responded += 1;
  }

  return NextResponse.json({ ok: true, matched: candidateIds.length, responded });
}
