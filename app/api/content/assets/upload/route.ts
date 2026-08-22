import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DEFAULT_BUCKET = 'content-media';
const MAX_BYTES = 50 * 1024 * 1024;
const ROLES = new Set(['cover', 'thumbnail', 'hero', 'social', 'pdf', 'video', 'audio', 'attachment']);

function safeSegment(value: string, fallback = 'asset') {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  return normalized || fallback;
}

function extFor(file: File) {
  const byName = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() : null;
  if (byName && /^[a-z0-9]{1,8}$/.test(byName)) return byName;
  const map: Record<string, string> = {
    'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif',
    'application/pdf': 'pdf', 'video/mp4': 'mp4', 'audio/mpeg': 'mp3', 'audio/wav': 'wav',
  };
  return map[file.type] || 'bin';
}

function mergeAssetManifest(existing: unknown, asset: Record<string, unknown>) {
  // Unbounded asset model: multiple assets with the same role coexist.
  // Never filter by role — only append. Use identity (sha256) for uniqueness.
  const base = existing && typeof existing === 'object' && !Array.isArray(existing)
    ? { ...(existing as Record<string, unknown>) }
    : {};
  const current = Array.isArray(base.assets) ? [...base.assets] : [];
  // If setPrimary is true on this asset, clear the primary flag from other assets of the same role
  if (asset.setPrimary === true && asset.role) {
    const role = asset.role;
    for (const entry of current) {
      if (entry && typeof entry === 'object' && (entry as any).role === role && (entry as any).setPrimary === true) {
        (entry as any).setPrimary = false;
      }
    }
  }
  return { ...base, assets: [...current, asset] };
}

export async function POST(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!persona.cartridgeFlags.isAdmin) {
    return NextResponse.json({ error: 'admin-only' }, { status: 403 });
  }

  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ error: 'supabase-unavailable' }, { status: 500 });

  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'file-required' }, { status: 400 });
    if (file.size <= 0 || file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'invalid-file-size', maxBytes: MAX_BYTES }, { status: 400 });
    }

    const role = safeSegment(String(form.get('role') || 'attachment'));
    if (!ROLES.has(role)) return NextResponse.json({ error: 'invalid-role', allowed: [...ROLES] }, { status: 400 });

    const domain = safeSegment(String(form.get('domain') || 'shared'), 'shared');
    const contentId = String(form.get('contentId') || '').trim() || null;
    const bucket = safeSegment(String(form.get('bucket') || DEFAULT_BUCKET), DEFAULT_BUCKET);
    const bind = String(form.get('bind') ?? 'true') !== 'false';
    const suppliedName = safeSegment(String(form.get('name') || file.name || role), role);
    const ext = extFor(file);
    const bytes = Buffer.from(await file.arrayBuffer());
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const objectPath = `assets/${domain}/${safeSegment(contentId || 'unbound')}/${role}/${Date.now()}-${suppliedName.replace(/\.[^.]+$/, '')}.${ext}`;

    // Extract bundle metadata (optional — supports unbounded asset bundling)
    const bundleId = String(form.get('bundleId') || '').trim() || null;
    const bundleLabel = String(form.get('bundleLabel') || '').trim() || null;
    const bundleType = String(form.get('bundleType') || '').trim() || null;
    const bundleOrderStr = String(form.get('bundleOrder') || '').trim();
    const bundleOrder = bundleOrderStr ? parseInt(bundleOrderStr, 10) : null;
    const assetUse = String(form.get('assetUse') || '').trim() || null;
    const setPrimary = String(form.get('setPrimary') || '').trim() === 'true';

    const { error: uploadError } = await supabase.storage.from(bucket).upload(objectPath, bytes, {
      contentType: file.type || 'application/octet-stream',
      cacheControl: '31536000',
      upsert: false,
    });
    if (uploadError) return NextResponse.json({ error: 'upload-failed', message: uploadError.message }, { status: 500 });

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(objectPath);
    const publicUrl = urlData.publicUrl;
    const asset: Record<string, unknown> = {
      role,
      bucket,
      objectPath,
      publicUrl,
      mimeType: file.type || 'application/octet-stream',
      bytes: file.size,
      sha256,
      originalName: file.name || null,
      uploadedAt: new Date().toISOString(),
      uploadedByPersonaId: persona.personaId,
    };

    // Add bundle metadata if provided (unbounded asset bundling)
    if (bundleId) asset.bundleId = bundleId;
    if (bundleLabel) asset.bundleLabel = bundleLabel;
    if (bundleType) asset.bundleType = bundleType;
    if (bundleOrder !== null && !isNaN(bundleOrder)) asset.bundleOrder = bundleOrder;
    if (assetUse) asset.assetUse = assetUse;
    if (setPrimary) asset.setPrimary = true;

    if (bind && contentId) {
      const { data: row, error: readError } = await supabase
        .from('content')
        .select('id,content,thumbnail,modalities,ai_metadata')
        .eq('id', contentId)
        .maybeSingle();
      if (readError || !row) {
        return NextResponse.json({ ok: true, bound: false, asset, warning: readError?.message || 'content-not-found' });
      }

      const nextContent = mergeAssetManifest(row.content, asset);
      const patch: Record<string, unknown> = {
        content: nextContent,
        updated_at: new Date().toISOString(),
        ai_metadata: {
          ...(row.ai_metadata || {}),
          assetManifestVersion: 'content-asset.v1',
          lastAssetRole: role,
          lastAssetSha256: sha256,
        },
      };
      if (role === 'thumbnail') patch.thumbnail = publicUrl;
      if (role === 'cover') patch.content = { ...nextContent, cover: asset };
      if (role === 'hero') patch.content = { ...nextContent, hero: asset };
      if (role === 'social') patch.content = { ...nextContent, social: asset };
      if (role === 'pdf') {
        patch.modalities = {
          ...(row.modalities || {}),
          read: { ...((row.modalities || {}).read || {}), pdf_url: publicUrl },
        };
      }

      const { error: bindError } = await supabase.from('content').update(patch).eq('id', contentId);
      if (bindError) {
        return NextResponse.json({ ok: true, bound: false, asset, warning: bindError.message });
      }
    }

    return NextResponse.json({ ok: true, bound: Boolean(bind && contentId), asset });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'asset-upload-failed' }, { status: 500 });
  }
}
