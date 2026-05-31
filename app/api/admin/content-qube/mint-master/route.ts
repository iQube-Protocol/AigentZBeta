/**
 * POST /api/admin/content-qube/mint-master
 *
 * Admin-only HTTP entrypoint for the Phase 7B `mintMasterQube` service.
 * Triggers an on-chain ERC-721 `safeMint(ownerAddress, tokenId)` against
 * the iQubeNFT contract on Base mainnet, where tokenId is
 * `SHA-256("master:<contentQubeId>")` (deterministic).
 *
 * Idempotency: refuses if the row's `lifecycle_state` is already
 * `chain_minted`. The on-chain `safeMint` would also revert (token id
 * collision) but we check first so the caller gets a meaningful 409
 * instead of a 500 from ethers.
 *
 * Auth: identity-spine `cartridgeFlags.isAdmin` check (same pattern as
 * `/api/admin/codex/canonical`).
 *
 * Request body:
 *   {
 *     contentQubeId:  string  // UUID of content_qubes row
 *     ownerAddress:   string  // EVM address that should receive the NFT
 *     aliasCommitment?: string  // T2 commitment for the DVN receipt
 *   }
 *
 * Response (200):
 *   { ok: true, tokenId: '0x…', txHash: '0x…' }
 * Response (skipped — contracts unconfigured):
 *   { ok: true, skipped: 'contract_unconfigured' }
 * Response (already minted):
 *   { ok: false, status: 409, error: 'already_minted' }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { mintMasterQube } from '@/services/chain/baseTokenMint';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RequestBody {
  contentQubeId?: unknown;
  ownerAddress?: unknown;
  aliasCommitment?: unknown;
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function isEvmAddress(value: unknown): value is string {
  return typeof value === 'string' && /^0x[0-9a-f]{40}$/i.test(value);
}

async function assertAdmin(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona) return { ok: false as const, status: 401, error: 'Unauthorized' };
  if (!persona.cartridgeFlags?.isAdmin) {
    return { ok: false as const, status: 403, error: 'Admin required' };
  }
  return { ok: true as const, persona };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = await assertAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!isUuid(body.contentQubeId)) {
    return NextResponse.json({ error: 'contentQubeId must be a UUID' }, { status: 400 });
  }
  if (!isEvmAddress(body.ownerAddress)) {
    return NextResponse.json({ error: 'ownerAddress must be a 0x-prefixed EVM address' }, { status: 400 });
  }
  const aliasCommitment = typeof body.aliasCommitment === 'string' ? body.aliasCommitment : null;

  // Idempotency precheck — refuse if already chain-minted. We don't trust the
  // service alone here because ethers would surface a confusing revert string;
  // a 409 is a better operator signal.
  const supabase = getSupabaseServer();
  if (supabase) {
    const { data: row, error: lookupErr } = await supabase
      .from('content_qubes')
      .select('id, lifecycle_state')
      .eq('id', body.contentQubeId)
      .maybeSingle();
    if (lookupErr) {
      return NextResponse.json({ error: lookupErr.message }, { status: 500 });
    }
    if (!row) {
      return NextResponse.json({ error: 'content_qube_not_found' }, { status: 404 });
    }
    if (row.lifecycle_state === 'chain_minted') {
      return NextResponse.json({ ok: false, error: 'already_minted' }, { status: 409 });
    }
  }

  const result = await mintMasterQube({
    contentQubeId: body.contentQubeId,
    ownerAddress: body.ownerAddress,
    aliasCommitment,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error || 'mint_failed' }, { status: 500 });
  }
  return NextResponse.json(result);
}
