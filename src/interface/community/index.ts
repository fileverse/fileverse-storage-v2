import { Router } from "express";
import { asyncHandlerArray } from "../../infra/asyncHandler";
import publish from "./publish";
import list from "./list";
import favourite from "./favourite";
import get from "./get";

const router = Router();

router.post("/publish", asyncHandlerArray(publish));
router.get("/list", asyncHandlerArray(list));
router.post("/favourite", asyncHandlerArray(favourite));
router.get("/get/:dsheetId", asyncHandlerArray(get));

export default router;
