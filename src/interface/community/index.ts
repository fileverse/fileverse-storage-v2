import { Router } from "express";
import { asyncHandlerArray } from "../../infra/asyncHandler";
import publish from "./publish";
import list from "./list";
import favourite from "./favourite";

const router = Router();

router.post("/publish", asyncHandlerArray(publish));
router.get("/list", asyncHandlerArray(list));
router.post("/favourite", asyncHandlerArray(favourite));

export default router;
