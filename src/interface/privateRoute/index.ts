import {Router} from 'express';
import fileUpload from "express-fileupload";
import { asyncHandler, asyncHandlerArray } from "../../infra/asyncHandler";
import { isWorkspace, canPrivateUpload } from '../middleware';
import privateBatchUpload from './privateBatchUpload';
import gateway from './gateway';
import privateUpload from './privateUpload';
import uploadPrivateImageFn from './privateImageUpload';
const router = Router();

router.post(
    "/batch",
    asyncHandler(canPrivateUpload),
    fileUpload(),
    asyncHandlerArray(privateBatchUpload)
);

// Single-file counterpart of /batch — workspace folder metadata uploads.
router.post(
    "/upload",
    asyncHandler(canPrivateUpload),
    fileUpload(),
    asyncHandlerArray(privateUpload)
);

// Open read route: anonymous public-link viewers fetch private bytes here.
// The app-level UCAN verify is soft (stamps isAuthenticated, never rejects),
// so no membership middleware. No IP-based throttling — user IPs are never
// used for backend logic (policy); repeat reads are absorbed by the byte cache.
router.get(
    "/gateway",
    asyncHandlerArray(gateway)
);

// Comment uploads live on the lane-aware public route (`POST /upload/comment`),
// which picks private storage per target portal — no separate private comment route.

router.post(
    "/image-private",
    asyncHandler(isWorkspace),
    fileUpload(),
    asyncHandlerArray(uploadPrivateImageFn)
);

export default router;