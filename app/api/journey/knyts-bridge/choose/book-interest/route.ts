/**
 * POST /api/journey/knyts-bridge/choose/book-interest
 *
 * KNYTS Bridge campaign activation, Gate A (`KNYT_BRIDGE_CAMPAIGN_IMPLEMENTATION_SPEC_CLAUDE_CODE.md`).
 * The CHOOSE surface's first card is now campaign pre-registration for the
 * metaKnyt Kickstarter, not a graphic-novel reserve signal — this route
 * keeps its original path (no client-side submitUrl change needed) but its
 * behavior is substantially different:
 *
 *   1. Normalizes the email and resolves/dedupes the CRM contact
 *      (`resolveCampaignContact`) — an existing metaKnyt investor keeps
 *      their record; a genuinely new visitor gets exactly one prospect.
 *   2. Records ONE idempotent `campaign_preregistered` evidence event per
 *      normalized email (`recordKnytsBridgeEvidence`) — repeated submission
 *      does not create duplicate CRM records, evidence, or rewards.
 *   3. On a freshly-recorded (non-duplicate) event, independently projects
 *      Reputation/Standing/Reward (`projectKnytsBridgeEvidenceOutputs`) —
 *      Gate B. A repeat submission skips projection entirely (idempotent).
 *   4. Returns the centralized Kickstarter follow URL so the CHOOSE surface
 *      can reveal the "Follow the Kickstarter" CTA without hard-coding it.
 *
 * Anonymous/signed-out visitors ARE now captured (spec §3.1: "email address
 * — required for anonymous/non-authenticated visitors") — the prior
 * behavior of silently discarding unauthenticated submissions
 * (`{ok:true, persisted:false}`) is the exact gap this activation closes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { resolveCampaignContact, normalizeEmail } from '@/services/crm/campaignContactResolver';
import { recordKnytsBridgeEvidence } from '@/services/campaign/knytsBridgeCampaignEvidence';
import { projectKnytsBridgeEvidenceOutputs } from '@/services/campaign/knytsBridgeCampaignProjector';
import { getKnytsBridgeKickstarterUrl } from '@/services/journey/knytsBridgeCampaignConfig';

export const dynamic = 'force-dynamic';

interface BookInterestBody {
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
        error:
          `This request threw before it could answer: ` +
          `${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}. ` +
          'Nothing here says whether the work completed — re-read the state before retrying.',
      },
      { status: 500 },
    );
  }
}

async function postImpl(req: NextRequest) {
  let body: BookInterestBody;
  try {
    body = (await req.json()) as BookInterestBody;
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }

  const rawEmail = body.email?.trim();
  if (!rawEmail || !rawEmail.includes('@')) {
    return NextResponse.json({ error: 'invalid-email' }, { status: 400 });
  }
  const normalizedEmail = normalizeEmail(rawEmail);

  const persona = await getActivePersona(req).catch(() => null);

  const contact = await resolveCampaignContact({
    normalizedEmail,
    activePersonaId: persona?.personaId ?? null,
  });

  const { isNew, evidence } = await recordKnytsBridgeEvidence({
    actionType: 'campaign_preregistered',
    idempotencyKey: `campaign_preregistered:${normalizedEmail}`,
    personaId: persona?.personaId ?? null,
    crmPersonaId: contact.crmPersonaId,
    normalizedEmail,
    investorKnown: contact.investorKnown,
    evidenceGrade: 'verified',
    sourceSurface: 'knyts_bridge_choose',
    metadata: { email: rawEmail },
  });

  // Required behavior: once evidence is persisted, preregistration IS the
  // success — the downstream Reputation/Standing/Knightcoin projection is
  // an independent, best-effort leg that must never turn an already-
  // successful preregistration into a failed request. Isolated in its own
  // try/catch (rather than relying solely on the projector's own internal
  // per-leg guards) because a genuinely unexpected throw here — a schema
  // mismatch, a transient network error — must withhold only the affected
  // output, never the acquisition itself.
  if (isNew) {
    try {
      await projectKnytsBridgeEvidenceOutputs(evidence);
    } catch (err) {
      console.error(
        '[knyts-bridge/choose/book-interest] projection failed after evidence was persisted (non-fatal — preregistration still succeeds):',
        err,
      );
    }
  }

  return NextResponse.json({
    ok: true,
    persisted: true,
    isNewSubmission: isNew,
    investorKnown: contact.investorKnown,
    kickstarterUrl: getKnytsBridgeKickstarterUrl(),
  });
}
