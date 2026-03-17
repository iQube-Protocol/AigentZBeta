import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_AA_UPSTREAMS = [
  "https://aa.dev-beta.aigentz.me",
  "https://aigentzbeta-production.up.railway.app",
];

function asNonEmptyString(value: string | undefined | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeAaBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/aa\/v1\/?$/i, "").replace(/\/+$/, "");
}

function resolveAaBaseUrls(): string[] {
  const configured =
    asNonEmptyString(process.env.AA_API_BASE_URL) ||
    asNonEmptyString(process.env.NEXT_PUBLIC_AA_API_BASE_URL);
  if (configured) {
    return [normalizeAaBaseUrl(configured)];
  }
  return DEFAULT_AA_UPSTREAMS.map(normalizeAaBaseUrl);
}

function buildUpstreamUrl(baseUrl: string, request: NextRequest, pathSegments: string[]): string {
  const joinedPath = pathSegments.join("/");
  const query = request.nextUrl.search || "";
  return `${baseUrl}/aa/v1/browser/${joinedPath}${query}`;
}

async function proxyBrowserRequest(
  request: NextRequest,
  context: { params: { path?: string[] } }
): Promise<Response> {
  try {
    const pathSegments = context.params.path ?? [];
    const requestBody = request.method !== "GET" && request.method !== "HEAD" ? await request.text() : undefined;
    const upstreams = resolveAaBaseUrls();
    let lastResponse: Response | null = null;
    let lastBody = "";

    for (const upstreamBaseUrl of upstreams) {
      const upstreamUrl = buildUpstreamUrl(upstreamBaseUrl, request, pathSegments);
      const headers = new Headers();
      const contentType = request.headers.get("content-type");
      const authorization = request.headers.get("authorization");
      const tenantId = request.headers.get("x-tenant-id");
      const personaId = request.headers.get("x-persona-id");

      if (contentType) headers.set("content-type", contentType);
      if (authorization) headers.set("authorization", authorization);
      if (tenantId) headers.set("x-tenant-id", tenantId);
      if (personaId) headers.set("x-persona-id", personaId);

      const init: RequestInit = {
        method: request.method,
        headers,
        redirect: "follow",
        body: requestBody,
      };

      const upstream = await fetch(upstreamUrl, init);
      const contentTypeHeader = upstream.headers.get("content-type") || "application/json";
      const isEventStream = contentTypeHeader.includes("text/event-stream");

      if (isEventStream) {
        return new Response(upstream.body, {
          status: upstream.status,
          statusText: upstream.statusText,
          headers: {
            "content-type": contentTypeHeader,
            "cache-control": upstream.headers.get("cache-control") || "no-cache, no-transform",
          },
        });
      }

      const body = await upstream.text();
      lastResponse = upstream;
      lastBody = body;

      const shouldTryNextUpstream =
        !upstream.ok &&
        upstreamBaseUrl !== upstreams[upstreams.length - 1] &&
        (upstream.status >= 500 ||
          upstream.status === 404 ||
          (upstream.status === 400 && body.toLowerCase().includes("unknown action")));

      if (shouldTryNextUpstream) {
        continue;
      }

      return new Response(body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: {
          "content-type": contentTypeHeader,
        },
      });
    }

    return new Response(lastBody || JSON.stringify({ error: "Browser upstream unavailable" }), {
      status: lastResponse?.status || 502,
      statusText: lastResponse?.statusText || "Bad Gateway",
      headers: {
        "content-type": lastResponse?.headers.get("content-type") || "application/json",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown browser proxy error";
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: {
        "content-type": "application/json",
      },
    });
  }
}

export async function GET(request: NextRequest, context: { params: { path?: string[] } }) {
  return proxyBrowserRequest(request, context);
}

export async function POST(request: NextRequest, context: { params: { path?: string[] } }) {
  return proxyBrowserRequest(request, context);
}

export async function OPTIONS(request: NextRequest, context: { params: { path?: string[] } }) {
  return proxyBrowserRequest(request, context);
}
