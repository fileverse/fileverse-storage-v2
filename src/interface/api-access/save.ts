import { create } from "../../domain/api-access";
import { throwError } from "../../infra/errorHandler";
import { CustomRequest } from "../../types";
import { validate, Joi } from "../middleware";
import { Response } from "express";
import { logger } from "../../infra/logger";

const saveValidation = {
  body: Joi.object({
    encryptedKeyMaterial: Joi.string().required(),
    encryptedAppMaterial: Joi.string().required(),
    id: Joi.string().required(),
  }),
};

async function saveHandler(req: CustomRequest, res: Response) {
  const { encryptedKeyMaterial, encryptedAppMaterial, id } = req.body;
  try {
    const doc = await create({
      id,
      encryptedKeyMaterial,
      encryptedAppMaterial,
    });
    logger.info(`Successfully created API access key with id: ${id}`);

    return res.status(201).json({
      success: true,
      id,
    });
  } catch (error: any) {
    if (error.code && error.code !== 11000) {
      throw error;
    }
    if (error.code === 11000 || (error.message && error.message.includes("already exists"))) {
      return throwError({
        code: 409,
        message: `API access key with id ${id} already exists`,
        req,
      });
    }
    
    logger.error(`Error creating API access key with id ${id}:`, error);
    return throwError({
      code: 500,
      message: "Failed to save API access key",
      req,
    });
  }
}

export default [validate(saveValidation), saveHandler];
