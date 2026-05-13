/**
 * POST /api/registry/content-qube/[id]/claim
 *
 * Phase 9 — ContentQube edition claim endpoint. Called by the purchase flow
 * (or by an admin promotional grant) AFTER payment has settled, to issue
 * the persona an edition row in content_qube_editions.
 *
 * Body:
 *   {
 *     rarity:           ContentQubeRarity,   // required — which tier to claim
 *     sourcePurchaseId?: string              // optional purchase row reference
 *   }
 *
 * Returns:
 *   { ok: true,  data: { editionId, editionNumber, rarity, alreadyOwned?, soldOut? } }
 *   { ok: false, error: '...' }
 *
 * Auth: requires an authenticated persona via the spine. Unauthenticated
 * callers get 401 — claims always write to a specific persona row.
 *
 * Privacy:
 *   - persona_id is T0 — written to the DB row only, never to the response
 *   - The transfer receipt emitted by claimEditionForPurchase carries the
 *     T2 alias commitment, not the persona_id
 *
 * NOTE: Phase 9.1 — alias commitment is computed directly from the persona
 * context via cohortAliasService (same computation as buildReceiptHandle in
 * evaluateAccess.ts) without an evaluateAccess side-effect. The payment has
 * already settled; we need the T2 handle for the transfer receipt only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { claimEditionForPurchase } from '@/services/content/claimEdition';
import {
  computeAliasCommitment,
  getCurrentEpoch,
  isAliasServiceConfigured,
} from '@/services/identity/cohortAliasService';
import type { ContentQubeRarity } from '@/types/contentQube';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

const VALID_RARITIES: ReadonlySet<ContentQubeRarity> = new Set([
  'common', 'rare', 'epic', 'legendary', 'secret_black_rare',
]);

export async function POST(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const contentQubeId = params.id;
  if (!contentQubeId) {
    return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });
  }

  const persona = await getActivePersona(req).catch(() => null);
  if (!persona) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: { rarity?: string; sourcePurchaseId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json body' }, { status: 400 });
  }

  const rarity = body.rarity as ContentQubeRarity | undefined;
  if (!rarity || !VALID_RARITIES.has(rarity)) {
    return NextResponse.json(
      { ok: false, error: 'rarity required (common|rare|epic|legendary|secret_black_rare)' },
      { status: 400 },
    );
  }

  // Derive T2 alias commitment for the transfer receipt.
  // Mirrors the buildReceiptHandle logic in evaluateAccess.ts.
  // Non-fatal: falls back to null if the alias service is unconfigured.
  let aliasCommitment: string | null = null;
  if (isAliasServiceConfigured()) {
    try {
      const cohortId = persona.cohortMemberships[0] ?? 'default';
      aliasCommitment = computeAliasCommitment(persona.personaId, cohortId, getCurrentEpoch());
    } catch {
      // non-fatal — transfer receipt writes null aliasCommitment
    }
  }

  const result = await claimEditionForPurchase({
    contentQubeId,
    personaId: persona.personaId,
    rarity,
    sourcePurchaseId: body.sourcePurchaseId,
    aliasCommitment,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error ?? 'claim_failed' }, { status: 500 });
  }

  if (result.soldOut) {
    return NextResponse.json(
      { ok: false, error: 'sold_out', data: { rarity } },
      { status: 409 },
    );
  }

  return NextResponse.json({
    ok: true,
    data: {
      editionId:     result.editionId,
      editionNumber: result.editionNumber,
      rarity:        result.rarity,
      alreadyOwned:  result.alreadyOwned ?? false,
    },
  });
}
