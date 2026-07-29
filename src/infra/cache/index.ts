import NodeCache from "node-cache";
import { redis } from "../redis";

export const cache = new NodeCache();

export const getCache = async(
    key: string
)=>{
    if(redis){
        return await redis.get(key)
    }
    return cache.get<string>(key);
}

export const setCache = async(
    key: string,
    value: string,
    ttl: number
)=>{
    if(redis){
        await redis.set(
            key,
            value,
            "EX",
            ttl
        );
        return;
    }
    cache.set(
        key,
        value,
        ttl
    );
    return;
}
