# syntax=docker/dockerfile:1.7

ARG BASE_IMAGE=tikto-base:local
FROM ${BASE_IMAGE} AS builder
COPY packages ./packages
COPY services/tasks ./services/tasks
COPY tsconfig.services.json tsconfig.services.base.json ./
COPY tooling ./tooling
COPY scripts ./scripts
ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tikto
RUN npm run service:tasks:build
RUN npm prune --omit=dev --ignore-scripts && npm cache clean --force

FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=4200
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 service
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder --chown=service:nodejs /app/dist-services ./dist-services
USER service
EXPOSE 4200
CMD ["npm", "run", "service:tasks:start"]
