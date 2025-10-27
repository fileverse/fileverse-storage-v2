import { grant } from "../../domain/floppy";
import { throwError } from "../../infra/errorHandler";
import { CustomRequest } from "../../types";
import { validate, Joi } from "../middleware";
import { Response } from "express";

const grantValidation = {
  body: Joi.object({
    commitment: Joi.string().required(),
    shortCode: Joi.string().required(),
  }),
};

async function grantHandler(req: CustomRequest, res: Response) {
  const { commitment, shortCode } = req.body;
  console.log(commitment, shortCode);
  if (!commitment || !shortCode) {
    return throwError({
      code: 400,
      message: "Invalid request",
      req,
    });
  }
  const data = await grant({
    commitment,
    shortCode,
  });
  return res.json({ success: !!data, data });
}

export default [validate(grantValidation), grantHandler];
