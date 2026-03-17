import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const DEFAULT_AA_PROXY_BASE_URL =
  "https://bsjhfvctmduxhohtllly.supabase.co/functions/v1/aa-proxy/";

function asNonEmptyString(value: string | undefined | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveAaBaseUrl(): string {
  return (
    asNonEmptyString(process.env.AA_API_BASE_URL) ||
    asNonEmptyString(process.env.NEXT_PUBLIC_AA_API_BASE_URL) ||
    DEFAULT_AA_PROXY_BASE_URL
  );
}

function buildUpstreamUrl(request: NextRequest, pathSegments: string[]): string {
  const baseUrl = resolveAaBaseUrl().replace(/\/+$/, "");
  const joinedPath = pathSegments.join("/");
  const query = request.nextUrl.search || "";
  return `${baseUrl}/aa/v1/browser/${joinedPath}${query}`;
}

async function proxyBrowserRequest(
  request: NextRequest,
  context: { params: { path?: string[] } }
): Promise<Response> {
  const pathSegments = context.params.path ?? [];
  const upstreamUrl = buildUpstreamUrl(request, pathSegments);

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
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.text();
  }

  const upstream = await fetch(upstreamUrl, init);
  const responseHeaders = new Headers(upstream.headers);
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
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
