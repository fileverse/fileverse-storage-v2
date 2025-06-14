import { Response } from "express";
import { CustomRequest } from "../../types";
import { getCommunityFile } from "../../domain/communityFiles";
import { Joi, validate } from "../middleware";
const getValidation = {
  params: Joi.object({
    dsheetId: Joi.string().required(),
  }),
  headers: Joi.object({
    contract: Joi.string().required(),
  }).unknown(true),
};

const get = async (req: CustomRequest, res: Response) => {
  const { dsheetId } = req.params;
  const { contractAddress } = req;
  if (!contractAddress) {
    throw new Error("Contract address is required");
  }
  const file = await getCommunityFile({ dsheetId, contractAddress });
  res.json(file);
};

export default [validate(getValidation), get];
