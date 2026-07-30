import { Router } from "express";
import limit from "./limit";

const router = Router();

router.use("/limit", limit);

export default router;
