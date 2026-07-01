import { Response } from "express";
import { CustomRequest } from "../../../types";
import { throwError } from "../../../infra/errorHandler";
import { getPrivateFile } from "../../../domain/ipfs";
import { Readable } from "stream";
import { pipeline } from "stream/promises";

const gateway = async (
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

export default [gateway];