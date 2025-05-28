import { Request, Response, NextFunction } from "express";

const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);

const asyncHandlerArray = (resolvers: any) => {
  return resolvers.map(asyncHandler);
};

export { asyncHandler, asyncHandlerArray };
