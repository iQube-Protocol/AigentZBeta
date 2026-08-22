/**
 * Connector action endpoint for native binary file uploads.
 *
 * IMPORTANT: the Authorization header on this route is a Threshold
 * Constitutional Handshake bearer (`ths_…`), not a Supabase user access token.
 * Authenticate it with the same canonical Threshold session adapter used by all
 * Threshold action endpoints.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { requireThresholdSession } from '@/services/threshold/requireThresholdSession';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const ROLES = new Set(['cover', 'thumbnail', 'hero', 'social', 'pdf', 'video', 'audio', 'attachment']);
const ROLE_TO_ASSET_KIND: Record<string, string> = {
  cover: 'cover_image',
  thumbnail: 'cover_image',
  hero: 'social_campaign_image',
  social: 'social_campaign_image',
  pdf: 'background_lore_doc',
  video: 'game_video',
  audio: 'game_video',
  attachment: 'background_lore_doc',
};

export async function POST(req: NextRequest) {
  const auth = await requireThresholdSession(req, 'content.asset.upload');
  if (!auth.ok) return auth.response;

  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    const fileName = typeof form.get('fileName') === 'string' ? String(form.get('fileName')) : null;
    const domain = typeof form.get('domain') === 'string' ? String(form.get('domain')) : null;
    const role = typeof form.get('role') === 'string' ? String(form.get('role')) : null;
    const contentId = typeof form.get('contentId') === 'string' ? String(form.get('contentId')) : null;
    const bind = form.get('bind') !== 'false';
    const setPrimary = form.get('setPrimary') === 'true';
    const bundleId = typeof form.get('bundleId') === 'string' ? String(form.get('bundleId')) : null;
    const bundleLabel = typeof form.get('bundleLabel') === 'string' ? String(form.get('bundleLabel')) : null;
    const bundleType = typeof form.get('bundleType') === 'string' ? String(form.get('bundleType')) : null;
    const bundleOrder = typeof form.get('bundleOrder') === 'string' ? Number(form.get('bundleOrder')) : null;
    const assetUse = typeof form.get('assetUse') === 'string' ? String(form.get('assetUse')) : null;

    if (!file || !fileName || !domain || !role) {
      return NextResponse.json({ error: 'missing-required-params' }, { status: 400 });
    }
    if (!ROLES.has(role)) {
      return NextResponse.json({ error: 'invalid-role', allowed: [...ROLES] }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const sha256 = createHash('sha256').update(bytes).digest('hex');

    // Preserve the canonical Threshold upload contract: native connector uploads
    // land in the same Autonomys/Codex substrate as JSON-RPC uploads, rather than
    // silently switching storage backends.
    const uploadForm = new FormData();
    uploadForm.append('file', new Blob([new Uint8Array(bytes)], { type: file.type || 'application/octet-stream' }), fileName);
    uploadForm.append('title', fileName);
    uploadForm.append('assetKind', ROLE_TO_ASSET_KIND[role]);
    uploadForm.append('series', domain);
    if (role === 'social' || role === 'hero') uploadForm.append('isShareable', 'true');

    const uploadUrl = `${req.nextUrl.origin}/api/admin/codex/upload-asset`;
    const uploadResp = await fetch(uploadUrl, { method: 'POST', body: uploadForm });
    const raw = await uploadResp.text();
    if (!uploadResp.ok) {
      return new NextResponse(raw, {
        status: uploadResp.status,
        headers: { 'Content-Type': uploadResp.headers.get('content-type') || 'application/json' },
      });
    }

    const uploaded = JSON.parse(raw) as any;
    const assetId = uploaded.id || uploaded.data?.id;
    const cid = uploaded.cid || uploaded.data?.cid;

    let bound = false;
    let warning: string | undefined;
    if (bind && contentId && assetId && cid) {
      const supabase = getSupabaseServer();
      if (supabase) {
        const { data: row, error: readError } = await supabase
          .from('content')
          .select('id,content,thumbnail')
          .eq('id', contentId)
          .maybeSingle();
        if (readError || !row) {
          warning = readError?.message || 'content-not-found';
        } else {
          const existing = row.content && typeof row.content === 'object' && !Array.isArray(row.content)
            ? { ...(row.content as Record<string, any>) }
            : {};
          const current = Array.isArray(existing.assets) ? [...existing.assets] : [];
          if (setPrimary) {
            for (const entry of current) {
              if (entry && typeof entry === 'object' && entry.role === role) entry.setPrimary = false;
            }
          }
          const manifestAsset: Record<string, any> = {
            assetId,
            cid,
            role,
            source: 'autonomys',
            sha256,
            fileName,
            setPrimary,
          };
          if (bundleId) manifestAsset.bundleId = bundleId;
          if (bundleLabel) manifestAsset.bundleLabel = bundleLabel;
          if (bundleType) manifestAsset.bundleType = bundleType;
          if (Number.isFinite(bundleOrder)) manifestAsset.bundleOrder = bundleOrder;
          if (assetUse) manifestAsset.assetUse = assetUse;

          const nextContent: Record<string, any> = { ...existing, assets: [...current, manifestAsset] };
          if (role === 'cover') nextContent.cover = manifestAsset;
          if (role === 'hero') nextContent.hero = manifestAsset;
          if (role === 'social') nextContent.social = manifestAsset;

          const patch: Record<string, any> = { content: nextContent, updated_at: new Date().toISOString() };
          // Public URL is provided by the canonical media delivery route once the
          // Autonomys asset is materialized; keep the card thumbnail on that route.
          if (role === 'cover' || role === 'thumbnail') {
            patch.thumbnail = `${req.nextUrl.origin}/api/content/media/${assetId}`;
          }
          const { error: bindError } = await supabase.from('content').update(patch).eq('id', contentId);
          if (bindError) warning = bindError.message;
          else bound = true;
        }
      } else {
        warning = 'supabase-unavailable';
      }
    }

    return NextResponse.json({
      ok: true,
      assetId,
      cid,
      sha256,
      role,
      contentId,
      bound,
      warning,
      bundleId,
      bundleOrder: Number.isFinite(bundleOrder) ? bundleOrder : null,
      assetUse,
      setPrimary,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'upload-failed' },
      { status: 500 },
    );
  }
}
