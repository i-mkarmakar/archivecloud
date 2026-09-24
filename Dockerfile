FROM node:22-alpine AS base

RUN apk add --no-cache ca-certificates libc6-compat openssl

RUN corepack enable && corepack prepare pnpm@10.15.1 --activate

WORKDIR /app

FROM base AS builder

ENV HUSKY=0
ENV CI=true
ENV DATABASE_URL=postgresql://
ENV SKIP_ENV_CHECK=true
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN pnpm install --frozen-lockfile

COPY . .

ARG NEXT_PUBLIC_APP_URL=http://localhost:9050
ARG SITE_URL=http://localhost:9050
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY=
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV SITE_URL=$SITE_URL
ENV NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY
ENV NODE_ENV=production
ENV DOCKER_BUILD=1
ENV NODE_OPTIONS=--max-old-space-size=4096

RUN pnpm build

FROM base AS release

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=9050

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

COPY scripts/entrypoint.sh ./
RUN sed -i 's/\r$//' ./entrypoint.sh \
  && chmod +x ./entrypoint.sh \
  && chown nextjs:nodejs ./entrypoint.sh

USER nextjs

ENTRYPOINT ["./entrypoint.sh"]

EXPOSE 9050
