import http from "k6/http"
import {check} from "k6"

const N = 31536000

const BASE = __ENV.BASE || "http://localhost:8080"

export const options = {
  maxRedirects: 0,   // IMPORTANT: don't follow the 302 to example.com
  scenarios: {
    writes: {
      executor: "constant-arrival-rate", exec: "shorten",
      rate: 1, timeUnit: "1s", duration: "2m", preAllocatedVUs: 5,
    },
    reads: {
      executor: "ramping-arrival-rate", exec: "redirect",
      startRate: 100, timeUnit: "1s", preAllocatedVUs: 200, maxVUs: 500,
      stages: [{ target: 500, duration: "30s" }, { target: 2000, duration: "1m" }, { target: 2000, duration: "30s" }],
    },
  },
  thresholds: { "http_req_duration{scenario:reads}": ["p(95)<50"] },
}

function popularCode() {
    const i = 1 + Math.floor(N * Math.pow(Math.random(), 4))
    return "b" + i.toString(16).padStart(9, "0")
}

export function redirect() {
    const res = http.get(`${BASE}/${popularCode()}`, { tags: {name: "redirect"}})
    check(res, { "302": (r) => r.status === 302})
}

export function shorten() {
    const res = http.post(`${BASE}/api/v1/shorten`,
        JSON.stringify({ url: `https://example.com/new/${Date.now()}-${Math.random()}` }),
        { headers: { "content-type": "application/json" }, tags: { name: "shorten" } });
    check(res, { "201": (r) => r.status === 201 });
}