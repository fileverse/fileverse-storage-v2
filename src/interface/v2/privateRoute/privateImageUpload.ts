import { Response } from "express";
import { isArray } from "util";
import { uploadPrivateImage } from "../../../domain/uploadImage";
import { throwError } from "../../../infra/errorHandler";
import { CustomRequest } from "../../../types";
import { validate, Joi } from "../../middleware";
import { hashFilename } from "../../../utils";

const uploadValidation = {
  headers: Joi.object({
    origin: Joi.string().required(),
    invoker: Joi.string().optional(),
    contract: Joi.string().optional(),
  }).unknown(true),
};

async function uploadPrivateImageFn(req: CustomRequest, res: Response) {
  const file = isArray(req.files?.file)
    ? req.files.file[0]
    : req.files?.file;

  if (!file) {
    return throwError({
      code: 400,
      message: "No file uploaded",
      req,
    });
  }

  if (!file.mimetype.startsWith("image/")) {
    return throwError({
      code: 400,
      message: "File must be an image",
      req,
    });
  }

  const uploadedFile = await uploadPrivateImage({
    file: {
      name: hashFilename(file.name),
      mimetype: file.mimetype,
      data: file.data,
    },
    origin: req.headers.origin as string
  });

  res.json(uploadedFile);
}

export default [validate(uploadValidation), uploadPrivateImageFn];