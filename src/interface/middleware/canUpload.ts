import { getStorageUse } from "../../domain/limit/getStorageUse";
import { NextFunction } from "express";
import { CustomRequest } from "../../types";
import { Response } from "express";
import { throwError } from "../../infra/errorHandler";

export const checkStorageLimit = async (
  contractAddress: string,
  invokerAddress: string
) => {
  if (!contractAddress && !invokerAddress) {
    return false;
  }

  const limit = await getStorageUse({ contractAddress });
  const totalAllowedStorage =
    Number(limit.storageLimit) + Number(limit.extraStorage);

  return Number(limit.storageUse) >= totalAllowedStorage;
};

export const canUpload = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
) => {
  const invokerAddress = req.invokerAddress;
  const contractAddress = req.contractAddress;
  if (!req.isAuthenticated) {
    const statusCode = invokerAddress ? 403 : 401;
    const message = `invokerAddress: ${invokerAddress} does not have permission to upload file for subdomain: ${contractAddress}`;

    return throwError({
      code: statusCode,
      message,
      req,
    });
  }

  const storageLimitBreached = await checkStorageLimit(
    contractAddress as string,
    invokerAddress as string
  );
  if (storageLimitBreached) {
    const statusCode = 400;
    const message = `Storage for ${contractAddress} is full, please either claim more storage or contact us on twitter @fileverse`;

    return throwError({
      code: statusCode,
      message,
      req,
    });
  }

  next();
};
