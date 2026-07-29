import { Response } from "express";
import { uploadOnlyPrivate } from "../../domain/upload";
import { create } from "../../domain/file";
import { CustomRequest, FileIPFSType } from "../../types";
import { validate, Joi } from "../middleware";
import { throwError } from "../../infra/errorHandler";
import { BatchUploadResponse, getIPFSTypeFromFileName } from "../upload/common";

const batchUploadValidation = {
  headers: Joi.object({
    contract: Joi.string().required(),
    invoker: Joi.string().required(),
  }).unknown(true),
};

const batchUploadFn = async (req: CustomRequest, res: Response) => {
  console.log("entering batchUploadFn handler")
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
    uploadOnlyPrivate({
      file,
      appFileId,
      sourceApp,
      ipfsType: getIPFSTypeFromFileName(file.name),
      contractAddress,
      invokerAddress,
      tags: [],
    })
  );
  const uploadedFiles = await Promise.all(uploadPromises);
  console.log(`response after successful upload`,uploadedFiles);
  console.log("uploading successfull...before writing to mongodb")
  const dbPromises = uploadedFiles.map((ipfsFile) =>
    create({
      appFileId,
      ipfsHash: ipfsFile.ipfsHash,
      gatewayUrl: ipfsFile.ipfsUrl,
      storageType: ipfsFile.storageType,
      contractAddress,
      invokerAddress,
      fileSize: ipfsFile.fileSize,
      tags: [],
      sourceApp,
      ipfsType: ipfsFile.ipfsType,
    })
  );
  await Promise.all(dbPromises);
  const response: BatchUploadResponse = {
    gateIpfsHash: "",
    contentIpfsHash: "",
    metadataIpfsHash: "",
  };
  console.log("after writing to mongodb");

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
};

export default [validate(batchUploadValidation), batchUploadFn];
