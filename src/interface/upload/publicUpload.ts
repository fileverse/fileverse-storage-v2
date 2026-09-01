import { Response } from "express";
import { isArray } from "util";
import { upload as uploadToPinata } from "../../domain/ipfs";
import { CustomRequest } from "../../types";
import { throwError } from "../../infra/errorHandler";

const uploadPublicFn = async (req: CustomRequest, res: Response) => {
  const file = isArray(req.files?.file) ? req.files?.file[0] : req.files?.file;
  if (!file) {
    return throwError({
      code: 400,
      message: "Invalid request",
      req,
    });
  }

  const { name, mimetype, data } = file;

  const ipfsFile = await uploadToPinata({ name, mimetype, data });

  // Pre-migration response shape; pinataId stays internal (this route creates
  // no DB row, its files are permanent by design).
  res.json({
    ipfsUrl: ipfsFile.ipfsUrl,
    ipfsHash: ipfsFile.ipfsHash,
    storageType: ipfsFile.storageType,
    ipfsStorage: ipfsFile.ipfsStorage,
    pinSize: ipfsFile.pinSize,
    timestamp: ipfsFile.timestamp,
  });
};

export default [uploadPublicFn];