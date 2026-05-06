/**
 * Server-side admin gate stub.
 *
 * SCOPE: this is a stub used by Sprint 4 admin API routes (investor dashboard).
 * The full IAM service (in flight on a separate workstream) will replace this
 * with a persona-resolved admin check sourced from the iQube identity layer.
 *
 * Until then, this provides a uniform check site so the swap is a single-file
 * change later — every admin route imports `requireAdmin(req)` instead of
 * inlining its own header check.
 *
 * Acceptance:
 *   • development / localhost — always allowed (so local UI work isn't blocked)
 *   • production — requires `x-admin-token` header matching ADMIN_TOKEN env var
 *
 * DO NOT use this for dual-use endpoints that also serve non-admins. It only
 * answers "is this caller authorized to perform admin actions?", nothing more.
 */

import type { NextRequest } from 'next/server';

export function requireAdmin(req: NextRequest): boolean {
  const isDev = process.env.NODE_ENV !== 'production';
  const isLocalhost = req.url.includes('localhost') || req.url.includes('127.0.0.1');
  if (isDev || isLocalhost) return true;

  const token = req.headers.get('x-admin-token');
  return !!token && token === process.env.ADMIN_TOKEN;
}
