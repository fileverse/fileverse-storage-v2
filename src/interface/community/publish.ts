import { create } from "../../domain/communityFiles";
import { Response } from "express";
import { Joi, validate } from "../middleware";
import { CustomRequest } from "../../types";
import { ICreateCommunityFilesParams } from "../../types";

const publishValidation = {
  body: Joi.object({
    publishedBy: Joi.string().required(),
    thumbnailIPFSHash: Joi.string().required(),
    title: Joi.string().required(),
    category: Joi.string().required(),
    fileLink: Joi.string().required(),
    dsheetId: Joi.string().required(),
    userHash: Joi.string().required(),
    portalAddress: Joi.string().required(),
  }),
};

const publish = async (req: CustomRequest, res: Response) => {
  const params = req.body as ICreateCommunityFilesParams;

  const createdFile = await create(params);

  res.json(createdFile);
};

export default [validate(publishValidation), publish];
