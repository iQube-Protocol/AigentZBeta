import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

/**
 * 🚨 CRITICAL ARCHITECTURAL RULE 🚨
 * 
 * This is the ONLY valid endpoint for AA API runtime access.
 * 
 * CORRECT: https://bsjhfvctmduxhohtllly.supabase.co/functions/v1/aa-proxy/aa/v1/runtime/*
 * FORBIDDEN: https://aigentzbeta-production.up.railway.app/aa/v1/runtime/*
 * 
 * Why: Provides iframe URL normalization and fallback protection.
 * Direct Railway usage causes 404 errors and has no safety net.
 * 
 * See: docs/qubetalk/AA_PROXY_ARCHITECTURAL_RULE.md
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const DEFAULT_RUNTIME_PATH = '/metame/runtime'

function normalizeRuntimeIframeUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl)
    const trimmed = parsed.pathname.replace(/\/+$/, '') || '/'
    if (trimmed === '/runtime' || trimmed === '/') {
      parsed.pathname = DEFAULT_RUNTIME_PATH
    } else {
      parsed.pathname = trimmed
    }

    if (parsed.pathname === DEFAULT_RUNTIME_PATH && !parsed.searchParams.has('embed')) {
      parsed.searchParams.set('embed', '1')
    }

    return parsed.toString()
  } catch {
    return rawUrl
  }
}

function normalizeShellConfigResponse(path: string, responseBody: string): string {
  const normalizedPath = path.split('?')[0]
  if (!normalizedPath.endsWith('/runtime/shell-config')) {
    return responseBody
  }

  try {
    const payload = JSON.parse(responseBody)
    const iframe = payload?.iframe
    if (!iframe || typeof iframe.url !== 'string' || iframe.url.length === 0) {
      return responseBody
    }

    const normalizedUrl = normalizeRuntimeIframeUrl(iframe.url)
    iframe.url = normalizedUrl

    if (typeof iframe.postMessageOrigin !== 'string' || iframe.postMessageOrigin.length === 0) {
      iframe.postMessageOrigin = new URL(normalizedUrl).origin
    } else {
      try {
        const origin = new URL(normalizedUrl).origin
        if (iframe.postMessageOrigin !== origin) {
          iframe.postMessageOrigin = origin
        }
      } catch {
        // Keep upstream value when URL parsing fails.
      }
    }

    return JSON.stringify(payload)
  } catch {
    return responseBody
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    console.log(`[AA-Proxy] Original URL: ${url.pathname}`)
    
    // Extract the path after /functions/v1/aa-proxy
    // Handle both patterns: /functions/v1/aa-proxy/aa/v1/... and /aa/v1/...
    let path = url.pathname
    path = path.replace(/^\/functions\/v1\/aa-proxy/, '') 
    path = path.replace(/^\/aa-proxy/, '')
    if (!path.startsWith('/')) {
      path = '/aa/v1/runtime/shell-config'
    }
    
    // Get upstream URLs from environment
    const primaryUpstream = Deno.env.get('AA_PROXY_PRIMARY_UPSTREAM') || 'https://aigentzbeta-production.up.railway.app'
    const fallbackUpstream = Deno.env.get('AA_PROXY_FALLBACK_UPSTREAM') || 'https://aa.dev-beta.aigentz.me'
    
    console.log(`[AA-Proxy] Request: ${req.method} ${path}`)
    console.log(`[AA-Proxy] Primary: ${primaryUpstream}`)
    console.log(`[AA-Proxy] Fallback: ${fallbackUpstream}`)
    
    // Try primary upstream first
    let response = await tryUpstream(req, primaryUpstream, path)
    
    // If primary fails, try fallback
    if (!response.ok) {
      console.log(`[AA-Proxy] Primary failed (${response.status}), trying fallback`)
      response = await tryUpstream(req, fallbackUpstream, path)
    }
    
    // Add CORS headers to response
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value)
    })
    
    return response
    
  } catch (error) {
    console.error('[AA-Proxy] Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

async function tryUpstream(req: Request, upstream: string, path: string): Promise<Response> {
  const upstreamUrl = `${upstream}${path}`
  console.log(`[AA-Proxy] Trying upstream: ${upstreamUrl}`)
  
  try {
    const response = await fetch(upstreamUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': req.headers.get('Authorization') || '',
        'X-Tenant-ID': req.headers.get('X-Tenant-ID') || '',
        'X-Persona-ID': req.headers.get('X-Persona-ID') || '',
      },
      body: req.method === 'POST' ? await req.text() : undefined,
    })
    
    console.log(`[AA-Proxy] Upstream response: ${response.status}`)
    
    // Return the response with the same body and status
    const responseBody = normalizeShellConfigResponse(path, await response.text())
    return new Response(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    })
    
  } catch (error) {
    console.error(`[AA-Proxy] Upstream error:`, error)
    // Return a 500 response to indicate upstream failure
    return new Response('Upstream error', { status: 500 })
  }
}
