// In-memory cache for decrypted images
const imageCache = new Map<string, { data: Buffer; mimeType: string; timestamp: number }>();
const MAX_CACHE_SIZE = 100 * 1024 * 1024; // 100MB
const CACHE_TTL = 3600 * 1000; // 1 hour
let currentCacheSize = 0;

export function getCachedImage(cid: string) {
  const cached = imageCache.get(cid);
  if (!cached) return null;
  
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    currentCacheSize -= cached.data.length;
    imageCache.delete(cid);
    return null;
  }
  
  return cached;
}

export function setCachedImage(cid: string, data: Buffer, mimeType: string) {
  while (currentCacheSize + data.length > MAX_CACHE_SIZE && imageCache.size > 0) {
    const oldestKey = imageCache.keys().next().value as string | undefined;
    if (oldestKey) {
      const oldest = imageCache.get(oldestKey);
      if (oldest) {
        currentCacheSize -= oldest.data.length;
        imageCache.delete(oldestKey);
      }
    }
  }
  
  imageCache.set(cid, { data, mimeType, timestamp: Date.now() });
  currentCacheSize += data.length;
  console.log(`[Cache] Stored ${cid}, total: ${(currentCacheSize / 1024 / 1024).toFixed(2)}MB`);
}
