/**
 * DELETE /api/identity/wallet-alias/[id]
 * Revoke a wallet alias commitment. Status set to 'revoked' (no physical delete).
 *
 * Auth: Bearer Supabase access token. Caller must own the bound root_identity.
 */
import { NextRequest, NextResponse } from 'next/server';
import { revokeWalletAlias } from '@/services/identity/walletAliasService';
import { getCallerAuthUserId } from '../_lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const aliasId = params.id;
  if (!aliasId) {
    return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });
  }

  const authUserId = await getCallerAuthUserId(req);

  try {
    const result = await revokeWalletAlias(aliasId, authUserId);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to revoke wallet alias';
    const status =
      msg === 'Forbidden' ? 403
      : msg.includes('not found') ? 404
      : 400;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
