import { Router } from "express";
import { asyncHandler, asyncHandlerArray } from "../../infra/asyncHandler";
import claim from "./claim";
import redeem from "./redeem";
import list from "./list";
import group from "./group";
import get from "./get";
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
router.get("/get/:shortCode", asyncHandlerArray(get));

export default router;
