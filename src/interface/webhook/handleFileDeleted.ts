import { Request, Response } from "express";
import { deleteByIpfsHashes } from "../../domain/file";
import { throwError } from "../../infra/errorHandler";

export async function handleFileDeleted(req: Request, res: Response) {
  const { contractAddress, ipfsHashes } = req.body;

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

  const result = await deleteByIpfsHashes({ contractAddress, ipfsHashes });

  res.json(result);
}
