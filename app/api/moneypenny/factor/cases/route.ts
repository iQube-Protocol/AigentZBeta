/**
 * POST /api/moneypenny/factor/cases — Factor 0.1 Journey A steps 1-3
 * (PRD §6.1). Creates a new candidate case, or resumes the existing one
 * for the same (tenant, candidateIdentityKey) pair — never a duplicate.
 *
 * Server-side only, service-role Supabase client (factor_cases RLS is
 * service_role-only). The caller's own persona (from the spine) becomes
 * both `ownerPersonaId` and `createdByPersonaId` unless the request body
 * explicitly names a different owner — the common case is a persona
 * opening a case on their own behalf.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { createOrResumeCase } from '@/services/factor/factorCaseService';
import { respondError, resolveTenantId } from '../_lib/respondError';

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

  const candidateIdentityKey = typeof body.candidateIdentityKey === 'string' ? body.candidateIdentityKey : null;
  const candidateDisplayName = typeof body.candidateDisplayName === 'string' ? body.candidateDisplayName : null;
  if (!candidateIdentityKey || !candidateDisplayName) {
    return NextResponse.json({ ok: false, error: 'missing-required-field', detail: 'candidateIdentityKey and candidateDisplayName are required.' }, { status: 400 });
  }

  try {
    const result = await createOrResumeCase(admin, {
      tenantId: resolveTenantId(body.tenantId),
      ownerPersonaId: typeof body.ownerPersonaId === 'string' ? body.ownerPersonaId : persona.personaId,
      createdByPersonaId: persona.personaId,
      candidateIdentityKey,
      candidateDisplayName,
      candidateAgentRootDid: typeof body.candidateAgentRootDid === 'string' ? body.candidateAgentRootDid : null,
      source: body.source === 'marketa_referral' || body.source === 'registry_import' ? body.source : 'operator',
      referralProvenance: typeof body.referralProvenance === 'object' && body.referralProvenance !== null ? (body.referralProvenance as Record<string, unknown>) : undefined,
      declaredCapabilities: Array.isArray(body.declaredCapabilities) ? body.declaredCapabilities : undefined,
      declaredEndpoints: Array.isArray(body.declaredEndpoints) ? body.declaredEndpoints : undefined,
      requestedServices: Array.isArray(body.requestedServices) ? body.requestedServices : undefined,
      requestedJurisdictions: Array.isArray(body.requestedJurisdictions) ? body.requestedJurisdictions : undefined,
      pathway: body.pathway === 'full_horizon' ? 'full_horizon' : 'registry_only',
      idempotencyKey: typeof body.idempotencyKey === 'string' ? body.idempotencyKey : undefined,
    });
    return NextResponse.json({ ok: true, case: result.case, created: result.created });
  } catch (err) {
    return respondError(err);
  }
}
