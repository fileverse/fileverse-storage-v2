import { Router } from "express";
import { asyncHandler, asyncHandlerArray } from "../../infra/asyncHandler";
import check from "./check";
import use from "./use";
import extend from "./extend";

const router = Router();

// middlewares
import {
  canCheckLimit,
  canCheckLimitUse,
  canUpdateLimit,
  // isAuthenticated,
} from "../middleware";

router.get("/check", asyncHandler(canCheckLimit), asyncHandlerArray(check));
router.get("/use", asyncHandler(canCheckLimitUse), asyncHandlerArray(use));

router.put("/extend", asyncHandler(canUpdateLimit), asyncHandlerArray(extend));

export default router;
