/**
 * Control proof for the principal wallet — the step that actually completes
 * provisioning.
 *
 *   POST /api/wallet/principal/control-proof            → issue a fresh nonce
 *   POST /api/wallet/principal/control-proof?verify=1   → recover and compare
 *
 * ── Why a stored envelope is not enough ────────────────────────────────────
 *
 * The wallet-binding trace (#121) found rows carrying a well-formed address
 * with no key behind it, and `keyService.deriveEvmAddress` has a fallback that
 * SHA-256s a private key into a plausible address when ethers fails to load.
 * Both produce records that pass every structural check and can never sign.
 *
 * Recovery is the only check that distinguishes them, because it is the only
 * one that requires the key to exist. `verifyMessage` runs SERVER-side over a
 * nonce this server issued; the client never supplies the recovered address,
 * which would reduce the whole ceremony to taking the client's word.
 *
 * ── Nonce state lives in signing_requests ──────────────────────────────────
 *
 * Not a new table: `signing_requests` already carries `prove_wallet_control`,
 * a `pending → executed` state machine, an expiry, and a DB-level
 * UNIQUE (wallet_ref, nonce) that makes replay a constraint violation rather
 * than a check someone can forget to write.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getActivePersona } from '@/services/identity/getActivePersona';
import {
  createSigningRequest,
  getSigningRequest,
  updateSigningRequest,
  generateSigningNonce,
} from '@/services/signing/signingRequestStore';
import {
  screenProvisioningPayload,
  compareRecoveredAddress,
  provisioningCompletion,
} from '@/services/wallet/principalWalletProvisioning';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PROOF_TTL_SECONDS = 15 * 60;

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

/** The bound principal address, read from the envelope — never from the client. */
async function boundPrincipalAddress(personaId: string): Promise<{ address: string | null; hasKey: boolean }> {
  const { data } = await admin().from('personas').select('evm_key').eq('id', personaId).maybeSingle();
  const env = (data?.evm_key ?? null) as { address?: unknown; encryptedPrivateKey?: unknown } | null;
  return {
    address: typeof env?.address === 'string' ? env.address : null,
    hasKey: typeof env?.encryptedPrivateKey === 'object' || typeof env?.encryptedPrivateKey === 'string',
  };
}

export async function POST(req: NextRequest) {
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  // Screened first, on both branches. The verify branch has no reason to carry
  // a password — but "has no reason to" is not a guarantee, and the point of
  // the screen is to hold when someone's assumption stops being true.
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

  const bound = await boundPrincipalAddress(persona.personaId);
  if (!bound.address || !bound.hasKey) {
    return NextResponse.json(
      {
        ok: false,
        refusal: 'NO_CONFIGURED_SIGNER',
        detail:
          'This persona has no stored envelope with a bound address, so there is nothing to prove control of. ' +
          'Provision a principal wallet first.',
      },
      { status: 409 },
    );
  }

  const verify = req.nextUrl.searchParams.get('verify') === '1';

  // ── Issue ────────────────────────────────────────────────────────────────
  if (!verify) {
    const nonce = generateSigningNonce('principal', 'prove_wallet_control');
    const created = await createSigningRequest({
      actionKind: 'prove_wallet_control',
      signerRole: 'principal',
      principalPersonaId: persona.personaId,
      // Proving control of one's OWN principal wallet has no subject agent and
      // exercises no credential — it is the wallet speaking for itself.
      subjectAgentRef: null,
      subjectAigentQubeId: null,
      authorityCredential: null,
      walletRef: 'principal',
      network: 'base',
      payload: nonce,
      consequence:
        'Proves that this session holds the key for the principal wallet address bound to this persona. ' +
        'Signing this grants no authority and moves no value.',
      nonce,
      expiresInSeconds: PROOF_TTL_SECONDS,
      receiptDestination: 'principal_wallet_control_proven',
    });

    if (!created.ok) {
      return NextResponse.json(
        { ok: false, refusal: created.refusalCode, detail: created.detail },
        { status: 409 },
      );
    }

    return NextResponse.json({
      ok: true,
      requestId: created.record.id,
      nonce,
      boundAddress: bound.address,
      expiresInSeconds: PROOF_TTL_SECONDS,
      // Said explicitly so no client renders the issued nonce as completion.
      stage: 'SIGNER_CONFIGURED',
      complete: false,
    });
  }

  // ── Verify ───────────────────────────────────────────────────────────────
  const b = body as Record<string, unknown>;
  const requestId = typeof b.requestId === 'string' ? b.requestId : '';
  const signature = typeof b.signature === 'string' ? b.signature : '';

  const record = requestId ? await getSigningRequest(requestId) : null;
  if (!record) {
    return NextResponse.json(
      { ok: false, refusal: 'UNKNOWN_PROOF_REQUEST', detail: 'No proof request exists for that id.' },
      { status: 404 },
    );
  }
  if (record.principalPersonaId !== persona.personaId) {
    return NextResponse.json(
      {
        ok: false,
        refusal: 'WRONG_PERSONA',
        detail: 'That proof request belongs to a different persona. A proof cannot be completed on behalf of another.',
      },
      { status: 403 },
    );
  }
  if (record.status !== 'pending') {
    return NextResponse.json(
      {
        ok: false,
        refusal: 'PROOF_REQUEST_ALREADY_RESOLVED',
        detail: `This proof request is already ${record.status}. Issue a fresh nonce rather than replaying one.`,
      },
      { status: 409 },
    );
  }
  if (new Date(record.expiresAt).getTime() <= Date.now()) {
    await updateSigningRequest(requestId, {
      status: 'expired',
      refusalCode: 'PROOF_EXPIRED',
      refusalDetail: 'The nonce expired before a signature was presented.',
    });
    return NextResponse.json(
      {
        ok: false,
        refusal: 'PROOF_EXPIRED',
        detail: 'The nonce expired before a signature was presented. Issue a fresh one — proofs are not durable.',
      },
      { status: 409 },
    );
  }
  if (!signature) {
    return NextResponse.json(
      { ok: false, refusal: 'NO_SIGNATURE', detail: 'No signature was presented, so there is nothing to recover from.' },
      { status: 400 },
    );
  }

  // Recovery happens HERE, over the nonce this server stored — never over a
  // message the client supplies alongside the signature.
  let recovered: string | null = null;
  try {
    const { verifyMessage } = await import('ethers');
    recovered = verifyMessage(record.payload, signature);
  } catch {
    recovered = null;
  }

  const comparison = compareRecoveredAddress(bound.address, recovered);
  if (!comparison.matched) {
    await updateSigningRequest(requestId, {
      status: 'refused',
      refusalCode: comparison.refusal ?? 'ADDRESS_MISMATCH',
      refusalDetail: comparison.detail,
      signature,
      signerAddress: recovered ?? undefined,
    });
    return NextResponse.json(
      { ok: false, refusal: comparison.refusal, detail: comparison.detail },
      { status: 409 },
    );
  }

  await updateSigningRequest(requestId, { status: 'executed', signature, signerAddress: recovered ?? undefined });

  const completion = provisioningCompletion({ envelopeStored: true, addressBound: true, controlProven: true });

  return NextResponse.json({
    ok: true,
    stage: completion.stage,
    complete: completion.complete,
    boundAddress: bound.address,
    detail: comparison.detail,
    receipts: ['principal_wallet_control_proven'],
  });
}
