import { Router } from "express";
import limit from "./limit";
import upload from "./upload";
import users from "./users";

const router = Router();

router.use("/upload", upload);

router.use("/limit", limit);

router.use("/users", users);

export default router;
