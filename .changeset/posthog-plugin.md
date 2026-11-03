---
"@flama/web": major
"@flama/frontend-web": minor
---

PostHog leaves the starter: the apps pass no analytics client to `FlamaApp.create`, so events go to the kernel's no-op one, and the kits no longer export a PostHog adapter.
