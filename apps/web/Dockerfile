# syntax=docker/dockerfile:1.7

ARG BASE_IMAGE=tikto-base:local
FROM ${BASE_IMAGE} AS builder
ENV NEXT_TELEMETRY_DISABLED=1
COPY apps/web ./apps/web
COPY packages ./packages
COPY tsconfig.json tsconfig.services.base.json ./
ENV NODE_ENV=production
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_VERSION
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_APP_VERSION=$NEXT_PUBLIC_APP_VERSION
RUN npm run web:build
RUN npm prune --omit=dev --ignore-scripts && npm cache clean --force

FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
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
USER nextjs
EXPOSE 3000
CMD ["npm", "--workspace", "@tikto/web", "run", "start"]
