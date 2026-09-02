/**
 * codexStorageSignHandler — the shared core of `POST /api/admin/codex/storage/sign`
 * (2026-09-02 authorization repair, third route in the same defect class as
 * upload-asset/storage/register). Extracted for symmetry with
 * codexStorageRegisterHandler.ts and to keep the route file to the auth gate
 * + thin call, same shape as its sibling.
 *
 * This was the MOST severe of the three: it hands out a signed Supabase
 * Storage UPLOAD URL — a write capability, not just a read or a
 * register-after-the-fact call — to any caller, admin or not, including
 * `existingPath` overwrite of an arbitrary existing object with no
 * ownership check (the route's own prior comment admitted this: "Caller
 * must verify the path is owned by the asset being replaced" — nothing
 * enforced it). CodexUploadModal.tsx already attaches a real Supabase
 * bearer token on this exact call (`authHeaders`, unconditionally, not
 * behind a feature flag) — gating here makes that already-sent token do
 * something; no caller-side change needed.
 */

import { createClient } from '@supabase/supabase-js';

const BUCKET = 'content-media';

export class CodexStorageSignError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

function getExt(fileName: string, mimeType?: string): string {
  const fromName = fileName.split('.').pop()?.toLowerCase();
  if (fromName && fromName.length <= 5) return fromName;
  const mimeMap: Record<string, string> = {
    'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov',
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/svg+xml': 'svg',
  };
  return (mimeType && mimeMap[mimeType]) || 'bin';
}

function buildPath(params: {
  category: string;
  series: string;
  seriesScope?: string;
  episodeNumber: number | null;
  assetKind?: string;
  contentType?: string;
  fileName: string;
  mimeType?: string;
}): string {
  const { category, series, seriesScope, episodeNumber, assetKind, contentType, fileName, mimeType } = params;
  const ext = getExt(fileName, mimeType);
  const ts = Date.now();
  const scope = seriesScope
    ? seriesScope.replace(/[^a-z0-9-]+/gi, '-').toLowerCase()
    : (episodeNumber != null ? `ep${String(episodeNumber).padStart(2, '0')}` : 'epXX');

  if (category === 'master' || category === 'still') {
    const ct = contentType || 'episode_still';
    return `codex/masters/${series}/${ct}/${scope}_${ts}.${ext}`;
  }
  if (category === 'print') {
    return `codex/masters/${series}/episode_print/${scope}_${ts}.${ext}`;
  }
  const kind = assetKind || category;
  return `codex/assets/${series}/${kind}/${scope}_${ts}.${ext}`;
}

export interface CodexStorageSignInput {
  category?: string;
  series?: string;
  seriesScope?: string;
  episodeNumber?: number | null;
  assetKind?: string;
  contentType?: string;
  fileName?: string;
  mimeType?: string;
  existingPath?: string;
}

export async function handleCodexStorageSign(
  body: CodexStorageSignInput,
): Promise<{ signedUrl: string; token: string; path: string; bucket: string }> {
  const {
    category, series = 'metaKnyts', seriesScope, episodeNumber = null,
    assetKind, contentType, fileName, mimeType, existingPath,
  } = body;

  if (!category && !existingPath) {
    throw new CodexStorageSignError('Missing category or existingPath', 400);
  }
  if (!existingPath && !fileName) {
    throw new CodexStorageSignError('Missing fileName', 400);
  }

  const path = existingPath
    ? existingPath
    : buildPath({ category: category!, series, seriesScope, episodeNumber, assetKind, contentType, fileName: fileName!, mimeType });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path, { upsert: true });
  if (error || !data) {
    throw new CodexStorageSignError(error?.message || 'Failed to create signed URL', 500);
  }

  return { signedUrl: data.signedUrl, token: data.token, path, bucket: BUCKET };
}
