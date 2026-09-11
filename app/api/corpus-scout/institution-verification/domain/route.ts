/**
 * /api/corpus-scout/institution-verification/domain — verify EVERY registry
 * entry in one domain, sequentially (SPEC-CIR-001 §9). One action for a whole
 * registry, mirroring `/api/corpus-scout/institution-discovery/domain`.
 *
 * POST { domain } → `verifyDomainRegistry`.
 *
 * This is the call the operator runs on the deployed app before ratification —
 * both for `commercialisation` (28 wave-1 + 10 wave-2 entries) and for
 * `financial-services`, whose nineteen entries have never been verified and
 * whose discovery now refuses until they are.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { verifyDomainRegistry } from '@/services/corpusScout/registryVerification';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) return NextResponse.json({ ok: false, error: 'Steward access required' }, { status: 403 });
  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 500 });

  const domain = ((await req.json().catch(() => ({}))) as { domain?: string }).domain?.trim();
  if (!domain) return NextResponse.json({ ok: false, error: 'domain is required' }, { status: 400 });

  const result = await verifyDomainRegistry(admin, domain);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
