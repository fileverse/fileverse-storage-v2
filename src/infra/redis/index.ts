import Redis from "ioredis";
import {config} from "../../config";
import { logger } from "../logger";

export const redis = config.REDIS_URL ? new Redis(config.REDIS_URL) : null;

if(redis){
    redis.on("connect",()=>{
        console.log("redis connected");
        logger.info("redis connected");
    });

    redis.on("error",(err)=>{
        console.log(`redis error:  ${err}`);
        logger.error(`redis error: ${err}`);
    });
}