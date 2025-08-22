import { Router } from "express";
import { asyncHandler, asyncHandlerArray } from "../../infra/asyncHandler";
import publish from "./publish";
import list from "./list";
import favourite from "./favourite";
import get from "./get";
import { canCommunityPublish } from "../middleware/canCommunityPublish";

const router = Router();

router.post(
  "/publish",
  asyncHandler(canCommunityPublish),
  asyncHandlerArray(publish)
);
router.get("/list", asyncHandlerArray(list));
router.post("/favourite", asyncHandlerArray(favourite));
router.get("/get/:dsheetId", asyncHandlerArray(get));

export default router;
