/**
 * GET /api/marketa/media?url=<supabase-storage-url>
 *
 * Streams Supabase storage assets (images, video) through our origin so the
 * browser never makes a cross-origin request that trips OpaqueResponseBlocking.
 * Forwards Range headers so HTML5 <video> seeking works correctly.
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SUPABASE_URL = (
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  ""
).replace(/\/$/, "");

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) return NextResponse.json({ error: "url required" }, { status: 400 });

  // Only proxy assets from our own Supabase project
  if (!SUPABASE_URL || !raw.startsWith(SUPABASE_URL + "/storage/")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const fetchHeaders: Record<string, string> = {};

  // Auth header — service role key works for both public and authenticated buckets
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (key) fetchHeaders["Authorization"] = `Bearer ${key}`;

  // Forward Range header so the browser can seek inside the video
  const range = req.headers.get("range");
  if (range) fetchHeaders["Range"] = range;

  let upstream: Response;
  try {
    upstream = await fetch(raw, { headers: fetchHeaders });
  } catch {
    return NextResponse.json({ error: "upstream fetch failed" }, { status: 502 });
  }

  const resHeaders = new Headers();
  resHeaders.set("Access-Control-Allow-Origin", "*");
  resHeaders.set("Cache-Control", "public, max-age=3600");

  // Pass through content headers needed by <video> and <img>
  for (const h of ["content-type", "content-length", "content-range", "accept-ranges", "last-modified", "etag"]) {
    const v = upstream.headers.get(h);
    if (v) resHeaders.set(h, v);
  }

  // Supabase returns application/octet-stream for uppercase extensions (.MP4, .JPG).
  // Force the correct MIME type so <video> and <img> elements accept the response.
  const upstreamType = upstream.headers.get("content-type") ?? "";
  if (!upstreamType || upstreamType === "application/octet-stream") {
    const ext = raw.split("?")[0].split(".").pop()?.toLowerCase();
    const mime: Record<string, string> = {
      mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", ogg: "video/ogg",
      jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp",
    };
    if (ext && mime[ext]) resHeaders.set("content-type", mime[ext]);
  }

  // Ensure Accept-Ranges is set so browsers attempt range requests for seeking
  if (!resHeaders.has("accept-ranges")) {
    resHeaders.set("accept-ranges", "bytes");
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: resHeaders,
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Range",
    },
  });
}
