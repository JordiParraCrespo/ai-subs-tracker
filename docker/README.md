# Production

ResetOwl runs in three places:

| What | Where | Deployed by |
| --- | --- | --- |
| The API, Postgres, Redis (and the web app) | One server with Docker, reached through a Cloudflare Tunnel | `docker/deploy.sh`, run on the server over Tailscale |
| The landing page (`apps/site`) | Cloudflare Pages | `wrangler pages deploy`, by hand |
| The macOS app | GitHub releases, signed and notarized | `.github/workflows/desktop-release.yml`, on a `desktop-v*` tag |

Deploys are by hand for now; CI comes later.

## The server

A Hetzner server named `resetowl` that **opens no port to the internet**:

- The public traffic arrives through `cloudflared`, which dials out to
  Cloudflare. `cloudflared/config.yml` routes `api.resetowl.com` to the API,
  and anything else to a 404.
- Administration is over Tailscale only: `ssh ops@resetowl`. sshd answers on
  the tailnet interface, ufw denies everything else, and a Hetzner firewall
  with no rules sits in front of both.

<!-- flama:begin web -->
The tunnel also routes `app.resetowl.com` to the `web` service, whose nginx
serves the screens and proxies `/api` to the API.
<!-- flama:end web -->

`docker-compose.prod.yml` is the whole stack, and `check-invariants.sh`
refuses to deploy one that breaks its rules:

- no service publishes a port (Docker publishes past ufw);
- every image is pinned by digest, or is built on the server from a commit;
- Postgres and Redis are on `data`, a network with no route out;
- no secret is an environment variable. The secrets are files in
  `/srv/secrets` (a directory only root can enter), mounted at
  `/run/secrets`; `@flama/env` reads each `<NAME>_FILE` into `<NAME>`, for
  the secrets in its `SECRET_NAMES` (a new secret gets a line there).

### Once, by hand

These are done for `resetowl`; they are here for a new server.

1. The server: Docker Engine and the Compose plugin, `jq`, Tailscale up
   with SSH allowed on `tailscale0` only, and a user (`ops`) in the
   `docker` group with your key.
2. The secrets, generated on the server and never printed:

   ```sh
   sudo install -d -m 700 /srv/secrets
   for f in db_password better_auth_secret; do
     openssl rand -base64 32 | tr -d '/+=\n' | sudo tee /srv/secrets/$f >/dev/null
     sudo chmod 444 /srv/secrets/$f   # the containers' users read them; the directory keeps everyone else out
   done
   ```

   `db_password` is fixed the first time Postgres starts. Changing it
   later means changing the role's password inside Postgres as well.
   Changing `better_auth_secret` signs everyone out and makes stored
   two-factor secrets unreadable.
3. The tunnel. `cloudflared tunnel login` (a one-off container is
   enough; approve `resetowl.com` in the browser), then
   `cloudflared tunnel create resetowl` and
   `cloudflared tunnel route dns resetowl <hostname>` for each hostname in
   `cloudflared/config.yml`. Copy the `<tunnel id>.json` it wrote to
   `/srv/secrets/tunnel_credentials.json` (mode 444). Delete `cert.pem`:
   it can create tunnels on the whole zone, and the running tunnel does not
   need it.
4. The checkout: `/srv/resetowl`, owned by `ops`, with a `.env` (mode
   600) holding only what differs from the defaults, and no secret:

   ```dotenv
   NODE_ENV=production
   FRONTEND_URL=https://app.resetowl.com
   BETTER_AUTH_URL=https://api.resetowl.com
   # One hop in front of the API: cloudflared. The web app's nginx is a
   # second on /api, but it forwards X-Forwarded-For untouched.
   TRUST_PROXY=1
   AUTH_RATE_LIMIT_ENABLED=true
   TWO_FACTOR_ISSUER=ResetOwl
   EMAIL_PROVIDER=cloudflare
   EMAIL_FROM=ResetOwl <noreply@resetowl.com>
   CLOUDFLARE_ACCOUNT_ID=<the Cloudflare account id>
   TUNNEL_ID=<the tunnel's id>
   ```
5. Email. Cloudflare Email Sending needs the account on Workers Paid and the
   domain onboarded (`wrangler email sending enable resetowl.com`, which adds
   its SPF and DKIM records). Create an account API token whose only
   permission is sending email, and write it to
   `/srv/secrets/cloudflare_email_token` (mode 444). The compose file mounts
   it whatever `EMAIL_PROVIDER` says, so the file must exist; with
   `EMAIL_PROVIDER=console` it may be empty.

### Each deploy

On the server, in `/srv/resetowl`, with the commit to deploy checked out:

```sh
sh docker/deploy.sh --build      # build the images here, from HEAD
sh docker/deploy.sh --rollback   # back to the images the last deploy replaced
```

`deploy.sh --images <api> <web>` pulls the images instead and pins each one
by digest, for when CI pushes them. Each run:

1. checks the invariants;
2. runs the TypeORM migrations from the new API image;
3. starts the stack and waits for every health check;
4. asks the API for `/api/v1/ready` from inside the network.

If a step after the migrations fails, the images that were running start
again. Migrations only go forward, so the previous release must run on the
new schema: add in one release, drop in a later one
(`deploy.manifest.json`).

`sh docker/compose.sh <command>` is `docker compose` for the running stack
(`ps`, `logs -f api`, `exec postgres psql -U flama flama`).

Postgres keeps its data in the `postgres_data` volume. Back it up
(`sh docker/compose.sh exec postgres pg_dump -U flama flama`) before
anything that changes the Postgres major version.

<!-- flama:begin site -->
## The landing page

A Cloudflare Pages project named `resetowl`, with the custom domain
`resetowl.com`. From a checkout, signed in with `wrangler login`:

```sh
VITE_SITE_APP_URL=https://app.resetowl.com pnpm exec turbo run build --filter=@flama/site
cp apps/site/cloudflare/_headers apps/site/dist/
pnpm dlx wrangler@4.156.0 pages deploy apps/site/dist --project-name=resetowl --branch=main
```

`cloudflare/_headers` carries the headers nginx sets in the Docker image.
The project was created with
`wrangler pages project create resetowl --production-branch=main --force`:
wrangler 4.156 hands a new Pages project to Workers unless told not to.
Deploys to the existing project need no `--force`.
<!-- flama:end site -->

## The macOS app

`apps/desktop/README.md`, *Releasing*.
