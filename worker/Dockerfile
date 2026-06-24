# Lead Machine — worker image. Pure Node now (no Puppeteer/Chromium); the
# place-lookup pipeline is backed by the Google Places API instead of
# headless browser scraping.
#
# Node 22 (not 20): @supabase/supabase-js requires native WebSocket, which
# only landed in Node 22. On Node 20 the realtime client throws at import.
FROM node:22-slim

WORKDIR /app

# Email harvesting runs in find_emails.py (stdlib only — no pip deps), spawned
# per-lead by the worker. We just need the interpreter on the image.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 \
  && rm -rf /var/lib/apt/lists/*

# Install ALL deps (including devDependencies — tsc/typescript live there
# and we need them to build). NODE_ENV stays as default during build.
COPY package.json package-lock.json* ./
RUN npm install --include=dev

# Compile TypeScript
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# The email harvester script — lives at /app/find_emails.py, resolved by
# dist/enrichment.js as ../find_emails.py.
COPY find_emails.py ./

# Now drop dev deps to slim the runtime image
RUN npm prune --omit=dev

# Switch to production for the running container
ENV NODE_ENV=production

EXPOSE 8080
CMD ["node", "dist/server.js"]
