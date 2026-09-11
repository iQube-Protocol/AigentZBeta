/**
 * Legacy /api/registry/templates + /api/registry/library deprecation
 * helper.
 *
 * Phase C C5 of the legacy /registry → canonical SoT integration.
 *
 * Wraps a Next.js route handler so every response carries:
 *   X-Deprecated: true
 *   X-Deprecation-Replacement: <canonical-route>
 *   X-Deprecation-Phase: c5-observation-window
 *
 * Also logs a single warning per Lambda cold start so CloudWatch
 * surfaces ongoing legacy traffic. After 30 days of zero observed
 * traffic (operator decision), the underlying routes hard-delete.
 *
 * Usage:
 *   import { withDeprecation } from '@/services/registry/legacy/deprecation';
 *
 *   async function _GET(req: NextRequest) { ... }
 *   export const GET = withDeprecation(_GET, {
 *     route: '/api/registry/templates',
 *     replacement: 'GET /api/registry/iqube?expand=cartridge',
 *   });
 */

import type { NextRequest, NextResponse } from 'next/server';

interface DeprecationOpts {
  route: string;
  replacement: string;
}

const warnedRoutes = new Set<string>();

function logOnce(opts: DeprecationOpts) {
  if (warnedRoutes.has(opts.route)) return;
  warnedRoutes.add(opts.route);
  console.warn(
    `[deprecated-route] ${opts.route} — replacement: ${opts.replacement}. ` +
      `See codexes/packs/agentiq/updates/2026-05-31_legacy-registry-canonical-integration-plan.md §Phase C C5.`,
  );
}

type Handler = (req: NextRequest, ctx?: unknown) => Promise<NextResponse> | NextResponse;

export function withDeprecation<H extends Handler>(handler: H, opts: DeprecationOpts): H {
  const wrapped = (async (req: NextRequest, ctx?: unknown) => {
    logOnce(opts);
    const res = await handler(req, ctx);
    try {
      res.headers.set('X-Deprecated', 'true');
      res.headers.set('X-Deprecation-Replacement', opts.replacement);
      res.headers.set('X-Deprecation-Phase', 'c5-observation-window');
    } catch {
      // Some response shapes (streams, redirects) don't expose headers;
      // never let header-set failures break the response itself.
    }
    return res;
  }) as H;
  return wrapped;
}
