import type { NextRequest } from 'next/server';

/**
 * Resolves the public origin (proto + host) for an incoming request, honouring
 * the Amplify/CloudFront forwarded headers. Used to build agent card URLs that
 * point back at the deployed host rather than the internal Lambda origin.
 */
export function resolveRequestOrigin(req: NextRequest): string {
  const forwardedHost = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  return forwardedHost ? `${proto}://${forwardedHost}` : req.nextUrl.origin;
}
