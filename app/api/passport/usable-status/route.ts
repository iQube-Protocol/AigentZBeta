/**
 * GET /api/passport/usable-status — "does the CALLER already hold a usable
 * Polity Citizen Passport?" (2026-08-12).
 *
 * Bridge-agnostic exposure of the SAME canonical check the KNYTS/CI Bridge
 * and Horizen state routes already use
 * (services/identity/passportPrincipal.ts's `loadUsableCitizenPassportForAuthProfile`
 * / `isPassportUsable`) — never a second, weaker definition of "already has a
 * Passport" (inv.engineering.036/037). Scoped by `authProfileId` (the
 * credential belongs to the HOLDER, across every persona they own), never by
 * whichever persona happens to be active.
 *
 * Built for PassportBureauApplyTab.tsx's account-step continuation: right
 * after ANY successful sign-in (existing Bureau persona/password, OR the
 * canonical wallet-auth path added the same day), the wizard asks this route
 * before deciding whether to continue the Citizen application or short-
 * circuit with "you already hold a Passport" — so a returning holder is never
 * pushed through personhood binding / vault / consents / submit again,
 * regardless of which journey (KNYTS, CI, Horizen, or direct Bureau access)
 * embedded the wizard. T1-safe: only a boolean leaves the server.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { loadUsableCitizenPassportForAuthProfile } from '@/services/identity/passportPrincipal';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const persona = await getActivePersona(req).catch(() => null);
    if (!persona?.authProfileId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }

    const admin = getSupabaseServer();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'Supabase configuration missing' }, { status: 500 });
    }

    const result = await loadUsableCitizenPassportForAuthProfile(admin, persona.authProfileId);
    return NextResponse.json({ ok: true, usable: result.ok });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Usable-status check failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
