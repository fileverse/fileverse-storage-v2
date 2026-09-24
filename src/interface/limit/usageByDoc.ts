import { Response } from "express";
import { Hex } from "viem";
import { getUsageByDoc, legacyPortalUsage } from "../../domain/limit";
import { isLegacyContract } from "../../domain/contract";
import { validate, Joi } from "../middleware";
import { CustomRequest } from "../../types";
import { throwError } from "../../infra/errorHandler";

const usageByDocValidation = {
  headers: Joi.object({
    contract: Joi.string().required(),
    invoker: Joi.string().required(),
    chain: Joi.string().required(),
  }).unknown(true),
};

// Only the portal the token verified for is served: the auth layer accepts a
// contract list as soon as one entry verifies, and per-document data must not
// follow the rest of the list.
async function usageByDoc(req: CustomRequest, res: Response) {
  const { contractAddress } = req;
  if (!contractAddress) {
    return throwError({ code: 400, message: "Invalid request", req });
  }
  const isLegacy = await isLegacyContract(contractAddress as Hex);
  const portal = isLegacy
    ? legacyPortalUsage(contractAddress)
    : await getUsageByDoc({ contractAddress });
  res.json({ portals: [portal] });
}

export default [validate(usageByDocValidation), usageByDoc];
