FROM node:26-alpine AS base
# Node 25+ no longer bundles corepack, so pnpm is installed from npm.
RUN npm install -g pnpm@9.15.4

FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/site/package.json ./apps/site/
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY packages/shared/package.json ./packages/shared/
COPY packages/frontend/design-system/web/package.json ./packages/frontend/design-system/web/
COPY packages/frontend/react-hooks/package.json ./packages/frontend/react-hooks/
RUN pnpm install --frozen-lockfile --filter @flama/site...

FROM base AS builder
WORKDIR /app
COPY --from=deps /app ./
COPY . .
# VITE_SITE_APP_URL is baked in at build time (root .env.example).
ARG VITE_SITE_APP_URL=""
ENV VITE_SITE_APP_URL=$VITE_SITE_APP_URL
RUN pnpm --filter @flama/site... build

FROM nginx:alpine AS runner
COPY --from=builder /app/apps/site/dist /usr/share/nginx/html
# Precompress text assets once, so `gzip_static` serves them ready-made.
RUN find /usr/share/nginx/html -type f \
      \( -name '*.js' -o -name '*.css' -o -name '*.svg' -o -name '*.html' \
         -o -name '*.xml' -o -name '*.txt' \) \
      -exec sh -c 'gzip -9c "$1" > "$1.gz"' _ {} \;
COPY apps/site/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3002
CMD ["nginx", "-g", "daemon off;"]
