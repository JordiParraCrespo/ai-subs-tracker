---
"@flama/api": minor
"@flama/env": minor
---

Email can be sent through Cloudflare Email Sending (`EMAIL_PROVIDER=cloudflare`, `CLOUDFLARE_ACCOUNT_ID`, and the token in `CLOUDFLARE_EMAIL_TOKEN` or its `_FILE`). A rate-limited send holds the email queue until Cloudflare's reset instead of failing the job.
