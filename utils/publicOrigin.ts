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
  // 1. Configured public host — the trusted source. Set NEXT_PUBLIC_APP_URL in
  //    the environment so origin never depends on a client-settable header
  //    (security review 2026-07-21, Finding 1: x-forwarded-host is spoofable and
  //    was feeding OAuth `.well-known` metadata + the Threshold canon self-fetch).
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  // 2. Forwarded host — trusted ONLY when it matches a configured allowlist.
  //    `THRESHOLD_TRUSTED_HOSTS` is a comma-separated host list (e.g.
  //    "dev-beta.aigentz.me,beta.aigentz.me"). When the allowlist is set, an
  //    unrecognised x-forwarded-host is ignored (falls through), so a spoofed
  //    Host header can no longer poison absolute links. When neither the env
  //    host nor the allowlist is configured, behaviour is unchanged (the proxy
  //    host is used) — configure NEXT_PUBLIC_APP_URL to fully close this.
  const fwdHost = req.headers.get('x-forwarded-host');
  if (fwdHost) {
    const allow = (process.env.THRESHOLD_TRUSTED_HOSTS || '')
      .split(',')
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean);
    const hostOk = allow.length === 0 || allow.includes(fwdHost.toLowerCase());
    if (hostOk) {
      const proto = req.headers.get('x-forwarded-proto') || 'https';
      return `${proto}://${fwdHost}`.replace(/\/$/, '');
    }
  }

  const origin = req.headers.get('origin') || req.nextUrl.origin;
  return origin.replace(/\/$/, '');
}
