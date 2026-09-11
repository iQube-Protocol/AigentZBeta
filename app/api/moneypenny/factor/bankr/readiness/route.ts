/**
 * POST /api/moneypenny/factor/bankr/readiness — Factor + Aegis Bankr PRD
 * Phase 6: the real HTTP surface behind `bankr_tokenization:assess_readiness`
 * and `bankr_tokenization:inspect_binding` (services/factor/
 * factorCapabilityManifest.ts). Both are read/prepare-only, never Bankr
 * write calls — this route composes `assessIssuerReadiness` and, only when
 * the caller explicitly opts in via `action: 'provision_binding'`,
 * `inspectOrProvisionProviderBinding` (idempotent) before re-assessing.
 *
 * Never invents Factor's canonical MetaMe addresses — those come from the
 * existing agent-purpose-wallet service via `inspectOrProvisionProviderBinding`,
 * unchanged from Phase 3.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { assessIssuerReadiness, inspectOrProvisionProviderBinding } from '@/services/factor/bankrCapabilityHandlers';
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

  const beneficiaryAgentRuntimeId = typeof body.beneficiaryAgentRuntimeId === 'string' ? body.beneficiaryAgentRuntimeId : null;
  if (!beneficiaryAgentRuntimeId) {
    return NextResponse.json({ ok: false, error: 'missing-required-field', detail: 'beneficiaryAgentRuntimeId is required.' }, { status: 400 });
  }
  const tenantId = resolveTenantId(body.tenantId);

  try {
    if (body.action === 'provision_binding') {
      const binding = await inspectOrProvisionProviderBinding(admin, tenantId, beneficiaryAgentRuntimeId, persona.personaId);
      const readiness = await assessIssuerReadiness(admin, tenantId, beneficiaryAgentRuntimeId);
      return NextResponse.json({ ok: true, readiness, binding });
    }
    const readiness = await assessIssuerReadiness(admin, tenantId, beneficiaryAgentRuntimeId);
    return NextResponse.json({ ok: true, readiness });
  } catch (err) {
    return respondError(err);
  }
}
