import express from "express";
import { asyncHandlerArray } from "../../infra/asyncHandler";
import getGroupMembersHandler from "./getGroupMembers";

const router = express.Router();

router.get("/group/:groupId", asyncHandlerArray(getGroupMembersHandler));

export default router;
