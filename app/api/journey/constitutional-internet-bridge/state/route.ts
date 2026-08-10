/**
 * GET /api/journey/constitutional-internet-bridge/state
 *
 * Assembles the AuthoritativePlatformState for the Constitutional Internet
 * Bridge journey (services/journey/constitutionalInternetBridgeJourney.ts)
 * from real reads, then resolves it via resolveJourneyState() — same shape
 * as /api/journey/knyts-bridge/state.
 *
 * Not gated on auth: HOME/VIEW/ORIENT are deliberately browsable signed-out,
 * so `passport` simply resolves NOT_STARTED/READY for a signed-out caller
 * rather than the route refusing to answer at all.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { listActivityReceiptsForPersona } from '@/services/receipts/activityReceiptService';
import { resolveJourneyState, type AuthoritativePlatformState } from '@/services/journey/resolveJourneyState';
import {
  CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY,
  CI_BRIDGE_RUNTIME_AGENT_ID,
  CI_BRIDGE_DISPOSITION_CONTEXT,
} from '@/services/journey/constitutionalInternetBridgeJourney';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    return await getImpl(req);
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

async function getImpl(req: NextRequest) {
  // Not gated on auth — see file header. A signed-out caller's persona is
  // simply null, and every stage's evidence stays honestly missing.
  const persona = await getActivePersona(req).catch(() => null);
  const personaAuthenticated = Boolean(persona?.personaId);

  let dispositionRecorded = false;
  let constitutionalEventRecorded = false;

  if (persona?.personaId) {
    const dispositionReceipts = await listActivityReceiptsForPersona(persona.personaId, {
      actionTypes: ['experienceqube_focus_disposition_recorded'],
      agentsInvoked: [CI_BRIDGE_RUNTIME_AGENT_ID],
      limit: 5,
    });
    dispositionRecorded = dispositionReceipts.some(
      (r) => (r.actionInput as { context?: string } | null)?.context === CI_BRIDGE_DISPOSITION_CONTEXT,
    );

    if (dispositionRecorded) {
      // The smallest real "a constitutional event happened" fact: Passport
      // is already implied by personaAuthenticated, and the disposition
      // itself is a receipted act — that pair is enough to say STAND has
      // something honest to show, without inventing a richer formula.
      constitutionalEventRecorded = true;
    }
  }

  const platformState: AuthoritativePlatformState = {
    stages: {
      passport: { personaAuthenticated },
      act: { dispositionRecorded },
      stand: { constitutionalEventRecorded },
    },
  };

  const runtimeState = resolveJourneyState(CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY, platformState);

  return NextResponse.json({ ok: true, state: runtimeState, personaAuthenticated });
}
