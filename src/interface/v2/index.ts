import { Router } from "express";
import limit from "./limit";
import privateRouter from "./privateRoute";

const router = Router();

router.use("/limit", limit);

router.use("/private",privateRouter);

export default router;
