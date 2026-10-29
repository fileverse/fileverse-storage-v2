import { Request, Response } from "express";
import { flagPortalForRebuild, getStorageUse } from "../../domain/limit";
import { PortalStorageView } from "../../types";
import { validate, Joi } from "../middleware";

const portalStorageValidation = {
  params: Joi.object({
    contractAddress: Joi.string()
      .pattern(/^0x[a-fA-F0-9]{40}$/)
      .required(),
  }),
};

async function getPortalStorage(req: Request, res: Response) {
  const contractAddress = String(req.params.contractAddress).toLowerCase();
  await flagPortalForRebuild(contractAddress);
  const usage = await getStorageUse({
    contractAddress,
    shouldIncludeLegacy: false,
  });
  const view: PortalStorageView = {
    contractAddress,
    storageLimit: Number(usage.storageLimit) + Number(usage.extraStorage),
    storageUse: Number(usage.storageUse),
    pro: usage.pro,
    locked: usage.locked,
  };
  res.json(view);
}

export default [validate(portalStorageValidation), getPortalStorage];
