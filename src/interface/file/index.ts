import express from "express";
import { asyncHandler, asyncHandlerArray } from "../../infra/asyncHandler";
import deleteFile from "./delete";

import { canDelete } from "../middleware";

const router = express.Router();

router.delete(
  "/:appFileId",
  asyncHandler(canDelete),
  asyncHandlerArray(deleteFile)
);

export default router;
