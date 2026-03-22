import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractThumbnailFromBuffer, persistThumbnailAsset } from "@/app/api/skills/video/_thumbnail";

/**
 * GET /api/skills/video/[id]/status
 *
 * Lightweight status check for a Sora video generation job.
 *
 * Fast path: if the video has already been uploaded to Supabase by the proxy
 * route, return ready:true immediately without calling OpenAI (whose videos
 * expire ~1 h after generation).
 *
 * Slow path: call GET /v1/videos/{video_id} (metadata only) to check status.
 * On completed: download first 4 MB to extract a thumbnail, upload both to
 * Supabase, return the proxy URL + thumbnail_url.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

interface RouteParams {
  params: Promise<{ id: string }>;
}

const BUCKET_CANDIDATES = [
  process.env.SUPABASE_STORAGE_BUCKET,
  "content-assets",
  "assets",
  "codex-lite",
].filter((v, i, arr): v is string => Boolean(v) && arr.indexOf(v) === i);

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/** Returns the Supabase public URL if the video is already cached there. */
async function findCachedVideoUrl(videoId: string): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const path = `generated/openai/videos/${videoId}.mp4`;
  for (const bucket of BUCKET_CANDIDATES) {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    if (!data?.publicUrl) continue;
    try {
      const check = await fetch(data.publicUrl, { method: "HEAD", cache: "no-store" });
      if (check.ok) return data.publicUrl;
    } catch {
      // not in this bucket — try next
    }
  }
  return null;
}

/** Returns the Supabase thumbnail URL if the thumbnail is already cached. */
async function findCachedThumbnailUrl(videoId: string): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const path = `generated/openai/thumbnails/${videoId}-thumb.jpg`;
  for (const bucket of BUCKET_CANDIDATES) {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    if (!data?.publicUrl) continue;
    try {
      const check = await fetch(data.publicUrl, { method: "HEAD", cache: "no-store" });
      if (check.ok) return data.publicUrl;
    } catch {
      // not in this bucket — try next
    }
  }
  return null;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id: videoId } = await params;

  if (!videoId) {
    return NextResponse.json({ error: "Video ID is required" }, { status: 400 });
  }

  const proxyUrl = `/api/skills/video/${videoId}`;

  // Fast path: video already uploaded to Supabase by the proxy route.
  // OpenAI purges videos after ~1 hour so we must not rely on their API for old jobs.
  const cachedVideoUrl = await findCachedVideoUrl(videoId).catch(() => null);
  if (cachedVideoUrl) {
    const cachedThumbnailUrl = await findCachedThumbnailUrl(videoId).catch(() => null);
    return NextResponse.json({
      ready: true,
      status: "completed",
      progress: 100,
      video_url: proxyUrl,
      ...(cachedThumbnailUrl ? { thumbnail_url: cachedThumbnailUrl } : {}),
      checked_at: new Date().toISOString(),
    }, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ready: false, status: "no_key", error: "OPENAI_API_KEY not configured" });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    const res = await fetch(`https://api.openai.com/v1/videos/${videoId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
      cache: "no-store",
    }).finally(() => clearTimeout(timeout));

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const msg = data?.error?.message || `OpenAI ${res.status}`;
      return NextResponse.json({ ready: false, status: "error", error: msg });
    }

    const status: string = data?.status || "unknown";
    const progress: number = data?.progress ?? 0;

    if (status === "completed") {
      // Extract a thumbnail from the first 4 MB of the video content.
      // Best-effort — any failure is swallowed so the status response is never blocked.
      let thumbnailUrl: string | null = null;
      try {
        const thumbController = new AbortController();
        const thumbTimeout = setTimeout(() => thumbController.abort(), 25_000);
        const contentUrl = `https://api.openai.com/v1/videos/${videoId}/content`;
        let contentRes = await fetch(contentUrl, {
          headers: { Authorization: `Bearer ${apiKey}`, Range: "bytes=0-4194303" },
          signal: thumbController.signal,
          cache: "no-store",
        });
        // If OpenAI doesn't honour Range requests, retry without the header.
        if (contentRes.status === 416) {
          contentRes = await fetch(contentUrl, {
            headers: { Authorization: `Bearer ${apiKey}` },
            signal: thumbController.signal,
            cache: "no-store",
          });
        }
        clearTimeout(thumbTimeout);
        if (contentRes.ok || contentRes.status === 206) {
          const partial = Buffer.from(await contentRes.arrayBuffer());
          const thumbBuffer = await extractThumbnailFromBuffer(partial, videoId).catch(() => null);
          if (thumbBuffer) {
            thumbnailUrl = await persistThumbnailAsset(thumbBuffer, videoId, "openai").catch(() => null);
          }
        }
      } catch {
        // Thumbnail is optional — continue without it.
      }

      return NextResponse.json({
        ready: true,
        status: "completed",
        progress: 100,
        video_url: proxyUrl,
        ...(thumbnailUrl ? { thumbnail_url: thumbnailUrl } : {}),
        checked_at: new Date().toISOString(),
      }, {
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
      });
    }

    if (status === "failed") {
      return NextResponse.json({
        ready: false,
        status: "failed",
        progress,
        error: data?.error?.message || "Generation failed",
        checked_at: new Date().toISOString(),
      }, {
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
      });
    }

    // queued / in_progress
    return NextResponse.json({
      ready: false,
      status,
      progress,
      checked_at: new Date().toISOString(),
    }, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch (err: any) {
    const msg = err?.name === "AbortError" ? "Status check timed out" : (err?.message || "Unknown error");
    return NextResponse.json(
      { ready: false, status: "error", error: msg, checked_at: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    );
  }
}
