/**
 * POST /api/financial-services/handoffs/[handoffId]/redeem — the Differ ×
 * Financial Services Bridge pilot, part 4 (redemption side, JSON form).
 *
 * This is the SAME `redeemNativeActionHandoff` the native landing route
 * (app/handoff/financial-services/[handoffId]/page.tsx) calls — exposed as
 * its own JSON endpoint for programmatic/test use so redemption logic has
 * exactly one implementation (CLAUDE.md "Extend, Don't Duplicate"). This
 * route is spine-authenticated ONLY (no Differ integration key): redemption
 * happens inside metaMe, driven by the signed-in browser session that
 * navigated here, never by Differ calling back into metaMe server-to-server.
 *
 * Never executes the underlying MoneyPenny act — a successful redemption
 * only returns the destination the caller (the landing route) should open.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { redeemNativeActionHandoff } from '@/services/handoffs/nativeActionHandoff';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: NextRequest, { params }: { params: Promise<{ handoffId: string }> }) {
  const { handoffId } = await params;

  const persona = await getActivePersona(req);
  if (!persona?.personaId || !persona.authProfileId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: 'Handoff redemption is unavailable — no data store configured in this environment.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const result = await redeemNativeActionHandoff(admin, handoffId, {
    personaId: persona.personaId,
    authProfileId: persona.authProfileId,
  });

  if (!result.ok) {
    const status = result.reason === 'store-unavailable' ? 503 : 409;
    return NextResponse.json({ ok: false, error: result.detail, reason: result.reason }, { status, headers: { 'Cache-Control': 'no-store' } });
  }

  return NextResponse.json(
    {
      ok: true,
      journeyId: result.journeyId,
      stageId: result.stageId,
      actionRef: result.actionRef,
      capabilityRef: result.capabilityRef,
      nativeSurfaceRef: result.nativeSurfaceRef,
      route: result.route,
      returnUrl: result.returnUrl,
    },
    { status: 200, headers: { 'Cache-Control': 'no-store' } },
  );
}
