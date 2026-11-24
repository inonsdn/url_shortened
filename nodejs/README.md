# URL Shortener (Node.js)

A URL shortener built to practise backend engineering end to end: an HTTP API, PostgreSQL, Redis caching, Docker, load testing at 31.5 million links, and Kubernetes. This folder is the Node.js implementation; Python and Go versions of the same API are planned.

## Stack

| Part | Choice |
| --- | --- |
| Runtime / language | Node.js, TypeScript (strict, ESM) |
| HTTP framework | Fastify |
| Database | PostgreSQL 17 (`pg` driver) |
| Cache | Redis 7 (`ioredis`), cache-aside |
| Packaging | Multi-stage Docker image, Docker Compose |
| Load testing | k6 |

## API

| Method | Path | Body | Responses |
| --- | --- | --- | --- |
| `POST` | `/api/v1/shorten` | `{ "url": "https://..." }` | `201` new code · `200` existing code for the same URL · `400` invalid URL |
| `POST` | `/api/v1/custom-shorten` | `{ "url": "https://...", "code": "mylink" }` | `201` created · `400` invalid code or URL · `409` code already taken |
| `GET` | `/:code` | | `302` redirect · `404` unknown code |
| `GET` | `/myhealth` | | `200` health check |

Rules:

- Codes are 6–10 characters from `0-9 a-z A-Z` (base62). Random codes are 8 characters, giving 62⁸ ≈ 218 trillion combinations.
- URLs must be `http://` or `https://` and at most 2,048 characters.

## Design decisions

**Uniqueness is enforced by the database, not by the application.** The `code` column has a `UNIQUE` constraint. The app never checks "is this code free?" before inserting; it inserts and treats a unique violation (SQLSTATE `23505`) as "taken". Checking first would open a race between two requests claiming the same code (check-then-act). For random codes the app retries with a new code; for custom codes it returns `409`.

**Redirects use cache-aside with Redis.** A redirect reads `link:<code>` from Redis; on a miss it reads Postgres and stores the URL with a 24-hour TTL. Redis is limited to 100 MB with `allkeys-lru` eviction.

**The cache fails open.** Any Redis error is treated as a cache miss, so a Redis outage makes redirects fall back to Postgres instead of failing. The client is configured to fail fast (`enableOfflineQueue: false`, `maxRetriesPerRequest: 1`, 500 ms command timeout) so requests never hang while Redis is down. The load test below verifies this.

**302, not 301.** Browsers cache 301 redirects permanently, which would hide repeat visits from the server and make links impossible to change later.

**Graceful shutdown.** On `SIGTERM`/`SIGINT` the server stops accepting requests, finishes in-flight ones, then closes the Postgres pool and Redis client. This matters for zero-downtime rolling updates in Docker and Kubernetes.

## Running it

With Docker Compose (app, Postgres and Redis):

```bash
docker compose up -d --build
curl -i -X POST localhost:8080/api/v1/shorten \
  -H "content-type: application/json" -d '{"url":"https://example.com"}'
curl -i localhost:8080/<code>
```

For development with hot reload, run only the databases in Docker and the app locally:

```bash
docker compose up -d postgres redis
npm install
npm run dev
```

## Load test: 31.5 million links

### Setup

- **Data:** 31,536,000 links (one new link per second for a year), generated in Postgres with `generate_series` in batches of 1 million (`loadtest/backfill.sql`).
- **Traffic** (`loadtest/redirect.js`, k6, open model):
  - Redirects ramp from 100 to 2,000 requests/s and hold at 2,000 for 30 s (2 minutes in total).
  - At the same time, 1 new short link per second.
  - Redirect codes are picked with a skewed distribution (`random()⁴`), so a small set of links is very popular, as in real traffic. `SKEW=1` switches to uniform traffic.
- **Environment:** app, Postgres, Redis and k6 all on one MacBook (Docker Desktop). Absolute numbers depend on this machine; the comparison between runs is what matters.
- All four runs were made in one sitting, back to back, against the Dockerised app.

### Results

| Run | Setup | p50 | p95 | p99 | max | Errors |
| --- | --- | --- | --- | --- | --- | --- |
| A | Redis on, warm cache, skewed traffic (first run of the session) | 0.73 ms | 10.6 ms | 80.0 ms | 316 ms | 0 |
| B | Redis on, cache emptied before the run | 0.65 ms | 2.0 ms | 16.3 ms | 114 ms | 0 |
| C | Redis stopped halfway through the run | 0.52 ms | 1.6 ms | 13.8 ms | 440 ms | 0 |
| D | Redis on, uniform traffic | 0.70 ms | 2.0 ms | 13.8 ms | 60 ms | 0 |

Every run sustained about 1,200 requests/s on average and 2,000 requests/s at peak, with 100% of redirects (≈144,000 per run) and 100% of writes (≈120 per run) succeeding.

### Findings

1. **At this scale, Redis didn't measurably improve latency.** With Redis on, emptied, stopped or facing uniform traffic, p95 stayed around 2 ms and p99 around 14–16 ms. The lookup is an index scan on the unique `code` index (well under 1 ms even at 31.5 million rows), and the machine had enough memory to keep the hot data in Postgres's and the OS's caches. The database was not the bottleneck, so the cache had nothing to fix. Redis would earn its place when the database is remote, shared with other workloads, or under much higher load than a single laptop can generate.

2. **The cache fails open.** Redis was stopped halfway through run C: zero failed redirects and no rise in p95.

3. **The first run after a deploy is slower.** Run A, the first after rebuilding the app container, had 5× the p95 of the others and the only significant dropped iterations, even though run B had a colder cache and was faster. This points to warm-up effects (V8 compiling hot code, connection pools filling, caches warming), not to Redis. Measure after a warm-up run. *(To confirm: re-run A at the end of a session.)*

4. **Method matters.** An earlier set of runs spread over two days suggested that Redis made things 10× slower. Re-running every configuration in one sitting showed that difference came from the machine's conditions on different days. Comparisons are only valid when one thing changes at a time.

### Reproduce

```bash
docker compose up -d --build
docker compose cp loadtest/backfill.sql postgres:/tmp/backfill.sql
docker compose exec postgres psql -U app -d url_shortened -f /tmp/backfill.sql

k6 run loadtest/redirect.js > /dev/null                        # warm-up
k6 run --summary-export=results/A.json loadtest/redirect.js
k6 run -e SKEW=1 --summary-export=results/D.json loadtest/redirect.js
```

## Next steps

- Automated tests with Vitest and `app.inject` (validation, status codes, cache fail-open).
- Drop URL deduplication: without it, `/shorten` needs no lookup by URL, and the `url` index (several GB at 31.5M rows) can be removed.
- Run the app on Kubernetes with probes, rolling updates and autoscaling.
- Deploy to a cloud VM with HTTPS and CI/CD.
- Python and Go implementations of the same API, compared under the same load test.
