FROM node:26-alpine AS base
RUN apk upgrade --no-cache && apk add --no-cache libc6-compat

# ── Build stage ──────────────────────────────────────────────────────────────
# Build context is the monorepo root (context: . in docker-compose / CI)
FROM base AS builder
RUN npm install -g npm@latest
WORKDIR /app

# Copy workspace manifests first for better layer caching
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/
RUN npm ci

# Copy source — shared package first, then the web app
COPY packages/shared/ ./packages/shared/
COPY apps/web/ ./apps/web/

WORKDIR /app/apps/web
RUN npx prisma generate
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── Production deps stage ───────────────────────────────────────────────────
# Separate npm ci --omit=dev so the runtime image doesn't ship devDependencies
# (tsx, vitest, eslint, testing-library, ...) that next start / prisma migrate
# deploy never touch.
FROM base AS prod-deps
RUN npm install -g npm@latest
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/
RUN npm ci --omit=dev

# ── Runtime stage ────────────────────────────────────────────────────────────
# WORKDIR inside apps/web so next start, prisma, etc. resolve correctly
FROM base AS runner
WORKDIR /app/apps/web
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# The runner never calls npm/npx (entrypoint.sh invokes prisma/next directly
# from node_modules/.bin) — remove the bundled npm install entirely instead
# of chasing individual CVEs in its internal deps (undici, tar, brace-expansion, ...).
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

# Hoisted node_modules live at the monorepo root (/app/node_modules).
# Production-only install from prod-deps: prisma.config.ts is TS-loaded via
# jiti (a runtime dep of the "prisma" package itself, not a devDependency) and
# does `import "dotenv/config"` unconditionally — that's why dotenv now lives
# in "dependencies" instead of devDependencies. tsx stays a devDependency: it
# only backs `prisma db seed`, which this image never runs.
COPY --from=prod-deps --chown=nextjs:nodejs /app/node_modules /app/node_modules

# The generated Prisma Client (query engine binary included) must match what
# `next build` was compiled against — copy it from the builder instead of
# re-running `prisma generate` against the prod-only install.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma /app/node_modules/.prisma

# Shared package (referenced via the @tripplanner/shared symlink in node_modules)
COPY --from=builder --chown=nextjs:nodejs /app/packages /app/packages

# Web app build outputs
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/package.json ./package.json

# Prisma: schema + migrations + config needed by `prisma migrate deploy`
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/prisma.config.ts ./prisma.config.ts

# Entrypoint is outside WORKDIR to avoid being shadowed by bind mounts
COPY --chown=nextjs:nodejs docker/entrypoint.sh /app/docker/entrypoint.sh
RUN chmod +x /app/docker/entrypoint.sh

USER nextjs
EXPOSE 3000
ENTRYPOINT ["/app/docker/entrypoint.sh"]
