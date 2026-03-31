import { config } from "../../config";
import LegacyPortalLimit from "../../infra/database/models/legacy-portal-limit";

export const getLegacyStorageUse = async ({
  contractAddress,
  allContracts,
  invokerAddress,
}: {
  contractAddress: string;
  allContracts: string[];
  invokerAddress: string;
}) => {
  const legacyPortalLimit = await LegacyPortalLimit.findOne({
    contractAddress,
  });
  if (legacyPortalLimit) {
    return {
      storageLimit: Number(legacyPortalLimit.storageLimit),
      extraStorage: Number(legacyPortalLimit.extraStorage),
      storageUse: Number(legacyPortalLimit.storageUse),
      unit: "bytes",
      contractAddress,
    };
  }
  const response = await fetch(
    `${config.LEGACY_STORAGE_BACKEND}/limit/legacy-use`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        contract: contractAddress,
      },
    }
  );
  if (!response.ok) {
    return {
      storageLimit: 0,
      extraStorage: 0,
      storageUse: 0,
      unit: "bytes",
      contractAddress,
    };
  }
  const data = await response.json();
  const parentPortalAddress = allContracts.find(
    (contract) => contract !== contractAddress
  );
  if (parentPortalAddress) {
    await LegacyPortalLimit.create({
      contractAddress,
      storageLimit: data.storageLimit,
      extraStorage: data.extraStorage,
      storageUse: data.storageUse,
      unit: data.unit,
      parentPortalAddress,
      invokerAddress,
    });
  }
  return {
    storageLimit: data.storageLimit,
    extraStorage: data.extraStorage,
    storageUse: data.storageUse,
    unit: data.unit,
    contractAddress: data.contractAddress,
  };
};
