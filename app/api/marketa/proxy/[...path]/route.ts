import { NextRequest, NextResponse } from 'next/server';

// Base URL for the external API
const EXTERNAL_API_BASE = 'https://dev-beta.aigentz.me';

export async function GET(request: NextRequest) {
  return handleProxyRequest(request);
}

export async function POST(request: NextRequest) {
  return handleProxyRequest(request);
}

export async function PUT(request: NextRequest) {
  return handleProxyRequest(request);
}

export async function DELETE(request: NextRequest) {
  return handleProxyRequest(request);
}

export async function PATCH(request: NextRequest) {
  return handleProxyRequest(request);
}

async function handleProxyRequest(request: NextRequest) {
  try {
    // Get the request path
    const url = new URL(request.url);
    const path = url.pathname.replace('/api/marketa/proxy', '');
    
    // Build the external URL
    const externalUrl = `${EXTERNAL_API_BASE}/api${path}`;
    
    // Get query parameters
    const searchParams = url.searchParams;
    const queryString = searchParams.toString();
    const finalUrl = queryString ? `${externalUrl}?${queryString}` : externalUrl;
    
    // Get request body for POST/PUT/PATCH requests
    let body = null;
    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      try {
        body = await request.text();
      } catch (error) {
        console.error('Error reading request body:', error);
      }
    }
    
    // Get request headers
    const headers = new Headers();
    
    // Copy relevant headers from the original request
    const allowedHeaders = [
      'content-type',
      'accept',
      'authorization',
      'x-requested-with',
      'x-api-key',
      'x-tenant-id',
      'x-persona-id'
    ];
    
    for (const header of allowedHeaders) {
      const value = request.headers.get(header);
      if (value) {
        headers.set(header, value);
      }
    }
    
    // Add bridge headers for development
    headers.set('x-dev-override', 'true');
    headers.set('x-forwarded-for', request.ip || 'unknown');
    headers.set('x-forwarded-host', request.headers.get('host') || 'localhost');
    headers.set('x-forwarded-proto', 'https');
    
    // Make the request to the external API
    const response = await fetch(finalUrl, {
      method: request.method,
      headers,
      body,
    });
    
    // Get response headers
    const responseHeaders = new Headers();
    
    // Copy relevant response headers
    const responseAllowedHeaders = [
      'content-type',
      'cache-control',
      'etag',
      'last-modified',
      'content-length'
    ];
    
    for (const header of responseAllowedHeaders) {
      const value = response.headers.get(header);
      if (value) {
        responseHeaders.set(header, value);
      }
    }
    
    // Add CORS headers
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-API-Key, X-Tenant-ID, X-Persona-ID');
    
    // Get response body
    let responseBody;
    const contentType = response.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      responseBody = await response.json();
    } else {
      responseBody = await response.text();
    }
    
    // Return the proxied response
    return new NextResponse(JSON.stringify(responseBody), {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
    
  } catch (error: any) {
    console.error('Proxy request failed:', error);
    
    return NextResponse.json(
      { 
        error: 'Proxy request failed',
        message: error?.message || 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-API-Key, X-Tenant-ID, X-Persona-ID',
        }
      }
    );
  }
}

// Handle OPTIONS requests for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-API-Key, X-Tenant-ID, X-Persona-ID',
      'Access-Control-Max-Age': '86400',
    },
  });
}
