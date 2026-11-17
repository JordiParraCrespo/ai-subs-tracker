#!/bin/sh
# Deploy the production stack on this server, from the checkout it lives in
# (/srv/resetowl). Run it over Tailscale: `ssh ops@resetowl`, then
#
#   sh docker/deploy.sh --build            build the API and web images here, from HEAD
#   sh docker/deploy.sh --images API WEB   pull two images and pin them by digest
#   sh docker/deploy.sh --rollback         go back to the images the last deploy replaced
#
# Each run: checks the compose invariants (docker/check-invariants.sh), starts
# Postgres and Redis, runs the TypeORM migrations from the new API image,
# starts everything and waits for the health checks, then asks the API for
# /api/v1/ready from inside the network. If anything after the migrations
# fails, the images it replaced are started again.
#
# Migrations only go forward, and a rollback keeps the schema they left: write
# them so the previous release still runs against it (add first, drop in a
# later release). docker/deploy.manifest.json records that.
set -eu

cd "$(dirname "$0")/.."
STATE=.deploy
mkdir -p "$STATE"

compose() { docker compose --env-file .env -f docker/docker-compose.prod.yml "$@"; }
log() { printf '==> %s\n' "$*"; }
die() { printf 'deploy: %s\n' "$*" >&2; exit 1; }

[ -f .env ] || die "no .env in $(pwd) (docker/README.md, Once, by hand)"

# A registry image becomes name@sha256:…, so the deploy runs exactly the bytes
# it pulled and a rollback can name them again.
pin() {
  docker pull --quiet "$1" >/dev/null
  docker image inspect --format '{{index .RepoDigests 0}}' "$1"
}

case "${1:-}" in
  --build)
    [ -z "$(git status --porcelain --untracked-files=no)" ] \
      || die "the checkout has local changes; deploy a commit"
    sha=$(git rev-parse HEAD)
    log "building $sha"
    docker build --quiet -f apps/api/Dockerfile -t "resetowl/api:$sha" . >/dev/null
    # flama:begin web
    docker build --quiet -f apps/web/Dockerfile -t "resetowl/web:$sha" . >/dev/null
    WEB_IMAGE="resetowl/web:$sha"
    # flama:end web
    API_IMAGE="resetowl/api:$sha"
    ;;
  --images)
    [ $# -ge 2 ] || die "usage: deploy.sh --images API_IMAGE [WEB_IMAGE]"
    API_IMAGE=$(pin "$2")
    # flama:begin web
    [ $# -ge 3 ] || die "usage: deploy.sh --images API_IMAGE WEB_IMAGE"
    WEB_IMAGE=$(pin "$3")
    # flama:end web
    ;;
  --rollback)
    [ -f "$STATE/previous" ] || die "no previous deploy to go back to"
    # shellcheck disable=SC1091
    . "./$STATE/previous"
    ;;
  *) die "usage: deploy.sh --build | --images API_IMAGE WEB_IMAGE | --rollback" ;;
esac
export API_IMAGE
# flama:begin web
export WEB_IMAGE
# flama:end web

bash docker/check-invariants.sh

# What is running now, to go back to if this deploy does not come up.
running=$(compose ps --format '{{.Service}} {{.Image}}' 2>/dev/null || true)
prev_api=$(printf '%s\n' "$running" | awk '$1 == "api" { print $2 }')
prev_web=$(printf '%s\n' "$running" | awk '$1 == "web" { print $2 }')

roll_back() {
  if [ -z "$prev_api" ]; then
    printf 'deploy: failed, and there is nothing running to go back to\n' >&2
    exit 1
  fi
  printf 'deploy: failed; starting the previous images again\n' >&2
  API_IMAGE=$prev_api
  WEB_IMAGE=${prev_web:-$WEB_IMAGE}
  export API_IMAGE WEB_IMAGE
  compose up -d --wait --remove-orphans || true
  exit 1
}

log "starting postgres and redis"
compose pull --quiet postgres redis cloudflared
compose up -d --wait postgres redis

log "migrating with $API_IMAGE"
compose run --rm --no-deps api sh -c \
  'node "$(node -p "require.resolve(\"typeorm/cli.js\")")" migration:run -d dist/config/data-source.js' \
  || roll_back

log "starting the stack"
compose up -d --wait --remove-orphans || roll_back

log "checking readiness inside the network"
ready=0
for _ in 1 2 3 4 5 6 7 8 9 10 11 12; do
  if compose exec -T api wget -qO- http://127.0.0.1:3001/api/v1/ready >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 5
done
[ "$ready" = 1 ] || roll_back

if [ -n "$prev_api" ] && [ "$prev_api" != "$API_IMAGE" ]; then
  printf 'API_IMAGE=%s\nWEB_IMAGE=%s\n' "$prev_api" "${prev_web:-}" > "$STATE/previous"
fi
printf 'API_IMAGE=%s\nWEB_IMAGE=%s\n' "$API_IMAGE" "${WEB_IMAGE:-}" > "$STATE/current"
compose ps
docker image prune --force --filter "until=168h" >/dev/null
log "deployed $API_IMAGE"
