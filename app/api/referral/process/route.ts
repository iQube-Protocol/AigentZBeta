/**
 * API Route: Process Referral
 * POST /api/referral/process
 *
 * Processes a referral at signup. Three input modes (priority order):
 *   1. refCode — preferred. Server-resolves to the referrer via
 *      the referral_codes index. T0 personaId never crosses the
 *      browser-bound JSON either inbound or outbound.
 *   2. referrerHandle — legacy FIO-handle attribution.
 *   3. referrerPersonaId — DEPRECATED. Kept for one release for
 *      backward compat with callers that haven't migrated to refCode.
 *      Emits a deprecation warning in the server logs on receipt.
 *
 * Response carries `referrerFound` (boolean) but NOT `referrerPersonaId`
 * — the new persona's signup flow doesn't need it (the server has
 * already wired attribution by the time it returns).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getReferralService } from '@/services/rewards/referralService';
import { emitCampaignEvent } from '@/services/campaign/campaignService';

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

async function resolveRefCodeToPersonaId(code: string): Promise<string | null> {
  if (!/^[a-f0-9]{16}$/.test(code)) return null;
  const { data } = await sb()
    .from('referral_codes')
    .select('persona_id')
    .eq('code', code)
    .maybeSingle();
  return (data?.persona_id as string | undefined) ?? null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { newPersonaId, refCode, referrerHandle, referrerPersonaId, campaignId } = body;

    if (!newPersonaId) {
      return NextResponse.json({ error: 'newPersonaId is required' }, { status: 400 });
    }

    // Priority chain: refCode > referrerHandle > deprecated referrerPersonaId.
    let resolvedReferrerPersonaId: string | undefined;
    if (typeof refCode === 'string' && refCode.length > 0) {
      const resolved = await resolveRefCodeToPersonaId(refCode);
      if (resolved) resolvedReferrerPersonaId = resolved;
    } else if (referrerPersonaId && typeof referrerPersonaId === 'string') {
      // Deprecated path — log a server-side warning so we can track
      // unmigrated callers in CloudWatch.
      console.warn('[referral/process] deprecated referrerPersonaId input — migrate caller to refCode');
      resolvedReferrerPersonaId = referrerPersonaId;
    }

    if (!resolvedReferrerPersonaId && !referrerHandle) {
      return NextResponse.json({
        error: 'refCode, referrerHandle, or referrerPersonaId (deprecated) is required',
      }, { status: 400 });
    }

    const referralService = getReferralService();
    const result = await referralService.processReferral({
      newPersonaId,
      referrerHandle,
      referrerPersonaId: resolvedReferrerPersonaId,
      campaignId,
    });

    if (result.success && result.referrerFound && result.referrerPersonaId) {
      // emitCampaignEvent uses personaId server-side for the campaign
      // ledger row but the response does NOT echo it back to the
      // caller — see the response shape below.
      await emitCampaignEvent({
        campaignId: 'bring-a-knight',
        eventType: 'referral_signup_completed',
        personaId: result.referrerPersonaId,
        referrerPersonaId: result.referrerPersonaId,
        source: 'referral_process',
        metadata: {
          refereePersonaId: newPersonaId,
        },
      });

      await emitCampaignEvent({
        campaignId: 'qriptopian-share',
        eventType: 'content_share_signup',
        personaId: result.referrerPersonaId,
        source: 'referral_process',
        metadata: {
          refereePersonaId: newPersonaId,
        },
      });
    }

    // T0-safe response: drop referrerPersonaId. The caller (signup flow)
    // only needs to know the attribution succeeded; they don't need
    // (and shouldn't have) the referrer's persona id.
    return NextResponse.json({
      success: result.success,
      referrerFound: result.referrerFound,
      referrerHandle: result.referrerHandle,
      error: result.error,
    });
  } catch (error) {
    console.error('[API] Error processing referral:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
