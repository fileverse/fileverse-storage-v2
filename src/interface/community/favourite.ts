import { favourite } from "../../domain/communityFiles/favourite";
import { Response } from "express";
import { Joi, validate } from "../middleware";
import { CustomRequest } from "../../types";

const favouriteValidation = {
  body: Joi.object({
    fileId: Joi.string().required(),
  }),
  headers: Joi.object({
    invoker: Joi.string().required(),
  }),
};

const setFavourite = async (req: CustomRequest, res: Response) => {
  const { fileId } = req.body;
  const { invokerAddress } = req;
  if (!invokerAddress) {
    throw new Error("Invoker address is required");
  }
  const file = await favourite(fileId, invokerAddress);
  res.json(file);
};

export default [validate(favouriteValidation), setFavourite];
