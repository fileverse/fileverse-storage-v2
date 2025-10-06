import { list } from "../../domain/floppy";
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
  query: Joi.object({
    identityCommitment: Joi.string().optional(),
  }),
};

async function listHandler(req: CustomRequest, res: Response) {
  const { contractAddress } = req;
  const { identityCommitment } = req.query;
  if (!contractAddress) {
    return throwError({
      code: 400,
      message: "Invalid request",
      req,
    });
  }
  try {
    const dataList = await list({ identityCommitment: identityCommitment as string, contractAddress: contractAddress as string });
    return res.json({ success: true, floppy: dataList });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
}
export default [validate(listValidation), listHandler];
