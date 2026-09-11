/**
 * GET /api/passport/steward-status — the active persona's steward standing.
 *
 * Composes subscription steward (Tier 2 / stewardAccess) + bureau steward
 * (Polity Passport Bureau cartridge admin) into one authoritative answer, and
 * best-effort reflects the role onto the citizen privileges row.
 *
 * T1-safe: returns booleans + a role label only. No T0 identifiers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { resolveStewardStatus, syncStewardRole } from '@/services/passport/stewardPrivileges';
import { PASSPORT_BUREAU_CARTRIDGE_SLUG } from '@/services/passport/issuanceService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }
  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'database unavailable' }, { status: 503 });
  }

  // Bureau steward = global admin OR holds the passport-bureau cartridge admin
  // grant. Resolved server-side by the spine; we never re-derive grants here.
  const flags = persona.cartridgeFlags;
  const bureauSteward =
    !!flags?.isAdmin || (Array.isArray(flags?.adminCartridges) && flags.adminCartridges.includes(PASSPORT_BUREAU_CARTRIDGE_SLUG));

  const status = await resolveStewardStatus(admin, persona.personaId, bureauSteward);

  // Reflect onto the privileges row so other surfaces can read it directly.
  await syncStewardRole(admin, persona.personaId, status.role).catch(() => undefined);

  return NextResponse.json({ ok: true, ...status });
}
