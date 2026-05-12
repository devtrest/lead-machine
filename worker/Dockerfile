# Lead Machine — worker image. Uses Puppeteer's maintained image which ships
# with Chromium + all required system libraries preinstalled.
FROM ghcr.io/puppeteer/puppeteer:24.8.2

WORKDIR /app

# Skip puppeteer's own Chromium download — the base image already has it,
# and PUPPETEER_EXECUTABLE_PATH is set to point at it.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV NODE_ENV=production
ENV PUPPETEER_HEADLESS=true

# Install deps with strict lockfile
COPY --chown=pptruser:pptruser package.json package-lock.json* ./
RUN npm install --omit=dev=false

# Source + build
COPY --chown=pptruser:pptruser tsconfig.json ./
COPY --chown=pptruser:pptruser src ./src
RUN npm run build

# Prune dev deps after build to slim the image
RUN npm prune --omit=dev

EXPOSE 8080
CMD ["node", "dist/server.js"]
