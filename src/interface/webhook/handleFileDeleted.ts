import { Request, Response } from "express";
import { deleteByIpfsHashes } from "../../domain/file";
import { throwError } from "../../infra/errorHandler";

export async function handleFileDeleted(req: Request, res: Response) {
  const { contractAddress, ipfsHashes, appFileId } = req.body;

  if (!contractAddress) {
    return throwError({ code: 400, message: "contractAddress is required", req });
  }

  if (!Array.isArray(ipfsHashes) || ipfsHashes.length === 0) {
    return throwError({
      code: 400,
      message: "ipfsHashes must be a non-empty array",
      req,
    });
  }

  if (appFileId !== undefined && !(typeof appFileId === "string" && appFileId)) {
    return throwError({ code: 400, message: "appFileId must be a non-empty string", req });
  }

  const result = await deleteByIpfsHashes({ contractAddress, ipfsHashes, appFileId });

  res.json(result);
}
