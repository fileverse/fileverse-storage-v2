import { getStorageUse } from "../../domain/limit/getStorageUse";
import { NextFunction } from "express";
import { CustomRequest } from "../../types";
import { Response } from "express";
import { throwError } from "../../infra/errorHandler";
import { getCache, setCache } from "../../infra/cache";
import { checkIsWorkspace } from "../../domain/workspace";
import { config } from "../../config";

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
  const isPrivateUpload = req.baseUrl.includes("/private");
  if (!req.isAuthenticated) {
    const statusCode = invokerAddress ? 403 : 401;
    const message = `invokerAddress: ${invokerAddress} does not have permission to upload file for subdomain: ${contractAddress}`;

    return throwError({
      code: statusCode,
      message,
      req,
    });
  }

  if( isPrivateUpload){
    if(!contractAddress){
        return throwError({
            code: 401,
            message: "contract address not found",
            req
        });
    }
    const cacheKey = `workspace:${contractAddress.toLowerCase()}`;
    const cached = await getCache(cacheKey);
    let isWorkspace: boolean;

    if(cached != null){
        isWorkspace=cached==="true";
    }
    else{
        isWorkspace = await checkIsWorkspace(contractAddress);
        await setCache(
            cacheKey,
            String(isWorkspace),
            Number(config.WORKSPACE_STATUS_TTL)
        );
    }
    if(!isWorkspace){
        return throwError({
            code:403,
            message:`contract ${contractAddress} is not a workspace`,
            req,
        });
    }
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
