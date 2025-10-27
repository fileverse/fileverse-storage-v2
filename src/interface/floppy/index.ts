import { Router } from "express";
import { asyncHandler, asyncHandlerArray } from "../../infra/asyncHandler";
import claim from "./claim";
import redeem from "./redeem";
import list from "./list";
import group from "./group";
import claimOnchain from "./claim-onchain";
import grant from "./grant";
// middlewares
import { isAuthenticated } from "../middleware";

const router = Router();

router.post("/claim", asyncHandler(isAuthenticated), asyncHandlerArray(claim));
router.post(
  "/redeem",
  asyncHandler(isAuthenticated),
  asyncHandlerArray(redeem)
);
router.get("/list", asyncHandler(isAuthenticated), asyncHandlerArray(list));
router.post("/group", asyncHandler(isAuthenticated), asyncHandlerArray(group));
router.post(
  "/claim-onchain",
  asyncHandler(isAuthenticated),
  asyncHandlerArray(claimOnchain)
);

router.post("/grant", asyncHandlerArray(grant));

export default router;
