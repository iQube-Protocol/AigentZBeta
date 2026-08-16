/**
 * POST /api/journey/knyts-bridge/community/[id]/like
 *
 * KNYTS Bridge campaign activation, Gate C — Crossing Story likes.
 *
 * `community_generated_content` (Crossing Stories) has no like mechanism of
 * its own; `knyt_reactions` exists but is scoped to a different content type
 * (`knyt_publication_states`, Living Canon) with a NOT NULL FK, so it cannot
 * be reused without a schema change to it. `knyts_bridge_story_likes`
 * (migration `20260930003200_knyts_bridge_campaign_activation.sql`) is the
 * minimal purpose-built table for this — one row per (content, liker),
 * enforced unique.
 *
 * Rules enforced here (spec §7.1, §10):
 *   - authenticated actor required (no anonymous likes — nothing to dedupe
 *     an anonymous "unique actor" against);
 *   - no self-like reward (the author cannot like their own story);
 *   - one qualified like per actor/story (DB unique constraint + idempotent
 *     evidence recording);
 *   - rewarded likes capped at 5/day per liking actor — beyond the cap the
 *     like itself still counts toward the story's unique-like total, but
 *     the reward/reputation legs are not projected for that day's excess;
 *   - the story's 5th unique like produces ONE separate threshold evidence
 *     event (`crossing_story_engagement_threshold_reached`) for the AUTHOR,
 *     which is Standing-eligible — a like itself never is (Canon II: "a like
 *     is not Standing").
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getCrmClient } from '@/services/crm/crmDataAccess';
import { resolveCampaignContact } from '@/services/crm/campaignContactResolver';
import { recordKnytsBridgeEvidence } from '@/services/campaign/knytsBridgeCampaignEvidence';
import { projectKnytsBridgeEvidenceOutputs } from '@/services/campaign/knytsBridgeCampaignProjector';

export const dynamic = 'force-dynamic';

const DAILY_REWARDED_LIKE_CAP = 5;
const LIKE_THRESHOLD_COUNT = 5;

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    return await postImpl(req, context);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        refusalCode: 'UNHANDLED_ROUTE_ERROR',
        error: `This request threw before it could answer: ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}.`,
      },
      { status: 500 },
    );
  }
}

async function postImpl(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: contentId } = await context.params;
  const persona = await getActivePersona(req).catch(() => null);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'authentication-required' }, { status: 401 });
  }

  const client = getCrmClient();
  const { data: content } = await client
    .from('community_generated_content')
    .select('id, creator_persona_id, campaign_tag')
    .eq('id', contentId)
    .maybeSingle();
  if (!content) {
    return NextResponse.json({ ok: false, error: 'content-not-found' }, { status: 404 });
  }

  if (content.creator_persona_id === persona.personaId) {
    return NextResponse.json({ ok: false, error: 'self-like-not-allowed' }, { status: 400 });
  }

  const { error: insertError } = await client
    .from('knyts_bridge_story_likes')
    .insert({ community_content_id: contentId, liker_persona_id: persona.personaId });

  const alreadyLiked = Boolean(insertError);
  if (insertError && !(insertError.message ?? '').toLowerCase().includes('duplicate')) {
    return NextResponse.json({ ok: false, error: insertError.message }, { status: 500 });
  }

  const { count: totalLikes } = await client
    .from('knyts_bridge_story_likes')
    .select('id', { count: 'exact', head: true })
    .eq('community_content_id', contentId);

  if (alreadyLiked) {
    return NextResponse.json({ ok: true, alreadyLiked: true, totalLikes: totalLikes ?? 0 });
  }

  const contact = await resolveCampaignContact({
    normalizedEmail: '',
    activePersonaId: persona.personaId,
  });

  // Daily rewarded-like cap for the LIKING actor.
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const { count: likesToday } = await client
    .from('knyts_bridge_campaign_evidence')
    .select('id', { count: 'exact', head: true })
    .eq('action_type', 'crossing_story_liked')
    .eq('persona_id', persona.personaId)
    .gte('created_at', dayStart.toISOString());
  const underDailyCap = (likesToday ?? 0) < DAILY_REWARDED_LIKE_CAP;

  const { isNew, evidence } = await recordKnytsBridgeEvidence({
    actionType: 'crossing_story_liked',
    idempotencyKey: `crossing_story_liked:${contentId}:${persona.personaId}`,
    personaId: persona.personaId,
    crmPersonaId: contact.crmPersonaId,
    investorKnown: contact.investorKnown,
    evidenceGrade: 'verified',
    sourceSurface: 'knyts_bridge_community',
    contentId,
  });

  if (isNew && underDailyCap) {
    await projectKnytsBridgeEvidenceOutputs(evidence);
  }

  // Threshold: the story's Nth unique like (first time only) rewards the
  // AUTHOR with one separate, Standing-eligible evidence event.
  if ((totalLikes ?? 0) >= LIKE_THRESHOLD_COUNT && content.creator_persona_id) {
    const authorContact = await resolveCampaignContact({
      normalizedEmail: '',
      activePersonaId: content.creator_persona_id,
    });
    const { isNew: thresholdIsNew, evidence: thresholdEvidence } = await recordKnytsBridgeEvidence({
      actionType: 'crossing_story_engagement_threshold_reached',
      idempotencyKey: `crossing_story_engagement_threshold_reached:${contentId}`,
      personaId: content.creator_persona_id,
      crmPersonaId: authorContact.crmPersonaId,
      investorKnown: authorContact.investorKnown,
      evidenceGrade: 'verified',
      sourceSurface: 'knyts_bridge_community',
      contentId,
    });
    if (thresholdIsNew) {
      await projectKnytsBridgeEvidenceOutputs(thresholdEvidence);
    }
  }

  return NextResponse.json({
    ok: true,
    alreadyLiked: false,
    totalLikes: totalLikes ?? 0,
    rewarded: underDailyCap,
  });
}
