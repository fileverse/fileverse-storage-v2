import { reportError } from "../../infra/reporter";
import { ValidationError } from "./validator";
import { NextFunction, Response } from "express";
import { CustomRequest } from "../../types";

// eslint-disable-next-line no-unused-vars
export const expressErrorHandler = (
  err: Error & {
    statusCode?: number;
    code?: number;
    token?: string;
    details?: any;
  },
  req: CustomRequest,
  res: Response,
  next: NextFunction
) => {
  console.log("error", err.details);
  const errorMessage = `Message: ${err.message}\nError Code: ${
    err.statusCode || err.code
  }`;
  reportError(errorMessage).catch(console.log);
  if (err instanceof ValidationError) {
    return res.status(err?.statusCode || 500).json({ message: err.message });
  }
  res.status(err.code || 500).json({ message: err.message });
  next();
};
