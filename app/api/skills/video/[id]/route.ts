import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/skills/video/[id]
 *
 * Proxy endpoint that streams a completed Sora video from
 * OpenAI's GET /v1/videos/{video_id}/content endpoint.
 * This avoids exposing the OPENAI_API_KEY to the browser.
 */

export const runtime = "nodejs";

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
    return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
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

    // Stream the video body through to the client
    const contentType = res.headers.get("content-type") || "video/mp4";
    const contentLength = res.headers.get("content-length");

    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600",
    };
    if (contentLength) {
      headers["Content-Length"] = contentLength;
    }

    // Pass through the ReadableStream from the OpenAI response
    return new NextResponse(res.body as ReadableStream, {
      status: 200,
      headers,
    });
  } catch (err: any) {
    console.error("[VideoProxy] Error:", err.message || err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch video" },
      { status: 500 },
    );
  }
}
