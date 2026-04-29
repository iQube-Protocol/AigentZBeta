/**
 * GET /api/identity/wallet-alias/challenge?didPersonaId=...&chain=evm&address=0x...
 * Returns a server-issued ownership challenge message + nonce.
 *
 * The client signs `message` with their wallet; the resulting signature is
 * sent to POST /register together with the same `message`. Nonces are
 * stateless — they're embedded in the message and the message itself is
 * checked at register time to include the persona id.
 *
 * Auth not strictly required to mint a challenge (signing without persona
 * ownership won't help an attacker — the register call validates ownership).
 */
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import {
  buildOwnershipChallenge,
  normaliseAddress,
  type WalletChain,
} from '@/services/identity/walletAliasService';

export const runtime = 'nodejs';

const CHALLENGE_DOMAIN = process.env.WALLET_ALIAS_CHALLENGE_DOMAIN || 'iqube.protocol';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const didPersonaId = searchParams.get('didPersonaId');
  const chain = searchParams.get('chain') as WalletChain | null;
  const address = searchParams.get('address');

  if (!didPersonaId || !chain || !address) {
    return NextResponse.json(
      { ok: false, error: 'didPersonaId, chain, address required' },
      { status: 400 }
    );
  }

  let normalised: string;
  try {
    normalised = normaliseAddress(chain, address);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Invalid address' },
      { status: 400 }
    );
  }

  const nonce = crypto.randomBytes(16).toString('hex');
  const message = buildOwnershipChallenge(didPersonaId, chain, normalised, nonce, CHALLENGE_DOMAIN);

  return NextResponse.json({ ok: true, nonce, message, domain: CHALLENGE_DOMAIN });
}
