import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 60;

const BUCKET = 'content-media';

export async function POST(req: NextRequest) {
  try {
    // Match existing codex admin route auth behavior
    const isDev = process.env.NODE_ENV === 'development';
    if (!isDev) {
      const authHeader = req.headers.get('authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const series = (formData.get('series') as string | null) || 'metaKnyts';
    const episodeNumberRaw = formData.get('episodeNumber') as string | null;
    const rarityTier = formData.get('rarityTier') as string | null;
    const writeDbRaw = (formData.get('writeDb') as string | null) || 'true';

    const episodeNumber = episodeNumberRaw ? Number(episodeNumberRaw) : null;
    if (episodeNumberRaw && !Number.isFinite(episodeNumber)) {
      return NextResponse.json({ error: 'Invalid episodeNumber' }, { status: 400 });
    }

    if (!file.type?.startsWith('image/')) {
      return NextResponse.json({ error: `Unsupported file type: ${file.type || 'unknown'}` }, { status: 400 });
    }

    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'img';
    const rarity = rarityTier || 'common';
    const ep = episodeNumber ?? 0;
    const objectPath = `covers/ep${ep}/${rarity}.${ext}`;

    const buf = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(objectPath, buf, {
      contentType: file.type || 'application/octet-stream',
      upsert: true,
      cacheControl: '3600',
    });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
    const publicUrl = urlData.publicUrl;

    const writeDb = writeDbRaw !== 'false';
    if (writeDb && episodeNumber !== null && rarityTier) {
      const { error: updateError } = await supabase
        .from('codex_media_assets')
        .update({ cover_thumb_url: publicUrl })
        .eq('series', series)
        .eq('episode_number', episodeNumber)
        .eq('rarity_tier', rarityTier)
        .eq('status', 'active')
        .in('asset_kind', ['cover_image', 'cover_pdf']);

      if (updateError) {
        return NextResponse.json(
          { error: updateError.message, publicUrl, objectPath },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ ok: true, publicUrl, objectPath });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Upload failed' }, { status: 500 });
  }
}
