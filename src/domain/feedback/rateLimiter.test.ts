import {
  MemoryCounterStore,
  RedisCounterStore,
  FEEDBACK_LIMITS,
  feedbackLimitKeys,
  checkFeedbackLimit,
} from "./rateLimiter";

describe("feedbackLimitKeys", () => {
  it("buckets the global key by minute and the doc key by hour", () => {
    const nowMs = 1_800_000_000_000; // arbitrary fixed instant
    const keys = feedbackLimitKeys("abc", nowMs);
    expect(keys.global).toBe(`feedback:global:${Math.floor(nowMs / 60_000)}`);
    expect(keys.doc).toBe(`feedback:doc:abc:${Math.floor(nowMs / 3_600_000)}`);
  });

  it("omits the doc key when there is no doc id", () => {
    expect(feedbackLimitKeys(undefined, 0).doc).toBeUndefined();
  });
});

describe("checkFeedbackLimit", () => {
  it("allows up to the global cap and rejects the next request in the same window", async () => {
    const store = new MemoryCounterStore(() => 0);
    for (let i = 0; i < FEEDBACK_LIMITS.global.cap; i++) {
      expect((await checkFeedbackLimit(store, undefined, 0)).allowed).toBe(true);
    }
    expect((await checkFeedbackLimit(store, undefined, 0)).allowed).toBe(false);
    expect((await checkFeedbackLimit(store, undefined, 0)).degraded).toBe(false);
  });

  it("allows again in the next global window", async () => {
    let now = 0;
    const store = new MemoryCounterStore(() => now);
    for (let i = 0; i < FEEDBACK_LIMITS.global.cap; i++) {
      await checkFeedbackLimit(store, undefined, now);
    }
    expect((await checkFeedbackLimit(store, undefined, now)).allowed).toBe(false);
    now = 60_000;
    expect((await checkFeedbackLimit(store, undefined, now)).allowed).toBe(true);
  });

  it("rejects a single document after the per-doc cap while others stay allowed", async () => {
    const store = new MemoryCounterStore(() => 0);
    for (let i = 0; i < FEEDBACK_LIMITS.perDoc.cap; i++) {
      expect((await checkFeedbackLimit(store, "doc-a", 0)).allowed).toBe(true);
    }
    expect((await checkFeedbackLimit(store, "doc-a", 0)).allowed).toBe(false);
    expect((await checkFeedbackLimit(store, "doc-b", 0)).allowed).toBe(true);
  });

  it("fails open when the store throws", async () => {
    const broken = { increment: async () => { throw new Error("redis down"); } };
    const result = await checkFeedbackLimit(broken, "doc-a", 0);
    expect(result.allowed).toBe(true);
    expect(result.degraded).toBe(true);
  });
});

describe("RedisCounterStore", () => {
  it("sets the ttl only on the first increment of a key", async () => {
    const incr = jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    const expire = jest.fn().mockResolvedValue(1);
    const store = new RedisCounterStore({ incr, expire });
    expect(await store.increment("k", 60)).toBe(1);
    expect(await store.increment("k", 60)).toBe(2);
    expect(expire).toHaveBeenCalledTimes(1);
    expect(expire).toHaveBeenCalledWith("k", 60);
  });
});

describe("MemoryCounterStore", () => {
  it("expires a key after its ttl", async () => {
    let now = 0;
    const store = new MemoryCounterStore(() => now);
    expect(await store.increment("k", 10)).toBe(1);
    expect(await store.increment("k", 10)).toBe(2);
    now = 10_001;
    expect(await store.increment("k", 10)).toBe(1);
  });
});
