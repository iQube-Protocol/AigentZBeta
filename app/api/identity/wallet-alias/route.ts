/**
 * GET /api/identity/wallet-alias?didPersonaId=...&includeInactive=true
 * List wallet alias commitments for a persona. Returns commitments only;
 * plaintext wallet addresses are never stored here, never returned here.
 *
 * Auth: Bearer Supabase access token. Caller must own the bound root_identity.
 */
import { NextRequest, NextResponse } from 'next/server';
import { listWalletAliases } from '@/services/identity/walletAliasService';
import { getCallerAuthUserId } from './_lib/auth';

export const dynamic = 'force-dynamic';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const didPersonaId = searchParams.get('didPersonaId');
  const includeInactive = searchParams.get('includeInactive') === 'true';

  if (!didPersonaId) {
    return NextResponse.json({ ok: false, error: 'didPersonaId required' }, { status: 400 });
  }

  const authUserId = await getCallerAuthUserId(req);

  try {
    const items = await listWalletAliases(didPersonaId, authUserId, includeInactive);
    return NextResponse.json({ ok: true, items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to list wallet aliases';
    const status =
      msg === 'Forbidden' || msg.includes('ownership') ? 403
      : msg.includes('not found') ? 404
      : 400;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
