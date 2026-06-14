FROM node:22.15.0-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@11.5.2 --activate
ENV DO_NOT_TRACK=1
ENV TURBO_TELEMETRY_DISABLED=1

FROM base AS pruner
WORKDIR /app
COPY . .
RUN pnpm dlx turbo@2.9.17 prune @supertool/api --docker

FROM base AS builder
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
ENV DATABASE_URL=postgres://placeholder:placeholder@localhost:5432/placeholder
ENV BETTER_AUTH_SECRET=docker-build-codegen-placeholder
ENV BETTER_AUTH_URL=http://localhost:3001
ENV AUTH_TRUSTED_ORIGINS=http://localhost:3000
RUN pnpm exec turbo run build --filter=@supertool/api

FROM base AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs
COPY --from=pruner /app/out/json/ .
RUN pnpm install --prod --frozen-lockfile
COPY --from=builder --chown=nestjs:nodejs /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./apps/api/dist
USER nestjs
ENV NODE_ENV=production
ENV PORT=3001
ENV DO_NOT_TRACK=1
ENV TURBO_TELEMETRY_DISABLED=1
EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]
