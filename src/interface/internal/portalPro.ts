import { Request, Response } from "express";
import { setPortalPro } from "../../domain/limit";
import { validate, Joi } from "../middleware";

const portalProValidation = {
  params: Joi.object({
    contractAddress: Joi.string()
      .pattern(/^0x[a-fA-F0-9]{40}$/)
      .required(),
  }),
  body: Joi.object({ pro: Joi.boolean().required() }),
};

async function putPortalPro(req: Request, res: Response) {
  const contractAddress = String(req.params.contractAddress).toLowerCase();
  const pro = req.body.pro === true;
  await setPortalPro(contractAddress, pro);
  res.json({ contractAddress, pro });
}

export default [validate(portalProValidation), putPortalPro];
