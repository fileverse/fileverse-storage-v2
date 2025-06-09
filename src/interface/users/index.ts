import express from "express";
import address from "./address";

const router = express.Router();

router.post("/address", address);

export default router;
