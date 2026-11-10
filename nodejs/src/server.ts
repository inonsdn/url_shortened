import Fastify from "fastify";
import {randomCode} from "./utils/base62.js"

const app = Fastify({logger: true});

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
    const shortenedUrl = MockDB.get(url)
    if (shortenedUrl !== undefined) {
        return res.code(200).send({"code": shortenedUrl, "orig": url})
    }

    // generate the url
    let generatedUrl = randomCode(8)

    // verify that generated must unique
    while (MockDB2.has(generatedUrl)) {
        generatedUrl = randomCode(8)
    }

    // set to db
    MockDB.set(url, generatedUrl)
    MockDB2.set(generatedUrl, url)

    return res.code(201).send({"code": generatedUrl, "orig": url})
})

app.get<{Params: {code: string}}>("/:code", async (req, res) => {
    const {code} = req.params

    const url = MockDB2.get(code)
    if (url === undefined) {
        return res.code(404).send({"error": "Not found"})
    }

    return res.redirect(url, 302)
})

app.listen({port: Number(process.env.PORT), host: process.env.HOST ?? "localhost"})

