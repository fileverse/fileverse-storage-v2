import { Response } from "express";
import { isArray } from "util";
import { uploadSuggestion } from "../../domain/suggestion";
import { throwError } from "../../infra/errorHandler";
import { CustomRequest } from "../../types";

// Open like /upload/image: visitors are logged out and must not learn the portal. Bytes are
// ciphertext; the coordinator's claim ties a row to a folder and unclaimed rows are swept.
async function uploadSuggestionFn(req: CustomRequest, res: Response) {
  const file = isArray(req.files?.file) ? req.files?.file[0] : req.files?.file;
  if (!file?.data?.length) {
    res.status(400).json({ code: "NO_FILE" });
    return;
  }

  const uploaded = await uploadSuggestion(file.data).catch((err) => {
    console.error("suggestion upload failed: ", err?.message || err);
    return null;
  });
  if (!uploaded) {
    return throwError({ code: 502, message: "suggestion upload failed", req });
  }
  res.json(uploaded);
}

export default [uploadSuggestionFn];
