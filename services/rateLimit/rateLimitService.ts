/**
 * rateLimitService — sliding-window rate limiter for public-ish endpoints.
 *
 * Why Supabase-backed instead of in-memory: AWS Lambda containers are
 * short-lived and scale horizontally, so in-process counters would only
 * be local per container. A shared store is required for any meaningful
 * limit. Redis would be lower-latency; Supabase is "good enough for
 * alpha" and matches the rest of the platform's storage model.
 *
 * Configuration is editable via the admin Tasks & Rewards tab
 * (PATCH /api/admin/system/rate-limits) — operators tune limits during
 * alpha without a redeploy.
 *
 * Algorithm: append-only `rate_limit_counters` row per request +
 * `COUNT(*)` over the rolling window. Cleanup cron prunes the table.
 *
 * Public surface:
 *   - checkAndConsumeRateLimit({ endpointKey, scope, scopeValue }):
 *       returns { allowed, retryAfterSeconds? }
 *   - listRateLimits(): admin GET — every configured limit row
 *   - upsertRateLimit({...}): admin PATCH — set/update one limit
 *
 * Fail-open: any DB error → allow. The on-chain credit / spine receipt
 * paths are authoritative for abuse detection; this layer is a friction-
 * raiser, not a security boundary.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type RateLimitScope = 'persona' | 'ip';

export interface RateLimitConfig {
  id: string;
  endpoint_key: string;
  scope: RateLimitScope;
  max_requests: number;
  window_seconds: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CheckArgs {
  endpointKey: string;
  scope: RateLimitScope;
  scopeValue: string | null | undefined;
}

export interface CheckResult {
  allowed: boolean;
  retryAfterSeconds?: number;
  limit?: { max_requests: number; window_seconds: number };
}

function sb(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

// In-process cache for limit configs — cuts the read latency in the hot
// path. Refreshed every 60s. Operator edits via the admin tab take up
// to one minute to propagate to every Lambda container, which is
// acceptable for alpha.
interface CacheEntry {
  cfg: RateLimitConfig | null;
  fetchedAt: number;
}
const CACHE_TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();

function cacheKey(endpointKey: string, scope: RateLimitScope): string {
  return `${endpointKey}::${scope}`;
}

async function resolveConfig(
  db: SupabaseClient,
  endpointKey: string,
  scope: RateLimitScope,
): Promise<RateLimitConfig | null> {
  const key = cacheKey(endpointKey, scope);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.cfg;
  }
  const { data } = await db
    .from('system_rate_limits')
    .select('id, endpoint_key, scope, max_requests, window_seconds, is_active, notes, created_at, updated_at')
    .eq('endpoint_key', endpointKey)
    .eq('scope', scope)
    .maybeSingle();
  const cfg = data as RateLimitConfig | null;
  cache.set(key, { cfg, fetchedAt: Date.now() });
  return cfg;
}

/**
 * Check the rate limit + record the request. Returns allowed=true if
 * (a) no config exists for the endpoint+scope, (b) config is inactive,
 * (c) scopeValue is missing (can't bucket the call), or (d) the count
 * in the rolling window is under the cap. Otherwise allowed=false with
 * retryAfterSeconds populated from the window length.
 */
export async function checkAndConsumeRateLimit(args: CheckArgs): Promise<CheckResult> {
  // Missing scope value — cannot bucket, allow + log (operator can
  // backfill the bucket via a future enrichment).
  if (!args.scopeValue) return { allowed: true };

  try {
    const db = sb();
    const cfg = await resolveConfig(db, args.endpointKey, args.scope);
    if (!cfg || !cfg.is_active) return { allowed: true };

    const windowStart = new Date(Date.now() - cfg.window_seconds * 1000).toISOString();
    const { count } = await db
      .from('rate_limit_counters')
      .select('id', { count: 'exact', head: true })
      .eq('endpoint_key', args.endpointKey)
      .eq('scope', args.scope)
      .eq('scope_value', args.scopeValue)
      .gte('created_at', windowStart);

    const currentCount = count ?? 0;
    if (currentCount >= cfg.max_requests) {
      return {
        allowed: false,
        retryAfterSeconds: cfg.window_seconds,
        limit: { max_requests: cfg.max_requests, window_seconds: cfg.window_seconds },
      };
    }

    // Record the new request — best-effort insert.
    await db.from('rate_limit_counters').insert({
      endpoint_key: args.endpointKey,
      scope: args.scope,
      scope_value: args.scopeValue,
    });

    return {
      allowed: true,
      limit: { max_requests: cfg.max_requests, window_seconds: cfg.window_seconds },
    };
  } catch (err) {
    // Fail open — log and continue. Real DDoS protection lives at the
    // CDN/Amplify layer.
    console.warn('[rateLimitService] check failed (fail-open):', (err as Error).message);
    return { allowed: true };
  }
}

/**
 * Admin GET — list every rate-limit config row.
 */
export async function listRateLimits(): Promise<RateLimitConfig[]> {
  const db = sb();
  const { data } = await db
    .from('system_rate_limits')
    .select('id, endpoint_key, scope, max_requests, window_seconds, is_active, notes, created_at, updated_at')
    .order('endpoint_key', { ascending: true });
  return (data ?? []) as RateLimitConfig[];
}

/**
 * Admin PATCH — upsert one rate-limit row by (endpoint_key, scope).
 * Operator can set `is_active=false` to disable a limit without
 * deleting the row (preserves notes + audit trail).
 */
export async function upsertRateLimit(args: {
  endpointKey: string;
  scope: RateLimitScope;
  maxRequests: number;
  windowSeconds: number;
  isActive?: boolean;
  notes?: string | null;
}): Promise<RateLimitConfig> {
  const db = sb();
  const { data, error } = await db
    .from('system_rate_limits')
    .upsert(
      {
        endpoint_key: args.endpointKey,
        scope: args.scope,
        max_requests: args.maxRequests,
        window_seconds: args.windowSeconds,
        is_active: args.isActive ?? true,
        notes: args.notes ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint_key,scope' },
    )
    .select('id, endpoint_key, scope, max_requests, window_seconds, is_active, notes, created_at, updated_at')
    .single();
  if (error || !data) {
    throw new Error(error?.message || 'rate-limit upsert failed');
  }
  // Invalidate cache for this endpoint+scope so admin edits propagate.
  cache.delete(cacheKey(args.endpointKey, args.scope));
  return data as RateLimitConfig;
}

/**
 * Extract the client IP from a Next.js request. Honours common
 * proxy headers (x-forwarded-for, x-real-ip) since Amplify sits
 * behind CloudFront. Falls back to null when no IP is recoverable —
 * the caller decides whether to allow (fail open) or reject.
 */
export function getClientIp(headers: Headers): string | null {
  const xfwd = headers.get('x-forwarded-for');
  if (xfwd) {
    // First IP in the comma-separated list is the original client.
    const first = xfwd.split(',')[0]?.trim();
    if (first) return first;
  }
  const real = headers.get('x-real-ip');
  if (real) return real.trim();
  return null;
}
