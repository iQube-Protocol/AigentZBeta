import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/skills/video/[id]
 *
 * Proxy endpoint for completed OpenAI/Sora videos.
 * Rather than streaming the full video body through Lambda (which hits
 * CloudFront's 6 MB response limit with a 413), this route:
 *   1. Checks if the video has already been uploaded to Supabase storage.
 *   2. If not, downloads from OpenAI and uploads to Supabase.
 *   3. Returns a 302 redirect to the Supabase public URL.
 * The browser then fetches the video directly from Supabase CDN.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

const BUCKET_CANDIDATES = [
  process.env.SUPABASE_STORAGE_BUCKET,
  "content-assets",
  "assets",
  "codex-lite",
].filter((v, i, arr): v is string => Boolean(v) && arr.indexOf(v) === i);

interface RouteParams {
  params: Promise<{ id: string }>;
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function supabaseVideoPath(videoId: string): string {
  return `generated/openai/videos/${videoId}.mp4`;
}

async function findCachedSupabaseUrl(videoId: string): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const path = supabaseVideoPath(videoId);
  for (const bucket of BUCKET_CANDIDATES) {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    if (!data?.publicUrl) continue;
    try {
      const check = await fetch(data.publicUrl, { method: "HEAD", cache: "no-store" });
      if (check.ok) return data.publicUrl;
    } catch {
      // not cached in this bucket — try next
    }
  }
  return null;
}

async function uploadToSupabase(videoId: string, body: ArrayBuffer, contentType: string): Promise<string> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase not configured");
  const path = supabaseVideoPath(videoId);
  const errors: string[] = [];
  for (const bucket of BUCKET_CANDIDATES) {
    try {
      const { error } = await supabase.storage.from(bucket).upload(path, body, {
        contentType,
        upsert: true,
        cacheControl: "86400",
      });
      if (error && !/already exists/i.test(error.message) && !/duplicate/i.test(error.message)) {
        errors.push(`${bucket}: ${error.message}`);
        continue;
      }
      return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    } catch (e) {
      errors.push(`${bucket}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  throw new Error(errors.join(" | ") || "Failed to upload video to Supabase");
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id: videoId } = await params;

  if (!videoId) {
    return NextResponse.json({ error: "Video ID is required" }, { status: 400 });
  }

  // Fast path: already uploaded to Supabase
  const cached = await findCachedSupabaseUrl(videoId);
  if (cached) {
    return NextResponse.redirect(cached, { status: 302 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 50_000);
    const res = await fetch(
      `https://api.openai.com/v1/videos/${videoId}/content`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        redirect: "follow",
        signal: controller.signal,
      },
    ).finally(() => clearTimeout(timeout));

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error(`[VideoProxy] OpenAI returned ${res.status}: ${errBody.substring(0, 200)}`);
      return NextResponse.json(
        { error: `Video not available (${res.status})` },
        { status: res.status },
      );
    }

    const contentType = res.headers.get("content-type") || "video/mp4";
    const body = await res.arrayBuffer();

    const supabaseUrl = await uploadToSupabase(videoId, body, contentType);
    return NextResponse.redirect(supabaseUrl, { status: 302 });
  } catch (err: any) {
    const msg = err?.name === "AbortError"
      ? "Video fetch timed out"
      : (err.message || "Failed to fetch video");
    console.error("[VideoProxy] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
