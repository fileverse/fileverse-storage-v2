import { Response } from "express";

import { uploadOnly } from "../../domain/upload";
import { create } from "../../domain/file";
import { CustomRequest, FileIPFSType } from "../../types";
import { validate, Joi } from "../middleware";
import { throwError } from "../../infra/errorHandler";

const batchUploadValidation = {
  headers: Joi.object({
    contract: Joi.string().required(),
  }).unknown(true),
};

interface IBatchUploadResponse {
  gateIpfsHash: string;
  contentIpfsHash: string;
  metadataIpfsHash: string;
}

const getIPFSTypeFromFileName = (fileName: string) => {
  if (fileName.includes("METADATA")) return FileIPFSType.METADATA;
  if (fileName.includes("CONTENT")) return FileIPFSType.CONTENT;
  if (fileName.includes("GATE")) return FileIPFSType.GATE;
  throw new Error("Invalid file name");
};

const batchUploadFn = async (req: CustomRequest, res: Response) => {
  try {
    const { contractAddress, invokerAddress } = req;
    const files = Array.isArray(req.files?.files) ? req.files?.files : [];
    const { appFileId, sourceApp } = req.body;

    if (!contractAddress || !invokerAddress || !files || files?.length === 0) {
      return throwError({
        code: 400,
        message: "Invalid request",
        req,
      });
    }

    const uploadPromises = files.map((file) =>
      uploadOnly({
        file,
        appFileId,
        sourceApp,
        ipfsType: getIPFSTypeFromFileName(file.name),
        contractAddress,
        invokerAddress,
        tags: [],
      })
    );
    console.time("pinata upload");
    const uploadedFiles = await Promise.all(uploadPromises);
    console.timeEnd("pinata upload");

    const dbPromises = uploadedFiles.map((ipfsFile) =>
      create({
        appFileId,
        ipfsHash: ipfsFile.ipfsHash,
        gatewayUrl: ipfsFile.ipfsUrl,
        contractAddress,
        invokerAddress,
        fileSize: ipfsFile.fileSize,
        tags: [],
        sourceApp,
        ipfsType: ipfsFile.ipfsType,
      })
    );
    console.time("db create");
    await Promise.all(dbPromises);
    console.timeEnd("db create");
    const response: IBatchUploadResponse = {
      gateIpfsHash: "",
      contentIpfsHash: "",
      metadataIpfsHash: "",
    };

    for (const file of uploadedFiles) {
      if (file.ipfsType === FileIPFSType.GATE) {
        response.gateIpfsHash = file.ipfsHash;
      } else if (file.ipfsType === FileIPFSType.CONTENT) {
        response.contentIpfsHash = file.ipfsHash;
      } else if (file.ipfsType === FileIPFSType.METADATA) {
        response.metadataIpfsHash = file.ipfsHash;
      }
    }

    res.json(response);
  } catch (err) {
    throw err;
  }
};

export default [validate(batchUploadValidation), batchUploadFn];
