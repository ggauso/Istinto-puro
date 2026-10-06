# Dockerfile per Istinto Puro.
# Target "dev" (default): monta il codice sorgente da bind mount e gira con Vite in
#   modalità dev (hot reload) - pensato per docker-compose.yml locale.
# Target "prod": esegue una build statica e serve dist/ tramite Express.
#
# Uso:
#   docker compose up -d                              # usa il target "dev" (default)
#   APP_TARGET=prod docker compose up -d --build       # usa il target "prod"

FROM node:20-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS dev
ENV NODE_ENV=development
COPY . .
EXPOSE 3000
CMD ["npx", "tsx", "server.ts"]

FROM base AS build
COPY . .
RUN npm run build

FROM node:20-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm install tsx
COPY --from=build /app/dist ./dist
COPY server.ts ./server.ts
EXPOSE 3000
CMD ["npx", "tsx", "server.ts"]
