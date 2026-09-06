/**
 * POST /api/moneypenny/factor/bankr/launches — Factor + Aegis Bankr PRD
 * Phase 6: the real HTTP surface behind `bankr_tokenization:prepare_launch`
 * (services/factor/factorCapabilityManifest.ts). Creates a draft
 * token_launches row and immediately advances it to 'preparing'
 * (services/factor/bankrCapabilityHandlers.ts's prepareLaunchProposal).
 *
 * Never invents token_name/token_symbol/chain/etc — every spec field here
 * is exactly what the caller supplied in the request body (Phase 5's own
 * constraint: an operator form/capsule decides these, never Factor).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { prepareLaunchProposal } from '@/services/factor/bankrCapabilityHandlers';
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
  const preparingAgentRuntimeId = typeof body.preparingAgentRuntimeId === 'string' ? body.preparingAgentRuntimeId : null;
  const chain = typeof body.chain === 'string' ? body.chain : null;
  const tokenName = typeof body.tokenName === 'string' ? body.tokenName : null;
  const tokenSymbol = typeof body.tokenSymbol === 'string' ? body.tokenSymbol : null;
  if (!beneficiaryAgentRuntimeId || !preparingAgentRuntimeId || !chain || !tokenName || !tokenSymbol) {
    return NextResponse.json(
      { ok: false, error: 'missing-required-field', detail: 'beneficiaryAgentRuntimeId, preparingAgentRuntimeId, chain, tokenName and tokenSymbol are required.' },
      { status: 400 },
    );
  }

  try {
    const launch = await prepareLaunchProposal(admin, {
      tenantId: resolveTenantId(body.tenantId),
      beneficiaryAgentRuntimeId,
      requestingPrincipalPersonaId: typeof body.requestingPrincipalPersonaId === 'string' ? body.requestingPrincipalPersonaId : persona.personaId,
      preparingAgentRuntimeId,
      providerWalletBindingId: typeof body.providerWalletBindingId === 'string' ? body.providerWalletBindingId : null,
      chain,
      tokenName,
      tokenSymbol,
      description: typeof body.description === 'string' ? body.description : null,
      utilityClaims: Array.isArray(body.utilityClaims) ? body.utilityClaims : undefined,
      imageUrl: typeof body.imageUrl === 'string' ? body.imageUrl : null,
      metadataUrl: typeof body.metadataUrl === 'string' ? body.metadataUrl : null,
      websiteUrl: typeof body.websiteUrl === 'string' ? body.websiteUrl : null,
      socialRefs: Array.isArray(body.socialRefs) ? body.socialRefs : undefined,
      feeRecipient: typeof body.feeRecipient === 'string' ? body.feeRecipient : null,
      pairedAsset: typeof body.pairedAsset === 'string' ? body.pairedAsset : null,
      vestingConfig: typeof body.vestingConfig === 'object' && body.vestingConfig !== null ? (body.vestingConfig as Record<string, unknown>) : null,
      conflictDisclosures: Array.isArray(body.conflictDisclosures) ? body.conflictDisclosures : undefined,
      riskDisclosures: Array.isArray(body.riskDisclosures) ? body.riskDisclosures : undefined,
    });
    return NextResponse.json({ ok: true, launch });
  } catch (err) {
    return respondError(err);
  }
}
