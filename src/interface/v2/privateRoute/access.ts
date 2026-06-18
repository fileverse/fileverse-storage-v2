import { Response } from "express";
import { CustomRequest } from "../../../types";
import { createPrivateAccessLink } from "../../../domain/ipfs";
import { throwError } from "../../../infra/errorHandler";
import { redis } from "../../../infra/redis";
import { config } from "../../../config";

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

  const cacheKey = `private-access:${cid}`;
  const cached = await redis.get(cacheKey);

  if(cached){
    return res.json({
      url: cached,
      cached: true
    });
  }

  const url = await createPrivateAccessLink(cid);

  await redis.set(
    cacheKey,
    url,
    "EX",
    Number(config.ACCESS_LINK_EXPIRES_IN_SECOND)
  );

  res.json({
    url,
    cached: false
  });
};

export default [access];