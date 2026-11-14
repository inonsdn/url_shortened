import Fastify from "fastify";
import pg from "pg";
import {randomCode} from "./utils/base62.js"
import { createStore } from "./db/pgx.js";

const app = Fastify({logger: true});

const db = new pg.Pool({connectionString: process.env.DATABASE_URL});

const store = createStore(db)

const MockDB = new Map<string, string>()
const MockDB2 = new Map<string, string>()

app.get("/health", async (_req, res) => {
    res.code(200).send({ok:"done"})
});

// api for shorten url from request
// response with shortened url
app.post<{Body: {url: string}}>("/api/v1/shorten", async (req, res) => {
    const { url } = req.body

    if (url === undefined) {
        return res.code(400).send({error: "Invalid URL"})
    }

    // get from db, if found existing, return it
    // const shortenedUrl = MockDB.get(url)
    const code = await store.findCodeByUrl(url)
    if (code !== null) {
        return res.code(200).send({"code": code, "orig": url})
    }

    // generate the url
    let generatedCode = randomCode(8)

    // verify that generated must unique
    while (await store.findUrlByCode(generatedCode) !== null) {
        generatedCode = randomCode(8)
    }


    const savePass = await store.save(generatedCode, url)
    if (!savePass) {
        return res.code(500).send({error:"Cannot shorten url"})
    }
    // // set to db
    // MockDB.set(url, generatedCode)
    // MockDB2.set(generatedCode, url)

    return res.code(201).send({"code": generatedCode, "orig": url})
})

app.get<{Params: {code: string}}>("/:code", async (req, res) => {
    const {code} = req.params

    // const url = MockDB2.get(code)
    const url = await store.findUrlByCode(code)
    if (url === null) {
        return res.code(404).send({"error": "Not found"})
    }

    return res.redirect(url, 302)
})

app.listen({port: Number(process.env.PORT), host: process.env.HOST ?? "localhost"})

