import { Response } from "express";
import { CustomRequest } from "../../types";
import { throwError } from "../../infra/errorHandler";
import { validate, Joi } from "../middleware";
import { getPrivateFile } from "../../domain/ipfs";
import { findPrivate } from "../../domain/file";
import { findPrivateImage } from "../../domain/image";
import { config } from "../../config";
import {
  getCachedPrivateGatewayResponse,
  setCachedPrivateGatewayResponse,
  type PrivateGatewayResponse,
} from "./gatewayCache";

const gatewayValidation = {
  query: Joi.object({
    cid: Joi.string().required(),
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
  const cid = req.query.cid as string;

  const cachedResponse = await getCachedPrivateGatewayResponse(cid);

  if (cachedResponse) {
    return sendGatewayResponse(res, cachedResponse);
  }

  // Per-CID lane lookup: mixed-storage docs are guaranteed (old public gate
  // preserved next to new private content), so anything without a private
  // File row falls back to the public gateway.
  const privateFile = await findPrivate(cid);
  // Images ride the Image collection (no File row) — check it before falling
  // back public, or every private-image read 302s to a gateway without the CID.
  const privateImage = privateFile ? null : await findPrivateImage(cid);

  if (!privateFile && !privateImage) {
    return res.redirect(302, `${config.PINATA_GATEWAY}/${cid}`);
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