import { Router } from "express";
import { asyncHandler, asyncHandlerArray } from "../../../infra/asyncHandler";
import { canCheckLimitUse } from "../../middleware";
import use from "./use";

const router = Router();

router.get("/use", asyncHandler(canCheckLimitUse), asyncHandlerArray(use));

export default router;
