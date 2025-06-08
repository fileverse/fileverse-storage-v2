import express from "express";
import address from "./address";

const router = express.Router();

router.get("/address", address);

export default router;
