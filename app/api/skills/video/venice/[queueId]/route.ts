import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const VENICE_VIDEO_BASE = "https://api.venice.ai/api/v1/video";
const RETRIEVE_RETRY_MS = 2000;
const RETRIEVE_MAX_ATTEMPTS = 8;

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
 * GET /api/skills/video/venice/[queueId]?model=...
 * Proxy that fetches the completed video from Venice and streams it back.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ queueId: string }> },
) {
  const { queueId } = await params;
  const model = request.nextUrl.searchParams.get("model") || "kling-2.6-pro-text-to-video";
  const remoteUrl = request.nextUrl.searchParams.get("remote") || "";
  const apiKey = process.env.VENICE_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "VENICE_API_KEY not configured" }, { status: 500 });
  }

  try {
    if (remoteUrl) {
      const remoteRes = await fetch(remoteUrl, { cache: "no-store" });
      if (remoteRes.ok && remoteRes.body) {
        const remoteType = remoteRes.headers.get("content-type") || "video/mp4";
        return new NextResponse(remoteRes.body as ReadableStream, {
          status: 200,
          headers: {
            "Content-Type": remoteType.startsWith("video/") ? remoteType : "video/mp4",
            "Cache-Control": "public, max-age=86400, immutable",
          },
        });
      }
    }

    for (let attempt = 0; attempt < RETRIEVE_MAX_ATTEMPTS; attempt += 1) {
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

      if (!contentType.includes("application/json")) {
        if (!res.body) {
          return NextResponse.json({ error: "No video body returned" }, { status: 502 });
        }

        const headers = new Headers();
        headers.set(
          "Content-Type",
          contentType.startsWith("video/") ? contentType : "video/mp4"
        );
        const contentLength = res.headers.get("content-length");
        if (contentLength) headers.set("Content-Length", contentLength);
        headers.set("Cache-Control", "public, max-age=86400, immutable");

        return new NextResponse(res.body as ReadableStream, { status: 200, headers });
      }

      const data = await res.json().catch(() => null);
      const status = String(data?.status || "PROCESSING").toLowerCase();
      const extractedRemoteUrl = extractRemoteVideoUrl(data);

      if (status === "completed" && extractedRemoteUrl) {
        const remoteRes = await fetch(extractedRemoteUrl, { cache: "no-store" });
        if (remoteRes.ok && remoteRes.body) {
          const remoteType = remoteRes.headers.get("content-type") || "video/mp4";
          return new NextResponse(remoteRes.body as ReadableStream, {
            status: 200,
            headers: {
              "Content-Type": remoteType.startsWith("video/") ? remoteType : "video/mp4",
              "Cache-Control": "public, max-age=86400, immutable",
            },
          });
        }
      }

      if (status === "completed" || status === "failed") {
        return NextResponse.json(
          { status: data?.status || "PROCESSING", error: data?.error || "Video not ready yet" },
          { status: 202 },
        );
      }

      if (attempt < RETRIEVE_MAX_ATTEMPTS - 1) {
        await new Promise((resolve) => setTimeout(resolve, RETRIEVE_RETRY_MS));
      }
    }

    return NextResponse.json(
      { status: "PROCESSING", error: "Video not ready yet" },
      { status: 202 },
    );
  } catch (err: any) {
    const msg = err?.name === "AbortError" ? "Venice video fetch timed out" : (err.message || String(err));
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
