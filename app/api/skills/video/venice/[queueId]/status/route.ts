import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  extractThumbnailFromBuffer,
  extractThumbnailFromUrl,
  persistThumbnailAsset,
} from "@/app/api/skills/video/_thumbnail";

export const runtime = "nodejs";

const VENICE_VIDEO_BASE = "https://api.venice.ai/api/v1/video";
const MAX_PERSIST_BYTES = 60 * 1024 * 1024;

const BUCKET_CANDIDATES = [
  process.env.SUPABASE_STORAGE_BUCKET,
  "content-assets",
  "assets",
  "codex-lite",
].filter((v, i, arr): v is string => Boolean(v) && arr.indexOf(v) === i);

/**
 * Persist a completed Venice video to Supabase storage — parity with the
 * Sora proxy route (generated/openai/videos). Venice retains queue assets
 * only transiently, and before this existed a completed Venice clip left NO
 * durable trace: the 2026-07-05 EXP-002 runs' segments became untraceable
 * after their stitch pass failed. Best-effort and idempotent (HEAD check
 * first); status polling continues fine if it fails.
 */
async function persistVeniceVideo(queueId: string, bytes: Buffer): Promise<void> {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_PERSIST_BYTES) return;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return;
  const supabase = createClient(url, key);
  const path = `generated/venice/videos/${queueId}.mp4`;
  const body: ArrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  for (const bucket of BUCKET_CANDIDATES) {
    try {
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      if (data?.publicUrl) {
        const head = await fetch(data.publicUrl, { method: "HEAD", cache: "no-store" }).catch(() => null);
        if (head?.ok) return; // already persisted
      }
      const { error } = await supabase.storage.from(bucket).upload(path, body, {
        contentType: "video/mp4",
        upsert: true,
        cacheControl: "86400",
      });
      if (!error || /already exists|duplicate/i.test(error.message)) {
        console.log(`[VeniceStatus] persisted ${queueId} (${Math.round(bytes.byteLength / 1024 / 1024)}MB) to ${bucket}/${path}`);
        return;
      }
    } catch {
      // try next bucket
    }
  }
}
function extractRemoteVideoUrl(data: any): string | null {
  const candidates = [
    data?.video_url,
    data?.url,
    data?.media_url,
    data?.output?.url,
    data?.result?.url,
    data?.data?.url,
  ];
  return candidates.find((value): value is string => typeof value === "string" && value.length > 0) || null;
}

/**
 * GET /api/skills/video/venice/[queueId]/status?model=...
 * Lightweight status check for a Venice video generation job.
 * Calls Venice POST /video/retrieve to check status without downloading.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ queueId: string }> },
) {
  const { queueId } = await params;
  const model = request.nextUrl.searchParams.get("model") || "kling-2.6-pro-text-to-video";
  const apiKey = process.env.VENICE_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ ready: false, status: "error", error: "VENICE_API_KEY not configured" }, { status: 500 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    const res = await fetch(`${VENICE_VIDEO_BASE}/retrieve`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        queue_id: queueId,
        delete_media_on_completion: false,
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    const contentType = res.headers.get("content-type") || "";

    // If Venice returns video binary directly, extract thumbnail then redirect to the proxy for the full video.
    if (contentType.startsWith("video/") || contentType.startsWith("application/octet-stream")) {
      const proxyUrl = `/api/skills/video/venice/${queueId}?model=${encodeURIComponent(model)}`;
      const videoBytes = res.body ? Buffer.from(await res.arrayBuffer()) : null;
      if (videoBytes) await persistVeniceVideo(queueId, videoBytes).catch(() => {});
      const thumbBuffer = videoBytes
        ? await extractThumbnailFromBuffer(videoBytes, queueId).catch(() => null)
        : null;
      const thumbnailUrl = thumbBuffer
        ? await persistThumbnailAsset(thumbBuffer, queueId, "venice").catch(() => null)
        : null;
      return NextResponse.json({
        ready: true,
        status: "completed",
        progress: 100,
        video_url: proxyUrl,
        ...(thumbnailUrl ? { thumbnail_url: thumbnailUrl } : {}),
      });
    }

    // Otherwise it's JSON status
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const errorMessage = data?.error?.message || data?.error || `Venice API ${res.status}`;
      return NextResponse.json({
        ready: false,
        status: "error",
        error: errorMessage,
        transient_error: res.status >= 500 ? errorMessage : undefined,
      }, { status: 200 });
    }

    const status = data?.status || "PROCESSING";
    const remoteVideoUrl = extractRemoteVideoUrl(data);
    if (String(status).toLowerCase() === "completed" && remoteVideoUrl) {
      // Venice returned a remote URL — fetch a partial range for thumbnail extraction.
      const thumbBuffer = await extractThumbnailFromUrl(remoteVideoUrl, queueId).catch(() => null);
      const thumbnailUrl = thumbBuffer
        ? await persistThumbnailAsset(thumbBuffer, queueId, "venice").catch(() => null)
        : null;
      return NextResponse.json({
        ready: true,
        status: "completed",
        progress: 100,
        video_url: remoteVideoUrl,
        ...(thumbnailUrl ? { thumbnail_url: thumbnailUrl } : {}),
      });
    }
    if (String(status).toLowerCase() === "completed") {
      // Completed but no remote URL — extract from proxy stream via range request.
      const proxyUrl = `/api/skills/video/venice/${queueId}?model=${encodeURIComponent(model)}`;
      const thumbBuffer = await extractThumbnailFromUrl(proxyUrl, queueId).catch(() => null);
      const thumbnailUrl = thumbBuffer
        ? await persistThumbnailAsset(thumbBuffer, queueId, "venice").catch(() => null)
        : null;
      return NextResponse.json({
        ready: true,
        status: "completed",
        progress: 100,
        video_url: proxyUrl,
        ...(thumbnailUrl ? { thumbnail_url: thumbnailUrl } : {}),
      });
    }
    const avgTime = data?.average_execution_time || 0;
    const elapsed = data?.execution_duration || 0;
    const progress = avgTime > 0 ? Math.min(95, Math.round((elapsed / avgTime) * 100)) : 0;

    return NextResponse.json({
      ready: false,
      status,
      progress,
      average_execution_time: avgTime,
      execution_duration: elapsed,
    });
  } catch (err: any) {
    const msg = err?.name === "AbortError" ? "Status check timed out" : (err.message || String(err));
    return NextResponse.json({
      ready: false,
      status: "error",
      error: msg,
      transient_error: msg,
    }, { status: 200 });
  }
}
