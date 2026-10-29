import { Request, Response } from "express";
import { setPortalPlan } from "../../domain/limit";
import { validate, Joi } from "../middleware";

const portalPlanValidation = {
  params: Joi.object({
    contractAddress: Joi.string()
      .pattern(/^0x[a-fA-F0-9]{40}$/)
      .required(),
  }),
  body: Joi.object({
    pro: Joi.boolean().required(),
    locked: Joi.boolean().required(),
  }),
};

async function putPortalPlan(req: Request, res: Response) {
  const contractAddress = String(req.params.contractAddress).toLowerCase();
  const pro = req.body.pro === true;
  const locked = req.body.locked === true;
  await setPortalPlan(contractAddress, { pro, locked });
  res.json({ contractAddress, pro, locked });
}

export default [validate(portalPlanValidation), putPortalPlan];
