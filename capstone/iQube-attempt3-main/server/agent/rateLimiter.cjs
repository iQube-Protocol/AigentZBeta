function createRateLimiter(options = {}) {
  const windowMs = Number(options.windowMs) > 0 ? Number(options.windowMs) : 60_000;
  const max = Number(options.max) > 0 ? Number(options.max) : 20;
  const buckets = new Map();

  function check(key) {
    const now = Date.now();
    const bucketKey = key || "anonymous";
    const existing = buckets.get(bucketKey);

    if (!existing || existing.resetAt <= now) {
      buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
      return { allowed: true, remaining: max - 1, retryAfterMs: windowMs };
    }

    if (existing.count >= max) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: Math.max(0, existing.resetAt - now),
      };
    }

    existing.count += 1;
    buckets.set(bucketKey, existing);
    return {
      allowed: true,
      remaining: Math.max(0, max - existing.count),
      retryAfterMs: Math.max(0, existing.resetAt - now),
    };
  }

  return { check };
}

module.exports = {
  createRateLimiter,
};
