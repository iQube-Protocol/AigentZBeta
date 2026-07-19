/**
 * publicOrigin — the externally-reachable origin for building absolute links
 * (invitations, accession pages) from inside an API route.
 *
 * Behind Amplify's proxy, `new URL(req.url).origin` / `req.nextUrl.origin`
 * resolves to the INTERNAL `http://localhost:3000`, which then leaks into
 * emailed invite links. Precedence (mirrors the canonical helper in
 * app/api/wallet/tasks/share-link/route.ts, plus a forwarded-host fallback
 * for the proxied Lambda):
 *   1. NEXT_PUBLIC_APP_URL / NEXT_PUBLIC_BASE_URL  (configured public host)
 *   2. x-forwarded-proto + x-forwarded-host        (proxy-provided)
 *   3. origin header
 *   4. req.nextUrl.origin                           (last resort)
 *
 * No hardcoded hostnames (repo No-Guessing rule) — the value comes from env
 * or the request.
 */

import type { NextRequest } from 'next/server';

export function publicOrigin(req: NextRequest): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  const fwdHost = req.headers.get('x-forwarded-host');
  if (fwdHost) {
    const proto = req.headers.get('x-forwarded-proto') || 'https';
    return `${proto}://${fwdHost}`.replace(/\/$/, '');
  }

  const origin = req.headers.get('origin') || req.nextUrl.origin;
  return origin.replace(/\/$/, '');
}
