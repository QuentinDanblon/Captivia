# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
# HOSTNAME=localhost exactement (voir e2e/support/serve.js) : le middleware i18n construit ses
# URL de réécriture à partir de HOSTNAME ; 0.0.0.0 les rend « externes » et les URL sans préfixe
# de langue bouclent en 307. L'écoute reste sur toutes les interfaces (LISTEN_HOST, voir
# listen-all.cjs plus bas), sinon le conteneur ne serait joignable que depuis lui-même.
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=localhost \
    LISTEN_HOST=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1 \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Préchargé avant server.js : écoute sur LISTEN_HOST (voir docker/listen-all.cjs).
COPY --chown=nextjs:nodejs docker/listen-all.cjs ./listen-all.cjs

USER nextjs
EXPOSE 3000

CMD ["node", "--require", "./listen-all.cjs", "server.js"]
