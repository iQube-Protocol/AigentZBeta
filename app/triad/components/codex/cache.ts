type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry<unknown>>();

const DEFAULT_TTL_MS = 20 * 60 * 1000;

export function getCachedValue<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value as T;
}

export function setCachedValue<T>(key: string, value: T, ttlMs = DEFAULT_TTL_MS) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

type CacheFetchOptions<T> = {
  shouldCache?: (value: T) => boolean;
  fallbackTtlMs?: number;
};

export async function getCachedOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = DEFAULT_TTL_MS,
  options?: CacheFetchOptions<T>
): Promise<T> {
  const cached = getCachedValue<T>(key);
  if (cached !== null) return cached;
  const value = await fetcher();
  const shouldCache = options?.shouldCache ? options.shouldCache(value) : true;
  if (shouldCache) {
    setCachedValue(key, value, ttlMs);
  } else if (typeof options?.fallbackTtlMs === "number" && options.fallbackTtlMs > 0) {
    setCachedValue(key, value, options.fallbackTtlMs);
  }
  return value;
}
