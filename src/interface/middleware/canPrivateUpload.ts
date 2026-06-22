import { NextFunction, Response } from "express";
import { CustomRequest } from "../../types";
import { throwError } from "../../infra/errorHandler";
import { getCache, setCache } from "../../infra/cache";
import { checkIsWorkspace } from "../../domain/workspace";
import { config } from "../../config"

export const canPrivateUpload = async(
    req: CustomRequest,
    res: Response,
    next: NextFunction
)=>{
    const contractAddress = req.contractAddress;
    if(!contractAddress){
        return throwError({
            code: 401,
            message: "contract address not found",
            req
        });
    }
    const cacheKey = `workspace:${contractAddress.toLowerCase()}`;
    const cached = await getCache(cacheKey);
    let isWorkspace: boolean;

    if(cached != null){
        isWorkspace=cached==="true";
    }
    else{
        isWorkspace = await checkIsWorkspace(contractAddress);
        await setCache(
            cacheKey,
            String(isWorkspace),
            Number(config.WORKSPACE_STATUS_TTL)
        );
    }

    if(!isWorkspace){
        throwError({
            code:403,
            message:`contract ${contractAddress} is not a workspace`,
            req,
        });
    }
    next();
}