/**
 * GET /api/community-content/[id]/image
 *
 * Streams a generated image for a community-content row. The
 * underlying image_url is stored as a base64 data URL
 * (data:image/png;base64,...) which is too heavy to ship in the
 * /list response — cumulative size of 30 cards × ~200KB blew past
 * AWS Lambda's 6 MB ceiling and the list returned 413 with empty
 * body. This per-id endpoint decodes the data URL and serves the
 * bytes directly so the browser can <img src="..."> them with
 * normal lazy-loading + CDN caching.
 *
 * No auth required — listed community content is public by status
 * (shared / runtime_promoted). The /list endpoint already gates
 * which rows are visible; this just serves the image for whatever
 * id you ask for, falling back to 404 when there's no image or the
 * row isn't published.
 *
 * Long-term fix is to upload images to Supabase Storage and persist
 * https URLs instead of base64 — that's the 2026-05-22 backlog item.
 * This endpoint unblocks the community page in the meantime.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCommunityContentSupabase } from '../../_lib/personaContext';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PUBLIC_STATUSES = new Set(['shared', 'runtime_promoted']);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } },
) {
  const { id } = await Promise.resolve(params);
  if (!id) return new NextResponse('id required', { status: 400 });

  const supabase = getCommunityContentSupabase();
  const { data } = await supabase
    .from('community_generated_content')
    .select('image_url, status')
    .eq('id', id)
    .maybeSingle();

  const row = data as { image_url: string | null; status: string } | null;
  if (!row || !row.image_url) return new NextResponse('not found', { status: 404 });
  if (!PUBLIC_STATUSES.has(row.status)) {
    // Draft / pending_promotion / rejected aren't publicly listable;
    // serving their images would leak unpublished content. Caller can
    // still see their own drafts via /[id] (with auth) — that's a
    // different code path.
    return new NextResponse('not published', { status: 403 });
  }

  // Parse data URL: data:image/png;base64,<payload>
  const match = /^data:(image\/[a-z+.-]+);base64,(.+)$/i.exec(row.image_url);
  if (!match) {
    // Already an HTTPS URL — redirect the client there.
    if (/^https?:\/\//i.test(row.image_url)) {
      return NextResponse.redirect(row.image_url, 302);
    }
    return new NextResponse('invalid image data', { status: 422 });
  }

  const contentType = match[1];
  const bytes = Buffer.from(match[2], 'base64');

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(bytes.length),
      // Generated images are immutable once published — long cache is safe.
      'Cache-Control': 'public, max-age=86400, immutable',
    },
  });
}
