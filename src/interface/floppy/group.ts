import { group } from "../../domain/floppy";
import { throwError } from "../../infra/errorHandler";
import { CustomRequest } from "../../types";
import { validate, Joi } from "../middleware";
import { Response } from "express";

const groupValidation = {
  body: Joi.object({
    shortCode: Joi.string().required(),
  }),
};

async function groupHandler(req: CustomRequest, res: Response) {
  const { shortCode } = req.body;
  if (!shortCode) {
    return throwError({
      code: 400,
      message: "Invalid request",
      req,
    });
  }
  const data = await group({ shortCode });
  return res.json({
    success: !!data, data
  });
}

export default [validate(groupValidation), groupHandler];
