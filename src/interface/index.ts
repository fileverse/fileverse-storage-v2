import { Router } from "express";
import limit from "./limit";
import upload from "./upload";
import users from "./users";
import community from "./community";

const router = Router();

router.use("/upload", upload);

router.use("/limit", limit);

router.use("/users", users);

router.use("/community", community);

export default router;
