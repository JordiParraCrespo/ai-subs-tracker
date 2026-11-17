---
"@flama/desktop": minor
"@flama/site": patch
---

Deploy to production. The macOS app is built for arm64 and x64, signed with a
Developer ID under the hardened runtime, notarized and attached to a GitHub
release on a `desktop-v*` tag. The landing page is published to Cloudflare
Pages with the same headers its nginx image sets. The API and web app run on
a Docker server that opens no port: public traffic arrives through a
Cloudflare Tunnel, administration over Tailscale (docker/README.md).
