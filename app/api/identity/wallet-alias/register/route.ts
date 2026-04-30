/**
 * POST /api/identity/wallet-alias/register
 * Register an external wallet against a persona via the Escrow alias scheme.
 *
 * Replaces direct writes to personas.evm_address (deprecated 2026-04-29).
 * Body: { didPersonaId, chain: 'evm'|'btc'|'sol', walletAddress, signature?, message?, ttlDays? }
 * Auth: Bearer Supabase access token (auth.users.id is matched against root_identity.auth_user_id).
 */
import { NextRequest, NextResponse } from 'next/server';
import { registerWalletAlias, type WalletChain } from '@/services/identity/walletAliasService';
import { getCallerAuthUserId } from '../_lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 30; // Lambda needs 30s so our 25s sentinel can fire cleanly

interface Body {
  didPersonaId?: string;
  chain?: WalletChain;
  walletAddress?: string;
  signature?: string;
  message?: string;
  ttlDays?: number;
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

  const authUserId = await getCallerAuthUserId(req);

  // 25s sentinel — fires before Amplify's API Gateway/CloudFront hard 29s timeout.
  // If the Lambda hasn't responded by 25s we return a clean JSON 503 so the client
  // sees a retryable error rather than a silent empty-body 504.
  // With embedded joins + escrow 4s cap the critical path is typically 6–15s.
  let timeoutHandle: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(
      () => reject(new Error('REGISTER_TIMEOUT')),
      25_000
    );
  });

  try {
    const result = await Promise.race([
      registerWalletAlias(
        {
          didPersonaId: body.didPersonaId,
          chain: body.chain,
          walletAddress: body.walletAddress,
          signature: body.signature,
          message: body.message,
          ttlDays: body.ttlDays,
        },
        authUserId
      ),
      timeoutPromise,
    ]);
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
    const status =
      msg.includes('Forbidden') || msg.includes('ownership') ? 403
      : msg.includes('not found') ? 404
      : msg.includes('already linked') ? 409
      : 400;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
