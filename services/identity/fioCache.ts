/**
 * FIO request cache + in-flight de-dup — stop-gap for public-node rate limiting.
 *
 * Default endpoint is the free public node (`https://fio.eosusa.io/v1/`) which
 * rate-limits aggressively. Multiple call sites (PersonaSetupWizard,
 * PersonaQuickAddModal, copilot, lookup route, persona-change broadcast
 * downstream consumers) hit it cold without coordination.
 *
 * This module wraps any FIO SDK call with:
 *   1. TTL cache keyed by `${op}:${handle}` — repeated reads within the TTL
 *      return the cached value, no network call
 *   2. In-flight de-dup — concurrent reads for the same key share one promise
 *
 * Stop-gap by design. Phase 2 hardening (Redis cache, 429 detection +
 * exponential backoff with jitter, stale-while-error) lands separately.
 *
 * Endpoint dedicated-node stub: `FIO_API_ENDPOINT_DEDICATED` env var, when
 * set, takes precedence over `FIO_API_ENDPOINT`. Wire-up to a paid/dedicated
 * node happens with the admin team.
 */

const DEFAULT_TTL_MS = {
  isAvailable: 60_000,        // 60s — availability flips quickly during registration; conservative
  handleInfo:  24 * 60 * 60_000, // 24h — ownership rarely changes
  verify:      60_000,        // 60s — ownership change should propagate within a minute
} as const;

type CacheEntry<T> = { value: T; expiresAt: number };

const cache = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

export type FioCacheOp = keyof typeof DEFAULT_TTL_MS;

export async function withFioCache<T>(
  op: FioCacheOp,
  handle: string,
  fn: () => Promise<T>,
  ttlMs?: number,
): Promise<T> {
  const key = `${op}:${handle.toLowerCase()}`;
  const now = Date.now();

  const cached = cache.get(key) as CacheEntry<T> | undefined;
  if (cached && cached.expiresAt > now) return cached.value;

  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const ttl = ttlMs ?? DEFAULT_TTL_MS[op];
  const promise = fn()
    .then((value) => {
      cache.set(key, { value, expiresAt: Date.now() + ttl });
      return value;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}

/**
 * Resolve the FIO endpoint with a stub for a future dedicated paid node.
 *
 * Precedence: FIO_API_ENDPOINT_DEDICATED > FIO_API_ENDPOINT > public default.
 * Operator decision (2026-05-09): stay on the public free node + cache for
 * now; dedicated node migration to be picked up with the admin team next
 * week. The dedicated env var is wired here so it's a one-line config flip
 * once the node is provisioned.
 */
export function resolveFioEndpoint(): string {
  return (
    process.env.FIO_API_ENDPOINT_DEDICATED ||
    process.env.FIO_API_ENDPOINT ||
    'https://fio.eosusa.io/v1/'
  );
}

export function clearFioCacheForHandle(handle: string): void {
  const lower = handle.toLowerCase();
  for (const key of cache.keys()) {
    if (key.endsWith(`:${lower}`)) cache.delete(key);
  }
}

export function getFioCacheStats(): { size: number; inflight: number } {
  return { size: cache.size, inflight: inflight.size };
}
