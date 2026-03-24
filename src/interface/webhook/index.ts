import { Router } from "express";
import { webhookAuth } from "../middleware";
import { asyncHandler } from "../../infra/asyncHandler";
import { handleFileDeleted } from "./handleFileDeleted";

const router = Router();

router.use(webhookAuth);
router.post("/file-deleted", asyncHandler(handleFileDeleted));

export default router;
