import Fastify from "fastify";
import pg from "pg";
import { Redis } from "ioredis";
import {randomCode, validateCode} from "./utils/base62.js"
import { createStore } from "./db/link-store.js";
import { createCache } from "./db/cache.js";

const app = Fastify({logger: true});

const db = new pg.Pool({connectionString: process.env.DATABASE_URL});
const store = createStore(db)

const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: 1, // give up on a command quickly
    enableOfflineQueue: false, // while disconnected, reject at once instead of queuing
    connectTimeout: 2000, // ms
    commandTimeout: 500 // ms
})
const cache = createCache(redis)

function parseUrl(raw: unknown): string | null {
    if (typeof raw !== "string" || raw.length > 2048) {
        return null
    }

    try {
        const url = new URL(raw)
        if (url.protocol === "http:" || url.protocol === "https:") {
            return url.href
        }
    } catch {
        return null
    }
    return null
}

app.get("/myhealth", async (_req, res) => {
    return res.code(200).send({ok:"done"})
});

// api for shorten url from request
// response with shortened url
app.post<{Body: {url: string}}>("/api/v1/shorten", async (req, res) => {
    // const { url } = req.body

    const url = parseUrl(req.body?.url)

    if (url === null) {
        return res.code(400).send({error: "Invalid URL"})
    }

    // get from db, if found existing, return it
    const code = await store.findCodeByUrl(url)
    if (code !== null) {
        return res.code(200).send({"code": code, "orig": url})
    }

    // generate the url
    let generatedCode = randomCode(8)

    // verify that generated must unique
    while (!(await store.save(generatedCode, url))) {
        generatedCode = randomCode(8)
    }

    return res.code(201).send({"code": generatedCode, "orig": url})
})

app.post<{Body: {url: string, code: string}}>("/api/v1/custom-shorten", async (req, res) => {
    // get url and code from request body
    const url = req.body.url
    const code = req.body.code

    if (url === undefined) {
        return res.code(400).send({error: "Invalid URL"})
    }

    if (code === undefined) {
        return res.code(400).send({error: "Invalid URL"})
    }

    // validate code that must have only allowed letters
    if (!validateCode(code)) {
        return res.code(400).send({error: "Cannot generate url with this code"})
    }

    // check code is exists
    if (!(await store.save(code, url))) {
        return res.code(409).send({"duplicate": "code is not unique"})
    }

    return res.code(201).send({"code": code, "orig": url})
})

app.get<{Params: {code: string}}>("/:code", async (req, res) => {
    const {code} = req.params
    
    const cacheUrl = await cache.get(code)
    if (cacheUrl !== null) {
        return res.redirect(cacheUrl, 302)
    }

    const url = await store.findUrlByCode(code)
    if (url === null) {
        return res.code(404).send({"error": "Not found"})
    }

    await cache.set(code, url)
    return res.redirect(url, 302)
})

const shutdown =  async () => {
    app.log.info("Shutting down");
    await app.close()
    await db.end()
    redis.disconnect();
    process.exit(0)
}

process.on("SIGTERM", shutdown)
process.on("SIGINT", shutdown)

const host = process.env.HOST ?? "0.0.0.0"
const port = Number(process.env.PORT ?? 8080)
try {
    await app.listen({port: port, host: host})
} catch (err) {
    app.log.error(err)
    process.exit(1)
}

