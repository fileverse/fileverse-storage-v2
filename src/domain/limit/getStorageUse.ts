import { config } from "../../config";
import { LegacyPortalLimit, Limit } from "../../infra/database/models";
import { resolveBaseStorageLimit } from "./proStorageLimit";

const DEFAULT_STORAGE_LIMIT = 200000000;

export const getDefaultStorageLimit = (): number =>
  config.DEFAULT_STORAGE_LIMIT
    ? parseInt(config.DEFAULT_STORAGE_LIMIT) // need to typecast to int env vars are string values or undefined
    : DEFAULT_STORAGE_LIMIT;

export const getStorageUse = async ({
  contractAddress,
  shouldIncludeLegacy = true,
}: {
  contractAddress: string;
  shouldIncludeLegacy?: boolean;
}) => {
  const limit = await Limit.findOne({ contractAddress });
  const legacyPortalLimit = await LegacyPortalLimit.findOne({
    parentPortalAddress: contractAddress,
  });

  const pro = limit?.pro === true;
  let storageLimit = resolveBaseStorageLimit({
    rowLimit: limit?.storageLimit ? Number(limit.storageLimit) : null,
    defaultLimit: getDefaultStorageLimit(),
    pro,
    proLimit: Number(config.PRO_STORAGE_LIMIT),
  });
  let storageUse = limit?.storageUse ? Number(limit.storageUse) : 0;
  const extraStorage = limit?.extraStorage ? Number(limit.extraStorage) : 0;

  if (legacyPortalLimit && shouldIncludeLegacy) {
    storageLimit += Number(legacyPortalLimit.storageLimit);
    storageUse += Number(legacyPortalLimit.storageUse);
  }

  if (limit?.redeemMap && Object.keys(limit.redeemMap).length > 0) {
    storageLimit += Object.values(
      limit.redeemMap as Record<string, number>
    ).reduce((acc: number, curr: number) => acc + curr, 0);
  }

  return {
    contractAddress,
    storageLimit,
    storageUse,
    unit: limit?.unit || "bytes",
    extraStorage,
    pro,
  };
};
