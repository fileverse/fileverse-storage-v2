import { Joi, validate } from "../middleware";
import { CustomRequest } from "../../types";
import { deleteAll } from "../../domain/file";
import { throwError } from "../../infra/errorHandler";
import { Response } from "express";

const deleteValidation = {
  headers: Joi.object({
    contract: Joi.string().required(),
  }).unknown(true),
  params: Joi.object({
    appFileId: Joi.string().required(),
  }),
};

const deleteFn = async (req: CustomRequest, res: Response) => {
  const { contractAddress } = req;
  const { appFileId } = req.params;

  if (!contractAddress || !appFileId) {
    return throwError({
      code: 400,
      message: "Invalid request",
      req,
    });
  }

  const updatedFiles = await deleteAll({
    appFileId,
    contractAddress,
  });

  if (updatedFiles.modifiedCount === 0) {
    return throwError({
      code: 404,
      message: "File not found",
      req,
    });
  }

  res.status(200).json({
    message: "File deleted successfully",
  });
};

export default [validate(deleteValidation), deleteFn];
