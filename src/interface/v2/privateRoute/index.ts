import {Router} from 'express';
import fileUpload from "express-fileupload";
import { asyncHandler, asyncHandlerArray } from "../../../infra/asyncHandler";
import { verifyV2 } from "../../../infra/ucanV2";
import privateBatchUpload from './privateBatchUpload';
import { canUpload } from '../../middleware';
import access from './access';

const router = Router();

router.post(
    "/batch", 
    asyncHandler(verifyV2), 
    asyncHandler(canUpload),
    fileUpload(),
    asyncHandlerArray(privateBatchUpload)
);

router.get(
    "/access", 
    asyncHandlerArray(access)
);


export default router;