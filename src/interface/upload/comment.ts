import { upload } from "../../domain";
import { uploadPrivate } from "../../domain/upload";
import { resolveIsWorkspaceCached } from "../../domain/workspace";
import { validate, Joi } from "../middleware";
import { throwError } from "../../infra/errorHandler";
import { CustomRequest, FileIPFSType } from "../../types";
import { isArray } from "util";
import { Response } from "express";

const uploadValidation = {
  headers: Joi.object({
    invoker: Joi.string().optional(),
    contract: Joi.string().optional(),
  }).unknown(true),
};
const commentSchema = Joi.object({
  encryptedData: Joi.string().allow("").required(),
  id: Joi.string().required(),
  username: Joi.string().required(),
  timestamp: Joi.date().timestamp("javascript").optional(), // milliseconds (13 digits)
});

// Lane-aware comment upload: the client sends the doc's portal address in the
// `contract` header; comments targeting a team-workspace portal go to private
// storage, everything else stays public. The route is deliberately unauthenticated
// in this version — the lane is decided by the TARGET portal, not the writer.
// See docs/superpowers/specs/2026-07-31-workspace-private-comments-design.md (ddocs.new).
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

  const contractAddress = req.headers.contract as string;

  // Missing header ⇒ public (status quo for stale clients). Lookup failure ⇒ 503:
  // picking a lane by guesswork could silently downgrade a workspace comment.
  let isWorkspacePortal = false;
  if (contractAddress) {
    try {
      isWorkspacePortal = await resolveIsWorkspaceCached(contractAddress);
    } catch {
      return throwError({
        code: 503,
        message: `workspace status lookup failed for contract: ${contractAddress}`,
        req,
      });
    }
  }

  const uploadFn = isWorkspacePortal ? uploadPrivate : upload;
  const createdFile = await uploadFn({
    // @ts-ignore
    file: req.files?.file,
    ipfsType: FileIPFSType.COMMENT,
    contractAddress,
  }).catch((err) => {
    console.error("comment upload failed: ", err?.message || err);
    return null;
  });

  if (!createdFile?.ipfsHash) {
    return throwError({
      code: 502,
      message: "comment upload failed",
      req,
    });
  }

  res.json({
    ...createdFile,
    storageLane: isWorkspacePortal ? "private" : "public",
  });
}

export default [validate(uploadValidation), uploadCommentFn];
