import { Response } from "express";
import { CustomRequest } from "../../../types";
import { createPrivateAccessLink } from "../../../domain/ipfs";
import { throwError } from "../../../infra/errorHandler";

const access = async (
  req: CustomRequest,
  res: Response
) => {
  const cid = req.query.cid as string;

  if (!cid) {
    return throwError({
      code: 400,
      message: "cid is required",
      req,
    });
  }

  const url = await createPrivateAccessLink(cid);

  res.json({
    url,
  });
};

export default [access];