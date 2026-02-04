import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const EMBED_PREFIX = '/triad/embed';

// Performance tracking
const performanceMetrics = new Map<string, {
  count: number;
  totalDuration: number;
  errors: number;
}>();

// Rate limiting store
const rateLimitStore = new Map<string, number[]>();

export function middleware(request: NextRequest) {
  const startTime = performance.now();
  const urlPath = request.nextUrl.pathname;
  
  // Handle metaMe runtime page - prevent caching
  if (urlPath.startsWith('/metame/runtime')) {
    const response = NextResponse.next();
    
    // Prevent caching of the runtime page
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
  }
  
  // Handle SmartTriad embed routes - allow embedding in Lovable
  if (urlPath.startsWith(EMBED_PREFIX)) {
    const response = NextResponse.next();
    
    // Remove X-Frame-Options to allow embedding
    response.headers.delete('X-Frame-Options');
    response.headers.delete('x-frame-options');
    
    // Set CSP with frame-ancestors for Lovable + self
    const csp = "frame-ancestors 'self' https://qriptopian.lovable.app https://preview--qriptopian.lovable.app;";
    response.headers.set('Content-Security-Policy', csp);
    
    return response;
  }
  
  // Handle CORS and performance for all API routes
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
    response.headers.set('X-Frame-Options', 'DENY');
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
  
  return NextResponse.next();
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
  matcher: ['/triad/embed/:path*', '/metame/runtime/:path*'],
};
