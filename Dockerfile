# syntax=docker/dockerfile:1
#
# catlico-web production image: multi-stage `vite build` -> nginx serving the
# static bundle. Phase 6 §6.1 (Helm chart) deliverable #1.
#
# NOTE on the build output directory:
#   The app is built with Vite. A plain SPA `vite build` emits `dist/`, which is
#   what this image serves. If TanStack Start's server (SSR) output is enabled,
#   `vite build` instead emits `.output/` (client assets under
#   `.output/public/`) and the static-nginx model below does not cover SSR —
#   that would need a Node server image (documented follow-up in catlico-deploy
#   README). Confirm the client-output dir against the actual build and adjust
#   the `COPY --from=build` line if it is not `dist/`.
#
# API wiring: the client is built with VITE_API_BASE_URL=/api/v1 (same-origin),
# and nginx reverse-proxies /api/ to the API service. Override API_UPSTREAM at
# runtime (default http://catlico-api:8000) — see docker/nginx.conf.template.

# ---- build stage --------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

# pnpm is the repo's package manager (only pnpm-lock.yaml is committed).
RUN corepack enable

# Install deps against the frozen lockfile first for better layer caching.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

COPY . .

# Same-origin API base by default; nginx proxies /api/ to the backend. Override
# with `--build-arg VITE_API_BASE_URL=https://api.example.com/api/v1` to point
# the client straight at an external API (then no nginx proxy is needed).
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN pnpm build

# ---- runtime stage ------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

# nginx's entrypoint runs envsubst over /etc/nginx/templates/*.template into
# /etc/nginx/conf.d/ on start, so API_UPSTREAM is substituted at container boot.
COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template

# Static bundle. Adjust the source path if the build emits .output/public.
COPY --from=build /app/dist /usr/share/nginx/html

# Non-privileged port so the container can run as a non-root user in k8s.
ENV API_UPSTREAM=http://catlico-api:8000
EXPOSE 8080

# The stock nginx image ships a matching entrypoint/CMD; keep it.
