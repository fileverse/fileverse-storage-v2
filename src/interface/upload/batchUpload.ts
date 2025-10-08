import { Response } from "express";

import { upload } from "../../domain";
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

  const uploadPrmomises: Promise<any>[] = [];
  files.forEach((file) => {
    if (file) {
      const fileName = file.name;
      uploadPrmomises.push(
        upload({
          file,
          appFileId,
          sourceApp,
          ipfsType: getIPFSTypeFromFileName(fileName),
          contractAddress,
          invokerAddress,
          tags: [],
        })
      );
    }
  });

  const createdFiles = await Promise.all(uploadPrmomises);
  const response: IBatchUploadResponse = {
    gateIpfsHash: "",
    contentIpfsHash: "",
    metadataIpfsHash: "",
  };
  for (const file of createdFiles) {
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
