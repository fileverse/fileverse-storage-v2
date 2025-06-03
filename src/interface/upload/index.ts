import fileUpload from "express-fileupload";
import express from "express";

const router = express.Router();

import { asyncHandler, asyncHandlerArray } from "../../infra/asyncHandler";

import upload from "./upload";
// import uploadPublic from "./public";
import uploadComment from "./comment";

// middlewares
import { canUpload } from "../middleware";

router.post(
  "/",
  asyncHandler(canUpload),
  fileUpload(),
  asyncHandlerArray(upload)
);

router.post("/comment", fileUpload(), asyncHandlerArray(uploadComment));

export default router;
