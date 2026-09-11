import { NextFunction, Response } from "express";
import { redis } from "../../infra/redis";
import { logger } from "../../infra/logger";
import { CustomRequest } from "../../types";
import {
  CounterStore,
  FEEDBACK_LIMITS,
  MemoryCounterStore,
  RedisCounterStore,
  checkFeedbackLimit,
} from "../../domain/feedback/rateLimiter";
import { FEEDBACK_ID_PATTERN } from "./schema";

const store: CounterStore = redis
  ? new RedisCounterStore(redis)
  : new MemoryCounterStore();

const docIdForLimit = (body: unknown): string | undefined => {
  if (!body || typeof body !== "object") return undefined;
  const { ddocId, dsheetId } = body as { ddocId?: unknown; dsheetId?: unknown };
  for (const candidate of [ddocId, dsheetId]) {
    if (typeof candidate === "string" && FEEDBACK_ID_PATTERN.test(candidate)) {
      return candidate;
    }
  }
  return undefined;
};

let lastDegradedWindow = -1;
const noteDegraded = () => {
  const window = Math.floor(Date.now() / (FEEDBACK_LIMITS.global.windowSeconds * 1000));
  if (window === lastDegradedWindow) return;
  lastDegradedWindow = window;
  logger.warn("feedback rate limiter store failed; allowing requests (fail-open)");
};

export const feedbackRateLimit = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { allowed, degraded } = await checkFeedbackLimit(store, docIdForLimit(req.body));
  if (degraded) noteDegraded();
  if (!allowed) {
    res.status(429).json({ error: "Too many reports, please try again later" });
    return;
  }
  next();
};
