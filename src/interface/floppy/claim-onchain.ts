import { claimOnchain } from "../../domain/floppy";
import { throwError } from "../../infra/errorHandler";
import { CustomRequest } from "../../types";
import { validate, Joi } from "../middleware";
import { Response } from "express";
import { Hex } from "viem";

const claimOnchainValidation = {
  body: Joi.object({
    proof: Joi.object({
      merkleTreeDepth: Joi.number().required(),
      merkleTreeRoot: Joi.string().required(),
      nullifier: Joi.string().required(),
      message: Joi.string().required(),
      scope: Joi.string().required(),
      points: Joi.array().items(Joi.string().required()).required(),
    }).required(),
    shortCode: Joi.string().required(),
  }),
  headers: Joi.object({
    contract: Joi.string().required(),
  }).unknown(true),
};

async function claimOnchainHandler(req: CustomRequest, res: Response) {
  const { proof, shortCode } = req.body;
  const { contractAddress } = req;
  if (!shortCode || !proof || !contractAddress) {
    return throwError({
      code: 400,
      message: "Invalid request",
      req,
    });
  }
  const data = await claimOnchain({
    proof,
    shortCode,
    contractAddress: contractAddress as Hex,
  });
  return res.json({ success: !!data, data });
}

export default [validate(claimOnchainValidation), claimOnchainHandler];
