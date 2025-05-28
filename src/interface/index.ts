import { Router } from "express";
import limit from "./limit";
import upload from "./upload";

const router = Router();

router.use("/upload", upload);

router.use("/limit", limit);

export default router;
