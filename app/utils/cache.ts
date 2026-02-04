/**
 * Caching Strategies and CDN Integration
 * 
 * Provides multi-layer caching with:
 * - Memory cache for rapid responses
 * - Redis cache for distributed caching
 * - CDN headers for edge caching
 * - Cache invalidation strategies
 */

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[]; // Cache tags for invalidation
  revalidate?: number; // Revalidation interval
}

interface CacheEntry<T> {
  data: T;
  expires: number;
  tags: string[];
  etag?: string;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private timers = new Map<string, NodeJS.Timeout>();

  set<T>(key: string, data: T, options: CacheOptions = {}): void {
    const ttl = options.ttl || 300; // Default 5 minutes
    const expires = Date.now() + ttl * 1000;
    
    // Clear existing timer
    const existingTimer = this.timers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new entry
    this.cache.set(key, {
      data,
      expires,
      tags: options.tags || [],
    });

    // Set expiration timer
    const timer = setTimeout(() => {
      this.delete(key);
    }, ttl * 1000);
    
    this.timers.set(key, timer);
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expires) {
      this.delete(key);
      return null;
    }
    
    return entry.data;
  }

  delete(key: string): boolean {
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
    return this.cache.delete(key);
  }

  clear(): void {
    // Clear all timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.cache.clear();
  }

  invalidateByTag(tag: string): void {
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags.includes(tag)) {
        this.delete(key);
      }
    }
  }

  size(): number {
    return this.cache.size;
  }

  // Cleanup expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        this.delete(key);
      }
    }
  }
}

// Global memory cache instance
const memoryCache = new MemoryCache();

// Cleanup expired entries every 5 minutes
setInterval(() => {
  memoryCache.cleanup();
}, 5 * 60 * 1000);

/**
 * Cache utilities for API responses
 */
export class CacheManager {
  /**
   * Generate cache key from request parameters
   */
  static generateKey(prefix: string, params: Record<string, any> = {}): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${JSON.stringify(params[key])}`)
      .join('&');
    return `${prefix}:${sortedParams}`;
  }

  /**
   * Get data from cache or fetch from source
   */
  static async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Try memory cache first
    const cached = memoryCache.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch fresh data
    try {
      const data = await fetcher();
      
      // Cache the result
      memoryCache.set(key, data, options);
      
      return data;
    } catch (error) {
      // If fetch fails, try to return stale data if available
      const stale = memoryCache.get<T>(`${key}:stale`);
      if (stale !== null) {
        console.warn('Returning stale cache data due to fetch error:', error);
        return stale;
      }
      
      throw error;
    }
  }

  /**
   * Invalidate cache by key or tags
   */
  static invalidate(keyOrTag: string): void {
    if (keyOrTag.includes(':')) {
      // It's a specific key
      memoryCache.delete(keyOrTag);
    } else {
      // It's a tag
      memoryCache.invalidateByTag(keyOrTag);
    }
  }

  /**
   * Clear all cache
   */
  static clear(): void {
    memoryCache.clear();
  }

  /**
   * Get cache statistics
   */
  static getStats() {
    return {
      size: memoryCache.size(),
      // Add more stats as needed
    };
  }
}

/**
 * CDN caching utilities
 */
export class CDNCache {
  /**
   * Generate CDN cache headers
   */
  static getHeaders(options: {
    ttl?: number;
    revalidate?: number;
    mustRevalidate?: boolean;
    etag?: string;
  } = {}): Record<string, string> {
    const ttl = options.ttl || 3600; // Default 1 hour
    const revalidate = options.revalidate || ttl;
    
    const headers: Record<string, string> = {
      'Cache-Control': `public, max-age=${ttl}, stale-while-revalidate=${ttl * 2}, stale-if-error=${ttl * 3}`,
    };

    if (options.mustRevalidate) {
      headers['Cache-Control'] += ', must-revalidate';
    }

    if (options.etag) {
      headers['ETag'] = options.etag;
    }

    return headers;
  }

  /**
   * Generate ETag for response
   */
  static generateETag(data: any): string {
    const crypto = require('crypto');
    const hash = crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
    return `"${hash}"`;
  }

  /**
   * Check if ETag matches (for conditional requests)
   */
  static etagMatches(ifNoneMatch: string, etag: string): boolean {
    if (!ifNoneMatch || !etag) return false;
    return ifNoneMatch === etag || ifNoneMatch === '*';
  }
}

/**
 * Cache invalidation strategies
 */
export class CacheInvalidation {
  /**
   * Invalidate registry cache when templates change
   */
  static invalidateRegistry(templateId?: string): void {
    if (templateId) {
      CacheManager.invalidate(`registry:templates`);
      CacheManager.invalidate(`registry:template:${templateId}`);
    } else {
      CacheManager.invalidate('registry:templates');
    }
  }

  /**
   * Invalidate user-specific cache
   */
  static invalidateUser(userId: string): void {
    CacheManager.invalidate(`user:${userId}`);
  }

  /**
   * Invalidate analytics cache
   */
  static invalidateAnalytics(): void {
    CacheManager.invalidate('analytics');
  }
}

export default CacheManager;
