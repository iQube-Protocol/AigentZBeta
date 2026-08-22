import { createHash } from 'crypto';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const THRESHOLD_UPLOAD_ROLES = new Set([
  'cover',
  'thumbnail',
  'hero',
  'social',
  'pdf',
  'video',
  'audio',
  'attachment',
]);

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

export interface ThresholdUploadInput {
  bytes: Buffer;
  mimeType: string;
  fileName: string;
  domain: string;
  role: string;
  origin: string;
  contentId?: string | null;
  bind?: boolean;
  bundleId?: string | null;
  bundleLabel?: string | null;
  bundleType?: string | null;
  bundleOrder?: number | null;
  assetUse?: string | null;
  setPrimary?: boolean;
}

export interface ThresholdUploadReceipt {
  ok: true;
  assetId: string | null;
  cid: string | null;
  sha256: string;
  role: string;
  contentId: string | null;
  bound: boolean;
  warning?: string;
  bundleId: string | null;
  bundleOrder: number | null;
  assetUse: string | null;
  setPrimary: boolean;
}

function publicAssetUrl(origin: string, assetId: string, cid: string, role: string, domain: string): string {
  if (role === 'cover' || role === 'thumbnail') {
    // Qriptopian/Constitutional Internet cards use a durable derivative route.
    // It decrypts + validates the canonical Autonomys source once, re-encodes
    // a compact WebP and stores it in public object storage. This avoids both
    // the generic full-media proxy and repeated Lambda binary streaming.
    if (domain === 'qriptopian' || domain === 'constitutional-internet') {
      return `${origin}/api/qriptopian/essay-cover/${encodeURIComponent(assetId)}`;
    }
    return `${origin}/api/content/cover/${encodeURIComponent(cid)}?variant=thumb`;
  }
  return `${origin}/api/content/media/${assetId}`;
}

/**
 * Canonical execution path AFTER Threshold bearer authorization has succeeded.
 *
 * Both MCP JSON-RPC and native connector uploads call this function. It never
 * re-authenticates through browser/Supabase identity. Authority is established
 * before entry by the caller via the Threshold bearer/session resolver.
 */
export async function executeThresholdContentUpload(input: ThresholdUploadInput): Promise<ThresholdUploadReceipt> {
  if (!THRESHOLD_UPLOAD_ROLES.has(input.role)) {
    throw new Error(`invalid-role:${input.role}`);
  }
  if (!input.bytes.length) throw new Error('empty-file');

  const sha256 = createHash('sha256').update(input.bytes).digest('hex');
  const uploadForm = new FormData();
  uploadForm.append(
    'file',
    new Blob([new Uint8Array(input.bytes)], { type: input.mimeType || 'application/octet-stream' }),
    input.fileName,
  );
  uploadForm.append('title', input.fileName);
  uploadForm.append('assetKind', ROLE_TO_ASSET_KIND[input.role]);
  uploadForm.append('series', input.domain);
  if (['cover', 'thumbnail', 'hero', 'social'].includes(input.role)) {
    uploadForm.append('isShareable', 'true');
  }

  const uploadResp = await fetch(`${input.origin}/api/admin/codex/upload-asset`, {
    method: 'POST',
    body: uploadForm,
  });
  const raw = await uploadResp.text();
  if (!uploadResp.ok) {
    throw new Error(`upstream-upload-failed:${uploadResp.status}:${raw.slice(0, 500)}`);
  }

  let uploaded: any;
  try {
    uploaded = JSON.parse(raw);
  } catch {
    throw new Error('upstream-upload-invalid-json');
  }

  const assetId = uploaded.id || uploaded.data?.id || null;
  const cid = uploaded.cid || uploaded.data?.cid || null;
  if (!assetId || !cid) throw new Error('upstream-upload-missing-receipt');

  const contentId = input.contentId || null;
  const bind = input.bind !== false;
  const setPrimary = input.setPrimary === true;
  let bound = false;
  let warning: string | undefined;

  if (bind && contentId) {
    const supabase = getSupabaseServer();
    if (!supabase) {
      warning = 'supabase-unavailable';
    } else {
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
            if (entry && typeof entry === 'object' && entry.role === input.role) entry.setPrimary = false;
          }
        }

        const assetUrl = publicAssetUrl(input.origin, assetId, cid, input.role, input.domain);
        const manifestAsset: Record<string, any> = {
          assetId,
          cid,
          role: input.role,
          source: 'autonomys',
          sha256,
          fileName: input.fileName,
          setPrimary,
          publicUrl: assetUrl,
        };
        if (input.bundleId) manifestAsset.bundleId = input.bundleId;
        if (input.bundleLabel) manifestAsset.bundleLabel = input.bundleLabel;
        if (input.bundleType) manifestAsset.bundleType = input.bundleType;
        if (Number.isFinite(input.bundleOrder)) manifestAsset.bundleOrder = input.bundleOrder;
        if (input.assetUse) manifestAsset.assetUse = input.assetUse;

        const nextContent: Record<string, any> = { ...existing, assets: [...current, manifestAsset] };
        if (input.role === 'cover') nextContent.cover = manifestAsset;
        if (input.role === 'hero') nextContent.hero = manifestAsset;
        if (input.role === 'social') nextContent.social = manifestAsset;

        const patch: Record<string, any> = {
          content: nextContent,
          updated_at: new Date().toISOString(),
        };
        if (input.role === 'cover' || input.role === 'thumbnail') patch.thumbnail = assetUrl;

        const { error: bindError } = await supabase.from('content').update(patch).eq('id', contentId);
        if (bindError) warning = bindError.message;
        else bound = true;
      }
    }
  }

  return {
    ok: true,
    assetId,
    cid,
    sha256,
    role: input.role,
    contentId,
    bound,
    warning,
    bundleId: input.bundleId || null,
    bundleOrder: Number.isFinite(input.bundleOrder) ? (input.bundleOrder as number) : null,
    assetUse: input.assetUse || null,
    setPrimary,
  };
}
