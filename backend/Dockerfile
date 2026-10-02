# syntax=docker/dockerfile:1

# Captivia backend - production image with a separate migration target.
# The image never contains .env files or runtime secrets.

FROM node:22-alpine AS deps
WORKDIR /app

COPY package*.json ./
RUN npm ci

# Prisma Client is generated once in a cached dependency layer.
COPY prisma ./prisma
RUN npx prisma generate

FROM deps AS build
COPY . .
RUN npm run build

# This target intentionally keeps devDependencies (including the Prisma CLI).
# docker-compose uses it for the one-shot migration service.
FROM build AS migrate

# Produce a smaller runtime dependency tree without mutating the build target.
FROM build AS runtime-deps
RUN npm prune --omit=dev

FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    PORT=3001 \
    HOST=0.0.0.0 \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nestjs

COPY --from=runtime-deps --chown=nestjs:nodejs /app/package.json ./
COPY --from=runtime-deps --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=runtime-deps --chown=nestjs:nodejs /app/dist ./dist

USER nestjs
EXPOSE 3001

# Liveness : le process répond sur son port effectif (PORT peut être surchargé à l'exécution,
# p. ex. par Render). La sonde de disponibilité (base de données) est /health/ready.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/health >/dev/null || exit 1

CMD ["node", "dist/src/main.js"]
