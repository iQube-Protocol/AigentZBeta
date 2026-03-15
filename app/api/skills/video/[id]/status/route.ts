import { NextRequest, NextResponse } from "next/server";

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
      return NextResponse.json({
        ready: true,
        status: "completed",
        progress: 100,
        video_url: `/api/skills/video/${videoId}`,
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
