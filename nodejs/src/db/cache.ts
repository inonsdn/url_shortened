import { Redis } from "ioredis";

const TTL_SECS = 60 * 60 * 24

export function createCache(redis: Redis) {
    return {
        async get(code: string): Promise<string|null> {
            try {
                return await redis.get(`link:${code}`)
            } catch (err) {
                return null
            }
        },
        async set(code: string, url: string): Promise<void> {
            try {
                await redis.set(`link:${code}`, url, "EX", TTL_SECS)
            } catch (err) {}
        }
    }
}