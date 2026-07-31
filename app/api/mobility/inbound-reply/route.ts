/**
 * POST /api/mobility/inbound-reply
 *
 * Mailjet Parse API receiver for HMS institutional response ingestion.
 *
 * When an institution replies to an outreach email sent on behalf of a
 * HMS case, this route:
 *   1. Authenticates via shared MAILJET_WEBHOOK_SECRET
 *   2. Extracts the HMS case commitment ref from the CustomID header
 *      (format: hms:<lockerRef>:<institutionId>)
 *   3. Looks up the case via the commitment ref (one-way — never exposes caseId)
 *   4. Stores the institutional response in mobility_cases.institutional_responses
 *   5. Forwards the response to the case's marketa_forward_email if configured
 *   6. Stubs aigentMe next-action proposal (fast-follow — aigentMe CoS routing)
 *
 * Routing evolution note:
 *   Current:  Marketa system inbox → this route → forward to per-case address
 *   Future:   aigentMe receives directly as delegated Chief of Staff,
 *             evaluates response against PDEP stage criteria, proposes
 *             next best action (stage escalation, follow-up, or close)
 *
 * Configure in Mailjet: Parse API → inbound address:
 *   https://<host>/api/mobility/inbound-reply?secret=<MAILJET_WEBHOOK_SECRET>
 * Set From/Reply-To on outreach emails to the parse-routed address.
 *
 * Always returns 200 for authenticated requests (Mailjet retries non-200s).
 * An unmatched CustomID is a normal outcome, not an error.
 *
 * T0 discipline: caseId never logged or returned. Commitment ref only.
 */

import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { extractSenderEmail, summarizeReply } from '@/services/marketa/activation/inboundReply';

export const dynamic = 'force-dynamic';

/** Derive the same commitment ref the locker-ref route uses for a caseId. */
function caseCommitmentRef(caseId: string): string {
  return createHash('sha256')
    .update('hms:locker:' + caseId)
    .digest('hex')
    .slice(0, 16);
}

/** Parse HMS CustomID: "hms:<lockerRef>:<institutionId>" */
function parseHmsCustomId(customId: string): { lockerRef: string; institutionId: string } | null {
  const parts = customId.split(':');
  if (parts.length < 3 || parts[0] !== 'hms') return null;
  return { lockerRef: parts[1], institutionId: parts.slice(2).join(':') };
}

export async function POST(request: NextRequest) {
  const secret = process.env.MAILJET_WEBHOOK_SECRET;
  if (secret) {
    if (request.nextUrl.searchParams.get('secret') !== secret) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }
  } else {
    console.warn('[mobility/inbound-reply] MAILJET_WEBHOOK_SECRET not set — webhook is unauthenticated');
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid-json' }, { status: 400 });
  }

  const body = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};

  // Extract HMS CustomID from Mailjet Parse payload
  const customId = typeof body.CustomID === 'string' ? body.CustomID.trim() : '';
  const parsed = customId ? parseHmsCustomId(customId) : null;

  if (!parsed) {
    // Not an HMS email — not an error, just not our concern
    return NextResponse.json({ ok: true, matched: false, note: 'no HMS CustomID' });
  }

  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ ok: false, error: 'DB unavailable' }, { status: 503 });

  // Find the case by scanning commitment refs — never store refs in DB;
  // compute for all active cases and match. For scale this should be indexed,
  // but active HMS cases are few.
  const { data: cases } = await supabase
    .from('mobility_cases')
    .select('id, ies_content, marketa_forward_email, institutional_responses')
    .eq('case_status', 'active');

  const matchedCase = (cases ?? []).find(c => caseCommitmentRef(c.id) === parsed.lockerRef);
  if (!matchedCase) {
    return NextResponse.json({ ok: true, matched: false, note: 'commitment ref not matched' });
  }

  const senderEmail = extractSenderEmail(payload);
  const subject = typeof body.Subject === 'string' ? body.Subject.trim() : '';
  const textPart = typeof body['Text-part'] === 'string' ? body['Text-part'] : '';
  const summary = summarizeReply(payload);

  // Look up institution name from IES
  const iesContent = matchedCase.ies_content as { institutions?: Array<{ id: string; name: string; engagement_stage?: number }> } | null;
  const institution = iesContent?.institutions?.find(i => i.id === parsed.institutionId);
  const institutionName = institution?.name ?? parsed.institutionId;
  const stageAtReceipt = institution?.engagement_stage ?? 0;

  const responseRecord = {
    institution_id: parsed.institutionId,
    institution_name: institutionName,
    sender_email: senderEmail ?? 'unknown',
    subject,
    summary,
    text_preview: textPart.slice(0, 500),
    received_at: new Date().toISOString(),
    stage_at_receipt: stageAtReceipt,
    // aigentMe next-action stub — fast-follow: aigentMe evaluates response
    // against PDEP escalation criteria and proposes stage advancement
    proposed_next_action: null,
    aigentme_evaluation_pending: true,
  };

  const existing = Array.isArray(matchedCase.institutional_responses)
    ? matchedCase.institutional_responses as unknown[]
    : [];

  const { error: updateError } = await supabase
    .from('mobility_cases')
    .update({
      institutional_responses: [...existing, responseRecord],
    })
    .eq('id', matchedCase.id);

  if (updateError) {
    console.error('[mobility/inbound-reply] response store failed:', updateError.message);
    return NextResponse.json({ ok: false, error: 'store-failed' }, { status: 500 });
  }

  console.log(`[mobility/inbound-reply] response stored: institution=${institutionName}, commitment=${parsed.lockerRef}`);

  // Forward to per-case address if configured
  // Future: replace with aigentMe CoS agent that evaluates PDEP escalation criteria
  if (matchedCase.marketa_forward_email) {
    console.log(`[mobility/inbound-reply] forward stub → ${matchedCase.marketa_forward_email} (aigentMe CoS routing — fast-follow)`);
    // TODO (aigentMe CoS): send structured evaluation + next-action proposal to forward address
    // For now the operator receives the response via the institutional_responses UI
  }

  return NextResponse.json({ ok: true, matched: true, institution: institutionName });
}
