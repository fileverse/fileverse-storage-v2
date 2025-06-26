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

  const storageLimit = limit?.storageLimit
    ? Number(limit.storageLimit)
    : defaultStorageLimit;
  const storageUse = limit?.storageUse ? Number(limit.storageUse) : 0;
  const extraStorage = limit?.extraStorage ? Number(limit.extraStorage) : 0;

  return {
    contractAddress,
    storageLimit,
    storageUse,
    unit: limit?.unit || "bytes",
    extraStorage,
  };
};
