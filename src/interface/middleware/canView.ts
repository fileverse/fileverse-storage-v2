import { NextFunction } from "express";
import { CustomRequest } from "../../types";

export const canView = async (
  req: Request & CustomRequest,
  res: Response,
  next: NextFunction
) => {
  next();
};
