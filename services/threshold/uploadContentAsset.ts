import { createHash } from 'crypto';
import sharp from 'sharp';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { handleCodexAssetUpload, CodexAssetUploadError } from '@/services/content/codexAssetUploadHandler';

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

/** Roles whose bytes must be a decodable raster image before persistence. */
export const THRESHOLD_IMAGE_ROLES = new Set(['cover', 'thumbnail', 'hero', 'social']);

const DATA_URL_PREFIX = /^data:[^;,]*;base64,/i;

/**
 * Decode a base64 payload strictly. A JSON-RPC caller occasionally sends a
 * full data URL (`data:image/jpeg;base64,...`) or whitespace-padded text
 * instead of a bare base64 string. Node's `Buffer.from(x, 'base64')` silently
 * skips characters outside the base64 alphabet rather than rejecting them, so
 * feeding it un-sanitized input produces a plausible-length but corrupt
 * buffer with no error raised anywhere in the pipeline — the corruption only
 * surfaces later, as an undecodable image at display time. Reject loudly
 * here instead, at the one place the original text is still available.
 */
export function decodeBase64Strict(input: string): Buffer {
  const stripped = input.replace(DATA_URL_PREFIX, '').replace(/\s+/g, '');
  if (!stripped.length) throw new Error('empty-base64-input');
  if (stripped.length % 4 !== 0) throw new Error('invalid-base64-encoding: bad length');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(stripped)) throw new Error('invalid-base64-encoding: bad charset');
  return Buffer.from(stripped, 'base64');
}

/**
 * For image-bearing roles, verify the decoded bytes are actually a raster
 * image Sharp can fully decode before they are ever encrypted/persisted.
 * This is the upload-time half of asset validation — the display-time half
 * (essay-cover / content-media routes) cannot repair bytes that were never
 * valid to begin with, so the check belongs here, at the boundary where the
 * real source is still in hand.
 */
export async function assertDecodableImage(bytes: Buffer, role: string): Promise<void> {
  if (!THRESHOLD_IMAGE_ROLES.has(role)) return;
  let meta: { width?: number; height?: number };
  try {
    meta = await sharp(bytes, { failOn: 'error' }).metadata();
  } catch (error) {
    throw new Error(`upload-not-a-decodable-image: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!meta.width || !meta.height || meta.width < 1 || meta.height < 1) {
    throw new Error('upload-not-a-decodable-image: degenerate dimensions');
  }
  // Full pixel decode, not just header/metadata parsing — a truncated source
  // can carry a valid header and still fail (or silently gray-fill) partway
  // through the raster.
  await sharp(bytes, { failOn: 'error' }).raw().toBuffer();
}

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
 *
 * AUTHORIZATION REPAIR (2026-09-02): this previously made an unauthenticated
 * internal HTTP hop to POST /api/admin/codex/upload-asset — the route now
 * requires an admin persona, and this caller has no browser session to
 * present. Calling handleCodexAssetUpload() directly, in-process, removes
 * the hop entirely rather than trying to forge a credential for it: this
 * caller's own authority was already established upstream (see this
 * function's own doc comment above), so no HTTP boundary — authenticated or
 * not — belongs between that authorization and this execution.
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

  let uploaded: Awaited<ReturnType<typeof handleCodexAssetUpload>>;
  try {
    uploaded = await handleCodexAssetUpload(uploadForm);
  } catch (err) {
    const status = err instanceof CodexAssetUploadError ? err.status : 500;
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`upstream-upload-failed:${status}:${message.slice(0, 500)}`);
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
