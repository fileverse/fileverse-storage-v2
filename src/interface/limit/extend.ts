import { extendStorage } from "../../domain/limit";
import { CustomRequest } from "../../types";
import { validate, Joi } from "../middleware";
import { throwError } from "../../infra/errorHandler";

import { Response } from "express";
const extendValidation = {
  headers: Joi.object({
    contract: Joi.string().required(),
    invoker: Joi.string().required(),
    chain: Joi.string().required(),
  }).unknown(true),
};

async function extendHandler(req: CustomRequest, res: Response) {
  const { contractAddress, invokerAddress, chainId } = req;
  console.log({ contractAddress, invokerAddress, chainId });
  if (!contractAddress || !invokerAddress || !chainId) {
    return throwError({
      code: 400,
      message: "Invalid request",
      req,
    });
  }
  try {
    const data = await extendStorage({ contractAddress });
    return res.json({ success: data, message: "Storage extended" });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
}
export default [validate(extendValidation), extendHandler];
