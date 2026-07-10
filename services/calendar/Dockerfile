# syntax=docker/dockerfile:1.7

FROM tikto-base:local AS builder
COPY packages ./packages
COPY services/calendar ./services/calendar
COPY tsconfig.services.json tsconfig.services.base.json ./
COPY tooling ./tooling
ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tikto
RUN npm run service:calendar:build
RUN npm prune --omit=dev --ignore-scripts && npm cache clean --force

FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=4300
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 service
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder --chown=service:nodejs /app/dist-services ./dist-services
USER service
EXPOSE 4300
CMD ["npm", "run", "service:calendar:start"]
