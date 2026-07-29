import { Response } from "express";
import { CustomRequest } from "../../types";
import { throwError } from "../../infra/errorHandler";
import { validate, Joi } from "../middleware";
import { getPrivateFile } from "../../domain/ipfs";
import {
  getCachedPrivateGatewayResponse,
  setCachedPrivateGatewayResponse,
  type PrivateGatewayResponse,
} from "./gatewayCache";

const gatewayValidation = {
  headers: Joi.object({
    contract: Joi.string().required(),
    invoker: Joi.string().required(),
  }).unknown(true),
};

const sendGatewayResponse = async (
  res: Response,
  response: PrivateGatewayResponse
) => {
  if (response.contentType) {
    res.setHeader("Content-Type", response.contentType);
  }

  if (response.data == null) {
    return;
  }

  if (typeof response.data === "string") {
    return res.send(response.data);
  }

  if (response.data instanceof Blob) {
    const buffer = Buffer.from(await response.data.arrayBuffer());
    res.end(buffer);
    return;
  }

  return res.json(response.data);
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

  const cachedResponse = await getCachedPrivateGatewayResponse(cid);

  if (cachedResponse) {
    return sendGatewayResponse(res, cachedResponse);
  }

  const response = await getPrivateFile(cid);

  if (response.data == null) {
    return throwError({
      code: 404,
      message: "File not found",
      req,
    });
  }

  void  setCachedPrivateGatewayResponse(cid, response);

  return sendGatewayResponse(res, response);
};

export default [validate(gatewayValidation), gateway];