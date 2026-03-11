import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const VENICE_VIDEO_BASE = "https://api.venice.ai/api/v1/video";

/**
 * GET /api/skills/video/venice/[queueId]?model=...
 * Proxy that fetches the completed video from Venice and streams it back.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ queueId: string }> },
) {
  const { queueId } = await params;
  const model = request.nextUrl.searchParams.get("model") || "kling-2.6-pro-text-to-video";
  const apiKey = process.env.VENICE_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "VENICE_API_KEY not configured" }, { status: 500 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

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

    // If still processing, return status JSON
    if (contentType.includes("application/json")) {
      const data = await res.json().catch(() => null);
      return NextResponse.json(
        { status: data?.status || "PROCESSING", error: "Video not ready yet" },
        { status: 202 },
      );
    }

    // Stream video binary back to client
    if (!res.body) {
      return NextResponse.json({ error: "No video body returned" }, { status: 502 });
    }

    const headers = new Headers();
    headers.set(
      "Content-Type",
      contentType.startsWith("video/")
        ? contentType
        : "video/mp4"
    );
    const contentLength = res.headers.get("content-length");
    if (contentLength) headers.set("Content-Length", contentLength);
    headers.set("Cache-Control", "public, max-age=86400, immutable");

    return new NextResponse(res.body as ReadableStream, { status: 200, headers });
  } catch (err: any) {
    const msg = err?.name === "AbortError" ? "Venice video fetch timed out" : (err.message || String(err));
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
