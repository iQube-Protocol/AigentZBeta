/**
 * GET /api/wallet/principal/status
 *
 * What the caller's OWN principal wallet can do, and what repair (if any) is
 * outstanding. Owner self-view only — the spine resolves the persona and the
 * route never accepts one from the query string.
 *
 * ── Why a route rather than deriving it in the drawer ──────────────────────
 *
 * `classifyPersonaWalletCapability` reads `personas.evm_key`, which holds key
 * material and must never reach the browser. The drawer needs the CAPABILITY
 * — "can this wallet sign" — not the envelope that answers it. So the answer
 * is computed server-side and only the verdict crosses.
 *
 * ── Control proof is read, never assumed ───────────────────────────────────
 *
 * A configured signer whose control was never proven is exactly what the
 * provisioning ceremony exists to finish, so `controlProven` is read from an
 * executed `prove_wallet_control` request rather than inferred from the
 * envelope's existence. Inferring it would collapse SIGNER_CONFIGURED and
 * CONTROL_PROVEN back into one state.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { classifyPersonaWalletCapability } from '@/services/identity/personaAddressResolver';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

export async function GET(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona) {
    return NextResponse.json(
      { ok: false, refusal: 'NOT_AUTHENTICATED', detail: 'No active persona could be resolved for this caller.' },
      { status: 401 },
    );
  }

  const capability = await classifyPersonaWalletCapability(persona.personaId, 'base');
  const sb = admin();

  // The placeholder that a prior repair superseded, if one did. Read from the
  // envelope's audit field — preserved deliberately, never deleted.
  const { data: row } = await sb.from('personas').select('evm_key').eq('id', persona.personaId).maybeSingle();
  const env = (row?.evm_key ?? null) as { supersededPlaceholder?: unknown } | null;
  const supersededPlaceholder = (env?.supersededPlaceholder ?? null) as Record<string, unknown> | null;

  const { data: proofRows } = await sb
    .from('signing_requests')
    .select('id, resolved_at, signer_address')
    .eq('principal_persona_id', persona.personaId)
    .eq('wallet_ref', 'principal')
    .eq('action_kind', 'prove_wallet_control')
    .eq('status', 'executed')
    .order('resolved_at', { ascending: false })
    .limit(1);

  const proof = proofRows?.[0] ?? null;

  const { data: linked } = await sb
    .from('linked_external_wallets')
    .select('address, provider, control_status, authority_role, may_sign_principal_mandate')
    .eq('subject_persona_id', persona.personaId);

  return NextResponse.json({
    ok: true,
    capability: capability.capability,
    address: capability.address,
    detail: capability.detail,
    remediation: capability.remediation,
    // Never inferred from the envelope — see the header.
    controlProven: Boolean(proof),
    controlProvenAt: proof ? (proof as { resolved_at: string }).resolved_at : null,
    supersededPlaceholder,
    linkedExternalWallets: (linked ?? []).map((w) => ({
      address: (w as { address: string }).address,
      provider: (w as { provider: string }).provider,
      controlStatus: (w as { control_status: string }).control_status,
      authorityRole: (w as { authority_role: string }).authority_role,
      maySignPrincipalMandate: (w as { may_sign_principal_mandate: boolean }).may_sign_principal_mandate,
    })),
  });
}
