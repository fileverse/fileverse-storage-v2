import express from "express";
import address from "./address";
import { asyncHandlerArray } from "../../infra/asyncHandler";

const router = express.Router();

router.post("/address", asyncHandlerArray(address));

export default router;
