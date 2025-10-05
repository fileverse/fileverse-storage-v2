import { redeem } from "../../domain/floppy";
import { throwError } from "../../infra/errorHandler";
import { CustomRequest } from "../../types";
import { validate, Joi } from "../middleware";
import { Response } from "express";

const redeemValidation = {
  headers: Joi.object({
    contract: Joi.string().required(),
    invoker: Joi.string().required(),
    chain: Joi.string().required(),
  }).unknown(true),
  body: Joi.object({
    shortCode: Joi.string().required(),
    proof: Joi.object({
      merkleTreeDepth: Joi.number().required(),
      merkleTreeRoot: Joi.string().required(),
      nullifier: Joi.string().required(),
      message: Joi.string().required(),
      scope: Joi.string().required(),
      points: Joi.array().items(Joi.string().required()).required()
    }).required(),
  }),
};

async function redeemHandler(req: CustomRequest, res: Response) {
  const { contractAddress, invokerAddress, chainId } = req;
  const { shortCode, proof  } = req.body;
  if (!shortCode || !proof) {
    return throwError({
      code: 400,
      message: "Invalid request",
      req,
    });
  }
  const data = await redeem({ contractAddress, invokerAddress, chainId, shortCode, proof });
  return res.json({ success: !!data, data });
}

export default [validate(redeemValidation), redeemHandler];
