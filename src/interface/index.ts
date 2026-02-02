import { Router } from "express";
import limit from "./limit";
import floppy from "./floppy";
import upload from "./upload";
import users from "./users";
import community from "./community";
import file from "./file";
import semaphore from "./semaphore";
import apiAccess from "./api-access";

const router = Router();

router.use("/upload", upload);

router.use("/limit", limit);

router.use("/floppy", floppy);

router.use("/users", users);

router.use("/community", community);

router.use("/file", file);

router.use("/semaphore", semaphore);

router.use("/api-access/keys", apiAccess);

export default router;
