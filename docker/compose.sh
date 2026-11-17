#!/bin/sh
# `docker compose` for the production stack on the server, with the images
# the last deploy started (.deploy/current, written by docker/deploy.sh):
#
#   sh docker/compose.sh ps
#   sh docker/compose.sh logs -f api
#   sh docker/compose.sh exec postgres psql -U flama flama
#
# Images exported in the environment (deploy.sh does) win over the file.
set -eu
cd "$(dirname "$0")/.."
current=""
[ -f .deploy/current ] && current="--env-file .deploy/current"
# shellcheck disable=SC2086
exec docker compose --env-file .env $current -f docker/docker-compose.prod.yml "$@"
