---
"@flama/desktop": minor
"@flama/site": minor
---

Deploy to production. The macOS app is built for arm64 and x64, signed with a
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
