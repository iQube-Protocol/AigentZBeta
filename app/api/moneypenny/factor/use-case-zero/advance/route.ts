/**
 * POST /api/moneypenny/factor/use-case-zero/advance — the real HTTP surface
 * behind `constitutional_financial_agent_establishment:advance`
 * (services/factor/factorCapabilityManifest.ts).
 *
 * Runs services/factor/useCaseZeroOrchestrator.ts::advanceUseCaseZero — ONE
 * resumable step per call. Never chains across a human approval boundary;
 * never submits/signs/broadcasts/moves funds (see that file's own header).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { advanceUseCaseZero } from '@/services/factor/useCaseZeroOrchestrator';
import { resolveRequestOrigin } from '@/app/api/agents/_lib/requestOrigin';
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
  // Item 2 (2026-09-07): threaded through unmodified, never inferred here.
  const journeyProfile = body.journeyProfile === 'financial_intelligence' ? 'financial_intelligence' as const : undefined;
  const launchSpec =
    body.launchSpec && typeof body.launchSpec === 'object'
      ? (body.launchSpec as { chain: string; tokenName: string; tokenSymbol: string; description?: string })
      : undefined;
  // Agent-genesis fields (agentShell step, 'create_and_establish' path) —
  // Factor never invents a sponsoring passport/display name/description
  // (same manifest boundary as launchSpec). `origin` defaults to this
  // request's own origin when the caller omits it, mirroring
  // /api/agents/genesis's existing resolveRequestOrigin usage.
  const agentGenesisBody = body.agentGenesis && typeof body.agentGenesis === 'object' ? (body.agentGenesis as Record<string, unknown>) : null;
  const agentGenesis = agentGenesisBody
    ? {
        sponsorPassportId: typeof agentGenesisBody.sponsorPassportId === 'string' ? agentGenesisBody.sponsorPassportId : '',
        displayName: typeof agentGenesisBody.displayName === 'string' ? agentGenesisBody.displayName : '',
        description: typeof agentGenesisBody.description === 'string' ? agentGenesisBody.description : '',
        origin: typeof agentGenesisBody.origin === 'string' && agentGenesisBody.origin ? agentGenesisBody.origin : resolveRequestOrigin(req),
      }
    : undefined;

  try {
    const result = await advanceUseCaseZero({
      admin,
      tenantId,
      actorPersonaId: persona.personaId,
      agentSlug,
      path,
      caseId,
      journeyProfile,
      launchSpec,
      agentGenesis,
    });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return respondError(err);
  }
}
