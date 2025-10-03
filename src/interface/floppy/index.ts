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

router.put("/claim", asyncHandlerArray(claim));
router.put("/redeem", asyncHandler(isAuthenticated), asyncHandlerArray(redeem));
router.put("/list", asyncHandler(isAuthenticated), asyncHandlerArray(list));

export default router;
