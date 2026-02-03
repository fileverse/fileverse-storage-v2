import { remove } from "../../domain/api-access";
import { throwError } from "../../infra/errorHandler";
import { CustomRequest } from "../../types";
import { validate, Joi } from "../middleware";
import { Response } from "express";

const removeValidation = {
  params: Joi.object({
    hashedApiKey: Joi.string().required(),
  }),
};

async function removeHandler(req: CustomRequest, res: Response) {
  const { hashedApiKey } = req.params;
  const result = await remove({
    hashedApiKey,
  });

  if (result.deletedCount === 0) {
    return throwError({
      code: 404,
      message: "API access not found",
      req,
    });
  }

  return res.status(200).json({
    success: true,
    message: "API access removed successfully",
  });
}

export default [validate(removeValidation), removeHandler];
