---
"@flama/api": minor
"@flama/api-client": minor
"@flama/shared": minor
"@flama/web": minor
"@flama/frontend-consumer": minor
"@flama/translations": minor
"@flama/usage-providers": minor
"@flama/desktop": minor
---

Read a GLM Coding Plan's usage automatically, opt-in, and track BigModel plans. `bigmodel` joins `zai` as a manual provider, with its Lite, Pro and Max plans (no published price: the account carries the one paid, in US dollars). In the desktop app, a Z.AI or BigModel account can turn on an unofficial usage reader: the person's Coding Plan key, encrypted with `safeStorage`, reads `/api/monitor/usage/quota/limit` on the vendor's own site (undocumented; the endpoint the vendor's usage plugin calls) and the desktop sends the 5-hour, weekly and monthly MCP windows to the new `POST /v1/accounts/:id/readings`, never the key. Readings carry the source `unofficial`, the screens say so, and they lapse like hand-typed ones; recording by hand stays the fallback.
