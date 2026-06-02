# Lead Machine — worker image. Pure Node now (no Puppeteer/Chromium); the
# place-lookup pipeline is backed by the Google Places API instead of
# headless browser scraping.
FROM node:20-slim

WORKDIR /app

# Install ALL deps (including devDependencies — tsc/typescript live there
# and we need them to build). NODE_ENV stays as default during build.
COPY package.json package-lock.json* ./
RUN npm install --include=dev

# Compile TypeScript
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Now drop dev deps to slim the runtime image
RUN npm prune --omit=dev

# Switch to production for the running container
ENV NODE_ENV=production

EXPOSE 8080
CMD ["node", "dist/server.js"]
