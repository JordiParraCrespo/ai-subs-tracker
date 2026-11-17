---
"@flama/desktop": minor
"@flama/site": patch
---

Deploy to production. The macOS app is built for arm64 and x64, signed with a
Developer ID under the hardened runtime, notarized and attached to a GitHub
release on a `desktop-v*` tag. The landing page is published to Cloudflare
Pages with the same headers its nginx image sets. The API and web app reach a
Docker server behind Caddy after CI passes on `main` (docker/README.md).
