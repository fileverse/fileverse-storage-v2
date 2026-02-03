import { get } from "../../domain/api-access";
import { throwError } from "../../infra/errorHandler";
import { CustomRequest } from "../../types";
import { validate, Joi } from "../middleware";
import { Response } from "express";

const getValidation = {
  params: Joi.object({
    hashedApiKey: Joi.string().required(),
  }),
};

async function getHandler(req: CustomRequest, res: Response) {
  const { hashedApiKey } = req.params;
  const data = await get({
    hashedApiKey,
  });

  if (!data) {
    return throwError({
      code: 404,
      message: "API access not found",
      req,
    });
  }

  return res.json({
    encryptedKeyMaterial: data.encryptedKeyMaterial,
    encryptedAppMaterial: data.encryptedAppMaterial,
    id: data.id,
  });
}

export default [validate(getValidation), getHandler];
