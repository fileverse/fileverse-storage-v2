import { create } from "../../domain/api-access";
import { throwError } from "../../infra/errorHandler";
import { CustomRequest } from "../../types";
import { validate, Joi } from "../middleware";
import { Response } from "express";

const saveValidation = {
  body: Joi.object({
    encryptedKeyMaterial: Joi.string().required(),
    encryptedAppMaterial: Joi.string().required(),
    id: Joi.string().required(),
  }),
};

async function saveHandler(req: CustomRequest, res: Response) {
  const { encryptedKeyMaterial, encryptedAppMaterial, id } = req.body;

  await create({
    id,
    encryptedKeyMaterial,
    encryptedAppMaterial,
  });

  return res.status(201).json({
    success: true,
    id,
  });
}

export default [validate(saveValidation), saveHandler];
