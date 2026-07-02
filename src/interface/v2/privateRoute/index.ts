import {Router} from 'express';
import fileUpload from "express-fileupload";
import { asyncHandler, asyncHandlerArray } from "../../../infra/asyncHandler";
import { verifyV2 } from "../../../infra/ucanV2";
import privateBatchUpload from './privateBatchUpload';
import { canPrivateUpload } from '../../middleware';
import gateway from './gateway';
import uploadPrivateCommentFn from "./comment";
import uploadPrivateImageFn from './privateImageUpload';
const router = Router();

router.post(
    "/batch", 
    asyncHandler(verifyV2), 
    asyncHandler(canPrivateUpload),
    fileUpload(),
    asyncHandlerArray(privateBatchUpload)
);

router.get(
    "/gateway", 
    asyncHandlerArray(gateway)
);

router.post(
    "/comment-private",
    fileUpload(),
    asyncHandlerArray(uploadPrivateCommentFn)
);

router.post(
    "/image-private",
    fileUpload(),
    asyncHandlerArray(uploadPrivateImageFn)
);

export default router;