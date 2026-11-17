# Production

ResetOwl runs in three places:

| What | Where | Deployed by |
| --- | --- | --- |
| The API, Postgres, Redis (and the web app) | One server with Docker, behind Caddy | `.github/workflows/deploy.yml`, after CI passes on `main` |
| The landing page (`apps/site`) | Cloudflare Pages | `.github/workflows/deploy-site.yml`, on a push to `main` that touches it |
| The macOS app | GitHub releases, signed and notarized | `.github/workflows/desktop-release.yml`, on a `desktop-v*` tag |

## The server

`docker-compose.prod.yml` is the whole stack: `postgres`, `redis`, `api`
and `caddy`, which holds ports 80 and 443, gets a Let's Encrypt certificate
for each domain in `Caddyfile` and proxies to the others. The other services'
ports are published on loopback only.

<!-- flama:begin web -->
The web app is the `web` service, at `APP_DOMAIN`.
<!-- flama:end web -->

### Once, by hand

1. A server with Docker Engine and the Compose plugin, ports 22, 80 and 443
   open. Point each domain in the `.env` below (`API_DOMAIN`, `APP_DOMAIN`)
   at its address: an A/AAAA record each, and at Cloudflare DNS only, not
   proxied, so Caddy can answer the ACME challenge.
2. A deploy user in the `docker` group, with the public half of a new SSH
   key in its `~/.ssh/authorized_keys`.
3. The directory the stack lives in (`/srv/resetowl`, say), owned by that
   user, holding the production `.env`: the root `.env.example` filled in.
   What differs from development:

   ```dotenv
   NODE_ENV=production
   BETTER_AUTH_SECRET=<openssl rand -base64 32>
   BETTER_AUTH_URL=https://api.resetowl.com
   FRONTEND_URL=https://app.resetowl.com
   # Caddy is one hop in front of the API; the web app's nginx is a second
   # on /api, but it forwards Caddy's X-Forwarded-For untouched, so the
   # client is still the last address Express trusts.
   TRUST_PROXY=1
   DB_PASSWORD=<a strong password, fixed before the first start>
   API_IMAGE=ghcr.io/jordiparracrespo/ai-subs-tracker/flama-api:latest
   API_DOMAIN=api.resetowl.com
   # flama:begin web
   WEB_IMAGE=ghcr.io/jordiparracrespo/ai-subs-tracker/flama-web:latest
   APP_DOMAIN=app.resetowl.com
   # flama:end web
   ```

   `chmod 600 .env`. It never leaves the server and no workflow writes it.
4. On GitHub, an environment named `production` (Settings → Environments)
   with the secrets `DEPLOY_SSH_KEY` (the private key) and
   `DEPLOY_KNOWN_HOSTS` (`ssh-keyscan -t ed25519 <host>`, checked against
   the server's own fingerprint), and the variables `DEPLOY_HOST`,
   `DEPLOY_USER`, `DEPLOY_PATH` and, if it is not `api.resetowl.com`,
   `DEPLOY_API_DOMAIN`. Add yourself as a required reviewer there to approve
   each deploy.

Then run **Deploy** from the Actions tab (or merge to `main`).

### Each deploy

The workflow copies `docker-compose.prod.yml`, `Caddyfile` and `deploy.sh`
into `$DEPLOY_PATH/docker/` and runs `deploy.sh` there, which pulls the
`:latest` images, runs the TypeORM migrations from the API image, and
`up -d`s the stack. It logs in to GHCR with the job's own token and out again
afterwards, then waits for `https://$API_DOMAIN/api/v1/ready`. The same script
works by hand on the server: `sh docker/deploy.sh`.

Postgres keeps its data in the `postgres_data` volume. Back it up
(`docker compose … exec postgres pg_dump -U flama flama`) before anything
that changes `DB_*` or the Postgres major version.

<!-- flama:begin site -->
## The landing page

A Cloudflare Pages project (Workers & Pages → Create → Pages → Direct
Upload) named `resetowl`, with the custom domain `resetowl.com` (and
`www.resetowl.com`, redirected to the apex with a Bulk Redirect). On GitHub,
an environment named `site` with the secret `CLOUDFLARE_API_TOKEN` (a token
with *Account → Cloudflare Pages → Edit*) and the variable
`CLOUDFLARE_ACCOUNT_ID`. `apps/site/cloudflare/_headers` carries the headers
nginx sets in the Docker image. `tokenaitor.com`'s redirect is a Bulk
Redirect too: Pages has no host-based rules.
<!-- flama:end site -->

## The macOS app

`apps/desktop/README.md`, *Releasing*.
