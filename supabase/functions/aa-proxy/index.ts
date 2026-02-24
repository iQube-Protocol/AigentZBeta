import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

/**
 * CRITICAL ARCHITECTURAL RULE
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

type ProviderKey = 'openai' | 'anthropic' | 'chaingpt' | 'venice' | 'thirdweb' | 'google' | 'default'
type TrustState = 'ok' | 'warn' | 'fail'

const PROVIDER_SCORE_MODEL: Record<ProviderKey, { base: number; reliabilityBonus: number }> = {
  openai: { base: 5.0, reliabilityBonus: 0 },
  anthropic: { base: 5.0, reliabilityBonus: 0 },
  chaingpt: { base: 7.4, reliabilityBonus: 0.8 },
  venice: { base: 7.8, reliabilityBonus: 0.8 },
  thirdweb: { base: 7.3, reliabilityBonus: 0.8 },
  google: { base: 4.5, reliabilityBonus: 0 },
  default: { base: 4.5, reliabilityBonus: 0 },
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (value === 1) return true
    if (value === 0) return false
    return null
  }
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') return true
  if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') return false
  return null
}

function normalizeProvider(providerId: string | null): ProviderKey | null {
  if (!providerId) return null
  switch (providerId.toLowerCase()) {
    case 'openai':
    case 'anthropic':
    case 'chaingpt':
    case 'venice':
    case 'thirdweb':
    case 'google':
      return providerId.toLowerCase() as ProviderKey
    default:
      return null
  }
}

function resolveProviderFromLlmId(llmId: string | null): ProviderKey | null {
  if (!llmId) return null
  const id = llmId.toLowerCase()
  if (id.startsWith('gpt-') || id.startsWith('o1') || id.startsWith('o3')) return 'openai'
  if (id.startsWith('claude')) return 'anthropic'
  if (id.startsWith('gemini')) return 'google'
  if (id.startsWith('venice')) return 'venice'
  if (id.startsWith('chaingpt')) return 'chaingpt'
  if (id.startsWith('thirdweb')) return 'thirdweb'
  return null
}

function trustStateFromScore(score: number): TrustState {
  if (score >= 8) return 'ok'
  if (score >= 5) return 'warn'
  return 'fail'
}

function clampScore(value: number): number {
  return Number(Math.min(10, Math.max(1, value)).toFixed(2))
}

function computeProviderScores(provider: ProviderKey, processing: boolean): { trust: number; reliability: number } {
  const model = PROVIDER_SCORE_MODEL[provider] ?? PROVIDER_SCORE_MODEL.default
  const processingPenalty = processing ? 0.3 : 0
  return {
    trust: clampScore(model.base - processingPenalty),
    reliability: clampScore(model.base + model.reliabilityBonus - processingPenalty),
  }
}

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
    if (parsed.pathname === DEFAULT_RUNTIME_PATH && !parsed.searchParams.has('shell')) {
      parsed.searchParams.set('shell', 'thin')
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

function resolveProviderFromRequestBody(requestBody: string | undefined): ProviderKey | null {
  if (!requestBody) return null
  try {
    const payload = asRecord(JSON.parse(requestBody))
    if (!payload) return null
    const providerFromBody = normalizeProvider(asString(payload.provider_id))
    if (providerFromBody) return providerFromBody
    const llmId = asString(payload.llm_id) || asString(payload.id)
    return resolveProviderFromLlmId(llmId)
  } catch {
    return null
  }
}

function resolveProcessingFromRequest(path: string, requestBody?: string): boolean {
  const queryPath = path.startsWith('/') ? path : `/${path}`
  let queryProcessing: unknown = null
  try {
    const parsed = new URL(queryPath, 'https://aa-proxy.local')
    queryProcessing = parsed.searchParams.get('processing') ?? parsed.searchParams.get('is_processing')
  } catch {
    queryProcessing = null
  }

  let bodyProcessing: unknown = null
  if (requestBody) {
    try {
      const payload = asRecord(JSON.parse(requestBody))
      if (payload) {
        const nestedPayload = asRecord(payload.payload)
        bodyProcessing =
          payload.processing ??
          payload.is_processing ??
          nestedPayload?.processing ??
          nestedPayload?.is_processing ??
          null
      }
    } catch {
      bodyProcessing = null
    }
  }

  return normalizeBoolean(queryProcessing) ?? normalizeBoolean(bodyProcessing) ?? false
}

function resolveProviderFromResponse(payload: Record<string, unknown>): ProviderKey | null {
  const shellConfig = asRecord(payload.shell_config)
  const rootOrShell = shellConfig ?? payload
  const selectors = asRecord(rootOrShell.selectors)
  const llm = asRecord(selectors?.llm)
  const current = asRecord(llm?.current)
  const providerFromCurrent = normalizeProvider(asString(current?.provider_id))
  if (providerFromCurrent) return providerFromCurrent
  return resolveProviderFromLlmId(asString(current?.id))
}

function patchSessionScores(session: Record<string, unknown> | null, scores: { trust: number; reliability: number }) {
  if (!session) return
  session.scores = {
    trust: scores.trust,
    reliability: scores.reliability,
  }

  const trustState = trustStateFromScore(scores.trust)
  session.trust_level = trustState === 'ok' ? 'verified' : trustState === 'warn' ? 'warning' : 'unverified'

  const trustSignals = Array.isArray(session.trust_signals) ? session.trust_signals : []
  session.trust_signals = trustSignals.map((signal) => {
    if (typeof signal === 'string') return signal
    const signalRecord = asRecord(signal)
    if (!signalRecord) return signal
    if (signalRecord.key === 'trust') {
      return {
        ...signalRecord,
        label: `Trust ${scores.trust.toFixed(1)}/10`,
        state: trustStateFromScore(scores.trust),
      }
    }
    if (signalRecord.key === 'reliability') {
      return {
        ...signalRecord,
        label: `Reliability ${scores.reliability.toFixed(1)}/10`,
        state: trustStateFromScore(scores.reliability),
      }
    }
    return signalRecord
  })
}

function patchShellTrust(shellConfig: Record<string, unknown>, scores: { trust: number; reliability: number }) {
  const trustBlock = asRecord(shellConfig.trust) ?? {}
  trustBlock.scores = {
    trust: scores.trust,
    reliability: scores.reliability,
  }
  const trustState = trustStateFromScore(scores.trust)
  trustBlock.level = trustState === 'ok' ? 'verified' : trustState === 'warn' ? 'warning' : 'unverified'

  const existingSignals = Array.isArray(trustBlock.signals) ? trustBlock.signals : []
  trustBlock.signals = existingSignals.map((signal) => {
    if (typeof signal !== 'string') return signal
    if (signal.toLowerCase().startsWith('trust ')) {
      return `Trust ${scores.trust.toFixed(1)}/10`
    }
    if (signal.toLowerCase().startsWith('reliability ')) {
      return `Reliability ${scores.reliability.toFixed(1)}/10`
    }
    return signal
  })
  shellConfig.trust = trustBlock
}

function normalizeRuntimeScores(path: string, responseBody: string, requestBody?: string): string {
  const normalizedPath = path.split('?')[0]
  if (!normalizedPath.includes('/runtime/')) return responseBody

  try {
    const payload = asRecord(JSON.parse(responseBody))
    if (!payload) return responseBody

    const provider =
      resolveProviderFromResponse(payload) ??
      resolveProviderFromRequestBody(requestBody) ??
      null
    if (!provider) return responseBody

    const processing = resolveProcessingFromRequest(path, requestBody)
    const scores = computeProviderScores(provider, processing)
    patchSessionScores(asRecord(payload.session), scores)

    const shellConfig = asRecord(payload.shell_config)
    if (shellConfig) {
      patchSessionScores(asRecord(shellConfig.session), scores)
      patchShellTrust(shellConfig, scores)
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
    
    const requestBody = req.method === 'POST' ? await req.text() : undefined

    // Try primary upstream first
    let response = await tryUpstream(req, primaryUpstream, path, requestBody)
    
    // If primary fails, try fallback
    if (!response.ok) {
      console.log(`[AA-Proxy] Primary failed (${response.status}), trying fallback`)
      response = await tryUpstream(req, fallbackUpstream, path, requestBody)
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

async function tryUpstream(req: Request, upstream: string, path: string, requestBody?: string): Promise<Response> {
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
      body: req.method === 'POST' ? requestBody : undefined,
    })
    
    console.log(`[AA-Proxy] Upstream response: ${response.status}`)
    
    // Return the response with the same body and status
    const rawBody = await response.text()
    const withNormalizedIframe = normalizeShellConfigResponse(path, rawBody)
    const normalizedResponseBody = normalizeRuntimeScores(path, withNormalizedIframe, requestBody)
    return new Response(normalizedResponseBody, {
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
