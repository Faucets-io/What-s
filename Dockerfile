########################################################################
# Stage 1 — install all dependencies
########################################################################
FROM node:22-alpine AS deps

# sharp (image processing) needs native libs
RUN apk add --no-cache python3 make g++ vips-dev

WORKDIR /app

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@10.10.0 --activate

# Copy workspace manifest + lockfile first for better layer caching
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc ./

# Copy individual package manifests (needed before install)
COPY lib/db/package.json                      ./lib/db/
COPY lib/api-spec/package.json                ./lib/api-spec/
COPY lib/api-zod/package.json                 ./lib/api-zod/
COPY lib/api-client-react/package.json        ./lib/api-client-react/
COPY scripts/package.json                     ./scripts/
COPY artifacts/api-server/package.json        ./artifacts/api-server/
COPY artifacts/whatsapp-monitor/package.json  ./artifacts/whatsapp-monitor/

# Install everything (workspace packages share node_modules at root)
RUN pnpm install --frozen-lockfile --ignore-scripts && \
    pnpm rebuild

########################################################################
# Stage 2 — build
########################################################################
FROM deps AS builder

# Copy source after deps so code changes don't bust the dep cache
COPY tsconfig.base.json tsconfig.json ./
COPY lib/ ./lib/
COPY scripts/ ./scripts/
COPY artifacts/api-server/       ./artifacts/api-server/
COPY artifacts/whatsapp-monitor/ ./artifacts/whatsapp-monitor/

# Build the React frontend (BASE_PATH=/ because the API server serves it at root)
RUN BASE_PATH=/ PORT=3000 pnpm --filter @workspace/whatsapp-monitor run build

# Build the API server (esbuild bundles everything into dist/index.mjs)
RUN pnpm --filter @workspace/api-server run build

########################################################################
# Stage 3 — production runtime image
########################################################################
FROM node:22-alpine AS runner

RUN apk add --no-cache vips

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.10.0 --activate

# Copy workspace manifests + lockfile
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc ./
COPY lib/db/package.json                      ./lib/db/
COPY lib/api-spec/package.json                ./lib/api-spec/
COPY lib/api-zod/package.json                 ./lib/api-zod/
COPY lib/api-client-react/package.json        ./lib/api-client-react/
COPY scripts/package.json                     ./scripts/
COPY artifacts/api-server/package.json        ./artifacts/api-server/
COPY artifacts/whatsapp-monitor/package.json  ./artifacts/whatsapp-monitor/

# Install production dependencies only (native addons like sharp still needed)
RUN pnpm install --frozen-lockfile --prod --ignore-scripts && \
    pnpm rebuild

# Copy the compiled bundles from builder
COPY --from=builder /app/artifacts/api-server/dist/       ./artifacts/api-server/dist/
COPY --from=builder /app/artifacts/whatsapp-monitor/dist/ ./artifacts/whatsapp-monitor/dist/

# Persistent session auth lives here — mount a volume over this path on Render
RUN mkdir -p ./artifacts/api-server/whatsapp-sessions

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:8080/api/healthz || exit 1

CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
