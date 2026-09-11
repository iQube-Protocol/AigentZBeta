/**
 * POST /api/admin/content-qube/mint-edition
 *
 * Admin-only HTTP entrypoint for the Phase 7B `mintCanonicalEdition`
 * service. Triggers an on-chain ERC-1155
 * `mint(holderAddress, tokenId, 1, '0x')` against the editions contract
 * on Base mainnet, where tokenId is
 * `SHA-256("edition:<contentQubeId>:<editionNumber>")` (deterministic).
 *
 * IMPORTANT — as of 2026-05-28 no ERC-1155 editions contract is
 * deployed on Base mainnet. `mintCanonicalEdition` returns
 * `{ ok: true, skipped: 'contract_unconfigured' }` in this case and
 * this route surfaces the same. Deploy the ERC-1155 editions contract
 * and set `CONTENT_QUBE_ERC1155_ADDRESS` in Amplify to activate.
 *
 * Idempotency: refuses if the edition row's `base_token_id` is already
 * set. Same rationale as the master route — a 409 is a clearer signal
 * than waiting for an on-chain revert.
 *
 * Auth: identity-spine `cartridgeFlags.isAdmin` check.
 *
 * Request body:
 *   {
 *     contentQubeId:  string  // UUID of content_qubes row
 *     editionId:      string  // UUID of content_qube_editions row
 *     editionNumber:  number  // 1-indexed edition position
 *     rarity:         'legendary'|'epic'|'rare'|'common'|'secret_black_rare'
 *     holderAddress:  string  // EVM address of the buyer
 *     aliasCommitment?: string  // T2 commitment for the DVN receipt
 *   }
 *
 * Response (200):
 *   { ok: true, tokenId: '0x…', txHash: '0x…' }
 * Response (skipped):
 *   { ok: true, skipped: 'contract_unconfigured' | 'commons_excluded' }
 * Response (already minted):
 *   { ok: false, status: 409, error: 'already_minted' }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { mintCanonicalEdition } from '@/services/chain/baseTokenMint';
import type { ContentQubeRarity } from '@/types/contentQube';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RARITIES: readonly ContentQubeRarity[] = [
  'legendary', 'epic', 'rare', 'common', 'secret_black_rare',
];

interface RequestBody {
  contentQubeId?: unknown;
  editionId?: unknown;
  editionNumber?: unknown;
  rarity?: unknown;
  holderAddress?: unknown;
  aliasCommitment?: unknown;
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function isEvmAddress(value: unknown): value is string {
  return typeof value === 'string' && /^0x[0-9a-f]{40}$/i.test(value);
}

function isRarity(value: unknown): value is ContentQubeRarity {
  return typeof value === 'string'
    && (RARITIES as readonly string[]).includes(value);
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
  if (!isUuid(body.editionId)) {
    return NextResponse.json({ error: 'editionId must be a UUID' }, { status: 400 });
  }
  if (typeof body.editionNumber !== 'number' || !Number.isInteger(body.editionNumber) || body.editionNumber < 1) {
    return NextResponse.json({ error: 'editionNumber must be a positive integer' }, { status: 400 });
  }
  if (!isRarity(body.rarity)) {
    return NextResponse.json({ error: `rarity must be one of ${RARITIES.join(', ')}` }, { status: 400 });
  }
  if (!isEvmAddress(body.holderAddress)) {
    return NextResponse.json({ error: 'holderAddress must be a 0x-prefixed EVM address' }, { status: 400 });
  }
  const aliasCommitment = typeof body.aliasCommitment === 'string' ? body.aliasCommitment : null;

  // Idempotency precheck — refuse if base_token_id already set.
  const supabase = getSupabaseServer();
  if (supabase) {
    const { data: row, error: lookupErr } = await supabase
      .from('content_qube_editions')
      .select('id, base_token_id')
      .eq('id', body.editionId)
      .maybeSingle();
    if (lookupErr) {
      return NextResponse.json({ error: lookupErr.message }, { status: 500 });
    }
    if (!row) {
      return NextResponse.json({ error: 'edition_not_found' }, { status: 404 });
    }
    if (row.base_token_id) {
      return NextResponse.json({ ok: false, error: 'already_minted' }, { status: 409 });
    }
  }

  const result = await mintCanonicalEdition({
    contentQubeId: body.contentQubeId,
    editionId: body.editionId,
    editionNumber: body.editionNumber,
    rarity: body.rarity,
    holderAddress: body.holderAddress,
    aliasCommitment,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error || 'mint_failed' }, { status: 500 });
  }
  return NextResponse.json(result);
}
