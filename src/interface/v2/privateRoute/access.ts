import { Response } from "express";
import { CustomRequest } from "../../../types";
import { createPrivateAccessLink } from "../../../domain/ipfs";
import { throwError } from "../../../infra/errorHandler";
import { getCache, setCache } from "../../../infra/cache";
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
  const cached = await getCache(cacheKey);

  if(cached){
    return res.json({
      url: cached,
      cached: true
    });
  }

  const url = await createPrivateAccessLink(cid);

  await setCache(
    cacheKey,
    url,
    Number(config.ACCESS_LINK_EXPIRES_IN_SECOND)
  );

  res.json({
    url,
    cached: false
  });
};

export default [access];