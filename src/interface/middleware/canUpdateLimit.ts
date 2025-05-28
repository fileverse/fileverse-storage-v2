import { throwError } from "../../infra/errorHandler";
import { NextFunction, Response } from "express";
import { CustomRequest } from "../../types";

export const canUpdateLimit = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
) => {
  const invokerAddress = req.invokerAddress;
  const contractAddress = req.contractAddress;
  if (req.isAuthenticated) {
    next();
  } else {
    let statusCode = 403;
    if (!invokerAddress) {
      statusCode = 401;
    }
    return throwError({
      code: statusCode,
      message: `${invokerAddress} does not have permission to update limit for portal ${contractAddress}`,
      req,
    });
  }
};
