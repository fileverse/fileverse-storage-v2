import { Router } from "express";
import limit from "./limit";
import floppy from "./floppy";
import upload from "./upload";
import users from "./users";
import community from "./community";
import file from "./file";

const router = Router();

router.use("/upload", upload);

router.use("/limit", limit);

router.use("/floppy", floppy);

router.use("/users", users);

router.use("/community", community);

router.use("/file", file);

export default router;
