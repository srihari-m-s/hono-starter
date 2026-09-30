import { describe, expect, test } from "bun:test";
import { createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  test("allows requests up to the limit", () => {
    const limiter = createRateLimiter({ windowMs: 1000, max: 3 });

    expect(limiter.check("ip", 0).allowed).toBe(true);
    expect(limiter.check("ip", 1).allowed).toBe(true);

    const third = limiter.check("ip", 2);
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);
  });

  test("blocks the request after the limit", () => {
    const limiter = createRateLimiter({ windowMs: 1000, max: 2 });
    limiter.check("ip", 0);
    limiter.check("ip", 1);

    const blocked = limiter.check("ip", 2);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterMs).toBe(998);
  });

  test("slides: hits leave the window", () => {
    const limiter = createRateLimiter({ windowMs: 1000, max: 2 });
    limiter.check("ip", 0);
    limiter.check("ip", 1);
    expect(limiter.check("ip", 2).allowed).toBe(false);

    // At t=1001 the hit from t=0 has aged out, freeing one slot.
    expect(limiter.check("ip", 1001).allowed).toBe(true);
  });

  test("tracks keys independently", () => {
    const limiter = createRateLimiter({ windowMs: 1000, max: 1 });
    expect(limiter.check("a", 0).allowed).toBe(true);
    expect(limiter.check("a", 1).allowed).toBe(false);
    expect(limiter.check("b", 1).allowed).toBe(true);
  });

  test("reset clears every counter", () => {
    const limiter = createRateLimiter({ windowMs: 1000, max: 1 });
    limiter.check("a", 0);
    expect(limiter.check("a", 1).allowed).toBe(false);

    limiter.reset();

    expect(limiter.check("a", 2).allowed).toBe(true);
  });

  test("reclaims keys whose hits have all aged out", () => {
    const limiter = createRateLimiter({ windowMs: 1000, max: 1 });

    limiter.check("a", 0);
    expect(limiter.check("a", 1).allowed).toBe(false);

    // The old hit has left the window, so the entry is pruned rather than
    // accumulating timestamps forever.
    const afterWindow = limiter.check("a", 2000);
    expect(afterWindow.allowed).toBe(true);
    expect(afterWindow.remaining).toBe(0);
  });

  test("bounds the store by evicting the least recently used key", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 5, maxKeys: 3 });

    limiter.check("a", 0);
    limiter.check("b", 0);
    limiter.check("c", 0);
    expect(limiter.size()).toBe(3);

    limiter.check("d", 0);

    // A caller minting unique keys must not grow the map without bound.
    expect(limiter.size()).toBe(3);
  });

  test("keeps recently used keys when evicting", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 5, maxKeys: 2 });

    limiter.check("a", 0); // [a]
    limiter.check("b", 0); // [a, b]
    limiter.check("a", 1); // touch a -> [b, a]
    limiter.check("c", 2); // evicts b, not the freshly used a

    // "a" survived, so its earlier hits are still counted against the budget.
    // A fresh key would have 4 remaining.
    expect(limiter.check("a", 3).remaining).toBe(2);
  });

  test("evicted keys start from a clean budget", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1, maxKeys: 2 });

    limiter.check("a", 0);
    limiter.check("b", 0);
    limiter.check("c", 0); // evicts "a"

    expect(limiter.check("a", 1).allowed).toBe(true);
  });
});
