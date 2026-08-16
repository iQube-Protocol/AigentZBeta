/**
 * POST /api/journey/knyts-bridge/choose/kickstarter-click
 *
 * KNYTS Bridge campaign activation, Gate A §6 — "click is not follow".
 *
 * Records `kickstarter_preview_clicked` as OBSERVED evidence only. This must
 * never be promoted into `kickstarter_follow_confirmed` — no external
 * callback/reconciliation signal exists yet (see the launch-readiness
 * report's explicit Kickstarter-confirmation gap). The CHOOSE surface calls
 * this BEFORE navigating to the external Kickstarter URL.
 *
 * Idempotency is per (email, day) — repeated clicks in the same session/day
 * from the same visitor don't farm the click-based Reputation signal, per
 * spec §7.1 ("repeated link clicks from the same actor do not farm reward").
 * Anonymous clicks with no resolvable identifier (no persona, no email) are
 * still recorded as traffic evidence but cannot receive person/persona
 * -linked accrual (spec §7.1) — the projector already enforces that via its
 * own persona/crmPersonaId gates; this route additionally floors the
 * idempotency key to a random-free per-request key for that case, since
 * there is nothing stable to dedupe truly anonymous traffic against.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { resolveCampaignContact, normalizeEmail } from '@/services/crm/campaignContactResolver';
import { recordKnytsBridgeEvidence } from '@/services/campaign/knytsBridgeCampaignEvidence';
import { projectKnytsBridgeEvidenceOutputs } from '@/services/campaign/knytsBridgeCampaignProjector';
import { getKnytsBridgeKickstarterUrl } from '@/services/journey/knytsBridgeCampaignConfig';

export const dynamic = 'force-dynamic';

interface KickstarterClickBody {
  email?: string;
}

export async function POST(req: NextRequest) {
  try {
    return await postImpl(req);
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

async function postImpl(req: NextRequest) {
  let body: KickstarterClickBody = {};
  try {
    body = (await req.json()) as KickstarterClickBody;
  } catch {
    // Body is optional for this event — a click can be recorded with no email.
  }

  const persona = await getActivePersona(req).catch(() => null);
  const normalizedEmail = body.email?.trim() ? normalizeEmail(body.email.trim()) : null;

  let crmPersonaId: string | null = null;
  let investorKnown = false;
  if (normalizedEmail || persona?.personaId) {
    const contact = await resolveCampaignContact({
      normalizedEmail: normalizedEmail ?? '',
      activePersonaId: persona?.personaId ?? null,
    });
    crmPersonaId = contact.crmPersonaId;
    investorKnown = contact.investorKnown;
  }

  const dayBucket = new Date().toISOString().slice(0, 10);
  const idempotencySubject = persona?.personaId ?? normalizedEmail;
  const idempotencyKey = idempotencySubject
    ? `kickstarter_preview_clicked:${idempotencySubject}:${dayBucket}`
    : `kickstarter_preview_clicked:anon:${req.headers.get('x-forwarded-for') ?? 'unknown'}:${dayBucket}`;

  const { isNew, evidence } = await recordKnytsBridgeEvidence({
    actionType: 'kickstarter_preview_clicked',
    idempotencyKey,
    personaId: persona?.personaId ?? null,
    crmPersonaId,
    normalizedEmail,
    investorKnown,
    evidenceGrade: 'observed',
    sourceSurface: 'knyts_bridge_choose',
  });

  if (isNew) {
    await projectKnytsBridgeEvidenceOutputs(evidence);
  }

  return NextResponse.json({ ok: true, kickstarterUrl: getKnytsBridgeKickstarterUrl() });
}
