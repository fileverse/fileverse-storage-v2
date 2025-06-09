import { create } from "../../domain/communityFiles";
import { Response } from "express";
import { Joi, validate } from "../middleware";
import { CustomRequest } from "../../types";

const publishValidation = {
  body: Joi.object({
    publishedBy: Joi.string().required(),
    thumbnailIPFSHash: Joi.string().required(),
    title: Joi.string().required(),
    category: Joi.string().required(),
    fileIPFSHash: Joi.string().required(),
  }),
};

const publish = async (req: CustomRequest, res: Response) => {
  const { publishedBy, thumbnailIPFSHash, title, category, fileIPFSHash } =
    req.body;

  const createdFile = await create({
    publishedBy,
    thumbnailIPFSHash,
    title,
    category,
    fileIPFSHash,
  });

  res.json(createdFile);
};

export default [validate(publishValidation), publish];
