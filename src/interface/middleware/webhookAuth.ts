import { Request, Response, NextFunction } from "express";

export const webhookAuth = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers["x-webhook-api-key"];
  if (!apiKey || apiKey !== process.env.INDEXER_WEBHOOK_API_KEY) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
};
