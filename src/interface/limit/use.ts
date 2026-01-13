import { getStorageUse } from "../../domain/limit";
import { validate, Joi } from "../middleware";
import { CustomRequest } from "../../types";
import { Response } from "express";
import { throwError } from "../../infra/errorHandler";

import { isLegacyContract } from "../../domain/contract";
import { Hex } from "viem";
import { config } from "../../config";
import LegacyPortalLimit from "../../infra/database/models/legacy-portal-limit";

const useValidation = {
  headers: Joi.object({
    contract: Joi.string().required(),
    invoker: Joi.string().required(),
    chain: Joi.string().required(),
  }).unknown(true),
};

const getLegacyStorageUse = async ({
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
      parentPortalAddress: parentPortalAddress,
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

async function use(req: CustomRequest, res: Response) {
  const { invokerAddress, chainId, contractAddresses } = req;

  if (
    !contractAddresses ||
    contractAddresses.length === 0 ||
    !invokerAddress ||
    !chainId
  ) {
    return throwError({
      code: 400,
      message: "Invalid request",
      req,
    });
  }

  const data = {
    storageLimit: 0,
    extraStorage: 0,
    storageUse: 0,
    unit: "bytes",
    contractAddress: contractAddresses.join(","),
  };

  for (const contractAddress of contractAddresses) {
    const isLegacy = await isLegacyContract(contractAddress as Hex);
    if (isLegacy) {
      const legacyStorage = await getLegacyStorageUse({
        contractAddress,
        allContracts: contractAddresses,
        invokerAddress,
      });

      if (legacyStorage) {
        data.storageLimit += Number(legacyStorage.storageLimit);
        data.extraStorage += Number(legacyStorage.extraStorage);
        data.storageUse += Number(legacyStorage.storageUse);
      }
    } else {
      const appStorage = await getStorageUse({
        contractAddress,
        shouldIncludeLegacy: false,
      });
      data.storageLimit += Number(appStorage.storageLimit);
      data.extraStorage += Number(appStorage.extraStorage);
      data.storageUse += Number(appStorage.storageUse);
    }
  }

  res.json({
    ...data,
    storageLimit: Number(data.storageLimit),
  });
}

export default [validate(useValidation), use];
