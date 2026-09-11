/**
 * /api/corpus-scout/institution-verification — registry-level verification
 * (SPEC-CIR-001 §9, operator ruling 2026-07-27). Admin-gated, mirroring
 * `/api/corpus-scout/institution-discovery`'s auth pattern exactly.
 *
 * POST { domain, pillarKey, institutionName } → `verifyInstitutionEntry`:
 * moves the entry to `pending_verification`, then runs all four conjuncts
 * against its seed URL —
 *
 *     institution URL resolves
 *       + document candidates discovered
 *       + at least one document passes the Corpus Qualification Standard
 *       + retrieved bytes and inspection result are recorded
 *
 * — and records the outcome. A 200 response is NOT verification; an
 * institution whose homepage loads but yields nothing acquirable comes back
 * `insufficient_corpus`, which does not open the discovery gate.
 *
 * For a whole registry in one call, see
 * `POST /api/corpus-scout/institution-verification/domain`.
 *
 * This route can only ever produce a verification OUTCOME. It cannot assert
 * one: `applyVerificationOutcome` refuses any transition to `verified` that
 * does not come from a completed run.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { verifyInstitutionEntry } from '@/services/corpusScout/registryVerification';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) return NextResponse.json({ ok: false, error: 'Steward access required' }, { status: 403 });
  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 500 });

  const body = (await req.json().catch(() => ({}))) as {
    domain?: string;
    pillarKey?: string;
    institutionName?: string;
  };
  const domain = body.domain?.trim();
  const pillarKey = body.pillarKey?.trim();
  const institutionName = body.institutionName?.trim();
  if (!domain || !pillarKey || !institutionName) {
    return NextResponse.json({ ok: false, error: 'domain, pillarKey, and institutionName are required' }, { status: 400 });
  }

  const result = await verifyInstitutionEntry(admin, { domain, pillarKey, institutionName });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
