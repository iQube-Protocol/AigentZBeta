import type { Context } from "https://edge.netlify.com";

export default async function handler(req: Request, context: Context) {
  const res = await context.next();
  const url = new URL(req.url);

  if (!url.pathname.startsWith("/triad/embed/")) {
    return res;
  }

  // Clone and adjust headers
  const headers = new Headers(res.headers);

  // 1) Remove frame-blocking headers
  headers.delete("x-frame-options");

  // 2) Replace frame-ancestors with one that allows Lovable + self
  // (Keep other CSP directives if they exist.)
  const baseCsp = headers.get("content-security-policy") ?? "";
  const withoutFrameAncestors = baseCsp
    .split(";")
    .filter(d => !d.trim().toLowerCase().startsWith("frame-ancestors"))
    .join(";");

  // Keep in sync with configs/embed/policy.v1.json. metame.live + metame.dev
  // added 2026-04-30 (new thin-client production domains).
  const frameAncestors =
    "frame-ancestors 'self' https://preview--qriptopian.lovable.app https://qriptopian.lovable.app https://*.lovable.app https://*.lovable.dev https://*.lovableproject.com https://*.aigentz.me https://*.metame.com https://runtime.metame.com https://metame.live https://*.metame.live https://metame.dev https://*.metame.dev http://localhost:3000";

  const newCsp = [withoutFrameAncestors, frameAncestors]
    .filter(Boolean)
    .join("; ");

  headers.set("content-security-policy", newCsp);

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}
