/**
 * POST /api/wallet/principal/provision
 *
 * Persists a ciphertext envelope and its client-derived address for the ACTIVE
 * operator persona, and supersedes the keyless placeholder that was standing in
 * for a wallet.
 *
 * ── What this route deliberately does NOT do ───────────────────────────────
 *
 * It does not complete provisioning. Storing an envelope establishes
 * SIGNER_CONFIGURED and nothing more — the response says so in as many words,
 * and reports `complete: false`. Completion happens at
 * `/api/wallet/principal/control-proof`, where a fresh nonce is signed locally
 * and the recovered address is compared to the bound one.
 *
 * That split is the whole lesson of the wallet-binding trace (#121): three
 * provisioning paths wrote a well-formed address with no key behind it, and
 * every structural check passed. Only a signature that recovers proves a key.
 *
 * ── What never arrives here ────────────────────────────────────────────────
 *
 * The wallet password, the plaintext private key and the decrypted envelope
 * never leave the browser. `screenProvisioningPayload` REFUSES a request
 * carrying any of them rather than ignoring the extra fields — a server that
 * would quietly accept a key is one that will eventually be handed one.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getActivePersona } from '@/services/identity/getActivePersona';
import {
  screenProvisioningPayload,
  evaluateProvisioningRequest,
  provisioningCompletion,
  supersedePlaceholder,
  hasEncryptedEnvelope,
} from '@/services/wallet/principalWalletProvisioning';
import { migrateAddressToLinkedBinding } from '@/services/wallet/linkedExternalWallet';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

/** Legacy/deployer addresses, read from the one place they already live. */
async function disallowedAddresses(): Promise<Set<string>> {
  const out = new Set<string>();
  try {
    const { agentConfigs } = await import('@/app/data/agentConfig');
    for (const cfg of Object.values(agentConfigs ?? {})) {
      const a = (cfg as { walletAddresses?: { evmAddress?: unknown } })?.walletAddresses?.evmAddress;
      if (typeof a === 'string') out.add(a.toLowerCase());
    }
  } catch {
    // An unreadable legacy set must not read as "nothing is disallowed".
    // Provisioning is refused below rather than proceeding blind.
    return new Set(['*unreadable*']);
  }
  return out;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, refusal: 'MALFORMED_BODY', detail: 'Body is not valid JSON.' }, { status: 400 });
  }

  // FIRST, before anything else touches the payload: refuse secrets. Screening
  // after authentication would mean a plaintext key had already been parsed,
  // logged by any middleware in the path, and held in memory server-side.
  const screened = screenProvisioningPayload(body);
  if (!screened.permitted) {
    return NextResponse.json({ ok: false, refusal: screened.refusal, detail: screened.detail }, { status: 400 });
  }

  const persona = await getActivePersona(req);
  if (!persona) {
    return NextResponse.json(
      { ok: false, refusal: 'NOT_AUTHENTICATED', detail: 'No active persona could be resolved for this caller.' },
      { status: 401 },
    );
  }

  const b = body as Record<string, unknown>;
  const subjectPersonaId = typeof b.subjectPersonaId === 'string' ? b.subjectPersonaId : '';
  const derivedAddress = typeof b.derivedAddress === 'string' ? b.derivedAddress : '';
  const requestId = typeof b.requestId === 'string' ? b.requestId : '';
  const envelope = b.encryptedEnvelope;
  const publicKey = typeof b.publicKey === 'string' ? b.publicKey : null;

  const sb = admin();

  const { data: row, error: readErr } = await sb
    .from('personas')
    .select('id, evm_address, evm_key')
    .eq('id', persona.personaId)
    .maybeSingle();
  if (readErr) {
    return NextResponse.json(
      { ok: false, refusal: 'UNAVAILABLE', detail: `The persona record could not be read (${readErr.message}).` },
      { status: 503 },
    );
  }

  const existingEnvelope = (row?.evm_key ?? null) as { address?: unknown; encryptedPrivateKey?: unknown } | null;
  // ONE predicate, shared with the classifier and the control-proof route.
  const existingHasKey = hasEncryptedEnvelope(row?.evm_key);
  const placeholderAddress = typeof existingEnvelope?.address === 'string' ? existingEnvelope.address : null;

  // A prior control proof is what makes an existing signer VERIFIED. Absent
  // one, a configured-but-unproven signer is exactly what this ceremony exists
  // to replace, so it must not block itself.
  const { data: proofRow } = await sb
    .from('signing_requests')
    .select('id')
    .eq('principal_persona_id', persona.personaId)
    .eq('wallet_ref', 'principal')
    .eq('action_kind', 'prove_wallet_control')
    .eq('status', 'executed')
    .limit(1);

  const { data: consumed } = await sb
    .from('signing_requests')
    .select('nonce')
    .eq('principal_persona_id', persona.personaId)
    .eq('wallet_ref', 'principal')
    .eq('action_kind', 'prove_wallet_control');

  /*
   * The body NAMES the persona the surface believes it is repairing. If the
   * spine resolved a different one, provisioning here would write a wallet
   * onto a persona the operator was not looking at — and report success.
   * `subjectPersonaId || persona.personaId` would have masked exactly that by
   * substituting the server's answer for the client's question.
   */
  const decision = evaluateProvisioningRequest({
    subjectPersonaId: subjectPersonaId || persona.personaId,
    callerPersonaId: persona.personaId,
    // The spine's resolved persona IS the active one; a body that names another
    // is caught by WRONG_PERSONA above it.
    activePersonaId: persona.personaId,
    derivedAddress,
    envelopePresent: typeof envelope === 'object' && envelope !== null,
    requestId,
    consumedRequestIds: (consumed ?? []).map((r) => String((r as { nonce: unknown }).nonce)),
    disallowedAddresses: await disallowedAddresses(),
    existingSignerVerified: existingHasKey && (proofRow?.length ?? 0) > 0,
    // The load-bearing recovery guard (operator, 2026-08-02): an envelope that
    // exists but was never proven must NOT be replaced by a second keypair.
    // The remaining step is a proof, not a new wallet.
    existingEnvelopePresent: existingHasKey,
  });

  if (!decision.permitted) {
    return NextResponse.json({ ok: false, refusal: decision.refusal, detail: decision.detail }, { status: 409 });
  }

  // ── Preserve the external address BEFORE overwriting the principal field ──
  // The column currently holds a real external wallet (the passport-mint
  // write). Writing the new principal address over it without first recording
  // the binding would destroy the only record that the relationship existed.
  let linkedMigrated: string | null = null;
  const externalAddress = typeof row?.evm_address === 'string' ? row.evm_address : null;
  if (externalAddress && /^0x[0-9a-fA-F]{40}$/.test(externalAddress)) {
    const binding = migrateAddressToLinkedBinding({
      id: `lew_${persona.personaId}_${externalAddress.toLowerCase().slice(2, 14)}`,
      subjectPersonaId: persona.personaId,
      provider: 'metamask',
      chain: 'evm',
      address: externalAddress,
      originatingWritePath: 'passport-mint-route',
      createdAt: new Date().toISOString(),
    });
    const { error: linkErr } = await sb.from('linked_external_wallets').upsert(
      {
        id: binding.id,
        subject_persona_id: binding.subjectPersonaId,
        wallet_type: binding.walletType,
        provider: binding.provider,
        chain: binding.chain,
        address: binding.address,
        control_status: binding.controlStatus,
        proof_ref: binding.proofRef,
        proven_at: binding.provenAt,
        authority_role: binding.authorityRole,
        may_sign_principal_mandate: binding.maySignPrincipalMandate,
        originating_write_path: binding.originatingWritePath,
        created_at: binding.createdAt,
      },
      { onConflict: 'id' },
    );
    if (linkErr) {
      // Refuse rather than proceed: losing the external binding is the one
      // outcome this ceremony must not produce.
      return NextResponse.json(
        {
          ok: false,
          refusal: 'EXTERNAL_BINDING_NOT_PRESERVED',
          detail:
            `The linked external wallet could not be recorded (${linkErr.message}), so the principal field ` +
            'was left untouched. Preserving the external relationship is a precondition, not a side effect.',
        },
        { status: 503 },
      );
    }
    linkedMigrated = binding.address;
  }

  const superseded = placeholderAddress
    ? supersedePlaceholder({
        placeholderAddress,
        newPrincipalAddress: derivedAddress,
        supersededAt: new Date().toISOString(),
      })
    : null;

  const { error: writeErr } = await sb
    .from('personas')
    .update({
      evm_address: derivedAddress,
      evm_key: {
        address: derivedAddress,
        publicKey,
        encryptedPrivateKey: envelope,
        keySource: 'generated',
        createdAt: new Date().toISOString(),
        // Retained, never deleted: an absent placeholder reads as "this never
        // happened"; a superseded one reads as "this happened and was handled".
        supersededPlaceholder: superseded,
      },
    })
    .eq('id', persona.personaId);

  if (writeErr) {
    return NextResponse.json(
      { ok: false, refusal: 'UNAVAILABLE', detail: `The wallet envelope could not be persisted (${writeErr.message}).` },
      { status: 503 },
    );
  }

  const completion = provisioningCompletion({ envelopeStored: true, addressBound: true, controlProven: false });

  return NextResponse.json({
    ok: true,
    stage: completion.stage,
    complete: completion.complete,
    outstanding: completion.outstanding,
    boundAddress: derivedAddress,
    linkedExternalWallet: linkedMigrated
      ? { address: linkedMigrated, controlStatus: 'unproven', authorityRole: 'execution_instrument' }
      : null,
    supersededPlaceholder: superseded,
    receipts: ['external_wallet_binding_migrated', 'address_only_placeholder_superseded', 'principal_wallet_provisioned'],
  });
}
