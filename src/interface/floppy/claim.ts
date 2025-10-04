import { claim } from "../../domain/floppy";
import { throwError } from "../../infra/errorHandler";
import { CustomRequest } from "../../types";
import { validate, Joi } from "../middleware";
import { Response } from "express";

const claimValidation = {
  body: Joi.object({
    shortCode: Joi.string().required(),
    identityCommitment: Joi.string().required(),
  }),
};

async function claimHandler(req: CustomRequest, res: Response) {
  const { identityCommitment, shortCode } = req.body;
  if (!identityCommitment || !shortCode) {
    return throwError({
      code: 400,
      message: "Invalid request",
      req,
    });
  }
  const data = await claim({ identityCommitment, shortCode });
  return res.json({ success: !!data, data });
}

export default [validate(claimValidation), claimHandler];
