import { ApiAccessKey } from "../../infra/database/models";
import { logger } from "../../infra/logger";

export const get = async ({
  hashedApiKey,
}: {
  hashedApiKey: string;
}) => {
  if (!hashedApiKey || typeof hashedApiKey !== 'string') {
    logger.warn(`Invalid hashedApiKey provided: ${hashedApiKey}`);
    return null;
  }

  try {
    const doc = await ApiAccessKey.findOne({
      encryptedKeyMaterial: hashedApiKey,
    });
    
    if (!doc) {
      logger.warn(`API access key not found for hashedApiKey: ${hashedApiKey}`);
      return null;
    }
    
    return doc;
  } catch (error: any) {
    logger.error(`Error fetching API access key with hashedApiKey ${hashedApiKey}:`, error);
    throw error;
  }
};
