// import { list } from "../../domain/floppy";
import { CustomRequest } from "../../types";
import { validate, Joi } from "../middleware";
import { throwError } from "../../infra/errorHandler";

import { Response } from "express";
const listValidation = {
  headers: Joi.object({
    contract: Joi.string().required(),
    invoker: Joi.string().required(),
    chain: Joi.string().required(),
  }).unknown(true),
};

async function listHandler(req: CustomRequest, res: Response) {
  const { contractAddress, invokerAddress, chainId, identityCommitment, proof } = req.body;
  console.log({ contractAddress, invokerAddress, chainId });
  if (!contractAddress || !invokerAddress || !chainId) {
    return throwError({
      code: 400,
      message: "Invalid request",
      req,
    });
  }
  try {
    // const dataList = await list({ contractAddress });
    // return res.json({ floppy: dataList });
    return res.json({ success: true, floppy: [] });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
}
export default [validate(listValidation), listHandler];
