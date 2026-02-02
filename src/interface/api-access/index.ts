import { Router } from "express";
import { asyncHandlerArray } from "../../infra/asyncHandler";
import save from "./save";
import get from "./get";
import remove from "./remove";

const router = Router();

router.post("/", asyncHandlerArray(save));
router.get("/:hashedApiKey", asyncHandlerArray(get));
router.delete("/:hashedApiKey", asyncHandlerArray(remove));

export default router;
