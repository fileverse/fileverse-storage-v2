import { create } from "../../domain/communityFiles";
import { Response } from "express";
import { Joi, validate } from "../middleware";
import { CustomRequest } from "../../types";
import { ICreateCommunityFilesParams } from "../../types";
import { config } from "../../config";
import { getFileIdByAppFileId } from "../../domain/contract";
import { Hex, isAddressEqual } from "viem";
import DOMPurify from "dompurify";
import { JSDOM } from "jsdom";

const window = new JSDOM("").window;
const purify = DOMPurify(window);

const sanitizeString = (input: string): string => {
  if (!input || typeof input !== "string") return "";

  return purify
    .sanitize(input, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true,
    })
    .trim();
};

const sanitizeRequestBody = (body: any): ICreateCommunityFilesParams => {
  return {
    publishedBy: sanitizeString(body.publishedBy),
    thumbnailIPFSHash: sanitizeString(body.thumbnailIPFSHash),
    title: sanitizeString(body.title),
    category: sanitizeString(body.category),
    fileLink: sanitizeString(body.fileLink),
    dsheetId: sanitizeString(body.dsheetId),
    userHash: sanitizeString(body.userHash),
    portalAddress: sanitizeString(body.portalAddress),
  };
};

const publishValidation = {
  body: Joi.object({
    publishedBy: Joi.string().required(),
    thumbnailIPFSHash: Joi.string().required(),
    title: Joi.string().required(),
    category: Joi.string().required(),
    fileLink: Joi.string().required(),
    dsheetId: Joi.string().required(),
    userHash: Joi.string().required(),
    portalAddress: Joi.string().required(),
  }),
  headers: Joi.object({
    contract: Joi.string().required(),
    invoker: Joi.string().required(),
  }).unknown(true),
};

class InvalidOriginError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidOriginError";
  }
}

class InvalidFileLinkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidFileLinkError";
  }
}

const validateFileLink = async (
  fileLink: string,
  contractAddress: Hex,
  appFileId: string
) => {
  const parsedURL = new URL(fileLink);

  const allowedOrigins = config.ALLOWED_ORIGINS?.split(",");

  if (!allowedOrigins?.includes(parsedURL.origin))
    throw new InvalidOriginError("File link is not valid");

  const [_, appAddress, fileId] = parsedURL.pathname.split("/");

  if (
    !appAddress ||
    !fileId ||
    !isAddressEqual(appAddress as Hex, contractAddress)
  )
    throw new InvalidFileLinkError("File link is not valid");

  const onChainFileId = await getFileIdByAppFileId(appFileId, contractAddress);

  if (onChainFileId !== fileId)
    throw new InvalidFileLinkError("File link is not valid");
};

const publish = async (req: CustomRequest, res: Response) => {
  try {
    const contractAddress = req.contractAddress as Hex;

    if (!contractAddress) {
      return res.status(400).json({
        message: "File link is not valid",
      });
    }

    const sanitizedParams = sanitizeRequestBody(req.body);

    await validateFileLink(
      sanitizedParams.fileLink,
      contractAddress,
      sanitizedParams.dsheetId
    );

    const createdFile = await create(sanitizedParams);

    res.json(createdFile);
  } catch (error) {
    if (
      error instanceof InvalidOriginError ||
      error instanceof InvalidFileLinkError
    ) {
      return res.status(400).json({
        message: error.message,
      });
    }

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

export default [validate(publishValidation), publish];
