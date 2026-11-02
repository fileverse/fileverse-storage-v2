import { Router } from "express";
import { asyncHandlerArray } from "../../infra/asyncHandler";
import { internalAuth } from "../middleware";
import portalPlan from "./portalPlan";
import portalStorage from "./portalStorage";
import { claim, release } from "./suggestions";

const router = Router();

router.use(internalAuth);

router.put("/portals/:contractAddress/plan", asyncHandlerArray(portalPlan));
router.get(
  "/portals/:contractAddress/storage",
  asyncHandlerArray(portalStorage)
);
router.post("/suggestions/claim", asyncHandlerArray(claim));
router.post("/suggestions/release", asyncHandlerArray(release));

export default router;
