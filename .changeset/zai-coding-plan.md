---
"@flama/api": minor
"@flama/api-client": minor
"@flama/shared": minor
"@flama/web": minor
"@flama/frontend-consumer": minor
"@flama/design-system-web": patch
"@flama/translations": minor
"@flama/usage-providers": patch
"@flama/desktop": patch
"@flama/site": patch
---

Track a Z.AI Coding Plan by hand. `zai` joins the providers as the first manual one: its Lite, Pro and Max plans (credits per window from Z.AI's docs; only Lite's $18 price is published, so Pro and Max take the price paid), `POST /v1/accounts` to add one and `POST /v1/accounts/:id/usage` to record its 5-hour and weekly usage. The desktop collector, sync and terminal switching stay Claude Code and Codex only. A `Select` inside a dialog now opens above it.
