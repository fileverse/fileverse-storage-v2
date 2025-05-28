import { upload } from "../../domain";
import { validate, Joi } from "../middleware";
import { throwError } from "../../infra/errorHandler";
import { CustomRequest } from "../../types";
import { isArray } from "util";
import { Response } from "express";

const uploadValidation = {
  headers: Joi.object({
    invoker: Joi.string().optional(),
  }).unknown(true),
};
const commentSchema = Joi.object({
  encryptedData: Joi.string().allow("").required(),
  id: Joi.string().required(),
  username: Joi.string().required(),
  timestamp: Joi.date().timestamp("javascript").optional(), // milliseconds (13 digits)
});

async function uploadCommentFn(req: CustomRequest, res: Response) {
  const file = isArray(req.files?.file) ? req.files?.file[0] : req.files?.file;

  if (file?.mimetype !== "application/json") {
    return throwError({
      code: 400,
      message: `File must be a JSON file`,
      req,
    });
  }

  const jsonData = JSON.parse(file.data.toString());
  const { error } = commentSchema.validate(jsonData);

  if (error) {
    return throwError({
      code: 400,
      message: error.details[0].message,
      req,
    });
  }

  const createdFile = await upload({
    // @ts-ignore
    file: req.files?.file,
  }).catch(console.log);
  res.json(createdFile);
}

module.exports = [validate(uploadValidation), uploadCommentFn];
