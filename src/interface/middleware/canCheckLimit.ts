import { NextFunction, Response } from "express";
import { throwError } from "../../infra/errorHandler";
import { CustomRequest } from "../../types";

export const canCheckLimit = async (
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
      message: `${invokerAddress} does not have permission to check limit for portal ${contractAddress}`,
      req,
    });
  }
};
