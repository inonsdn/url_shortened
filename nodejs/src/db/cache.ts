import { Redis } from "ioredis";

const TTL_SECS = 60 * 60 * 24

export function createCache(redis: Redis) {
    return {
        async get(code: string): Promise<string|null> {
            const url = await redis.get(`link:${code}`)
            if (url === null) {
                return null
            }
            return url
        },
        async set(code: string, url: string): Promise<void> {
            await redis.set(`link:${code}`, url, "EX", TTL_SECS)
        }
    }
}