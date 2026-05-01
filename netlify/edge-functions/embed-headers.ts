// netlify/edge-functions/embed-headers.ts
import type { Context } from "https://edge.netlify.com";

export default async (request: Request, context: Context) => {
  const url = new URL(request.url);

  // Only touch the two embed routes
  if (
    !url.pathname.startsWith("/triad/embed/wallet") &&
    !url.pathname.startsWith("/triad/embed/codex")
  ) {
    return context.next();
  }

  // Let the app generate its normal response
  const originResponse = await context.next();

  const headers = new Headers(originResponse.headers);

  // 1. Remove X-Frame-Options entirely
  headers.delete("x-frame-options");
  headers.delete("X-Frame-Options");

  // 2. Replace CSP with one that allows Lovable + metame domains.
  // Keep this list in sync with configs/embed/policy.v1.json — both surfaces
  // need to allow the same parents for the iframe to render. metame.live and
  // metame.dev added 2026-04-30 (new thin-client production domains).
  const cspValue =
    "frame-ancestors 'self' https://preview--qriptopian.lovable.app https://qriptopian.lovable.app https://*.lovable.app https://*.lovable.dev https://*.lovableproject.com https://*.aigentz.me https://*.metame.com https://runtime.metame.com https://metame.live https://*.metame.live https://metame.dev https://*.metame.dev;";

  headers.set("content-security-policy", cspValue);
  headers.set("Content-Security-Policy", cspValue);

  return new Response(originResponse.body, {
    status: originResponse.status,
    statusText: originResponse.statusText,
    headers,
  });
}
