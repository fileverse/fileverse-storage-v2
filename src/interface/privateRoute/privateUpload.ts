import { Response } from "express";
import { isArray } from "util";
import { uploadPrivate } from "../../domain/upload";
import { CustomRequest } from "../../types";
import { validate, Joi } from "../middleware";
import { throwError } from "../../infra/errorHandler";

const uploadValidation = {
  headers: Joi.object({
    contract: Joi.string().required(),
  }).unknown(true),
  query: Joi.object({
    tags: Joi.array().items(Joi.string()).optional(),
  }),
};

// Single-file counterpart of /private/batch: workspace folder metadata (and any
// future single-file workspace part) uploads here. Gated by canPrivateUpload at
// the mount. Fails loud — callers anchor the returned hash on-chain, so a
// swallowed error must never surface as a 200.
const privateUploadFn = async (req: CustomRequest, res: Response) => {
  const { contractAddress, invokerAddress } = req;
  const { tags } = req.query;
  const { appFileId, sourceApp, ipfsType } = req.body;

  const file = isArray(req.files?.file) ? req.files?.file[0] : req.files?.file;
  if (!contractAddress || !invokerAddress || !file) {
    return throwError({
      code: 400,
      message: "Invalid request",
      req,
    });
  }
  const createdFile = await uploadPrivate({
    appFileId,
    sourceApp,
    ipfsType,
    contractAddress,
    invokerAddress,
    file: file,
    tags: tags as string[],
  }).catch((err) => {
    console.error("private upload failed: ", err?.message || err);
    return null;
  });

  if (!createdFile?.ipfsHash) {
    return throwError({
      code: 502,
      message: "private upload failed",
      req,
    });
  }

  res.json(createdFile);
};

export default [validate(uploadValidation), privateUploadFn];
