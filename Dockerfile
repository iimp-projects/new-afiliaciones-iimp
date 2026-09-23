# syntax=docker/dockerfile:1

# =============================================================================
# Afiliaciones IIMP — reproducible production artifact
#
# Strategy: Next.js `output: "standalone"` + Puppeteer-managed Chromium.
# Chromium is downloaded by Puppeteer during `npm ci` (deps stage) and copied
# into the runner. No Prisma CLI, no migrations and no seeds run at runtime.
# =============================================================================

# -----------------------------------------------------------------------------
# Stage: deps — reproducible dependency install (includes dev tooling needed to
# build: prisma CLI, typescript, tailwind) and the Puppeteer-managed browser.
# -----------------------------------------------------------------------------
FROM node:22-bookworm-slim AS deps
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV PUPPETEER_CACHE_DIR=/app/.cache/puppeteer

# `unzip` is required by the Puppeteer downloader to extract the Chromium zip.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates unzip \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

# -----------------------------------------------------------------------------
# Stage: builder — generate Prisma Client, then compile Next.js standalone.
# Build-only placeholder env is required by config modules that validate at
# import time; it never reaches the runner stage and contains no real secrets.
# -----------------------------------------------------------------------------
FROM node:22-bookworm-slim AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV PUPPETEER_CACHE_DIR=/app/.cache/puppeteer
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build"

# Optional: bake the public base URL into the client bundle (NEXT_PUBLIC_*).
ARG NEXT_PUBLIC_APP_URL="http://localhost:3000"
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

# `openssl` lets Prisma detect the correct engine target (debian-openssl-3.0.x)
# instead of falling back to the 1.1.x engine, which does not match bookworm.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client during build. No migrations, no db push, no seed.
RUN npx prisma generate

# Build-only placeholders required by config modules that validate at import
# time. They are scoped to this single command and are not stored in the image.
RUN AUTH_SECRET="build-only-placeholder-not-a-real-secret" \
    JWT_SECRET="build-only-placeholder-not-a-real-secret" \
    PAYMENT_AUTH_SECRET="build-only-placeholder-not-a-real-secret-32" \
    npm run build

# -----------------------------------------------------------------------------
# Stage: migration — one-shot Prisma migrations (includes the Prisma CLI).
#
# Deliberately minimal: no Chromium, no Next.js standalone, no public assets.
# DATABASE_URL is injected at runtime by the ECS task (Secrets Manager); it is
# never baked in. Migrations only run when the one-shot ECS task executes it.
# Se declara ANTES de `runner` para que el target por defecto siga siendo el web.
# -----------------------------------------------------------------------------
FROM node:22-bookworm-slim AS migration
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Debe coincidir con la dependencia `prisma` de package.json (mantener en sync).
ARG PRISMA_VERSION=6.19.3

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Instalación mínima: solo el CLI de Prisma (sin el árbol de dependencias web).
RUN npm install --global prisma@${PRISMA_VERSION} \
    && npm cache clean --force

COPY prisma ./prisma

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs --create-home nextjs

USER nextjs

CMD ["prisma", "migrate", "deploy", "--schema", "prisma/schema.prisma"]

# -----------------------------------------------------------------------------
# Stage: runner — minimal non-root runtime. Only the standalone server, static
# assets, public assets and the Puppeteer-managed Chromium are present.
# -----------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV PUPPETEER_CACHE_DIR=/home/nextjs/.cache/puppeteer
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Minimal runtime libraries required by headless Chromium and Prisma.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      openssl \
      tini \
      fonts-liberation \
      libasound2 \
      libatk-bridge2.0-0 \
      libatk1.0-0 \
      libcairo2 \
      libcups2 \
      libdbus-1-3 \
      libdrm2 \
      libexpat1 \
      libfontconfig1 \
      libgbm1 \
      libglib2.0-0 \
      libgtk-3-0 \
      libnspr4 \
      libnss3 \
      libpango-1.0-0 \
      libpangocairo-1.0-0 \
      libx11-6 \
      libx11-xcb1 \
      libxcb1 \
      libxcomposite1 \
      libxcursor1 \
      libxdamage1 \
      libxext6 \
      libxfixes3 \
      libxi6 \
      libxkbcommon0 \
      libxrandr2 \
      libxrender1 \
      libxshmfence1 \
      libxss1 \
      libxtst6 \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs --create-home nextjs

# Standalone server + assets.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Puppeteer-managed Chromium (pinned by puppeteer 25.3.0).
COPY --from=deps --chown=nextjs:nodejs /app/.cache/puppeteer /home/nextjs/.cache/puppeteer

# Enable the Chromium sandbox for a non-root user via the setuid helper.
# Chrome for Testing ships the helper as `chrome_sandbox` (underscore); Chrome
# looks it up as `chrome-sandbox` (hyphen), so both are set up.
RUN find /home/nextjs/.cache/puppeteer -name 'chrome_sandbox' -exec sh -c \
      'd=$(dirname "$1"); chown root:root "$1"; chmod 4755 "$1"; ln -sf "$1" "$d/chrome-sandbox"' _ {} \;

USER nextjs

EXPOSE 3000

# Liveness only (process health). Readiness (/api/health/ready) depends on the
# database and must NOT gate container health. Uses Node's global fetch, so no
# extra runtime package (curl/wget) is added to the image.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health/live').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# tini reaps orphaned Chromium children (Puppeteer spawns crashpad/zygote
# processes) that would otherwise accumulate as zombies under PID 1.
ENTRYPOINT ["/usr/bin/tini", "--"]

# server.js is emitted by `output: "standalone"`. It never runs migrations,
# never runs seeds and never needs the Prisma CLI.
CMD ["node", "server.js"]
