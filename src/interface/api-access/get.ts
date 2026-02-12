import { get } from "../../domain/api-access";
import { throwError } from "../../infra/errorHandler";
import { CustomRequest } from "../../types";
import { validate, Joi } from "../middleware";
import { Response } from "express";
import { logger } from "../../infra/logger";

const getValidation = {
  params: Joi.object({
    hashedApiKey: Joi.string().required(),
  }),
};

async function getHandler(req: CustomRequest, res: Response) {
  const { hashedApiKey } = req.params;
  
  try {
    const data = await get({
      hashedApiKey,
    });
    
    if (!data) {
      logger.warn(`API access key not found for hashedApiKey: ${hashedApiKey}`);
      return throwError({
        code: 404,
        message: "API access not found",
        req,
      });
    }

    logger.info(`API access key found for hashedApiKey: ${hashedApiKey}`);
    return res.json({
      encryptedKeyMaterial: data.encryptedKeyMaterial,
      encryptedAppMaterial: data.encryptedAppMaterial,
      id: data.id,
    });
  } catch (error: any) {
    if (error.code) {
      throw error;
    }
    
    logger.error(`Error fetching API access key with hashedApiKey ${hashedApiKey}:`, error);
    return throwError({
      code: 500,
      message: "Failed to fetch API access key",
      req,
    });
  }
}

export default [validate(getValidation), getHandler];
