/**
 * Admin API: Promote a Supabase-hosted asset to Autonomys (encrypted)
 *
 * POST /api/admin/codex/promote-to-autonomys
 *
 * Request: { assetId, table }
 *   assetId — master_content_qubes id (mk_ep01_motion etc.) or codex_media_assets UUID
 *   table   — 'master_content_qubes' | 'codex_media_assets'
 *
 * Action: downloads bytes from the row's current Supabase URL, encrypts with a
 * fresh content key, uploads ciphertext to Autonomys, persists the wrapped key
 * as a tokenQube, and updates the row to point at the real Autonomys CID with
 * full encryption metadata. After this call the asset is canonical and
 * immutable on Autonomys. Phase 2 will extend this with on-chain tokenQube
 * minting + metaQube — see updates/2026-05-04_wip-vs-canonical-iqube-mint-plan.md.
 */

import { NextRequest, NextResponse } from 'next/server';
import { promoteRowToAutonomys } from '@/server/services/autonomysContentService';

export const runtime = 'nodejs';
export const maxDuration = 600; // up to 10 minutes for large file promote

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { assetId, table } = body as {
      assetId: string;
      table: 'master_content_qubes' | 'codex_media_assets';
    };

    if (!assetId || !table) {
      return NextResponse.json({ error: 'Missing assetId or table' }, { status: 400 });
    }
    if (table !== 'master_content_qubes' && table !== 'codex_media_assets') {
      return NextResponse.json({ error: 'Invalid table' }, { status: 400 });
    }

    const result = await promoteRowToAutonomys({ rowId: assetId, table });
    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const message = (e as Error)?.message || 'Promote failed';
    console.error('[promote-to-autonomys]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
