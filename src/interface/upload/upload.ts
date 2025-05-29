import { Response } from "express";
import { isArray } from "util";
import { upload } from "../../domain";
import { CustomRequest } from "../../types";
import { validate, Joi } from "../middleware";
import { throwError } from "../../infra/errorHandler";
// import { Log } from "../../domain/file";

const uploadValidation = {
  headers: Joi.object({
    contract: Joi.string().required(),
  }).unknown(true),
  query: Joi.object({
    tags: Joi.array().items(Joi.string()).optional(),
  }),
};

const uploadFn = async (req: CustomRequest, res: Response) => {
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
  const createdFile = await upload({
    appFileId,
    sourceApp,
    ipfsType,
    contractAddress,
    invokerAddress,
    file: file,
    tags: tags as string[],
  }).catch(console.log);

  res.json(createdFile);
};

export default [validate(uploadValidation), uploadFn];
