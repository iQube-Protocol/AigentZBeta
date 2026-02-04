import { NextRequest, NextResponse } from 'next/server';

// Bridge endpoint for Marketa LVB integration
const BRIDGE_ENDPOINT = 'https://dev-beta.aigentz.me/api/marketa/lvb/bridge-enhanced';

export async function GET(request: NextRequest) {
  return handleBridgeRequest(request);
}

export async function POST(request: NextRequest) {
  return handleBridgeRequest(request);
}

async function handleBridgeRequest(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    
    // Get request body for POST requests
    let body = null;
    if (request.method === 'POST') {
      try {
        body = await request.text();
      } catch (error) {
        console.error('Error reading request body:', error);
      }
    }
    
    // Build the final URL with query parameters
    const finalUrl = searchParams.toString() ? `${BRIDGE_ENDPOINT}?${searchParams.toString()}` : BRIDGE_ENDPOINT;
    
    // Set up headers
    const headers = new Headers();
    
    // Copy relevant headers from the original request
    const allowedHeaders = [
      'content-type',
      'accept',
      'authorization',
      'x-requested-with',
      'x-api-key'
    ];
    
    for (const header of allowedHeaders) {
      const value = request.headers.get(header);
      if (value) {
        headers.set(header, value);
      }
    }
    
    // Add bridge headers
    headers.set('x-persona-id', request.headers.get('x-persona-id') || 'test-persona-admin');
    headers.set('x-tenant-id', request.headers.get('x-tenant-id') || 'agq-tenant');
    headers.set('x-dev-override', 'true');
    
    // Make the request to the external bridge
    const response = await fetch(finalUrl, {
      method: request.method,
      headers,
      body,
    });
    
    // Get response data
    const responseData = await response.text();
    
    // Try to parse as JSON, fallback to text
    let parsedData;
    try {
      parsedData = JSON.parse(responseData);
    } catch {
      parsedData = responseData;
    }
    
    // Return the response
    return NextResponse.json(parsedData, {
      status: response.status,
      statusText: response.statusText,
    });
    
  } catch (error: any) {
    console.error('Bridge request failed:', error);
    
    return NextResponse.json(
      { 
        error: 'Bridge request failed',
        message: error?.message || 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
