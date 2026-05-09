/**
 * GET /api/content/decrypt-supabase/[masterId]
 *
 * Phase 2.4 — decrypt-stream proxy for state-C content (Supabase-hosted,
 * encrypted at rest). The single delivery path that ensures gated bytes
 * pass through evaluateAccess + server-side decrypt before reaching the
 * browser. No raw Supabase URL is ever exposed for state-C assets.
 *
 * Flow:
 *   1. Resolve active persona (T0) via getActivePersona
 *   2. Build ContentAccessDescriptor for the asset
 *   3. evaluateAccess — denies on payment-required / credential-required /
 *      fio-handle-required (for tx-class actions) — same gate as the spine
 *   4. Download ciphertext from wip_storage_url
 *   5. Decrypt with the per-asset key (HKDF-derived from masterId)
 *   6. Stream plaintext back to the browser with the original mime_type
 *
 * Phase 2.4 scope: read action only ('read'/'watch'/'listen' map to read
 * for delivery). tx-class actions never go through this proxy (they're
 * gated by the spine before any read happens).
 *
 * Audit: every successful decrypt emits a debug log with persona id (T0)
 * and asset id. Receipt-eligible OrchestrationEvent emission lands in
 * Phase 3 (DVN policy hook).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getContentDescriptor } from '@/services/content/getContentDescriptor';
import { evaluateAccess } from '@/services/access/evaluateAccess';
import {
  decryptBuffer,
  ivFromBase64,
  authTagFromBase64,
  isEncryptionConfigured,
} from '@/services/content/encryption';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BUCKET = 'content-media';

// Reverse the storage URL → object path so we can hand it to the
// service-role client's storage.from(BUCKET).download(path).
function pathFromStorageUrl(url: string): string | null {
  // Public URL pattern: https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
  const m = url.match(/\/storage\/v1\/object\/(?:public|sign)\/[^/]+\/(.+)$/);
  return m ? m[1] : null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { masterId: string } },
) {
  try {
    const masterId = params.masterId;
    if (!masterId) {
      return NextResponse.json({ error: 'masterId required' }, { status: 400 });
    }

    if (!isEncryptionConfigured()) {
      return NextResponse.json(
        { error: 'CONTENT_ENCRYPTION_MASTER_KEY not configured' },
        { status: 500 },
      );
    }

    // 1. Active persona (T0)
    const persona = await getActivePersona(request);
    if (!persona) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Content descriptor
    const descriptor = await getContentDescriptor(masterId);
    if (!descriptor) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    // Only state-C goes through this proxy. State-A/B/D have their own
    // delivery paths; routing them here is a config error worth surfacing.
    if (descriptor.state !== 'C_gated_wip' && descriptor.state !== 'B_open_iqubed') {
      return NextResponse.json(
        { error: `decrypt-supabase only handles state C/B; got ${descriptor.state}` },
        { status: 400 },
      );
    }

    // 3. Gate
    const decision = await evaluateAccess(persona, descriptor, 'read');
    if (!decision.allow) {
      return NextResponse.json(
        { error: 'Access denied', reason: decision.reason },
        { status: 403 },
      );
    }

    // 4. Resolve the storage path. Prefer wip_storage_url (Phase 2.3+);
    //    fall back to auto_drive_cid for legacy rows that haven't been
    //    backfilled yet (still pointing at a Supabase URL).
    const sb = getSupabaseServer();
    if (!sb) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }
    const { data: row, error: rowErr } = await sb
      .from('master_content_qubes')
      .select('wip_storage_url, auto_drive_cid, mime_type, encryption_iv, encryption_auth_tag, encryption_key_id')
      .eq('id', masterId)
      .maybeSingle();

    let mediaRow:
      | {
          wip_storage_url: string | null;
          auto_drive_cid: string | null;
          mime_type: string | null;
          encryption_iv: string | null;
          encryption_auth_tag: string | null;
          encryption_key_id: string | null;
        }
      | null = row as any;

    if (!mediaRow || rowErr) {
      // Fallback to codex_media_assets (UUID-keyed)
      const { data: assetRow } = await sb
        .from('codex_media_assets')
        .select(
          'wip_storage_url, auto_drive_cid, mime_type, encryption_iv, encryption_auth_tag, encryption_key_id',
        )
        .eq('id', masterId)
        .maybeSingle();
      mediaRow = assetRow as any;
    }
    if (!mediaRow) {
      return NextResponse.json({ error: 'Row not found' }, { status: 404 });
    }

    const url = mediaRow.wip_storage_url || mediaRow.auto_drive_cid;
    if (!url) {
      return NextResponse.json({ error: 'No storage URL on row' }, { status: 404 });
    }
    const objectPath = pathFromStorageUrl(url);
    if (!objectPath) {
      return NextResponse.json(
        { error: 'storage URL does not match the expected pattern' },
        { status: 500 },
      );
    }

    if (!mediaRow.encryption_iv || !mediaRow.encryption_auth_tag) {
      // Row predates Phase 2.3 — bytes-at-rest are still plaintext.
      // Phase 2.5 backfill script encrypts these in place. Until that
      // runs, we surface a clear error rather than serve plaintext.
      return NextResponse.json(
        {
          error:
            'Asset is not yet encrypted at rest. Run the Phase 2.5 backfill ' +
            'script: scripts/backfill-encrypt-state-c.ts',
          masterId,
        },
        { status: 503 },
      );
    }

    // 5. Download ciphertext + decrypt
    const { data: blob, error: dlErr } = await sb.storage.from(BUCKET).download(objectPath);
    if (dlErr || !blob) {
      return NextResponse.json(
        { error: `Storage download failed: ${dlErr?.message || 'no data'}` },
        { status: 502 },
      );
    }
    const ciphertext = Buffer.from(await blob.arrayBuffer());
    const iv = ivFromBase64(mediaRow.encryption_iv);
    const authTag = authTagFromBase64(mediaRow.encryption_auth_tag);
    let plaintext: Buffer;
    try {
      plaintext = decryptBuffer(ciphertext, iv, authTag, { masterId });
    } catch (e) {
      // Auth-tag failure → tampering or wrong key. Do NOT silently fall
      // back to a different key version (would mask tampering).
      return NextResponse.json(
        { error: `Decryption failed: ${(e as Error).message}` },
        { status: 500 },
      );
    }

    // Phase 3 hook point — emit a receipt-eligible OrchestrationEvent
    // here when decision.receipt.mode === 'sync' or 'async-batched'.
    // Currently logged only.
    console.log('[decrypt-supabase] decrypted', { masterId, personaId: persona.personaId });

    return new NextResponse(plaintext, {
      status: 200,
      headers: {
        'Content-Type': mediaRow.mime_type || 'application/octet-stream',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Internal error', details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
