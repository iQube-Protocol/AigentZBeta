/**
 * POST /api/ops/canisters/top-up
 *
 * Sends cycles from the server's wallet canister to a target canister.
 * Programmatic equivalent of `dfx wallet --network ic send <canisterId> <amount>`.
 *
 * Body: { canisterId: string, cycles: number }
 *   - canisterId: target canister to receive cycles
 *   - cycles: number of cycles to send (e.g. 1_000_000_000_000 for 1T)
 *
 * Requires:
 *   - Admin persona (cartridgeFlags.isAdmin)
 *   - DFX_IDENTITY_PEM configured on the server
 *   - Server identity must be a controller of the wallet canister
 *
 * Admin-gated via getActivePersona.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { HttpAgent, Actor } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import fetch from 'cross-fetch';
import { normalizePem, isPemLike } from '@/services/ops/pemNormalizer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_TARGETS: Record<string, string> = {
  'sp5ye-2qaaa-aaaao-qkqla-cai': 'DVN',
  'zdjf3-2qaaa-aaaas-qck4q-cai': 'RQH',
  'lvo2w-jqaaa-aaaas-qc2wa-cai': 'RewardHub',
};

const MAX_CYCLES_PER_SEND = 5_000_000_000_000;
const MIN_CYCLES_PER_SEND = 100_000_000;
const SEND_TIMEOUT_MS = 30_000;

const walletIdl = ({ IDL }: any) => {
  const SendResult = IDL.Variant({
    Ok: IDL.Null,
    Err: IDL.Text,
  });
  return IDL.Service({
    wallet_send: IDL.Func(
      [
        IDL.Record({
          canister: IDL.Principal,
          amount: IDL.Nat64,
        }),
      ],
      [SendResult],
      [],
    ),
    wallet_balance: IDL.Func([], [IDL.Record({ amount: IDL.Nat64 })], ['query']),
  });
};

function formatCycles(n: number): string {
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  return `${(n / 1e9).toFixed(2)}B`;
}

export async function POST(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json', detail: 'Request body must be valid JSON' }, { status: 400 });
  }

  const { canisterId, cycles } = body ?? {};

  if (typeof canisterId !== 'string' || !canisterId.trim()) {
    return NextResponse.json({ error: 'missing_canister_id', detail: 'canisterId is required' }, { status: 400 });
  }
  if (!ALLOWED_TARGETS[canisterId]) {
    return NextResponse.json({
      error: 'target_not_allowed',
      detail: `canisterId ${canisterId} is not in the allowed targets list`,
      allowedTargets: ALLOWED_TARGETS,
    }, { status: 400 });
  }
  if (typeof cycles !== 'number' || !Number.isFinite(cycles) || cycles < MIN_CYCLES_PER_SEND || cycles > MAX_CYCLES_PER_SEND) {
    return NextResponse.json({
      error: 'invalid_cycles',
      detail: `cycles must be a number between ${formatCycles(MIN_CYCLES_PER_SEND)} (${MIN_CYCLES_PER_SEND}) and ${formatCycles(MAX_CYCLES_PER_SEND)} (${MAX_CYCLES_PER_SEND})`,
    }, { status: 400 });
  }

  const pem = normalizePem(process.env.DFX_IDENTITY_PEM || process.env.NEXT_PUBLIC_DFX_IDENTITY_PEM);
  if (!isPemLike(pem)) {
    return NextResponse.json({
      error: 'identity_not_configured',
      detail: 'DFX_IDENTITY_PEM must be set on the server to execute top-ups',
    }, { status: 503 });
  }

  let identity: any;
  try {
    const idMod: any = await import('@dfinity/identity');
    if (idMod?.Ed25519KeyIdentity?.fromPem) {
      try { identity = idMod.Ed25519KeyIdentity.fromPem(pem); } catch {}
    }
    if (!identity && idMod?.Secp256k1KeyIdentity?.fromPem) {
      try { identity = idMod.Secp256k1KeyIdentity.fromPem(pem); } catch {}
    }
  } catch {
    return NextResponse.json({
      error: 'identity_load_failed',
      detail: 'Failed to import @dfinity/identity module',
    }, { status: 500 });
  }

  if (!identity) {
    return NextResponse.json({
      error: 'identity_load_failed',
      detail: 'Could not parse PEM as Ed25519 or Secp256k1 key',
    }, { status: 500 });
  }

  const walletCanisterId =
    process.env.WALLET_CANISTER_ID ||
    process.env.NEXT_PUBLIC_WALLET_CANISTER_ID ||
    'ps5yq-saaaa-aaaas-qccva-cai';

  try {
    const agent = new HttpAgent({ host: 'https://ic0.app', identity, fetch: fetch as any });
    const wallet = Actor.createActor(walletIdl, { agent, canisterId: walletCanisterId });

    const balanceResult: any = await wallet.wallet_balance();
    const walletBalance = Number(balanceResult?.amount ?? 0);

    if (walletBalance < cycles) {
      return NextResponse.json({
        error: 'insufficient_wallet_cycles',
        walletBalance,
        walletBalanceDisplay: formatCycles(walletBalance),
        requested: cycles,
        requestedDisplay: formatCycles(cycles),
      }, { status: 400 });
    }

    const sendPromise = wallet.wallet_send({
      canister: Principal.fromText(canisterId),
      amount: BigInt(cycles),
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`wallet_send timed out after ${SEND_TIMEOUT_MS}ms`)), SEND_TIMEOUT_MS),
    );

    const result: any = await Promise.race([sendPromise, timeoutPromise]);

    if (result && 'Ok' in result) {
      return NextResponse.json({
        ok: true,
        canisterId,
        canisterName: ALLOWED_TARGETS[canisterId],
        cyclesSent: cycles,
        cyclesSentDisplay: formatCycles(cycles),
      });
    }

    if (result && 'Err' in result) {
      return NextResponse.json({
        ok: false,
        error: result.Err,
        canisterId,
        canisterName: ALLOWED_TARGETS[canisterId],
      }, { status: 502 });
    }

    return NextResponse.json({
      ok: false,
      error: 'unexpected_response',
      detail: JSON.stringify(result),
    }, { status: 502 });
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      error: 'send_failed',
      detail: err?.message ?? String(err),
    }, { status: 500 });
  }
}
