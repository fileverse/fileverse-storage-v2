import {
  getStorageUse,
  getLegacyStorageUse,
  flagPortalForRebuild,
} from "../../domain/limit";
import { validate, Joi } from "../middleware";
import { CustomRequest } from "../../types";
import { Response } from "express";
import { throwError } from "../../infra/errorHandler";

import { isLegacyContract } from "../../domain/contract";
import { Hex } from "viem";

const useValidation = {
  headers: Joi.object({
    contract: Joi.string().required(),
    invoker: Joi.string().required(),
    chain: Joi.string().required(),
  }).unknown(true),
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
      await flagPortalForRebuild(contractAddress);
      const appStorage = await getStorageUse({
        contractAddress,
        shouldIncludeLegacy: false,
      });
      data.storageLimit += Number(appStorage.storageLimit);
      data.storageLimit += Number(appStorage.extraStorage);
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
