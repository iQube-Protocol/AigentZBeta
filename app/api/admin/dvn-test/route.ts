/**
 * GET /api/admin/dvn-test
 *
 * Admin-only DVN diagnostic. Reports env-var presence + identity status
 * + attempts a real submit_dvn_message call with a synthetic payload so
 * the operator can see exactly why CTA receipts are landing in
 * dvn_failed. Returns the canister's raw response (or the error) in the
 * HTTP body — no need for CloudWatch access to diagnose.
 *
 * Never submits anything that could be confused with a real receipt:
 * the payload's `action` is 'DVN_SELFTEST' and the receiptId is
 * timestamped + clearly marked. The message id includes 'selftest_' so
 * the canister-side message can be filtered out by the finalizer.
 *
 * NEVER writes to activity_receipts — purely a probe of the submission
 * path.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { getActor } from '@/services/ops/icAgent';
import { idlFactory as dvnIdl } from '@/services/ops/idl/cross_chain_service';
import { normalizePem, isPemLike } from '@/services/ops/pemNormalizer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface DvnDiagnostic {
  env: {
    canisterIdConfigured: boolean;
    canisterIdSource: 'CROSS_CHAIN_SERVICE_CANISTER_ID' | 'NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID' | null;
    canisterIdPrefix: string | null;
    dfxNetwork: string;
    dfxIdentityPemPresent: boolean;
    dfxIdentityPemSource: 'DFX_IDENTITY_PEM' | 'NEXT_PUBLIC_DFX_IDENTITY_PEM' | 'DFX_IDENTITY_PEM_PATH' | null;
  };
  identity: {
    type: 'ed25519' | 'secp256k1' | 'anonymous';
    principalHint: string | null;
  };
  submission: {
    attempted: boolean;
    ok: boolean;
    durationMs: number;
    canisterMessageId: string | null;
    rawResponse: unknown;
    rawResponseType: string;
    error: string | null;
  };
}

const DVN_CALL_TIMEOUT_MS = 15_000;

async function detectIdentity(): Promise<DvnDiagnostic['identity']> {
  const pem = normalizePem(process.env.DFX_IDENTITY_PEM || process.env.NEXT_PUBLIC_DFX_IDENTITY_PEM);
  if (!isPemLike(pem)) {
    return { type: 'anonymous', principalHint: null };
  }
  try {
    const idMod = await import('@dfinity/identity');
    const ed = idMod.Ed25519KeyIdentity?.fromPem;
    if (ed) {
      try {
        const id = ed(pem);
        const principal = id.getPrincipal().toText();
        return { type: 'ed25519', principalHint: principal };
      } catch { /* try next */ }
    }
    const sk = idMod.Secp256k1KeyIdentity?.fromPem;
    if (sk) {
      try {
        const id = sk(pem);
        const principal = id.getPrincipal().toText();
        return { type: 'secp256k1', principalHint: principal };
      } catch { /* fallthrough */ }
    }
  } catch {
    /* identity module unavailable */
  }
  return { type: 'anonymous', principalHint: null };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) {
    return NextResponse.json(
      { error: 'unauthenticated' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  if (!context.cartridgeFlags?.isAdmin) {
    return NextResponse.json(
      { error: 'forbidden', detail: 'Admin-only diagnostic.' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // Env presence (no values leaked).
  const canisterId =
    process.env.CROSS_CHAIN_SERVICE_CANISTER_ID ||
    process.env.NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID;
  const canisterIdSource = process.env.CROSS_CHAIN_SERVICE_CANISTER_ID
    ? ('CROSS_CHAIN_SERVICE_CANISTER_ID' as const)
    : process.env.NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID
      ? ('NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID' as const)
      : null;
  const pemSource = process.env.DFX_IDENTITY_PEM
    ? ('DFX_IDENTITY_PEM' as const)
    : process.env.NEXT_PUBLIC_DFX_IDENTITY_PEM
      ? ('NEXT_PUBLIC_DFX_IDENTITY_PEM' as const)
      : process.env.DFX_IDENTITY_PEM_PATH
        ? ('DFX_IDENTITY_PEM_PATH' as const)
        : null;

  const identity = await detectIdentity();

  const diag: DvnDiagnostic = {
    env: {
      canisterIdConfigured: !!canisterId,
      canisterIdSource,
      canisterIdPrefix: canisterId ? `${canisterId.slice(0, 8)}…` : null,
      dfxNetwork: process.env.DFX_NETWORK || 'ic',
      dfxIdentityPemPresent: pemSource !== null,
      dfxIdentityPemSource: pemSource,
    },
    identity,
    submission: {
      attempted: false,
      ok: false,
      durationMs: 0,
      canisterMessageId: null,
      rawResponse: null,
      rawResponseType: 'undefined',
      error: null,
    },
  };

  if (!canisterId) {
    diag.submission.error = 'CROSS_CHAIN_SERVICE_CANISTER_ID not configured — submission skipped';
    return NextResponse.json(diag, { headers: { 'Cache-Control': 'no-store' } });
  }

  // Attempt a real submission with a synthetic payload.
  const submissionStart = Date.now();
  diag.submission.attempted = true;
  try {
    const dvn = await getActor<{
      submit_dvn_message: (a: number, b: number, payload: number[], id: string) => Promise<unknown>;
    }>(canisterId, dvnIdl);

    const payload = JSON.stringify({
      action: 'DVN_SELFTEST',
      receiptId: `selftest_${Date.now()}`,
      note: 'Synthetic payload from /api/admin/dvn-test — safe to ignore on chain',
      timestamp: Date.now(),
    });
    const payloadBytes = Array.from(new TextEncoder().encode(payload));
    const messageId = `selftest_${Date.now()}`;

    const response = await Promise.race([
      dvn.submit_dvn_message(0, 0, payloadBytes, messageId),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Canister call timed out after ${DVN_CALL_TIMEOUT_MS}ms`)),
          DVN_CALL_TIMEOUT_MS,
        ),
      ),
    ]);

    diag.submission.durationMs = Date.now() - submissionStart;
    diag.submission.rawResponse = response;
    diag.submission.rawResponseType = typeof response;

    if (typeof response === 'string') {
      diag.submission.ok = true;
      diag.submission.canisterMessageId = response;
    } else if (response && typeof response === 'object') {
      const r = response as Record<string, unknown>;
      if ('Ok' in r && typeof r.Ok === 'string') {
        diag.submission.ok = true;
        diag.submission.canisterMessageId = r.Ok;
      } else if ('Err' in r && typeof r.Err === 'string') {
        diag.submission.ok = false;
        diag.submission.error = `Canister Err variant: ${r.Err}`;
      } else {
        diag.submission.ok = false;
        diag.submission.error = `Unexpected response shape — keys: [${Object.keys(r).join(', ')}]`;
      }
    } else {
      diag.submission.ok = false;
      diag.submission.error = `Unexpected response type: ${typeof response}`;
    }
  } catch (err) {
    diag.submission.durationMs = Date.now() - submissionStart;
    diag.submission.ok = false;
    diag.submission.error = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json(diag, {
    status: diag.submission.ok ? 200 : 502,
    headers: { 'Cache-Control': 'no-store' },
  });
}
