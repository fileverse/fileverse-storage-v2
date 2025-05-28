import { getStorageUse } from "../../domain/limit";
import { validate, Joi } from "../middleware";
import { CustomRequest } from "../../types";
import { Response } from "express";
import { throwError } from "../../infra/errorHandler";

const useValidation = {
  headers: Joi.object({
    contract: Joi.string().required(),
    invoker: Joi.string().required(),
    chain: Joi.string().required(),
  }).unknown(true),
};

async function use(req: CustomRequest, res: Response) {
  const { contractAddress, invokerAddress, chainId } = req;
  console.log({ contractAddress, invokerAddress, chainId });
  if (!contractAddress || !invokerAddress || !chainId) {
    return throwError({
      code: 400,
      message: "Invalid request",
      req,
    });
  }
  const data = await getStorageUse({ contractAddress });
  console.log({ data });
  res.json({ ...data, storageLimit: data.storageLimit + data.extraStorage });
}

export default [validate(useValidation), use];
