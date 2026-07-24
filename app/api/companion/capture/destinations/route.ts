/**
 * GET /api/companion/capture/destinations
 *
 * Lists the persona's existing active Intents and Ventures, for the
 * Workspace Inbox's "attach to an existing X" picker (PRD-MMC-IMPL-003
 * Increment 2 follow-on, 2026-07-24 — the assign route previously only
 * ever created brand-new objects; the operator pointed out there was no
 * way to land a capture in something they already have).
 *
 * Composes the SAME read functions the rest of the app already uses for
 * these lists (`listRecentIntentsForPersona`, `listVentureQubes`) — never
 * a parallel query against `nbe_plans` / `venture_qubes`.
 *
 * Fails closed: `getActivePersona` returning null produces a 401 with NO
 * Supabase read attempted.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { listRecentIntentsForPersona } from '@/services/iqube/intentQube';
import { listVentureQubes } from '@/services/venture/ventureQubeService';
import type { CaptureIntentDestination, CaptureVentureDestination } from '@/types/companionCapture';

export const dynamic = 'force-dynamic';

// Only intents still actually in flight are worth offering as an "attach
// to" target — a completed/failed/cancelled intent isn't a live landing
// spot for new material.
const ACTIVE_INTENT_STATUSES = new Set(['in_progress', 'awaiting_approval']);

export async function GET(request: NextRequest): Promise<NextResponse> {
  const persona = await getActivePersona(request);
  if (!persona?.personaId) {
    return NextResponse.json(
      { error: 'unauthenticated' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const [intents, ventures] = await Promise.all([
    listRecentIntentsForPersona(persona.personaId, { limit: 20 }),
    listVentureQubes(persona.personaId),
  ]);

  const intentOptions: CaptureIntentDestination[] = intents
    .filter((intent) => ACTIVE_INTENT_STATUSES.has(intent.status))
    .map((intent) => ({ id: intent.id, name: intent.intentName, status: intent.status }));

  const ventureOptions: CaptureVentureDestination[] = ventures.map((venture) => ({
    id: venture.id,
    name: venture.name,
    slug: venture.slug,
    stage: venture.stage,
  }));

  return NextResponse.json(
    { intents: intentOptions, ventures: ventureOptions },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
