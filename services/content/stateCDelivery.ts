/**
 * decryptSupabaseStateC — shared state-C delivery path used by every
 * content proxy (pdf/[cid], cover/[cid], pdf-page/[cid], video/[cid]).
 *
 * Phase 2.6 — eliminates the raw-Supabase-URL leak. Before this commit
 * the proxies 302-redirected when the row's `auto_drive_cid` started
 * with `http`. The browser then fetched the public URL directly and
 * cached it — the gate ran but the bytes were unencrypted plaintext on
 * a public URL. After this commit, state-C reads pass through this
 * helper which downloads ciphertext, decrypts with the per-asset key,
 * and streams plaintext back. No raw Supabase URL ever reaches the
 * browser.
 *
 * State-A (open, unencrypted) and state-D (Auto-Drive, separate
 * encryption layer) are unaffected — they keep their existing paths.
 */

import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import {
  decryptBuffer,
  ivFromBase64,
  authTagFromBase64,
  isEncryptionConfigured,
} from '@/services/content/encryption';

const BUCKET = 'content-media';

function pathFromStorageUrl(url: string): string | null {
  const m = url.match(/\/storage\/v1\/object\/(?:public|sign)\/[^/]+\/(.+)$/);
  return m ? m[1] : null;
}

export interface StateCRow {
  id: string;
  wip_storage_url?: string | null;
  auto_drive_cid?: string | null;
  mime_type?: string | null;
  encryption_iv?: string | null;
  encryption_auth_tag?: string | null;
  encryption_key_id?: string | null;
}

export interface StateCDeliveryOptions {
  /** Override the Content-Type header (defaults to row.mime_type) */
  contentType?: string;
  /** Add a Content-Disposition header (e.g. 'inline' for PDFs) */
  contentDisposition?: string;
}

/**
 * Stream the decrypted plaintext for a state-C row. Caller is responsible
 * for having already passed the spine gate (evaluateAccess) — this helper
 * does NOT re-gate.
 */
export async function streamStateCPlaintext(
  row: StateCRow,
  opts: StateCDeliveryOptions = {},
): Promise<NextResponse> {
  if (!isEncryptionConfigured()) {
    return NextResponse.json(
      { error: 'CONTENT_ENCRYPTION_MASTER_KEY not configured' },
      { status: 500 },
    );
  }

  if (!row.encryption_iv || !row.encryption_auth_tag) {
    return NextResponse.json(
      {
        error:
          'Asset is state-C but bytes-at-rest are still plaintext. ' +
          'Run the Phase 2.5 backfill: scripts/backfill-encrypt-state-c.mjs',
        masterId: row.id,
      },
      { status: 503 },
    );
  }

  const url = row.wip_storage_url || row.auto_drive_cid;
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

  const sb = getSupabaseServer();
  if (!sb) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
  }
  const { data: blob, error: dlErr } = await sb.storage.from(BUCKET).download(objectPath);
  if (dlErr || !blob) {
    return NextResponse.json(
      { error: `Storage download failed: ${dlErr?.message || 'no data'}` },
      { status: 502 },
    );
  }
  const ciphertext = Buffer.from(await blob.arrayBuffer());
  const iv = ivFromBase64(row.encryption_iv);
  const authTag = authTagFromBase64(row.encryption_auth_tag);
  let plaintext: Buffer;
  try {
    plaintext = decryptBuffer(ciphertext, iv, authTag, { masterId: row.id });
  } catch (e) {
    return NextResponse.json(
      { error: `Decryption failed: ${(e as Error).message}` },
      { status: 500 },
    );
  }

  const headers: Record<string, string> = {
    'Content-Type': opts.contentType || row.mime_type || 'application/octet-stream',
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  };
  if (opts.contentDisposition) headers['Content-Disposition'] = opts.contentDisposition;

  return new NextResponse(new Uint8Array(plaintext), { status: 200, headers });
}

/**
 * Look up a state-C row by storage URL or by asset id.
 * Used by proxies that historically resolved by `auto_drive_cid` LIKE
 * 'http%' — that field still holds the URL post-migration, but we also
 * check `wip_storage_url` for forward-compat.
 */
export async function findStateCRowByUrl(url: string): Promise<{
  row: StateCRow;
  table: 'master_content_qubes' | 'codex_media_assets';
} | null> {
  const sb = getSupabaseServer();
  if (!sb) return null;

  const select = 'id, wip_storage_url, auto_drive_cid, mime_type, encryption_iv, encryption_auth_tag, encryption_key_id';

  const { data: master } = await sb
    .from('master_content_qubes')
    .select(select)
    .or(`wip_storage_url.eq.${url},auto_drive_cid.eq.${url}`)
    .maybeSingle();
  if (master) return { row: master as StateCRow, table: 'master_content_qubes' };

  const { data: asset } = await sb
    .from('codex_media_assets')
    .select(select)
    .or(`wip_storage_url.eq.${url},auto_drive_cid.eq.${url}`)
    .maybeSingle();
  if (asset) return { row: asset as StateCRow, table: 'codex_media_assets' };

  return null;
}
