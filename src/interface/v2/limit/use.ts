import { getStorageUse, getLegacyStorageUse } from "../../../domain/limit";
import { validate, Joi } from "../../middleware";
import { CustomRequest } from "../../../types";
import { Response } from "express";
import { throwError } from "../../../infra/errorHandler";

const useV2Validation = {
  headers: Joi.object({
    "x-contract-meta": Joi.string().required(),
    "x-invoker-address": Joi.string().required(),
  }).unknown(true),
};

async function use(req: CustomRequest, res: Response) {
  const { invokerAddress, chainId, contractMeta } = req;

  if (!contractMeta || contractMeta.length === 0 || !invokerAddress || !chainId) {
    return throwError({
      code: 400,
      message: "Invalid request",
      req,
    });
  }

  const allContracts = contractMeta.map((m) => m.contractAddress);

  const data = {
    storageLimit: 0,
    extraStorage: 0,
    storageUse: 0,
    unit: "bytes",
    contractAddress: allContracts.join(","),
  };

  for (const meta of contractMeta) {
    const { contractAddress, version } = meta;
    const isLegacy = version === "v1";

    if (isLegacy) {
      const legacyStorage = await getLegacyStorageUse({
        contractAddress,
        allContracts,
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

export default [validate(useV2Validation), use];
