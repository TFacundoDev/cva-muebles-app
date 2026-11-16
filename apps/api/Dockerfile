# Imagen de la API. Se construye desde la raíz del repositorio:
#   docker build -f apps/api/Dockerfile -t cva-api .
# La misma imagen corre en Fly, en Render o en cualquier servidor con Docker.

FROM node:22-bookworm-slim AS base
RUN npm install -g pnpm@10.28.0
WORKDIR /app
# Primero solo los package.json: así Docker reutiliza la instalación mientras
# no cambien las dependencias.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

# ---------- Etapa 1: compilar ----------
FROM base AS build
RUN pnpm install --frozen-lockfile --filter "@cva/api..."
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @cva/shared build \
 && pnpm --filter @cva/api db:generate \
 && pnpm --filter @cva/api build

# ---------- Etapa 2: imagen final, solo con lo necesario para correr ----------
FROM base AS runner
ENV NODE_ENV=production
# Prisma necesita OpenSSL para aplicar las migraciones.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
RUN pnpm install --frozen-lockfile --prod --filter "@cva/api..."
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/api/dist apps/api/dist
COPY apps/api/prisma/schema.prisma apps/api/prisma/schema.prisma
COPY apps/api/prisma/migrations apps/api/prisma/migrations
COPY apps/api/prisma.config.ts apps/api/prisma.config.ts
WORKDIR /app/apps/api
# Deja descargado el motor de migraciones dentro de la imagen, para que el
# arranque no dependa de bajarlo.
RUN pnpm exec prisma -v
EXPOSE 3001
# Al arrancar aplica las migraciones pendientes y después levanta la API.
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/main.js"]
