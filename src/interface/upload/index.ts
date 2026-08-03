import fileUpload from "express-fileupload";
import express from "express";

const router = express.Router();

import { asyncHandler, asyncHandlerArray } from "../../infra/asyncHandler";

import upload from "./upload";
// import uploadPublic from "./public";
import uploadComment from "./comment";
import uploadImage from "./image";
import uploadPublic from "./publicUpload";

// middlewares
import { canUpload } from "../middleware";
import batchUpload from "./batchUpload";

router.post(
  "/",
  asyncHandler(canUpload),
  fileUpload(),
  asyncHandlerArray(upload)
);

// Comments are small JSON; the cap bounds unauthenticated byte-pumping into
// private storage (no IP-based throttling — policy).
router.post(
  "/comment",
  fileUpload({ limits: { fileSize: 256 * 1024 }, abortOnLimit: true }),
  asyncHandlerArray(uploadComment)
);

router.post("/public", fileUpload(), asyncHandlerArray(uploadPublic));

// Lane-aware image uploads (all ddocs images route through here; the target
// portal decides the lane). Bytes are client-side encrypted; cap bounds
// unauthenticated byte-pumping (no IP-based throttling — policy).
router.post(
  "/image",
  fileUpload({ limits: { fileSize: 10 * 1024 * 1024 }, abortOnLimit: true }),
  asyncHandlerArray(uploadImage)
);

router.post(
  "/batch",
  asyncHandler(canUpload),
  fileUpload(),
  asyncHandlerArray(batchUpload)
);

export default router;
