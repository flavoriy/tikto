# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache libc6-compat openssl

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
COPY apps/web ./apps/web
COPY packages ./packages
COPY prisma ./prisma
COPY tsconfig.json tsconfig.services.base.json ./
ENV NODE_ENV=production
ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tikto
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
RUN npm run web:build
RUN npm prune --omit=dev --ignore-scripts && npm cache clean --force

FROM base AS runner
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/apps/web ./apps/web
COPY --from=builder --chown=nextjs:nodejs /app/packages ./packages
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
USER nextjs
EXPOSE 3000
CMD ["npm", "--workspace", "@tikto/web", "run", "start"]
