/**
 * /api/admin/registry/dvn-blocks
 *
 * Stage 6 C25.
 *   GET                      → list recent blocks (admin-gated)
 *   POST   ?seal=all         → bulk seal-if-threshold across all open scopes
 *   POST   ?seal=<scope>     → force-seal one scope (admin override)
 *
 * Blocks per cartridge_scope; one open at a time enforced by the
 * UNIQUE partial index on dvn_receipt_blocks(cartridge_scope) WHERE status='open'.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import {
  listRecentBlocks,
  sealOpenBlock,
  sealAllScopesIfThresholdReached,
} from '@/services/registry/dvnBlocks';

async function requireAdmin(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return { error: NextResponse.json({ error: 'unauthenticated' }, { status: 401 }) };
  if (!persona.cartridgeFlags?.isAdmin) {
    return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) };
  }
  return { persona };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ('error' in auth) return auth.error;

  const url = new URL(request.url);
  const scope = url.searchParams.get('scope') ?? undefined;
  const limit = Number.parseInt(url.searchParams.get('limit') ?? '25', 10);
  const blocks = await listRecentBlocks(
    scope,
    Number.isFinite(limit) && limit > 0 && limit <= 200 ? limit : 25,
  );
  return NextResponse.json({ blocks, total: blocks.length });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ('error' in auth) return auth.error;

  const url = new URL(request.url);
  const sealParam = url.searchParams.get('seal');

  if (sealParam === 'all') {
    const results = await sealAllScopesIfThresholdReached();
    return NextResponse.json({
      sealed: results.filter((r) => r.sealed).length,
      processed: results.length,
      details: results,
    });
  }

  if (sealParam) {
    // Operator override — force seal the open block for this scope
    // regardless of threshold.
    const block = await sealOpenBlock(sealParam);
    if (!block) {
      return NextResponse.json(
        { sealed: false, reason: 'no_open_block_or_empty', scope: sealParam },
        { status: 200 },
      );
    }
    return NextResponse.json({ sealed: true, scope: sealParam, block });
  }

  return NextResponse.json(
    { error: "missing ?seal=<scope> or ?seal=all parameter" },
    { status: 400 },
  );
}
