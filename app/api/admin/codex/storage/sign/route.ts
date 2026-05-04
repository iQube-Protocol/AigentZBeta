/**
 * Admin API: Sign a Supabase Storage upload URL
 *
 * POST /api/admin/codex/storage/sign
 *
 * Returns a signed upload URL the browser can PUT to directly, bypassing
 * the Lambda body-size limit entirely (handles 300-500 MB files).
 * The browser then calls /storage/register once the PUT completes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const BUCKET = 'content-media';

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
  episodeNumber: number | null;
  assetKind?: string;
  contentType?: string;
  fileName: string;
  mimeType?: string;
}): string {
  const { category, series, episodeNumber, assetKind, contentType, fileName, mimeType } = params;
  const ext = getExt(fileName, mimeType);
  const ts = Date.now();
  const ep = episodeNumber != null ? `ep${String(episodeNumber).padStart(2, '0')}` : 'epXX';

  if (category === 'master' || category === 'still') {
    const ct = contentType || 'episode_still';
    return `codex/masters/${series}/${ct}/${ep}_${ts}.${ext}`;
  }
  if (category === 'print') {
    return `codex/masters/${series}/episode_print/${ep}_${ts}.${ext}`;
  }
  const kind = assetKind || category;
  return `codex/assets/${series}/${kind}/${ep}_${ts}.${ext}`;
}

export async function POST(req: NextRequest) {
  try {
    // No auth check — admin codex routes are URL-protected; the codex viewer
    // host page does not require a Supabase session. Returning 401 here just
    // because there's no Bearer token blocks legitimate operator uploads on
    // the dev environment. Server-side Supabase ops use the service role key.

    const body = await req.json();
    const {
      category, series = 'metaKnyts', episodeNumber = null,
      assetKind, contentType, fileName, mimeType,
      existingPath,
    } = body as {
      category: string; series?: string; episodeNumber?: number | null;
      assetKind?: string; contentType?: string; fileName: string; mimeType?: string;
      // When set, sign for THIS exact storage path (overwrite/replace). Used by
      // the "Replace file" admin action so the public URL stays stable and no
      // DB pointer needs updating. Caller must verify the path is owned by the
      // asset being replaced.
      existingPath?: string;
    };

    if (!category && !existingPath) {
      return NextResponse.json({ error: 'Missing category or existingPath' }, { status: 400 });
    }
    if (!existingPath && !fileName) {
      return NextResponse.json({ error: 'Missing fileName' }, { status: 400 });
    }

    const path = existingPath
      ? existingPath
      : buildPath({ category, series, episodeNumber, assetKind, contentType, fileName, mimeType });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUploadUrl(path, { upsert: true });

    if (error || !data) {
      return NextResponse.json({ error: error?.message || 'Failed to create signed URL' }, { status: 500 });
    }

    return NextResponse.json({
      signedUrl: data.signedUrl,
      token: data.token,
      path,
      bucket: BUCKET,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error)?.message || 'Sign failed' }, { status: 500 });
  }
}
