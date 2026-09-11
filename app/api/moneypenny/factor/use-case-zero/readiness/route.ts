/**
 * POST /api/moneypenny/factor/use-case-zero/readiness — the real HTTP
 * surface behind `constitutional_financial_agent_establishment:bring_own_agent`
 * and `:create_and_establish` (services/factor/factorCapabilityManifest.ts).
 *
 * READ-ONLY — runs services/factor/useCaseZeroCapabilityHandlers.ts's
 * assessment functions, which compose services/factor/
 * useCaseZeroReadinessProjection.ts. Never creates, provisions, or mutates
 * anything (see the manifest's own 2026-09-06 correction note).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { assessBringOwnAgentReadiness, assessCreateAndEstablishReadiness } from '@/services/factor/useCaseZeroCapabilityHandlers';
import { respondError, resolveTenantId } from '../../_lib/respondError';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'not-authenticated' }, { status: 401 });
  }
  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'supabase-unavailable' }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid-json' }, { status: 400 });
  }

  const agentSlug = typeof body.agentSlug === 'string' ? body.agentSlug : null;
  if (!agentSlug) {
    return NextResponse.json({ ok: false, error: 'missing-required-field', detail: 'agentSlug is required.' }, { status: 400 });
  }
  const path = body.path === 'create_and_establish' ? 'create_and_establish' : 'bring_own_agent';
  const caseId = typeof body.caseId === 'string' ? body.caseId : undefined;
  const tenantId = resolveTenantId(body.tenantId);
  // Item 2 (2026-09-07): an explicit operator choice, never inferred —
  // anything other than the literal 'financial_intelligence' leaves the
  // projection's own default (optional Pulse/P&L) untouched.
  const journeyProfile = body.journeyProfile === 'financial_intelligence' ? 'financial_intelligence' as const : undefined;

  try {
    const input = { admin, tenantId, actorPersonaId: persona.personaId, agentSlug, caseId, journeyProfile };
    const readiness = path === 'create_and_establish' ? await assessCreateAndEstablishReadiness(input) : await assessBringOwnAgentReadiness(input);
    return NextResponse.json({ ok: true, readiness });
  } catch (err) {
    return respondError(err);
  }
}
