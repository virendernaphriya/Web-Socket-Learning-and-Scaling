import {Redis} from 'ioredis';

export const redisPub= new Redis({
    host:"localhost",
    port:6379
})
export const redisSub= new Redis({
    host:"localhost",
    port:6379
})