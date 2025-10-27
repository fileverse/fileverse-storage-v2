import { getStorageStatus } from "../../domain/limit";
import { throwError } from "../../infra/errorHandler";
import { CustomRequest } from "../../types";
import { validate, Joi } from "../middleware";
import { Response } from "express";

const checkValidation = {
  headers: Joi.object({
    contract: Joi.string().required(),
    invoker: Joi.string().required(),
    chain: Joi.string().required(),
  }).unknown(true),
};

async function check(req: CustomRequest, res: Response) {
  const { contractAddress, invokerAddress, chainId } = req;
  if (!contractAddress || !invokerAddress || !chainId) {
    return throwError({
      code: 400,
      message: "Invalid request",
      req,
    });
  }
  const data = await getStorageStatus({ contractAddress, invokerAddress });
  res.json(data);
}

export default [validate(checkValidation), check];
