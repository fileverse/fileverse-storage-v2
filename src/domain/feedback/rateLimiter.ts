export interface CounterStore {
  increment(key: string, ttlSeconds: number): Promise<number>;
}

export const FEEDBACK_LIMITS = {
  global: { windowSeconds: 60, cap: 60 },
  perDoc: { windowSeconds: 3600, cap: 20 },
} as const;

const MEMORY_STORE_PRUNE_AT = 1000;

export class MemoryCounterStore implements CounterStore {
  private readonly entries = new Map<string, { count: number; expiresAt: number }>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  async increment(key: string, ttlSeconds: number): Promise<number> {
    const nowMs = this.now();
    if (this.entries.size > MEMORY_STORE_PRUNE_AT) {
      for (const [k, entry] of this.entries) {
        if (entry.expiresAt <= nowMs) this.entries.delete(k);
      }
    }
    const existing = this.entries.get(key);
    if (!existing || existing.expiresAt <= nowMs) {
      this.entries.set(key, { count: 1, expiresAt: nowMs + ttlSeconds * 1000 });
      return 1;
    }
    existing.count += 1;
    return existing.count;
  }
}

type RedisLike = {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
};

export class RedisCounterStore implements CounterStore {
  constructor(private readonly redis: RedisLike) {}

  async increment(key: string, ttlSeconds: number): Promise<number> {
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, ttlSeconds);
    return count;
  }
}

export const feedbackLimitKeys = (
  docId: string | undefined,
  nowMs: number
): { global: string; doc?: string } => {
  const minute = Math.floor(nowMs / (FEEDBACK_LIMITS.global.windowSeconds * 1000));
  const hour = Math.floor(nowMs / (FEEDBACK_LIMITS.perDoc.windowSeconds * 1000));
  return {
    global: `feedback:global:${minute}`,
    doc: docId ? `feedback:doc:${docId}:${hour}` : undefined,
  };
};

// Counters are keyed on time windows and document ids only. Nothing here
// identifies the sender; a store failure lets the request through.
export const checkFeedbackLimit = async (
  store: CounterStore,
  docId: string | undefined,
  nowMs: number = Date.now()
): Promise<{ allowed: boolean; degraded: boolean }> => {
  const keys = feedbackLimitKeys(docId, nowMs);
  try {
    const globalCount = await store.increment(
      keys.global,
      FEEDBACK_LIMITS.global.windowSeconds
    );
    if (globalCount > FEEDBACK_LIMITS.global.cap) {
      return { allowed: false, degraded: false };
    }
    if (keys.doc) {
      const docCount = await store.increment(
        keys.doc,
        FEEDBACK_LIMITS.perDoc.windowSeconds
      );
      if (docCount > FEEDBACK_LIMITS.perDoc.cap) {
        return { allowed: false, degraded: false };
      }
    }
    return { allowed: true, degraded: false };
  } catch {
    return { allowed: true, degraded: true };
  }
};
