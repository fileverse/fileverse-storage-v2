import { config } from "../../config";
import { Limit } from "../../infra/database/models";
const DEFAULT_STORAGE_LIMIT = 200000000;

export const getStorageUse = async ({
  contractAddress,
}: {
  contractAddress: string;
}) => {
  const limit = await Limit.findOne({ contractAddress });
  const defaultStorageLimit = config.DEFAULT_STORAGE_LIMIT
    ? parseInt(config.DEFAULT_STORAGE_LIMIT) // need to typecast to int env vars are string values or undefined
    : DEFAULT_STORAGE_LIMIT;

  return {
    contractAddress,
    storageLimit: limit?.storageLimit || defaultStorageLimit,
    storageUse: limit?.storageUse || 0,
    unit: limit?.unit || "bytes",
    extraStorage: limit?.extraStorage || 0,
  };
};
