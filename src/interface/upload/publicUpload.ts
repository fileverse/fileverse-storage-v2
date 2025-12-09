import { Response } from "express";
import { isArray } from "util";
import { upload as uploadToPinata } from "../../domain/ipfs";
import { CustomRequest } from "../../types";
import { throwError } from "../../infra/errorHandler";
import { Readable } from "stream";

const uploadPublicFn = async (req: CustomRequest, res: Response) => {
  try {
    const file = isArray(req.files?.file) ? req.files?.file[0] : req.files?.file;
    if (!file) {
      return throwError({
        code: 400,
        message: "Invalid request",
        req,
      });
    }

    const { name, data } = file;

    // Create a readable stream from file data
    const stream = Readable.from(data);

    // Set path property using Object.assign since path is not a standard Readable property
    Object.assign(stream, { path: name });
    const ipfsFile = await uploadToPinata(stream, { name });

    res.json(ipfsFile);
  } catch (err) {
    throw err;
  }
};

export default [uploadPublicFn];
