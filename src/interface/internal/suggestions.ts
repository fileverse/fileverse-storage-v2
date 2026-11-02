import { Request, Response } from "express";
import { claimSuggestion, releaseSuggestion } from "../../domain/suggestion";
import { validate, Joi } from "../middleware";

const cid = Joi.string().pattern(
  /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{50,100})$/
);

const claimValidation = {
  body: Joi.object({
    cid: cid.required(),
    portal: Joi.string()
      .pattern(/^0x[a-fA-F0-9]{40}$/)
      .required(),
    linkId: Joi.string()
      .pattern(/^0x[1-9A-HJ-NP-Za-km-z]{18}$/)
      .required(),
  }),
};

const releaseValidation = {
  body: Joi.object({ cid: cid.required() }),
};

const CLAIM_FAILURES = {
  locked: [403, "PORTAL_LOCKED"],
  not_found: [404, "UPLOAD_NOT_FOUND"],
  claimed_elsewhere: [409, "ALREADY_CLAIMED"],
} as const;

async function postClaim(req: Request, res: Response) {
  const result = await claimSuggestion({
    cid: String(req.body.cid),
    portal: String(req.body.portal),
    linkId: String(req.body.linkId),
  });
  if (result.ok) {
    res.json({ size: result.size });
    return;
  }
  const [status, code] = CLAIM_FAILURES[result.reason];
  res.status(status).json({ code });
}

async function postRelease(req: Request, res: Response) {
  await releaseSuggestion(String(req.body.cid));
  res.json({});
}

export const claim = [validate(claimValidation), postClaim];
export const release = [validate(releaseValidation), postRelease];
