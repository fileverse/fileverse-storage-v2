import { throwError } from "../../infra/errorHandler";
import { NextFunction, Response } from "express";
import { CustomRequest } from "../../types";

export const canDelete = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
) => {
  const invokerAddress = req.invokerAddress;
  const contractAddress = req.contractAddress;
  if (req.isAuthenticated) {
    next();
  } else {
    return throwError({
      code: 403,
      message: `${invokerAddress} does not have permission to delete file for portal ${contractAddress}`,
      req,
    });
  }
};
