/**
 * GET /api/companion/notifications — Universal Notifications composition
 * point (PRD-MMC-IMPL-002 §3 Increment 3, operator-ratified 2026-07-23).
 * Spine-authenticated.
 *
 * `services/companion/runtime.ts`'s `resolveCompanionContext()` is a
 * CLIENT-side module (CLAUDE.md "Client-side spine fetches" — every spine
 * call it makes goes through `personaFetch`, never a direct DB read). Two of
 * this increment's sources — `services/delegation/delegationGrantStore.ts`
 * and `services/standing/standingScore.ts::computeStandingScore()` — both
 * require a service-role `SupabaseClient` and are therefore server-only.
 * This route is the necessary server hop that lets the client-side resolver
 * compose them, mirroring the exact same shape it already uses for
 * `GET /api/wallet/active-persona` and `GET /api/assistant/receipts`.
 *
 * Composes, never duplicates:
 *   - delegation status  → `latestGrantEvent()` (NEW, additive read added
 *     alongside the existing `hasActiveDelegation`/`readActiveGrant` in
 *     `delegationGrantStore.ts` — no new query mechanism, same table).
 *   - standing increase  → `computeStandingScore()` (existing, unmodified),
 *     diffed against this persona's last-seen snapshot in the new
 *     `companion_standing_snapshots` table (this migration), upserted here.
 *
 * `passport_status_changed` receipts are DELIBERATELY NOT read here — they
 * already flow through `GET /api/assistant/receipts` (tagged client-side by
 * `mapReceiptsToFeed` in `services/companion/runtime.ts`); reading them again
 * here would violate Extend-Don't-Duplicate.
 *
 * T0/T1 discipline: the response never carries `personaId` or any other T0
 * identifier — only the grant's own id (already a T1-safe UUID minted for
 * the grant, not the persona), status, timestamps, and Standing scores.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { computeStandingScore } from '@/services/standing/standingScore';
import { latestGrantEvent } from '@/services/delegation/delegationGrantStore';

export const dynamic = 'force-dynamic';

export interface CompanionStandingNotification {
  increased: boolean;
  previousScore: number | null;
  currentScore: number;
}

export async function GET(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json(
      { error: 'unauthenticated' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const delegation = await latestGrantEvent(persona.personaId).catch(() => null);

  let standing: CompanionStandingNotification | null = null;
  const admin = getSupabaseServer();
  if (admin) {
    try {
      const breakdown = await computeStandingScore(admin, persona.personaId);
      const currentScore = breakdown.score;

      const { data: prevRow } = await admin
        .from('companion_standing_snapshots')
        .select('last_score')
        .eq('persona_id', persona.personaId)
        .maybeSingle();
      const previousScore =
        typeof (prevRow as { last_score?: unknown } | null)?.last_score === 'number'
          ? (prevRow as { last_score: number }).last_score
          : null;
      const increased = previousScore !== null && currentScore > previousScore;

      // Upsert only when the score actually moved (or this is the first-ever
      // snapshot) — an unchanged score doesn't need a fresh updated_at, and
      // this keeps the write path a no-op on most polls.
      if (previousScore === null || currentScore !== previousScore) {
        await admin.from('companion_standing_snapshots').upsert({
          persona_id: persona.personaId,
          last_score: currentScore,
          updated_at: new Date().toISOString(),
        });
      }

      standing = { increased, previousScore, currentScore };
    } catch {
      // Standing migration pending, or the snapshot table isn't there yet —
      // degrade to no standing signal rather than failing the whole route.
      standing = null;
    }
  }

  return NextResponse.json(
    { ok: true, delegation, standing },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
