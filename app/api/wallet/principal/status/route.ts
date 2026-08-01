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
  const { data: row } = await sb
    .from('personas')
    .select('evm_key, display_name, fio_handle')
    .eq('id', persona.personaId)
    .maybeSingle();
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

  /*
   * DID THE SERVER RESOLVE THE PERSONA THE CALLER MEANT? (2026-08-02)
   *
   * A console call with no hint and a panel call with one can resolve DIFFERENT
   * personas — `getActivePersona` falls back to "first owned" when nothing
   * pins it. That produced two contradictory readings of the same operator's
   * wallet within minutes: AMBIGUOUS in the panel, ABSENT from the console.
   *
   * Neither read was wrong about the row it looked at. Both were silent about
   * WHICH row, which is what made them look like a contradiction instead of a
   * question. So the answer now says whether it is about the persona the
   * caller asked for.
   *
   * The raw id is never echoed — T0. A boolean is enough to know whether to
   * trust the answer, and a mismatch is reported rather than resolved here:
   * quietly switching to the hinted persona would hide a real ambiguity about
   * which persona is active.
   */
  const requestedPersonaId = req.nextUrl.searchParams.get('personaId');
  const personaHintHonoured = requestedPersonaId ? requestedPersonaId === persona.personaId : null;

  return NextResponse.json({
    ok: true,
    personaHintHonoured,
    /*
     * WHO this answer is about (2026-08-02).
     *
     * The wallet selects a persona by default when nothing pins one, and the
     * surface never said WHICH persona its answer was about. Two reads minutes
     * apart reported AMBIGUOUS and ABSENT and looked like a contradiction;
     * they were about different personas, and nothing on screen could have
     * told the operator that.
     *
     * A T1 display label only — never the persona id (T0), and never a
     * delegate flag inferred from this table: `is_aigent_me` lives on
     * `agent_root_identity`, and selecting it here would error the whole route
     * into REFUSED, breaking the surface to add a hint.
     */
    personaLabel:
      (row as { display_name?: string; fio_handle?: string } | null)?.display_name ??
      (row as { fio_handle?: string } | null)?.fio_handle ??
      null,

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
