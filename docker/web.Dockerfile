FROM node:22.15.0-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@11.5.2 --activate
ENV DO_NOT_TRACK=1
ENV TURBO_TELEMETRY_DISABLED=1
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS pruner
WORKDIR /app
COPY . .
RUN pnpm dlx turbo@2.9.17 prune @supertool/money-tracker --docker

FROM base AS builder
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
ARG API_URL=http://api:3001
ENV API_URL=${API_URL}
RUN pnpm exec turbo run build --filter=@supertool/money-tracker

FROM base AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1
ENV DO_NOT_TRACK=1
ENV TURBO_TELEMETRY_DISABLED=1
COPY --from=builder --chown=nextjs:nodejs /app/apps/money-tracker/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/money-tracker/.next/static ./apps/money-tracker/.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "apps/money-tracker/server.js"]
