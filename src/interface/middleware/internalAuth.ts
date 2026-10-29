import { timingSafeEqual } from "crypto";
import { Request, Response, NextFunction } from "express";

const sameSecret = (given: string, expected: string): boolean => {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

export const internalAuth = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const expected = process.env.INTERNAL_API_KEY;
  const given = req.headers["x-internal-api-key"];
  if (!expected || typeof given !== "string" || !sameSecret(given, expected)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
};
