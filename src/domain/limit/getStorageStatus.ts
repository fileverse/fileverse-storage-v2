import { config } from "../../config";
import { Limit } from "../../infra/database/models";

export const getStorageStatus = async ({
  contractAddress,
  invokerAddress,
  setCache = false,
}: {
  contractAddress: string;
  invokerAddress: string;
  setCache?: boolean;
}) => {
  const limit = await Limit.findOne({ contractAddress });

  return {
    contractAddress,
    storageLimit: (limit && limit.storageLimit) || config.DEFAULT_STORAGE_LIMIT,

    extendableStorage: limit?.extendableStorage ?? 10000000,
  };
};
