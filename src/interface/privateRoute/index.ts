import {Router} from 'express';
import fileUpload from "express-fileupload";
import { asyncHandler, asyncHandlerArray } from "../../infra/asyncHandler";
import { isWorkspace } from '../middleware';
import privateBatchUpload from './privateBatchUpload';
import gateway from './gateway';
import uploadPrivateCommentFn from "./comment";
import uploadPrivateImageFn from './privateImageUpload';
const router = Router();

router.post(
    "/batch", 
    asyncHandler(isWorkspace),
    fileUpload(),
    asyncHandlerArray(privateBatchUpload)
);

router.get(
    "/gateway", 
    asyncHandler(isWorkspace),
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