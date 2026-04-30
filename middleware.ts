import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import embedPolicy from '@/configs/embed/policy.v1.json';

const EMBED_PREFIX = '/triad/embed';
const EMBED_FRAME_ANCESTORS = embedPolicy.frameAncestors.join(' ');
const EMBED_CSP = `frame-ancestors ${EMBED_FRAME_ANCESTORS};`;

// Performance tracking
const performanceMetrics = new Map<string, {
  count: number;
  totalDuration: number;
  errors: number;
}>();

// Rate limiting store
const rateLimitStore = new Map<string, number[]>();

/**
 * Paths that need to be embeddable in external thin-client iframes.
 *
 * - `/`           → redirects to `/metame/runtime`; the parent thin client
 *                   (e.g. Lovable at metame.live) embeds this as the runtime
 *                   entry point. Must NOT carry X-Frame-Options.
 * - `/metame/runtime`        → the runtime page itself.
 * - `/metame/runtime/...`    → any sub-route under the runtime.
 * - `/triad/embed/...`       → cartridge / wallet / admin embeds. Loaded as
 *                              nested iframes inside the runtime.
 *
 * X-Frame-Options is DELETED on these paths (Firefox enforces it strictly,
 * even when CSP frame-ancestors is also set, so the header has to be absent
 * — not weak). The frame-ancestors CSP from policy.v1.json is set instead.
 */
function isEmbeddablePath(path: string): boolean {
  if (path === '/' || path === '') return true;
  if (path === '/metame/runtime' || path.startsWith('/metame/runtime/')) return true;
  if (path.startsWith(EMBED_PREFIX + '/') || path === EMBED_PREFIX) return true;
  return false;
}

export function middleware(request: NextRequest) {
  const startTime = performance.now();
  const urlPath = request.nextUrl.pathname;

  // ─── 1. Embeddable routes ───────────────────────────────────────────────────
  // Single source of truth for the X-Frame-Options + frame-ancestors policy
  // on iframe-target routes. Was previously split across next.config headers()
  // (with a path-to-regexp negative lookahead that doesn't work reliably) and
  // middleware — that combination silently re-applied X-Frame-Options=SAMEORIGIN
  // on embed routes and Firefox blocked the iframe.
  if (isEmbeddablePath(urlPath)) {
    const response = NextResponse.next();

    // Cache-bust the runtime entry-points so a stale shell never sticks.
    if (urlPath === '/' || urlPath === '/metame/runtime' || urlPath.startsWith('/metame/runtime/')) {
      response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
    }

    response.headers.delete('X-Frame-Options');
    response.headers.delete('x-frame-options');
    response.headers.set('Content-Security-Policy', EMBED_CSP);

    return response;
  }

  // ─── 2. API routes ──────────────────────────────────────────────────────────
  if (urlPath.startsWith('/api/')) {
    // Rate limiting
    const clientId = request.ip || 'unknown';
    const now = Date.now();
    const windowStart = now - (60 * 1000); // 1 minute window

    if (!rateLimitStore.has(clientId)) {
      rateLimitStore.set(clientId, []);
    }

    const requests = rateLimitStore.get(clientId)!;
    const recentRequests = requests.filter((time: number) => time > windowStart);

    if (recentRequests.length > 100) { // 100 requests per minute
      return new NextResponse(
        JSON.stringify({ error: 'Rate limit exceeded' }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    recentRequests.push(now);
    rateLimitStore.set(clientId, recentRequests);

    // Handle preflight requests first
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': 'https://theqriptopian.netlify.app',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Cache-Control, Pragma, Expires',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    const response = NextResponse.next();

    // Add CORS headers for actual requests
    response.headers.set('Access-Control-Allow-Origin', 'https://theqriptopian.netlify.app');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Cache-Control, Pragma, Expires');
    response.headers.set('Access-Control-Max-Age', '86400');

    // Add performance headers
    const responseTime = performance.now() - startTime;
    response.headers.set('X-Response-Time', `${responseTime.toFixed(2)}ms`);

    // Add security headers
    response.headers.set('X-Content-Type-Options', 'nosniff');
    const isPdfViewerApi =
      urlPath.startsWith('/api/content/pdf/') ||
      urlPath.startsWith('/api/content/pdf-page/');
    if (isPdfViewerApi) {
      response.headers.delete('X-Frame-Options');
      response.headers.delete('x-frame-options');
      response.headers.set('Content-Security-Policy', EMBED_CSP);
    } else {
      response.headers.set('X-Frame-Options', 'DENY');
    }
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Add compression hints for large responses
    if (urlPath.includes('/experiences') ||
        urlPath.includes('/tenants') ||
        urlPath.includes('/channels')) {
      response.headers.set('X-Compress', 'true');
    }

    // Cache control for static-like endpoints
    if (urlPath.includes('/templates') ||
        urlPath.includes('/status') ||
        urlPath.includes('/hierarchy')) {
      response.headers.set('Cache-Control', 'public, max-age=300'); // 5 minutes
    }

    // Track performance metrics
    trackPerformance(urlPath, responseTime, 200);

    return response;
  }

  // ─── 3. Default — operator-facing routes ───────────────────────────────────
  // Everything else (shell pages, dashboard, CRM, codex viewer, etc.) is
  // operator-facing and shouldn't render in an iframe. SAMEORIGIN keeps these
  // consistent with the security posture the (now-removed) next.config
  // negative-lookahead was trying to provide.
  const response = NextResponse.next();
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  return response;
}

function trackPerformance(endpoint: string, duration: number, status: number) {
  if (!performanceMetrics.has(endpoint)) {
    performanceMetrics.set(endpoint, {
      count: 0,
      totalDuration: 0,
      errors: 0,
    });
  }

  const metric = performanceMetrics.get(endpoint)!;
  metric.count++;
  metric.totalDuration += duration;

  if (status >= 400) {
    metric.errors++;
  }

  // Keep only recent metrics
  if (metric.count > 1000) {
    metric.count = Math.floor(metric.count / 2);
    metric.totalDuration = metric.totalDuration / 2;
    metric.errors = Math.floor(metric.errors / 2);
  }
}

export function getPerformanceMetrics() {
  const metrics: any = {};

  performanceMetrics.forEach((value, key) => {
    metrics[key] = {
      ...value,
      avgResponseTime: value.totalDuration / value.count,
      errorRate: value.errors / value.count,
    };
  });

  return metrics;
}

export const config = {
  // Match every route except Next.js internals and static assets. The
  // middleware itself decides per-path what header policy applies. This is
  // the single source of truth for X-Frame-Options + frame-ancestors —
  // next.config.js no longer sets X-Frame-Options anywhere.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.well-known).*)'],
};
