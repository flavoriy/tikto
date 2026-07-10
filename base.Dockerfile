# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY services/profile/package.json ./services/profile/package.json
COPY services/tasks/package.json ./services/tasks/package.json
COPY services/calendar/package.json ./services/calendar/package.json
COPY services/dashboard/package.json ./services/dashboard/package.json
COPY services/gateway/package.json ./services/gateway/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/service-runtime/package.json ./packages/service-runtime/package.json

RUN npm ci --ignore-scripts
