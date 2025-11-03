import { get } from "../../domain/floppy";
import { throwError } from "../../infra/errorHandler";
import { CustomRequest } from "../../types";
import { validate, Joi } from "../middleware";
import { Response } from "express";

const getValidation = {
  params: Joi.object({
    shortCode: Joi.string().required(),
  }),
};

async function getHandler(req: CustomRequest, res: Response) {
  const { shortCode } = req.params;
  if (!shortCode) {
    return throwError({
      code: 400,
      message: "Invalid request",
      req,
    });
  }
  const data = await get({ shortCode });
  return res.json({ success: !!data, data });
}

export default [validate(getValidation), getHandler];
