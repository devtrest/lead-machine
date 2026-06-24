# Lead Machine — worker image. Pure Node now (no Puppeteer/Chromium); the
# place-lookup pipeline is backed by the Google Places API instead of
# headless browser scraping.
#
# Node 22 (not 20): @supabase/supabase-js requires native WebSocket, which
# only landed in Node 22. On Node 20 the realtime client throws at import.
FROM node:22-slim

WORKDIR /app

# Email harvesting runs in two layers:
#   - find_emails.py (stdlib python, no pip deps) — fast HTTP scrape, Layer 1.
#   - puppeteer-core driving system Chromium — Layer 2, renders JS-only sites
#     (premium restaurants, agency-built SPAs) where the email isn't in the
#     static HTML. Only invoked on leads Layer 1 couldn't crack.
# ca-certificates is required or python's urllib HTTPS fails with
# CERTIFICATE_VERIFY_FAILED (Node bundles its own roots, so it bit only python).
# fonts-liberation + the chromium deps let headless Chrome start in the slim image.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
       python3 \
       ca-certificates \
       chromium \
       fonts-liberation \
  && rm -rf /var/lib/apt/lists/*

# Point puppeteer-core at the system Chromium (it ships no browser of its own).
ENV CHROMIUM_PATH=/usr/bin/chromium

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
