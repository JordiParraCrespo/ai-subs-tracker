# @flama/site

## 0.3.0

### Minor Changes

- 6b4f040: Deploy to production. The macOS app is built for arm64 and x64, signed with a
  Developer ID under the hardened runtime, notarized and attached to a GitHub
  release on a `desktop-v*` tag. The landing page is published to Cloudflare
  Pages with the same headers its nginx image sets. The API and web app run on
  a Docker server that opens no port: public traffic arrives through a
  Cloudflare Tunnel, administration over Tailscale (docker/README.md).

  The site has a download page (`/download/`, in English and Spanish): a card
  per platform linking to the newest release's installer, the reader's own
  platform marked, and what to do after downloading. Every "Download" link on
  the site goes there. The desktop release now builds Windows and Linux too,
  under file names without the version, so those links hold across releases.

### Patch Changes

- 56418e8: Serve the screens and the site from nginx 1.31.9, pinned by digest: the first release with the fix for CVE-2026-123007 and the rest of the November 2026 HTTP/2 advisories.
- deed06d: Track a Z.AI Coding Plan by hand. `zai` joins the providers as the first manual one: its Lite, Pro and Max plans (credits per window from Z.AI's docs; only Lite's $18 price is published, so Pro and Max take the price paid), `POST /v1/accounts` to add one and `POST /v1/accounts/:id/usage` to record its 5-hour and weekly usage. The desktop collector, sync and terminal switching stay Claude Code and Codex only. A `Select` inside a dialog now opens above it.
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [69128f7]
- Updated dependencies [0fbe635]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [47d4885]
- Updated dependencies [67d26cb]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [ef55a1e]
- Updated dependencies [5028983]
- Updated dependencies [773192b]
- Updated dependencies [e0c087f]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [e33f950]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [deed06d]
  - @flama/shared@1.0.0
  - @flama/design-system-web@0.2.0
