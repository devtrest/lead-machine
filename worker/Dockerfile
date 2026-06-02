# Lead Machine — worker image. Pure Node now (no Puppeteer/Chromium); the
# place-lookup pipeline is backed by the Google Places API instead of
# headless browser scraping.
FROM node:20-slim

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

RUN npm prune --omit=dev

EXPOSE 8080
CMD ["node", "dist/server.js"]
