import { Router } from "express";
import { asyncHandlerArray } from "../../infra/asyncHandler";
import { internalAuth } from "../middleware";
import portalPro from "./portalPro";
import portalStorage from "./portalStorage";

const router = Router();

router.use(internalAuth);

router.put("/portals/:contractAddress/pro", asyncHandlerArray(portalPro));
router.get(
  "/portals/:contractAddress/storage",
  asyncHandlerArray(portalStorage)
);

export default router;
