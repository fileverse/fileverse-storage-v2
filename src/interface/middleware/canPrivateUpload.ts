import { NextFunction, Response } from "express";
import { resolveWorkspaceStatus } from "../../domain/workspace";
import { throwError } from "../../infra/errorHandler";
import { CustomRequest } from "../../types";
import { throwForWorkspaceLookupError } from "../workspaceStatusErrors";
import { checkStorageLimit } from "./canUpload";

export const canPrivateUpload = async (
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

  if (!contractAddress) {
    return throwError({
      code: 401,
      message: "contract address not found",
      req,
    });
  }

  let isWorkspace: boolean;
  try {
    isWorkspace = await resolveWorkspaceStatus(contractAddress);
  } catch (err) {
    return throwForWorkspaceLookupError(err, req, res, contractAddress);
  }

  if (!isWorkspace) {
    return throwError({
      code: 403,
      message: `contract ${contractAddress} is not a workspace`,
      req,
    });
  }

  const storageLimitBreached = await checkStorageLimit(
    contractAddress,
    invokerAddress as string
  );

  if (storageLimitBreached) {
    return throwError({
      code: 400,
      message: `Storage for ${contractAddress} is full, please either claim more storage or contact us on twitter @fileverse`,
      req,
    });
  }

  next();
};
