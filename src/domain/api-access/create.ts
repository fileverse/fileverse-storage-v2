import { ApiAccessKey } from "../../infra/database/models";
import { logger } from "../../infra/logger";

export const create = async ({
  id,
  encryptedKeyMaterial,
  encryptedAppMaterial,
}: {
  id: string;
  encryptedKeyMaterial: string;
  encryptedAppMaterial: string;
}) => {
  try {
    const doc = await ApiAccessKey.create({
      id,
      encryptedKeyMaterial,
      encryptedAppMaterial,
      timeStamp: Date.now(),
    });
    
    return doc;
  } catch (error: any) {
    if (error.code === 11000) {
      logger.warn(`Duplicate API access key creation attempted with id: ${id}`);
      throw new Error(`API access key with id ${id} already exists`);
    }
    logger.error(`Error creating API access key with id ${id}:`, error);
    throw error;
  }
};
