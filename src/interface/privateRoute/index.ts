import {Router} from 'express';
import fileUpload from "express-fileupload";
import { asyncHandler, asyncHandlerArray } from "../../infra/asyncHandler";
import { isWorkspace, canPrivateUpload } from '../middleware';
import privateBatchUpload from './privateBatchUpload';
import gateway from './gateway';
import uploadPrivateCommentFn from "./comment";
import uploadPrivateImageFn from './privateImageUpload';
const router = Router();

router.post(
    "/batch",
    asyncHandler(canPrivateUpload),
    fileUpload(),
    asyncHandlerArray(privateBatchUpload)
);

// Open read route: anonymous public-link viewers fetch private bytes here.
// The app-level UCAN verify is soft (stamps isAuthenticated, never rejects),
// so no membership middleware. No IP-based throttling — user IPs are never
// used for backend logic (policy); repeat reads are absorbed by the byte cache.
router.get(
    "/gateway",
    asyncHandlerArray(gateway)
);

router.post(
    "/comment-private",
    asyncHandler(isWorkspace), //right now tis is checking isAuthenticated along with isWorkspace ... unlike the public comment route which doesnt care for auth
    fileUpload(),
    asyncHandlerArray(uploadPrivateCommentFn)
);

router.post(
    "/image-private",
    asyncHandler(isWorkspace),
    fileUpload(),
    asyncHandlerArray(uploadPrivateImageFn)
);

export default router;