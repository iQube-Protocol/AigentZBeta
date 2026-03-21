import { NextRequest, NextResponse } from "next/server";
import { StorageAdapterFactory } from "@/services/content/storageAdapter";
import { createClient } from "@supabase/supabase-js";
import {
  extractThumbnailFromBuffer,
  persistThumbnailAsset,
} from "@/app/api/skills/video/_thumbnail";

/**
 * GET /api/skills/video/[id]/status
 *
 * Lightweight status check for a Sora video generation job.
 * Calls GET /v1/videos/{video_id} (metadata only, no content download)
 * and returns the current status so the client can poll cheaply.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const GENERATED_MEDIA_BUCKET_CANDIDATES = [
  process.env.SUPABASE_STORAGE_BUCKET,
  "content-assets",
  "assets",
  "codex-lite",
].filter((value, index, array): value is string => Boolean(value) && array.indexOf(value) === index);

let cachedSupabaseAdmin:
  | ReturnType<typeof createClient>
  | null = null;

function getSupabaseAdmin() {
  if (cachedSupabaseAdmin) return cachedSupabaseAdmin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  cachedSupabaseAdmin = createClient(url, key);
  return cachedSupabaseAdmin;
}

async function ensureStorageBucketExists(bucket: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  const { error } = await supabase.storage.createBucket(bucket, {
    public: true,
    fileSizeLimit: "250MB",
  });

  if (
    error &&
    !/already exists/i.test(error.message) &&
    !/duplicate/i.test(error.message)
  ) {
    throw error;
  }
}

async function persistCompletedVideoAsset(options: {
  videoId: string;
  contentType: string;
  data: ArrayBuffer;
}) {
  const adapter = StorageAdapterFactory.getAdapter("supabase");
  const extension = options.contentType.includes("webm")
    ? "webm"
    : options.contentType.includes("ogg")
      ? "ogv"
      : "mp4";
  const path = `generated/openai/videos/${options.videoId}.${extension}`;
  const errors: string[] = [];

  for (const bucket of GENERATED_MEDIA_BUCKET_CANDIDATES) {
    try {
      const uploaded = await adapter.upload(bucket, path, options.data, {
        contentType: options.contentType,
        upsert: true,
        cacheControl: "31536000",
      });
      return uploaded.publicUrl || adapter.getPublicUrl(bucket, path);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/bucket not found/i.test(message)) {
        try {
          await ensureStorageBucketExists(bucket);
          const uploaded = await adapter.upload(bucket, path, options.data, {
            contentType: options.contentType,
            upsert: true,
            cacheControl: "31536000",
          });
          return uploaded.publicUrl || adapter.getPublicUrl(bucket, path);
        } catch (retryError) {
          const retryMessage = retryError instanceof Error ? retryError.message : String(retryError);
          errors.push(`${bucket}: ${retryMessage}`);
          continue;
        }
      }
      errors.push(`${bucket}: ${message}`);
    }
  }

  throw new Error(errors.join(" | "));
}

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
      const contentRes = await fetch(`https://api.openai.com/v1/videos/${videoId}/content`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        redirect: "follow",
        cache: "no-store",
      });

      if (!contentRes.ok) {
        const errBody = await contentRes.text().catch(() => "");
        const message = errBody || `OpenAI content ${contentRes.status}`;
        return NextResponse.json({
          ready: false,
          status: "error",
          error: message,
          checked_at: new Date().toISOString(),
        }, {
          headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
        });
      }

      const contentType = contentRes.headers.get("content-type") || "video/mp4";
      const buffer = await contentRes.arrayBuffer();
      const persistedUrl = await persistCompletedVideoAsset({
        videoId,
        contentType,
        data: buffer,
      });

      // Extract and persist a JPEG thumbnail at 1 s — ready alongside the video.
      const thumbBuffer = await extractThumbnailFromBuffer(Buffer.from(buffer), videoId).catch(() => null);
      const thumbnailUrl = thumbBuffer
        ? await persistThumbnailAsset(thumbBuffer, videoId, "openai").catch(() => null)
        : null;

      return NextResponse.json({
        ready: true,
        status: "completed",
        progress: 100,
        video_url: persistedUrl,
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
