#!/bin/sh
# Brings the production stack on this server up to the images CI last pushed:
# pull, run the database migrations, then restart what changed. Run from the
# directory holding `.env` and `docker/` (the deploy workflow copies `docker/`
# there; .github/workflows/deploy.yml). Safe to run again: migrations that
# already ran are skipped, and unchanged containers are left alone.
set -eu

cd "$(dirname "$0")/.."
compose() { docker compose --env-file .env -f docker/docker-compose.prod.yml "$@"; }

compose pull --quiet
# The image ships the compiled data source and typeorm's CLI, not ts-node, so
# migrations run from dist/ (apps/api/src/config/data-source.ts).
compose run --rm api sh -c \
  'node "$(node -p "require.resolve(\"typeorm/cli.js\")")" migration:run -d dist/config/data-source.js'
compose up -d --remove-orphans
compose ps
docker image prune -f >/dev/null
