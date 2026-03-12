import { NextRequest, NextResponse } from "next/server";
import { StorageAdapterFactory } from "@/services/content/storageAdapter";

export const runtime = "nodejs";

const VENICE_VIDEO_BASE = "https://api.venice.ai/api/v1/video";
const VIDEO_BUCKET = "content-assets";
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

async function persistCompletedVideo(options: {
  queueId: string;
  model: string;
  contentType: string;
  data: ArrayBuffer;
}) {
  const adapter = StorageAdapterFactory.getAdapter("supabase");
  const safeModel = options.model.replace(/[^a-zA-Z0-9._-]/g, "_");
  const extension = options.contentType.includes("webm")
    ? "webm"
    : options.contentType.includes("quicktime")
    ? "mov"
    : "mp4";
  const path = `generated/venice/videos/${options.queueId}-${safeModel}.${extension}`;

  const alreadyExists = await adapter.exists(VIDEO_BUCKET, path).catch(() => false);
  if (alreadyExists) {
    return adapter.getPublicUrl(VIDEO_BUCKET, path);
  }

  const uploaded = await adapter.upload(VIDEO_BUCKET, path, options.data, {
    contentType: options.contentType.startsWith("video/") ? options.contentType : "video/mp4",
    upsert: true,
    cacheControl: "31536000",
  });

  return uploaded.publicUrl || adapter.getPublicUrl(VIDEO_BUCKET, path);
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

    // If Venice returns video binary, it's ready
    if (contentType.startsWith("video/") || contentType.startsWith("application/octet-stream")) {
      const videoUrl = await persistCompletedVideo({
        queueId,
        model,
        contentType: contentType.startsWith("video/") ? contentType : "video/mp4",
        data: await res.arrayBuffer(),
      });
      return NextResponse.json({
        ready: true,
        status: "completed",
        progress: 100,
        video_url: videoUrl,
      });
    }

    // Otherwise it's JSON status
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      return NextResponse.json({
        ready: false,
        status: "error",
        error: data?.error?.message || data?.error || `Venice API ${res.status}`,
      }, { status: 502 });
    }

    const status = data?.status || "PROCESSING";
    const remoteVideoUrl = extractRemoteVideoUrl(data);
    if (String(status).toLowerCase() === "completed" && remoteVideoUrl) {
      const remoteRes = await fetch(remoteVideoUrl, { cache: "no-store" });
      if (!remoteRes.ok) {
        return NextResponse.json({
          ready: false,
          status: "error",
          error: `Failed to fetch completed Venice media (${remoteRes.status})`,
        }, { status: 502 });
      }
      const contentType = remoteRes.headers.get("content-type") || "video/mp4";
      const videoUrl = await persistCompletedVideo({
        queueId,
        model,
        contentType,
        data: await remoteRes.arrayBuffer(),
      });
      return NextResponse.json({
        ready: true,
        status: "completed",
        progress: 100,
        video_url: videoUrl,
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
    return NextResponse.json({ ready: false, status: "error", error: msg }, { status: 502 });
  }
}
