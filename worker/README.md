# Lead Machine — Worker

Lightweight Express service that owns Puppeteer. Hosts the lead-generation
work (Google Maps scrape + detail enrichment + keyword expansion + website
email harvesting), writes results directly to Supabase via the service role
key, and streams progress back as Server-Sent Events.

## Why a separate service?

- **Puppeteer is heavy.** Each scrape spawns Chromium + 4–6 parallel pages.
  That doesn't fit Vercel's serverless model.
- **Long-running.** A 500-lead scrape can run 1–3 minutes. Vercel functions
  cap at 30 s (Hobby) / 300 s (Pro). Railway containers have no such cap.
- **Stateful access to Chromium.** Container-based hosts like Railway give
  us a long-lived process where Chromium can be reused across requests if
  we ever add a pool.

## Endpoints

### `GET /health`
Returns `{ ok: true }`. Used by Railway's health check.

### `POST /scrape`
Streaming SSE endpoint. Requires `Authorization: Bearer <WORKER_TOKEN>`.

**Body:**
```json
{
  "scanRunId": "uuid",
  "userId": "uuid",
  "keyword": "dentist",
  "location": "Islamabad, Pakistan",
  "target": 50
}
```

The frontend (Next.js on Vercel) is responsible for:
1. Authenticating the user
2. Reserving credits
3. Creating the `scan_runs` row
4. Calling this endpoint with the IDs above

The worker is responsible for:
1. Scraping Google Maps
2. Expanding the niche if underfilled
3. Enriching each lead with website + phone from the detail page
4. Harvesting emails from each lead's website
5. Inserting leads + lead_contacts under the given `scanRunId`
6. Marking the `scan_runs` row as completed (or failed)

**Stream events:**
```
data: {"phase":"launching"}
data: {"phase":"searching","query":"dentist Islamabad"}
data: {"phase":"discovering","count":12,"target":50}
data: {"phase":"extracting","count":50,"target":50}
data: {"phase":"enriching","count":35,"target":50}
data: {"phase":"harvesting","count":20,"target":42}
data: {"phase":"saving"}
data: {"phase":"saved","total":50}
```

Or on failure:
```
data: {"phase":"error","message":"..."}
```

## Local dev

```bash
cd worker
cp .env.example .env
# Fill in WORKER_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
npm install
npm run dev
# Worker on http://localhost:8080
```

Test it:
```bash
curl -N -X POST http://localhost:8080/scrape \
  -H "Authorization: Bearer $WORKER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"scanRunId":"<uuid>","userId":"<uuid>","keyword":"dentist","location":"Islamabad","target":5}'
```

## Deploy to Railway

1. In Railway: **New project** → **Deploy from GitHub repo** → pick your
   `lead-machine` repo
2. **Settings → Source → Root Directory** → `/worker`
3. Railway will auto-detect the Dockerfile and build it
4. **Settings → Variables** → paste:
   ```
   WORKER_TOKEN=<long random secret>
   SUPABASE_URL=<your supabase url>
   SUPABASE_SERVICE_ROLE_KEY=<service role key>
   MISTRAL_API_KEY=<optional>
   ```
5. **Settings → Networking → Generate Domain** → get
   `lead-machine-worker.up.railway.app`

Then on the Vercel side, set:
```
WORKER_URL=https://lead-machine-worker.up.railway.app
WORKER_TOKEN=<same secret>
```

The frontend's `/api/google-maps-search` route will detect those env vars
and proxy to the worker. Without them set, it falls back to the in-process
scraper (useful for local dev without Docker).
