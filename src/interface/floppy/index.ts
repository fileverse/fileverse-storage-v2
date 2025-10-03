import { Router } from "express";
import { asyncHandler, asyncHandlerArray } from "../../infra/asyncHandler";
import claim from "./claim";
import redeem from "./redeem";
import list from "./list";

// middlewares
import {
  isAuthenticated,
} from "../middleware";


const router = Router();

router.post("/claim", asyncHandlerArray(claim));
router.post("/redeem", asyncHandler(isAuthenticated), asyncHandlerArray(redeem));
router.get("/list", asyncHandler(isAuthenticated), asyncHandlerArray(list));

export default router;
