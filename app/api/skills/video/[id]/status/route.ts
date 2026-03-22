import { NextRequest, NextResponse } from "next/server";
import { extractThumbnailFromBuffer, persistThumbnailAsset } from "@/app/api/skills/video/_thumbnail";

/**
 * GET /api/skills/video/[id]/status
 *
 * Lightweight status check for a Sora video generation job.
 * Calls GET /v1/videos/{video_id} (metadata only, no content download)
 * and returns the current status so the client can poll cheaply.
 *
 * When completed, returns the proxy URL (/api/skills/video/[id]) so the
 * client can stream the video without this endpoint downloading the full
 * content inline (which would exceed Lambda timeouts).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id: videoId } = await params;

  if (!videoId) {
    return NextResponse.json({ error: "Video ID is required" }, { status: 400 });
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
      const proxyUrl = `/api/skills/video/${videoId}`;

      // Extract a thumbnail from the first 4 MB of the video content.
      // This mirrors the Venice status route pattern. Best-effort — any failure
      // is swallowed so the status response is never blocked.
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
        // If OpenAI doesn't honour Range requests, retry without the header to get the full body.
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
