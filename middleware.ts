import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const EMBED_PREFIX = '/triad/embed';

export function middleware(request: NextRequest) {
  const urlPath = request.nextUrl.pathname;
  
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
  
  // Handle CORS for all API routes
  if (urlPath.startsWith('/api/')) {
    const response = NextResponse.next();
    
    // Add CORS headers
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    
    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: response.headers });
    }
    
    return response;
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*', '/triad/embed/:path*'],
};
