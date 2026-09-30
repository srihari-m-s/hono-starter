export interface RateLimitOptions {
  /** Length of the sliding window, in milliseconds. */
  windowMs: number;
  /** Maximum number of hits allowed inside the window. */
  max: number;
  /**
   * Upper bound on tracked keys. The oldest keys are evicted first.
   * Without this the store would grow for the lifetime of the process, since a
   * caller can mint new keys faster than old ones expire.
   */
  maxKeys?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Milliseconds until the oldest hit leaves the window. */
  retryAfterMs: number;
}

const DEFAULT_MAX_KEYS = 10_000;

/**
 * In-memory sliding-window rate limiter.
 *
 * Deliberately tiny: a starter should not need Redis to boot. The tradeoff is
 * that counters are per-process, so behind more than one instance each replica
 * enforces its own budget. Swap the store for Redis (or your platform's
 * limiter) when you scale out.
 *
 * Kept free of framework concerns so the algorithm can be unit tested.
 */
export function createRateLimiter(options: RateLimitOptions) {
  const hits = new Map<string, number[]>();
  const maxKeys = options.maxKeys ?? DEFAULT_MAX_KEYS;

  function check(key: string, now = Date.now()): RateLimitResult {
    const windowStart = now - options.windowMs;

    const recent = (hits.get(key) ?? []).filter(
      (timestamp) => timestamp > windowStart,
    );

    if (recent.length >= options.max) {
      // Re-insert so recency order still reflects this touch.
      hits.delete(key);
      hits.set(key, recent);

      const oldest = recent[0] ?? now;
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: Math.max(oldest + options.windowMs - now, 0),
      };
    }

    // Bound the store: `Map` preserves insertion order, and re-inserting on
    // every touch keeps that order equal to recency, so the first key in the
    // map is the least recently used one. Without this bound a caller minting
    // unique keys would grow the map for the lifetime of the process.
    hits.delete(key);
    while (hits.size >= maxKeys) {
      const leastRecentlyUsed = hits.keys().next().value;
      if (leastRecentlyUsed === undefined) break;
      hits.delete(leastRecentlyUsed);
    }

    recent.push(now);
    hits.set(key, recent);

    return {
      allowed: true,
      remaining: options.max - recent.length,
      retryAfterMs: 0,
    };
  }

  /** Clears all counters. Used by tests. */
  function reset(): void {
    hits.clear();
  }

  /** Number of tracked keys. Used by tests. */
  function size(): number {
    return hits.size;
  }

  return { check, reset, size };
}

export type RateLimiter = ReturnType<typeof createRateLimiter>;
