import { Response } from "express";
import { CustomRequest } from "../../types";
import { throwError } from "../../infra/errorHandler";
import { getPrivateFile } from "../../domain/ipfs";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { validate, Joi } from "../middleware";

const gatewayValidation = {
  headers: Joi.object({
    contract: Joi.string().required(),
    invoker: Joi.string().required(),
  }).unknown(true),
};

const gateway = async (
  req: CustomRequest,
  res: Response
) => {
  const { contractAddress, invokerAddress } = req;

   if (!contractAddress || !invokerAddress ) {
    return throwError({
      code: 400,
      message: "Invalid request",
      req,
    });
  }

  const cid = req.query.cid as string;

  if (!cid) {
    return throwError({
      code: 400,
      message: "cid is required",
      req,
    });
  }
  const { data, contentType } = await getPrivateFile(cid);

  if (contentType) {
    res.setHeader("Content-Type", contentType);
  }  

  if (data == null) {
    return throwError({
      code: 404,
      message: "File not found",
      req,
    });
  }

  if (typeof data === "string") {
    return res.send(data);
  }

  if (data instanceof Blob) {
    const stream = Readable.fromWeb(data.stream() as any);
    await pipeline(stream, res);
    return;
  }
  return res.json(data);
};

export default [validate(gatewayValidation), gateway];