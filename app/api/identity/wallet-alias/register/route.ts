/**
 * POST /api/identity/wallet-alias/register
 * Register an external wallet against a persona via the Escrow alias scheme.
 *
 * Body: { didPersonaId, chain, walletAddress, signature?, message?, ttlDays?, force? }
 * force=true bypasses the cross-persona warning (user has acknowledged the privacy impact).
 * Auth: Bearer Supabase access token.
 */
import { NextRequest, NextResponse } from 'next/server';
import { registerWalletAlias, type WalletChain } from '@/services/identity/walletAliasService';
import { getCallerAuthUserId } from '../_lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface Body {
  didPersonaId?: string;
  chain?: WalletChain;
  walletAddress?: string;
  signature?: string;
  message?: string;
  ttlDays?: number;
  force?: boolean;
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.didPersonaId) return NextResponse.json({ ok: false, error: 'didPersonaId required' }, { status: 400 });
  if (!body.chain) return NextResponse.json({ ok: false, error: 'chain required' }, { status: 400 });
  if (!body.walletAddress) return NextResponse.json({ ok: false, error: 'walletAddress required' }, { status: 400 });

  // 20s sentinel covers the *entire* operation from here — including the auth
  // user resolution — so it reliably fires at t≈20s from request start.
  // CloudFront/API Gateway hard-kills at ~29s; our 20s sentinel ensures we
  // always return a clean JSON 503 before the silent empty-body 504 fires.
  let timeoutHandle: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(
      () => reject(new Error('REGISTER_TIMEOUT')),
      20_000
    );
  });

  // getCallerAuthUserId is inside the race: its own 4s Supabase-auth timeout
  // counts against the 20s window rather than adding to it.
  const operationPromise = (async () => {
    const authUserId = await getCallerAuthUserId(req);
    return registerWalletAlias(
      {
        didPersonaId: body.didPersonaId,
        chain: body.chain,
        walletAddress: body.walletAddress,
        signature: body.signature,
        message: body.message,
        ttlDays: body.ttlDays,
        force: body.force,
      },
      authUserId
    );
  })();

  try {
    const result = await Promise.race([operationPromise, timeoutPromise]);
    clearTimeout(timeoutHandle!);
    return NextResponse.json(result);
  } catch (e) {
    clearTimeout(timeoutHandle!);
    const msg = e instanceof Error ? e.message : 'Failed to register wallet alias';
    if (msg === 'REGISTER_TIMEOUT') {
      return NextResponse.json(
        { ok: false, error: 'Registration timed out — Supabase or ICP gateway slow. Please retry.' },
        { status: 503 }
      );
    }
    // Cross-persona warning — wallet is already linked to a different persona.
    // Returns 409 with crossPersonaWarning: true so the client can show a
    // confirmation dialog before re-submitting with force=true.
    if (msg.startsWith('CROSS_PERSONA:')) {
      const linkedPersonaCount = parseInt(msg.slice(14)) || 1;
      return NextResponse.json(
        { ok: false, error: 'This wallet is already linked to another persona', crossPersonaWarning: true, linkedPersonaCount },
        { status: 409 }
      );
    }
    const status =
      msg.includes('Forbidden') || msg.includes('ownership') ? 403
      : msg.includes('not found') ? 404
      : msg.includes('already linked') ? 409
      : 400;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
