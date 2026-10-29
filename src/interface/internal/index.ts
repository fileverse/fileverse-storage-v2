import { Router } from "express";
import { asyncHandlerArray } from "../../infra/asyncHandler";
import { internalAuth } from "../middleware";
import portalPlan from "./portalPlan";
import portalStorage from "./portalStorage";

const router = Router();

router.use(internalAuth);

router.put("/portals/:contractAddress/plan", asyncHandlerArray(portalPlan));
router.get(
  "/portals/:contractAddress/storage",
  asyncHandlerArray(portalStorage)
);

export default router;
