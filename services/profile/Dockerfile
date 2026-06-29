# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY services/profile/package.json ./services/profile/package.json
COPY services/tasks/package.json ./services/tasks/package.json
COPY services/calendar/package.json ./services/calendar/package.json
COPY services/dashboard/package.json ./services/dashboard/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/service-runtime/package.json ./packages/service-runtime/package.json
RUN npm ci --ignore-scripts

FROM deps AS builder
COPY packages ./packages
COPY services/profile ./services/profile
COPY tsconfig.services.json tsconfig.services.base.json ./
ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tikto
RUN npm run service:profile:build
RUN npm prune --omit=dev --ignore-scripts && npm cache clean --force

FROM base AS runner
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=4100
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 service
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder --chown=service:nodejs /app/dist-services ./dist-services
USER service
EXPOSE 4100
CMD ["npm", "run", "service:profile:start"]
