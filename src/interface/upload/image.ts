import { Response } from "express";
import { isArray } from "util";
import { uploadImage, uploadPrivateImage } from "../../domain/uploadImage";
import { resolveWorkspaceStatus } from "../../domain/workspace";
import { throwForWorkspaceLookupError } from "../workspaceStatusErrors";
import { throwError } from "../../infra/errorHandler";
import { CustomRequest } from "../../types";
import { validate, Joi } from "../middleware";
import { hashFilename } from "../../utils";

const uploadValidation = {
  headers: Joi.object({
    origin: Joi.string().optional(),
    invoker: Joi.string().optional(),
    contract: Joi.string().optional(),
  }).unknown(true),
};

// Lane-aware image upload: the client sends the doc's portal address in the
// `contract` header; images on team-workspace portals go to private storage,
// everything else stays public. Deliberately unauthenticated (same posture as
// /upload/comment) — image uploaders include non-member editors, so the lane
// is decided by the TARGET portal, not the writer. The payload is penumbra
// ciphertext (typeless blob), so no server-side mimetype validation is
// possible — the image/* gate runs client-side before encryption.
async function uploadImageFn(req: CustomRequest, res: Response) {
  const file = isArray(req.files?.file) ? req.files.file[0] : req.files?.file;

  if (!file) {
    return throwError({
      code: 400,
      message: "No file uploaded",
      req,
    });
  }

  const contractAddress = req.headers.contract as string;

  // Missing header ⇒ public (status quo for stale clients). Lookup failure ⇒ 503
  // (see throwForWorkspaceLookupError): guessing a lane could silently downgrade
  // a workspace image.
  let isWorkspacePortal = false;
  if (contractAddress) {
    try {
      isWorkspacePortal = await resolveWorkspaceStatus(contractAddress);
    } catch (err) {
      return throwForWorkspaceLookupError(err, req, res, contractAddress);
    }
  }

  const uploadFn = isWorkspacePortal ? uploadPrivateImage : uploadImage;
  const uploadedFile = await uploadFn({
    file: {
      name: hashFilename(file.name),
      mimetype: file.mimetype,
      data: file.data,
    },
    origin: (req.headers.origin as string) || "unknown",
  }).catch((err) => {
    console.error("image upload failed: ", err?.message || err);
    return null;
  });

  if (!uploadedFile?.hash) {
    return throwError({
      code: 502,
      message: "image upload failed",
      req,
    });
  }

  res.json({
    ...uploadedFile,
    storageLane: isWorkspacePortal ? "private" : "public",
  });
}

export default [validate(uploadValidation), uploadImageFn];
