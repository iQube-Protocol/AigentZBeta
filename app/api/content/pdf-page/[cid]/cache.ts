// Simple in-memory cache (opaque keys).
// Good for Phase 1. Replace with Redis later if needed.

type CacheEntry = {
  data: Buffer;
  mimeType: string;
  timestamp: number;
};

const cache = new Map<string, CacheEntry>();

// 1 hour TTL by default
const TTL_MS = 60 * 60 * 1000;

export function getCachedImage(key: string): CacheEntry | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.timestamp > TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit;
}

export function setCachedImage(key: string, data: Buffer, mimeType: string) {
  cache.set(key, { data, mimeType, timestamp: Date.now() });
}
