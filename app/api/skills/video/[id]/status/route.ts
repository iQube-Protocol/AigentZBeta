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
      // Persist the FULL video to Supabase the moment completion is detected,
      // then extract a thumbnail from the same bytes. Persistence must happen
      // HERE, not at first playback via the proxy route: OpenAI purges assets
      // after ~1 hour, and the multi-segment stitch flow never fetches the
      // proxy URL for individual segments — the 2026-07-05 EXP-002 runs lost
      // all their completed Sora clips this way when the stitch pass failed.
      // Best-effort — any failure is swallowed so the status response is
      // never blocked; the proxy-route persistence remains as backstop.
      let thumbnailUrl: string | null = null;
      try {
        const contentController = new AbortController();
        const contentTimeout = setTimeout(() => contentController.abort(), 25_000);
        const contentUrl = `https://api.openai.com/v1/videos/${videoId}/content`;
        const contentRes = await fetch(contentUrl, {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: contentController.signal,
          cache: "no-store",
        });
        clearTimeout(contentTimeout);
        if (contentRes.ok) {
          const full = Buffer.from(await contentRes.arrayBuffer());
          if (full.byteLength > 0) {
            const body: ArrayBuffer = full.buffer.slice(
              full.byteOffset,
              full.byteOffset + full.byteLength,
            ) as ArrayBuffer;
            const supabase = getSupabase();
            if (supabase) {
              const path = `generated/openai/videos/${videoId}.mp4`;
              for (const bucket of BUCKET_CANDIDATES) {
                const { error } = await supabase.storage.from(bucket).upload(path, body, {
                  contentType: "video/mp4",
                  upsert: true,
                  cacheControl: "86400",
                });
                if (!error || /already exists|duplicate/i.test(error.message)) {
                  console.log(`[SoraStatus] persisted ${videoId} (${Math.round(full.byteLength / 1024 / 1024)}MB) to ${bucket}/${path}`);
                  break;
                }
              }
            }
            const thumbBuffer = await extractThumbnailFromBuffer(full, videoId).catch(() => null);
            if (thumbBuffer) {
              thumbnailUrl = await persistThumbnailAsset(thumbBuffer, videoId, "openai").catch(() => null);
            }
          }
        }
      } catch {
        // Persistence/thumbnail are best-effort — continue without them.
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
