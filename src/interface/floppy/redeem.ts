// import { redeem } from "../../domain/floppy";
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
    proof: Joi.string().required(),
  }),
};

async function redeem(req: CustomRequest, res: Response) {
  const { shortCode, proof  } = req.body;
  if (!shortCode || !proof) {
    return throwError({
      code: 400,
      message: "Invalid request",
      req,
    });
  }
  // const data = await redeem({ shortCode, proof });
  // res.json(data);
  return res.json({ success: true, message: "Floppy redeemed" });
}

export default [validate(redeemValidation), redeem];
