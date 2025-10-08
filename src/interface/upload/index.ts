import fileUpload from "express-fileupload";
import express from "express";

const router = express.Router();

import { asyncHandler, asyncHandlerArray } from "../../infra/asyncHandler";

import upload from "./upload";
// import uploadPublic from "./public";
import uploadComment from "./comment";
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

router.post("/comment", fileUpload(), asyncHandlerArray(uploadComment));

router.post("/public", fileUpload(), asyncHandlerArray(uploadPublic));

router.post(
  "/batch",
  asyncHandler(canUpload),
  fileUpload(),
  asyncHandlerArray(batchUpload)
);

export default router;
