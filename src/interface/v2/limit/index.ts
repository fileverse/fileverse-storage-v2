import { Router } from "express";
import { asyncHandler, asyncHandlerArray } from "../../../infra/asyncHandler";
import { canCheckLimitUse } from "../../middleware";
import { verifyV2 } from "../../../infra/ucanV2";
import use from "./use";

const router = Router();

router.get("/use", asyncHandler(verifyV2), asyncHandler(canCheckLimitUse), asyncHandlerArray(use));

export default router;
